# Receipts and invoices

This feature turns a receipt or invoice described as plain data into correct totals, an HTML page you can print, and (in Dart) a PDF file. The model, validation and totals are the same in TypeScript and Dart and use integer paisa only. The HTML template is TypeScript only. The PDF builder is Dart only. The library does not store documents, number them, or talk to any tax system.

## When to use it

- You issue invoices, receipts, quotations or credit notes and want totals that are exact to the paisa.
- You want Nepali or bilingual output with BS dates and the amount in words.
- You want a page that a browser can print (TypeScript), or a PDF file made on a server or inside an app (Dart).

Do not use it as a tax or accounting system. See [Accuracy, limits and known gaps](#accuracy-limits-and-known-gaps).

## Setup

TypeScript entry points:

| Import | Holds |
| --- | --- |
| `jhigu-patro-utils-ts/receipt` | model types, `validateReceipt`, `computeTotals`, `lineAmount`, `ReceiptError` |
| `jhigu-patro-utils-ts/receipt-html` | `renderReceiptHtml`, `formatQuantity` |
| `jhigu-patro-utils-ts` | `Npr` (money), `NepaliDate`, calendar setup |

Issue and due dates are BS dates, so the calendar must be loaded once at start-up (see `docs/USAGE.md`, "Setup"). The totals themselves do not need the calendar. The date check "due before issue" and the dates printed on the page do.

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));
```

Dart: import `package:jhigu_patro_utils/jhigu_patro_utils.dart` for the model, validation and totals. PDF output is a separate import, `package:jhigu_patro_utils/receipt_pdf.dart`, because it needs the `pdf` package. That package is the only runtime dependency of the Dart library. Code that never imports `receipt_pdf.dart` does not compile it, but pub still resolves the package. Initialise the calendar with `NepaliCalendar.initialize(InlineCalendarDataSource(...))` as in `docs/USAGE.md`.

## Quick start (TypeScript)

A document needs `kind`, `number`, `issueDate`, `business`, `customer`, `lines`, `vatMode`, `paid`, `language` and `pageSize`. Quantity is in thousandths (1.5 is `1500`). Prices are `Npr` values (integer paisa).

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const doc = {
  kind: 'invoice',
  number: 'INV-002',
  issueDate: new NepaliDate(2082, 5, 10),
  dueDate: new NepaliDate(2082, 5, 25),
  business: { name: 'Himal Traders', pan: '123456789' },
  customer: { name: 'Ram Shrestha' },
  lines: [
    { description: 'Rice', qtyMilli: 2500, unit: 'kg', unitPrice: Npr.fromPaisa(15050) },
    { description: 'Lentils', qtyMilli: 1500, unit: 'kg', unitPrice: Npr.fromPaisa(33333) },
  ],
  discount: { type: 'percent', basisPoints: 500 },
  vatMode: 'exclusive',
  paid: Npr.fromPaisa(10000),
  language: 'en',
  pageSize: 'a4',
};

validateReceipt(doc); // => []
const totals = computeTotals(doc);
totals.lines.map(l => l.paisa); // => [37625, 50000]
totals.gross.paisa; // => 87625
totals.discount.paisa; // => 4381
totals.taxable.paisa; // => 83244
totals.vat.paisa; // => 10822
totals.total.paisa; // => 94066
totals.balance.paisa; // => 84066
totals.overpaid; // => false

const html = renderReceiptHtml(doc);
Object.assign(globalThis, { doc, totals }); // lets the later blocks of this guide reuse them
html.includes('<title>Invoice INV-002</title>'); // => true
html.includes('Amount in words:</strong> Rupees Nine Hundred Forty and Sixty-Six Paisa Only'); // => true
```

Line 2 above is the point to notice: 1.5 kg at Rs. 333.33 is 49,999.5 paisa, which is rounded to 50,000, and that rounded amount is what is summed.

## Quick start (Dart)

