# Money (Npr)

`Npr` is a Nepali rupee amount stored as an integer number of paisa. There are no floats inside it. It parses and formats amounts with lakh and crore grouping, does arithmetic with half-away-from-zero rounding, splits an amount so the parts add up exactly, computes VAT, and writes an amount in words in English and Nepali. The TypeScript library and the Dart library give the same results. They share test vectors in `testdata/`.

## When to use it

- You hold prices, totals or payments and cannot afford a rounding error.
- You read amounts typed by a person (`Rs. 1,250.50`, `रु १,२५०`) or show amounts in the Nepali style (`12,34,567.50`).
- You need VAT on a price, or a bill split between people with no lost paisa.
- You need the amount in words for a cheque, a receipt or a voucher.

It does not do currency conversion and it holds one currency only.

## Setup

Money needs no data to load and no calendar. Install the package and import from `jhigu-patro-utils-ts`. In Dart import `package:jhigu_patro_utils/jhigu_patro_utils.dart`.

The Nepali number words come from `data/nepali-numbers.json`, which is compiled into the library (`node tools/gen-data/gen.mjs` regenerates the copy). Nothing is read at run time.

## Quick start (TypeScript)

```js test
import { Npr, groupLakh, MAX_PAISA } from 'jhigu-patro-utils-ts';

const price = Npr.fromRupees(1234567.5);
price.paisa; // => 123456750
price.format(); // => '12,34,567.50'
price.format({ symbol: 'Rs.' }); // => 'Rs. 12,34,567.50'
price.format({ symbol: 'रु', devanagari: true }); // => 'रु १२,३४,५६७.५०'
groupLakh('12345678'); // => '1,23,45,678'
MAX_PAISA; // => 9007199254740991

Npr.parse('Rs. 1,250.50').paisa; // => 125050
Npr.parse('रु १,२५०').paisa; // => 125000
Npr.fromPaisa(1001).plus(Npr.fromPaisa(5)).paisa; // => 1006
```

An amount is immutable and has `paisa` as a plain integer. `JSON.stringify` writes it as that integer.

```js test
import { Npr } from 'jhigu-patro-utils-ts';

JSON.stringify({ fee: Npr.fromRupees(5) }); // => '{"fee":500}'
String(Npr.fromPaisa(5)); // => '0.05'
Npr.ZERO.isZero(); // => true
```

## The same in Dart

This sample was run against the repo and printed the values in the comments.

```dart
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

void main() {
  final price = Npr.fromRupees(1234567.5);
  print(price.paisa);                                  // 123456750
  print(price.format(symbol: MoneySymbol.rs));         // Rs. 12,34,567.50
  print(price.format(
      symbol: MoneySymbol.ru,
      devanagari: true,
      decimals: MoneyDecimals.always));                // रु १२,३४,५६७.५०
  print(Npr.parse('Rs. 1,250.50').paisa);              // 125050
  print(Npr.fromPaisa(1001).timesDecimal('1.5').paisa); // 1502
  print(Npr.fromPaisa(1000).dividedBy(4, times: 3).paisa); // 750
  print(Npr.fromRupees(100).split(3).map((n) => n.paisa).toList()); // [3334, 3333, 3333]
  final v = vatExclusive(Npr.fromRupees(1000));
  print([v.subtotal.paisa, v.vat.paisa, v.total.paisa]); // [100000, 13000, 113000]
  print(amountInWords(Npr.fromPaisa(12345)));
  // Rupees One Hundred Twenty-Three and Forty-Five Paisa Only
  print(amountInWords(Npr.fromPaisa(12345), language: 'ne'));
  // एक सय तेइस रुपैयाँ पैँतालीस पैसा मात्र
  print(numberToWords(123456, language: 'ne'));        // एक लाख तेइस हजार चार सय छपन्न
  try {
    Npr.parse('1.234');
  } on MoneyException catch (e) {
    print(e.code.name_); // TOO_MANY_DECIMALS
  }
}
```

Differences in Dart:

