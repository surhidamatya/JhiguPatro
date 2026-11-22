#!/usr/bin/env node
/**
 * Release-readiness check: packs each npm package the way `npm publish` would, looks inside
 * the tarballs, then installs them into a scratch project (as a consumer would) and imports
 * everything. Nothing is published and nothing leaves the machine except what `npm install`
 * fetches for the peer dependencies (react, react-dom, vue, typescript).
 *
 *   cd ts && npm run build; cd ../cli && npm run build; cd ../react && npm run build; cd ../vue && npm run build
 *   node tools/pack-check/check.mjs
 *
 * Checks, per package:   FAIL = would break a consumer      WARN = should be fixed before publishing
 *   FAIL  a dependency that is a `file:` or `link:` path, or a relative path
 *   FAIL  `main`, `module`, `types`, `bin` or an `exports` target that is not in the tarball
 *   FAIL  source, tests, examples, tsconfig, .env or other repo files in the tarball
 *   WARN  no LICENSE file, no README, no `repository`, no `files` list
 * Then, in a scratch project with all the tarballs installed:
 *   FAIL  an export of `jhigu-patro-utils-ts` that cannot be imported, or has no exports
 *   FAIL  the React and Vue packages do not import, or lack their components
 *   FAIL  the installed `jhigu-patro` command does not run
 *   FAIL  a TypeScript file importing every subpath does not type-check (node16 and bundler resolution)
 * Exit code 1 when any FAIL; WARNs are listed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../..');
const PACKAGES = ['ts', 'cli', 'react', 'vue'];
const work = mkdtempSync(join(tmpdir(), 'jhigu-pack-'));

const results = [];
const fail = (where, msg) => results.push({ level: 'FAIL', where, msg });
const warn = (where, msg) => results.push({ level: 'WARN', where, msg });
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

// ── 1. pack and inspect each package ─────────────────────────────────────────
const tarballs = {};
const DENY = [
  [/^package\/src\//, 'source files (src/)'], [/^package\/tests?\//, 'tests'], [/^package\/examples?\//, 'examples'],
  [/^package\/tsconfig[^/]*\.json$/, 'tsconfig'], [/^package\/\.env/, '.env file'], [/^package\/node_modules\//, 'node_modules'],
  [/^package\/vitest\.config/, 'test config'], [/\.test\.[cm]?[jt]s$/, 'test files'], [/^package\/package-lock\.json$/, 'package-lock'],
  [/^package\/example\//, 'example app'],
];
for (const name of PACKAGES) {
  const dir = join(repo, name);
  let out;
  try { out = JSON.parse(sh('npm', ['pack', '--json', '--pack-destination', work], { cwd: dir })); }
  catch (e) { fail(name, `npm pack failed: ${String(e.stderr ?? e.message).split('\n')[0]}`); continue; }
  const info = out[0];
  tarballs[name] = join(work, info.filename);
  const files = info.files.map(f => `package/${f.path}`);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

  // dependencies a consumer cannot resolve
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, spec] of Object.entries(pkg[field] ?? {})) {
      if (/^(file:|link:|\.{1,2}\/|\/|workspace:)/.test(spec)) fail(name, `${field}.${dep} is "${spec}", a path a consumer cannot install`);
    }
  }
  // entry points that must be in the tarball
  const targets = new Set();
  for (const f of ['main', 'module', 'types']) if (pkg[f]) targets.add(pkg[f]);
  if (typeof pkg.bin === 'string') targets.add(pkg.bin); else for (const v of Object.values(pkg.bin ?? {})) targets.add(v);
  const walk = v => { if (typeof v === 'string') targets.add(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(pkg.exports);
  for (const t of targets) {
    if (t.includes('*')) continue;
    if (!files.includes(`package/${t.replace(/^\.\//, '')}`)) fail(name, `"${t}" is named in package.json but is not in the tarball`);
  }
  // things that should not be published
  const seen = new Map();
  for (const f of files) for (const [re, why] of DENY) if (re.test(f)) seen.set(why, (seen.get(why) ?? 0) + 1);
  for (const [why, n] of seen) fail(name, `the tarball contains ${why} (${n} file${n === 1 ? '' : 's'})`);
  // hygiene
  if (!files.some(f => /^package\/licen[sc]e(\.[a-z]+)?$/i.test(f))) warn(name, 'no LICENSE file in the tarball (package.json says ' + (pkg.license ?? 'nothing') + ')');
  if (!files.some(f => /^package\/readme/i.test(f))) warn(name, 'no README in the tarball');
  if (!pkg.repository) warn(name, 'no "repository" in package.json');
  if (!pkg.files) warn(name, 'no "files" list: what is published depends on .gitignore and .npmignore');
  if (pkg.private) warn(name, '"private": true, npm publish will refuse');
  results.push({ level: 'INFO', where: name, msg: `${info.name}@${info.version}: ${info.entryCount} files, ${Math.round(info.size / 1024)} KB packed, ${Math.round(info.unpackedSize / 1024)} KB unpacked` });
}

// ── 2. install the tarballs in a scratch project, import everything ──────────
const consumer = join(work, 'consumer');
mkdirSync(consumer);
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
const have = Object.keys(tarballs);
if (have.length === PACKAGES.length) {
  const install = spawnSync('npm', ['install', '--no-audit', '--no-fund', ...have.map(n => tarballs[n]), 'react@19', 'react-dom@19', 'vue@3', 'typescript@5'], { cwd: consumer, encoding: 'utf8' });
  if (install.status !== 0) fail('consumer', `npm install of the tarballs failed: ${install.stderr.split('\n').filter(l => /ERR|error/.test(l)).slice(0, 3).join(' | ')}`);
  else {
    const utilsPkg = JSON.parse(readFileSync(join(consumer, 'node_modules/jhigu-patro-utils-ts/package.json'), 'utf8'));
    const subpaths = Object.keys(utilsPkg.exports).filter(k => k !== './package.json' && !k.includes('*'));
    const importer = join(consumer, 'import-all.mjs');
    writeFileSync(importer, `
      const out = {};
      for (const sub of ${JSON.stringify(subpaths)}) {
        const spec = sub === '.' ? 'jhigu-patro-utils-ts' : 'jhigu-patro-utils-ts/' + sub.slice(2);
        try { const m = spec.endsWith('.json') ? await import(spec, { with: { type: 'json' } }) : await import(spec); out[spec] = Object.keys(m).length; } catch (e) { out[spec] = 'ERROR ' + String(e.message).split('\\n')[0]; }
      }
      for (const spec of ['jhigu-patro-react', 'jhigu-patro-vue']) {
        try { const m = await import(spec); out[spec] = Object.keys(m).filter(k => k.startsWith('Jhigu')).sort().join(','); } catch (e) { out[spec] = 'ERROR ' + String(e.message).split('\\n')[0]; }
      }
      console.log(JSON.stringify(out));
    `);
    const run = spawnSync(process.execPath, [importer], { cwd: consumer, encoding: 'utf8' });
    if (run.status !== 0) fail('consumer', `importing the packages crashed: ${run.stderr.split('\n')[0]}`);
    else {
      const out = JSON.parse(run.stdout);
      for (const [spec, v] of Object.entries(out)) {
        if (typeof v === 'string' && v.startsWith('ERROR')) fail('consumer', `import "${spec}": ${v}`);
        else if (spec.startsWith('jhigu-patro-utils-ts') && v === 0) fail('consumer', `import "${spec}" has no exports`);
      }
      const want = 'JhiguAddressSelect,JhiguCalendar,JhiguDatePicker,JhiguDateRangePicker,JhiguMoneyInput,JhiguPhoneInput';
      for (const p of ['jhigu-patro-react', 'jhigu-patro-vue']) if (out[p] !== want) fail('consumer', `${p} exports ${out[p]}, expected ${want}`);
      results.push({ level: 'INFO', where: 'consumer', msg: `imported ${subpaths.length} subpaths of jhigu-patro-utils-ts, plus the React and Vue packages` });
    }
    // the installed command
    const bin = join(consumer, 'node_modules/.bin/jhigu-patro');
    if (!existsSync(bin)) fail('consumer', 'the jhigu-patro command was not installed');
    else {
      const a = spawnSync(bin, ['ad2bs', '2025-08-26'], { cwd: consumer, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
      if (a.status !== 0 || !/2082-05-10/.test(a.stdout)) fail('consumer', `the installed "jhigu-patro ad2bs 2025-08-26" did not work: ${(a.stderr || a.stdout).split('\n').filter(Boolean)[0] ?? 'no output'}`);
      const h = spawnSync(bin, ['phone', '9841234567', '--json'], { cwd: consumer, encoding: 'utf8' });
      if (h.status !== 0 || !/9779841234567/.test(h.stdout)) fail('consumer', `the installed "jhigu-patro phone" did not work: ${(h.stderr || h.stdout).split('\n').filter(Boolean)[0] ?? 'no output'}`);
    }
    // types: a TS file that imports a name from every subpath
    const names = {};
    const typeFile = [];
    for (const sub of subpaths.filter(x => !x.endsWith('.json'))) {
      const spec = sub === '.' ? 'jhigu-patro-utils-ts' : 'jhigu-patro-utils-ts/' + sub.slice(2);
      typeFile.push(`import * as m${typeFile.length} from '${spec}'; void m${typeFile.length};`);
    }
    typeFile.push(`import { JhiguDatePicker } from 'jhigu-patro-react'; void JhiguDatePicker;`);
    typeFile.push(`import { JhiguDatePicker as V } from 'jhigu-patro-vue'; void V;`);
    writeFileSync(join(consumer, 'types.ts'), typeFile.join('\n') + '\n');
    for (const resolution of ['node16', 'bundler']) {
      writeFileSync(join(consumer, `tsconfig.${resolution}.json`), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: resolution === 'node16' ? 'node16' : 'esnext', moduleResolution: resolution, strict: true, noEmit: true, skipLibCheck: true, lib: ['ES2022', 'DOM'], jsx: 'react-jsx', types: [] },
        files: ['types.ts'],
      }));
      const tsc = spawnSync(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '-p', `tsconfig.${resolution}.json`], { cwd: consumer, encoding: 'utf8' });
      if (tsc.status !== 0) fail('consumer', `type-check with moduleResolution ${resolution}: ${tsc.stdout.split('\n').filter(l => /error TS/.test(l)).slice(0, 3).join(' | ')}`);
    }
  }
} else {
  fail('consumer', `skipped: could not pack ${PACKAGES.filter(n => !tarballs[n]).join(', ')}`);
}

// ── report ───────────────────────────────────────────────────────────────────
for (const r of results) console.log(`${{ FAIL: '✖ FAIL', WARN: '! WARN', INFO: '  info' }[r.level]}  ${r.where.padEnd(8)} ${r.msg}`);
const fails = results.filter(r => r.level === 'FAIL').length;
const warns = results.filter(r => r.level === 'WARN').length;
console.log(`\n${fails} failure(s), ${warns} warning(s). Scratch files: ${work}`);
process.exit(fails ? 1 : 0);
