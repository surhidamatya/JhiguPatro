import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PanchangDataSource } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const v = read('../../testdata/tithi.json');

const load = (...years: number[]) => {
  const p = new PanchangDataSource();
  for (const y of years) p.addYear(read(`../../data/${y}_tithi.json`));
  return p;
};

/** 64-bit FNV-1a over UTF-8 bytes, as lowercase hex. */
function fnv1a64(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(text)) {
    h ^= BigInt(b);
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return h.toString(16).padStart(16, '0');
}

const label = (t: { tithiNumber: number; paksha: string } | null) => (t ? `${t.tithiNumber}${t.paksha === 'शुक्ल' ? 'S' : 'K'}` : '-');

describe('PanchangDataSource', () => {
  it('has the same fingerprint as the Python model: the tithi at four minutes of every day of 2081 and 2082', () => {
    const p = load(...(v.years as number[]));
    const lines: string[] = [];
    for (const y of v.years as number[]) {
      const file = read(`../../data/${y}_tithi.json`)[0];
      for (const m of file.months) {
        for (const d of m.days) {
          lines.push(`${y}-${m.month}-${d.bsDay} ` + (v.minutes as number[]).map(min => label(p.tithiAt(y, m.month, d.bsDay, min))).join(' '));
        }
      }
    }
    expect(lines).toHaveLength(v.count);
    expect(lines[0]).toBe(v.first);
    expect(lines[lines.length - 1]).toBe(v.last);
    for (const c of v.checkpoints) expect(lines[c.index], `line ${c.index}`).toBe(c.line);
    expect(fnv1a64(lines.map(l => `${l}\n`).join(''))).toBe(v.fnv1a64);
  });

  it('answers the single lookups of the shared vectors, including edges and years that are not loaded', () => {
    const p = load(...(v.years as number[]));
    for (const q of v.probes) {
      const got = p.getDay(q.year, q.month, q.day) ? label(p.tithiAt(q.year, q.month, q.day, q.minute)) : null;
      expect(got, JSON.stringify(q)).toBe(q.tithi);
    }
  });

  it('keeps several years at once, and tells which are loaded', () => {
    const p = load(2081, 2082);
    expect(p.loadedYears).toEqual([2081, 2082]);
    expect(p.loadedYear).toBe(2082);
    expect(p.getDay(2081, 1, 1)?.adDate).toBe('2024-04-13');
    expect(p.getDay(2082, 1, 1)?.adDate).toBe('2025-04-14');
    expect(p.getDay(2083, 1, 1)).toBeNull();
    expect(p.tithiAt(2083, 1, 1, 0)).toBeNull();
    expect(p.sunriseTithi(2083, 1, 1)).toBeNull();
  });

  it('lists the loaded years ascending whatever the order they were loaded in', () => {
    expect(load(2082, 2081).loadedYears).toEqual([2081, 2082]);
  });

  it('takes the file as an array of one year or as the year object, and a second load of a year replaces it', () => {
    const file = read('../../data/2082_tithi.json');
    const a = new PanchangDataSource();
    a.addYear(file[0]);
    const b = new PanchangDataSource();
    b.addYear(file);
    expect(a.sunriseTithi(2082, 1, 1)).toEqual(b.sunriseTithi(2082, 1, 1));
    const edited = { year: 2082, months: [{ month: 1, name: 'Baisakh', days: [{ bsDay: 1, adDate: '2025-04-14', tithiSegments: [] }] }] };
    a.addYear(edited);
    expect(a.sunriseTithi(2082, 1, 1)).toBeNull();
    expect(a.getDay(2082, 1, 2)).toBeNull();
    expect(a.loadedYears).toEqual([2082]);
  });

  it('is empty until something is loaded', () => {
    const p = new PanchangDataSource();
    expect(p.loadedYear).toBeNull();
    expect(p.loadedYears).toEqual([]);
    expect(p.getDay(2082, 1, 1)).toBeNull();
  });

  it('sunrise is minute 375: a segment that starts at 375 counts, one that ends at 375 does not', () => {
    const p = new PanchangDataSource();
    p.addYear({
      year: 2090,
      months: [{
        month: 1, name: 'Baisakh', days: [
          { bsDay: 1, adDate: '2033-04-14', tithiSegments: [
            { tithiNumber: 3, tithiName: 'तृतीया', paksha: 'शुक्ल', startMinute: 0, endMinute: 375 },
            { tithiNumber: 4, tithiName: 'चतुर्थी', paksha: 'शुक्ल', startMinute: 375, endMinute: 1440 }] },
          { bsDay: 3, adDate: '2033-04-16', tithiSegments: [
            { tithiNumber: 7, tithiName: 'सप्तमी', paksha: 'शुक्ल', startMinute: 0, endMinute: 376 },
            { tithiNumber: 8, tithiName: 'अष्टमी', paksha: 'शुक्ल', startMinute: 376, endMinute: 1440 }] },
          { bsDay: 2, adDate: '2033-04-15', tithiSegments: [
            { tithiNumber: 5, tithiName: 'पञ्चमी', paksha: 'शुक्ल', startMinute: 0, endMinute: 100 },
            { tithiNumber: 6, tithiName: 'षष्ठी', paksha: 'शुक्ल', startMinute: 100, endMinute: 200 }] },
        ],
      }],
    });
    expect(p.sunriseTithi(2090, 1, 1)?.tithiNumber).toBe(4);
    expect(p.tithiAt(2090, 1, 1, 374)?.tithiNumber).toBe(3);
    // No segment covers sunrise: the first one stands in.
    expect(p.sunriseTithi(2090, 1, 2)?.tithiNumber).toBe(5);
    expect(p.tithiAt(2090, 1, 2, 500)).toBeNull();
    // 375 is still inside a segment that ends at 376.
    expect(p.sunriseTithi(2090, 1, 3)?.tithiNumber).toBe(7);
  });

  it('load() fetches the file and adds the year; a failed fetch says where and why', async () => {
    const orig = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: string) => url.endsWith('ok.json')
        ? { ok: true, json: async () => read('../../data/2082_tithi.json') }
        : { ok: false, status: 404, statusText: 'Not Found' }) as unknown as typeof fetch;
      const p = new PanchangDataSource();
      await p.load('/ok.json');
      expect(p.loadedYear).toBe(2082);
      await expect(p.load('/missing.json')).rejects.toThrow('Failed to load panchang data from /missing.json: 404 Not Found');
      expect(p.loadedYears).toEqual([2082]);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
