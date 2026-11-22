# Money notes

Implemented: `Npr`, lakh grouping, format, parse, percent, times, timesDecimal, dividedBy,
allocate, split, VAT, amount in words in English and Nepali (guide section 9; the Nepali words come from one package, every word compared with web tables, 38 of them spelled differently in at least one, and are not native-speaker reviewed).

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
- `language: 'en'` (default) or `'ne'`; anything else throws `INVALID_ARGUMENT`.
- Tests compare 0..999 against a second, independently written converter, plus all scale
  boundaries and the maximum amount.

## Amount in words (Nepali, M-8)
- **Status: taken from one package (nepal-kit), every word compared with three web tables, not native-speaker reviewed.** The 100
  words (0-99) in `data/nepali-numbers.json` were taken, with the owner's go-ahead, from `lohanidamodar/nepal-kit`
  (`packages/nepal_kit/lib/src/number/amount_words.dart`, read 2026-11-21). That package says its tables came from another
  package, so this is one lineage. Each word is compared with nepalilanguage.org/numbers (0-99: 0-30 read by a tool, the rest
  pasted by the project owner on 2026-11-21), with a third full 0-100 table the owner pasted (address not given) and, for 0-22,
  30, 40 and 100, with Wikipedia "Numbers in Nepali language". The file records the result per word (`review`): 62
  `two-sources` (nepal-kit and a table agree, none differ), 0 `single-source`, 38 `disputed`; `variants` lists the other spelling
  seen. Disputed words: 0, 3, 10, 20, 24, 25, 26, 28, 29, 30-48, 54, 59 and 91-98. Most are one pattern: nepal-kit (and, for
  20, 30 and 40, Wikipedia) write the long vowel (`बीस`, `तीस`, `चालीस`, `एकतीस`, `एकचालीस`) where nepalilanguage.org and the pasted
  table write the short one (`बिस`, `तिस`, `चालिस`, `एकतिस`, `एकचालिस`). Others: 0 (`शून्य` vs `सुन्ना`), 3 (`तीन` vs `तिन`), 10 (`दश` vs `दस`),
  28 (`अठ्ठाइस` vs `अट्ठाइस`), 34 (`चौँतीस` vs `चौँतिस` and `चौतिस`), 54 (`चउन्न` vs `चवन्न`), 59 (`उनन्साठी` vs `उनसट्ठी` in the
  pasted table) and 91-98 (`एकानब्बे` in nepal-kit and nepalilanguage.org, `एकान्नब्बे` in the pasted table). The web tables
  disagree with each other (34, 59, 91-98) and are not always consistent inside themselves (nepalilanguage.org uses the long vowel
  in the 60s, `एकसट्ठी`; the pasted table's own ordinals say `उनन्साठिऔँ` but its cardinal says `उनसट्ठी`). They are web pages, not a
  dictionary or printed reference, and nothing here has been checked by a Nepali speaker: someone who reads Nepali has to say
  which of these spellings is standard.
- A fourth table (a converter page, pasted by the owner, address not given) is recorded in `fourthTable` and not used for `review`:
  it has a Cyrillic letter in 54 and a stray joiner in 97, and on 11 words (55, 58, 62, 64, 65, 66, 76, 78, 79, 80, 83) it
  disagrees with nepal-kit and both other web tables, which agree with each other. It agrees with nepal-kit's long vowel on 12
  disputed words (3, 20, 24, 26, 28, 29, 30, 38, 39, 40, 41, 43) but writes the short one on others (31-36, 42, 44-46), so **no
  table is consistent about long versus short vowel** and counting tables cannot settle it. It spells the scales `अरब` and `खरब`
  where nepal-kit and the guide have `अर्ब` and `खर्ब`; the code uses the latter.
- Scales: सय, हजार, लाख, करोड, अर्ब, खर्ब (guide 9.5 and nepal-kit; सय, हजार, लाख and करोड also in the pasted table, अर्ब and खर्ब only there). Groups: two digits, one for सय, then pairs.
- **No 10^13 limit** (the guide says to throw above it): `Npr` goes up to about 9x10^13 rupees, so the खर्ब count is spoken as its
  own number, the same choice as English `one hundred crore`. The largest amount is `नब्बे हजार एकहत्तर खर्ब ...`.
- Wrapper: `<rupee words> रुपैयाँ [<paisa words> पैसा] मात्र` (the guide's shape; no `र` between them, the `and` string `र` is
  unused unless you pass `joiner`). `ऋण` first when negative. Zero rupees with paisa drops the rupee part; zero is
  `शून्य रुपैयाँ मात्र`. `letterCase` has no effect. New option `rupeesLabel` (Nepali only), `prefix` and `joiner` are empty in Nepali.
- `numberToWords(n, 'ne')` (Dart: `numberToWords(n, language: 'ne')`) gives the number alone.
- Tests: `testdata/money-words-ne.json` (553 numbers, 79 amounts) is made by `tools/check-words/make_vectors.py`, an independent
  digit-group model (it cuts the decimal string instead of dividing). It shares the word table, so it checks how words are put
  together, not the words. 14 cases are copied by hand from nepal-kit's own tests, a second author's expectations; the model
  agrees with all of them. Mutation check: 10 mutants caught in each language (labels swapped, scale skipped, minus dropped,
  zero rules, label order, joiner, leaks into English); one mutant (a float division instead of the exact one) survives because
  it is equivalent for safe integers.
- The receipt (TS HTML and Dart PDF) shows the Nepali words for `ne`, English for `en` and `bilingual`. The CLI
  `money --words --lang ne` prints them.
- To review: someone who reads Nepali should check all 100 words, above all the 38 disputed ones (mostly the long or short vowel),
  then set `reviewed` to true and fix any word in `data/nepali-numbers.json` (then run `node tools/gen-data/gen.mjs` and
  `python3 -I tools/check-words/make_vectors.py`).

## Not done
- Native-speaker review of the Nepali words and of the `ne` values of the `words` strings group
  (`रुपैयाँ`, `पैसा`, `र`, `मात्र`, `ऋण`; `र` is unused by default).
- Test vectors are hand-derived, not from an official source.
