# Money notes

Implemented: `Npr`, lakh grouping, format, parse, percent, times, timesDecimal, dividedBy,
allocate, split, VAT, English amount in words (guide section 9, except Nepali words).

## Decisions (guide is silent or left open)
- **Range:** |paisa| <= 2^53 - 1 in both TS and Dart (about 90 trillion rupees). The guide's
  [DECISION] to use `bigint` for larger amounts is not taken.
- **Intermediate maths** runs on BigInt in both languages, so percent/allocate cannot overflow.
- **`fromRupees(double)`** rounds the shortest decimal text of the double, half away from zero,
  so `1.005` gives 101 paisa and `0.285` gives 29. A plain `x * 100` would give 100 and 28.
- **`format`:** default symbol `none`, default decimals `auto`. `decimals: never` rounds to whole
  rupees (half away from zero) instead of cutting. A negative amount that rounds to zero shows no
  minus sign. Symbol and number are separated by one space.
- **`parse`:** the guide strips symbols anywhere; this strips them only at the start or the end,
  so `1Rs2` is an error instead of 12. A sign before or after the symbol is accepted, both is an
  error. Commas and spaces inside the number are removed, as in the guide (so `1,2,3` is 123).
  More than two decimals gives `TOO_MANY_DECIMALS`.
- **Errors:** `EMPTY`, `BAD_FORMAT`, `TOO_MANY_DECIMALS`, `OUT_OF_RANGE`, `INVALID_ARGUMENT`.
  Messages come from the `money` strings group; the Nepali wording is unreviewed.
- Dart cannot take a non-integer where TS tests pass `1.5` (int parameters); those vectors are
  skipped in Dart.

## Amount in words (English)
- `numberToWords(n)`: lower case, hyphenated tens (`twenty-one`), Indian scales (thousand, lakh,
  crore). No "and" inside the number. Above 99 crore the crore count is its own number
  (`one hundred crore`, `one lakh crore`). Hyphens and no inner "and" are my choice.
- `amountInWords(npr, options)` / `npr.inWords()`: `Rupees <words> [and <paisa words> Paisa] Only`.
  Zero rupees with paisa drops the rupee part (`Fifty Paisa Only`); zero overall is
  `Rupees Zero Only`; negative starts with `Minus`. `Paisa` is not pluralised.
- Labels (`Rupees`, `and`, `Paisa`, `Only`, `Minus`) come from the `words` strings group and can be
  overridden per call. `letterCase` is `title` or `lower`.
- Only `language: 'en'`; anything else throws `INVALID_ARGUMENT`.
- Tests compare 0..999 against a second, independently written converter, plus all scale
  boundaries and the maximum amount.

## Not done
- Nepali amount in words (M-8). Needs the 0-99 word table (`data/nepali-numbers.json`,
  [SOURCE NEEDED], native-speaker review). The `ne` values of the `words` strings group
  (`रुपैयाँ`, `पैसा`, `र`, `मात्र`, `ऋण`) are unreviewed and unused so far.
- Test vectors are hand-derived, not from an official source.
