# Strings notes

`strings.en.json` / `strings.ne.json` are the label tables (guide section 5.5).
`node tools/check-strings/check.mjs` enforces identical keys, array sizes,
non-empty values and matching `{placeholders}`; CI runs it.

## Needs native-speaker review (not done)

Month, weekday and digit names come from the existing library. Everything else
in `ne` was written by an AI and is **unreviewed**: `monthsShort`, `adMonths`,
`relative`, `accuracy`, `picker`, `phone`, `receipt`. Review before release.

## Known differences from current library behaviour

- `weekdays` (en) is `Sunday…`; the current lib's `'en'` output is romanised
  Nepali (`Aaitabar…`). Pick one when the formatter is rewired to these tables.
- `months` (en) uses `Ashadh`; the current lib uses `Asar`. The parser (D-14) must accept both.
- `monthsShort` (ne) uses first letters and is ambiguous (असार/असोज both `अ`). Replace with a proper convention.
- `relative.today/yesterday/tomorrow/daysAgo/daysLater` are new; the lib does not use them yet.

## Added for the date formatter (all unreviewed, my wording)
- `relative`: month and year forms (`monthAgo`, `monthsLater`, `yearAgo`, ...). English singulars are
  "a month ago" / "in a year"; Nepali singulars write the digit (`१ महिना अघि`).
- `adMonthsShort` (en and ne). The Nepali short AD names are my abbreviations.
- `format.gatePattern`: English `[BS] YYYY MMMM D` is my choice (the parser reads it back);
  Nepali `YYYY [साल] MMMM D [गते]` is the guide's pattern.
- `format.dualPattern`: `{bs} (AD {ad})` and `{bs} (ई.सं. {ad})`. The guide only says "for example
  `... (AD ...)`"; the exact shape is my choice.
