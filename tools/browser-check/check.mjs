#!/usr/bin/env node
/**
 * Cross-browser check of the web components, using the example pages in ts/examples.
 * It serves ts/ over HTTP, opens each page in Chromium, Firefox and WebKit through
 * Playwright, and drives the components with real clicks, keys and typing: render,
 * select, keyboard, popups, form data, required validity, reset, address cascade,
 * money and phone formatting. Not part of CI (the browsers are big downloads).
 *
 *   cd ts && npm run build              # the examples import ts/dist
 *   node tools/browser-check/check.mjs  # all browsers that are installed
 *   node tools/browser-check/check.mjs --browsers firefox,webkit
 *
 * Needs `playwright-core` and the browsers it installs (`npx playwright-core install
 * firefox webkit`). Point at an existing copy with PLAYWRIGHT_CORE=/path/to/playwright-core.
 * Exit code 0 when every check passes in every browser that ran, 1 otherwise.
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
const ENGINES = { chromium, firefox, webkit };

const args = process.argv.slice(2);
const wanted = (args.includes('--browsers') ? args[args.indexOf('--browsers') + 1] : 'chromium,firefox,webkit').split(',');
const verbose = args.includes('--verbose');

// ── a tiny static server for ts/ ─────────────────────────────────────────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// ── the checks ───────────────────────────────────────────────────────────────
const logText = page => page.locator('#log').textContent();
const waitLog = async (page, text, timeout = 4000) => {
  await page.waitForFunction(t => document.getElementById('log').textContent.includes(t), text, { timeout })
    .catch(async () => { throw new Error(`log never contained ${JSON.stringify(text)}; log was:\n${await logText(page)}`); });
};
const eq = (actual, expected, what) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const ok = (cond, what) => { if (!cond) throw new Error(what); };
const cell = (host, text) => `${host} [role=gridcell][aria-label*="${text}"]`;

/** Each page has a list of checks; every check gets a freshly loaded page. */
const PAGES = {
  'date-picker': [
    ['renders three pickers with a month grid each', async page => {
      for (const id of ['inline', 'dark']) ok(await page.locator(`#${id} [role=gridcell]`).count() >= 28, `${id} has no grid`);
      eq(await page.locator('#inline [data-act=title]').textContent(), 'Bhadra 2082', 'inline title');
      eq(await page.locator('#dark [data-act=title]').textContent(), 'Baisakh 2082', 'dark title (preset value)');
      eq(await page.locator('#popup [role=grid]').count(), 0, 'the popup picker is closed at first');
      ok(await page.locator('#popup .trigger').count() === 1, 'the popup has a trigger');
    }],
    ['a click selects a day and reports BS and AD', async page => {
      await page.click(cell('#inline', '15 Bhadra'));
      await waitLog(page, 'change inline: {"bs":"2082-05-15","ad":"2025-08-31"}');
      eq(await page.locator(`${cell('#inline', '15 Bhadra')}`).getAttribute('aria-selected'), 'true', 'the cell is selected');
    }],
    ['the keyboard moves and selects: arrows and Enter', async page => {
      await page.click(cell('#inline', '15 Bhadra'));
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await waitLog(page, '"bs":"2082-05-16"');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await waitLog(page, '"bs":"2082-05-23"');
    }],
    ['the month arrows and the month list work', async page => {
      await page.click('#inline [data-act=next]');
      eq(await page.locator('#inline [data-act=title]').textContent(), 'Ashwin 2082', 'after next');
      await page.click('#inline [data-act=prev]');
      eq(await page.locator('#inline [data-act=title]').textContent(), 'Bhadra 2082', 'after prev');
      await page.click('#inline [data-act=title]');
      await page.click('#inline [data-act=month][data-month="1"]');
      eq(await page.locator('#inline [data-act=title]').textContent(), 'Baisakh 2082', 'after choosing a month');
    }],
    ['the popup opens, closes on Escape, and selecting closes it', async page => {
      await page.click('#popup .trigger');
      await waitLog(page, 'jhiguOpen popup');
      ok(await page.locator('#popup [role=gridcell]').count() >= 28, 'popup grid');
      await page.keyboard.press('Escape');
      await waitLog(page, 'jhiguClose popup');
      eq(await page.locator('#popup [role=grid]').count(), 0, 'closed after Escape');
      await page.click('#popup .trigger');
      await page.click('#popup [role=gridcell]:not([aria-disabled="true"])');
      await waitLog(page, 'change popup:');
      eq(await page.locator('#popup [role=grid]').count(), 0, 'closed after selecting');
    }],
    ['days outside min and max cannot be chosen', async page => {
      await page.click('#popup .trigger');
      const disabled = page.locator('#popup [role=gridcell][aria-disabled="true"]').first();
      ok(await disabled.count() === 1, 'there are disabled days');
      await disabled.click({ force: true });
      eq((await logText(page)).includes('change popup'), false, 'a disabled day must not select');
    }],
    ['the form posts the dates and a required empty picker is invalid until chosen', async page => {
      eq(await page.evaluate(() => document.getElementById('f').checkValidity()), false, 'invalid at first (required, empty)');
      await page.click(cell('#inline', '15 Bhadra'));
      await page.click('#popup .trigger');
      await page.click('#popup [role=gridcell]:not([aria-disabled="true"])');
      await waitLog(page, 'change popup:');
      eq(await page.evaluate(() => document.getElementById('f').checkValidity()), true, 'valid once chosen');
      await page.click('button[type=submit]');
      await waitLog(page, 'submit [');
      const text = await logText(page);
      ok(text.includes('["inline","2082-05-15"]'), `inline value missing in: ${text}`);
      ok(/\["when","\d{4}-\d{2}-\d{2}"\]/.test(text), `popup value missing in: ${text}`);
    }],
    ['Reset clears the pickers', async page => {
      await page.click(cell('#inline', '15 Bhadra'));
      const keys = () => page.evaluate(() => [...new FormData(document.getElementById('f')).keys()]);
      ok((await keys()).includes('inline'), 'the choice was posted before the reset');
      await page.click('button[type=reset]');
      // (A submit would be blocked: the popup picker is required and now empty again.)
      ok(!(await keys()).includes('inline'), 'inline still has a value after reset');
    }],
    ['a day cell is named by its visible day, and the title button by its visible title', async page => {
      const label = await page.locator(cell('#inline', '15 Bhadra')).getAttribute('aria-label');
      ok(/(^|\D)15(\D|$)/.test(label), `cell name ${label}`);
      eq(await page.locator('#inline .ad').first().getAttribute('aria-hidden'), 'true', 'the AD number is hidden from the name');
      const name = await page.locator('#inline [data-act=title]').getAttribute('aria-label');
      ok(name.startsWith('Bhadra 2082'), `title name ${name}`);
    }],
    ['the popup shows Nepali digits', async page => {
      await page.click('#popup .trigger');
      const title = await page.locator('#popup [data-act=title]').textContent();
      ok(/[०-९]/.test(title), `the title has no Devanagari digits: ${title}`);
    }],
  ],

  'range-picker': [
    ['two clicks choose a range, and the change event says how many days', async page => {
      await page.click(cell('#r1', '10 Bhadra'));
      await page.click(cell('#r1', '14 Bhadra'));
      await waitLog(page, '"complete":true');
      const text = await logText(page);
      ok(text.includes('"start":"2082-05-10"') && text.includes('"end":"2082-05-14"') && text.includes('"days":5'), text);
    }],
    ['hovering after the first click previews the days up to the pointer', async page => {
      await page.click(cell('#r1', '10 Bhadra'));
      await page.hover(cell('#r1', '13 Bhadra'));
      const preview = await page.locator('#r1 [part~=preview]').count();
      ok(preview >= 2, `expected preview days, found ${preview}`);
    }],
    ['the form posts name_start and name_end; a half-chosen required range is invalid', async page => {
      eq(await page.evaluate(() => document.getElementById('f').checkValidity()), false, 'required popup has only a start');
      await page.click(cell('#r1', '10 Bhadra'));
      await page.click(cell('#r1', '14 Bhadra'));
      await page.click('#r2 .trigger');
      await page.click('#r2 [role=gridcell]:not([aria-disabled="true"]) >> nth=20');
      await waitLog(page, 'jhiguClose r2').catch(() => {});
      await page.click('button[type=submit]');
      await waitLog(page, 'submit [');
      const text = await logText(page);
      ok(text.includes('["stay_start","2082-05-10"]') && text.includes('["stay_end","2082-05-14"]'), text);
    }],
  ],

  calendar: [
    ['marked days show a dot, and selecting one lists its titles', async page => {
      eq(await page.locator('#c1 .dot').count(), 2, 'two marked days in Ashwin');
      await page.click(cell('#c1', '3 Ashwin'));
      await waitLog(page, 'jhiguSelect c1');
      const text = await page.locator('#c1 .events').textContent();
      ok(text.includes('Laxmi Puja') && text.includes('Market day'), text);
    }],
    ['moving to another month reports it', async page => {
      await page.click('#c1 [data-act=next]');
      await waitLog(page, 'jhiguMonthChange c1: {"year":2082,"month":7}');
    }],
    ['tithi: each day shows its name, the label names it, and the selected day lists it with its paksha', async page => {
      eq(await page.locator('#c3 .tithi').count(), 31, 'a tithi on each of the 31 days of Baisakh 2082');
      eq(await page.locator('#c3 [role=gridcell][data-date="2082-01-01"] .tithi').textContent(), 'प्रतिपदा', 'first day');
      const label = await page.locator('#c3 [role=gridcell][data-date="2082-01-01"]').getAttribute('aria-label');
      ok(label.includes('Tithi: प्रतिपदा'), label);
      eq(await page.locator('#c3 [role=gridcell][data-date="2082-01-01"] .tithi').getAttribute('aria-hidden'), 'true', 'hidden from the name');
      await page.click('#c3 [role=gridcell][data-date="2082-01-01"]');
      await waitLog(page, 'jhiguSelect c3: {"bs":"2082-01-01","ad":"2025-04-14","events":[],"tithi":"प्रतिपदा"}');
      const text = await page.locator('#c3 .events').textContent();
      ok(text.includes('Tithi: प्रतिपदा, कृष्ण'), text);
    }],
    ['show-tithi false, or no panchang, shows no tithi', async page => {
      eq(await page.locator('#c4 .tithi').count(), 0, 'show-tithi false');
      eq(await page.locator('#c1 .tithi').count(), 0, 'no panchang');
      await page.evaluate(() => document.getElementById('c4').setAttribute('show-tithi', 'true'));
      eq(await page.locator('#c4 .tithi').count(), 31, 'turned on again');
    }],
    ['a month the panchang does not hold shows no tithi, and nothing breaks', async page => {
      await page.click('#c3 [data-act=prev]');
      eq(await page.locator('#c3 .tithi').count(), 0, 'Chaitra 2081 is not loaded');
      ok((await page.locator('#c3 [role=gridcell]').count()) >= 29, 'the grid is still there');
    }],
    ['events set from script show up (Nepali, Monday start)', async page => {
      ok(await page.locator('#c2 .dot').count() >= 2, 'dots from the events property');
      eq(await page.locator('#c2 [role=columnheader]').first().textContent(), 'सोम', 'Monday first');
    }],
  ],

  address: [
    ['the cascade: province, district, local level, ward, and the form data', async page => {
      eq(await page.evaluate(() => document.getElementById('f').checkValidity()), false, 'required and empty');
      await page.selectOption('#a1 select[data-level=province]', { label: 'Bagmati' });
      await page.selectOption('#a1 select[data-level=district]', { label: 'Bhaktapur' });
      await page.selectOption('#a1 select[data-level=localLevel]', { label: 'Bhaktapur Municipality' });
      await page.selectOption('#a1 select[data-level=ward]', { label: 'Ward 3' });
      await waitLog(page, '"complete":true');
      eq(await page.evaluate(() => document.getElementById('f').checkValidity()), true, 'valid when complete');
      await page.click('button[type=submit]');
      await waitLog(page, 'submit [');
      const text = await logText(page);
      for (const part of ['["home","274"]', '["home_ward","3"]', '["home_district","23"]', '["home_province","3"]']) ok(text.includes(part), `${part} in ${text}`);
    }],
    ['changing the province clears what is below it', async page => {
      await page.selectOption('#a1 select[data-level=province]', { label: 'Bagmati' });
      await page.selectOption('#a1 select[data-level=district]', { label: 'Bhaktapur' });
      await page.selectOption('#a1 select[data-level=province]', { label: 'Gandaki' });
      eq(await page.locator('#a1 select[data-level=district]').inputValue(), '', 'district cleared');
      eq(await page.locator('#a1 select[data-level=localLevel]').isDisabled(), true, 'local level disabled');
    }],
    ['show-ward false hides the ward, and the Nepali labels show', async page => {
      eq(await page.locator('#a2 select[data-level=ward]').count(), 0, 'no ward select');
      const label = await page.locator('#a2 .lbl').first().textContent();
      ok(/[ऀ-ॿ]/.test(label), `label not Nepali: ${label}`);
    }],
  ],

  inputs: [
    ['money groups the digits as you type, pads on blur, and posts integer paisa', async page => {
      await page.locator('#money input').pressSequentially('1234567.5');
      eq(await page.locator('#money input').inputValue(), '12,34,567.5', 'while typing');
      await page.locator('#phone input').focus(); // blur the money field
      eq(await page.locator('#money input').inputValue(), '12,34,567.50', 'after blur');
    }],
    ['a preset Devanagari amount shows Devanagari digits', async page => {
      eq(await page.locator('#money2 input').inputValue(), '१२,३४,५६७.५०', 'preset');
    }],
    ['phone formats as you type, shows the carrier, and posts E.164', async page => {
      await page.locator('#phone input').pressSequentially('9841234567');
      eq(await page.locator('#phone input').inputValue(), '984-1234567', 'formatted');
      eq(await page.locator('#phone .carrier').textContent(), 'NTC', 'carrier chip');
      await page.locator('#money input').pressSequentially('500');
      await page.click('button[type=submit]');
      await waitLog(page, 'submit [');
      const text = await logText(page);
      ok(text.includes('["phone","+9779841234567"]') && text.includes('["amount","50000"]'), text);
    }],
    ['required fields are invalid while empty', async page => {
      eq(await page.evaluate(() => document.getElementById('f').checkValidity()), false, 'empty required');
    }],
    ['a host aria-label names the inner input, and changing it does not reset what was typed', async page => {
      await page.evaluate(() => {
        const m = document.createElement('jhigu-money-input');
        m.id = 'extra';
        m.setAttribute('aria-label', 'Deposit');
        document.getElementById('f').appendChild(m);
      });
      eq(await page.locator('#extra input').getAttribute('aria-label'), 'Deposit', 'named from the host aria-label');
      await page.locator('#extra input').pressSequentially('1234');
      await page.evaluate(() => document.getElementById('extra').setAttribute('aria-label', 'Deposit amount'));
      eq(await page.locator('#extra input').getAttribute('aria-label'), 'Deposit amount', 'renamed');
      eq(await page.locator('#extra input').inputValue(), '1,234', 'the typed text survives');
      // `label` wins over `aria-label` when both are given.
      await page.evaluate(() => document.getElementById('extra').setAttribute('label', 'Label wins'));
      eq(await page.locator('#extra input').getAttribute('aria-label'), 'Label wins', 'label wins');
    }],
    ['a wrong phone number shows its message', async page => {
      await page.locator('#phone input').pressSequentially('98412345678');
      const msg = await page.locator('#phone .message').textContent();
      ok(msg.trim().length > 0, 'no message for an over-long number');
    }],
  ],
};

