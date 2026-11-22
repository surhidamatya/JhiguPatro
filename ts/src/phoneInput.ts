/**
 * Headless phone input (guide 15.1, P2): a framework-free state machine for a
 * phone number text field. It formats as the user types, shows the carrier once
 * the prefix is known, and gives a validation message from the string tables.
 * Validation is the same parser as `parsePhone` (this module only adds the
 * lenient, partial-input handling around it).
 *
 *   const input = createPhoneInput({ language: 'ne' });
 *   input.subscribe(state => render(state));
 *   input.actions.input('9841234', 7);   // text '984-1234', carrier 'NTC'
 *
 * Rules:
 *  - Devanagari digits are converted; everything but digits and a leading `+`
 *    is dropped. `+977` or `00977` (or `977` in front of more than 10 digits)
 *    is kept as a `+977 ` prefix.
 *  - A number whose first two digits can start a known mobile prefix (or a lone 9)
 *    is a mobile: at most 10 digits, shown `984-1234567`, a leading trunk 0 is
 *    dropped. Anything else is a landline: 8 digits, shown `01-4123456` (the trunk
 *    0 stays only if the user typed it). Digits past the length are kept and
 *    reported as `TOO_LONG`, never cut off silently (a pasted number with an extra
 *    digit must not turn into a different valid number).
 *  - Errors appear as early as they can be known (an unknown mobile prefix or
 *    area code, an inactive prefix). `TOO_SHORT` is only reported after `blur()`.
 *  - Every action that changes the state notifies subscribers once.
 *
 * Import from `jhigu-patro-utils-ts/phone-input`.
 */
import { placeCaret } from './inputCaret.js';
import { PhoneError, parsePhone } from './phone.js';
import type { PhoneErrorCode } from './phone.js';
import { phoneAreaCodes, phoneFormats, phoneLandlineLength, phoneMobileLength, phoneMobilePrefixes } from './generated/phone.js';
import type { Language } from './generated/strings.js';

export interface PhoneInputOptions {
  language?: Language;
  /** Accept prefixes whose carrier no longer operates. Default false. */
  allowInactive?: boolean;
  /** Initial text. */
  value?: string;
}

export interface PhoneInputState {
  /** The text to show in the field. */
  text: string;
  /** Where the caret belongs in `text`. */
  caret: number;
  /** `+9779841234567` when the number is valid, else null. */
  e164: string | null;
  /** `984-1234567` / `01-4123456` when valid, else null. */
  national: string | null;
  valid: boolean;
  /** Known once enough digits are typed; the parsed type when valid. */
  type: 'mobile' | 'landline' | null;
  /** Carrier name once the 3-digit mobile prefix is known. */
  carrier: string | null;
  /** Landline area code once known (without the trunk 0). */
  areaCode: string | null;
  /** Why the number is not (yet) valid, when that is already known. */
  error: PhoneErrorCode | null;
  /** `error` in `language` from the string tables. */
  message: string | null;
  /** True after `blur()`. */
  touched: boolean;
  language: Language;
}

export interface PhoneInputActions {
  /** The user changed the field. `caret` defaults to the end of `text`. */
  input(text: string, caret?: number): void;
  /** Leaving the field: report `TOO_SHORT` for an unfinished number. */
  blur(): void;
  /** Set the text from code (same as `input` with the caret at the end). */
  setValue(text: string): void;
  clear(): void;
  setLanguage(language: Language): void;
}

export interface PhoneInput {
  getState(): PhoneInputState;
  /** Returns an unsubscribe function. */
  subscribe(listener: (state: PhoneInputState) => void): () => void;
  actions: PhoneInputActions;
}

const NE_DIGITS = '०१२३४५६७८९';
const toAscii = (s: string) => s.replace(/[०-९]/g, c => String(NE_DIGITS.indexOf(c)));
const isDigit = (c: string) => c >= '0' && c <= '9';
const isSig = (c: string) => isDigit(c) || c === '+';
/** Most digits kept after the country code; more are dropped (nobody has a longer number). */
const MAX_DIGITS = 15;
const MOBILE = new Map(phoneMobilePrefixes.map(m => [m.prefix, m]));
const AREAS = new Set(phoneAreaCodes.map(a => a.code));

