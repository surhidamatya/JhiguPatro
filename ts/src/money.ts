/**
 * Nepali rupee amounts (guide section 9). Integer paisa only, never floats.
 *
 * An amount is a safe integer number of paisa, at most 2^53 - 1 in size
 * (about 90 trillion rupees); the Dart port enforces the same limit so both
 * behave alike, including on Dart web. Multiplication and division run on
 * BigInt so intermediate values cannot overflow. All rounding is half away
 * from zero.
 */
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';

export type MoneyErrorCode =
  | 'EMPTY'
  | 'BAD_FORMAT'
  | 'TOO_MANY_DECIMALS'
  | 'OUT_OF_RANGE'
  | 'INVALID_ARGUMENT';

const MESSAGE_KEY = {
  EMPTY: 'empty',
  BAD_FORMAT: 'badFormat',
  TOO_MANY_DECIMALS: 'tooManyDecimals',
  OUT_OF_RANGE: 'outOfRange',
  INVALID_ARGUMENT: 'invalidArgument',
} as const;

/** Typed money error. `message` is English; use `localized()` for ne. */
export class MoneyError extends Error {
  constructor(public readonly code: MoneyErrorCode) {
    super(getStrings('en').money[MESSAGE_KEY[code]]);
    this.name = 'MoneyError';
  }

  localized(language: Language): string {
    return getStrings(language).money[MESSAGE_KEY[this.code]];
  }
}

/** Largest allowed magnitude in paisa: 2^53 - 1. */
export const MAX_PAISA = Number.MAX_SAFE_INTEGER;

// ── Integer helpers ──────────────────────────────────────────────────────────

/** n / d rounded half away from zero. d must be positive. */
function roundDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice < d) return q;
  return n < 0n ? q - 1n : q + 1n;
}

function fromBig(b: bigint): Npr {
  if (b > BigInt(MAX_PAISA) || b < -BigInt(MAX_PAISA)) throw new MoneyError('OUT_OF_RANGE');
  return new Npr(Number(b));
}

function checkInt(n: number): void {
  if (!Number.isInteger(n)) throw new MoneyError('INVALID_ARGUMENT');
}

const NE_DIGITS = '०१२३४५६७८९';
const toAscii = (s: string) => s.replace(/[०-९]/g, c => String(NE_DIGITS.indexOf(c)));
const toDevanagari = (s: string) => s.replace(/\d/g, d => NE_DIGITS[+d]);

/**
 * Indian grouping: last three digits, then groups of two.
 * `groupLakh('12345678')` is `1,23,45,678`. Input is digits only.
 */
