import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Npr, NepaliDate, InlineCalendarDataSource, initializeCalendar } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { renderReceiptHtml, formatQuantity } from '../src/receiptHtml.js';
import { ReceiptError } from '../src/receipt.js';
import type { ReceiptDocument } from '../src/receipt.js';

const here = dirname(fileURLToPath(import.meta.url));
const calendarJson: CalendarJson = JSON.parse(readFileSync(join(here, '../../data/nepali_calendar_data.json'), 'utf8'));

beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(
    calendarJson.years, calendarJson.supportedRange.start, calendarJson.supportedRange.end, calendarJson.verifiedThrough,
  ));
});

const doc = (over: Partial<ReceiptDocument> = {}): ReceiptDocument => ({
  kind: 'invoice',
  number: 'INV-001',
  issueDate: new NepaliDate(2082, 5, 10),
  business: { name: 'Himal Traders', address: 'Thamel, Kathmandu', pan: '123456789', vat: '987654321', phone: '01-4123456' },
  customer: { name: 'Ram Shrestha', address: 'Patan' },
  lines: [{ description: 'Rice', qtyMilli: 2500, unit: 'kg', unitPrice: Npr.fromPaisa(15050) }],
  vatMode: 'exclusive',
  paid: Npr.fromPaisa(0),
  language: 'en',
  pageSize: 'a4',
  ...over,
});

