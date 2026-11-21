# Jhigu Patro Kit: usage guide

Bikram Sambat (BS) dates, Nepali money, phone numbers, addresses, receipts and SMS reminders, in TypeScript/JavaScript and Dart, with headless state machines and web components on top.

The JavaScript samples below marked `js test` are run by the test suite (`ts/tests/docs.test.ts`), so they are known to work. In them, a line ending in `// => value` is an assertion. Dart samples and HTML samples are not run (the Dart library has its own tests that read the same shared vectors as the TypeScript tests).

Every sample imports from the package name `jhigu-patro-utils-ts`. Pure-logic modules that are not needed by everyone are separate entry points (`jhigu-patro-utils-ts/address`, `/sms`, and so on) so bundlers only include what you import.

- [Setup](#setup)
- [Dates](#dates)
- [Money](#money)
- [Phone numbers](#phone-numbers)
- [Addresses](#addresses)
- [Receipts and invoices](#receipts-and-invoices)
- [SMS reminders](#sms-reminders)
- [Headless pickers and inputs](#headless-pickers-and-inputs)
- [Web components](#web-components)
- [Dart](#dart)
- [Accuracy and limits](#accuracy-and-limits)

## Setup

The calendar data (BS 2000 to 2100) is shared JSON in `data/nepali_calendar_data.json`. Load it once at start-up. Anything that converts or validates dates needs this; money, phone and SMS templates do not.

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

// Node: read the file yourself. (Adjust the path for your project.)
const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));
```

In a browser, serve the JSON as a static file and use `JsonCalendarDataSource`:

```js
import { JsonCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

const source = new JsonCalendarDataSource();
await source.initialize('/nepali_calendar_data.json');
initializeCalendar(source);
```

Years after `verifiedThrough` (2083) come from the data file but are not checked against an official calendar; see [Accuracy and limits](#accuracy-and-limits).

## Dates

`NepaliDate` is an immutable BS date. Arithmetic uses whole day numbers, never local `Date` objects, so the machine's time zone cannot change a result.

```js test
import { NepaliDate } from 'jhigu-patro-utils-ts';

const d = new NepaliDate(2082, 5, 10);
d.toString(); // => '2082-05-10'
d.dayNumber(); // => 20326
d.daysInMonth; // => 31
d.addDays(25).toString(); // => '2082-06-04'
d.addMonths(1).toString(); // => '2082-06-10'
d.endOfMonth().toString(); // => '2082-05-31'
d.isBefore({ year: 2082, month: 6, day: 1 }); // => true
NepaliDate.isValid(2082, 5, 32); // => false
NepaliDate.fromAD(new Date(2025, 7, 26)).toString(); // => '2082-05-10'
```

An invalid date throws `JhiguError` with a stable `code` (`INVALID_DATE`, `OUT_OF_RANGE`, `PARSE_ERROR`, ...):

```js test
import { NepaliDate, JhiguError } from 'jhigu-patro-utils-ts';

let code;
try { new NepaliDate(2082, 5, 32); } catch (e) { code = e instanceof JhiguError && e.code; }
code; // => 'INVALID_DATE'
```

### Formatting

Tokens: `YYYY YY MMMM MMM MM M dddd ddd DD D`; text in `[brackets]` is literal. Nepali output uses Devanagari digits unless you pass `{ digits: 'ascii' }`.

```js test
import { formatDate, formatPreset, formatAd } from 'jhigu-patro-utils-ts';

const date = { year: 2082, month: 5, day: 10 };
formatDate(date, 'D MMMM YYYY'); // => '10 Bhadra 2082'
formatDate(date, 'dddd, D MMMM YYYY', 'ne'); // => 'मंगलबार, १० भदौ २०८२'
formatDate(date, 'YYYY-MM-DD', 'ne', { digits: 'ascii' }); // => '2082-05-10'
formatPreset(date, 'iso'); // => '2082-05-10'
formatAd(new Date(2025, 7, 26), 'D MMM YYYY'); // => '26 Aug 2025'
```

### Parsing and fiscal year

```js test
import { parseNepaliDate, fiscalYear } from 'jhigu-patro-utils-ts';

parseNepaliDate('2082-05-10'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('२०८२/०५/१०'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('10 Bhadra 2082'); // => { year: 2082, month: 5, day: 10 }
fiscalYear({ year: 2082, month: 5, day: 10 }).code; // => '2082/83'
fiscalYear({ year: 2082, month: 2, day: 1 }).code; // => '2081/82'
```

### Month grid

`getMonthGrid` returns rows of seven cells with the BS date, the AD date and flags (in the month, today, weekend, events). It is what the calendar widgets draw.

```js test
import { getMonthGrid } from 'jhigu-patro-utils-ts';

const rows = getMonthGrid(2082, 5, { weekStartsOn: 0, today: { year: 2082, month: 5, day: 10 } });
rows.length; // => 5
rows[0][0].bs.toString(); // => '2082-05-01'
rows[0][0].ad.getDate(); // => 17
rows.flat().filter(c => c.inMonth).length; // => 31
rows.flat().find(c => c.isToday).bs.toString(); // => '2082-05-10'
```

## Money

`Npr` holds integer paisa, never a float. Rounding is half away from zero. The largest amount is 2^53 - 1 paisa; larger results throw `MoneyError`.

```js test
import { Npr, vatExclusive, vatInclusive, amountInWords, groupLakh } from 'jhigu-patro-utils-ts';

const price = Npr.fromRupees(1234567.5);
price.paisa; // => 123456750
price.format({ symbol: 'Rs.' }); // => 'Rs. 12,34,567.50'
price.format({ devanagari: true }); // => '१२,३४,५६७.५०'
groupLakh('12345678'); // => '1,23,45,678'

Npr.parse('1,500.25').paisa; // => 150025
Npr.fromPaisa(10000).percent(1300).paisa; // => 1300
Npr.fromRupees(100).allocate([1, 1, 1]).map(n => n.paisa); // => [3334, 3333, 3333]

vatExclusive(Npr.fromRupees(1000)).total.paisa; // => 113000
vatInclusive(Npr.fromRupees(1130)).subtotal.paisa; // => 100000
amountInWords(Npr.fromPaisa(12345)); // => 'Rupees One Hundred Twenty-Three and Forty-Five Paisa Only'
```

Amount in words is English only for now.

## Phone numbers

`parsePhone` accepts mobile and landline numbers with or without `+977`, spaces and dashes, and Devanagari digits. It throws `PhoneError` with a code and a message you can show in either language.

```js test
import { parsePhone, isValidPhone, PhoneError } from 'jhigu-patro-utils-ts';

const p = parsePhone('+977 984-1234567');
p.e164; // => '+9779841234567'
p.national; // => '984-1234567'
p.type; // => 'mobile'
isValidPhone('९८४१२३४५६७'); // => true
isValidPhone('123'); // => false

let err;
try { parsePhone('123'); } catch (e) { err = e; }
err instanceof PhoneError; // => true
```

Carrier names and active/inactive flags in `data/phone-prefixes.json` are best effort, not official.

## Addresses

Provinces, districts and local levels (with their ward counts) are in `jhigu-patro-utils-ts/address`, a separate entry point so the data is only bundled when used.

```js test
import { provinces, districtsOf, searchAddress, formatAddress } from 'jhigu-patro-utils-ts/address';

provinces().length; // => 7
districtsOf(1)[0].en; // => 'Bhojpur'
searchAddress('shadanand')[0].kind; // => 'localLevel'
formatAddress({ localLevelId: 1, ward: 2 }); // => 'Ward 2, Shadanand Municipality, Bhojpur, Koshi Province'
formatAddress({ localLevelId: 1, ward: 2, tole: 'Chowk' }, 'en').startsWith('Chowk, Ward 2'); // => true
```

Province, district and local level names, and ward counts, are not checked against official data (see the notes). Nepali province names are in the old numbered form.

## Receipts and invoices

The model, validation and totals live in `jhigu-patro-utils-ts/receipt`; rendering to HTML is in `jhigu-patro-utils-ts/receipt-html`. Quantity is in thousandths (1.5 is `1500`).

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const doc = {
  kind: 'invoice',
  number: 'INV-001',
  issueDate: new NepaliDate(2082, 5, 10),
  business: { name: 'Himal Traders', pan: '123456789' },
  customer: { name: 'Ram Shrestha' },
  lines: [{ description: 'Rice', qtyMilli: 2500, unit: 'kg', unitPrice: Npr.fromPaisa(15050) }],
  vatMode: 'exclusive',   // 'none' | 'exclusive' | 'inclusive'
  paid: Npr.fromPaisa(0),
  language: 'en',         // 'en' | 'ne' | 'bilingual'
  pageSize: 'a4',         // 'a4' | 'a5' | 'roll80'
};

validateReceipt(doc); // => []
const totals = computeTotals(doc);
totals.gross.paisa; // => 37625
totals.vat.paisa; // => 4891
totals.total.paisa; // => 42516
totals.balance.paisa; // => 42516

const html = renderReceiptHtml(doc);
html.includes('Rs. 425.16'); // => true
html.includes('@page { size: A4; margin: 12mm; }'); // => true
```

Order of calculation: each line is rounded to paisa, then summed; the discount comes off the gross; VAT is taken on the discounted amount. An invalid document throws `ReceiptError`; `validateReceipt` lists every problem instead. Open the HTML in a browser print view, or print it to PDF with a headless browser. Pass `fontCss` to embed a Devanagari font; none is bundled.

## SMS reminders

The library does not talk to any SMS provider. You provide the gateway: implement `SmsGateway`, or wrap your own send function with `CallbackSmsGateway`. Templates, a segment counter and a retrying scheduler are included. All in `jhigu-patro-utils-ts/sms`.

```js test
import {
  CallbackSmsGateway, MockSmsGateway, InMemoryReminderStore, ReminderScheduler,
  renderSmsTemplate, smsSegments, SmsError,
} from 'jhigu-patro-utils-ts/sms';

renderSmsTemplate('appointment', 'en', { name: 'Ram', date: '2082-05-10', time: '9:00', sender: 'Shop' });
// => 'Dear Ram, reminder: your appointment is on 2082-05-10 at 9:00. - Shop'
smsSegments('a'.repeat(161)).segments; // => 2
smsSegments('नमस्ते').encoding; // => 'ucs2'

// Your own provider: return a result, or throw an SmsError to give a code.
const gateway = new CallbackSmsGateway({
  send: async (message) => {
    // call your provider here with message.toE164 and message.text
    return { ok: true, providerId: 'abc123' };
  },
});
(await gateway.send({ toE164: '+9779841234567', text: 'hello' })).ok; // => true

// The scheduler sends what is due. `clock` is injectable for tests.
const mock = new MockSmsGateway();
const store = new InMemoryReminderStore();
await store.save({
  id: 'r1', to: '+9779841234567', templateKey: 'appointment', language: 'en',
  values: { name: 'Ram', date: '2082-05-10', time: '9:00', sender: 'Shop' },
  sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 0,
  status: 'pending', attempts: 0,
});
const nineAmNepal = Date.UTC(2025, 7, 26, 3, 15);   // 09:00 in Nepal (UTC+05:45)
const scheduler = new ReminderScheduler({ gateway: mock, store, clock: () => nineAmNepal });
await scheduler.runOnce(); // => { due: 1, sent: 1, retrying: 0, failed: 0 }
mock.sent.length; // => 1
```

The scheduler only runs while your process runs: for real use call `runOnce()` from a server job. Delivery is at-least-once.

To keep reminders across restarts, use the file-backed store (Node only; Dart has the same in `package:jhigu_patro_utils/sms_file_store.dart`):

```js
import { FileReminderStore } from 'jhigu-patro-utils-ts/sms-file-store';

const store = new FileReminderStore('/var/lib/myapp/reminders.json');
const scheduler = new ReminderScheduler({ gateway, store });
setInterval(() => scheduler.runOnce(), 60_000);
```

It is one JSON file shared by the TypeScript and Dart stores. Each write goes to a temporary file and is renamed over the real one, so a crash does not leave a torn file; calls in one process run one at a time. It is for **one process only** (no locking: two processes on one file can overwrite each other). A missing file is an empty store; a damaged one throws `SmsStoreError` (`CORRUPT_FILE`, `UNSUPPORTED_VERSION`, `INVALID_REMINDER`, `READ_FAILED`, `WRITE_FAILED`) and is never reset. The file holds phone numbers: the TypeScript store creates it as owner-only (0600); the Dart one cannot set permissions, so keep it in a private folder. Errors from a gateway use the codes `AUTH`, `BALANCE`, `BAD_NUMBER`, `RATE_LIMIT`, `SERVER`, `NETWORK`, `UNKNOWN`.

## React

`react/` is a small package of React components for the web components above (`jhigu-patro-react`, in this repo it depends on `ts/` by path): `JhiguDatePicker`, `JhiguDateRangePicker`, `JhiguCalendar`, `JhiguAddressSelect`, `JhiguMoneyInput` and `JhiguPhoneInput`.

```jsx
<JhiguDatePicker name="dob" language="ne" value={dob} onChange={d => setDob(d.bs)} />
<JhiguMoneyInput name="amount" symbol="Rs." label="Amount" onChange={d => console.log(d.paisa)} />
```

Load the calendar data once first. A prop is written to the element only when it changes, so a rerender does not reset what the user typed; the fields post in a normal `<form>`. It is client only (a server render has an empty wrapper). See `react/README.md` for the props, what was checked (React 19 in Chromium, the tests on React 18 too) and what was not.

## Headless pickers and inputs

Each widget has a framework-free state machine: `getState()`, `subscribe(listener)`, and `actions`. They never touch the DOM, so you can drive them from React, Vue, a terminal or a test. Entry points: `jhigu-patro-utils-ts/date-picker`, `/range-picker`, `/address-picker`, `/money-input`, `/phone-input`.

```js test
import { createDatePicker } from 'jhigu-patro-utils-ts/date-picker';
import { createRangePicker } from 'jhigu-patro-utils-ts/range-picker';
import { createAddressPicker } from 'jhigu-patro-utils-ts/address-picker';
import { createMoneyInput } from 'jhigu-patro-utils-ts/money-input';
import { createPhoneInput } from 'jhigu-patro-utils-ts/phone-input';

const today = { year: 2082, month: 5, day: 10 };

const picker = createDatePicker({ today, language: 'en' });
let renders = 0;
picker.subscribe(() => { renders++; });
picker.getState().title; // => 'Bhadra 2082'
picker.actions.nextMonth();
picker.getState().title; // => 'Ashwin 2082'
picker.actions.select({ year: 2082, month: 6, day: 3 });
picker.getState().value.toString(); // => '2082-06-03'
renders; // => 2

const range = createRangePicker({ today });
range.actions.select({ year: 2082, month: 5, day: 8 });
range.actions.select({ year: 2082, month: 5, day: 19 });
range.getState().complete; // => true
range.getState().end.toString(); // => '2082-05-19'

const address = createAddressPicker();
address.actions.selectLocalLevel(1);                 // fills the province and district too
address.actions.selectWard(2);
address.getState().selection; // => { provinceId: 1, districtId: 1, localLevelId: 1, ward: 2 }

const money = createMoneyInput();
money.actions.input('1234567.5');
money.getState().text; // => '12,34,567.5'
money.actions.blur();
money.getState().text; // => '12,34,567.50'

const phone = createPhoneInput();
phone.actions.input('9841234567');
phone.getState().text; // => '984-1234567'
phone.getState().carrier; // => 'NTC'
phone.getState().e164; // => '+9779841234567'
```

Rules that hold for all of them: one notification per state-changing action; no notification when nothing changed; invalid input throws a typed error and leaves the state unchanged. The money and phone inputs also take the caret position, so a UI keeps the caret in place while the text is reformatted.

## Web components

Plain custom elements with shadow DOM, no dependencies, built on the state machines above. Register the ones you use, after the calendar is initialised:

```html
<script type="module">
  import { defineJhiguDatePicker } from 'jhigu-patro-utils-ts/date-picker-element';
  import { defineJhiguDateRangePicker } from 'jhigu-patro-utils-ts/range-picker-element';
  import { defineJhiguCalendar } from 'jhigu-patro-utils-ts/calendar-element';
  import { defineJhiguAddressSelect } from 'jhigu-patro-utils-ts/address-element';
  import { defineJhiguMoneyInput, defineJhiguPhoneInput } from 'jhigu-patro-utils-ts/field-elements';
  // initializeCalendar(...) first, then:
  defineJhiguDatePicker(); defineJhiguDateRangePicker(); defineJhiguCalendar();
  defineJhiguAddressSelect(); defineJhiguMoneyInput(); defineJhiguPhoneInput();
</script>

<form>
  <jhigu-date-picker name="dob" language="ne" popup required></jhigu-date-picker>
  <jhigu-date-range-picker name="stay" popup></jhigu-date-range-picker>
  <jhigu-address-select name="home" language="ne" required></jhigu-address-select>
  <jhigu-money-input name="amount" symbol="Rs." required></jhigu-money-input>
  <jhigu-phone-input name="phone" required></jhigu-phone-input>
</form>
<jhigu-calendar language="ne" marked='{"2082-06-03": ["Laxmi Puja"]}'></jhigu-calendar>
```

- The pickers, address, money and phone elements are form-associated: their value posts with a normal `<form>`, and `required` and form reset work. The calendar is display only.
- Events: `jhiguChange` (date picker, range, address, money, phone), `jhiguSelect` and `jhiguMonthChange` (calendar), `jhiguOpen` and `jhiguClose` (popups). Details are in the header comment of each file under `ts/src/elements/`.
- Theme with CSS variables (`--jhigu-color-primary`, `--jhigu-color-surface`, `--jhigu-color-text`, `--jhigu-color-muted`, `--jhigu-color-holiday`, `--jhigu-color-today`, `--jhigu-radius`, `--jhigu-font-family`, `--jhigu-font-size`), the `theme="light|dark"` attribute, and `::part(...)` selectors. Dark mode follows the system by default.
- Working pages for each element are in `ts/examples/` (build first with `cd ts && npm run build`, then serve `ts/` over HTTP).
- These were tested in one browser engine (Chromium). Screen readers, Safari, Firefox and touch are not verified. There are no React, Vue or Angular wrappers yet.

## Dart

The Dart package (`dart/`) has the same logic and the same results, checked against the same shared test vectors in `testdata/`. Initialise the calendar once, then use it:

```dart
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

// After NepaliCalendar.initialize(InlineCalendarDataSource(...)):
final d = NepaliDate.checked(2082, 5, 10);
d.addDays(25).toIsoString();                  // 2082-06-04
formatDate(d, 'D MMMM YYYY', language: 'ne'); // १० भदौ २०८२
Npr.fromRupees(1234567.5).format(symbol: MoneySymbol.rs); // Rs. 12,34,567.50
parsePhone('9841234567').e164;                // +9779841234567
computeTotals(doc).total;                     // receipt totals, to the paisa
```

Dart has the model, validation and totals for receipts, the SMS gateway interface, templates and scheduler, the headless pickers and inputs, and PDF receipts. Flutter widgets live in a separate package, `flutter/` (see below).

### Flutter widgets

`flutter/` is a Flutter package (`jhigu_patro_flutter`, depends on `dart/` by path) with `JhiguDatePicker`, `JhiguCalendar`, `JhiguRangePicker`, `JhiguMoneyField`, `JhiguPhoneField`, `JhiguAddressPicker`, `JhiguDateField`, `JhiguDateRangeField` and the dialog functions `showJhiguDatePicker` and `showJhiguDateRangePicker`. The date picker is an inline BS date picker built on the same `DatePicker` state machine as the web component:

```dart
JhiguDatePicker(
  value: _date,
  language: 'ne',
  min: NepaliDate.checked(2080, 1, 1),
  onChanged: (d) => setState(() => _date = d),
)
```

`JhiguCalendar` is the display version: marked days with a dot and an events list for the selected day.

```dart
JhiguCalendar(
  events: {'2082-06-03': ['Laxmi Puja']},   // BS date text to titles
  onSelect: (date, titles) => print('$date $titles'),
)
```

`JhiguRangePicker` chooses a start and an end (first tap start, second tap end, hover preview in between):

```dart
JhiguRangePicker(onChanged: (start, end) => print('$start $end'))
```

`JhiguMoneyField` and `JhiguPhoneField` are text fields that format as you type:

```dart
JhiguMoneyField(onChanged: (amount) => print(amount?.paisa))      // 12,34,567.50 -> 123456750
JhiguPhoneField(onChanged: (e164) => print(e164))                 // 984-1234567 -> +9779841234567
```

`JhiguAddressPicker` is the province, district, local level and ward dropdowns:

```dart
JhiguAddressPicker(onChanged: (s) => print(s.selection))   // ids when complete, else null
```

To pick in a dialog or from a form field:

```dart
final date = await showJhiguDatePicker(context: context, initial: _date);   // null if dismissed
JhiguDateField(value: _date, onChanged: (d) => setState(() => _date = d))   // tap to pick, clear button
JhiguDateRangeField(onChanged: (start, end) => print('$start $end'))        // the same for a range
```

Style the pickers with a `JhiguTheme` in `ThemeData.extensions`; anything left null falls back to your `ColorScheme`. There is nothing for React Native. See `flutter/README.md`.

### PDF receipts

PDF output is a separate entry point because it needs the `pdf` package, the only runtime dependency of the Dart package:

```dart
import 'package:jhigu_patro_utils/receipt_pdf.dart';

final result = await buildReceiptPdf(doc);          // A4, A5 or 80 mm roll, from doc.pageSize
File('invoice.pdf').writeAsBytesSync(result.bytes);
for (final w in result.warnings) { print(w); }
```

Latin text and digits are real, selectable PDF text. The PDF library cannot shape Devanagari, so any string that contains it must be drawn as an image by a `DevanagariRenderer` you supply (a ready one for Flutter and one for servers are below). Without one, Nepali labels fall back to English and Devanagari text from the document (names, notes) is replaced by `[?]`, and `result.warnings` says so. Amount in words is English only, so it is left out for `ne` receipts.

For servers and command-line tools there is a ready renderer that calls an external program (`rsvg-convert` by default, which shapes Devanagari correctly). Install it and a Devanagari font such as Noto Sans Devanagari, then:

```dart
import 'package:jhigu_patro_utils/devanagari_command_renderer.dart';

final renderer = CommandDevanagariRenderer(fontFamily: "'Noto Sans Devanagari'");
final result = await buildReceiptPdf(doc, options: ReceiptPdfOptions(renderer: renderer));
```

It uses `dart:io`, so it is not for the web, and no font is bundled. If the program fails, the PDF is still produced, the affected text becomes `[?]` and `result.warnings` says so.

In a Flutter app (all platforms, the web included) use `FlutterDevanagariRenderer` from `jhigu_patro_flutter`, which draws with Flutter's own text engine; bundle a Devanagari font and name it, or it falls back to a platform font (see `flutter/README.md`):

```dart
await buildReceiptPdf(doc, options: ReceiptPdfOptions(renderer: FlutterDevanagariRenderer()));
```

To print or share straight from a Flutter app, use `package:jhigu_patro_flutter/receipt_print.dart` (it needs the `printing` package):

```dart
await printReceipt(doc);    // system print dialog
await shareReceipt(doc);    // share sheet, or a download on the web
```

## Accuracy and limits

- **Calendar data:** BS 2000 to 2100 is in the data file. Years up to 2083 are cross-checked; BS 2062 and 2084 to 2099 are not verified against the official calendar. See `data/CALENDAR_NOTES.md`.
- **Shared vectors** in `testdata/` are mostly hand-derived or produced by independent Python models, not copied from official sources.
- **Nepali text** (month aliases, labels, error messages, SMS templates) is unreviewed by a native speaker. Short Nepali month names are ambiguous.
- **Phone** carrier and active flags, **addresses** (names, ward counts) and **amount in words** (English only) are best effort. Notes: `data/PHONE_NOTES.md`, `data/ADDRESS_NOTES.md`, `data/MONEY_NOTES.md`.
- **Not built:** a Flutter in-app PDF preview, React Native widgets, wrappers for frameworks other than React, Nepali amount in words, a database-backed SMS reminder store, multi-process locking for the file store.
- Design notes per area: `data/DATES_NOTES.md`, `data/PICKER_NOTES.md`, `data/RECEIPT_NOTES.md`, `data/SMS_NOTES.md`, `data/STRINGS_NOTES.md`.
