import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InlineCalendarDataSource, initializeCalendar, JhiguError } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { createDatePicker } from '../src/datePicker.js';
import { renderCalendarMarkup } from '../src/elements/pickerMarkup.js';
import { JhiguCalendar, defineJhiguCalendar, parseMarks } from '../src/elements/calendarElement.js';

const here = dirname(fileURLToPath(import.meta.url));
const cal: CalendarJson = JSON.parse(readFileSync(join(here, '../../data/nepali_calendar_data.json'), 'utf8'));
beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));
});

describe('parseMarks', () => {
  it('object form: string or list, empty titles dropped, non-strings ignored', () => {
    const m = parseMarks({ '2082-05-12': ['a', '', 5, 'b'], '2082-05-13': '', '2082-05-14': null, '2082-05-15': 'solo' });
    expect([...m]).toEqual([['2082-05-12', ['a', 'b']], ['2082-05-15', ['solo']]]);
  });

  it('array form: each date is its own title; bad dates ignored', () => {
    expect([...parseMarks(['2082-05-12', 'nope', '2082-5-3', 7])]).toEqual([['2082-05-12', ['2082-05-12']]]);
  });

  it('null and undefined are empty; a scalar is an error', () => {
    expect(parseMarks(null).size).toBe(0);
    expect(parseMarks(undefined).size).toBe(0);
    expect(() => parseMarks(5)).toThrow(JhiguError);
  });

  it('keys that are not BS dates are ignored', () => {
    expect(parseMarks({ today: 'x', '2082-05-12': 'y' }).size).toBe(1);
  });
});

describe('marks in the markup', () => {
  const T = { year: 2082, month: 5, day: 10 };
  const html = (marks?: Map<string, string[]>) => {
    const p = createDatePicker({ today: T });
    return renderCalendarMarkup(p.getState(), { getCellProps: c => p.getCellProps(c), marks, showClear: false });
  };

  it('marked days get a dot, a class, a part and titles in the ARIA label', () => {
    const out = html(new Map([['2082-05-12', ['Teej', 'Fair & <fun>']]]));
    expect((out.match(/class="dot"/g) ?? []).length).toBe(1);
    expect(out).toMatch(/class="day[^"]* marked"/);
    expect(out).toMatch(/part="day[^"]* marked"/);
    expect(out).toContain('Teej, Fair &amp; &lt;fun&gt;');
    expect(out).not.toContain('<fun>');
  });

  it('no marks, no dots; showClear false hides Clear but keeps Today', () => {
    const out = html();
    expect(out).not.toContain('class="dot"');
    expect(out).toContain('data-act="today"');
    expect(out).not.toContain('data-act="clear"');
  });
});

describe('calendar element in Node', () => {
  it('can be imported without a DOM; defining needs a browser', () => {
    expect(typeof JhiguCalendar).toBe('function');
    expect(() => defineJhiguCalendar()).toThrow(/customElements/);
  });
});