The same document, the same numbers. Dates are `NepaliDate` values, the discount is `Discount.percent(500)`, and the VAT rate is `vatBasisPoints` (default 1300).

```dart
final doc = ReceiptDocument(
  kind: ReceiptKind.invoice,
  number: 'INV-002',
  issueDate: NepaliDate.checked(2082, 5, 10),
  dueDate: NepaliDate.checked(2082, 5, 25),
  business: const Business(name: 'Himal Traders', pan: '123456789'),
  customer: const Party(name: 'Ram Shrestha'),
  lines: [
    ReceiptLine(description: 'Rice', qtyMilli: 2500, unit: 'kg', unitPrice: Npr.fromPaisa(15050)),
    ReceiptLine(description: 'Lentils', qtyMilli: 1500, unit: 'kg', unitPrice: Npr.fromPaisa(33333)),
  ],
  discount: const Discount.percent(500),
  vatMode: VatMode.exclusive,
  paid: Npr.fromPaisa(10000),
  language: ReceiptLanguage.en,
  pageSize: PageSize.a4,
);

final t = computeTotals(doc);
print(t.lines.map((l) => l.paisa).toList()); // [37625, 50000]
print(t.gross.paisa);   // 87625
print(t.discount.paisa); // 4381
print(t.taxable.paisa); // 83244
print(t.vat.paisa);     // 10822
print(t.total.paisa);   // 94066
print(t.balance.paisa); // 84066

final pdf = await buildReceiptPdf(doc);   // import receipt_pdf.dart
File('invoice.pdf').writeAsBytesSync(pdf.bytes);
for (final w in pdf.warnings) { print(w); }   // empty for this English document
```

## The model

`ReceiptDocument` fields:

| Field | Meaning |
| --- | --- |
| `kind` | `invoice`, `receipt`, `quotation` or `creditNote`. It changes the title only, not the maths. |
| `number` | Document number. Must not be blank. |
| `issueDate`, `dueDate` | BS dates. `dueDate` is optional. |
| `business` | `name`, and optional `address`, `pan`, `vat`, `phone`. |
| `customer` | `name`, and optional `address`, `pan`, `phone`. |
| `lines` | One or more lines: `description`, `qtyMilli`, optional `unit`, `unitPrice`. |
| `discount` | Optional. `{ type: 'amount', amount }` or `{ type: 'percent', basisPoints }`. |
| `vatMode` | `none`, `exclusive` or `inclusive`. |
| `vatBasisPoints` | Optional. Default 1300 (13%). 100 basis points is 1%. |
| `paid` | Amount already paid. May exceed the total. |
| `notes` | Optional free text. |
| `stamp` | Optional `paid` or `cancelled`, drawn across the page. |
| `language` | `ne`, `en` or `bilingual`. |
| `pageSize` | `a4`, `a5` or `roll80` (an 80 mm roll). |

Dart uses enums for the same values (`ReceiptKind`, `VatMode`, `ReceiptStamp`, `ReceiptLanguage`, `PageSize`). A logo is not part of the model.

## Calculation order

`computeTotals` always works in this order:

1. Each line amount is `qtyMilli * unitPrice / 1000`, rounded half away from zero, to the paisa.
2. `gross` is the sum of the rounded line amounts.
3. The discount comes off the gross. A percent discount is `gross * basisPoints / 10000`, rounded half away from zero.
4. VAT is worked out on the discounted amount:
   - `none`: VAT is 0. Taxable and total both equal the discounted amount.
   - `exclusive`: VAT is the rate applied to the discounted amount. Total is taxable plus VAT.
   - `inclusive`: the discounted amount already contains VAT. Taxable is the discounted amount divided by (1 + rate), rounded. VAT is the discounted amount minus taxable, so the parts always add up.
5. `balance` is `total - paid`. A negative balance sets `overpaid` to true and the balance stays negative.