export function groupLakh(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return parts.join(',') + ',' + last3;
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface NprFormatOptions {
  /** Default `none`. */
  symbol?: 'Rs.' | 'रु' | 'none';
  /** Use Devanagari digits. Default false. */
  devanagari?: boolean;
  /**
   * `auto` (default) drops `.00`; `always` keeps two paisa digits; `never`
   * rounds to whole rupees (half away from zero).
   */
  decimals?: 'auto' | 'always' | 'never';
}

export interface VatResult {
  subtotal: Npr;
  vat: Npr;
  total: Npr;
}

// ── Npr ──────────────────────────────────────────────────────────────────────

export class Npr {
  /** Integer paisa. */
  readonly paisa: number;

  /** Prefer the static constructors; this only checks the invariant. */
  constructor(paisa: number) {
    checkInt(paisa);
    if (Math.abs(paisa) > MAX_PAISA) throw new MoneyError('OUT_OF_RANGE');
    // Normalise -0 to 0.
    this.paisa = paisa === 0 ? 0 : paisa;
    Object.freeze(this);
  }

  static readonly ZERO = new Npr(0);

  static fromPaisa(paisa: number): Npr {
    return new Npr(paisa);
  }

  /**
   * Rounds once to paisa, half away from zero. Uses the shortest decimal text of
   * the double (so 1.005 is 100.5 paisa, not 100.49999). Throws for NaN/Infinity.
   */
  static fromRupees(rupees: number): Npr {
    if (!Number.isFinite(rupees)) throw new MoneyError('INVALID_ARGUMENT');
    const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(rupees));
    if (!m) throw new MoneyError('INVALID_ARGUMENT');
    const frac = m[3] ?? '';
    let digits = BigInt(m[2] + frac);
    if (m[1]) digits = -digits;
    const exp = Number(m[4] ?? 0) - frac.length;
    if (exp > 400) throw new MoneyError('OUT_OF_RANGE');
    if (exp >= 0) return fromBig(digits * 10n ** BigInt(exp) * 100n);
    return fromBig(roundDiv(digits * 100n, 10n ** BigInt(-exp)));
  }

  /**
   * Parse user text such as `Rs. 1,250.50`, `रु १,२५०`, `NPR 99`, `-5`.
   * Throws MoneyError (EMPTY, BAD_FORMAT, TOO_MANY_DECIMALS, OUT_OF_RANGE).
   */
  static parse(text: string): Npr {
    let s = toAscii(text).trim().toLowerCase();
    const SYMBOL = /^(?:rs\.?|npr|रु|रू)/;
    const SYMBOL_END = /(?:rs\.?|npr|रु|रू)$/;
    let negative = false;
    if (s.startsWith('-')) { negative = true; s = s.slice(1).trimStart(); }
    s = s.replace(SYMBOL, '').trimStart();
    if (s.startsWith('-')) {
      if (negative) throw new MoneyError('BAD_FORMAT');
      negative = true;
      s = s.slice(1).trimStart();
    }
    s = s.trimEnd().replace(SYMBOL_END, '');
    s = s.replace(/[,\s]/g, '');
    if (!s) throw new MoneyError('EMPTY');
    const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[2] !== undefined && m[2] === '')) throw new MoneyError('BAD_FORMAT');
    const frac = m[2] ?? '';
    if (frac.length > 2) throw new MoneyError('TOO_MANY_DECIMALS');
    let paisa = BigInt(m[1] + frac.padEnd(2, '0'));
    if (negative) paisa = -paisa;
    return fromBig(paisa);
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  isZero(): boolean { return this.paisa === 0; }
  isNegative(): boolean { return this.paisa < 0; }
  equals(other: Npr): boolean { return this.paisa === other.paisa; }
  /** Negative, zero or positive like Array.sort expects. */
  compareTo(other: Npr): number { return this.paisa < other.paisa ? -1 : this.paisa > other.paisa ? 1 : 0; }

  // ── Arithmetic ─────────────────────────────────────────────────────────────

  plus(other: Npr): Npr { return new Npr(this.paisa + other.paisa); }
  minus(other: Npr): Npr { return new Npr(this.paisa - other.paisa); }
  negate(): Npr { return new Npr(-this.paisa); }
  abs(): Npr { return new Npr(Math.abs(this.paisa)); }

  /** Exact multiple by an integer. */
  times(n: number): Npr {
    checkInt(n);
    return fromBig(BigInt(this.paisa) * BigInt(n));
  }

  /**
   * Multiply by a decimal given as text (`"1.5"`, `"-0.125"`), rounded half away
   * from zero. Floating-point numbers are not accepted.
   */
  timesDecimal(decimal: string): Npr {
    if (typeof decimal !== 'string') throw new MoneyError('INVALID_ARGUMENT');
    const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal);
    if (!m) throw new MoneyError('INVALID_ARGUMENT');
    const frac = m[3] ?? '';
    let num = BigInt(m[2] + frac);
    if (m[1]) num = -num;
    return fromBig(roundDiv(BigInt(this.paisa) * num, 10n ** BigInt(frac.length)));
  }

  /** `bp` basis points of this amount (13% is 1300), rounded half away from zero. */
  percent(bp: number): Npr {
    checkInt(bp);
    return fromBig(roundDiv(BigInt(this.paisa) * BigInt(bp), 10000n));
  }

  /** `this * times / divisor`, rounded half away from zero. Divisor must be a positive integer. */
  dividedBy(divisor: number, times = 1): Npr {
    checkInt(divisor);
    checkInt(times);
    if (divisor < 1) throw new MoneyError('INVALID_ARGUMENT');
    return fromBig(roundDiv(BigInt(this.paisa) * BigInt(times), BigInt(divisor)));
  }

  /**
   * Split by ratios with the largest remainder method. Ratios are non-negative
   * integers with a positive sum. The shares always add up to this amount;
   * leftover paisa go to the largest remainders, ties to the lower index.
   */
  allocate(ratios: readonly number[]): Npr[] {
    if (ratios.length === 0) throw new MoneyError('INVALID_ARGUMENT');
    let sum = 0n;
    for (const r of ratios) {
      checkInt(r);
      if (r < 0) throw new MoneyError('INVALID_ARGUMENT');
      sum += BigInt(r);
    }
    if (sum === 0n) throw new MoneyError('INVALID_ARGUMENT');
    const negative = this.paisa < 0;
    const total = BigInt(Math.abs(this.paisa));
    const shares: bigint[] = [];
    const remainders: bigint[] = [];
    let given = 0n;
    for (const r of ratios) {
      const prod = total * BigInt(r);
      const share = prod / sum;
      shares.push(share);
      remainders.push(prod % sum);
      given += share;
    }
    let leftover = Number(total - given);
    const order = remainders
      .map((rem, i) => ({ rem, i }))
      .sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
    for (let k = 0; k < leftover; k++) shares[order[k].i] += 1n;
    return shares.map(s => new Npr(Number(negative ? -s : s)));
  }

  /** `allocate` into `n` equal parts. */
  split(n: number): Npr[] {
    checkInt(n);
    if (n < 1) throw new MoneyError('INVALID_ARGUMENT');
    return this.allocate(Array<number>(n).fill(1));
  }

  // ── Format ─────────────────────────────────────────────────────────────────

  /** `Rs. 1,23,456.50`. The minus sign goes before the symbol. */
  format(options: NprFormatOptions = {}): string {
    const symbol = options.symbol ?? 'none';
    const decimals = options.decimals ?? 'auto';
    const negative = this.paisa < 0;
    const abs = BigInt(Math.abs(this.paisa));
    let rupees = abs / 100n;
    let paise = Number(abs % 100n);
    if (decimals === 'never') {
      if (paise >= 50) rupees += 1n;
      paise = 0;
    }
    const showPaise = decimals === 'always' || (decimals === 'auto' && paise !== 0);
    let body = groupLakh(rupees.toString());
    if (showPaise) body += '.' + String(paise).padStart(2, '0');
    if (options.devanagari) body = toDevanagari(body);
    const isZero = rupees === 0n && paise === 0;
    const sign = negative && !isZero ? '-' : '';
    return sign + (symbol === 'none' ? body : `${symbol} ${body}`);
  }

  /** Amount in words, e.g. `Rupees One Hundred Twenty-Three and Forty-Five Paisa Only`. */
  inWords(options: AmountInWordsOptions = {}): string { return amountInWords(this, options); }

  toString(): string { return this.format({ decimals: 'always' }); }
  toJSON(): number { return this.paisa; }
}