| TypeScript | Dart |
| --- | --- |
| `MoneyError` | `MoneyException` (`code` is a `MoneyErrorCode`; `code.name_` is the shared text such as `EMPTY`) |
| `MAX_PAISA` | `maxPaisa` |
| `format({ symbol: 'Rs.' })` | `format(symbol: MoneySymbol.rs)`; also `MoneySymbol.ru` and `MoneySymbol.none` |
| `decimals: 'always'` | `decimals: MoneyDecimals.always`; also `auto` and `never` |
| `dividedBy(divisor, times)` | `dividedBy(divisor, {times})` |
| `numberToWords(n, 'ne')` | `numberToWords(n, language: 'ne')` |
| `Npr.ZERO` | `Npr.zero` |
| `vatExclusive(base, bp)` | `vatExclusive(base, {bp})`, same for `vatInclusive` |
| `isZero()`, `isNegative()` | `isZero`, `isNegative` (getters) |
| `Npr.fromRupees(number)` | `Npr.fromRupees(double)` |

Dart `int` parameters cannot take `1.5`, so the shared vectors that pass a non-integer to an integer parameter are skipped there (`data/MONEY_NOTES.md`).

## API reference

Amounts are `Npr`. `bp` is basis points (13% is 1300).

| Name | What it does | Throws (`MoneyError` code) |
| --- | --- | --- |
| `Npr.fromPaisa(n)` | An amount from integer paisa. | `INVALID_ARGUMENT` if not an integer; `OUT_OF_RANGE` if above `MAX_PAISA` in size. |
| `Npr.fromRupees(x)` | From a number of rupees. Rounds once to paisa, half away from zero, using the shortest decimal text of the double: `1.005` is 101 paisa, `0.285` is 29. | `INVALID_ARGUMENT` for NaN or Infinity; `OUT_OF_RANGE`. |
| `Npr.parse(text)` | Reads user text: `Rs. 1,250.50`, `रु १,२५०`, `NPR 99`, `-5`. | `EMPTY`, `BAD_FORMAT`, `TOO_MANY_DECIMALS`, `OUT_OF_RANGE`. |
| `Npr.ZERO` | Zero. | |
| `paisa` | The integer paisa. | |
| `isZero()`, `isNegative()`, `equals(o)`, `compareTo(o)` | Comparison. `compareTo` returns -1, 0 or 1, so it works with `sort`. | |
| `plus(o)`, `minus(o)`, `negate()`, `abs()` | Exact arithmetic. | `OUT_OF_RANGE` |
| `times(n)` | Exact multiple by an integer. | `INVALID_ARGUMENT` for a non-integer; `OUT_OF_RANGE`. |
| `timesDecimal(text)` | Multiply by a decimal given as text, `"1.5"` or `"-0.125"`. Rounds half away from zero. A number is not accepted. | `INVALID_ARGUMENT` |
| `percent(bp)` | `bp` basis points of the amount, rounded half away from zero. | `INVALID_ARGUMENT` if `bp` is not an integer. |
| `dividedBy(divisor, times = 1)` | `this * times / divisor`, rounded half away from zero. Divisor must be a positive integer. | `INVALID_ARGUMENT` |
| `allocate(ratios)` | Splits by integer ratios with the largest remainder method. The parts always add up to the amount. | `INVALID_ARGUMENT` for no ratios, a negative or non-integer ratio, or a zero sum. |
| `split(n)` | `allocate` into `n` equal parts. | `INVALID_ARGUMENT` if `n` is below 1. |
| `format(options)` | Text such as `Rs. 1,23,456.50`. See [Formatting](#formatting). | |
| `inWords(options)` | Same as `amountInWords(this, options)`. | `INVALID_ARGUMENT` for an unknown language. |
| `toString()` | `format({ decimals: 'always' })`, no symbol. | |
| `toJSON()` (TS) | The integer paisa. | |
| `groupLakh(digits)` | Groups a string of digits: last three, then pairs. `'12345678'` gives `'1,23,45,678'`. Digits only. | |
| `MAX_PAISA` | 2^53 - 1 (9007199254740991), about 90 trillion rupees. | |
| `vatExclusive(base, bp = 1300)` | VAT added to a price. Returns `VatResult`. | `INVALID_ARGUMENT`, `OUT_OF_RANGE` |
| `vatInclusive(total, bp = 1300)` | VAT inside a price. Returns `VatResult`. | `INVALID_ARGUMENT`, `OUT_OF_RANGE` |
| `numberToWords(n, language = 'en')` | A non-negative integer in words. | `INVALID_ARGUMENT` for a negative or non-integer `n`, above `MAX_PAISA`, or an unknown language. |
| `amountInWords(amount, options)` | An amount in words. See [Words](#amount-in-words). | `INVALID_ARGUMENT` for an unknown language. |
| `MoneyError` | `code`, English `message`, `localized('ne')`. | |

`VatResult` is `{ subtotal, vat, total }`, each an `Npr`. `NprFormatOptions` is described next.

## Construction and parsing

`fromPaisa` is the exact constructor. Use `fromRupees` for a number you wrote in code and `parse` for text that came from a person.

`parse` rules, from `ts/src/money.ts` and `data/MONEY_NOTES.md`:

- Devanagari digits are read as ASCII digits.
- A symbol (`Rs`, `Rs.`, `NPR`, `रु`, `रू`, any case) is accepted at the start or the end only. `1Rs2` is `BAD_FORMAT`, not 12.
- A minus sign may come before or after the symbol. Both is `BAD_FORMAT`.
- Commas and spaces inside the number are removed, so `1,2,3` is 123. Treat grouping as display, not validation.
- At most two decimals. A third digit is `TOO_MANY_DECIMALS` (it is not rounded).
- `1.` and `.5` are `BAD_FORMAT`. Empty text, or only a symbol, is `EMPTY`.

```js test
import { Npr, MoneyError } from 'jhigu-patro-utils-ts';

Npr.parse('NPR 99').paisa; // => 9900
Npr.parse('-5').paisa; // => -500
Npr.parse('Rs. -5').paisa; // => -500
Npr.parse('1,2,3').paisa; // => 12300
Npr.fromRupees(1.005).paisa; // => 101
Npr.fromRupees(0.285).paisa; // => 29

const codeOf = f => { try { f(); return 'no error'; } catch (e) { return e instanceof MoneyError ? e.code : 'other'; } };
codeOf(() => Npr.parse('   ')); // => 'EMPTY'
codeOf(() => Npr.parse('Rs.')); // => 'EMPTY'
codeOf(() => Npr.parse('1Rs2')); // => 'BAD_FORMAT'
codeOf(() => Npr.parse('1.')); // => 'BAD_FORMAT'
codeOf(() => Npr.parse('1.234')); // => 'TOO_MANY_DECIMALS'
codeOf(() => Npr.parse('99999999999999999')); // => 'OUT_OF_RANGE'
codeOf(() => Npr.fromRupees(NaN)); // => 'INVALID_ARGUMENT'
codeOf(() => Npr.fromPaisa(1.5)); // => 'INVALID_ARGUMENT'
```

## Arithmetic and rounding

All rounding is half away from zero: 0.5 paisa becomes 1, -0.5 becomes -1. Multiplication and division run on `BigInt` inside, so an intermediate value cannot overflow. Only the final result must fit in `MAX_PAISA`.

```js test
import { Npr, MAX_PAISA } from 'jhigu-patro-utils-ts';

Npr.fromRupees(10).plus(Npr.fromPaisa(5)).paisa; // => 1005
Npr.fromRupees(10).minus(Npr.fromRupees(12)).paisa; // => -200
Npr.fromPaisa(250).times(3).paisa; // => 750
Npr.fromPaisa(1001).timesDecimal('1.5').paisa; // => 1502
Npr.fromPaisa(1).timesDecimal('0.5').paisa; // => 1
Npr.fromPaisa(-1).timesDecimal('0.5').paisa; // => -1
Npr.fromPaisa(250).dividedBy(2).paisa; // => 125
Npr.fromPaisa(1000).dividedBy(3).paisa; // => 333
Npr.fromPaisa(1000).dividedBy(4, 3).paisa; // => 750
Npr.fromPaisa(10000).percent(1300).paisa; // => 1300
Npr.fromPaisa(5).percent(1000).paisa; // => 1
[Npr.fromPaisa(300), Npr.fromPaisa(100)].sort((a, b) => a.compareTo(b)).map(n => n.paisa); // => [100, 300]
Npr.fromPaisa(MAX_PAISA).minus(Npr.fromPaisa(1)).paisa; // => 9007199254740990
```

Use `times` with an integer count. Use `timesDecimal` with text for a rate such as a quantity of 2.5 kg. Do not pass a float: `timesDecimal(1.5)` throws `INVALID_ARGUMENT`. Dividing first and multiplying later loses paisa, so use `dividedBy(divisor, times)` to do both in one rounding.

A result above `MAX_PAISA` in size throws `OUT_OF_RANGE`. `-0` is normalised to 0.

## Allocation

`allocate` splits an amount by integer ratios. Each share is the exact floor of its portion. The leftover paisa go one each to the largest remainders, ties to the lower index. The shares always add up to the amount. A negative amount is split by its size and the shares are negated.

```js test
import { Npr } from 'jhigu-patro-utils-ts';

Npr.fromRupees(100).allocate([1, 1, 1]).map(n => n.paisa); // => [3334, 3333, 3333]
Npr.fromPaisa(1000).allocate([70, 30]).map(n => n.paisa); // => [700, 300]
Npr.fromPaisa(5).allocate([1, 1]).map(n => n.paisa); // => [3, 2]
Npr.fromPaisa(-5).allocate([1, 1]).map(n => n.paisa); // => [-3, -2]
Npr.fromPaisa(100).allocate([0, 1]).map(n => n.paisa); // => [0, 100]
Npr.fromRupees(100).split(3).map(n => n.paisa); // => [3334, 3333, 3333]
```

## Formatting

`format(options)` takes `NprFormatOptions`:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| `symbol` | `'Rs.'`, `'रु'`, `'none'` | `'none'` | Put before the number, one space between. |
| `devanagari` | `true`, `false` | `false` | Devanagari digits (`१२,३४५`). Applies to the number only, not to the symbol. |
| `decimals` | `'auto'`, `'always'`, `'never'` | `'auto'` | `auto` drops `.00`. `always` keeps two paisa digits. `never` rounds to whole rupees, half away from zero. |

The minus sign goes before the symbol. A negative amount that shows as zero has no minus sign. Grouping is the Indian style (`groupLakh`): last three digits, then pairs.

```js test
import { Npr } from 'jhigu-patro-utils-ts';

Npr.fromPaisa(100000).format(); // => '1,000'
Npr.fromPaisa(100000).format({ decimals: 'always' }); // => '1,000.00'
Npr.fromPaisa(123450).format({ decimals: 'never' }); // => '1,235'
Npr.fromPaisa(123456).format({ decimals: 'never' }); // => '1,235'
Npr.fromPaisa(-5000).format({ symbol: 'Rs.' }); // => '-Rs. 50'
Npr.fromPaisa(-40).format({ symbol: 'Rs.', decimals: 'never' }); // => 'Rs. 0'
Npr.fromPaisa(-50).format({ decimals: 'never' }); // => '-1'
Npr.fromPaisa(123456750).format({ symbol: 'रु', devanagari: true, decimals: 'always' }); // => 'रु १२,३४,५६७.५०'
Npr.fromPaisa(9007199254740991).format({ symbol: 'Rs.' }); // => 'Rs. 9,00,71,99,25,47,409.91'
```

## VAT

The default rate is 13%, written as 1300 basis points. Pass another rate as `bp`.

- `vatExclusive(base, bp)`: the price has no VAT yet. `vat` is `base.percent(bp)` and `total` is `base + vat`.
- `vatInclusive(total, bp)`: the price already has VAT. `subtotal` is `total * 10000 / (10000 + bp)` rounded half away from zero, and `vat` is `total - subtotal`. The parts always add up to the total.

```js test
import { Npr, vatExclusive, vatInclusive } from 'jhigu-patro-utils-ts';

const a = vatExclusive(Npr.fromRupees(1000));
[a.subtotal.paisa, a.vat.paisa, a.total.paisa]; // => [100000, 13000, 113000]

const b = vatInclusive(Npr.fromRupees(1130));
[b.subtotal.paisa, b.vat.paisa, b.total.paisa]; // => [100000, 13000, 113000]

const c = vatInclusive(Npr.fromPaisa(10001));
[c.subtotal.paisa, c.vat.paisa, c.total.paisa]; // => [8850, 1151, 10001]

vatExclusive(Npr.fromRupees(1000), 1000).vat.paisa; // => 10000
```

Whether 13% is the right rate for an item, and whether a price must be shown with VAT, is a tax question. This library does not decide it. [SOURCE NEEDED]

## Amount in words

`numberToWords(n, language)` writes a non-negative integer. `amountInWords(amount, options)` (or `amount.inWords(options)`) writes a whole amount.

### English

`numberToWords` uses lower case, hyphenated tens, and the Indian scales thousand, lakh and crore. There is no "and" inside the number. Above 99 crore the crore count is spoken as its own number (`one hundred crore`, `one lakh crore`).

`amountInWords` gives `Rupees <words> [and <paisa words> Paisa] Only`. With zero rupees and some paisa the rupee part is left out. With nothing at all it is `Rupees Zero Only`. A negative amount starts with `Minus`. `Paisa` is not made plural.

```js test
import { Npr, numberToWords, amountInWords } from 'jhigu-patro-utils-ts';

numberToWords(1234567); // => 'twelve lakh thirty-four thousand five hundred sixty-seven'
numberToWords(1000000000); // => 'one hundred crore'
amountInWords(Npr.fromPaisa(12345)); // => 'Rupees One Hundred Twenty-Three and Forty-Five Paisa Only'
amountInWords(Npr.fromPaisa(12345), { letterCase: 'lower' }); // => 'rupees one hundred twenty-three and forty-five paisa only'
amountInWords(Npr.fromPaisa(50)); // => 'Fifty Paisa Only'
amountInWords(Npr.ZERO); // => 'Rupees Zero Only'
amountInWords(Npr.fromPaisa(-12345)); // => 'Minus Rupees One Hundred Twenty-Three and Forty-Five Paisa Only'
amountInWords(Npr.fromPaisa(12345), { prefix: 'NPR', suffix: 'Net', joiner: '&', paisaLabel: 'Paise' }); // => 'NPR One Hundred Twenty-Three & Forty-Five Paise Net'
Npr.fromPaisa(100).inWords(); // => 'Rupees One Only'
```

Options (`AmountInWordsOptions`; in Dart the same names as named parameters, with `letterCase` as a string):

| Option | Default | Notes |
| --- | --- | --- |
| `language` | `'en'` | `'en'` or `'ne'`. Anything else throws `INVALID_ARGUMENT`. |
| `letterCase` | `'title'` | `'title'` or `'lower'`. English only; it has no effect in Nepali. |
| `prefix` | `Rupees` | Before the rupee words. Empty in Nepali. |
| `rupeesLabel` | `रुपैयाँ` | **Nepali only.** After the rupee words. Ignored in English. |
| `suffix` | `Only` (`मात्र`) | After everything. |
| `paisaLabel` | `Paisa` (`पैसा`) | After the paisa words. |
| `joiner` | `and`; empty in Nepali | Between rupees and paisa. |
| `minus` | `Minus` (`ऋण`) | Before a negative amount. |

The defaults come from the `words` group of `data/strings.en.json` and `data/strings.ne.json`.

### Nepali

Pass `language: 'ne'`. The result is `<rupee words> रुपैयाँ [<paisa words> पैसा] मात्र`, with `ऋण` first for a negative amount. There is no `र` between rupees and paisa unless you pass `joiner`. Zero rupees with paisa drops the rupee part, and zero is `शून्य रुपैयाँ मात्र`. Scales are सय, हजार, लाख, करोड, अर्ब and खर्ब.

```js test
import { Npr, numberToWords, amountInWords } from 'jhigu-patro-utils-ts';

numberToWords(123456, 'ne'); // => 'एक लाख तेइस हजार चार सय छपन्न'
numberToWords(100000000000, 'ne'); // => 'एक खर्ब'
numberToWords(10000000000000, 'ne'); // => 'एक सय खर्ब'
amountInWords(Npr.fromPaisa(12345), { language: 'ne' }); // => 'एक सय तेइस रुपैयाँ पैँतालीस पैसा मात्र'
amountInWords(Npr.fromPaisa(-12345), { language: 'ne' }); // => 'ऋण एक सय तेइस रुपैयाँ पैँतालीस पैसा मात्र'
amountInWords(Npr.fromPaisa(50), { language: 'ne' }); // => 'पचास पैसा मात्र'
amountInWords(Npr.ZERO, { language: 'ne' }); // => 'शून्य रुपैयाँ मात्र'
amountInWords(Npr.fromRupees(100), { language: 'ne', rupeesLabel: 'रुपियाँ' }); // => 'एक सय रुपियाँ मात्र'
```

How the Nepali words are built, and what is not settled:

- Every number from 0 to 99 is its own word, taken from `data/nepali-numbers.json`. Above that the number is cut into groups: खर्ब, अर्ब, करोड, लाख, हजार, सय, then the last two digits.
- **The word table is not reviewed by a native speaker.** The file has `"reviewed": false`. The 100 words were taken, with the project owner's go-ahead, from one package (`lohanidamodar/nepal-kit`), and each was compared with web tables. The file labels every word in `review`:
  - `two-sources`: 62 words. The package and a table agree and none differs.
  - `single-source`: 0 words.
  - `disputed`: **38 words**. A table spells them differently. `variants` lists the other spelling. The disputed words are 0, 3, 10, 20, 24, 25, 26, 28, 29, 30 to 48, 54, 59 and 91 to 98. Most differences are a long versus a short vowel (`बीस` or `बिस`, `तीस` or `तिस`).
  - The web tables disagree with each other in places, and they are web pages, not a dictionary. Someone who reads Nepali has to say which spelling is standard. Do not change a word without a reference.
- **The scale spelling अर्ब and खर्ब is unresolved.** The code uses `अर्ब` and `खर्ब` (as the nepal-kit package and the project guide do). One of the compared tables spells them `अरब` and `खरब`. [SOURCE NEEDED]
- **There is no 10^13 limit.** `Npr` goes up to about 9 x 10^13 rupees, so the खर्ब count is spoken as its own number (`एक सय खर्ब`), as English does with crore. The largest amount is read this way.
- The `ne` values of the `words` labels (`रुपैयाँ`, `पैसा`, `मात्र`, `ऋण`) are also not reviewed.
- The CLI prints a note that the Nepali words are not native-speaker reviewed. Tell your own users the same when you print them on a legal document.

## Recipes

### 1. Read a form field and show it back

Parse what the person typed, report a typed error in their language, and show the clean amount.

```js test
import { Npr, MoneyError } from 'jhigu-patro-utils-ts';

function readAmount(text, language) {
  try {
    const n = Npr.parse(text);
    return { ok: true, paisa: n.paisa, shown: n.format({ symbol: 'Rs.', decimals: 'always' }) };
  } catch (e) {
    if (e instanceof MoneyError) return { ok: false, code: e.code, message: e.localized(language) };
    throw e;
  }
}
readAmount('1,250.5', 'en'); // => { ok: true, paisa: 125050, shown: 'Rs. 1,250.50' }
readAmount('1.234', 'en'); // => { ok: false, code: 'TOO_MANY_DECIMALS', message: 'Amount can have at most two decimal places' }
readAmount('', 'ne').message; // => 'रकम राख्नुहोस्'
```

### 2. Invoice line with VAT

Quantities as decimal text, prices as paisa, one rounding per line.

```js test
import { Npr, vatExclusive } from 'jhigu-patro-utils-ts';

const lines = [
  { price: Npr.fromRupees(149.5), qty: '2' },
  { price: Npr.fromRupees(80), qty: '1.5' },
];
const subtotal = lines.map(l => l.price.timesDecimal(l.qty)).reduce((a, b) => a.plus(b), Npr.ZERO);
subtotal.paisa; // => 41900
const bill = vatExclusive(subtotal);
bill.vat.paisa; // => 5447
bill.total.format({ symbol: 'Rs.', decimals: 'always' }); // => 'Rs. 473.47'
```

### 3. Split a bill

Shares add up to the total, with no paisa lost.

```js test
import { Npr } from 'jhigu-patro-utils-ts';

const shares = Npr.fromRupees(1000).allocate([2, 1, 1]);
shares.map(n => n.paisa); // => [50000, 25000, 25000]
shares.reduce((a, b) => a.plus(b), Npr.ZERO).paisa; // => 100000

const odd = Npr.fromPaisa(10001).split(3);
odd.map(n => n.paisa); // => [3334, 3334, 3333]
odd.reduce((a, b) => a.plus(b), Npr.ZERO).paisa; // => 10001
```

### 4. Back out the VAT from a shelf price

```js test
import { Npr, vatInclusive } from 'jhigu-patro-utils-ts';

const r = vatInclusive(Npr.parse('Rs. 2,260'));
r.subtotal.format({ symbol: 'Rs.' }); // => 'Rs. 2,000'
r.vat.format({ symbol: 'Rs.' }); // => 'Rs. 260'
```

### 5. Amount in words for a voucher

```js test
import { Npr, amountInWords } from 'jhigu-patro-utils-ts';

const due = Npr.parse('रु १२,३४५.५०');
amountInWords(due); // => 'Rupees Twelve Thousand Three Hundred Forty-Five and Fifty Paisa Only'
amountInWords(due, { language: 'ne' }); // => 'बाह्र हजार तीन सय पैँतालीस रुपैयाँ पचास पैसा मात्र'
```

### 6. Money on the command line

The CLI reads an amount with `Npr.parse`. From the repo, run `node cli/dist/index.js`. Installed, the command is `jhigu-patro`. Options: `--vat excl|incl`, `--rate <percent>` (default 13), `--words`, `--lang en|ne`, `--json`.

```
$ jhigu-patro money 1234567.5 --vat excl --words
Amount:       Rs. 12,34,567.50
Paisa:        123456750
Devanagari:   रु १२,३४,५६७.५०
In words:     Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paisa Only

VAT 13% (added to the price):
  Subtotal:   Rs. 12,34,567.50
  VAT:        Rs. 1,60,493.78
  Total:      Rs. 13,95,061.28

$ jhigu-patro money 12345.50 --words --lang ne
Amount:       Rs. १२,३४५.५०
Paisa:        1234550
Devanagari:   रु १२,३४५.५०
In words:     बाह्र हजार तीन सय पैँतालीस रुपैयाँ पचास पैसा मात्र (Nepali words: not native-speaker reviewed)

$ jhigu-patro money abc
✖ Amount is not a valid number        (exit code 1)
```

`--json` prints `paisa`, `formatted`, `plain`, `devanagari`, and `words` and `vat` when asked. With `--lang ne` the formatted amount uses Devanagari digits and errors are in Nepali. An invalid option value (`--vat` other than `excl` or `incl`, `--lang` other than `en` or `ne`) exits with code 2. A `MoneyError` exits with code 1.

## Errors and edge cases

`MoneyError` has a stable `code`, an English `message`, and `localized('en' | 'ne')`. The Nepali messages are not reviewed by a native speaker.

| Code | When |
| --- | --- |
| `EMPTY` | `parse` got empty text or only a symbol. |
| `BAD_FORMAT` | `parse` got something that is not a number (`1Rs2`, `1.`, `.5`, a sign before and after the symbol). |
| `TOO_MANY_DECIMALS` | `parse` got more than two decimals. |
| `OUT_OF_RANGE` | A result is larger than `MAX_PAISA` in size. |
| `INVALID_ARGUMENT` | A non-integer where an integer is needed, NaN or Infinity, a divisor below 1, an empty or negative or all-zero allocation, a float passed to `timesDecimal`, an unknown `language`. |

Edge cases:

- `-0` is stored as 0. A negative amount that rounds to zero when formatted with `decimals: 'never'` shows no minus sign.
- `fromRupees` is for convenience. Rupees as a float may already have lost precision before the call (`1.005` is stored as a binary approximation). The method rounds the shortest decimal text of the double, which is what you wrote. For money you receive as text, use `parse`.
- Rounding is half away from zero everywhere, not banker's rounding.
- `Npr` does not overflow silently. A result outside the range throws.
- **`numberToWords` in English is wrong from 100,000,000,000,000 (10^14) up.** In TypeScript it returns text with the word `undefined` in it (`undefined lakh crore` for 10^14). In Dart it throws a `RangeError`. This happens because the crore count is spelled with a function that handles up to 99 lakh. The value is inside the documented limit (`MAX_PAISA` is about 9 x 10^15), so this is a bug. `amountInWords` is not affected, because it spells rupees, and the largest possible rupee count (90,071,992,547,409) is below 10^14. Only a direct call of `numberToWords(n)` in English with a very large `n` shows it. The Nepali path is not affected. Found by running the code while writing this guide. [SOURCE NEEDED] for an intended behaviour; the test vectors stop at 90,071,992,547,409.

## Accuracy, limits and known gaps

- **Range.** The size of an amount is at most 2^53 - 1 paisa (about 90 trillion rupees) in TypeScript and Dart alike, so Dart on the web behaves the same. The project guide's idea of `bigint` for larger amounts was not taken.
- **Nepali words are not native-speaker reviewed.** 38 of the 100 words are disputed between sources. The scale spelling अर्ब and खर्ब is unresolved. See [Nepali](#nepali).
- **Test vectors are hand-derived, not from an official source** (`data/MONEY_NOTES.md`).
- The Nepali labels in the money error messages and in the `words` group are not reviewed.
- Single currency. There is no formatting by locale other than the options above.
- English words use hyphens (`twenty-one`) and have no "and" inside a number. That is a choice recorded in the notes, not a rule from a source.
- A tax or accounting rule (VAT rate, rounding rule for a bill, how a cheque must be written) is outside what this library knows. [SOURCE NEEDED]

## How it is tested

- `ts/tests/money.test.ts` reads `testdata/money.json` and covers grouping, format, parse, constructors, arithmetic, allocate and split (including 10,000 random allocations that always add up), VAT, errors and their Nepali messages, range edges, and `numberToWords` against an independent converter for 0 to 999.
- `ts/tests/moneyWordsNe.test.ts` reads `testdata/money-words-ne.json`: 553 numbers and 79 amounts, made by `tools/check-words/make_vectors.py`, a model that cuts the decimal string instead of dividing. It shares the word table, so it tests how words are put together, not the words. It also checks that the table has 100 distinct words, that the generated copy matches the data file, that `reviewed` is false, and that every word has a label. Fourteen cases are copied by hand from the nepal-kit package's own tests.
- `dart/test/money_test.dart` and `dart/test/money_words_ne_test.dart` read the same vectors. Same input, same output in TS and Dart.
- `ts/tests/moneyInput.test.ts` and `dart/test/money_input_test.dart` test the money input.
- The `js test` blocks in this guide run in `ts/tests/docs.test.ts`. The Dart sample and the CLI output were run by hand against the repo.
- The vectors were not checked against any official source. The English test vectors for `numberToWords` do not reach the range where the bug above shows.

## Related guides

- [Headless widgets](../headless-widgets/README.md): `createMoneyInput` from `jhigu-patro-utils-ts/money-input`, a state machine that formats as you type.
- [Web components](../web-components/README.md): `<jhigu-money-input>`, a form-associated field.
- [Receipts](../receipts/README.md): receipts and invoices use `Npr`, VAT and amount in words, in English, Nepali or both.
- [Usage guide](../../USAGE.md): setup and the other features.
