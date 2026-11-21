# Receipt model and totals (guide section 12, R-1, R-2, R-10)

Code: `ts/src/receipt.ts` (`jhigu-patro-utils-ts/receipt`), `dart/lib/src/receipt.dart`.
Vectors: `testdata/receipt.json` (22 totals, 17 validation cases), read by both test suites.

## Scope
Model, validation, totals. No rendering: PDF (R-3 to R-9), HTML template (R-11)
and Flutter print/share (R-8) are not built.

## Calculation order
1. line amount = qty x unit price / 1000, rounded half away from zero, per line
2. gross = sum of line amounts
3. discount: an amount, or basis points of gross (half away from zero)
4. VAT on the discounted amount (`vatExclusive` / `vatInclusive` from money):
   none: VAT 0, taxable = total = discounted.
   exclusive: VAT = percent(taxable), total = taxable + VAT.
   inclusive: taxable = discounted x 10000 / (10000 + rate) rounded; VAT = discounted - taxable.
5. balance = total - paid; negative balance sets `overpaid` (balance stays signed).

## Validation
`validateReceipt` returns every problem in a fixed order (number, no lines, each
line, discount, VAT rate, paid, due date); `computeTotals` throws the first as
`ReceiptError` / `ReceiptException` with a stable code and optional line index.
Messages are in `data/strings.*.json` group `receipt`. Nepali messages are unreviewed.

## My choices (the guide does not say)
- Quantity must be a positive integer (thousandths); a zero or negative quantity is `BAD_QUANTITY`.
  Credit notes also use positive amounts; `kind` does not change the maths.
- Unit price may be zero, not negative.
- A discount amount may equal the gross (total 0) but not exceed it. Percent is 0..10000.
- VAT rate is 0..10000 basis points, checked in every VAT mode.
- Paid may not be negative; it may exceed the total (overpaid).
- Due date may equal the issue date, not precede it.
- Dates are BS only here. The AD date beside it is for rendering.
- The guide's logo bytes are left out of the model (rendering concern).
- A sum above the money limit throws `MoneyError OUT_OF_RANGE`, not a ReceiptError.
- Amount in words: use `total.inWords()`; English only until Nepali number data exists.
- TS dates are `NepaliDateFields` (a `NepaliDate` fits); Dart uses `NepaliDate`.

## Vectors
Expected values come from an independent Python model with exact fractions,
not from an official source. The TS-only non-integer quantity check is in `receipt.test.ts`.

## HTML template (R-11): `ts/src/receiptHtml.ts` (`jhigu-patro-utils-ts/receipt-html`)
`renderReceiptHtml(doc, options)` returns a full HTML page. Use it in a browser print
view, or print it to PDF with a headless browser on a server. It is not a PDF engine.
- `@page` from `pageSize`: A4 (12 mm margin), A5 (8 mm), roll80 (`80mm auto`, single column, no table borders).
- Languages: `en`, `ne` (Devanagari digits and labels), `bilingual` (both labels, ASCII digits). `options.digits` overrides.
- All document text is HTML-escaped; line breaks become `<br>`. Totals come from `computeTotals`, so invalid documents throw the same errors.
- Issue and due dates use the `dual` preset (BS date with AD beside it).
- Amount in words is English only: shown for `en` and `bilingual`, left out for `ne` until Nepali number data exists.
- Fonts: no Noto font file is bundled (none is in the repo). Pass `fontCss` (an `@font-face`, for example with a base64 data URL) and `fontFamily` for identical output everywhere. `fontCss` is trusted input; `</style` in it is refused.
- Money with a minus shows it before the symbol (`-Rs. 28.22`), as `Npr.format` does.
- Not verified: the layout was not looked at in a browser or printed; only the markup is tested. No golden images yet.
- Labels added to the `receipt` strings group: pan, vatNo, phone, billTo, number, date, description, quantity, rate, amount, overpaid (Nepali unreviewed).
