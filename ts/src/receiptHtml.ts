/**
 * HTML receipt and invoice template (guide 12.6, R-11). One template, two uses:
 * open it in a browser print view (the browser shapes Devanagari correctly), or
 * print it to PDF with a headless browser on a server. This is not a PDF engine.
 *
 *   const html = renderReceiptHtml(doc, { fontCss });
 *
 * `@page` sets A4, A5 or an 80 mm roll from `doc.pageSize`. Every text value
 * from the document is HTML-escaped. Totals come from `computeTotals`, so an
 * invalid document throws the same `ReceiptError` (and a too-large sum throws
 * `MoneyError`).
 *
 * Fonts: no font file is bundled. To make output identical everywhere, pass
 * `fontCss` holding an `@font-face` rule for Noto Sans Devanagari (for example
 * with a base64 data URL) and a matching `fontFamily`. Without it the page
 * falls back to the reader's installed fonts.
 *
 * Import from `jhigu-patro-utils-ts/receipt-html`.
 */
import { formatPreset } from './dateFormat.js';
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';
import type { Npr } from './money.js';
import { computeTotals } from './receipt.js';
import type { ReceiptDocument, ReceiptKind, ReceiptLanguage } from './receipt.js';

export interface ReceiptHtmlOptions {
  /** CSS to add before the page styles, for example an `@font-face`. Trusted input: it is not escaped. */
  fontCss?: string;
  /** CSS `font-family` value. Default: Noto Sans Devanagari, Noto Sans, then system fonts. */
  fontFamily?: string;
  /** Page `<title>`. Default: document kind and number. */
  title?: string;
  /** `native` shows Devanagari digits. Default: native for `ne`, ascii for `en` and `bilingual`. */
  digits?: 'native' | 'ascii';
}

const KIND_KEY: Record<ReceiptKind, 'invoice' | 'receipt' | 'quotation' | 'creditNote'> = {
  invoice: 'invoice',
  receipt: 'receipt',
  quotation: 'quotation',
  creditNote: 'creditNote',
};

const NE_DIGITS = '०१२३४५६७८९';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Escape, and turn line breaks into `<br>`. */
const escMultiline = (s: string): string => esc(s.trim()).replace(/\r\n|\r|\n/g, '<br>');

const PAGE: Record<ReceiptDocument['pageSize'], string> = {
  a4: '@page { size: A4; margin: 12mm; }',
  a5: '@page { size: A5; margin: 8mm; }',
  roll80: '@page { size: 80mm auto; margin: 3mm; }',
};

