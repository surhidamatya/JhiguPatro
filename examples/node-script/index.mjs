/**
 * Plain Node script that uses jhigu-patro-utils-ts. Run it with `npm start`.
 * Each section is independent; copy the ones you need.
 */
import { createRequire } from 'node:module';
import {
  // calendar
  initializeCalendar, InlineCalendarDataSource, getDateAccuracy,
  // dates
  NepaliDate, convertADToBS, formatPreset, parseNepaliDate, fiscalYear,
  // money and phone
  Npr, vatExclusive, amountInWords, parsePhone, PhoneError,
  // tithi
  PanchangDataSource,
} from 'jhigu-patro-utils-ts';
import { formatAddress, searchAddress } from 'jhigu-patro-utils-ts/address';
import { renderSmsTemplate, smsSegments } from 'jhigu-patro-utils-ts/sms';
import { computeTotals } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const require = createRequire(import.meta.url);
const heading = text => console.log(`\n== ${text}`);

// ── 1. Load the calendar data, once. Dates need it; money, phone and SMS do not. ──
const calendar = require('jhigu-patro-utils-ts/nepali_calendar_data.json');
initializeCalendar(new InlineCalendarDataSource(
  calendar.years, calendar.supportedRange.start, calendar.supportedRange.end, calendar.verifiedThrough,
));

// ── 2. Dates ──
heading('Dates');
const adDate = new Date(2025, 7, 26); // a plain calendar date; no time zone is involved
const bs = convertADToBS(adDate);
console.log('AD 2025-08-26 is BS', `${bs.year}-${bs.month}-${bs.day}`);
const d = new NepaliDate(2082, 5, 10);
console.log('dual format:      ', formatPreset(d, 'dual', 'en'));
console.log('Nepali, Devanagari:', formatPreset(d, 'full', 'ne'));
console.log('+25 days:         ', d.addDays(25).toString());
const parsed = parseNepaliDate('10 Bhadra 2082'); // plain { year, month, day }
console.log('parsed:           ', `${parsed.year}-${parsed.month}-${parsed.day}`);
console.log('fiscal year:      ', fiscalYear(d).code);
console.log('2082 verified?     ', getDateAccuracy({ year: 2082, month: 5, day: 10 }).verified);
console.log('2090 verified?     ', getDateAccuracy({ year: 2090, month: 1, day: 1 }).verified);

// ── 3. Money: integer paisa, never floats ──
heading('Money');
const price = Npr.fromRupees(1234567.5);
console.log('paisa:   ', price.paisa);
console.log('format:  ', price.format({ symbol: 'Rs.' }));
const vat = vatExclusive(price);
console.log('VAT 13%: ', vat.vat.format({ symbol: 'Rs.' }), '-> total', vat.total.format({ symbol: 'Rs.' }));
console.log('in words:', amountInWords(price));

// ── 4. Phone ──
heading('Phone');
const phone = parsePhone('+977 984-1234567');
console.log(phone.e164, phone.type, phone.carrier);
try {
  parsePhone('98412');
} catch (e) {
  if (e instanceof PhoneError) console.log('rejected:', e.code, '-', e.message);
  else throw e;
}

// ── 5. Address ──
heading('Address');
console.log(formatAddress({ localLevelId: 274, ward: 3 }));
console.log(formatAddress({ localLevelId: 274, ward: 3 }, 'ne'));
console.log('search "bhaktapur":', searchAddress('bhaktapur', { limit: 3 }).map(m => `${m.kind} ${m.id}`).join(', '));

// ── 6. SMS: render a template and count segments (sending needs your own gateway) ──
heading('SMS');
const sms = renderSmsTemplate('appointment', 'en', { name: 'Ram', date: '2082-05-10', time: '9:00', sender: 'Shop' });
console.log(sms);
console.log(smsSegments(sms));

// ── 7. Receipt: totals, then HTML you can print or save as PDF ──
heading('Receipt');
const doc = {
  kind: 'invoice',
  number: 'INV-001',
  issueDate: d,
  business: { name: 'Himal Traders', pan: '123456789' },
  customer: { name: 'Ram Shrestha' },
  lines: [{ description: 'Rice', qtyMilli: 2500, unit: 'kg', unitPrice: Npr.fromPaisa(15050) }],
  vatMode: 'exclusive',
  paid: Npr.fromPaisa(0),
  language: 'en',
  pageSize: 'a4',
};
const totals = computeTotals(doc);
console.log('total:', totals.total.format({ symbol: 'Rs.' }), '| balance:', totals.balance.format({ symbol: 'Rs.' }));
console.log('HTML bytes:', renderReceiptHtml(doc).length);

// ── 8. Tithi (BS 2081 and 2082 only) ──
heading('Tithi');
const panchang = new PanchangDataSource();
panchang.addYear(require('jhigu-patro-utils-ts/2082_tithi.json'));
const t = panchang.sunriseTithi(2082, 1, 1);
console.log('1 Baisakh 2082 at sunrise:', t.tithiName, `(${t.paksha})`);
