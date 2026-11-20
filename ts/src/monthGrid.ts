/**
 * Month grid for a calendar view (guide 7.8, D-16, D-17).
 *
 *   const rows = getMonthGrid(2081, 1, { weekStartsOn: 0, events: { '2081-01-15': ['Holiday'] } });
 *
 * Always whole weeks: 5 or 6 rows of 7 cells (`sixRows: true` forces 6). Cells
 * before and after the month show the neighbouring months' days when those are
 * inside the calendar data; otherwise they are blank (`bs` and `ad` null,
 * `inRange` false). Day arithmetic uses day numbers, so no time zone changes a
 * cell. Needs the calendar initialised.
 */
import { JhiguError } from './errors.js';
import { NepaliDate } from './nepaliDate.js';
import type { NepaliDateFields } from './types.js';

export interface GridCell<E = unknown> {
  /** The BS date, or null for a blank cell outside the calendar data. */
  bs: NepaliDate | null;
  /**
   * The AD date as local midnight, or null for a blank cell. In a time zone that
   * skipped that calendar day JavaScript gives the next day; `bs` is exact.
   */
  ad: Date | null;
  /** True for the days of the requested month. */
  inMonth: boolean;
  /** True when the cell has a date (it is inside the calendar data). */
  inRange: boolean;
  isToday: boolean;
  /** Saturday by default; see `weekendDays`. */
  isWeekend: boolean;
  events: E[];
}

export interface MonthGridOptions<E = unknown> {
  /** First column: 0 = Sunday ... 6 = Saturday. Default 0. */
  weekStartsOn?: number;
  /** Events by `YYYY-MM-DD` key, for any day shown (also days of neighbouring months). */
  events?: Record<string, readonly E[]>;
  /**
   * Called once per dated cell on every call (nothing is cached). Its events are
   * added after those from `events`.
   */
  getEvents?: (date: NepaliDate) => readonly E[];
  /** Weekday numbers shown as weekend. Default `[6]` (Saturday). */
  weekendDays?: readonly number[];
  /** Always return 6 rows. Default false. */
  sixRows?: boolean;
  /** The day to mark as today. Default: today in Nepal. Pass it in tests. */
  today?: NepaliDateFields;
}

/**
 * Grid for BS `year` and `month` as rows of 7 cells. Throws JhiguError: `INVALID_DATE`
 * or `OUT_OF_RANGE` for a month outside the data, `INVALID_DATA` for a bad `weekStartsOn`.
 */
export function getMonthGrid<E = unknown>(
  year: number,
  month: number,
  options: MonthGridOptions<E> = {},
): GridCell<E>[][] {
  const weekStartsOn = options.weekStartsOn ?? 0;
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new JhiguError('INVALID_DATA', 'weekStartsOn must be an integer from 0 to 6', weekStartsOn);
  }
  const first = new NepaliDate(year, month, 1);
  const weekend = new Set(options.weekendDays ?? [6]);
  const today = options.today ? NepaliDate.from(options.today) : NepaliDate.today();

  const leading = (first.weekday - weekStartsOn + 7) % 7;
  let total = Math.ceil((leading + first.daysInMonth) / 7) * 7;
  if (options.sixRows) total = Math.max(total, 42);

  const firstDay = first.dayNumber();
  const cells: GridCell<E>[] = [];
  for (let i = 0; i < total; i++) {
    let date: NepaliDate | null;
    try {
      date = NepaliDate.fromDayNumber(firstDay - leading + i);
    } catch (e) {
      if (e instanceof JhiguError && e.code === 'OUT_OF_RANGE') date = null;
      else throw e;
    }
    if (!date) {
      cells.push({ bs: null, ad: null, inMonth: false, inRange: false, isToday: false, isWeekend: weekend.has((weekStartsOn + (i % 7)) % 7), events: [] });
      continue;
    }
    const events: E[] = [...(options.events?.[date.toString()] ?? [])];
    if (options.getEvents) events.push(...options.getEvents(date));
    cells.push({
      bs: date,
      ad: date.toAD(),
      inMonth: date.year === year && date.month === month,
      inRange: true,
      isToday: date.isSame(today),
      isWeekend: weekend.has(date.weekday),
      events,
    });
  }

  const rows: GridCell<E>[][] = [];
  for (let r = 0; r < cells.length; r += 7) rows.push(cells.slice(r, r + 7));
  return rows;
}
