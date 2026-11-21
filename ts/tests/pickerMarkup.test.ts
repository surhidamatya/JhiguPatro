import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InlineCalendarDataSource, initializeCalendar, NepaliDate } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { createDatePicker } from '../src/datePicker.js';
import { renderCalendarMarkup, esc, PICKER_CSS } from '../src/elements/pickerMarkup.js';
import { adIso, defineJhiguDatePicker, JhiguDatePicker } from '../src/elements/datePickerElement.js';

const here = dirname(fileURLToPath(import.meta.url));
const cal: CalendarJson = JSON.parse(readFileSync(join(here, '../../data/nepali_calendar_data.json'), 'utf8'));
beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));
});

const T = { year: 2082, month: 5, day: 10 };
const markup = (opts: Parameters<typeof createDatePicker>[0] = {}, showFooter?: boolean) => {
  const p = createDatePicker({ today: T, ...opts });
  return { p, html: renderCalendarMarkup(p.getState(), { getCellProps: c => p.getCellProps(c), showFooter }) };
};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('renderCalendarMarkup', () => {
  it('days view: grid, roles, one tab stop, 32-or-fewer day cells', () => {
    const { p, html } = markup({ value: { year: 2082, month: 5, day: 12 } });
    const days = p.getState().grid.flat().filter(c => c.inMonth).length;
    expect(count(html, /data-act="day"/g)).toBe(days);
    expect(html).toContain('role="grid"');
    expect(html).toContain('aria-live="polite"');
    expect(count(html, /role="columnheader"/g)).toBe(7);
    expect(count(html, /tabindex="0"/g)).toBe(1);
    expect(count(html, /aria-selected="true"/g)).toBe(1);
    expect(html).toContain('data-date="2082-05-12"');
    expect(html).toMatch(/part="day today[^"]*"[^>]*data-date="2082-05-10"|data-date="2082-05-10"/);
    expect(html).toContain('part="header"');
    expect(html).toContain('part="today-button"');
  });

  it('every day cell has an aria-label with the month name', () => {
    const { p, html } = markup();
    const labels = [...html.matchAll(/aria-label="([^"]+)"[^>]*data-act="day"/g)].map(m => m[1]);
    expect(labels.length).toBeGreaterThan(28);
    for (const l of labels) expect(l).toContain(p.getState().title.split(' ')[0]);
  });

  it('selected cell gets the selected part; disabled cells are marked', () => {
    const { html } = markup({ value: T, min: { year: 2082, month: 5, day: 5 }, max: { year: 2082, month: 5, day: 20 } });
    expect(html).toMatch(/part="day[^"]* selected[^"]*"/);
    // Month 5 has 31 days; only 5..20 are allowed, so 4 + 11 = 15 are disabled.
    expect(count(html, /aria-disabled="true"/g)).toBe(15);
    expect(count(html, /class="day[^"]* off"/g)).toBe(15);
    expect(count(html, /part="day[^"]* disabled"/g)).toBe(15);
  });

  it('prev and next buttons are disabled at the bounds', () => {
    const { html } = markup({ min: { year: 2082, month: 5, day: 1 }, max: { year: 2082, month: 5, day: 31 } });
    expect(html).toMatch(/data-act="prev"[^>]* disabled/);
    expect(html).toMatch(/data-act="next"[^>]* disabled/);
    expect(markup().html).not.toMatch(/data-act="prev"[^>]* disabled/);
  });

  it('months and years views use buttons and hide the month arrows', () => {
    const p = createDatePicker({ today: T });
    p.actions.setView('months');
    let html = renderCalendarMarkup(p.getState(), { getCellProps: c => p.getCellProps(c) });
    expect(count(html, /data-act="month"/g)).toBe(12);
    expect(html).not.toContain('data-act="prev"');
    p.actions.setView('years');
    html = renderCalendarMarkup(p.getState(), { getCellProps: c => p.getCellProps(c) });
    expect(count(html, /data-act="year"/g)).toBe(12);
    expect(html).toContain('data-year="2082"');
  });

  it('Nepali: Devanagari day numbers and title, Nepali buttons', () => {
    const { html } = markup({ language: 'ne' });
    expect(html).toContain('<span class="bs">१</span>');
    expect(html).toContain('भदौ');
    expect(html).toContain('आज');
  });

  it('showAd false hides the AD number; showFooter false hides the buttons', () => {
    expect(markup({ showAd: true }).html).toContain('class="ad"');
    expect(markup({ showAd: false }).html).not.toContain('class="ad"');
    expect(markup({}, false).html).not.toContain('data-act="today"');
  });

  it('escapes text', () => {
    expect(esc(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('stylesheet has every theming variable and part-friendly selectors', () => {
    for (const v of ['primary', 'on-primary', 'surface', 'text', 'muted', 'holiday', 'today']) expect(PICKER_CSS).toContain(`--jhigu-color-${v}:`);
    for (const v of ['--jhigu-radius:', '--jhigu-font-family:', '--jhigu-font-size:', 'prefers-color-scheme: dark', 'prefers-reduced-motion', ':host([theme="dark"])']) {
      expect(PICKER_CSS).toContain(v);
    }
  });
});

describe('element helpers', () => {
  it('adIso is exact for known dates', () => {
    // BS 2000-01-01 = AD 1943-04-14 (calendar reference). 2082-05-10 = 2025-08-26 (matches the SMS vector).
    expect(adIso(new NepaliDate(2000, 1, 1))).toBe('1943-04-14');
    expect(adIso(new NepaliDate(2082, 5, 10))).toBe('2025-08-26');
  });

  it('importing in Node is safe; defining needs a browser', () => {
    expect(typeof JhiguDatePicker).toBe('function');
    expect(() => defineJhiguDatePicker()).toThrow(/customElements/);
  });
});

describe('range day styling', () => {
  it('middle days are not styled as selected, ends and single days are', async () => {
    const { dayAttrs } = await import('../src/elements/pickerMarkup.js');
    const cell = createDatePicker({ today: T }).getState().grid.flat().find(c => c.inMonth)!;
    const base = { role: 'gridcell' as const, 'aria-selected': true, 'aria-disabled': false, 'aria-label': 'x', tabIndex: -1 as const };
    expect(dayAttrs(cell, { ...base, rangePosition: 'middle' }).cls).toBe('day range-middle');
    expect(dayAttrs(cell, { ...base, rangePosition: 'middle' }).part).toContain('in-range');
    for (const pos of ['start', 'end', 'single'] as const) expect(dayAttrs(cell, { ...base, rangePosition: pos }).cls).toContain('selected');
    expect(dayAttrs(cell, { ...base, 'aria-selected': false, inPreview: true }).cls).toBe('day preview');
    expect(dayAttrs(cell, { ...base, 'aria-selected': false, 'aria-disabled': true }).cls).toBe('day off');
  });
});
