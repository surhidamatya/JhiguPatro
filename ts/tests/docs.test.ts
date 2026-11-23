/**
 * Runs the code samples in docs/USAGE.md so the docs cannot rot.
 *
 * A fenced block whose info string is `js test` is executed, in document order,
 * in one shared session (the calendar set up by an early block stays set up).
 * Rules for those blocks:
 *  - imports from `jhigu-patro-utils-ts` or `jhigu-patro-utils-ts/<export>` are
 *    resolved to the sources through the package.json `exports` map; `node:*`
 *    imports are real;
 *  - a one-line statement ending in `// => <js expression>` is an assertion:
 *    the value of the statement (or of the variable it declares) must deep-equal
 *    the expression;
 *  - top-level await works.
 * Blocks with other info strings (`js`, `ts`, `html`, `dart`, ...) are not run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')) as { name: string; exports: Record<string, { import: string }> };
const doc = readFileSync(join(root, 'docs/USAGE.md'), 'utf8');

function sourceFor(specifier: string): string | null {
  if (specifier === pkg.name) return join(here, '../src/index.ts');
  if (!specifier.startsWith(`${pkg.name}/`)) return null;
  const entry = pkg.exports[`./${specifier.slice(pkg.name.length + 1)}`];
  if (!entry) throw new Error(`docs import ${specifier} is not in package.json exports`);
  return join(here, '..', entry.import.replace('./dist/', 'src/').replace(/\.js$/, '.ts'));
}

interface Block { line: number; code: string }

function testBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const re = /^```js test\n([\s\S]*?)^```$/gm;
  for (const m of md.matchAll(re)) {
    blocks.push({ line: md.slice(0, m.index).split('\n').length, code: m[1] });
  }
  return blocks;
}

const IMPORT_ALL = /^import\s+([\s\S]*?)\s+from\s+'([^']+)';?[ \t]*$/gm;

/** Turn a block into an async function body. Returns the body and the specifiers it needs. */
function compile(code: string): { body: string; imports: string[] } {
  const imports: string[] = [];
  // Imports first (they may span lines), then the one-line assertions.
  const withoutImports = code.replace(IMPORT_ALL, (_all, clause: string, spec: string) => {
    const idx = imports.push(spec) - 1;
    const c = clause.trim();
    if (c.startsWith('* as ')) return `const ${c.slice(5)} = await __import(${idx});`;
    if (c.startsWith('{')) return `const ${c.replace(/\s+as\s+/g, ': ').replace(/\s*\n\s*/g, ' ')} = await __import(${idx});`;
    return `const ${c} = (await __import(${idx})).default;`;
  });
  const out: string[] = [];
  for (const raw of withoutImports.split('\n')) {
    const decl = /^(\s*)(?:const|let)\s+(\w+)\s*=\s*(.*?);\s*\/\/ => (.+)$/.exec(raw);
    if (decl) { out.push(`${raw.slice(0, raw.indexOf('//')).trimEnd()} __check(${decl[2]}, ${decl[4]}, ${JSON.stringify(raw.trim())});`); continue; }
    const expr = /^(\s*)(.*?);\s*\/\/ => (.+)$/.exec(raw);
    if (expr) { out.push(`${expr[1]}__check(${expr[2]}, ${expr[3]}, ${JSON.stringify(raw.trim())});`); continue; }
    out.push(raw);
  }
  return { body: out.join('\n'), imports };
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...a: unknown[]) => Promise<void>;

