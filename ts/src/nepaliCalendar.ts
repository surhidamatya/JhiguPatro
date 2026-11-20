/**
 * Jhigu Patro Utils — Core Calendar Engine
 *
 * Converts between Gregorian (AD) and Bikram Sambat (BS/Nepali) dates.
 * Zero external dependencies. Works in browser, Node.js, Deno, Bun, and any
 * JS/TS runtime.
 *
 * Key facts:
 *   - BS year 2000 Baisakh 1 = AD April 14, 1943
 *   - BS is ~56–57 years ahead of AD
 *   - Each BS month has 29–32 days (varies per year, stored in data source)
 *   - Nepal timezone: GMT+5:45
 *
 * Setup (call once before using conversion functions):
 *   const source = new InlineCalendarDataSource(years, startYear, endYear);
 *   initializeCalendar(source);
 */

import { getStrings } from './generated/strings.js';
import type { NepaliCalendarDataSource, NepaliDateFields } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const BS_BASE_YEAR = 2000;
// BS 2000/1/1 = AD 1943 April 14 (month 0-indexed in JS Date)
const BS_BASE_DATE = new Date(1943, 3, 14);
const BASE_UTC = Date.UTC(1943, 3, 14);
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000; // GMT+5:45

// ============================================================================
// MONTH / DAY / DIGIT NAMES
// ============================================================================

// These tables are views over the string tables (data/strings.{en,ne}.json), the
// single source for names. English month and weekday names are the standard
// transliterations used there ("Ashadh", "Sunday").

/** BS month names, English transliteration. */
export const NEPALI_MONTHS_EN: readonly string[] = getStrings('en').months;

/** BS month names, Nepali. */
export const NEPALI_MONTHS_NE: readonly string[] = getStrings('ne').months;

/** AD month names, English. */
export const ENGLISH_MONTHS: readonly string[] = getStrings('en').adMonths;

/** Weekday names (Sunday first), English. */
export const NEPALI_DAYS_EN: readonly string[] = getStrings('en').weekdays;

/** Weekday names (Sunday first), Nepali. */
export const NEPALI_DAYS_NE: readonly string[] = getStrings('ne').weekdays;

export const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

// ============================================================================
// DATA SOURCE INJECTION
// ============================================================================

let _dataSource: NepaliCalendarDataSource | null = null;

/**
 * Cumulative days from BS_BASE_DATE to the start of each BS year.
 * Key: BS year number. Built once in initializeCalendar().
 * e.g. _yearOffset[2001] = total days in BS 2000
 *      _yearOffset[2002] = total days in BS 2000 + 2001
 */
const _yearOffset = new Map<number, number>();

/**
 * Cumulative days from the start of a BS year to the start of each month.
 * Key: `"year-month"` e.g. "2082-3". Built once in initializeCalendar().
 */
const _monthOffset = new Map<string, number>();

/**
 * Register the data source. Must be called once before any conversion.
 * Precomputes cumulative day offsets for O(1) conversion lookups.
 */
export function initializeCalendar(source: NepaliCalendarDataSource): void {
  _dataSource = source;
  _yearOffset.clear();
  _monthOffset.clear();

  let cumDays = 0;
  for (let y = source.supportedStartYear; y <= source.supportedEndYear; y++) {
    _yearOffset.set(y, cumDays);
    const yearData = source.getYearData(y);
    if (!yearData) continue;
    let monthCum = 0;
    for (let m = 1; m <= 12; m++) {
      _monthOffset.set(`${y}-${m}`, monthCum);
      monthCum += yearData[m - 1];
    }
    cumDays += monthCum;
  }
}

function ds(): NepaliCalendarDataSource {
  if (!_dataSource) {
    throw new Error(
      'jhigu-patro-utils: calendar not initialized. Call initializeCalendar() first.'
    );
  }
  return _dataSource;
}

// ============================================================================
// DATA HELPERS
// ============================================================================

/** Days in a given BS month (month is 1-indexed). */
export function getDaysInBSMonth(year: number, month: number): number {
  const yearData = ds().getYearData(year);
  if (!yearData) throw new Error(`No calendar data for BS year ${year}`);
  return yearData[month - 1];
}

/** Total days in a given BS year. */
export function getTotalDaysInBSYear(year: number): number {
  const yearData = ds().getYearData(year);
  if (!yearData) throw new Error(`No calendar data for BS year ${year}`);
  return yearData.reduce((sum, d) => sum + d, 0);
}

/** Returns true if the given BS date is within supported range and valid. */
export function isValidBSDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const yearData = ds().getYearData(year);
  if (!yearData) return false;
  return day <= yearData[month - 1];
}

/** First and last BS year the loaded data source supports. */
export function getSupportedBSRange(): { start: number; end: number } {
  const src = ds();
  return { start: src.supportedStartYear, end: src.supportedEndYear };
}