The result is a `ReceiptTotals` with `lines`, `gross`, `discount`, `taxable`, `vat`, `total`, `paid`, `balance` and `overpaid`. Nothing in the document is changed.

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const inclusive = computeTotals({ ...doc, vatMode: 'inclusive' });
inclusive.taxable.paisa; // => 73667
inclusive.vat.paisa; // => 9577
inclusive.total.paisa; // => 83244
const overpaid = computeTotals({ ...doc, paid: Npr.fromPaisa(999999) });
overpaid.balance.paisa; // => -905933
overpaid.overpaid; // => true
```

With `inclusive`, the total is the discounted amount (83,244 paisa here), not a higher figure.

## API reference

TypeScript names. Dart names are in the next section.

| Name | What it does | Throws |
| --- | --- | --- |
| `validateReceipt(doc)` | Returns every problem as `{ code, line? }`, in a fixed order. An empty list means `computeTotals` raises no `ReceiptError`. | Nothing |
| `computeTotals(doc)` | Returns the `ReceiptTotals`. | `ReceiptError` (the first issue); `MoneyError` `OUT_OF_RANGE` if a sum is too large |
| `lineAmount(line)` | Amount of one line, rounded half away from zero. | `MoneyError` if the amount is too large |
| `ReceiptError` | Typed error with `code`, optional `line`, English `message` and `localized(language)`. | |
| `renderReceiptHtml(doc, options?)` | Returns a full HTML page as a string. | `ReceiptError`, `MoneyError`, and `RangeError` if `fontCss` contains `</style` |
| `formatQuantity(qtyMilli)` | Quantity as text: 1500 is `1.5`, 1 is `0.001`. | Nothing |

`ReceiptHtmlOptions`:

| Option | Meaning |
| --- | --- |
| `fontCss` | CSS placed before the page styles, for example an `@font-face`. Trusted input, not escaped. |
| `fontFamily` | CSS `font-family` value. Default: Noto Sans Devanagari, Noto Sans, then system fonts. |
| `title` | The page `<title>`. Default: the document kind and number. |
| `digits` | `native` (Devanagari digits) or `ascii`. Default: native for `ne`, ascii for `en` and `bilingual`. |

## Dart equivalents

| TypeScript | Dart |
| --- | --- |
| `validateReceipt(doc)` returns `ReceiptIssue[]` | `validateReceipt(doc)` returns `List<ReceiptIssue>`; each has `code` (`ReceiptErrorCode`) and `line` |
| `computeTotals(doc)` | `computeTotals(doc)` |
| `ReceiptError` | `ReceiptException`, with `code`, `line`, `message`, `localized('ne')` |
| `ReceiptError.code` is a string such as `'EMPTY_NUMBER'` | `ReceiptErrorCode.emptyNumber`; its `name_` field is `'EMPTY_NUMBER'`, the same stable code as TypeScript |
| `MoneyError` | `MoneyException` |
| `lineAmount(line)` | `ReceiptLine.amount` |
| `renderReceiptHtml` | Not available. Dart builds a PDF instead. |
| (no PDF) | `buildReceiptPdf(doc, options:)` returns `ReceiptPdf(bytes, warnings)` |

`ReceiptPdfOptions` has `renderer` (a `DevanagariRenderer`, default none) and `compress` (default true; turn it off to inspect the file or search it for text). `buildReceiptPdf` throws `ReceiptException` for an invalid document and `MoneyException` if a sum is too large.

## Validation: `validateReceipt` and `ReceiptError`

`validateReceipt` never throws. It returns all problems in this order: number, no lines, each line (description, quantity, unit price), discount, VAT rate, paid, due date.

| Code | Raised when |
| --- | --- |
| `EMPTY_NUMBER` | `number` is blank |
| `NO_LINES` | `lines` is empty |
| `EMPTY_DESCRIPTION` | a line description is blank (`line` is the 0-based index) |
| `BAD_QUANTITY` | `qtyMilli` is not an integer of at least 1 (zero and negative are refused) |
| `BAD_UNIT_PRICE` | a unit price is negative (zero is allowed) |
| `BAD_DISCOUNT` | percent outside 0 to 10000 basis points, or an amount that is negative or larger than the gross |
| `BAD_VAT_RATE` | `vatBasisPoints` outside 0 to 10000 (checked in every VAT mode) |
| `BAD_PAID` | `paid` is negative |
| `DUE_BEFORE_ISSUE` | the due date is before the issue date (the same day is allowed) |

`computeTotals` and `renderReceiptHtml` throw `ReceiptError` for the first issue. Use `validateReceipt` when you want to show every problem at once, for example next to a form.

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';


const bad = {
  ...doc,
  number: ' ',
  lines: [{ ...doc.lines[0], qtyMilli: 0 }, { ...doc.lines[1], description: '' }],
  discount: { type: 'percent', basisPoints: 20000 },
};
validateReceipt(bad); // => [{ code: 'EMPTY_NUMBER' }, { code: 'BAD_QUANTITY', line: 0 }, { code: 'EMPTY_DESCRIPTION', line: 1 }, { code: 'BAD_DISCOUNT' }]

let err;
try { computeTotals(bad); } catch (e) { err = e; }
err instanceof ReceiptError; // => true
err.code; // => 'EMPTY_NUMBER'
err.message; // => 'Document number is required.'
err.localized('ne'); // => 'कागजात नम्बर आवश्यक छ।'
```

