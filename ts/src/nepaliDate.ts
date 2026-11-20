/**
 * Immutable BS date value (guide 7.4). `year`, `month` and `day` are checked on
 * construction. Arithmetic uses day numbers (whole days since 1970-01-01 UTC)
 * built from calendar fields only, so it never depends on the time zone.
 *
 * Needs the calendar initialised. `convertADToBS` and friends still return plain
 * `NepaliDateFields`; use `NepaliDate.from()` to wrap one.
 */
import { JhiguError } from './errors.js';
import {
  BASE_DAY_NUMBER,
  bsToDaysSinceBase,
  convertBSToAD,
  daysSinceBaseToBS,
  getDaysInBSMonth,
  getSupportedBSRange,
  isValidBSDate,
} from './nepaliCalendar.js';
import type { NepaliDateFields } from './types.js';

const MS_PER_DAY = 86_400_000;
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60_000;

export type DiffUnit = 'days' | 'months' | 'years';

/** Day number of a valid BS date. Plain integer maths, no Date objects. */
function dayNumberOf(year: number, month: number, day: number): number {
  return BASE_DAY_NUMBER + bsToDaysSinceBase(year, month, day);
}

/** Smallest and largest day number the loaded data covers. */
function dayRange(): { min: number; max: number } {
  const { start, end } = getSupportedBSRange();
  return {
    min: dayNumberOf(start, 1, 1),
    max: dayNumberOf(end, 12, getDaysInBSMonth(end, 12)),
  };
}

export class NepaliDate implements NepaliDateFields {
  readonly year: number;
  readonly month: number;
  readonly day: number;

