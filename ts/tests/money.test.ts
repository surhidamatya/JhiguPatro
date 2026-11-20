import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Npr, MoneyError, groupLakh, vatExclusive, vatInclusive, numberToWords, amountInWords } from '../src/index.js';

const v = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../testdata/money.json'), 'utf8'),
);
const p = (n: number) => Npr.fromPaisa(n);
const paisas = (xs: Npr[]) => xs.map(x => x.paisa);
function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(MoneyError);
    return (e as MoneyError).code;
  }
  return 'NO_ERROR';
}

describe('groupLakh', () => {
  for (const t of v.groupLakh) it(t.in, () => expect(groupLakh(t.in)).toBe(t.out));
});

describe('format', () => {
  for (const t of v.format) {
    it(`${t.paisa} ${JSON.stringify(t.options)}`, () => expect(p(t.paisa).format(t.options)).toBe(t.out));
  }
});

describe('parse', () => {
  for (const t of v.parse.valid) it(`accepts ${JSON.stringify(t.in)}`, () => expect(Npr.parse(t.in).paisa).toBe(t.paisa));
  for (const t of v.parse.invalid) {
    it(`rejects ${JSON.stringify(t.in)} with ${t.code}`, () => expect(code(() => Npr.parse(t.in))).toBe(t.code));
  }
  it('round-trips format(always) for many amounts', () => {
    for (const n of [0, 1, 99, 100, 12345, -12345, 99999999, 1234567890123, -1234567890123]) {
      expect(Npr.parse(p(n).format({ decimals: 'always' })).paisa).toBe(n);
      expect(Npr.parse(p(n).format({ decimals: 'always', symbol: 'Rs.' })).paisa).toBe(n);
      expect(Npr.parse(p(n).format({ decimals: 'always', symbol: 'रु', devanagari: true })).paisa).toBe(n);
    }
  });
});

describe('constructors', () => {
  for (const t of v.fromRupees.valid) it(`fromRupees(${t.in})`, () => expect(Npr.fromRupees(t.in).paisa).toBe(t.paisa));
  for (const t of v.fromRupees.invalid) it(`fromRupees(${t.in}) throws`, () => expect(code(() => Npr.fromRupees(t.in))).toBe(t.code));
  for (const t of v.fromPaisa.invalid) it(`fromPaisa(${t.in}) throws`, () => expect(code(() => p(t.in))).toBe(t.code));
  it('rejects NaN and Infinity', () => {
    expect(code(() => Npr.fromRupees(NaN))).toBe('INVALID_ARGUMENT');
    expect(code(() => Npr.fromRupees(Infinity))).toBe('INVALID_ARGUMENT');
  });
  it('normalises -0', () => expect(Object.is(p(-0).paisa, 0)).toBe(true));
});

describe('arithmetic', () => {
  for (const t of v.percent) it(`percent ${t.paisa} @${t.bp}`, () => expect(p(t.paisa).percent(t.bp).paisa).toBe(t.out));
  for (const t of v.timesDecimal.valid) it(`${t.paisa} x "${t.by}"`, () => expect(p(t.paisa).timesDecimal(t.by).paisa).toBe(t.out));
  for (const s of v.timesDecimal.invalid) it(`timesDecimal(${JSON.stringify(s)}) throws`, () => expect(code(() => p(1).timesDecimal(s))).toBe('INVALID_ARGUMENT'));
  it('timesDecimal rejects a number', () => expect(code(() => p(1).timesDecimal(1.5 as unknown as string))).toBe('INVALID_ARGUMENT'));
  for (const t of v.times.valid) it(`${t.paisa} x ${t.by}`, () => expect(p(t.paisa).times(t.by).paisa).toBe(t.out));
  for (const t of v.times.invalid) it(`${t.paisa} x ${t.by} throws`, () => expect(code(() => p(t.paisa).times(t.by))).toBe(t.code));
  for (const t of v.dividedBy.valid) it(`${t.paisa} * ${t.times} / ${t.divisor}`, () => expect(p(t.paisa).dividedBy(t.divisor, t.times).paisa).toBe(t.out));
  for (const t of v.dividedBy.invalid) it(`dividedBy(${t.divisor}) throws`, () => expect(code(() => p(t.paisa).dividedBy(t.divisor, t.times))).toBe(t.code));
  for (const t of v.range) {
    it(`${t.op} ${t.a} ${t.b}`, () => {
      const run = () => (p(t.a) as any)[t.op](p(t.b)).paisa;
      if (t.code) expect(code(run)).toBe(t.code);
      else expect(run()).toBe(t.out);
    });
  }
  it('compare helpers', () => {
    expect(p(1).compareTo(p(2))).toBe(-1);
    expect(p(2).compareTo(p(2))).toBe(0);
    expect(p(3).compareTo(p(2))).toBe(1);
    expect(p(0).isZero()).toBe(true);
    expect(p(-1).isNegative()).toBe(true);
    expect(p(-5).abs().paisa).toBe(5);
    expect(p(5).negate().paisa).toBe(-5);
    expect(p(5).equals(p(5))).toBe(true);
  });
});

