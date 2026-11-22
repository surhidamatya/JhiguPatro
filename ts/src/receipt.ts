/**
 * Receipt and invoice model, validation and totals (guide section 12, R-1, R-2,
 * R-10). No rendering. Money is integer paisa (see `Npr`); quantity is an
 * integer in thousandths (1.5 is 1500).
 *
 * Order of calculation (`computeTotals`):
 *  1. line amount = qty * unit price / 1000, rounded half away from zero, per line
 *  2. gross = sum of line amounts
 *  3. discount (amount, or basis points of gross rounded half away from zero)
 *  4. VAT on the discounted amount:
 *       none       taxable = discounted, VAT 0, total = discounted
 *       exclusive  VAT = taxable * rate, total = taxable + VAT
 *       inclusive  taxable = discounted / (1 + rate) rounded, VAT = discounted - taxable
 *  5. balance = total - paid; negative balance sets `overpaid`
 *
 * Import from `jhigu-patro-utils-ts/receipt`.
 */
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';
import { Npr, vatExclusive, vatInclusive } from './money.js';
import { NepaliDate } from './nepaliDate.js';
import type { NepaliDateFields } from './types.js';

export type ReceiptKind = 'invoice' | 'receipt' | 'quotation' | 'creditNote';
export type VatMode = 'none' | 'exclusive' | 'inclusive';
export type ReceiptStamp = 'paid' | 'cancelled';
export type ReceiptLanguage = 'ne' | 'en' | 'bilingual';
export type PageSize = 'a4' | 'a5' | 'roll80';

export interface Business {
  name: string;
  address?: string;
  pan?: string;
  vat?: string;
  phone?: string;
}

export interface Party {
  name: string;
  address?: string;
  pan?: string;
  phone?: string;
}

export interface ReceiptLine {
  description: string;
  /** Quantity in thousandths: 1.5 is 1500. Positive integer. */
  qtyMilli: number;
  unit?: string;
  unitPrice: Npr;
}

export type Discount =
  | { type: 'amount'; amount: Npr }
  | { type: 'percent'; basisPoints: number };

export interface ReceiptDocument {
  kind: ReceiptKind;
  number: string;
  /** BS dates; a `NepaliDate` fits. */
  issueDate: NepaliDateFields;
  dueDate?: NepaliDateFields;
  business: Business;
  customer: Party;
  lines: readonly ReceiptLine[];
  discount?: Discount;
  vatMode: VatMode;
  /** Default 1300 (13%). */
  vatBasisPoints?: number;
  paid: Npr;
  notes?: string;
  stamp?: ReceiptStamp;
  language: ReceiptLanguage;
  pageSize: PageSize;
}

export type ReceiptErrorCode =
  | 'EMPTY_NUMBER'
  | 'NO_LINES'
  | 'EMPTY_DESCRIPTION'
  | 'BAD_QUANTITY'
  | 'BAD_UNIT_PRICE'
  | 'BAD_DISCOUNT'
  | 'BAD_VAT_RATE'
  | 'BAD_PAID'
  | 'DUE_BEFORE_ISSUE';

const MESSAGE_KEY = {
  EMPTY_NUMBER: 'emptyNumber',
  NO_LINES: 'noLines',
  EMPTY_DESCRIPTION: 'emptyDescription',
  BAD_QUANTITY: 'badQuantity',
  BAD_UNIT_PRICE: 'badUnitPrice',
  BAD_DISCOUNT: 'badDiscount',
  BAD_VAT_RATE: 'badVatRate',
  BAD_PAID: 'badPaid',
  DUE_BEFORE_ISSUE: 'dueBeforeIssue',
} as const;

/** One validation problem. `line` is the 0-based line index for line problems. */
export interface ReceiptIssue {
  code: ReceiptErrorCode;
  line?: number;
}

/** Typed receipt error. `message` is English; use `localized()` for ne. */
export class ReceiptError extends Error {
  readonly code: ReceiptErrorCode;
  readonly line?: number;

  constructor(issue: ReceiptIssue) {
    super(getStrings('en').receipt[MESSAGE_KEY[issue.code]]);
    this.name = 'ReceiptError';
    this.code = issue.code;
    this.line = issue.line;
  }