interface Item { ch: string; idx: number }

/** First two digits of every known mobile prefix (96, 97, 98, 90). */
const MOBILE_START = new Set(phoneMobilePrefixes.map(m => m.prefix.slice(0, 2)));

/** A number looks like a mobile while its first two digits can start a known mobile prefix. */
const mobileLike = (nsn: string) => nsn[0] === '9' && (nsn.length < 2 || MOBILE_START.has(nsn.slice(0, 2)));

/** Area-code length of a landline NSN as typed so far (1 for Kathmandu). */
function areaLength(nsn: string): number {
  if (nsn[0] === '1') return nsn.length >= 2 && (nsn[1] === '0' || nsn[1] === '1') ? 2 : 1;
  return 2;
}

/** BAD_PREFIX as soon as the landline structure is known to be wrong. */
function landlineProblem(nsn: string): boolean {
  if (nsn[0] === '1') return nsn.length >= 2 && !/^1[0-6]/.test(nsn);
  if (nsn.length >= 2 && !AREAS.has(nsn.slice(0, 2))) return true;
  if (nsn.length >= 3) {
    return !(nsn.slice(0, 2) === '99' ? /^[02-6]$/ : /^[2-6]$/).test(nsn[2]);
  }
  return false;
}

function landlineArea(nsn: string): string | null {
  if (nsn[0] === '1') {
    if (nsn.length < 2 || !/^1[0-6]/.test(nsn)) return null;
    return areaLength(nsn) === 2 ? nsn.slice(0, 2) : '1';
  }
  return nsn.length >= 2 && AREAS.has(nsn.slice(0, 2)) ? nsn.slice(0, 2) : null;
}