The `ne` messages are not reviewed by a native speaker. In the TypeScript check for a quantity, a non-integer such as `1.5` is also `BAD_QUANTITY`: use `1500`.

## The HTML template

`renderReceiptHtml(doc, options)` returns a complete HTML document with its own `<style>`. There are no scripts. It is not a PDF engine: open it in a browser print view, or print it to PDF with a headless browser on a server. A browser shapes Devanagari correctly, which is why this route is the simple one for Nepali text.

What it does:

- `@page` is set from `pageSize`: A4 with a 12 mm margin, A5 with 8 mm, or `80mm auto` for `roll80`. The roll layout is a single column with no table borders.
- `language: 'en'` uses English labels. `'ne'` uses Nepali labels and Devanagari digits. `'bilingual'` shows both labels and ASCII digits. `options.digits` overrides the digit choice.
- Issue and due dates use the `dual` date format: the BS date with the AD date beside it.
- The totals block shows subtotal, discount (with its percent when the discount is a percent), taxable amount and VAT (only when `vatMode` is not `none`), total, paid, and balance. An overpaid document shows an "Overpaid" row instead of "Balance".
- The amount in words is added unless the total is negative. It is English for `en` and `bilingual`, and Nepali for `ne`. The Nepali words are not reviewed by a native speaker.
- Every text value from the document is HTML-escaped, and line breaks in addresses and notes become `<br>`. `fontCss` and `fontFamily` are the exception: they are trusted input.
- The output is the same for the same input.

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const ne = renderReceiptHtml({ ...doc, language: 'ne' });
ne.includes('<title>बिजक INV-002</title>'); // => true
ne.includes('अक्षरमा रकम:</strong> नौ सय चालीस रुपैयाँ छयसट्ठी पैसा मात्र'); // => true

const bi = renderReceiptHtml({ ...doc, language: 'bilingual' });
bi.includes('Amount in words</span>:</strong> Rupees Nine Hundred Forty and Sixty-Six Paisa Only'); // => true
renderReceiptHtml({ ...doc, pageSize: 'roll80' }).includes('@page { size: 80mm auto; margin: 3mm; }'); // => true

