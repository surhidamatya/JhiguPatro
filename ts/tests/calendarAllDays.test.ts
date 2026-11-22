import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InlineCalendarDataSource, initializeCalendar, convertADToBS, convertBSToAD, NepaliDate } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const cal: CalendarJson = read('../../data/nepali_calendar_data.json');
const v = read('../../testdata/calendar-all-days.json');

beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));
});

const p2 = (n: number) => String(n).padStart(2, '0');
const adIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** 64-bit FNV-1a over UTF-8 bytes, as lowercase hex. */
function fnv1a64(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(text)) {
    h ^= BigInt(b);
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return h.toString(16).padStart(16, '0');
}

describe('every day of the calendar data (shared fingerprint, made by an independent Python model)', () => {
  // One pass over all days: the slow part. Checked in the tests below.
  const lines: string[] = [];
  const problems: string[] = [];
  /** AD date of the i-th day from 1943-04-14, by plain UTC arithmetic (no time zone involved). */
  const expectedAd = (i: number) => {
    const u = new Date(Date.UTC(1943, 3, 14 + i));
    return `${u.getUTCFullYear()}-${p2(u.getUTCMonth() + 1)}-${p2(u.getUTCDate())}`;
  };
  /** Days that do not exist on the local clock in this time zone (a zone that skipped a date). */
  const gaps: string[] = [];

  it('walks every AD day from 1943-04-14 and converts it both ways', () => {
    // Local-time Dates, stepped by calendar day. A time zone can skip a whole date (Pacific/Kiritimati has
    // no 31 December 1994): `new Date(1994, 11, 31)` there is 1 January 1995, so that day cannot be asked of
    // the Date-based converters in that zone. Such a day is checked through the date-only NepaliDate path.
    const start = new NepaliDate(2000, 1, 1);
    for (let i = 0; i < v.count; i++) {
      const ad = expectedAd(i);
      const d = new Date(1943, 3, 14 + i);
      let bs: { year: number; month: number; day: number };
      if (adIso(d) === ad) {
        bs = convertADToBS(d);
        const back = convertBSToAD(bs.year, bs.month, bs.day);
        if (adIso(back) !== ad) problems.push(`${ad}: BS ${bs.year}-${bs.month}-${bs.day} converts back to ${adIso(back)}`);
      } else {
        gaps.push(ad);
        bs = start.addDays(i);
      }
      const n = NepaliDate.from(bs);
      lines.push(`${ad} ${String(bs.year).padStart(4, '0')}-${p2(bs.month)}-${p2(bs.day)} ${n.weekday} ${n.dayNumber()}`);
    }
    expect(problems.slice(0, 5)).toEqual([]);
    expect(lines).toHaveLength(v.count);
  });

  it('only a few days are missing from the local clock, and only in zones that skipped a date', () => {
    expect(gaps.length).toBeLessThanOrEqual(3);
    for (const g of gaps) expect(['1994-12-31', '2011-12-30']).toContain(g);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (['Asia/Kathmandu', 'UTC', 'America/Los_Angeles'].includes(tz)) expect(gaps).toEqual([]);
  });

  it('has the first and last day the model says', () => {
    expect(lines[0]).toBe(v.first);
    expect(lines[lines.length - 1]).toBe(v.last);
    expect(adIso(new Date(1943, 3, 14 + v.count - 1))).toBe(v.lastAd);
  });

  it('matches the checkpoints, so a failure says which day went wrong', () => {
    for (const c of v.checkpoints) expect(lines[c.index], `line ${c.index}`).toBe(c.line);
  });

  it('has the same 64-bit fingerprint as the Python model: every AD date, BS date, weekday and day number', () => {
    expect(fnv1a64(lines.map(l => `${l}\n`).join(''))).toBe(v.fnv1a64);
  });

  it('the day after the last day is outside the data, and so is the day before the first', () => {
    expect(() => convertADToBS(new Date(1943, 3, 13))).toThrow();
    expect(() => convertADToBS(new Date(1943, 3, 14 + v.count))).toThrow();
  });
});
