/**
 * Nepali phone number parsing (guide section 10). Pure logic, no network.
 * Data comes from data/phone-prefixes.json via src/generated/phone.ts and is
 * best effort (see data/PHONE_NOTES.md).
 */
import {
  phoneAreaCodes,
  phoneFormats,
  phoneLandlineLength,
  phoneMobileLength,
  phoneMobilePrefixes,
} from './generated/phone.js';
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';

export type PhoneErrorCode =
  | 'EMPTY'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'BAD_PREFIX'
  | 'INACTIVE_PREFIX'
  | 'BAD_CHARACTERS';

const MESSAGE_KEY = {
  EMPTY: 'empty',
  TOO_SHORT: 'tooShort',
  TOO_LONG: 'tooLong',
  BAD_PREFIX: 'badPrefix',
  INACTIVE_PREFIX: 'inactivePrefix',
  BAD_CHARACTERS: 'badCharacters',
} as const;

/** Typed phone validation error. `message` is English; use `localized()` for ne. */
export class PhoneError extends Error {
  constructor(public readonly code: PhoneErrorCode) {
    super(getStrings('en').phone[MESSAGE_KEY[code]]);
    this.name = 'PhoneError';
  }

  /** Message in the given language, from the string tables. */
  localized(language: Language): string {
    return getStrings(language).phone[MESSAGE_KEY[this.code]];
  }
}

export interface ParsedPhone {
  /** `+9779841234567`. Store this form. */
  e164: string;
  /** Display form: `984-1234567` (mobile) or `01-4123456` (landline). */
  national: string;
  type: 'mobile' | 'landline';
  /** Carrier name from the prefix table; null for landlines and unknown carriers. */
  carrier: string | null;
  /** Landline area code without the leading 0. */
  areaCode?: string;
}

export interface ParsePhoneOptions {
  /** Accept prefixes whose carrier no longer operates. Default false. */
  allowInactive?: boolean;
}

const NE_DIGITS = '०१२३४५६७८९';
const toAscii = (s: string) => s.replace(/[०-९]/g, c => String(NE_DIGITS.indexOf(c)));

const MOBILE = new Map(phoneMobilePrefixes.map(m => [m.prefix, m]));
const AREA_CODES = new Set(phoneAreaCodes.map(a => a.code));

function format(pattern: string, digits: string): string {
  let i = 0;
  return [...pattern].map(ch => (ch === 'd' ? digits[i++] : ch)).join('');
}

/** Area code for an 8-digit landline NSN, or null if the structure is invalid. */
function landlineArea(nsn: string): string | null {
  if (nsn[0] === '1') {
    if (!/^1[0-6]/.test(nsn)) return null;
    const two = nsn.slice(0, 2);
    return two === '10' || two === '11' ? two : '1';
  }
  const area = nsn.slice(0, 2);
  if (!AREA_CODES.has(area)) return null;
  // 99 uses [02-6] as third digit; every other area uses [2-6].
  return (area === '99' ? /^[02-6]$/ : /^[2-6]$/).test(nsn[2]) ? area : null;
}

/**
 * Parse and validate a Nepali phone number. Accepts Devanagari digits,
 * spaces, dashes, dots, brackets, a leading 0, `+977`, `00977` or `977`.
 * Throws {@link PhoneError} on failure.
 */
export function parsePhone(text: string, options: ParsePhoneOptions = {}): ParsedPhone {
  let s = toAscii(text ?? '').replace(/[\s\-.()]/g, '');
  if (s === '') throw new PhoneError('EMPTY');
  if (!/^\+?\d+$/.test(s)) throw new PhoneError('BAD_CHARACTERS');

  if (s.startsWith('00')) s = '+' + s.slice(2);
  let nsn: string;
  if (s.startsWith('+')) {
    if (!s.startsWith('+977')) throw new PhoneError('BAD_PREFIX');
    nsn = s.slice(4);
  } else if (s.startsWith('977') && (s.length === 13 || s.length === 11)) {
    nsn = s.slice(3);
  } else {
    nsn = s;
  }
  if (nsn.startsWith('0')) nsn = nsn.slice(1);

  if (nsn.length === phoneMobileLength) {
    if (nsn[0] !== '9') throw new PhoneError('BAD_PREFIX');
    const entry = MOBILE.get(nsn.slice(0, 3));
    if (!entry) throw new PhoneError('BAD_PREFIX');
    if (!entry.active && !options.allowInactive) throw new PhoneError('INACTIVE_PREFIX');
    return {
      e164: `+977${nsn}`,
      national: format(phoneFormats.mobile, nsn),
      type: 'mobile',
      carrier: entry.carrier,
    };
  }

  if (nsn.length === phoneLandlineLength) {
    const area = landlineArea(nsn);
    if (area === null) throw new PhoneError('BAD_PREFIX');
    const pattern = area === '1' ? phoneFormats.landlineKathmandu : phoneFormats.landlineOther;
    return {
      e164: `+977${nsn}`,
      national: '0' + format(pattern, nsn),
      type: 'landline',
      carrier: null,
      areaCode: area,
    };
  }

  // 9 digits starting with 9 is a mobile missing a digit; otherwise by length.
  if (nsn.length < phoneLandlineLength || (nsn.length === 9 && nsn[0] === '9')) {
    throw new PhoneError('TOO_SHORT');
  }
  throw new PhoneError('TOO_LONG');
}

/** True if the text is a valid Nepali phone number. Never throws. */
export function isValidPhone(text: string, options: ParsePhoneOptions = {}): boolean {
  try {
    parsePhone(text, options);
    return true;
  } catch {
    return false;
  }
}