const safe = renderReceiptHtml({ ...doc, customer: { name: '<i>x</i>' } });
safe.includes('&lt;i&gt;x&lt;/i&gt;'); // => true
```

### Fonts

No font file is bundled. Without help, the page uses whatever fonts the reader has installed. For identical output on every machine, pass an `@font-face` rule for Noto Sans Devanagari in `fontCss` (for example with a base64 data URL) and a matching `fontFamily`. A `fontCss` value that contains `</style` is refused with a `RangeError`.

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const styled = renderReceiptHtml(doc, {
  fontCss: "@font-face { font-family: 'ReceiptFont'; src: url(data:font/woff2;base64,AAAA) format('woff2'); }",
  fontFamily: "'ReceiptFont', sans-serif",
});
styled.includes("font-family: 'ReceiptFont', sans-serif;"); // => true

let refused;
try { renderReceiptHtml(doc, { fontCss: '</style><script>x</script>' }); } catch (e) { refused = e; }
refused instanceof RangeError; // => true
```

### Printing to PDF with a headless browser

Write the string to a `.html` file, load it in a headless browser, and use the browser's print-to-PDF feature. Because the page sets its own `@page` size, the paper size follows `pageSize`. The repository has no printing script, and this guide does not give browser commands or flags: [SOURCE NEEDED]. The layout has not been looked at in a browser or printed (see below).

## The Dart PDF output

`buildReceiptPdf(doc, options:)` in `dart/lib/receipt_pdf.dart` lays out the document with the `pdf` package and returns the bytes and a list of warnings.

- Layout: header, title block with BS and AD dates, customer, lines table (the header row repeats on each page), totals, amount in words, notes, signature line and a rotated, semi-transparent stamp. A4 and A5 use multi-page layout. The 80 mm roll is one page as tall as its content, in a single column with no borders.
- Latin text and digits use the built-in Helvetica font, so they are real, selectable text.
- Characters outside Latin-1 (for example a typographic dash, or scripts other than Devanagari) in names or notes will not draw correctly, because the built-in font has no Unicode support. `pdf` prints a notice about this from an `assert`, so you see it only in debug and test runs.
- Devanagari is handled by a `DevanagariRenderer`. Any string with a character in U+0900 to U+097F is passed to it, and the PNG it returns is placed in the page. Images are cached per text, size and weight.

### Devanagari and the renderer

A `DevanagariRenderer` has one method, `render(text, fontSize:, bold:, color:)`, which returns a `RenderedText` (PNG bytes and the size in points). If you pass none:

- labels in a Nepali or bilingual receipt fall back to English, and the result has a `DEVANAGARI_LABELS_UNAVAILABLE` warning;
- Devanagari text from the document (names, notes) becomes `[?]`, with a `DEVANAGARI_TEXT_UNAVAILABLE` warning.

If a renderer throws a `DevanagariRenderException`, the PDF is still produced, those strings become `[?]`, and there is a `DEVANAGARI_RENDER_FAILED` warning. Check `warnings` every time you build a Nepali PDF.

The package includes one renderer, `CommandDevanagariRenderer` (`package:jhigu_patro_utils/devanagari_command_renderer.dart`). It uses `dart:io`, so it is not for the web. It writes an SVG with the text to the standard input of an external program and reads a transparent PNG from its standard output. The default program is `rsvg-convert` (from librsvg), which shapes Devanagari. You must install a Devanagari font and name it in `fontFamily`; none is bundled.

```dart
import 'package:jhigu_patro_utils/devanagari_command_renderer.dart';
import 'package:jhigu_patro_utils/receipt_pdf.dart';

final renderer = CommandDevanagariRenderer(fontFamily: "'Noto Sans Devanagari'");
final result = await buildReceiptPdf(nepaliDoc, options: ReceiptPdfOptions(renderer: renderer));
File('invoice-ne.pdf').writeAsBytesSync(result.bytes);
print(result.warnings);   // [] when every string was drawn
```

Settings: `executable`, `arguments` (`{scale}` is replaced), `fontFamily` (default list: Noto Sans Devanagari, Kohinoor Devanagari, Devanagari MT, Mangal, sans-serif), `scale` (default 290 / 72) and `runner` (replace the process call, used by the tests). The text goes only to standard input, never on the command line or in error messages. The image height is fixed at 1.6 times the font size with the baseline at 1.0 times, so Nepali text lines up in table rows.