// ── run ──────────────────────────────────────────────────────────────────────
const results = [];
for (const name of wanted) {
  const engine = ENGINES[name];
  if (!engine) { console.error(`unknown browser ${name}`); process.exit(2); }
  let browser;
  try {
    browser = await engine.launch();
  } catch (e) {
    console.log(`\n${name}: not installed (${String(e.message).split('\n')[0]})`);
    results.push({ browser: name, skipped: true });
    continue;
  }
  const version = browser.version();
  console.log(`\n${name} ${version}`);
  for (const [pageName, checks] of Object.entries(PAGES)) {
    for (const [title, fn] of checks) {
      const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
      const page = await context.newPage();
      const problems = [];
      page.on('pageerror', e => problems.push(`page error: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
      let failure = null;
      try {
        await page.goto(`${base}/examples/${pageName}.html`);
        await page.waitForFunction(() => window.ready === true, null, { timeout: 8000 });
        await fn(page);
      } catch (e) {
        failure = e.message.split('\n').slice(0, 6).join('\n    ');
      }
      if (!failure && problems.length) failure = problems.join('; ');
      results.push({ browser: name, page: pageName, title, failure });
      console.log(`  ${failure ? '✖' : '✓'} ${pageName}: ${title}${failure ? `\n    ${failure}` : ''}`);
      await context.close();
    }
  }
  await browser.close();
}
server.close();

const ran = results.filter(r => !r.skipped);
const failed = ran.filter(r => r.failure);
console.log(`\n${ran.length - failed.length} of ${ran.length} checks passed in ${[...new Set(ran.map(r => r.browser))].join(', ') || 'no browser'}` +
  (results.some(r => r.skipped) ? ` (skipped: ${results.filter(r => r.skipped).map(r => r.browser).join(', ')})` : ''));
if (verbose) console.log(JSON.stringify(results, null, 1));
process.exit(failed.length || !ran.length ? 1 : 0);
