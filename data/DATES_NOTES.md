# Dates notes (parser and fiscal year)

Implemented: `parseNepaliDate`, `fiscalYear`, `JhiguError` / `JhiguException` (guide 7.6, 7.7, 7.9).
Also implemented: the `NepaliDate` value class and arithmetic (7.4).
Also implemented: token formatter, presets, relative text and `formatAd` (7.5).
Also implemented: `getMonthGrid` (7.8). All of guide section 7 is now built except the legacy items listed below. The existing functional API in `nepaliCalendar.ts` /
`nepali_calendar.dart` is unchanged.

## Parser decisions
- Pattern list is the guide's plus `Y month D` (`2081 साल बैशाख 15 गते`, what the `gate` preset
  would produce). Without it the preset would not round-trip.
- All separators (`/ . , -` and spaces) are treated alike, always, not only for non-ISO input.
- A leading weekday (full or short, English or Nepali) is dropped.
- Era words removed: `वि.सं.`, `वि.सं`, `सम्वत्`, `संवत्`, `साल`, `गते`, and the standalone word `bs`.
- Year must have exactly 4 digits; day and month at most 2. `01 15 2081` is read as day 1, month 15
  (invalid), not as month/day/year.
- Month names: canonical English (full and short) and Nepali (full) names from the strings tables,
  plus `data/month-aliases.json`. English short `ash` means Ashadh (as the formatter prints it);
  Ashwin's short form is `asw`. Nepali short names are not accepted (one letter, ambiguous).
- **Alternate spellings beyond the guide's list** (Sawan, Saun, Bhadau, Phalgun, Fagun, Chait,
  Margashirsha, Kartick, Push, and the Sanskrit Nepali forms) are common spellings I added without
  a source. Native-speaker review needed. The generator fails if one spelling maps to two months.
- Errors: unreadable text or a date that does not exist gives `PARSE_ERROR` with the original text
  in `details`, as the guide says (not `INVALID_DATE`).

## Fiscal year
- Starts Shrawan 1 (month 4). `code` is `2081/82`; start 2099 gives `2099/00`.
- `INVALID_DATE` for a date that does not exist; `OUT_OF_RANGE` when the fiscal year needs a year
  outside the data (for example any date in BS 2000 months 1-3, or BS 2100 from Shrawan).
- Last-day vectors read from `data/nepali_calendar_data.json`; years after 2083 are unverified
  (see CALENDAR_NOTES.md).

## Tests
`testdata/dates.json`: 93 valid inputs (hand-written, every pattern, every canonical month name
in both languages, every alternate), 23 invalid inputs, 8 fiscal years, 3 fiscal errors.
The guide's other vector groups (`adToBs`, `format`, `grid`, time-zone matrix) are not written yet.

## NepaliDate class (7.4)
- **TS naming:** the old plain `NepaliDate` interface is now `NepaliDateFields`; `NepaliDate` is the
  class. `convertADToBS`, `getCurrentNepaliDate` and `parseNepaliDate` still return plain
  `NepaliDateFields` (runtime unchanged, JSON unchanged); wrap with `NepaliDate.from()`. Code that
  typed a result as `NepaliDate` needs the type renamed.
- **Validation:** TS `new NepaliDate(y, m, d)` validates (`INVALID_DATE`, or `OUT_OF_RANGE` for a year
  outside the data). Dart keeps its existing `const NepaliDate(...)` unvalidated for compatibility and
  adds `NepaliDate.checked(...)`. Dart `toString` is unchanged; use `toIsoString()` (TS `toString` is ISO).
- **Day numbers:** whole days since 1970-01-01 UTC, computed from integer offsets, never from local
  `Date` objects. Found by test: under `Pacific/Kiritimati` the day 1994-12-31 does not exist locally, so
  anything routed through a local-midnight `Date` was off by a day. `toAD()` in TS still returns local
  midnight (guide D-4) and gives the next day in such a zone; day numbers and `fromAD` are unaffected.
- `diff(other, unit)` is `this - other`. Months step back one if the later day is smaller; years are
  whole months / 12 toward zero. `addMonths` clamps the day. Out-of-range results throw `OUT_OF_RANGE`.
- Existing `convertADToBS` / `convertBSToAD` do not range-check (TS returns nonsense outside the data,
  Dart throws `ArgumentError`). The class checks the range itself. Making the old functions throw
  `OUT_OF_RANGE` (guide 7.2 step 3) is still open.
- Weekday is checked against the AD date's weekday for every day BS 2000-2100, and `addDays`
  against plain AD arithmetic. Arithmetic vectors were derived with an independent Python converter.

## Formatter (7.5)
- API: `formatDate(date, pattern, language, {digits})`, `formatPreset(date, preset, language, {today})`,
  `formatAd(date, pattern, language, {digits})` (Dart: named params, `asciiDigits`, `DatePreset` enum).
  Presets are a separate function, so a pattern can never be mistaken for a preset name.
- Tokens as in the guide (`YYYY YY MMMM MMM MM M dddd ddd DD D`, `[literal]`). In Nepali, token digits
  are Devanagari; digits inside `[literal]` text are left as typed. `iso`, `slash`, `dmy`, `fiscal` are
  ASCII always.
- `MMM` uses `monthsShort`, which for Nepali is one letter and ambiguous (see STRINGS_NOTES.md), so
  Nepali `short` output is poor until that table is replaced.