  /**
   * Throws JhiguError INVALID_DATE if the date does not exist and OUT_OF_RANGE
   * if the year is outside the calendar data.
   */
  constructor(year: number, month: number, day: number) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new JhiguError('INVALID_DATE', 'Invalid BS date', { year, month, day });
    }
    if (!isValidBSDate(year, month, day)) {
      const { start, end } = getSupportedBSRange();
      if (year < start || year > end) {
        throw new JhiguError('OUT_OF_RANGE', 'BS year is outside the calendar data', { year, month, day });
      }
      throw new JhiguError('INVALID_DATE', 'Invalid BS date', { year, month, day });
    }
    this.year = year;
    this.month = month;
    this.day = day;
    Object.freeze(this);
  }

  // ── Constructors ───────────────────────────────────────────────────────────

  /** Wrap plain fields (checked). */
  static from(fields: NepaliDateFields): NepaliDate {
    return new NepaliDate(fields.year, fields.month, fields.day);
  }

  /** True if the date exists and is inside the calendar data. */
  static isValid(year: number, month: number, day: number): boolean {
    return (
      Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) &&
      isValidBSDate(year, month, day)
    );
  }

  /**
   * The BS date for an AD date, read from its local year/month/day fields (the
   * time of day is ignored). Throws OUT_OF_RANGE outside the calendar data.
   */
  static fromAD(date: Date): NepaliDate {
    const n = Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
    const { min, max } = dayRange();
    if (n < min || n > max) {
      throw new JhiguError('OUT_OF_RANGE', 'AD date is outside the calendar data', date);
    }
    return NepaliDate.from(daysSinceBaseToBS(n - BASE_DAY_NUMBER));
  }

  /** Date for a day number (whole days since 1970-01-01 UTC). */
  static fromDayNumber(n: number): NepaliDate {
    if (!Number.isInteger(n)) throw new JhiguError('INVALID_DATE', 'Day number must be an integer', n);
    const { min, max } = dayRange();
    if (n < min || n > max) {
      throw new JhiguError('OUT_OF_RANGE', 'Day number is outside the calendar data', n);
    }
    return NepaliDate.from(daysSinceBaseToBS(n - BASE_DAY_NUMBER));
  }

  /** Today in Nepal (UTC+05:45), whatever the device time zone. Pass `now` in tests. */
  static today(now: Date = new Date()): NepaliDate {
    const nepal = new Date(now.getTime() + NEPAL_OFFSET_MS);
    return NepaliDate.fromAD(new Date(nepal.getUTCFullYear(), nepal.getUTCMonth(), nepal.getUTCDate()));
  }

  // ── Properties ─────────────────────────────────────────────────────────────

  get daysInMonth(): number {
    return getDaysInBSMonth(this.year, this.month);
  }

  /** 0 = Sunday ... 6 = Saturday. */
  get weekday(): number {
    return (((this.dayNumber() + 4) % 7) + 7) % 7;
  }

  /** Whole days since 1970-01-01 UTC. */
  dayNumber(): number {
    return dayNumberOf(this.year, this.month, this.day);
  }

  /**
   * The AD date as local midnight (what apps expect to display). In a time zone
   * that skipped that calendar day (for example Pacific/Kiritimati on 1994-12-31)
   * JavaScript cannot build local midnight and gives the next day; day numbers
   * and `fromAD` are not affected.
   */
  toAD(): Date {
    return convertBSToAD(this.year, this.month, this.day);
  }

  // ── Arithmetic ─────────────────────────────────────────────────────────────

  addDays(n: number): NepaliDate {
    if (!Number.isInteger(n)) throw new JhiguError('INVALID_DATE', 'Days must be an integer', n);
    return NepaliDate.fromDayNumber(this.dayNumber() + n);
  }

  /** The day is clamped to the length of the target month. */
  addMonths(n: number): NepaliDate {
    if (!Number.isInteger(n)) throw new JhiguError('INVALID_DATE', 'Months must be an integer', n);
    const total = this.year * 12 + (this.month - 1) + n;
    const year = Math.floor(total / 12);
    const month = total - year * 12 + 1;
    const { start, end } = getSupportedBSRange();
    if (year < start || year > end) {
      throw new JhiguError('OUT_OF_RANGE', 'Result is outside the calendar data', { year, month });
    }
    return new NepaliDate(year, month, Math.min(this.day, getDaysInBSMonth(year, month)));
  }

  addYears(n: number): NepaliDate {
    return this.addMonths(n * 12);
  }

  /**
   * `this - other` in the given unit. Months and years count whole units: step
   * back one month if the later date's day is smaller than the earlier one's;
   * years are whole months divided by 12, toward zero.
   */
  diff(other: NepaliDateFields, unit: DiffUnit = 'days'): number {
    if (unit === 'days') return this.dayNumber() - NepaliDate.from(other).dayNumber();
    let later: NepaliDateFields = this;
    let earlier = other;
    let sign = 1;
    if (NepaliDate.compare(this, other) < 0) { later = other; earlier = this; sign = -1; }
    let months = (later.year - earlier.year) * 12 + (later.month - earlier.month);
    if (later.day < earlier.day) months -= 1;
    const out = unit === 'months' ? months : Math.trunc(months / 12);
    return sign * out || 0;
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  /** Compare as (year, month, day): -1, 0 or 1. Needs no calendar data. */
  static compare(a: NepaliDateFields, b: NepaliDateFields): number {
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    return 0;
  }

  compare(other: NepaliDateFields): number { return NepaliDate.compare(this, other); }
  isBefore(other: NepaliDateFields): boolean { return this.compare(other) < 0; }
  isAfter(other: NepaliDateFields): boolean { return this.compare(other) > 0; }
  isSame(other: NepaliDateFields): boolean { return this.compare(other) === 0; }

  startOfMonth(): NepaliDate { return new NepaliDate(this.year, this.month, 1); }
  endOfMonth(): NepaliDate { return new NepaliDate(this.year, this.month, this.daysInMonth); }

  // ── Conversion ─────────────────────────────────────────────────────────────

  /** Day number, so dates compare with `<` and `>`. */
  valueOf(): number { return this.dayNumber(); }

  /** Same shape as the plain fields, so JSON output did not change. */
  toJSON(): NepaliDateFields { return { year: this.year, month: this.month, day: this.day }; }

  /** `2081-01-15`. */
  toString(): string {
    return `${String(this.year).padStart(4, '0')}-${String(this.month).padStart(2, '0')}-${String(this.day).padStart(2, '0')}`;
  }
}
