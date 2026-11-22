import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Npr, MoneyError, MAX_PAISA, numberToWords, amountInWords,
} from '../src/index.js';
import { nepaliNumberWords, nepaliNumberReview, nepaliScales } from '../src/generated/nepaliNumbers.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const v = read('../../testdata/money-words-ne.json');
const table = read('../../data/nepali-numbers.json');
const p = (n: number) => Npr.fromPaisa(n);
function code(fn: () => unknown): string {
  try { fn(); } catch (e) { expect(e).toBeInstanceOf(MoneyError); return (e as MoneyError).code; }
  return 'NO_ERROR';
}

describe('Nepali word table (data/nepali-numbers.json)', () => {
  it('has 100 distinct words and the generated copy matches the data file', () => {
    expect(table.words).toHaveLength(100);
    expect(new Set(table.words).size).toBe(100);
    expect([...nepaliNumberWords]).toEqual(table.words);
    expect([...nepaliNumberReview]).toEqual(table.review);
    expect(nepaliScales).toEqual(table.scales);
  });
  it('says it is not native-speaker reviewed, and labels every word', () => {
    expect(table.reviewed).toBe(false);
    expect(table.review).toHaveLength(100);
    for (const r of table.review) expect(['two-sources', 'single-source', 'disputed']).toContain(r);
  });
  it('lists the other spellings only for the disputed words', () => {
    const disputed = table.review.flatMap((r: string, i: number) => (r === 'disputed' ? [String(i)] : []));
    expect(Object.keys(table.variants).sort()).toEqual([...disputed].sort());
    for (const [i, alts] of Object.entries(table.variants) as Array<[string, string[]]>) {
      for (const a of alts) expect(a, `variant of ${i}`).not.toBe(table.words[Number(i)]);
    }
  });
  it('has no space in any word, so a word count is a space count', () => {
    for (const w of nepaliNumberWords) expect(w).not.toContain(' ');
  });
});

describe('numberToWords in Nepali', () => {
  for (const t of v.numbers) it(`${t.in}`, () => expect(numberToWords(t.in, 'ne')).toBe(t.out));
  for (const t of v.fromNepalKit.numbers) it(`nepal-kit: ${t.in}`, () => expect(numberToWords(t.in, 'ne')).toBe(t.out));

  it('every number 1..99 is its own single word', () => {
    for (let n = 1; n < 100; n++) expect(numberToWords(n, 'ne')).toBe(nepaliNumberWords[n]);
  });
  it('is right at the largest amount (checked against a BigInt division)', () => {
    const kharba = Number(BigInt(MAX_PAISA) / 100000000000n);
    expect(numberToWords(MAX_PAISA, 'ne').startsWith(`${numberToWords(kharba, 'ne')} ${nepaliScales.kharba} `)).toBe(true);
  });
  it('rejects negative, fractional and too large numbers', () => {
    expect(code(() => numberToWords(-1, 'ne'))).toBe('INVALID_ARGUMENT');
    expect(code(() => numberToWords(1.5, 'ne'))).toBe('INVALID_ARGUMENT');
    expect(code(() => numberToWords(MAX_PAISA + 1, 'ne'))).toBe('INVALID_ARGUMENT');
  });
  it('English stays the default', () => {
    expect(numberToWords(21)).toBe('twenty-one');
    expect(numberToWords(21, 'en')).toBe('twenty-one');
  });
  it('rejects an unknown language', () => {
    expect(code(() => numberToWords(1, 'fr' as never))).toBe('INVALID_ARGUMENT');
  });
});

describe('amountInWords in Nepali', () => {
  for (const t of v.amount) it(`${t.paisa}`, () => expect(amountInWords(p(t.paisa), { language: 'ne' })).toBe(t.out));
  for (const t of v.fromNepalKit.amount) it(`nepal-kit: ${t.paisa}`, () => expect(amountInWords(p(t.paisa), { language: 'ne' })).toBe(t.out));

  it('Npr.inWords takes the language', () => {
    expect(p(12345).inWords({ language: 'ne' })).toBe(amountInWords(p(12345), { language: 'ne' }));
  });
  it('rupees come after their words, then paisa, then the closing word', () => {
    const s = amountInWords(p(12345), { language: 'ne' });
    expect(s.endsWith(' पैसा मात्र')).toBe(true);
    expect(s.indexOf('रुपैयाँ')).toBeLessThan(s.indexOf('पैसा'));
  });
  it('zero rupees with paisa drops the rupee part; zero is शून्य रुपैयाँ मात्र', () => {
    expect(amountInWords(p(50), { language: 'ne' })).toBe(`${nepaliNumberWords[50]} पैसा मात्र`);
    expect(amountInWords(p(0), { language: 'ne' })).toBe('शून्य रुपैयाँ मात्र');
  });
  it('a negative amount starts with ऋण', () => {
    expect(amountInWords(p(-100), { language: 'ne' })).toBe('ऋण एक रुपैयाँ मात्र');
  });
  it('labels can be replaced, and letterCase does not touch Devanagari', () => {
    expect(amountInWords(p(10150), { language: 'ne', rupeesLabel: 'रु', paisaLabel: 'पै', suffix: '', joiner: 'र', letterCase: 'lower' }))
      .toBe(`${numberToWords(101, 'ne')} रु र ${numberToWords(50, 'ne')} पै`);
    expect(amountInWords(p(100), { language: 'ne', prefix: 'रकम', suffix: '' })).toBe('रकम एक रुपैयाँ');
  });
  it('English output is unchanged by the Nepali options', () => {
    expect(amountInWords(p(12345))).toBe('Rupees One Hundred Twenty-Three and Forty-Five Paisa Only');
    expect(amountInWords(p(12345), { language: 'en', rupeesLabel: 'x' })).toBe(amountInWords(p(12345)));
  });
});
