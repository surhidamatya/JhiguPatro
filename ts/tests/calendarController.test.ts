import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InlineCalendarDataSource,
  initializeCalendar,
  convertBSToAD,
  getDaysInBSMonth,
  JhiguError,
} from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { CalendarController, StaticCalendarEventSource } from '../src/calendar_controller.js';
import type { CalendarEventSource } from '../src/calendar_controller.js';
import type { PanchangDataSource } from '../src/data_sources/PanchangDataSource.js';

const here = dirname(fileURLToPath(import.meta.url));
const calendarJson: CalendarJson = JSON.parse(
  readFileSync(join(here, '../../data/nepali_calendar_data.json'), 'utf8'),
);
const vectors = JSON.parse(readFileSync(join(here, '../../testdata/dates.json'), 'utf8'));

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

const TODAY = { year: 2081, month: 1, day: 15 };

/** The grid builder as it was before it moved onto getMonthGrid (local-Date based), as a regression oracle. */
function oldGrid(year: number, month: number): Array<{ bsDay: number | null; weekdayIndex: number }> {
  const totalDays = getDaysInBSMonth(year, month);
  const firstWday = convertBSToAD(year, month, 1).getDay();
  const cells: Array<{ bsDay: number | null; weekdayIndex: number }> = [];
  for (let i = 0; i < firstWday; i++) cells.push({ bsDay: null, weekdayIndex: i });
  for (let d = 1; d <= totalDays; d++) cells.push({ bsDay: d, weekdayIndex: convertBSToAD(year, month, d).getDay() });
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells.push({ bsDay: null, weekdayIndex: 0 });
  return cells;
}

const make = (today = TODAY, events: CalendarEventSource = new StaticCalendarEventSource(), panchang?: PanchangDataSource) =>
  new CalendarController(events, panchang, today);

describe('CalendarController grid (built on getMonthGrid)', () => {
  it('matches the previous grid for every month of BS 2075-2085', () => {
    for (let y = 2075; y <= 2085; y++) {
      for (let m = 1; m <= 12; m++) {
        const c = make({ year: y, month: m, day: 1 });
        const old = oldGrid(y, m);
        expect(c.grid.length, `${y}-${m} length`).toBe(old.length);
        c.grid.forEach((cell, i) => {
          expect(cell.bsDay, `${y}-${m} cell ${i}`).toBe(old[i].bsDay);
          if (cell.bsDay !== null) expect(cell.weekdayIndex).toBe(old[i].weekdayIndex);
        });
      }
    }
  });

  it('agrees with the shared grid vectors (padding positions and days)', () => {
    for (const c of vectors.grid.cases.filter((x: any) => x.weekStartsOn === 0 && !x.sixRows && x.year > 2000 && x.year < 2100)) {
      const ctrl = make({ year: c.year, month: c.month, day: 1 });
      const expected = c.rows.flat().map((k: string) => (k.startsWith('~') || k === '-' ? null : Number(k.slice(-2))));
      expect(ctrl.grid.map(d => d.bsDay), c.name).toEqual(expected);
    }
  });

  it('padding cells are empty; day cells carry BS date, AD date and weekday', () => {
    const c = make();
    const pad = c.grid.filter(d => d.bsDay === null);
    expect(pad.length).toBeGreaterThan(0);
    for (const p of pad) {
      expect(p.bsDate).toBeNull();
      expect(p.adDate).toBeNull();
      expect(p.events).toEqual([]);
      expect(p.isToday).toBe(false);
    }
    const day1 = c.grid.find(d => d.bsDay === 1)!;
    expect(day1.bsDate).toEqual({ year: 2081, month: 1, day: 1 });
    expect(day1.weekdayIndex).toBe(6); // BS 2081-01-01 is a Saturday
    expect(day1.adDate!.getFullYear()).toBe(2024);
    expect(c.grid.length % 7).toBe(0);
  });

  it('marks today and selects it by default', () => {
    const c = make();
    expect(c.grid.filter(d => d.isToday).map(d => d.bsDay)).toEqual([15]);
    expect(c.selectedDay?.bsDay).toBe(15);
    expect(c.today).toEqual(TODAY);
  });

  it('puts events from the event source on their days', () => {
    const c = make({ year: 2081, month: 1, day: 1 });
    const day1 = c.grid.find(d => d.bsDay === 1)!;
    expect(day1.events.map(e => e.title)).toEqual(['नयाँ वर्ष', 'विश्व श्रमिक दिवस']);
    expect(day1.events[0].isSpecial).toBe(true);
    expect(c.grid.find(d => d.bsDay === 2)!.events).toEqual([]);
  });

  it('adds the sunrise tithi when panchang data is given', () => {
    const tithi = { name: 'Pratipada' } as any;
    const panchang = { sunriseTithi: (_y: number, _m: number, d: number) => (d === 3 ? tithi : null) } as unknown as PanchangDataSource;
    const c = make(TODAY, new StaticCalendarEventSource(), panchang);
    expect(c.grid.find(d => d.bsDay === 3)!.tithi).toBe(tithi);
    expect(c.grid.find(d => d.bsDay === 4)!.tithi).toBeUndefined();
  });
});

