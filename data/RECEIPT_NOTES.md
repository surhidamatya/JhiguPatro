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

## PDF output (Dart): `dart/lib/receipt_pdf.dart` (R-3 to R-5, R-9 interface)
`buildReceiptPdf(doc, options:)` returns `ReceiptPdf(bytes, warnings)`. Import `package:jhigu_patro_utils/receipt_pdf.dart`; it is not exported from the main library.
- **New dependency:** `pdf` (^3.13.1) is the package's first and only runtime dependency, which ends the "zero dependencies" claim; `pubspec.yaml` and the README say so. Code that never imports `receipt_pdf.dart` does not compile it, but pub still resolves the package.
- Layout: header, title block with BS date and AD date, customer, lines table (header row repeats across pages), totals, amount in words, notes, signature, rotated semi-transparent stamp. A4 and A5 use `MultiPage`; 80 mm roll is one page as tall as the content, single column, no borders.
- Built-in Helvetica, so Latin text and digits are real, selectable text. Tests read it back from the page stream (uncompressed with `ReceiptPdfOptions(compress: false)`).
- **Devanagari (guide 12.4):** strings with a character in U+0900 to U+097F go to a `DevanagariRenderer` (returns a PNG and its size in points) and are placed as images, cached per `(text, size, weight)`. With no renderer, labels fall back to English and document text becomes `[?]`, with warnings `DEVANAGARI_LABELS_UNAVAILABLE` and `DEVANAGARI_TEXT_UNAVAILABLE`. The command renderer below is included; there is no Flutter, atlas or FFI renderer.
- Amount in words is English only: shown for `en` and `bilingual`, left out for `ne`.
- Text in standard fonts has no Unicode support, so characters outside Latin-1 in names or notes (for example a typographic dash or other scripts) will not draw correctly; Devanagari is handled, other scripts are not.
- **Checked:** 17 tests (content, totals text matches `computeTotals`, page sizes, paging and repeated header, stamps, compression, Devanagari paths, errors); a deliberately wrong VAT value was caught. The A4 and 80 mm PDFs were rendered with `pdftoppm` and looked right. Not checked: other PDF viewers, printing, A5 by eye, bold weights at small sizes.
- `pdf` prints a "no Unicode support" notice from an `assert`, so only in debug and test runs.

### Command renderer: `dart/lib/devanagari_command_renderer.dart` (R-9)
`CommandDevanagariRenderer` (uses `dart:io`, so not for the web) writes an SVG with the text to an external program's stdin and reads a transparent PNG from stdout. The default program is `rsvg-convert` (librsvg: Pango and HarfBuzz shape the text); `executable`, `arguments` (`{scale}` is replaced), `fontFamily`, `scale` (default 290/72) and the process `runner` can all be changed. A Devanagari font must be installed on the machine and named in `fontFamily`; none is bundled.
- The image height is fixed at 1.6 x the font size with the baseline at 1.0 x (an invisible rectangle in the SVG), so Nepali text lines up in table rows.
- Text goes on stdin only, never on the command line or in error messages.
- If the renderer throws, the builder does not fail: those strings become `[?]` and the result has a `DEVANAGARI_RENDER_FAILED` warning.
- Nepali and bilingual receipts now also localise the small labels (number, date, due date, phone, PAN, VAT no.) and show the BS date in Nepali, when a renderer is given. Without a renderer these stay English.
- **Seen:** real Nepali, bilingual, A4 and 80 mm roll PDFs were rendered with `pdftoppm` and read by eye: conjuncts (श्रेष्ठ, ट्रेडर्स, ज्ञ) are shaped correctly, rows line up, the stamp is rotated, green and bordered. That check found and fixed a stamp bug (an image stamp stretched its border across the page and ignored the stamp colour).
- **Tested:** 11 unit tests with a fake runner, plus two integration tests that call the real `rsvg-convert` (they skip when it is not installed). CI installs `librsvg2-bin` and `fonts-noto-core` so they run there; that CI step has not been seen running yet.
- **Not done:** an atlas renderer, a Flutter renderer, the FFI shaper; no bundled font (and so no font licence file); Windows is untested; the default font list is `'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Devanagari MT', 'Mangal'`, and only the macOS fonts were exercised here.