- `gate` uses the `format.gatePattern` string: Nepali is the guide's `YYYY साल MMMM D गते`; English is
  my choice `[BS] YYYY MMMM D` (it parses back). `dual` uses `format.dualPattern`
  (`15 Baisakh 2081 (AD 27 April 2024)`). The AD part of `dual` keeps ASCII digits in Nepali, reading
  the guide's "Devanagari for BS" literally; that gives mixed text like `१५ बैशाख २०८१ (ई.सं. 27 अप्रिल 2024)`.
  Say if you want Devanagari there too.
- `relative`: compares with `today` (default: today in Nepal). 0 today; 1 yesterday/tomorrow; up to 30
  days uses days; then whole months up to 12; then whole years. 31 days can be under one whole month
  (32-day months), so that case still says days. Month/year singular forms are separate strings.
- The formatter does not replace `formatNepaliDate`, `formatNepaliDateWithDay` or
  `getRelativeTimeInNepali`; rewiring those to these functions is still open (it changes `'en'` output).
- Vectors (`formatTokens`, `formatPresets`, `formatRelative`, `formatAd`) were produced by a separate
  Python formatter that reads the strings files; values were spot-checked by eye
  (BS 2081-01-15 is AD 2024-04-27, a Saturday).

## Month grid (7.8)
- `getMonthGrid(year, month, {weekStartsOn, events, getEvents, weekendDays, sixRows, today})` returns
  rows of 7 `GridCell`s (`bs`, `ad`, `inMonth`, `inRange`, `isToday`, `isWeekend`, `events`). 5 or 6
  rows; `sixRows` forces 6. Leading and trailing cells show the neighbouring months when they are in
  the data, otherwise blank cells (`bs`/`ad` null, `inRange` false).
- Events: a map keyed `YYYY-MM-DD` (also matches neighbouring-month cells) and/or a callback called
  once per dated cell on every call, never cached. Both given: map events first, then callback events.
  Events are generic (`GridCell<E>`); the guide's `GridEvent` shape is not fixed.
- `weekendDays` option is mine (default Saturday only, as in the guide). `today` is injectable.
- A bad `weekStartsOn` gives `INVALID_DATA`; a month outside the data gives `OUT_OF_RANGE`, a
  non-existent month `INVALID_DATE`.
- TS `ad` is local midnight like `toAD()`; in a zone that skipped that day (Kiritimati 1994-12-31) it is
  the next day, `bs` is always exact. Dart `ad` is UTC midnight.
- **CalendarController** (`ts/src/calendar_controller.ts`) now builds its flat 7-column list from
  `getMonthGrid`. Same public API and same cells (padding cells for days outside the month), checked
  against the old builder for every month of BS 2075-2085. Changes:
  - weekdays and AD range label come from day numbers, not local `Date`s (no time-zone sensitivity);
  - optional third constructor argument `today` for tests;
  - navigation builds the new grid first, so moving outside the calendar data throws `OUT_OF_RANGE`
    and leaves the controller unchanged (before, the year/month were changed and the build then failed);
  - padding cells now carry their column as `weekdayIndex` (trailing ones were always 0);
  - the English month abbreviations come from the strings table (`adMonthsShort`).
  Still unchanged: `bsLabel` uses the old `NEPALI_MONTHS_NE` constant and `toNepaliDigits`; the demo UI
  (`calendar_section.ts`) was not changed or run in a browser.
- Vectors (`grid.cases`): 12 months including the first and last month of the data, 5- and 6-row
  months, forced six rows and four week-start days, from an independent Python day-number model.

## Old formatters rewired to the strings tables
`NEPALI_MONTHS_EN/NE`, `ENGLISH_MONTHS`, `NEPALI_DAYS_EN/NE` (TS) and `nepaliMonthsEn/Ne`, `englishMonths`,
`nepaliDaysEn/Ne` (Dart) are now views over `data/strings.{en,ne}.json`. `getNepaliMonthName`,
`getNepaliDayName`, `formatNepaliDate`, `formatEnglishDate`, `formatNepaliDateWithDay` and
`getRelativeTimeInNepali` read the same tables, so there is one source for names.
- **Output change (intended):** English BS month 3 is `Ashadh` (was `Asar`); English weekday names are
  `Sunday`... (were `Aaitabar`, `Sombar`, `Mangalbar`, `Budhabar`, `Bihibar`, `Shukrabar`, `Shanibar`).
  Nepali output is unchanged. `formatNepaliDate` keeps ASCII digits in Nepali (`असार 5, 2081`) and its
  `Month D, YYYY` shape. Anything that displays or compares these English strings (the demo UI, the
  CLI, your own code) now sees the new names.
- **Type change (TS):** the constants are `readonly string[]` (were literal tuples).
- **Bug fixed:** TS `getRelativeTimeInNepali` turned a Nepal-shifted `Date` into a BS date by reading
  its *local* fields, which is wrong in any zone that is not UTC. In Kathmandu it showed the BS date one
  day ahead in the evening. It now reads UTC fields. Dart was not affected (its dates are UTC).
- **`formatNepaliDateWithDay`** (TS) takes the weekday from the BS date's day count; `adDate` is only a
  compatibility hint (used for the weekday when given). It now throws `Error` as before for a date
  outside the data (via `bsToDaysSinceBase`), not `JhiguError`.
- Dart `getRelativeTimeInNepali` gained an optional `now:` for tests.
- Not changed: `toNepaliDigits`, `formatNepalDateTime`, the `NEPALI_DIGITS` table, and the demo UI's own
  formatting strings in `calendar_section.ts` (it reads the constants above, so its English labels change).