For a Flutter app, `FlutterDevanagariRenderer` and the print and share helpers live in the separate `flutter/` package. See `docs/USAGE.md` ("PDF receipts").

Without a renderer, a `ne` receipt shows the effect:

```dart
final result = await buildReceiptPdf(nepaliDoc);   // customer name has Devanagari
print(result.warnings);
// [DEVANAGARI_LABELS_UNAVAILABLE: ... 15 labels were drawn in English only,
//  DEVANAGARI_TEXT_UNAVAILABLE: ... 2 text values with Devanagari were replaced by [?]]
```

The counts depend on the document.

## Command line

There is no `receipt` command in the CLI. `jhigu-patro receipt` answers `Unknown command: "receipt"`. The CLI does not render or total receipts.

## Recipes

### 1. A receipt with no VAT and a fixed discount

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const receipt = {
  kind: 'receipt',
  number: 'R-17',
  issueDate: new NepaliDate(2082, 6, 1),
  business: { name: 'Himal Traders' },
  customer: { name: 'Sita Gurung' },
  lines: [{ description: 'Tea', qtyMilli: 3000, unitPrice: Npr.fromPaisa(12000) }],
  discount: { type: 'amount', amount: Npr.fromPaisa(1000) },
  vatMode: 'none',
  paid: Npr.fromPaisa(35000),
  stamp: 'paid',
  language: 'en',
  pageSize: 'roll80',
};
const r = computeTotals(receipt);
r.gross.paisa; // => 36000
r.total.paisa; // => 35000
r.balance.paisa; // => 0
renderReceiptHtml(receipt).includes('class="stamp paid"'); // => true
```

### 2. Show every problem next to a form

Call `validateReceipt` on each change and map each `code` (and `line`) to a message with `new ReceiptError(issue).localized('ne')` (the class takes the issue object). Do not call `computeTotals` until the list is empty.

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const issues = validateReceipt({ ...doc, lines: [] });
issues; // => [{ code: 'NO_LINES' }]
new ReceiptError(issues[0]).message; // => 'At least one line is required.'
```

### 3. A different VAT rate

Set `vatBasisPoints` (750 is 7.5%). The rate is shown on the page next to the VAT row.

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

const seven = computeTotals({ ...doc, discount: undefined, vatBasisPoints: 750 });
seven.gross.paisa; // => 87625
seven.vat.paisa; // => 6572
renderReceiptHtml({ ...doc, vatBasisPoints: 750 }).includes('VAT (7.5%)'); // => true
```

### 4. Print a Nepali invoice from a server (TypeScript)

Build the HTML with `language: 'ne'`, an embedded font in `fontCss`, and a matching `fontFamily`, then print it to PDF with your headless browser. The embedded font is what makes the output identical on every machine.

### 5. Make a PDF in Dart with Nepali text

Install `rsvg-convert` and a Devanagari font, create a `CommandDevanagariRenderer`, and pass it in `ReceiptPdfOptions`, as shown above. Always print `result.warnings`.

### 6. Check the amount that is printed

The words on the page come from `total.inWords()` (or `inWords({ language: 'ne' })`). To check what a customer will read:

```js test
import { Npr, NepaliDate } from 'jhigu-patro-utils-ts';
import { computeTotals, validateReceipt, ReceiptError } from 'jhigu-patro-utils-ts/receipt';
import { renderReceiptHtml } from 'jhigu-patro-utils-ts/receipt-html';

