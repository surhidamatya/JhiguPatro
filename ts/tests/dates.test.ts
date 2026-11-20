import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InlineCalendarDataSource,
  initializeCalendar,
  parseNepaliDate,
  fiscalYear,
  JhiguError,
} from '../src/index.js';
import type { CalendarJson } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const calendarJson: CalendarJson = read('../../data/nepali_calendar_data.json');
const v = read('../../testdata/dates.json');
const bs = ([year, month, day]: number[]) => ({ year, month, day });

beforeAll(() => {
  initializeCalendar(
    new InlineCalendarDataSource(
      calendarJson.years,
      calendarJson.supportedRange.start,
      calendarJson.supportedRange.end,
      calendarJson.verifiedThrough,
    ),
  );
});

describe('parseNepaliDate shared vectors', () => {
  it('has at least 60 valid inputs', () => expect(v.parse.length).toBeGreaterThanOrEqual(60));

  for (const t of v.parse) {
    it(`parses ${JSON.stringify(t.in)}`, () => expect(parseNepaliDate(t.in)).toEqual(bs(t.bs)));
  }

  for (const input of v.parseInvalid) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      try {
        parseNepaliDate(input);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(JhiguError);
        expect((e as JhiguError).code).toBe('PARSE_ERROR');
        expect((e as JhiguError).details).toBe(input);
      }
    });
  }

  it('localizes the parse error', () => {
    try {
      parseNepaliDate('nope');
    } catch (e) {
      const err = e as JhiguError;
      expect(err.message).toBe(err.localized('en'));
      expect(err.localized('ne')).not.toBe(err.localized('en'));
    }
  });
});

describe('fiscalYear shared vectors', () => {
  for (const t of v.fiscal) {
    it(`${t.bs.join('-')} is ${t.code}`, () => {
      const f = fiscalYear(bs(t.bs));
      expect(f.code).toBe(t.code);
      expect(f.start).toBe(t.start);
      expect(f.end).toBe(t.end);
      expect(f.first).toEqual(bs(t.first));
      expect(f.last).toEqual(bs(t.last));
    });
  }
  for (const t of v.fiscalInvalid) {
    it(`${t.bs.join('-')} throws ${t.code}`, () => {
      try {
        fiscalYear(bs(t.bs));
        expect.unreachable();
      } catch (e) {
        expect((e as JhiguError).code).toBe(t.code);
      }
    });
  }
  it('Shrawan 1 starts a new fiscal year; the day before ends the old one', () => {
    expect(fiscalYear({ year: 2081, month: 3, day: 31 }).code).toBe('2080/81');
    expect(fiscalYear({ year: 2081, month: 4, day: 1 }).code).toBe('2081/82');
  });
});

// ── NepaliDate class ─────────────────────────────────────────────────────────

import { NepaliDate, convertADToBS, convertBSToAD } from '../src/index.js';

