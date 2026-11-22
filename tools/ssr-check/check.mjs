#!/usr/bin/env node
/**
 * Server rendering and hydration check of the React and Vue packages in a real framework:
 * react/example-next (Next.js) and vue/example-nuxt (Nuxt).
 *
 * For each example it builds the app, starts the production server, and checks:
 *   1. the server HTML has the five empty wrappers (`display:contents`) and no custom element
 *      (nothing needs `customElements` on the server);
 *   2. in Chromium, after hydration: no console error or warning and no page error, each of the
 *      five elements exists exactly once, the date picker draws its 31 days, typing in the money
 *      field formats it, and submitting the form gives `dob` and `amount` (integer paisa).
 *
 *   node tools/ssr-check/check.mjs                 # both
 *   node tools/ssr-check/check.mjs --only next     # or nuxt
 *
 * Needs the packages built (`ts`, `react`, `vue`: `npm ci && npm run build`), the examples'
 * dependencies installed (`npm ci` in each example), and `playwright-core` with Chromium
 * (`cd tools/browser-check && npm ci && npx playwright-core install chromium`). Point at another
 * copy with PLAYWRIGHT_CORE=/path/to/playwright-core. Exit code 0 when every check passes.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../..');
const require = createRequire(join(repo, 'tools/browser-check/package.json'));
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');

const TAGS = ['jhigu-date-picker', 'jhigu-calendar', 'jhigu-address-select', 'jhigu-money-input', 'jhigu-phone-input'];

const EXAMPLES = {
  next: {
    title: 'Next.js (react/example-next)',
    dir: join(repo, 'react/example-next'),
    build: ['npx', ['next', 'build']],
    start: ['npx', ['next', 'start', '-p', '5178', '-H', '127.0.0.1']],
    env: {},
    port: 5178,
  },
  nuxt: {
    title: 'Nuxt (vue/example-nuxt)',
    dir: join(repo, 'vue/example-nuxt'),
    build: ['npx', ['nuxt', 'build']],
    start: ['node', ['.output/server/index.mjs']],
    env: { PORT: '5179', HOST: '127.0.0.1' },
    port: 5179,
  },
};

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
if (only && !EXAMPLES[only]) {
  console.error(`unknown example ${JSON.stringify(only)}; use next or nuxt`);
  process.exit(2);
}
const chosen = Object.entries(EXAMPLES).filter(([k]) => !only || k === only);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const eq = (actual, expected, what) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

async function waitForServer(url, child, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error(`server at ${url} did not answer within ${timeoutMs} ms`);
}

async function runExample(key, ex, browser) {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, message: e.message }); }
  };

  const build = spawnSync(ex.build[0], ex.build[1], { cwd: ex.dir, encoding: 'utf8', env: { ...process.env, ...ex.env } });
  if (build.status !== 0) {
    return [{ name: 'builds', ok: false, message: `build failed (exit ${build.status}):\n${(build.stdout + build.stderr).slice(-2000)}` }];
  }
  results.push({ name: 'builds', ok: true });

  let log = '';
  const server = spawn(ex.start[0], ex.start[1], { cwd: ex.dir, env: { ...process.env, ...ex.env }, detached: true });
  server.stdout.on('data', d => { log += d; });
  server.stderr.on('data', d => { log += d; });
  const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ } };
  const url = `http://127.0.0.1:${ex.port}/`;
  try {
    await waitForServer(url, server);

    await check('server HTML has five empty wrappers and no custom element', async () => {
      const html = await (await fetch(url)).text();
      eq((html.match(/display: ?contents/g) ?? []).length, 5, 'display:contents wrappers');
      eq(/<jhigu-[a-z-]+/.test(html), false, 'a <jhigu-*> element in the server HTML');
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    const problems = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('jhigu-money-input', { timeout: 15000 }).catch(() => {});

    await check('each of the five elements exists exactly once after hydration', async () => {
      const counts = await page.evaluate(tags => tags.map(t => document.querySelectorAll(t).length), TAGS);
      eq(counts, [1, 1, 1, 1, 1], 'element counts');
    });
    await check('the date picker draws its 31 days', async () => {
      const days = await page.evaluate(() => document.querySelector('jhigu-date-picker').shadowRoot.querySelectorAll('.day').length);
      eq(days, 31, 'days in month');
    });
    await check('typing in the money field formats it', async () => {
      const input = page.locator('jhigu-money-input input');
      await input.fill('1234.5');
      await input.blur();
      eq(await input.inputValue(), '1,234.50', 'money field text');
    });
    await check('submitting the form gives dob and amount in paisa', async () => {
      await page.click('[data-testid=submit]');
      await page.waitForFunction(() => document.querySelector('[data-testid=out]').textContent !== '(not submitted)');
      const out = JSON.parse(await page.textContent('[data-testid=out]'));
      eq(out, { dob: '2082-05-12', amount: '123450' }, 'form data');
    });
    await check('no console error or warning, no page error', async () => {
      eq(problems, [], 'browser problems');
    });
    await context.close();
  } catch (e) {
    results.push({ name: 'runs', ok: false, message: `${e.message}\n--- server log (tail) ---\n${log.slice(-1500)}` });
  } finally {
    stop();
  }
  return results;
}

const browser = await chromium.launch();
let failed = 0;
for (const [key, ex] of chosen) {
  console.log(`\n${ex.title}`);
  for (const r of await runExample(key, ex, browser)) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}`);
    if (!r.ok) { failed++; console.log(`       ${r.message.replace(/\n/g, '\n       ')}`); }
  }
}
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
