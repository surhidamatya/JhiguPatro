/**
 * Headless money input (guide 15.1, P2): a framework-free state machine for an
 * amount text field. On every change it reformats with lakh grouping, keeps the
 * caret in place by counting the digits to its left, and accepts Devanagari
 * digits (shown as ASCII unless `digits: 'native'`).
 *
 *   const input = createMoneyInput();
 *   input.subscribe(state => render(state));
 *   input.actions.input('1234567.5', 9);   // text '12,34,567.5', caret 10
 *
 * Rules:
 *  - Only digits and one decimal point are kept (a leading `-` when
 *    `allowNegative`). A leading currency symbol (`Rs.`, `NPR`, `रु`) is ignored;
 *    other characters are dropped.
 *  - At most two decimal digits; extra ones are dropped.
 *  - Leading zeros are removed (`007` is `7`); a lone `.` becomes `0.`.
 *  - A change that would pass the largest amount (see MAX_PAISA) is ignored.
 *  - Every action that changes the state notifies subscribers once. Typing that
 *    changes nothing does not.
 *
 * Import from `jhigu-patro-utils-ts/money-input`.
 */
import { placeCaret } from './inputCaret.js';
import { MAX_PAISA, MoneyError, Npr, groupLakh } from './money.js';

export interface MoneyInputOptions {
  /** Initial amount. */
  value?: Npr | null;
  /** `ascii` (default) or `native` (Devanagari) digits in the text. */
  digits?: 'ascii' | 'native';
  /** Allow a leading minus. Default false. */
  allowNegative?: boolean;
}

export interface MoneyInputState {
  /** The text to show in the field. */
  text: string;
  /** Where the caret belongs in `text`. */
  caret: number;
  /** The amount, or null while the field is empty (or only `-`). */
  value: Npr | null;
  digits: 'ascii' | 'native';
  allowNegative: boolean;
}

export interface MoneyInputActions {
  /**
   * The user changed the field. `text` is the raw field value and `caret` the
   * caret position in it (default: the end).
   */
  input(text: string, caret?: number): void;
  /** Leaving the field: show two decimal digits (`1,234.5` becomes `1,234.50`). */
  blur(): void;
  /** Set the amount from code (`null` empties the field). */
  setValue(value: Npr | null): void;
  clear(): void;
}

export interface MoneyInput {
  getState(): MoneyInputState;
  /** Returns an unsubscribe function. */
  subscribe(listener: (state: MoneyInputState) => void): () => void;
  actions: MoneyInputActions;
}

const NE_DIGITS = '०१२३४५६७८९';
const toAscii = (s: string) => s.replace(/[०-९]/g, c => String(NE_DIGITS.indexOf(c)));
const toNative = (s: string) => s.replace(/\d/g, d => NE_DIGITS[+d]);
const SYMBOL = /^(\s*-?\s*)(rs\.?|npr|रु|रू)/;
const isDigit = (c: string) => c >= '0' && c <= '9';

interface Item { ch: string; idx: number }

export function createMoneyInput(options: MoneyInputOptions = {}): MoneyInput {
  const digits = options.digits ?? 'ascii';
  const allowNegative = options.allowNegative ?? false;
  const show = (s: string) => (digits === 'native' ? toNative(s) : s);

  let state: MoneyInputState = { text: '', caret: 0, value: null, digits, allowNegative };
  const listeners = new Set<(s: MoneyInputState) => void>();

  const commit = (next: MoneyInputState) => {
    if (next.text === state.text && next.caret === state.caret) return;
    state = next;
    for (const l of [...listeners]) l(state);
  };

  const setFromValue = (value: Npr | null, pad: boolean) => {
    if (value && value.isNegative() && !allowNegative) throw new MoneyError('INVALID_ARGUMENT');
    const text = value ? value.format({ decimals: pad ? 'always' : 'auto', devanagari: digits === 'native' }) : '';
    commit({ ...state, text, caret: text.length, value });
  };

  if (options.value) setFromValue(options.value, false);

  const actions: MoneyInputActions = {
    input(raw, caret = raw.length) {
      const s = toAscii(raw);
      const skip = new Set<number>();
      const m = SYMBOL.exec(s.toLowerCase());
      if (m) for (let i = m[1].length; i < m[0].length; i++) skip.add(i);

      let sign: Item | null = null;
      let dot: Item | null = null;
      let intDigits: Item[] = [];
      const dec: Item[] = [];
      for (let i = 0; i < s.length; i++) {
        if (skip.has(i)) continue;
        const ch = s[i];
        if (ch === '-' && allowNegative && !sign && !dot && intDigits.length === 0) sign = { ch, idx: i };
        else if (ch === '.' && !dot) dot = { ch, idx: i };
        else if (isDigit(ch)) {
          if (dot) { if (dec.length < 2) dec.push({ ch, idx: i }); }
          else intDigits.push({ ch, idx: i });
        }
      }
      // Leading zeros: keep at least one digit.
      while (intDigits.length > 1 && intDigits[0].ch === '0') intDigits = intDigits.slice(1);
      if (dot && intDigits.length === 0) intDigits = [{ ch: '0', idx: dot.idx }];

      const intStr = intDigits.map(d => d.ch).join('');
      const decStr = dec.map(d => d.ch).join('');
      let value: Npr | null = null;
      if (intStr !== '') {
        const paisa = BigInt(intStr) * 100n + BigInt(decStr.padEnd(2, '0') || '0');
        if (paisa > BigInt(MAX_PAISA)) return; // would pass the largest amount: ignore the change
        const signed = sign ? -paisa : paisa;
        value = Npr.fromPaisa(Number(signed));
      }

      const seq: Item[] = [...(sign ? [sign] : []), ...intDigits, ...(dot ? [dot] : []), ...dec];
      const text = show((sign ? '-' : '') + (intStr === '' ? '' : groupLakh(intStr)) + (dot ? '.' + decStr : ''));
      const count = seq.filter(it => it.idx < caret).length;
      commit({ ...state, text, caret: placeCaret(text, count, c => isDigit(c) || c === '.' || c === '-' || NE_DIGITS.includes(c)), value });
    },
    blur() {
      if (state.value === null) {
        // a lone minus is not an amount
        commit({ ...state, text: '', caret: 0 });
        return;
      }
      setFromValue(state.value, true);
    },
    setValue(value) {
      setFromValue(value, false);
    },
    clear() {
      commit({ ...state, text: '', caret: 0, value: null });
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