const nd = (t: number[]) => new NepaliDate(t[0], t[1], t[2]);
const fields = (d: NepaliDate) => [d.year, d.month, d.day];
const adIso = (d: Date) =>
  `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const codeOf = (fn: () => unknown): string => {
  try { fn(); } catch (e) { return (e as JhiguError).code; }
  return 'NO_ERROR';
};

describe('NepaliDate shared vectors', () => {
  for (const t of v.adToBs) {
    it(`AD ${t.ad} <-> BS ${t.bs.join('-')}`, () => {
      const [y, m, d] = t.ad.split('-').map(Number);
      expect(fields(NepaliDate.fromAD(new Date(y, m - 1, d)))).toEqual(t.bs);
      expect(adIso(nd(t.bs).toAD())).toBe(t.ad);
    });
  }
  for (const t of v.addDays) {
    it(`${t.from.join('-')} + ${t.n} days`, () => expect(fields(nd(t.from).addDays(t.n))).toEqual(t.to));
  }
  for (const t of v.addMonths) {
    it(`${t.from.join('-')} + ${t.n} months`, () => expect(fields(nd(t.from).addMonths(t.n))).toEqual(t.to));
  }
  for (const t of v.addYears) {
    it(`${t.from.join('-')} + ${t.n} years`, () => expect(fields(nd(t.from).addYears(t.n))).toEqual(t.to));
  }
  for (const t of v.diff) {
    it(`diff ${t.a.join('-')} - ${t.b.join('-')}`, () => {
      expect(nd(t.a).diff(nd(t.b), 'days')).toBe(t.days);
      expect(nd(t.a).diff(nd(t.b), 'months')).toBe(t.months);
      expect(nd(t.a).diff(nd(t.b), 'years')).toBe(t.years);
    });
  }
  for (const t of v.compare) {
    it(`compare ${t.a.join('-')} ${t.b.join('-')}`, () => {
      const a = nd(t.a), b = nd(t.b);
      expect(a.compare(b)).toBe(t.out);
      expect(a.isBefore(b)).toBe(t.out < 0);
      expect(a.isAfter(b)).toBe(t.out > 0);
      expect(a.isSame(b)).toBe(t.out === 0);
      expect(a < b).toBe(t.out < 0);
    });
  }
  for (const t of v.weekday) {
    it(`weekday of ${t.bs.join('-')} (AD ${t.ad})`, () => expect(nd(t.bs).weekday).toBe(t.weekday));
  }
  for (const t of v.monthBounds) {
    it(`month bounds ${t.year}-${t.month}`, () => {
      const d = new NepaliDate(t.year, t.month, 1);
      expect(d.daysInMonth).toBe(t.daysInMonth);
      expect(fields(d.startOfMonth())).toEqual(t.start);
      expect(fields(d.endOfMonth())).toEqual(t.end);
    });
  }
  for (const t of v.dateErrors.construct) {
    it(`new NepaliDate(${t.bs}) throws ${t.code}`, () => expect(codeOf(() => nd(t.bs))).toBe(t.code));
  }
  for (const t of v.dateErrors.addDays) {
    it(`${t.from.join('-')} + ${t.n} days throws`, () => expect(codeOf(() => nd(t.from).addDays(t.n))).toBe(t.code));
  }
  for (const t of v.dateErrors.addMonths) {
    it(`${t.from.join('-')} + ${t.n} months throws`, () => expect(codeOf(() => nd(t.from).addMonths(t.n))).toBe(t.code));
  }
  for (const t of v.dateErrors.addYears) {
    it(`${t.from.join('-')} + ${t.n} years throws`, () => expect(codeOf(() => nd(t.from).addYears(t.n))).toBe(t.code));
  }
  for (const t of v.dateErrors.fromAD) {
    it(`fromAD(${t.ad}) throws`, () => {
      const [y, m, d] = t.ad.split('-').map(Number);
      expect(codeOf(() => NepaliDate.fromAD(new Date(y, m - 1, d)))).toBe(t.code);
    });
  }
});

describe('NepaliDate behaviour', () => {
  it('is immutable and prints ISO', () => {
    const d = new NepaliDate(2081, 1, 5);
    expect(Object.isFrozen(d)).toBe(true);
    expect(d.toString()).toBe('2081-01-05');
    expect(JSON.stringify(d)).toBe('{"year":2081,"month":1,"day":5}');
    expect(String(d)).toBe('2081-01-05');
  });

  it('rejects non-integers', () => {
    expect(codeOf(() => new NepaliDate(2081, 1.5, 1))).toBe('INVALID_DATE');
    expect(codeOf(() => nd([2081, 1, 1]).addDays(1.5))).toBe('INVALID_DATE');
    expect(codeOf(() => nd([2081, 1, 1]).addMonths(0.5))).toBe('INVALID_DATE');
  });

  it('isValid and from', () => {
    expect(NepaliDate.isValid(2081, 9, 29)).toBe(true);
    expect(NepaliDate.isValid(2081, 9, 30)).toBe(false);
    expect(NepaliDate.isValid(2081, 9, 1.5)).toBe(false);
    expect(NepaliDate.from({ year: 2081, month: 1, day: 1 }).isSame({ year: 2081, month: 1, day: 1 })).toBe(true);
  });

  it('every day in range: dayNumber is consecutive, weekday matches the AD date, AD round-trips', () => {
    let d = new NepaliDate(2000, 1, 1);
    let prev = d.dayNumber();
    let count = 1;
    while (true) {
      const next = d.year === 2100 && d.month === 12 && d.day === d.daysInMonth ? null : d.addDays(1);
      if (!next) break;
      expect(next.dayNumber()).toBe(prev + 1);
      // AD fields from the day number, in UTC: independent of the time zone.
      const u = new Date(next.dayNumber() * 86_400_000);
      expect(next.weekday).toBe(u.getUTCDay());
      const ad = next.toAD();
      // A zone can skip a whole day (Kiritimati 1994-12-31): local midnight then does not exist.
      if (ad.getFullYear() === u.getUTCFullYear() && ad.getMonth() === u.getUTCMonth() && ad.getDate() === u.getUTCDate()) {
        expect(NepaliDate.fromAD(ad).isSame(next)).toBe(true);
      }
      d = next;
      prev = next.dayNumber();
      count++;
    }
    expect(count).toBeGreaterThan(36000);
  });

  it('addDays agrees with plain AD date arithmetic', () => {
    const start = new NepaliDate(2060, 3, 10);
    const ad = start.toAD();
    for (const n of [-4000, -365, -31, -1, 1, 30, 400, 3650]) {
      const adPlus = new Date(ad.getFullYear(), ad.getMonth(), ad.getDate() + n);
      const via = convertADToBS(adPlus);
      expect(fields(start.addDays(n))).toEqual([via.year, via.month, via.day]);
    }
  });

  it('addMonths then diff gives back whole months when the day fits', () => {
    const d = new NepaliDate(2070, 5, 10);
    for (const n of [-30, -12, -1, 0, 1, 7, 12, 25]) {
      expect(d.addMonths(n).diff(d, 'months')).toBe(n);
    }
  });

  it('today uses Nepal time, not the device zone', () => {
    // 2024-04-12 18:14 UTC is 23:59 in Nepal (still 2024-04-12); one minute later is 2024-04-13.
    const before = NepaliDate.today(new Date(Date.UTC(2024, 3, 12, 18, 14)));
    const after = NepaliDate.today(new Date(Date.UTC(2024, 3, 12, 18, 15)));
    expect(adIso(before.toAD())).toBe('2024-04-12');
    expect(adIso(after.toAD())).toBe('2024-04-13');
    expect(fields(after)).toEqual([2081, 1, 1]);
  });

  it('wraps convert results and keeps plain returns unchanged', () => {
    const plain = convertADToBS(convertBSToAD(2081, 1, 1));
    expect(plain).toEqual({ year: 2081, month: 1, day: 1 });
    expect(plain instanceof NepaliDate).toBe(false);
  });
});

// ── Formatter ────────────────────────────────────────────────────────────────

import { formatDate, formatAd, formatPreset } from '../src/index.js';

describe('formatDate shared vectors', () => {
  for (const t of v.formatTokens) {
    it(`${t.bs.join('-')} ${JSON.stringify(t.pattern)} ${t.lang}`, () => {
      expect(formatDate(bs(t.bs), t.pattern, t.lang)).toBe(t.out);
    });
  }
  it('digits: ascii keeps ASCII in Nepali', () => {
    expect(formatDate(bs([2081, 1, 15]), 'YYYY-MM-DD', 'ne', { digits: 'ascii' })).toBe('2081-01-15');
    expect(formatDate(bs([2081, 1, 15]), 'YYYY-MM-DD', 'ne')).toBe('२०८१-०१-१५');
  });
  it('throws for a date that does not exist', () => {
    expect(codeOf(() => formatDate(bs(v.formatErrors.invalidDate), 'YYYY'))).toBe('INVALID_DATE');
  });
});

describe('formatPreset shared vectors', () => {
  for (const t of v.formatPresets) {
    it(`${t.bs.join('-')} ${t.preset} ${t.lang}`, () => {
      expect(formatPreset(bs(t.bs), t.preset, t.lang)).toBe(t.out);
    });
  }
  for (const t of v.formatRelative) {
    it(`relative ${t.days >= 0 ? '+' : ''}${t.days} days (${t.bs.join('-')}) ${t.lang}`, () => {
      expect(formatPreset(bs(t.bs), 'relative', t.lang, { today: bs(t.today) })).toBe(t.out);
    });
  }
  it('relative defaults to today in Nepal', () => {
    const today = NepaliDate.today();
    expect(formatPreset(today, 'relative', 'en')).toBe('today');
  });
  it('unknown preset throws INVALID_DATA', () => {
    expect(codeOf(() => formatPreset(bs([2081, 1, 15]), v.formatErrors.unknownPreset, 'en'))).toBe('INVALID_DATA');
  });
});

describe('formatAd shared vectors', () => {
  for (const t of v.formatAd) {
    it(`${t.ad.join('-')} ${JSON.stringify(t.pattern)} ${t.lang}`, () => {
      expect(formatAd(new Date(t.ad[0], t.ad[1] - 1, t.ad[2]), t.pattern, t.lang)).toBe(t.out);
    });
  }
  for (const t of v.formatAdAscii) {
    it(`ascii digits ${t.out}`, () => {
      expect(formatAd(new Date(t.ad[0], t.ad[1] - 1, t.ad[2]), t.pattern, t.lang, { digits: 'ascii' })).toBe(t.out);
    });
  }
});

// ── Month grid ───────────────────────────────────────────────────────────────

import { getMonthGrid } from '../src/index.js';
import type { GridCell } from '../src/index.js';

const cellKey = (c: GridCell): string =>
  c.bs === null ? '-' : (c.inMonth ? '' : '~') + c.bs.toString();
const keys = (rows: GridCell[][]) => rows.map(r => r.map(cellKey));

describe('getMonthGrid shared vectors', () => {
  for (const c of v.grid.cases) {
    it(c.name, () => {
      const rows = getMonthGrid(c.year, c.month, { weekStartsOn: c.weekStartsOn, sixRows: c.sixRows, today: bs(v.grid.today) });
      expect(keys(rows)).toEqual(c.rows);
      // every cell: flags agree with the date
      for (const row of rows) {
        expect(row).toHaveLength(7);
        row.forEach((cell, col) => {
          expect(cell.inRange).toBe(cell.bs !== null);
          expect(cell.ad === null).toBe(cell.bs === null);
          const weekday = (c.weekStartsOn + col) % 7;
          expect(cell.isWeekend).toBe(weekday === 6);
          if (cell.bs) {
            expect(cell.bs.weekday).toBe(weekday);
            // AD date matches the day number (skip a zone that skipped the day)
            const u = new Date(cell.bs.dayNumber() * 86_400_000);
            if (cell.ad!.getDate() === u.getUTCDate()) expect(cell.ad!.getMonth()).toBe(u.getUTCMonth());
          }
        });
      }
    });
  }

  it('marks today on exactly one cell', () => {
    const rows = getMonthGrid(2081, 1, { today: bs(v.grid.today) });
    const today = rows.flat().filter(c => c.isToday);
    expect(today).toHaveLength(1);
    expect(today[0].bs!.toString()).toBe('2081-01-15');
    expect(getMonthGrid(2081, 2, { today: bs(v.grid.today) }).flat().some(c => c.isToday)).toBe(false);
  });

  it('puts events from a map on matching cells, including neighbouring months', () => {
    const [y, m] = v.grid.eventsMonth;
    const rows = getMonthGrid<string>(y, m, { events: v.grid.events, weekStartsOn: v.grid.eventsWeekStartsOn });
    const byKey = new Map(rows.flat().filter(c => c.bs).map(c => [c.bs!.toString(), c.events]));
    for (const [k, evs] of Object.entries(v.grid.events)) expect(byKey.get(k)).toEqual(evs);
    expect(byKey.get('2081-01-16')).toEqual([]);
  });

  it('calls the callback once per dated cell, every call, and appends its events', () => {
    const calls: string[] = [];
    const getEvents = (d: NepaliDate) => { calls.push(d.toString()); return d.day === 15 ? ['cb'] : []; };
    const opts = { events: v.grid.events, getEvents, today: bs(v.grid.today) };
    const rows = getMonthGrid<string>(2081, 1, opts);
    const dated = rows.flat().filter(c => c.bs).length;
    expect(calls).toHaveLength(dated);
    expect(new Set(calls).size).toBe(dated);
    const c15 = rows.flat().find(c => c.bs?.toString() === '2081-01-15')!;
    expect(c15.events).toEqual(['Holiday', 'cb']);
    getMonthGrid<string>(2081, 1, opts);
    expect(calls).toHaveLength(dated * 2); // no cache between calls
  });

  it('does not call the callback for blank cells', () => {
    let n = 0;
    getMonthGrid(2000, 1, { getEvents: () => { n++; return []; } });
    expect(n).toBe(35 - 3); // 5 rows of 7, minus 3 blank leading cells
  });

  for (const t of v.grid.errors) {
    it(`month ${t.year}-${t.month} throws ${t.code}`, () => {
      expect(codeOf(() => getMonthGrid(t.year, t.month))).toBe(t.code);
    });
  }
  for (const w of v.grid.badWeekStartsOn) {
    it(`weekStartsOn ${w} throws INVALID_DATA`, () => {
      expect(codeOf(() => getMonthGrid(2081, 1, { weekStartsOn: w }))).toBe('INVALID_DATA');
    });
  }

  it('custom weekend days', () => {
    const rows = getMonthGrid(2081, 1, { weekendDays: [0, 6] });
    for (const c of rows.flat()) if (c.bs) expect(c.isWeekend).toBe(c.bs.weekday === 0 || c.bs.weekday === 6);
  });

  it('every month in range has 5 or 6 full rows covering exactly its days', () => {
    for (let y = 2000; y <= 2100; y += 7) {
      for (let m = 1; m <= 12; m++) {
        const rows = getMonthGrid(y, m, { today: bs([2081, 1, 1]) });
        expect([5, 6]).toContain(rows.length);
        const days = rows.flat().filter(c => c.inMonth).map(c => c.bs!.day);
        expect(days).toEqual(Array.from({ length: new NepaliDate(y, m, 1).daysInMonth }, (_, i) => i + 1));
      }
    }
  });
});

// ── Legacy formatters, now reading the strings tables ────────────────────────

import { vi, afterEach } from 'vitest';
import {
  getNepaliMonthName,
  getNepaliDayName,
  formatNepaliDate,
  formatEnglishDate,
  formatNepaliDateWithDay,
  getRelativeTimeInNepali,
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NE,
  NEPALI_DAYS_EN,
  NEPALI_DAYS_NE,
  ENGLISH_MONTHS,
  getStrings,
} from '../src/index.js';

describe('name tables follow the strings tables', () => {
  it('constants equal the strings arrays', () => {
    expect([...NEPALI_MONTHS_EN]).toEqual([...getStrings('en').months]);
    expect([...NEPALI_MONTHS_NE]).toEqual([...getStrings('ne').months]);
    expect([...NEPALI_DAYS_EN]).toEqual([...getStrings('en').weekdays]);
    expect([...NEPALI_DAYS_NE]).toEqual([...getStrings('ne').weekdays]);
    expect([...ENGLISH_MONTHS]).toEqual([...getStrings('en').adMonths]);
  });

  it('English names are the standard ones (changed from Asar / Aaitabar)', () => {
    expect(getNepaliMonthName(3, 'en')).toBe('Ashadh');
    expect(getNepaliMonthName(3, 'ne')).toBe('असार');
    expect(getNepaliMonthName(13, 'en')).toBe('');
    expect(getNepaliDayName(new Date(2024, 3, 13), 'en')).toBe('Saturday');
    expect(getNepaliDayName(new Date(2024, 3, 13), 'ne')).toBe('शनिबार');
  });

  it('formatNepaliDate keeps its shape and ASCII digits; only English names changed', () => {
    expect(formatNepaliDate({ year: 2081, month: 3, day: 5 }, 'en')).toBe('Ashadh 5, 2081');
    expect(formatNepaliDate({ year: 2081, month: 3, day: 5 }, 'ne')).toBe('असार 5, 2081');
    expect(formatNepaliDate({ year: 2081, month: 3, day: 5 })).toBe('Ashadh 5, 2081');
  });

  it('formatEnglishDate', () => {
    expect(formatEnglishDate(new Date(2024, 3, 13))).toBe('April 13, 2024');
  });

  it('formatNepaliDateWithDay gets the weekday from the BS date, in any time zone', () => {
    expect(formatNepaliDateWithDay({ year: 2081, month: 1, day: 1 })).toBe('१ बैशाख २०८१, शनिबार');
    expect(formatNepaliDateWithDay({ year: 2081, month: 1, day: 15 })).toBe('१५ बैशाख २०८१, शनिबार');
    expect(formatNepaliDateWithDay({ year: 2081, month: 1, day: 16 })).toBe('१६ बैशाख २०८१, आइतबार');
    // every day of one year agrees with the NepaliDate class weekday
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= new NepaliDate(2081, m, 1).daysInMonth; d++) {
        const wd = new NepaliDate(2081, m, d).weekday;
        expect(formatNepaliDateWithDay({ year: 2081, month: m, day: d }).endsWith(getStrings('ne').weekdays[wd])).toBe(true);
      }
    }
  });
});

describe('getRelativeTimeInNepali', () => {
  afterEach(() => vi.useRealTimers());
  // 2024-04-13 12:00 UTC is 17:45 in Nepal, BS 2081-01-01.
  const NOW = Date.UTC(2024, 3, 13, 12, 0, 0);
  const ago = (ms: number) => new Date(NOW - ms);

  it('uses the Nepali relative strings', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(getRelativeTimeInNepali(null)).toBe('हालै');
    expect(getRelativeTimeInNepali('not a date')).toBe('हालै');
    expect(getRelativeTimeInNepali(ago(500))).toBe('हालै');
    expect(getRelativeTimeInNepali(ago(20_000))).toBe('२० सेकेण्ड अगाडि');
    expect(getRelativeTimeInNepali(ago(90_000))).toBe('१ मिनेट अगाडि');
    expect(getRelativeTimeInNepali(ago(3 * 3_600_000))).toBe('३ घण्टा अगाडि');
  });

  it('shows the BS date once it is before midnight Nepal time (same result in every zone)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // 24 h earlier is 2024-04-12 17:45 in Nepal, BS 2080-12-30.
    expect(getRelativeTimeInNepali(ago(24 * 3_600_000))).toBe('३० चैत्र २०८०');
    // 18 h earlier is 2024-04-12 23:45 in Nepal: still the previous Nepal day.
    expect(getRelativeTimeInNepali(ago(18 * 3_600_000))).toBe('३० चैत्र २०८०');
    // 17.5 h earlier is 2024-04-13 00:15 in Nepal: today, so hours.
    expect(getRelativeTimeInNepali(ago(17.5 * 3_600_000))).toBe('१७ घण्टा अगाडि');
  });
});
