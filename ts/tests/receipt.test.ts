import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Npr, MoneyError, NepaliDate, InlineCalendarDataSource, initializeCalendar } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { computeTotals, validateReceipt, ReceiptError } from '../src/receipt.js';
import type { ReceiptDocument } from '../src/receipt.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const calendarJson: CalendarJson = read('../../data/nepali_calendar_data.json');
const v = read('../../testdata/receipt.json');

beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(
    calendarJson.years, calendarJson.supportedRange.start, calendarJson.supportedRange.end, calendarJson.verifiedThrough,
  ));
});

function build(c: any): ReceiptDocument {
  const [y, m, d] = c.issue ?? [2082, 5, 10];
  return {
    kind: 'invoice',
    number: c.number ?? 'INV-1',
    issueDate: new NepaliDate(y, m, d),
    dueDate: c.due ? new NepaliDate(c.due[0], c.due[1], c.due[2]) : undefined,
    business: { name: 'Shop' },
    customer: { name: 'Customer' },
    lines: c.lines.map((l: any) => ({ description: l.description, qtyMilli: l.qtyMilli, unitPrice: Npr.fromPaisa(l.unitPaisa) })),
    discount: !c.discount ? undefined
      : c.discount.type === 'amount' ? { type: 'amount', amount: Npr.fromPaisa(c.discount.paisa) }
      : { type: 'percent', basisPoints: c.discount.basisPoints },
    vatMode: c.vatMode,
    vatBasisPoints: c.vatBasisPoints,
    paid: Npr.fromPaisa(c.paidPaisa),
    language: 'en',
    pageSize: 'a4',
  };
}

describe('receipt totals (shared vectors)', () => {
  for (const c of v.totals) {
    it(c.name, () => {
      const t = computeTotals(build(c.doc));
      expect(t.lines.map(n => n.paisa)).toEqual(c.expect.lines);
      for (const k of ['gross', 'discount', 'taxable', 'vat', 'total', 'paid', 'balance'] as const) {
        expect(t[k].paisa, k).toBe(c.expect[k]);
      }
      expect(t.overpaid).toBe(c.expect.overpaid);
      // Parts add up exactly.
      expect(t.gross.minus(t.discount).paisa).toBe(c.doc.vatMode === 'exclusive' ? t.taxable.paisa : t.total.paisa);
    });
  }
});

describe('receipt validation (shared vectors)', () => {
  for (const c of v.invalid) {
    it(c.name, () => {
      const doc = build(c.doc);
      expect(validateReceipt(doc)).toEqual(c.issues);
      if (c.issues.length) {
        try { computeTotals(doc); expect.unreachable('should throw'); }
        catch (e) {
          expect(e).toBeInstanceOf(ReceiptError);
          expect((e as ReceiptError).code).toBe(c.issues[0].code);
          expect((e as ReceiptError).line).toBe(c.issues[0].line);
        }
      } else computeTotals(doc);
    });
  }
});

describe('receipt extras', () => {
  let base: ReceiptDocument;
  beforeAll(() => { base = build({ lines: [{ description: 'x', qtyMilli: 1000, unitPaisa: 100 }], vatMode: 'none', paidPaisa: 0 }); });

  it('non-integer quantity is BAD_QUANTITY', () => {
    const doc = { ...base, lines: [{ ...base.lines[0], qtyMilli: 1500.5 }] };
    expect(validateReceipt(doc)).toEqual([{ code: 'BAD_QUANTITY', line: 0 }]);
    const nan = { ...base, lines: [{ ...base.lines[0], qtyMilli: NaN }] };
    expect(validateReceipt(nan)).toEqual([{ code: 'BAD_QUANTITY', line: 0 }]);
  });

  it('messages localise', () => {
    const e = new ReceiptError({ code: 'NO_LINES' });
    expect(e.message).toBe('At least one line is required.');
    expect(e.localized('ne')).toContain('लाइन');
  });

  it('sum overflow is a MoneyError, not a wrong total', () => {
    const big = Npr.fromPaisa(Number.MAX_SAFE_INTEGER);
    const doc = { ...base, lines: [{ ...base.lines[0], unitPrice: big }, { ...base.lines[0], unitPrice: big }] };
    expect(() => computeTotals(doc)).toThrow(MoneyError);
  });

  it('does not mutate the document', () => {
    const before = JSON.stringify(base);
    computeTotals(base);
    expect(JSON.stringify(base)).toBe(before);
  });
});