/** All supported BS years from the loaded data source. */
export function getAvailableBSYears(): number[] {
  const src = ds();
  const years: number[] = [];
  for (let y = src.supportedStartYear; y <= src.supportedEndYear; y++) {
    if (src.getYearData(y)) years.push(y);
  }
  return years;
}

/** AD year range spanned by the loaded BS data. */
export function getAvailableADYears(): number[] {
  const bsYears = getAvailableBSYears();
  if (bsYears.length === 0) return [];
  const minAD = convertBSToAD(bsYears[0], 1, 1);
  const maxBS = bsYears[bsYears.length - 1];
  const maxAD = convertBSToAD(maxBS, 12, getDaysInBSMonth(maxBS, 12));
  const years: number[] = [];
  for (let y = minAD.getFullYear(); y <= maxAD.getFullYear(); y++) years.push(y);
  return years;
}

// ============================================================================
// ACCURACY
// ============================================================================

/** True if the year is at or before the data source's verifiedThrough watermark. */
export function isVerifiedYear(year: number): boolean {
  const v = ds().verifiedThrough;
  return v !== undefined && year <= v;
}

/**
 * Accuracy of a BS date. Never throws for unverified years; returns a warning.
 * Unverified years still convert, but published sources disagree on them.
 */
export function getDateAccuracy(date: NepaliDateFields): { verified: boolean; warning?: string } {
  if (isVerifiedYear(date.year)) return { verified: true };
  const v = ds().verifiedThrough;
  const through = v === undefined ? 'any year' : `through ${v}`;
  return {
    verified: false,
    warning:
      `BS ${date.year} is not in the verified range (${through}). ` +
      'Confirm it against the Nepal Panchang Nirnayak Samiti calendar before relying on it.',
  };
}

// ============================================================================
// CONVERSION
// ============================================================================

/** Day number (days since 1970-01-01 UTC) of the data's reference date, BS 2000/1/1. */
export const BASE_DAY_NUMBER = BASE_UTC / 86_400_000;

/**
 * BS date for a count of days since the reference date. Uses plain integers, so
 * it is immune to time-zone and DST gaps. The caller checks the range.
 */
export function daysSinceBaseToBS(daysSinceBase: number): NepaliDateFields {
  let remaining = daysSinceBase;
  const src = ds();

  // Binary-search the year using precomputed cumulative offsets.
  let lo = src.supportedStartYear;
  let hi = src.supportedEndYear;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((_yearOffset.get(mid) ?? Infinity) <= remaining) lo = mid;
    else hi = mid - 1;
  }
  const year = lo;
  remaining -= _yearOffset.get(year) ?? 0;

  // Walk months using precomputed per-month offsets (max 12 steps).
  const yearData = src.getYearData(year)!;
  let month = 1;
  while (month < 12) {
    const dim = yearData[month - 1];
    if (remaining >= dim) { remaining -= dim; month++; }
    else break;
  }

  return { year, month, day: remaining + 1 };
}

/** Days from the reference date to a valid BS date. Throws for an invalid date. */
export function bsToDaysSinceBase(bsYear: number, bsMonth: number, bsDay: number): number {
  if (!isValidBSDate(bsYear, bsMonth, bsDay)) {
    throw new Error(`Invalid BS date: ${bsYear}/${bsMonth}/${bsDay}`);
  }
  // O(1): year offset + month offset from precomputed tables.
  const yearOff  = _yearOffset.get(bsYear) ?? 0;
  const monthOff = _monthOffset.get(`${bsYear}-${bsMonth}`) ?? 0;
  return yearOff + monthOff + (bsDay - 1);
}

/** Convert a JS Date (AD) to a Nepali (BS) date. */
export function convertADToBS(adDate: Date): NepaliDateFields {
  const adUTC = Date.UTC(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
  return daysSinceBaseToBS(Math.round((adUTC - BASE_UTC) / 86_400_000));
}

/** Convert a BS date to a JS Date (AD). */
export function convertBSToAD(bsYear: number, bsMonth: number, bsDay: number): Date {
  const total = bsToDaysSinceBase(bsYear, bsMonth, bsDay);
  const result = new Date(BS_BASE_DATE);
  result.setDate(result.getDate() + total);
  return result;
}

// ============================================================================
// TIMEZONE
// ============================================================================

/** Shift any date/timestamp to Nepal time (GMT+5:45) encoded as a UTC Date. */
export function toNepalTime(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.getTime() + NEPAL_OFFSET_MS);
}

/** Reverse of toNepalTime — convert Nepal-encoded date back to UTC. */
export function fromNepalTime(date: Date): Date {
  return new Date(date.getTime() - NEPAL_OFFSET_MS);
}

