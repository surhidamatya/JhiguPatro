/**
 * Parse BS dates from text (guide 7.6, D-13, D-14). Accepts ASCII or Devanagari
 * digits, English and Nepali month names with common alternate spellings, and
 * the usual separators.
 *
 *   parseNepaliDate('15 Baisakh 2081')        // { year: 2081, month: 1, day: 15 }
 *   parseNepaliDate('२०८१ साल बैशाख १५ गते')
 *
 * Needs the calendar initialised (it checks the day against the month length).
 */
import { JhiguError } from './errors.js';
import { monthNameTable } from './generated/monthNames.js';
import { getStrings } from './generated/strings.js';
import { isValidBSDate } from './nepaliCalendar.js';
import type { NepaliDateFields } from './types.js';

const NE_DIGITS = '०१२३४५६७८९';
const toAscii = (s: string) => s.replace(/[०-९]/g, c => String(NE_DIGITS.indexOf(c)));
const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[‌‍]/g, '');

const MONTHS = new Map(monthNameTable);

const WEEKDAYS = new Set<string>();
for (const lang of ['en', 'ne'] as const) {
  const s = getStrings(lang);
  for (const w of [...s.weekdays, ...s.weekdaysShort]) WEEKDAYS.add(norm(w));
}

/** Era and filler words removed before reading (guide step 2). */
const NOISE = ['वि.सं.', 'वि.सं', 'सम्वत्', 'संवत्', 'साल', 'गते'];

type Tok = { num: string } | { month: number };

/**
 * Patterns tried in order (guide step 6, plus `Y month D`, which the `gate`
 * preset produces):
 *   Y M D        first token has 4 digits
 *   D month Y    month as a name, last token has 4 digits
 *   month D Y
 *   Y month D
 *   D M Y        last token has 4 digits
 * Separators `/ . , -` and spaces are all treated alike.
 */
export function parseNepaliDate(text: string): NepaliDateFields {
  const fail = (): never => {
    throw new JhiguError('PARSE_ERROR', getStrings('en').date.parseError, text);
  };

  let s = norm(toAscii(text));
  for (const w of NOISE) s = s.split(w).join(' ');
  s = s.replace(/\bbs\b/g, ' ').replace(/[/.,\-]/g, ' ');
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 0 && WEEKDAYS.has(words[0])) words.shift();
  if (words.length !== 3) return fail();

  const toks: Tok[] = words.map(w => {
    if (/^\d+$/.test(w)) return { num: w };
    const month = MONTHS.get(w);
    return month === undefined ? fail() : { month };
  });

  const [a, b, c] = toks;
  const four = (t: Tok) => 'num' in t && t.num.length === 4;
  const short = (t: Tok) => 'num' in t && t.num.length <= 2;
  const n = (t: Tok) => Number((t as { num: string }).num);
  const m = (t: Tok) => (t as { month: number }).month;

  let year: number, month: number, day: number;
  if (four(a) && short(b) && short(c)) {
    [year, month, day] = [n(a), n(b), n(c)];
  } else if (short(a) && 'month' in b && four(c)) {
    [day, month, year] = [n(a), m(b), n(c)];
  } else if ('month' in a && short(b) && four(c)) {
    [month, day, year] = [m(a), n(b), n(c)];
  } else if (four(a) && 'month' in b && short(c)) {
    [year, month, day] = [n(a), m(b), n(c)];
  } else if (short(a) && short(b) && four(c)) {
    [day, month, year] = [n(a), n(b), n(c)];
  } else {
    return fail();
  }

  if (!isValidBSDate(year, month, day)) return fail();
  return { year, month, day };
}