  localized(language: Language): string {
    return getStrings(language).receipt[MESSAGE_KEY[this.code]];
  }
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const lineOk = (l: ReceiptLine) => isInt(l.qtyMilli) && l.qtyMilli >= 1 && !l.unitPrice.isNegative();

/** Line amount: `qtyMilli * unitPrice / 1000`, half away from zero. */
export function lineAmount(line: ReceiptLine): Npr {
  return line.unitPrice.dividedBy(1000, line.qtyMilli);
}

/**
 * All problems in a document, in a fixed order: number, no lines, each line
 * (description, quantity, unit price), discount, VAT rate, paid, due date.
 * An empty list means `computeTotals` throws no ReceiptError (a sum that is
 * too large still throws MoneyError OUT_OF_RANGE). A discount amount is
 * compared with the gross of the valid lines only.
 */
export function validateReceipt(doc: ReceiptDocument): ReceiptIssue[] {
  const issues: ReceiptIssue[] = [];
  if (doc.number.trim() === '') issues.push({ code: 'EMPTY_NUMBER' });
  if (doc.lines.length === 0) issues.push({ code: 'NO_LINES' });
  doc.lines.forEach((l, line) => {
    if (l.description.trim() === '') issues.push({ code: 'EMPTY_DESCRIPTION', line });
    if (!isInt(l.qtyMilli) || l.qtyMilli < 1) issues.push({ code: 'BAD_QUANTITY', line });
    if (l.unitPrice.isNegative()) issues.push({ code: 'BAD_UNIT_PRICE', line });
  });
  const d = doc.discount;
  if (d) {
    if (d.type === 'percent') {
      if (!isInt(d.basisPoints) || d.basisPoints < 0 || d.basisPoints > 10000) issues.push({ code: 'BAD_DISCOUNT' });
    } else {
      const gross = doc.lines.filter(lineOk).reduce((a, l) => a.plus(lineAmount(l)), Npr.ZERO);
      if (d.amount.isNegative() || d.amount.compareTo(gross) > 0) issues.push({ code: 'BAD_DISCOUNT' });
    }
  }
  const bp = doc.vatBasisPoints ?? 1300;
  if (!isInt(bp) || bp < 0 || bp > 10000) issues.push({ code: 'BAD_VAT_RATE' });
  if (doc.paid.isNegative()) issues.push({ code: 'BAD_PAID' });
  if (doc.dueDate && NepaliDate.compare(doc.dueDate, doc.issueDate) < 0) issues.push({ code: 'DUE_BEFORE_ISSUE' });
  return issues;
}

export interface ReceiptTotals {
  /** Amount of each line, in order. */
  lines: Npr[];
  gross: Npr;
  discount: Npr;
  /** Amount VAT is charged on (for `inclusive`, the price without VAT). */
  taxable: Npr;
  vat: Npr;
  total: Npr;
  paid: Npr;
  /** `total - paid`; negative when overpaid. */
  balance: Npr;
  overpaid: boolean;
}

/**
 * Totals for a document. Throws ReceiptError (the first issue of
 * `validateReceipt`) for an invalid document, and MoneyError OUT_OF_RANGE if a
 * sum is too large.
 */
export function computeTotals(doc: ReceiptDocument): ReceiptTotals {
  const issues = validateReceipt(doc);
  if (issues.length) throw new ReceiptError(issues[0]);

  const lines = doc.lines.map(lineAmount);
  const gross = lines.reduce((a, b) => a.plus(b), Npr.ZERO);
  const d = doc.discount;
  const discount = !d ? Npr.ZERO : d.type === 'amount' ? d.amount : gross.percent(d.basisPoints);
  const after = gross.minus(discount);
  const bp = doc.vatBasisPoints ?? 1300;

  let taxable: Npr, vat: Npr, total: Npr;
  if (doc.vatMode === 'none') {
    taxable = after; vat = Npr.ZERO; total = after;
  } else if (doc.vatMode === 'exclusive') {
    ({ subtotal: taxable, vat, total } = vatExclusive(after, bp));
  } else {
    ({ subtotal: taxable, vat, total } = vatInclusive(after, bp));
  }
  const balance = total.minus(doc.paid);
  return { lines, gross, discount, taxable, vat, total, paid: doc.paid, balance, overpaid: balance.isNegative() };
}