/** Current Nepal local date as a BS date. Timezone-safe regardless of server locale. */
export function getCurrentNepaliDate(): NepaliDateFields {
  const nep = toNepalTime(new Date());
  return convertADToBS(new Date(nep.getUTCFullYear(), nep.getUTCMonth(), nep.getUTCDate()));
}

// ============================================================================
// FORMATTING
// ============================================================================

/** Convert an integer to Nepali (Devanagari) digit string. */
export function toNepaliDigits(num: number): string {
  return String(num).split('').map(ch => {
    const d = parseInt(ch, 10);
    return isNaN(d) ? ch : NEPALI_DIGITS[d];
  }).join('');
}

/** Format a BS date as a readable string. */
export function formatNepaliDate(date: NepaliDateFields, locale: 'en' | 'ne' = 'en'): string {
  return `${getStrings(locale).months[date.month - 1]} ${date.day}, ${date.year}`;
}

/** Format an AD Date as a readable string. */
export function formatEnglishDate(date: Date): string {
  return `${getStrings('en').adMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Get the Nepali month name (1-indexed). */
export function getNepaliMonthName(month: number, locale: 'en' | 'ne' = 'en'): string {
  return getStrings(locale).months[month - 1] ?? '';
}

/** Get day-of-week name for a JS Date. */
export function getNepaliDayName(date: Date, locale: 'en' | 'ne' = 'en'): string {
  return getStrings(locale).weekdays[date.getDay()];
}

/**
 * Format a BS date with Nepali day name.
 * Example output: "८ फागुन २०८२, शुक्रबार"
 *
 * The weekday comes from the BS date itself (integer day count, no time zone).
 * `adDate` is only a hint kept for compatibility: when given, its weekday is used.
 */
export function formatNepaliDateWithDay(nepaliDate: NepaliDateFields, adDate?: Date): string {
  const weekday = adDate
    ? adDate.getDay()
    : (((BASE_DAY_NUMBER + bsToDaysSinceBase(nepaliDate.year, nepaliDate.month, nepaliDate.day) + 4) % 7) + 7) % 7;
  const ne = getStrings('ne');
  const day = toNepaliDigits(nepaliDate.day);
  const month = ne.months[nepaliDate.month - 1];
  const year = toNepaliDigits(nepaliDate.year);
  return `${day} ${month} ${year}, ${ne.weekdays[weekday]}`;
}

/**
 * Current Nepali date formatted with day name in Nepal time.
 * Example: "८ फागुन २०८२, शुक्रबार"
 */
export function getCurrentNepaliDateFormatted(): string {
  const nep = toNepalTime(new Date());
  const localDate = new Date(nep.getUTCFullYear(), nep.getUTCMonth(), nep.getUTCDate());
  return formatNepaliDateWithDay(convertADToBS(localDate), localDate);
}

/**
 * Format date in Nepal timezone as "YYYY-MM-DD HH:mm".
 */
export function formatNepalDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  try {
    const d = toNepalTime(typeof date === 'string' ? new Date(date) : date);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}-${mo}-${dy} ${h}:${mi}`;
  } catch {
    return '';
  }
}

/**
 * Relative time string in Nepali (e.g. "१५ मिनेट अगाडि").
 * Once the date is past midnight Nepal time, shows the BS date instead.
 */
export function getRelativeTimeInNepali(date: Date | string | null | undefined): string {
  const rel = getStrings('ne').relative;
  const fill = (template: string, n: number) => template.replace('{n}', toNepaliDigits(n));
  if (!date) return rel.justNow;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return rel.justNow;

    const nowNep = toNepalTime(new Date());
    const dateNep = toNepalTime(d);

    const todayMidnight = new Date(nowNep);
    todayMidnight.setUTCHours(0, 0, 0, 0);

    if (dateNep < todayMidnight) {
      return _bsDateString(_bsOfNepalShifted(dateNep));
    }

    const diffMs = nowNep.getTime() - dateNep.getTime();
    if (diffMs < 1000) return rel.justNow;

    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);

    if (sec < 60) return fill(rel.secondsAgo, sec);
    if (min < 60) return fill(rel.minutesAgo, min);
    if (hr < 24)  return fill(rel.hoursAgo, hr);
    return _bsDateString(_bsOfNepalShifted(dateNep));
  } catch {
    return rel.justNow;
  }
}

/**
 * BS date of a Date shifted by `toNepalTime`. That Date encodes Nepal's wall clock in
 * its UTC fields, so they are read in UTC (reading local fields gives the wrong day
 * in any zone that is not UTC).
 */
function _bsOfNepalShifted(shifted: Date): NepaliDateFields {
  const utc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return daysSinceBaseToBS(Math.round((utc - BASE_UTC) / 86_400_000));
}

function _bsDateString(nd: NepaliDateFields): string {
  return `${toNepaliDigits(nd.day)} ${getStrings('ne').months[nd.month - 1]} ${toNepaliDigits(nd.year)}`;
}
