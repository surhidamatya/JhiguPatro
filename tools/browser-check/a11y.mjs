#!/usr/bin/env node
/**
 * Automated accessibility audit of the web components with axe-core, on the example
 * pages in ts/examples, in several states: first render, a popup open, a value chosen,
 * a validation message showing, the dark theme. axe looks into open shadow roots.
 *
 *   cd ts && npm run build && cd ../tools/browser-check && npm install
 *   node a11y.mjs                      # Chromium
 *   node a11y.mjs --browsers chromium,webkit
 *   node a11y.mjs --json               # machine-readable
 *
 * Reports every violation axe finds (rule, impact, the element, how to fix). Exit code 0
 * when there are none, 1 otherwise. axe finds many but not all accessibility problems:
 * it does not replace testing with a screen reader or by keyboard.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../ts');
const require = createRequire(import.meta.url);
const { chromium, firefox, webkit } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const axePath = require.resolve('axe-core');
const ENGINES = { chromium, firefox, webkit };

const args = process.argv.slice(2);
const wanted = (args.includes('--browsers') ? args[args.indexOf('--browsers') + 1] : 'chromium').split(',');
const asJson = args.includes('--json');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(join(root, path)));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const cell = (host, text) => `${host} [role=gridcell][aria-label*="${text}"]`;

/** [page, state name, steps that put the page in that state] */
const STATES = [
  ['date-picker', 'first render', async () => {}],
  ['date-picker', 'a day chosen', async p => { await p.click(cell('#inline', '15 Bhadra')); }],
  ['date-picker', 'the popup open', async p => { await p.click('#popup .trigger'); }],
  ['date-picker', 'the month list open', async p => { await p.click('#inline [data-act=title]'); }],
  ['date-picker', 'the year list open', async p => { await p.click('#inline [data-act=title]'); await p.click('#inline [data-act=title]'); }],
  ['date-picker', 'form submitted while required is empty', async p => { await p.click('button[type=submit]'); }],
  ['date-picker', 'AD numbers off (show-ad=false)', async p => { await p.evaluate(() => document.querySelectorAll('jhigu-date-picker').forEach(e => e.setAttribute('show-ad', 'false'))); }],
  ['range-picker', 'first render', async () => {}],
  ['range-picker', 'a range chosen', async p => { await p.click(cell('#r1', '10 Bhadra')); await p.click(cell('#r1', '14 Bhadra')); }],
  ['range-picker', 'the popup open', async p => { await p.click('#r2 .trigger'); }],
  ['calendar', 'first render', async () => {}],
  ['calendar', 'a marked day selected', async p => { await p.click(cell('#c1', '3 Ashwin')); }],
  ['address', 'first render', async () => {}],
  ['address', 'complete', async p => {
    await p.selectOption('#a1 select[data-level=province]', { label: 'Bagmati' });
    await p.selectOption('#a1 select[data-level=district]', { label: 'Bhaktapur' });
    await p.selectOption('#a1 select[data-level=localLevel]', { label: 'Bhaktapur Municipality' });
    await p.selectOption('#a1 select[data-level=ward]', { label: 'Ward 3' });
  }],
  ['inputs', 'first render', async () => {}],
  ['inputs', 'values typed', async p => {
    await p.locator('#money input').pressSequentially('1234567.5');
    await p.locator('#phone input').pressSequentially('9841234567');
  }],
  ['inputs', 'a wrong phone number (message showing)', async p => { await p.locator('#phone input').pressSequentially('98412345678'); }],
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
// Rules about the example page itself (landmarks, headings, the page title), not the
// components. Pass --all to include them.
const PAGE_LEVEL = new Set(['region', 'landmark-one-main', 'page-has-heading-one', 'landmark-no-duplicate-main', 'landmark-unique']);
const includePageLevel = args.includes('--all');
// Known, documented finding: a date cell's visible text is its BS day plus a small AD number. The AD
// number is aria-hidden and in the cell's label, but axe compares the whole visible text ("1 17") with the
// name. It goes away with show-ad="false" (checked in its own state below). Making the AD number CSS
// generated content would satisfy axe but remove the documented ::part(ad) styling hook. Pass --known to list.
const KNOWN = f => f.rule === 'label-content-name-mismatch' && /data-date|part="day|\.(today|selected|off|weekend|day|preview|range-\w+)\b/.test(f.target) && f.state !== 'AD numbers off (show-ad=false)';
const showKnown = args.includes('--known');
const findings = [];
const known = [];
for (const name of wanted) {
  let browser;
  try { browser = await ENGINES[name].launch(); } catch (e) { console.error(`${name}: not installed (${String(e.message).split('\n')[0]})`); continue; }
  for (const [pageName, state, steps] of STATES) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto(`${base}/examples/${pageName}.html`);
      await page.waitForFunction(() => window.ready === true, null, { timeout: 8000 });
      // The components follow the OS colour scheme, so in dark mode the page must be dark too (the
      // elements, like most form fields, take the page's background; only the pickers paint a surface).
      if (scheme === 'dark') await page.addStyleTag({ content: 'body { background: #111827 !important; color: #e5e7eb !important; } pre { background: #1f2937 !important; color: #e5e7eb !important; }' });
      await steps(page);
      await page.waitForTimeout(150);
      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(tags => window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }), TAGS);
      for (const v of result.violations) {
        if (!includePageLevel && PAGE_LEVEL.has(v.id)) continue;
        for (const n of v.nodes) {
          const finding = { browser: name, page: pageName, state, scheme, rule: v.id, impact: v.impact, help: v.help, target: n.target.map(String).join(' >> '), summary: (n.failureSummary ?? '').split('\n').slice(0, 3).join(' | ') };
          if (KNOWN(finding)) { known.push(finding); continue; }
          findings.push(finding);
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
}
server.close();

if (asJson) console.log(JSON.stringify({ findings, known: showKnown ? known : known.length }, null, 1));
else {
  // The same problem on the same element across states and schemes is one finding.
  const unique = new Map();
  for (const f of findings) {
    const key = `${f.rule}|${f.page}|${f.target}`;
    const e = unique.get(key) ?? { ...f, where: new Set() };
    e.where.add(`${f.state}/${f.scheme}`);
    unique.set(key, e);
  }
  for (const f of unique.values()) {
    console.log(`✖ [${f.impact}] ${f.rule}: ${f.help}\n    ${f.page} · ${f.target}\n    ${f.summary}\n    seen in: ${[...f.where].slice(0, 4).join(', ')}${f.where.size > 4 ? ` (+${f.where.size - 4})` : ''}`);
  }
  console.log(`\n${unique.size} distinct violation(s) (${findings.length} before merging states) in ${STATES.length * 2} page states per browser` +
    (known.length ? `; plus ${known.length} known: date-cell label-in-name with the AD number shown (--known to list, see the comment in this file)` : ''));
}
process.exit(findings.length ? 1 : 0);