describe('allocate and split', () => {
  for (const t of v.allocate.valid) it(`allocate ${t.paisa} ${JSON.stringify(t.ratios)}`, () => expect(paisas(p(t.paisa).allocate(t.ratios))).toEqual(t.out));
  for (const r of v.allocate.invalid) it(`allocate ${JSON.stringify(r)} throws`, () => expect(code(() => p(10).allocate(r))).toBe('INVALID_ARGUMENT'));
  for (const t of v.split.valid) it(`split ${t.paisa} into ${t.n}`, () => expect(paisas(p(t.paisa).split(t.n))).toEqual(t.out));
  for (const n of v.split.invalid) it(`split(${n}) throws`, () => expect(code(() => p(10).split(n))).toBe('INVALID_ARGUMENT'));

  it('10,000 random allocations always add up to the total', () => {
    let seed = 12345;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 10000; i++) {
      const total = (rnd(2) ? 1 : -1) * rnd(1_000_000_000);
      const ratios = Array.from({ length: 1 + rnd(12) }, () => rnd(1000));
      if (ratios.every(r => r === 0)) ratios[0] = 1;
      const shares = p(total).allocate(ratios);
      expect(shares.reduce((a, s) => a + s.paisa, 0)).toBe(total);
      shares.forEach((s, k) => { if (ratios[k] === 0) expect(s.paisa).toBe(0); });
    }
  });
});

describe('VAT', () => {
  for (const t of v.vatExclusive) {
    it(`exclusive ${t.paisa} @${t.bp}`, () => {
      const r = vatExclusive(p(t.paisa), t.bp);
      expect([r.subtotal.paisa, r.vat.paisa, r.total.paisa]).toEqual([t.subtotal, t.vat, t.total]);
    });
  }
  for (const t of v.vatInclusive) {
    it(`inclusive ${t.paisa} @${t.bp}`, () => {
      const r = vatInclusive(p(t.paisa), t.bp);
      expect([r.subtotal.paisa, r.vat.paisa, r.total.paisa]).toEqual([t.subtotal, t.vat, t.total]);
    });
  }
  it('default rate is 13% and parts always add up', () => {
    expect(vatExclusive(p(100000)).vat.paisa).toBe(13000);
    for (let n = 0; n < 2000; n++) {
      const r = vatInclusive(p(n));
      expect(r.subtotal.plus(r.vat).paisa).toBe(n);
    }
  });
});

describe('errors', () => {
  it('localizes', () => {
    const e = new MoneyError('BAD_FORMAT');
    expect(e.message).toBe(e.localized('en'));
    expect(e.localized('ne')).not.toBe(e.localized('en'));
  });
});

// ── Amount in words ──────────────────────────────────────────────────────────

/** Independent, naive English converter (millions-style recursion) for 0..999 only. */
function naive999(n: number): string {
  const small = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  if (n < 20) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + small[n % 10] : '');
  return small[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + naive999(n % 100) : '');
}

describe('numberToWords', () => {
  for (const t of v.words.numbers) it(String(t.in), () => expect(numberToWords(t.in)).toBe(t.out));
  for (const n of v.words.numberInvalid) it(`rejects ${n}`, () => expect(code(() => numberToWords(n))).toBe('INVALID_ARGUMENT'));
  it('rejects above the range', () => expect(code(() => numberToWords(v.max + 1))).toBe('INVALID_ARGUMENT'));
  it('matches an independent converter for 0..999', () => {
    for (let n = 0; n < 1000; n++) expect(numberToWords(n), String(n)).toBe(naive999(n));
  });
  it('every scale boundary has the expected scale word', () => {
    const scales: Array<[number, string]> = [[1000, 'thousand'], [100000, 'lakh'], [10000000, 'crore']];
    for (const [base, word] of scales) {
      expect(numberToWords(base)).toBe(`one ${word}`);
      expect(numberToWords(base - 1)).not.toContain(word === 'thousand' ? 'lakh' : 'crore');
    }
  });
});

describe('amountInWords', () => {
  for (const t of v.words.amount) {
    it(`${t.paisa} ${JSON.stringify(t.options)}`, () => expect(amountInWords(p(t.paisa), t.options)).toBe(t.out));
  }
  it('Npr.inWords matches', () => expect(p(12345).inWords()).toBe(amountInWords(p(12345))));
  it('only English is supported for now', () => {
    expect(code(() => amountInWords(p(1), { language: v.words.unsupportedLanguage }))).toBe('INVALID_ARGUMENT');
  });
});
