/**
 * Date token formatter, presets and relative text (guide 7.5, D-9 to D-12).
 * Names and labels come from the string tables; nothing user-facing is hard-coded.
 *
 *   formatDate({ year: 2081, month: 1, day: 15 }, 'dddd, D MMMM YYYY', 'ne')
 *   formatPreset(date, 'gate', 'ne')       // २०८१ साल बैशाख १५ गते
 *   formatAd(new Date(2024, 3, 27), 'D MMM YYYY')
 *
 * Tokens: YYYY YY MMMM MMM MM M dddd ddd DD D. Text in [brackets] is literal.
 * In Nepali the digits of tokens are Devanagari unless `digits: 'ascii'`.
 * Needs the calendar initialised (BS dates are checked and need the weekday).
 */
import { JhiguError } from './errors.js';
import { fiscalYear } from './fiscal.js';
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';
import { NepaliDate } from './nepaliDate.js';
import type { NepaliDateFields } from './types.js';

export type DatePreset =
  | 'full' | 'long' | 'iso' | 'slash' | 'dmy' | 'short'
  | 'monthYear' | 'gate' | 'dual' | 'relative' | 'fiscal';

export interface FormatOptions {
  /** `native` (default) uses Devanagari digits in Nepali; `ascii` never does. */
  digits?: 'native' | 'ascii';
}

export interface PresetOptions {
  /** The reference day for `relative`. Default: today in Nepal. Pass it in tests. */
  today?: NepaliDateFields;
}

/** Longer tokens first. Bracketed text is literal. */
const TOKEN = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D/g;

const NE_DIGITS = '०१२३४५६७८९';
const nativeDigits = (s: string) => s.replace(/\d/g, d => NE_DIGITS[+d]);
const pad = (n: number, width: number) => String(n).padStart(width, '0');

interface Names {
  months: readonly string[];
  monthsShort: readonly string[];
}

function render(
  pattern: string,
  year: number,
  month: number,
  day: number,
  weekday: number,
  names: Names,
  language: Language,
  native: boolean,
): string {
  const s = getStrings(language);
  const num = (text: string) => (native && language === 'ne' ? nativeDigits(text) : text);
  return pattern.replace(TOKEN, (token: string, literal?: string) => {
    if (literal !== undefined) return literal;
    switch (token) {
      case 'YYYY': return num(pad(year, 4));
      case 'YY': return num(pad(year % 100, 2));
      case 'MMMM': return names.months[month - 1];
      case 'MMM': return names.monthsShort[month - 1];
      case 'MM': return num(pad(month, 2));
      case 'M': return num(String(month));
      case 'dddd': return s.weekdays[weekday];
      case 'ddd': return s.weekdaysShort[weekday];
      case 'DD': return num(pad(day, 2));
      default: return num(String(day)); // 'D'
    }
  });
}

const bsNames = (language: Language): Names => {
  const s = getStrings(language);
  return { months: s.months, monthsShort: s.monthsShort };
};
const adNames = (language: Language): Names => {
  const s = getStrings(language);
  return { months: s.adMonths, monthsShort: s.adMonthsShort };
};

/** Format a BS date with a token pattern. Throws JhiguError for a date that does not exist. */
export function formatDate(
  date: NepaliDateFields,
  pattern: string,
  language: Language = 'en',
  options: FormatOptions = {},
): string {
  const d = NepaliDate.from(date);
  return render(pattern, d.year, d.month, d.day, d.weekday, bsNames(language), language, options.digits !== 'ascii');
}

/** AD calendar fields from a day number, read in UTC so no time zone can shift the day. */
function adFieldsOfDayNumber(n: number): { y: number; m: number; d: number; w: number } {
  const u = new Date(n * 86_400_000);
  return { y: u.getUTCFullYear(), m: u.getUTCMonth() + 1, d: u.getUTCDate(), w: u.getUTCDay() };
}

/**
 * Format an AD date (read from its local year, month and day) with the same
 * tokens, using the AD month names (guide D-12).
 */
export function formatAd(
  date: Date,
  pattern: string,
  language: Language = 'en',
  options: FormatOptions = {},
): string {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return render(pattern, y, m, d, weekday, adNames(language), language, options.digits !== 'ascii');
}

const PRESETS: Record<string, { pattern: string; native: boolean }> = {
  full: { pattern: 'dddd, D MMMM YYYY', native: true },
  long: { pattern: 'D MMMM YYYY', native: true },
  iso: { pattern: 'YYYY-MM-DD', native: false },
  slash: { pattern: 'YYYY/MM/DD', native: false },
  dmy: { pattern: 'DD/MM/YYYY', native: false },
  short: { pattern: 'D MMM YYYY', native: true },
  monthYear: { pattern: 'MMMM YYYY', native: true },
};

function relative(date: NepaliDate, today: NepaliDate, language: Language): string {
  const r = getStrings(language).relative;
  const num = (n: number) => (language === 'ne' ? nativeDigits(String(n)) : String(n));
  const days = today.diff(date, 'days'); // positive: date is in the past
  const abs = Math.abs(days);
  const past = days > 0;
  if (abs === 0) return r.today;
  if (abs === 1) return past ? r.yesterday : r.tomorrow;
  const inDays = () => (past ? r.daysAgo : r.daysLater).replace('{n}', num(abs));
  if (abs <= 30) return inDays();
  const months = Math.abs(today.diff(date, 'months'));
  if (months === 0) return inDays(); // 31 days can still be under one whole month
  if (months <= 12) {
    if (months === 1) return past ? r.monthAgo : r.monthLater;
    return (past ? r.monthsAgo : r.monthsLater).replace('{n}', num(months));
  }
  const years = Math.abs(today.diff(date, 'years'));
  if (years === 1) return past ? r.yearAgo : r.yearLater;
  return (past ? r.yearsAgo : r.yearsLater).replace('{n}', num(years));
}

/**
 * Format with a named preset. `iso`, `slash`, `dmy` and `fiscal` keep ASCII digits
 * in Nepali; `dual` prints the AD part with ASCII digits (the guide says
 * Devanagari for BS only). Throws JhiguError INVALID_DATA for an unknown preset.
 */
export function formatPreset(
  date: NepaliDateFields,
  preset: DatePreset,
  language: Language = 'en',
  options: PresetOptions = {},
): string {
  const d = NepaliDate.from(date);
  const known = PRESETS[preset];
  if (known) return formatDate(d, known.pattern, language, { digits: known.native ? 'native' : 'ascii' });
  const s = getStrings(language);
  switch (preset) {
    case 'gate':
      return formatDate(d, s.format.gatePattern, language);
    case 'dual': {
      const ad = adFieldsOfDayNumber(d.dayNumber());
      const adText = render('D MMMM YYYY', ad.y, ad.m, ad.d, ad.w, adNames(language), language, false);
      return s.format.dualPattern
        .replace('{bs}', formatDate(d, 'D MMMM YYYY', language))
        .replace('{ad}', adText);
    }
    case 'relative':
      return relative(d, options.today ? NepaliDate.from(options.today) : NepaliDate.today(), language);
    case 'fiscal':
      return fiscalYear(d).code;
    default:
      throw new JhiguError('INVALID_DATA', 'Unknown date preset', preset);
  }
}