/** Quantity from thousandths as decimal text: 1500 is `1.5`, 1 is `0.001`. */
export function formatQuantity(qtyMilli: number): string {
  const whole = Math.floor(qtyMilli / 1000);
  const frac = String(qtyMilli % 1000).padStart(3, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

/** Basis points as percent text: 1300 is `13`, 750 is `7.5`, 5 is `0.05`. */
function percentText(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = String(bp % 100).padStart(2, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

export function renderReceiptHtml(doc: ReceiptDocument, options: ReceiptHtmlOptions = {}): string {
  if (options.fontCss && /<\/style/i.test(options.fontCss)) {
    throw new RangeError('fontCss must not contain </style');
  }
  const t = computeTotals(doc);

  const lang: ReceiptLanguage = doc.language;
  const primary: Language = lang === 'ne' ? 'ne' : 'en';
  const native = (options.digits ?? (lang === 'ne' ? 'native' : 'ascii')) === 'native';
  const digits = (s: string) => (native ? s.replace(/\d/g, d => NE_DIGITS[+d]) : s);
  const money = (n: Npr) => digits(n.format({ decimals: 'always' }));
  const moneyWithSymbol = (n: Npr) => digits(n.format({ decimals: 'always', symbol: lang === 'ne' ? 'रु' : 'Rs.' }));

  const en = getStrings('en').receipt;
  const ne = getStrings('ne').receipt;
  type Key = keyof typeof en;
  /** A label in the document language; both languages when bilingual. */
  const label = (k: Key): string => {
    if (lang === 'en') return esc(en[k]);
    if (lang === 'ne') return esc(ne[k]);
    return `<span lang="ne">${esc(ne[k])}</span> <span class="alt" lang="en">${esc(en[k])}</span>`;
  };
  const plainLabel = (k: Key): string => esc((lang === 'ne' ? ne : en)[k]);

  const dateText = (d: ReceiptDocument['issueDate']) => esc(digits(formatPreset(d, 'dual', primary)));

  const kindKey = KIND_KEY[doc.kind];
  const title = options.title ?? `${(lang === 'ne' ? ne : en)[kindKey]} ${doc.number}`;
  const fontFamily = options.fontFamily ?? "'Noto Sans Devanagari', 'Noto Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

  const meta = (k: Key, value: string | undefined): string =>
    value && value.trim() ? `<div>${plainLabel(k)}: ${esc(value.trim())}</div>` : '';

  const rows = doc.lines
    .map((l, i) => {
      const qty = digits(formatQuantity(l.qtyMilli)) + (l.unit?.trim() ? ` ${esc(l.unit.trim())}` : '');
      return `<tr><td class="n">${digits(String(i + 1))}</td><td class="d">${escMultiline(l.description)}</td>` +
        `<td class="r">${qty}</td><td class="r">${money(l.unitPrice)}</td><td class="r">${money(t.lines[i])}</td></tr>`;
    })
    .join('\n');

  const d = doc.discount;
  const discountSuffix = d && d.type === 'percent' ? ` (${digits(percentText(d.basisPoints))}%)` : '';
  const vatRate = doc.vatBasisPoints ?? 1300;
  const totalRow = (cls: string, k: Key, value: Npr, labelHtml?: string): string =>
    `<tr class="${cls}"><td>${labelHtml ?? label(k)}</td><td class="r">${moneyWithSymbol(value)}</td></tr>`;

  const totals: string[] = [totalRow('', 'subtotal', t.gross)];
  if (!t.discount.isZero()) totals.push(totalRow('', 'discount', t.discount.negate(), `${label('discount')}${discountSuffix}`));
  if (doc.vatMode !== 'none') {
    totals.push(totalRow('', 'taxable', t.taxable));
    totals.push(totalRow('', 'vat', t.vat, `${label('vat')} (${digits(percentText(vatRate))}%)`));
  }
  totals.push(totalRow('grand', 'total', t.total));
  totals.push(totalRow('', 'paid', t.paid));
  totals.push(t.overpaid
    ? totalRow('balance', 'overpaid', t.balance.negate())
    : totalRow('balance', 'balance', t.balance));

  const words = lang !== 'ne' && !t.total.isNegative()
    ? `<p class="words"><strong>${label('amountInWords')}:</strong> ${esc(t.total.inWords())}</p>`
    : '';
  const notes = doc.notes && doc.notes.trim()
    ? `<div class="notes"><strong>${label('notes')}:</strong><div>${escMultiline(doc.notes)}</div></div>`
    : '';
  const stamp = doc.stamp
    ? `<div class="stamp ${doc.stamp}">${esc((lang === 'ne' ? ne : en)[doc.stamp === 'paid' ? 'stampPaid' : 'stampCancelled'])}</div>`
    : '';
  const due = doc.dueDate ? `<div>${plainLabel('dueDate')}: ${dateText(doc.dueDate)}</div>` : '';
  const kindTitle = lang === 'bilingual'
    ? `<span lang="ne">${esc(ne[kindKey])}</span> / <span lang="en">${esc(en[kindKey])}</span>`
    : esc((lang === 'ne' ? ne : en)[kindKey]);

  const css = `
${options.fontCss ?? ''}
${PAGE[doc.pageSize]}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${fontFamily}; color: #111; font-size: 11pt; line-height: 1.4; }
.page { position: relative; padding: 0; }
header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
header h1 { font-size: 16pt; margin: 0 0 2px; }
.title { text-align: right; }
.title h2 { font-size: 15pt; margin: 0 0 2px; text-transform: uppercase; }
.alt { color: #555; font-size: 0.9em; }
.parties { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; }
.items th, .items td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
.items thead { display: table-header-group; background: #eee; }
.items tr { page-break-inside: avoid; break-inside: avoid; }
.n { width: 2.2em; text-align: right; }
.r { text-align: right; white-space: nowrap; }
.totals { width: 55%; margin: 10px 0 0 auto; }
.totals td { padding: 3px 6px; }
.totals .grand td { border-top: 2px solid #111; font-weight: 700; }
.totals .balance td { border-top: 1px solid #111; font-weight: 700; }
.words, .notes { margin: 10px 0 0; }
.signature { margin-top: 36px; display: flex; justify-content: flex-end; }
.signature div { border-top: 1px solid #111; min-width: 160px; padding-top: 4px; text-align: center; }
.stamp { position: absolute; top: 38%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); font-size: 44pt; font-weight: 700; letter-spacing: 4px; border: 5px solid currentColor; padding: 0 18px; opacity: 0.22; pointer-events: none; }
.stamp.paid { color: #0a7a2f; }
.stamp.cancelled { color: #b00020; }
${doc.pageSize === 'roll80' ? `
body { font-size: 9pt; }
header, .parties { display: block; }
.title { text-align: left; margin-top: 6px; }
.items th, .items td { border: 0; border-bottom: 1px dotted #999; padding: 2px 2px; }
.items thead { background: none; }
.totals { width: 100%; }
.stamp { font-size: 26pt; }
` : ''}`.trim();

  const page = `<!doctype html>
<html lang="${primary}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
${css}
</style>
</head>
<body>
<div class="page">
${stamp}
<header>
<div>
<h1>${esc(doc.business.name)}</h1>
${doc.business.address ? `<div>${escMultiline(doc.business.address)}</div>` : ''}
${meta('phone', doc.business.phone)}
${meta('pan', doc.business.pan)}
${meta('vatNo', doc.business.vat)}
</div>
<div class="title">
<h2>${kindTitle}</h2>
<div>${plainLabel('number')} ${esc(doc.number)}</div>
<div>${plainLabel('date')}: ${dateText(doc.issueDate)}</div>
${due}
</div>
</header>
<section class="parties">
<div>
<strong>${label('billTo')}</strong>
<div>${esc(doc.customer.name)}</div>
${doc.customer.address ? `<div>${escMultiline(doc.customer.address)}</div>` : ''}
${meta('phone', doc.customer.phone)}
${meta('pan', doc.customer.pan)}
</div>
</section>
<table class="items">
<thead><tr><th class="n">#</th><th>${label('description')}</th><th class="r">${label('quantity')}</th><th class="r">${label('rate')}</th><th class="r">${label('amount')}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<table class="totals">
${totals.join('\n')}
</table>
${words}
${notes}
<div class="signature"><div>${label('signature')}</div></div>
</div>
</body>
</html>
`;
  return page.replace(/\n{2,}/g, '\n');
}