export function createPhoneInput(options: PhoneInputOptions = {}): PhoneInput {
  const allowInactive = options.allowInactive ?? false;
  let language: Language = options.language ?? 'en';
  let touched = false;
  let state: PhoneInputState = blank();
  const listeners = new Set<(s: PhoneInputState) => void>();

  function blank(): PhoneInputState {
    return { text: '', caret: 0, e164: null, national: null, valid: false, type: null, carrier: null, areaCode: null, error: null, message: null, touched: false, language };
  }

  const same = (a: PhoneInputState, b: PhoneInputState) =>
    a.text === b.text && a.caret === b.caret && a.error === b.error && a.language === b.language &&
    a.touched === b.touched && a.valid === b.valid && a.carrier === b.carrier && a.type === b.type &&
    a.areaCode === b.areaCode && a.e164 === b.e164;

  const commit = (next: PhoneInputState) => {
    if (same(next, state)) return;
    state = next;
    for (const l of [...listeners]) l(state);
  };

  /** Everything derived from the raw field text. */
  const resolve = (text: string, caret: number): PhoneInputState => {
    const s = toAscii(text);
    // 1. Pull out digits (with their position), note a leading '+'.
    let plus = false;
    let plusItem: Item | null = null;
    let items: Item[] = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (isDigit(c)) items.push({ ch: c, idx: i });
      else if (c === '+' && items.length === 0 && !plus) {
        plus = true;
        plusItem = { ch: c, idx: i };
      }
    }
    // 2. 00977... counts as +977...; bare 977 counts when too long to be a national number.
    if (!plus && items.length >= 2 && items[0].ch === '0' && items[1].ch === '0') {
      plus = true;
      plusItem = items[0];
      items = items.slice(2);
    } else if (!plus && items.length > 10 && items.slice(0, 3).map(i => i.ch).join('') === '977') {
      plus = true;
      plusItem = { ch: '+', idx: items[0].idx };
    }

    let cc: Item[] = [];
    let foreign = false;
    if (plus) {
      cc = items.slice(0, 3);
      const typed = cc.map(i => i.ch).join('');
      foreign = typed !== '977'.slice(0, typed.length);
      items = items.slice(3);
    }

    if (foreign) {
      // Not Nepal: keep what was typed (no formatting) and report BAD_PREFIX.
      const kept = [...cc, ...items].slice(0, MAX_DIGITS);
      const out = '+' + kept.map(i => i.ch).join('');
      const count = [...(plusItem ? [plusItem] : []), ...kept].filter(i => i.idx < caret).length;
      return finish(out, placeCaret(out, count, isSig), 'BAD_PREFIX', null, null, null, null);
    }

    // 3. National digits: trunk 0, mobile or landline shape, length cap.
    let trunk: Item | null = null;
    if (items.length > 0 && items[0].ch === '0') {
      trunk = items[0];
      items = items.slice(1);
    }
    let nsn = items.map(i => i.ch).join('');
    const mobile = mobileLike(nsn);
    const cap = mobile ? phoneMobileLength : phoneLandlineLength;
    // Never cut a number short silently: digits past the length stay and give TOO_LONG.
    items = items.slice(0, MAX_DIGITS);
    nsn = nsn.slice(0, MAX_DIGITS);
    const keepTrunk = trunk !== null && !mobile;

    // 4. Display.
    let formatted = nsn;
    if (mobile) {
      if (nsn.length > 3) formatted = nsn.slice(0, 3) + '-' + nsn.slice(3);
    } else if (nsn.length > 0) {
      const al = areaLength(nsn);
      if (nsn.length > al) formatted = nsn.slice(0, al) + '-' + nsn.slice(al);
    }
    const prefix = plus ? '+' + cc.map(i => i.ch).join('') + (nsn.length > 0 || keepTrunk ? ' ' : '') : '';
    const out = prefix + (keepTrunk ? '0' : '') + formatted;
    const sig: Item[] = [...(plusItem ? [plusItem] : []), ...cc, ...(keepTrunk && trunk ? [trunk] : []), ...items];
    const count = sig.filter(i => i.idx < caret).length;

    // 5. Facts and errors.
    let error: PhoneErrorCode | null = null;
    let carrier: string | null = null;
    let type: 'mobile' | 'landline' | null = null;
    let areaCode: string | null = null;
    if (nsn.length > 0) {
      if (mobile) {
        if (nsn.length >= 3) {
          type = 'mobile';
          const entry = MOBILE.get(nsn.slice(0, 3));
          if (!entry) error = 'BAD_PREFIX';
          else {
            carrier = entry.carrier;
            if (!entry.active && !allowInactive) error = 'INACTIVE_PREFIX';
          }
        }
      } else {
        if (nsn.length >= 2) type = 'landline';
        areaCode = landlineArea(nsn);
        if (landlineProblem(nsn)) error = 'BAD_PREFIX';
      }
    }
    return finish(out, placeCaret(out, count, isSig), error, carrier, type, areaCode, nsn.length >= cap ? nsn : null, plus);
  };

  /** Validate a complete number with the real parser and build the state. */
  function finish(
    out: string, caret: number, earlyError: PhoneErrorCode | null, carrier: string | null,
    type: 'mobile' | 'landline' | null, areaCode: string | null, complete: string | null, plus = false,
  ): PhoneInputState {
    let error = earlyError;
    let e164: string | null = null;
    let national: string | null = null;
    let valid = false;
    if (out !== '' && earlyError === null && complete !== null) {
      try {
        const p = parsePhone((plus ? '+977' : '') + complete, { allowInactive });
        e164 = p.e164;
        national = p.national;
        valid = true;
        type = p.type;
        carrier = p.carrier;
        areaCode = p.areaCode ?? null;
      } catch (e) {
        error = e instanceof PhoneError ? e.code : 'BAD_CHARACTERS';
      }
    } else if (out !== '' && error === null && touched) {
      error = 'TOO_SHORT';
    }
    return {
      text: out, caret, e164, national, valid, type, carrier, areaCode, error,
      message: error ? new PhoneError(error).localized(language) : null,
      touched, language,
    };
  }

  const setRaw = (text: string, caret: number) => {
    commit(resolve(text, caret));
  };

  // The initial text is not an event: listeners subscribe afterwards.
  if (options.value) setRaw(options.value, options.value.length);

  const actions: PhoneInputActions = {
    input(text, caret = text.length) {
      setRaw(text, caret);
    },
    blur() {
      touched = true;
      commit(resolve(state.text, state.caret));
    },
    setValue(text) {
      setRaw(text, text.length);
    },
    clear() {
      touched = false;
      setRaw('', 0);
    },
    setLanguage(next) {
      language = next;
      commit(resolve(state.text, state.caret));
    },
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    actions,
  };
}