// ── VAT (guide 9.6) ──────────────────────────────────────────────────────────

/** Price does not include VAT. Default rate 13% (1300 basis points). */
export function vatExclusive(base: Npr, bp = 1300): VatResult {
  const vat = base.percent(bp);
  return { subtotal: base, vat, total: base.plus(vat) };
}

/** Price already includes VAT. VAT is `total - base` so the parts always add up. */
export function vatInclusive(total: Npr, bp = 1300): VatResult {
  const base = total.dividedBy(10000 + bp, 10000);
  return { subtotal: base, vat: total.minus(base), total };
}

// ── Amount in words (guide 9.5, English only) ────────────────────────────────

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 1..99 as words, `twenty-one` style. */
function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 === 0 ? t : `${t}-${ONES[n % 10]}`;
}

/** 1..999 as words. */
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(below100(r));
  return parts.join(' ');
}

/** 1..9,999,999 (below one crore) using lakh and thousand. */
function belowCrore(n: number): string {
  const lakh = Math.floor(n / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (lakh) parts.push(`${below100(lakh)} lakh`);
  if (thousand) parts.push(`${below100(thousand)} thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/**
 * A non-negative integer in English words with Indian scales (thousand, lakh,
 * crore), lower case, hyphenated tens: `1234567` is
 * `twelve lakh thirty-four thousand five hundred sixty-seven`. Above 99 crore the
 * crore count is spoken as its own number (`one hundred crore`). No "and"
 * inside the number.
 */
export function numberToWords(n: number): string {
  checkInt(n);
  if (n < 0 || n > MAX_PAISA) throw new MoneyError('INVALID_ARGUMENT');
  if (n === 0) return 'zero';
  const crore = Math.floor(n / 10000000);
  const rest = n % 10000000;
  const parts: string[] = [];
  if (crore) parts.push(`${belowCrore(crore)} crore`);
  if (rest) parts.push(belowCrore(rest));
  return parts.join(' ');
}

export interface AmountInWordsOptions {
  /** Only English is available; Nepali needs a reviewed word table. */
  language?: 'en';
  /** `title` (default) or `lower`. Applies to the whole result. */
  letterCase?: 'title' | 'lower';
  /** Before the rupee words. Default from the strings table (`Rupees`). */
  prefix?: string;
  /** After everything. Default `Only`. */
  suffix?: string;
  /** After the paisa words. Default `Paisa`. */
  paisaLabel?: string;
  /** Between rupees and paisa. Default `and`. */
  joiner?: string;
  /** Before a negative amount. Default `Minus`. */
  minus?: string;
}

const titleCase = (s: string) => s.replace(/(^|[\s-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());

/**
 * `Rupees <words> [and <paisa words> Paisa] Only`. With zero rupees and some
 * paisa the rupee part is left out (`Fifty Paisa Only`); with nothing at all it
 * is `Rupees Zero Only`. A negative amount starts with `Minus`.
 */
export function amountInWords(amount: Npr, options: AmountInWordsOptions = {}): string {
  if ((options.language ?? 'en') !== 'en') throw new MoneyError('INVALID_ARGUMENT');
  const w = getStrings('en').words;
  const prefix = options.prefix ?? w.rupees;
  const suffix = options.suffix ?? w.only;
  const paisaLabel = options.paisaLabel ?? w.paisa;
  const joiner = options.joiner ?? w.and;
  const minus = options.minus ?? w.minus;

  const abs = Math.abs(amount.paisa);
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;
  const parts: string[] = [];
  if (amount.paisa < 0) parts.push(minus);
  if (rupees > 0 || paise === 0) {
    parts.push(prefix, titleCase(numberToWords(rupees)));
    if (paise > 0) parts.push(joiner);
  }
  if (paise > 0) parts.push(titleCase(numberToWords(paise)), paisaLabel);
  parts.push(suffix);
  const out = parts.join(' ');
  return options.letterCase === 'lower' ? out.toLowerCase() : out;
}
