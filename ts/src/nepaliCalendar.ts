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

import type { NepaliCalendarDataSource, NepaliDate } from './types.js';

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

export const NEPALI_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
] as const;

export const NEPALI_MONTHS_NE = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फागुन', 'चैत्र',
] as const;

export const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const NEPALI_DAYS_EN = [
  'Aaitabar', 'Sombar', 'Mangalbar', 'Budhabar', 'Bihibar', 'Shukrabar', 'Shanibar',
] as const;

export const NEPALI_DAYS_NE = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार',
] as const;

export const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

// ============================================================================
// DATA SOURCE INJECTION
// ============================================================================

let _dataSource: NepaliCalendarDataSource | null = null;

/**
 * Register the data source. Must be called once before any conversion.
 */
export function initializeCalendar(source: NepaliCalendarDataSource): void {
  _dataSource = source;
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
// CONVERSION
// ============================================================================

/** Convert a JS Date (AD) to a Nepali (BS) date. */
export function convertADToBS(adDate: Date): NepaliDate {
  const adUTC = Date.UTC(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
  let remaining = Math.round((adUTC - BASE_UTC) / 86_400_000);

  let year = BS_BASE_YEAR;
  let month = 1;

  while (remaining > 0) {
    const diy = getTotalDaysInBSYear(year);
    if (remaining >= diy) { remaining -= diy; year++; }
    else break;
  }

  while (remaining > 0) {
    const dim = getDaysInBSMonth(year, month);
    if (remaining >= dim) { remaining -= dim; month++; }
    else break;
  }

  return { year, month, day: remaining + 1 };
}

/** Convert a BS date to a JS Date (AD). */
export function convertBSToAD(bsYear: number, bsMonth: number, bsDay: number): Date {
  if (!isValidBSDate(bsYear, bsMonth, bsDay)) {
    throw new Error(`Invalid BS date: ${bsYear}/${bsMonth}/${bsDay}`);
  }

  let total = 0;
  for (let y = BS_BASE_YEAR; y < bsYear; y++) total += getTotalDaysInBSYear(y);
  for (let m = 1; m < bsMonth; m++) total += getDaysInBSMonth(bsYear, m);
  total += bsDay - 1;

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
export function getCurrentNepaliDate(): NepaliDate {
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
export function formatNepaliDate(date: NepaliDate, locale: 'en' | 'ne' = 'en'): string {
  const months = locale === 'ne' ? NEPALI_MONTHS_NE : NEPALI_MONTHS_EN;
  return `${months[date.month - 1]} ${date.day}, ${date.year}`;
}

/** Format an AD Date as a readable string. */
export function formatEnglishDate(date: Date): string {
  return `${ENGLISH_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Get the Nepali month name (1-indexed). */
export function getNepaliMonthName(month: number, locale: 'en' | 'ne' = 'en'): string {
  const months = locale === 'ne' ? NEPALI_MONTHS_NE : NEPALI_MONTHS_EN;
  return months[month - 1] ?? '';
}

/** Get day-of-week name for a JS Date. */
export function getNepaliDayName(date: Date, locale: 'en' | 'ne' = 'en'): string {
  const days = locale === 'ne' ? NEPALI_DAYS_NE : NEPALI_DAYS_EN;
  return days[date.getDay()];
}

/**
 * Format a BS date with Nepali day name.
 * Example output: "८ फागुन २०८२, शुक्रबार"
 */
export function formatNepaliDateWithDay(nepaliDate: NepaliDate, adDate?: Date): string {
  const ad = adDate ?? convertBSToAD(nepaliDate.year, nepaliDate.month, nepaliDate.day);
  const day = toNepaliDigits(nepaliDate.day);
  const month = NEPALI_MONTHS_NE[nepaliDate.month - 1];
  const year = toNepaliDigits(nepaliDate.year);
  const weekday = getNepaliDayName(ad, 'ne');
  return `${day} ${month} ${year}, ${weekday}`;
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
  if (!date) return 'हालै';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'हालै';

    const nowNep = toNepalTime(new Date());
    const dateNep = toNepalTime(d);

    const todayMidnight = new Date(nowNep);
    todayMidnight.setUTCHours(0, 0, 0, 0);

    if (dateNep < todayMidnight) {
      return _bsDateString(convertADToBS(dateNep));
    }

    const diffMs = nowNep.getTime() - dateNep.getTime();
    if (diffMs < 1000) return 'हालै';

    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);

    if (sec < 60) return `${toNepaliDigits(sec)} सेकेण्ड अगाडि`;
    if (min < 60) return `${toNepaliDigits(min)} मिनेट अगाडि`;
    if (hr < 24)  return `${toNepaliDigits(hr)} घण्टा अगाडि`;
    return _bsDateString(convertADToBS(dateNep));
  } catch {
    return 'हालै';
  }
}

function _bsDateString(nd: NepaliDate): string {
  return `${toNepaliDigits(nd.day)} ${NEPALI_MONTHS_NE[nd.month - 1]} ${toNepaliDigits(nd.year)}`;
}