describe('docs/USAGE.md samples', () => {
  const blocks = testBlocks(doc);

  it('has runnable samples', () => {
    expect(blocks.length).toBeGreaterThan(10);
  });

  it('every package.json export points at a source file', () => {
    for (const key of Object.keys(pkg.exports)) {
      const spec = key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`;
      // The data files are shipped as they are, next to package.json.
      const file = key.endsWith('.json') ? join(here, '..', key.slice(2)) : sourceFor(spec)!;
      expect(existsSync(file), `${spec} -> ${file}`).toBe(true);
    }
  });

  it('every export in package.json is mentioned in the docs', () => {
    for (const key of Object.keys(pkg.exports).filter(k => k !== '.')) {
      expect(doc, `docs should mention ${pkg.name}/${key.slice(2)}`).toContain(`${pkg.name}/${key.slice(2)}`);
    }
  });

  it('runs every `js test` block in order', async () => {
    let checks = 0;
    for (const block of blocks) {
      const { body, imports } = compile(block.code);
      const __import = async (i: number) => {
        const spec = imports[i];
        const file = sourceFor(spec);
        return import(/* @vite-ignore */ file ?? spec);
      };
      const __check = (actual: unknown, expected: unknown, text: string) => {
        checks++;
        try { expect(actual).toEqual(expected); }
        catch (e) { throw new Error(`docs/USAGE.md line ${block.line}: ${text}\n${(e as Error).message}`); }
      };
      try {
        await new AsyncFunction('__import', '__check', body)(__import, __check);
      } catch (e) {
        if ((e as Error).message.startsWith('docs/USAGE.md')) throw e;
        throw new Error(`docs/USAGE.md block at line ${block.line} threw: ${(e as Error).message}`);
      }
    }
    expect(checks).toBeGreaterThan(40);
  });
});


/**
 * The per-feature guides in docs/features/<name>/README.md follow the same rules as USAGE.md: their
 * `js test` blocks run in order in one session per file (so each file sets the calendar up itself
 * where it needs it), and a relative link in any of the Markdown docs must point at a file that exists.
 */
const featureDir = join(root, 'docs/features');
const featureFiles = existsSync(featureDir)
  ? readdirSync(featureDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => `docs/features/${d.name}/README.md`).filter(f => existsSync(join(root, f)))
  : [];

/** Features that are about markup or another language and so have no runnable JavaScript. */
const NO_JS_REQUIRED = new Set(['docs/features/web-components/README.md', 'docs/features/flutter/README.md']);

describe('docs/features guides', () => {
  it('has a guide for every feature', () => {
    expect(featureFiles.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of featureFiles) {
    it(`${file}: runs every \`js test\` block in order`, async () => {
      const md = readFileSync(join(root, file), 'utf8');
      const blocks = testBlocks(md);
      if (!NO_JS_REQUIRED.has(file)) expect(blocks.length, `${file} should have runnable samples`).toBeGreaterThan(0);
      for (const block of blocks) {
        const { body, imports } = compile(block.code);
        const __import = async (i: number) => {
          const spec = imports[i];
          const src = sourceFor(spec);
          return import(/* @vite-ignore */ src ?? spec);
        };
        const __check = (actual: unknown, expected: unknown, text: string) => {
          try { expect(actual).toEqual(expected); }
          catch (e) { throw new Error(`${file} line ${block.line}: ${text}\n${(e as Error).message}`); }
        };
        try {
          await new AsyncFunction('__import', '__check', body)(__import, __check);
        } catch (e) {
          if ((e as Error).message.startsWith(file)) throw e;
          throw new Error(`${file} block at line ${block.line} threw: ${(e as Error).message}`);
        }
      }
    });
  }
});

describe('Markdown links', () => {
  const docs = ['README.md', 'examples/README.md', 'examples/node-script/README.md', 'examples/web-vite/README.md', 'examples/dart-console/README.md', 'docs/USAGE.md', 'ts/README.md', 'cli/README.md', 'react/README.md', 'vue/README.md', 'flutter/README.md', ...featureFiles];
  for (const file of docs) {
    it(`${file}: relative links point at files that exist`, () => {
      const md = readFileSync(join(root, file), 'utf8').replace(/^```[\s\S]*?^```$/gm, '');
      const bad: string[] = [];
      for (const m of md.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = target.split('#')[0];
        if (path && !existsSync(resolve(root, dirname(file), path))) bad.push(target);
      }
      expect(bad, `broken links in ${file}`).toEqual([]);
    });
  }
});