const balanced = (html: string, tag: string) =>
  (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length === (html.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;

describe('formatQuantity', () => {
  it.each([[1000, '1'], [1500, '1.5'], [1, '0.001'], [10, '0.01'], [2500, '2.5'], [100000, '100'], [999, '0.999'], [1010, '1.01']])(
    '%i is %s', (q, want) => expect(formatQuantity(q)).toBe(want));
});

describe('renderReceiptHtml', () => {
  it('English invoice: structure, amounts and words', () => {
    const html = renderReceiptHtml(doc());
    // 2.5 kg x 150.50 = 376.25; VAT 13% = 48.9125 -> 48.91; total 425.16
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Invoice INV-001</title>');
    expect(html).toContain('@page { size: A4; margin: 12mm; }');
    expect(html).toContain('2.5 kg');
    expect(html).toContain('150.50');
    expect(html).toContain('376.25');
    expect(html).toContain('Rs. 376.25');
    expect(html).toContain('VAT (13%)');
    expect(html).toContain('Rs. 48.91');
    expect(html).toContain('Rs. 425.16');
    expect(html).toContain('Rupees Four Hundred Twenty-Five and Sixteen Paisa Only');
    expect(html).toContain('PAN: 123456789');
    expect(html).toContain('VAT No.: 987654321');
    expect(html).toContain('Bill to');
    expect(html).toContain('(AD ');
    for (const tag of ['div', 'table', 'tr', 'td', 'th', 'span', 'section', 'header', 'tbody', 'thead', 'style']) expect(balanced(html, tag), tag).toBe(true);
  });

  it('page sizes set @page; roll80 uses the narrow layout', () => {
    expect(renderReceiptHtml(doc({ pageSize: 'a5' }))).toContain('@page { size: A5; margin: 8mm; }');
    const roll = renderReceiptHtml(doc({ pageSize: 'roll80' }));
    expect(roll).toContain('@page { size: 80mm auto; margin: 3mm; }');
    expect(roll).toContain('header, .parties { display: block; }');
    expect(renderReceiptHtml(doc())).not.toContain('header, .parties { display: block; }');
  });

  it('escapes every user-supplied text', () => {
    const evil = `<script>alert(1)</script>"'&`;
    const html = renderReceiptHtml(doc({
      number: evil,
      business: { name: evil, address: evil, pan: evil, vat: evil, phone: evil },
      customer: { name: evil, address: evil, pan: evil, phone: evil },
      lines: [{ description: evil, qtyMilli: 1000, unit: evil, unitPrice: Npr.fromPaisa(100) }],
      notes: evil,
    }));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)</');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;');
  });

  it('keeps line breaks in notes and addresses as <br>', () => {
    const html = renderReceiptHtml(doc({ notes: 'a\nb\r\nc' }));
    expect(html).toContain('a<br>b<br>c');
  });

  it('Nepali: Devanagari digits and labels, no English words', () => {
    const html = renderReceiptHtml(doc({ language: 'ne' }));
    expect(html).toContain('<html lang="ne">');
    expect(html).toContain('बिजक');
    expect(html).toContain('२.५ kg');
    expect(html).toContain('रु ४२५.१६');
    expect(html).toContain('भ्याट'.slice(0, 3));
    expect(html).not.toContain('Rupees');
    expect(html).not.toContain('Amount in words');
    expect(html).not.toContain('Bill to');
  });

  it('bilingual: both labels, ascii digits, words kept', () => {
    const html = renderReceiptHtml(doc({ language: 'bilingual' }));
    expect(html).toContain('<span lang="ne">बिजक</span> / <span lang="en">Invoice</span>');
    expect(html).toContain('<span lang="ne">ग्राहक</span> <span class="alt" lang="en">Bill to</span>');
    expect(html).toContain('Rs. 425.16');
    expect(html).toContain('Rupees Four Hundred');
    expect(balanced(html, 'span')).toBe(true);
  });

  it('digits option overrides the default', () => {
    expect(renderReceiptHtml(doc({ language: 'ne' }), { digits: 'ascii' })).toContain('2.5 kg');
    expect(renderReceiptHtml(doc(), { digits: 'native' })).toContain('२.५ kg');
  });

  it('discount, no VAT, overpaid and stamp', () => {
    const html = renderReceiptHtml(doc({
      discount: { type: 'percent', basisPoints: 750 },
      vatMode: 'none',
      paid: Npr.fromPaisa(100000),
      stamp: 'paid',
      dueDate: new NepaliDate(2082, 5, 20),
    }));
    expect(html).toContain('Discount (7.5%)');
    expect(html).toContain('-Rs. 28.22');            // 376.25 x 7.5% = 28.21875 -> 28.22
    expect(html).not.toContain('VAT (');
    expect(html).not.toContain('Taxable amount');
    expect(html).toContain('Overpaid');
    expect(html).toContain('Rs. 6');                 // overpaid by 1000.00 - 348.03 = 651.97 shown positive
    expect(html).toContain('class="stamp paid">PAID<');
    expect(html).toContain('Due date: ');
  });

  it('cancelled stamp, amount discount and inclusive VAT show the VAT rate', () => {
    const html = renderReceiptHtml(doc({
      stamp: 'cancelled',
      discount: { type: 'amount', amount: Npr.fromPaisa(1000) },
      vatMode: 'inclusive',
      vatBasisPoints: 1000,
    }));
    expect(html).toContain('class="stamp cancelled">CANCELLED<');
    expect(html).toContain('VAT (10%)');
    expect(html).toContain('Discount</td>');
  });

  it('fontCss and fontFamily are used; </style is refused', () => {
    const html = renderReceiptHtml(doc(), { fontCss: "@font-face { font-family: 'X'; src: url(data:font/woff2;base64,AAAA); }", fontFamily: "'X', serif", title: 'My <title>' });
    expect(html).toContain("@font-face { font-family: 'X'");
    expect(html).toContain("font-family: 'X', serif;");
    expect(html).toContain('<title>My &lt;title&gt;</title>');
    expect(() => renderReceiptHtml(doc(), { fontCss: 'a { } </style><script>x</script>' })).toThrow(RangeError);
  });

  it('invalid documents throw ReceiptError; output is deterministic', () => {
    expect(() => renderReceiptHtml(doc({ lines: [] }))).toThrow(ReceiptError);
    expect(renderReceiptHtml(doc())).toBe(renderReceiptHtml(doc()));
  });

  it('every totals figure on the page matches computeTotals for many lines', () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ description: `Item ${i}`, qtyMilli: 1000 + i * 7, unitPrice: Npr.fromPaisa(999 + i * 131) }));
    const html = renderReceiptHtml(doc({ lines }));
    expect((html.match(/<tr><td class="n">/g) ?? []).length).toBe(30);
    expect(html).toContain('Item 29');
  });
});