describe('CalendarController navigation', () => {
  it('moves across year boundaries and notifies once per move', () => {
    const c = make({ year: 2081, month: 1, day: 15 });
    let n = 0;
    const off = c.subscribe(() => n++);
    c.prevMonth();
    expect([c.selectedYear, c.selectedMonth]).toEqual([2080, 12]);
    c.nextMonth();
    c.nextMonth();
    expect([c.selectedYear, c.selectedMonth]).toEqual([2081, 2]);
    expect(n).toBe(3);
    c.goToToday();
    expect([c.selectedYear, c.selectedMonth]).toEqual([2081, 1]);
    expect(c.selectedDay?.bsDay).toBe(15);
    off();
    c.nextMonth();
    expect(n).toBe(4);
  });

  it('selection is today only when today is in the shown month', () => {
    const c = make();
    c.nextMonth();
    expect(c.selectedDay).toBeNull();
    c.selectDay(c.grid.find(d => d.bsDay === 5)!);
    expect(c.selectedDay?.bsDay).toBe(5);
    c.selectDay(null);
    expect(c.selectedDay).toBeNull();
    c.goToToday();
    expect(c.selectedDay?.bsDay).toBe(15);
  });

  it('selectYearMonth to the same month does nothing', () => {
    const c = make();
    let n = 0;
    c.subscribe(() => n++);
    c.selectYearMonth(2081, 1);
    expect(n).toBe(0);
    c.selectYearMonth(2085, 6);
    expect([c.selectedYear, c.selectedMonth, n]).toEqual([2085, 6, 1]);
  });

  it('a month outside the calendar data throws and leaves the controller unchanged', () => {
    const c = make({ year: 2000, month: 1, day: 5 });
    let n = 0;
    c.subscribe(() => n++);
    const before = c.grid;
    try {
      c.prevMonth();
      expect.unreachable();
    } catch (e) {
      expect((e as JhiguError).code).toBe('OUT_OF_RANGE');
    }
    expect([c.selectedYear, c.selectedMonth, n]).toEqual([2000, 1, 0]);
    expect(c.grid).toBe(before);
    expect(c.selectedDay?.bsDay).toBe(5);
  });
});

describe('CalendarController labels', () => {
  it('bsLabel uses Devanagari digits and the Nepali month', () => {
    expect(make().bsLabel).toBe('२०८१ बैशाख');
  });

  it('adRangeLabel spans the AD months of the BS month', () => {
    expect(make({ year: 2081, month: 1, day: 1 }).adRangeLabel).toBe('Apr/May 2024');
    expect(make({ year: 2081, month: 9, day: 1 }).adRangeLabel).toBe('Dec/Jan 2024/2025');
    expect(make({ year: 2081, month: 9, day: 1 }).headerLabel).toBe('२०८१ पौष  |  Dec/Jan 2024/2025');
  });
});