totals.total.inWords(); // => 'Rupees Nine Hundred Forty and Sixty-Six Paisa Only'
totals.total.inWords({ language: 'ne' }); // => 'नौ सय चालीस रुपैयाँ छयसट्ठी पैसा मात्र'
```

## Errors and edge cases

- A sum above the money limit throws `MoneyError` with code `OUT_OF_RANGE`, not a `ReceiptError`. `validateReceipt` does not detect it.
- `validateReceipt` compares an amount discount with the gross of the valid lines only, so a bad line does not hide a bad discount.
- An amount discount may equal the gross (total 0). It may not exceed it.
- `kind` does not change the maths. A credit note uses positive amounts, like an invoice.
- A zero unit price is allowed. A zero or negative quantity is not.
- Money with a minus sign prints the sign before the symbol, as `Npr.format` does (`-Rs. 28.22`).
- In a Dart PDF, characters outside Latin-1 that are not Devanagari are not drawn correctly.
- A rendered stamp is a decoration only. It does not change any amount.

## Accuracy, limits and known gaps

- **Expected values are not from an official source.** The shared test vectors come from an independent Python model that uses exact fractions and rounds half away from zero. They show that TypeScript and Dart agree with that model, not that the rules match Nepali tax practice.
- **Tax rules are not verified.** The default rate of 1300 basis points (13%) is a default in the code and the project's own choice, and the rate is yours to set. The notes do not cite any source for VAT or invoicing rules in Nepal, such as required fields, rounding per line versus per invoice, how a discount interacts with VAT, or the format of PAN and VAT numbers. [SOURCE NEEDED] before using the output as a legal tax invoice.
- **Choices the guide did not specify** (from `data/RECEIPT_NOTES.md`): a quantity must be a positive integer of thousandths; the unit price may be zero but not negative; the VAT rate is checked in every mode; `paid` may exceed the total; the due date may equal the issue date; dates are BS only (the AD date shown beside them is for display).
- **Nepali text is unreviewed.** Labels, error messages and the Nepali amount in words have not been checked by a native speaker.
- **The HTML layout was not looked at in a browser or printed.** Only the markup is tested. There are no golden images.
- **PDF checks.** The Dart A4 and 80 mm PDFs, in English, Nepali and bilingual, were rendered with `pdftoppm` and read by eye (macOS). Conjuncts, row alignment and the rotated stamp looked right. Not checked: other PDF viewers, printing, A5 by eye, and bold weights at small sizes.
- **Command renderer.** `rsvg-convert` integration tests ran on macOS and on Ubuntu in CI, where they check the PNG size and that images are produced, not how the glyphs look. Windows is untested.
- **Not built:** an atlas renderer, an FFI shaper, a bundled font (so no font licence file), a receipt CLI command, and HTML output in Dart.
- **Not covered:** numbering and storage of documents, logos, multiple currencies, e-invoicing or any tax portal.

## How it is tested

- `testdata/receipt.json` holds 23 totals cases and 16 invalid-document cases (with the issues each must produce). Both `ts/tests/receipt.test.ts` and `dart/test/receipt_test.dart` read the same file, so the two libraries must give the same paisa. `data/RECEIPT_NOTES.md` still says 22 and 17; the file has 23 and 16.
- `ts/tests/receipt.test.ts` also checks a non-integer quantity, localised messages, a sum overflow, and that the document is not changed.
- `ts/tests/receiptHtml.test.ts` checks the English, Nepali and bilingual pages, page sizes, escaping, line breaks, the digits option, discount, overpaid and stamp cases, `fontCss`, and that every figure on the page matches `computeTotals`.
- `dart/test/receipt_pdf_test.dart` reads text back from uncompressed PDF streams and checks content, page sizes, paging with a repeated header, stamps, compression, the Devanagari paths with and without a renderer, and errors. `dart/test/devanagari_command_renderer_test.dart` uses a fake process runner, plus tests that call the real `rsvg-convert` and skip when it is not installed.
- The `js test` samples in this guide run in `ts/tests/docs.test.ts`. Dart samples are not run by that suite.

Run them:

```text
cd ts && npm run test:run
cd dart && dart test
```

## Related guides

- [Money](../money/README.md): `Npr`, VAT helpers, rounding and amount in words.
- [Dates](../dates/README.md): BS dates and formatting.
- [SMS](../sms/README.md): send a payment reminder by SMS.
- [Usage guide](../../USAGE.md): setup and the Flutter print and share helpers.
