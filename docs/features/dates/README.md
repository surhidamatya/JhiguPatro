# Dates

Bikram Sambat (BS) dates in TypeScript and Dart. `NepaliDate` is an immutable date value with arithmetic and comparison. Around it are conversion between BS and AD (Gregorian), a token formatter with presets, a parser that reads many spellings (including Devanagari digits), the Nepali fiscal year, a month grid for calendar views, and the localized name tables (`getStrings`). Everything works on calendar fields and whole day counts, so the time zone of the machine cannot change a result. The same input gives the same output in TypeScript and Dart; both read the shared vectors in `testdata/dates.json`.

## When to use it

- You store or show BS dates and need to convert from or to AD.
- You add days or months to a date, compare dates, or count the days, months or years between two.
- You print a date in English or Nepali (Devanagari digits), or read one that a user typed.
- You need the fiscal year of a date, or the cells of a month for a calendar.

## Setup

All of it needs the calendar data loaded once at start-up. The first sample does that; see the [calendar data guide](../calendar-data/README.md) for each environment (browser, SSR, Flutter, Dart server). The samples in this guide run in the `ts/` folder of the repo.

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

// Node: read the file yourself. (Adjust the path for your project.)
const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));
```

The data covers BS 2000/1/1 (AD 1943-04-14) to BS 2100/12/31 (AD 2044-04-13). Years after 2083 are not verified against the official calendar; see [Accuracy, limits and known gaps](#accuracy-limits-and-known-gaps).

## Quick start (TypeScript)

```js test
import { NepaliDate, convertADToBS, convertBSToAD } from 'jhigu-patro-utils-ts';

const d = new NepaliDate(2082, 5, 10);
d.toString(); // => '2082-05-10'
d.weekday; // => 2
d.dayNumber(); // => 20326
d.daysInMonth; // => 31
d.addDays(25).toString(); // => '2082-06-04'
d.addMonths(1).toString(); // => '2082-06-10'
d.endOfMonth().toString(); // => '2082-05-31'
d.isBefore({ year: 2082, month: 5, day: 11 }); // => true
d.toAD().toDateString(); // => 'Tue Aug 26 2025'
NepaliDate.fromAD(new Date(2025, 7, 26)).toString(); // => '2082-05-10'
NepaliDate.isValid(2082, 5, 32); // => false

// The older functions return plain { year, month, day } fields.
convertADToBS(new Date(2024, 3, 13)); // => { year: 2081, month: 1, day: 1 }
convertBSToAD(2081, 1, 1).toDateString(); // => 'Sat Apr 13 2024'
```

`d.weekday` is 0 for Sunday to 6 for Saturday. 2082-05-10 is a Tuesday.

## Quick start (Dart)

The Dart code is the same library with Dart naming. Set up the calendar as in the [calendar data guide](../calendar-data/README.md), then:

```dart
final d = NepaliDate.checked(2082, 5, 10);
d.toIsoString();                              // 2082-05-10
d.weekday;                                    // 2 (a getter, not a method)
d.dayNumber;                                  // 20326 (a getter)
d.addDays(25);                                // NepaliDate(2082/6/4)
d.addMonths(1);                               // NepaliDate(2082/6/10)
d.endOfMonth();                               // NepaliDate(2082/5/31)
d < NepaliDate.checked(2082, 5, 11);          // true
d.toAD();                                     // 2025-08-26 00:00:00.000Z (UTC midnight)
NepaliDate.fromAD(DateTime(2025, 8, 26));     // NepaliDate(2082/5/10)

NepaliCalendar.convertADToBS(DateTime.utc(2024, 4, 13)); // NepaliDate(2081/1/1)
NepaliCalendar.convertBSToAD(2081, 1, 1);                // 2024-04-13 00:00:00.000Z
```

Differences from TypeScript that matter:

- The `const NepaliDate(year:, month:, day:)` constructor does not check the date (kept for existing code). Use `NepaliDate.checked(y, m, d)`, which validates. `NepaliDate(year: 2082, month: 5, day: 32)` is accepted silently.
- `toString()` gives `NepaliDate(2082/5/10)`. Use `toIsoString()` for `2082-05-10`. In TypeScript `toString()` is the ISO form.
- `weekday` and `dayNumber` are getters. `<`, `>`, `<=`, `>=` and `==` work, and `NepaliDate` is `Comparable`.
- `toAD()` returns UTC midnight. TypeScript returns local midnight.
- There is no `NepaliDate.from`; the date type is the same class everywhere.

## API reference

TypeScript names come from `jhigu-patro-utils-ts`. Dart names come from `package:jhigu_patro_utils/jhigu_patro_utils.dart`. `JhiguError` codes are `INVALID_DATE`, `OUT_OF_RANGE`, `INVALID_DATA` and `PARSE_ERROR` (Dart: `InvalidDateException`, `OutOfRangeException`, `InvalidDataException`, `ParseException`).

### NepaliDate

| Name (TypeScript / Dart) | What it does | Throws |
|--------------------------|--------------|--------|
| `new NepaliDate(y, m, d)` / `NepaliDate.checked(y, m, d)` | Checked constructor. TypeScript instances are frozen. | `INVALID_DATE` for a date that does not exist or non-integers; `OUT_OF_RANGE` for a year outside the data. |
| `NepaliDate.from(fields)` | Wraps plain `{ year, month, day }` (checked). TypeScript only. | As the constructor. |
| `NepaliDate.isValid(y, m, d)` | `true` if the date exists and is in range. | Nothing. |
| `NepaliDate.fromAD(date)` | BS date of an AD date. Reads the year, month and day only; the time is ignored. | `OUT_OF_RANGE` outside 1943-04-14 to 2044-04-13. |
| `NepaliDate.fromDayNumber(n)` | Date for a count of whole days since 1970-01-01 UTC. | `INVALID_DATE` for a non-integer (TypeScript); `OUT_OF_RANGE` outside the data. |
| `NepaliDate.today(now?)` / `today({now})` | Today in Nepal (UTC+05:45), whatever the device time zone. Pass `now` in tests. | `OUT_OF_RANGE` if the clock is outside the data. |
| `daysInMonth` | Days in this month. | Nothing. |
| `weekday` | 0 Sunday to 6 Saturday. | Nothing. |
| `dayNumber()` / `dayNumber` | Whole days since 1970-01-01 UTC. | Nothing. |
| `toAD()` | The AD date (TypeScript local midnight, Dart UTC midnight). | Nothing. |
| `addDays(n)` | Adds whole days. | `INVALID_DATE` if `n` is not an integer (TypeScript); `OUT_OF_RANGE` if the result leaves the data. |
| `addMonths(n)` | Adds months; the day is clamped to the length of the target month. | `OUT_OF_RANGE` if the result leaves the data. |
| `addYears(n)` | `addMonths(n * 12)`. | As `addMonths`. |
| `diff(other, unit)` | `this - other` in `'days'` (default), `'months'` or `'years'` (Dart: `DiffUnit`). | Nothing for valid dates. |
| `compare`, `isBefore`, `isAfter`, `isSame` | Compare as (year, month, day). Needs no calendar data. | Nothing. |
| `startOfMonth()`, `endOfMonth()` | First and last day of the month. | Nothing. |
| `toString()`, `toJSON()`, `valueOf()` | TypeScript: ISO text, plain fields, day number (so `<` works). Dart: `toIsoString()`. | Nothing. |

### Conversion

| Name | What it does | Throws |
|------|--------------|--------|
| `convertADToBS(date)` | AD `Date` to plain BS fields. | `OUT_OF_RANGE` outside the data; `INVALID_DATE` for an invalid `Date`. |
| `convertBSToAD(y, m, d)` | BS date to AD `Date`. | `OUT_OF_RANGE` for a year outside the data; `INVALID_DATE` for a date that does not exist. |
| `NepaliCalendar.convertADToBS`, `NepaliCalendar.convertBSToAD` | Dart equivalents; return `NepaliDate` and `DateTime`. | `OutOfRangeException`, `InvalidDateException`. |

### Formatting, parsing and the rest

| Name | What it does | Throws |
|------|--------------|--------|
| `formatDate(date, pattern, language?, { digits? })` | Formats a BS date with tokens. Dart: `formatDate(date, pattern, language:, asciiDigits:)`. | `INVALID_DATE` for a date that does not exist. |
| `formatAd(date, pattern, language?, { digits? })` | Same tokens for an AD `Date`, with AD month names. | Nothing. |
| `formatPreset(date, preset, language?, { today? })` | Named format (see presets). Dart: `DatePreset` enum, `today:` parameter. | `INVALID_DATE`; `INVALID_DATA` for an unknown preset. |
| `parseNepaliDate(text)` | Reads a BS date from text. | `PARSE_ERROR` for unreadable text or a date that does not exist. |
| `fiscalYear(date)` | Fiscal year containing the date: `start`, `end`, `code`, `first`, `last`. | `INVALID_DATE`; `OUT_OF_RANGE` if the fiscal year leaves the data. |
| `getMonthGrid(year, month, options?)` | Rows of 7 cells for a month view. | `INVALID_DATE` or `OUT_OF_RANGE` for the month; `INVALID_DATA` for a bad `weekStartsOn`. |
| `getStrings(language)` | Label tables (month and weekday names and more) for `'en'` or `'ne'`. | Nothing. Any other value returns the English table. |
| `formatNepaliDate`, `formatEnglishDate`, `getNepaliMonthName`, `getNepaliDayName`, `formatNepaliDateWithDay`, `toNepaliDigits`, `formatNepalDateTime`, `getRelativeTimeInNepali`, `getCurrentNepaliDate`, `getCurrentNepaliDateFormatted` | The older helpers; see [Older formatting helpers](#older-formatting-helpers). Dart: static methods of `NepaliCalendar`. | See that section. |

## Arithmetic and comparison

Arithmetic goes through day numbers: whole days since 1970-01-01 UTC, computed from the month-length table, never from a local `Date`.

```js test
import { NepaliDate } from 'jhigu-patro-utils-ts';

const d = new NepaliDate(2082, 5, 10);

// addMonths clamps the day to the length of the target month.
new NepaliDate(2082, 6, 31).addMonths(1).toString(); // => '2082-07-30'
new NepaliDate(2082, 3, 32).addMonths(1).toString(); // => '2082-04-31'
d.addMonths(-5).toString(); // => '2081-12-10'
d.addYears(1).toString(); // => '2083-05-10'

// diff is this - other. Months and years count whole units.
new NepaliDate(2082, 6, 4).diff(d); // => 25
new NepaliDate(2082, 8, 9).diff(d, 'months'); // => 2
new NepaliDate(2082, 8, 10).diff(d, 'months'); // => 3
new NepaliDate(2084, 5, 9).diff(d, 'years'); // => 1
d.diff(new NepaliDate(2082, 8, 10), 'months'); // => -3

// Compare as (year, month, day).
NepaliDate.compare({ year: 2082, month: 5, day: 10 }, d); // => 0
d.isSame({ year: 2082, month: 5, day: 10 }); // => true
d < new NepaliDate(2082, 5, 11); // => true
JSON.stringify({ d }); // => '{"d":{"year":2082,"month":5,"day":10}}'
```

Rules, from the code:

- `diff` in months: the whole months between the two dates, stepping back one when the later date's day is smaller than the earlier one's. In years: whole months divided by 12, toward zero. The sign follows `this - other`.
- `addMonths` and `addYears` clamp the day (above). `addDays` never clamps.
- Any result outside BS 2000 to 2100 throws `OUT_OF_RANGE`; nothing wraps around.
- `compare` works on the fields only, so it needs no data. `valueOf()` returns the day number, so `<` and `>` work in TypeScript.
- `toJSON()` gives `{ year, month, day }`, the same shape as the plain fields.

## Conversion between BS and AD

`convertADToBS` and `convertBSToAD` are the original functions. They return plain fields (TypeScript) or `NepaliDate` and `DateTime` (Dart). `NepaliDate.fromAD` and `toAD()` do the same job on the class.

```js test
import { NepaliDate, convertADToBS, convertBSToAD, JhiguError } from 'jhigu-patro-utils-ts';

// The time of day is ignored: only the calendar date is read.
NepaliDate.fromAD(new Date(2025, 7, 26, 23, 59)).toString(); // => '2082-05-10'
convertADToBS(new Date(2024, 3, 12)); // => { year: 2080, month: 12, day: 30 }
convertADToBS(new Date(2024, 3, 13)); // => { year: 2081, month: 1, day: 1 }

// First and last day of the data.
convertADToBS(new Date(2044, 3, 13)); // => { year: 2100, month: 12, day: 31 }
convertBSToAD(2100, 12, 31).toDateString(); // => 'Wed Apr 13 2044'

let code;
try { convertADToBS(new Date(2044, 3, 14)); } catch (e) { code = e instanceof JhiguError && e.code; }
code; // => 'OUT_OF_RANGE'
try { convertBSToAD(2082, 1, 0); } catch (e) { code = e instanceof JhiguError && e.code; }
code; // => 'INVALID_DATE'
```

In a time zone that skipped a calendar day (Pacific/Kiritimati has no 31 December 1994), JavaScript cannot build local midnight for that day, so `toAD()` and the `ad` of a grid cell give the next day there. The `NepaliDate` side (`fromAD`, day numbers) is exact. See the [calendar data guide](../calendar-data/README.md) for how Nepal time is handled.

## Formatting

### Tokens

`formatDate(date, pattern, language = 'en', { digits })` replaces these tokens. Longer tokens win, and text in `[brackets]` is copied as written.

| Token | Meaning | Example (2082-05-10, Tuesday) |
|-------|---------|-------------------------------|
| `YYYY` | Year, 4 digits | `2082` |
| `YY` | Year, last 2 digits | `82` |
| `MMMM` | Month name | `Bhadra` / `भदौ` |
| `MMM` | Short month name | `Bha` / `भ` |
| `MM`, `M` | Month number, padded or not | `05`, `5` |
| `dddd`, `ddd` | Weekday name, full or short | `Tuesday`, `Tue` |
| `DD`, `D` | Day, padded or not | `10`, `10` |

In Nepali, the digits the tokens produce are Devanagari unless you pass `{ digits: 'ascii' }` (Dart: `asciiDigits: true`). Digits inside `[literal]` text are left as typed. The Nepali short month name is one letter and is ambiguous (see `data/STRINGS_NOTES.md` and `data/DATES_NOTES.md`), so the Nepali `short` preset gives poor output until that table is replaced.

```js test
import { formatDate, formatAd } from 'jhigu-patro-utils-ts';

const d = { year: 2082, month: 5, day: 10 };
formatDate(d, 'YYYY/MM/DD'); // => '2082/05/10'
formatDate(d, 'YY M D MMM ddd'); // => '82 5 10 Bha Tue'
formatDate(d, '[Date:] D MMMM YYYY'); // => 'Date: 10 Bhadra 2082'
formatDate(d, 'D MMMM YYYY', 'ne'); // => '१० भदौ २०८२'
formatDate(d, 'D MMMM YYYY', 'ne', { digits: 'ascii' }); // => '10 भदौ 2082'
formatDate(d, 'dddd, D MMMM YYYY', 'ne'); // => 'मंगलबार, १० भदौ २०८२'

// AD dates use the same tokens and the AD month names.
formatAd(new Date(2025, 7, 26), 'dddd, D MMMM YYYY'); // => 'Tuesday, 26 August 2025'
formatAd(new Date(2025, 7, 26), 'D MMMM YYYY', 'ne'); // => '२६ अगस्ट २०२५'
```

### Presets

`formatPreset(date, preset, language = 'en', { today })` formats with a named preset. Output for 2082-05-10:

| Preset | English | Nepali |
|--------|---------|--------|
| `full` | `Tuesday, 10 Bhadra 2082` | `मंगलबार, १० भदौ २०८२` |
| `long` | `10 Bhadra 2082` | `१० भदौ २०८२` |
| `iso` | `2082-05-10` | `2082-05-10` |
| `slash` | `2082/05/10` | `2082/05/10` |
| `dmy` | `10/05/2082` | `10/05/2082` |
| `short` | `10 Bha 2082` | `१० भ २०८२` |
| `monthYear` | `Bhadra 2082` | `भदौ २०८२` |
| `gate` | `BS 2082 Bhadra 10` | `२०८२ साल भदौ १० गते` |
| `dual` | `10 Bhadra 2082 (AD 26 August 2025)` | `१० भदौ २०८२ (ई.सं. 26 अगस्ट 2025)` |
| `relative` | `2 days ago` (reference day 2082-05-12) | `२ दिन अघि` |
| `fiscal` | `2082/83` | `2082/83` |

`iso`, `slash`, `dmy` and `fiscal` always use ASCII digits. In `dual` the AD part keeps ASCII digits, so Nepali output mixes digit styles. `gate` and `dual` come from the string tables (`format.gatePattern`, `format.dualPattern`). The `gate` text parses back with `parseNepaliDate` in both languages.

`relative` compares the date with `today` (default: today in Nepal; pass `today` in tests): 0 days is today, 1 is yesterday or tomorrow, up to 30 days counts days, then whole months up to 12, then whole years. A gap of 31 days can be under one whole month (months have up to 32 days), so that case still says days.

```js test
import { formatPreset, JhiguError } from 'jhigu-patro-utils-ts';

const d = { year: 2082, month: 5, day: 10 };
formatPreset(d, 'iso'); // => '2082-05-10'
formatPreset(d, 'gate', 'ne'); // => '२०८२ साल भदौ १० गते'
formatPreset(d, 'dual'); // => '10 Bhadra 2082 (AD 26 August 2025)'
formatPreset(d, 'relative', 'en', { today: { year: 2082, month: 5, day: 12 } }); // => '2 days ago'
formatPreset(d, 'relative', 'en', { today: { year: 2082, month: 5, day: 3 } }); // => 'in 7 days'
formatPreset(d, 'relative', 'en', { today: d }); // => 'today'
formatPreset(d, 'relative', 'en', { today: { year: 2082, month: 8, day: 10 } }); // => '3 months ago'
formatPreset(d, 'relative', 'ne', { today: { year: 2082, month: 5, day: 11 } }); // => 'हिजो'
formatPreset(d, 'fiscal'); // => '2082/83'

let code;
try { formatPreset(d, 'nope'); } catch (e) { code = e instanceof JhiguError && e.code; }
code; // => 'INVALID_DATA'
```

### Dart

```dart
formatDate(d, 'D MMMM YYYY');                                        // 10 Bhadra 2082
formatDate(d, 'dddd, D MMMM YYYY', language: 'ne');                  // मंगलबार, १० भदौ २०८२
formatDate(d, 'YYYY-MM-DD', language: 'ne', asciiDigits: true);      // 2082-05-10
formatAd(DateTime(2025, 8, 26), 'D MMM YYYY');                       // 26 Aug 2025
formatPreset(d, DatePreset.gate, language: 'ne');                    // २०८२ साल भदौ १० गते
formatPreset(d, DatePreset.relative, today: NepaliDate.checked(2082, 5, 12)); // 2 days ago
```

`DatePreset` has the values `full, long, iso, slash, dmy, short, monthYear, gate, dual, relative, fiscal`.

## Parsing

`parseNepaliDate(text)` returns plain `{ year, month, day }` (Dart: a `NepaliDate`) and checks the day against the month length.

What it accepts, from the code and `data/DATES_NOTES.md`:

- ASCII or Devanagari digits, mixed freely.
- English month names (full, and short forms such as `Bha`; `Ash` is Ashadh and Ashwin's short form is `Asw`), Nepali full month names, and the alternate spellings in `data/month-aliases.json` (for example Sawan). Several of those alternates were added without a source and need review by a native speaker. **[SOURCE NEEDED]**
- Separators `/ . , -` and spaces, all treated alike.
- A leading weekday name (English or Nepali, full or short), and the era and filler words `वि.सं.`, `सम्वत्`, `संवत्`, `साल`, `गते` and `BS`.
- These patterns, tried in order: `Y M D`, `D month Y`, `month D Y`, `Y month D`, `D M Y`. The year must have exactly 4 digits; day and month at most 2. So `01 02 2082` is day 1, month 2.

Not accepted: Nepali short month names (one letter, ambiguous), two-digit years, and `month/day/year` with numbers only.

```js test
import { parseNepaliDate, JhiguError } from 'jhigu-patro-utils-ts';

parseNepaliDate('2082-05-10'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('२०८२/०५/१०'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('१० Bhadra २०८२'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('Tuesday, 10 Bhadra 2082'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('२०८२ साल भदौ १० गते'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('2082 BS Bhadra 10'); // => { year: 2082, month: 5, day: 10 }
parseNepaliDate('01 02 2082'); // => { year: 2082, month: 2, day: 1 }

let err;
try { parseNepaliDate('2082-05-32'); } catch (e) { err = e; }
err instanceof JhiguError; // => true
err.code; // => 'PARSE_ERROR'
err.details; // => '2082-05-32'
err.localized('ne'); // => 'यो मिति पढ्न सकिएन'
err.localized('en'); // => 'Could not read this date'
```

An unreadable text and a date that does not exist both give `PARSE_ERROR` (not `INVALID_DATE`), with the original text in `details`. `localized(language)` returns the user-facing message for `PARSE_ERROR`; for other codes it returns the English `message`.

## Fiscal year

The Nepali fiscal year runs from Shrawan 1 (month 4) to the last day of Ashadh (month 3) of the next BS year. `fiscalYear(date)` returns `{ start, end, code, first, last }`. `code` is `2082/83`; for start year 2099 it is `2099/00`.

```js test
import { fiscalYear, JhiguError } from 'jhigu-patro-utils-ts';

const f = fiscalYear({ year: 2082, month: 2, day: 1 });
f.code; // => '2081/82'
f.first; // => { year: 2081, month: 4, day: 1 }
f.last; // => { year: 2082, month: 3, day: 32 }
fiscalYear({ year: 2082, month: 4, day: 1 }).code; // => '2082/83'
fiscalYear({ year: 2099, month: 5, day: 1 }).code; // => '2099/00'

let code;
try { fiscalYear({ year: 2000, month: 1, day: 1 }); } catch (e) { code = e instanceof JhiguError && e.code; }
code; // => 'OUT_OF_RANGE'
```

`OUT_OF_RANGE` happens when the fiscal year needs a year outside the data: any date in BS 2000 months 1 to 3, and BS 2100 from Shrawan. `INVALID_DATE` is thrown for a date that does not exist. In Dart: `fiscalYear(NepaliDate)` returns a `FiscalYear` whose `first` and `last` are `NepaliDate`s.

## Month grid

`getMonthGrid(year, month, options)` returns whole weeks: 5 or 6 rows of 7 cells. Each cell has `bs`, `ad`, `inMonth`, `inRange`, `isToday`, `isWeekend` and `events`. Days before and after the month show the neighbouring months when those are inside the data; otherwise the cell is blank (`bs` and `ad` are `null`, `inRange` is `false`).

| Option | Default | Meaning |
|--------|---------|---------|
| `weekStartsOn` | `0` | First column, 0 Sunday to 6 Saturday. |
| `events` | none | Events by `YYYY-MM-DD` key, for any day shown (including neighbouring months). |
| `getEvents` | none | Called once per dated cell on every call (nothing is cached). Its events come after those from `events`. |
| `weekendDays` | `[6]` | Weekday numbers shown as weekend (Saturday). |
| `sixRows` | `false` | Always return 6 rows. |
| `today` | today in Nepal | The day to mark as today. Pass it in tests. |

```js test
import { getMonthGrid } from 'jhigu-patro-utils-ts';

const today = { year: 2082, month: 5, day: 10 };
const rows = getMonthGrid(2082, 5, { today });
rows.length; // => 5
rows[0][0].bs.toString(); // => '2082-05-01'
rows[0][0].ad.toDateString(); // => 'Sun Aug 17 2025'
rows.flat().filter(c => c.inMonth).length; // => 31
rows.flat().find(c => c.isToday).bs.toString(); // => '2082-05-10'
rows[4].map(c => c.inMonth); // => [true, true, true, false, false, false, false]

// Monday first, six rows, Friday and Saturday as weekend, events from a map and a callback.
const grid = getMonthGrid(2082, 5, {
  weekStartsOn: 1, sixRows: true, weekendDays: [5, 6], today,
  events: { '2082-05-10': ['Teej'] },
  getEvents: (date) => (date.day === 1 ? ['first'] : []),
});
grid.length; // => 6
grid[0][0].bs.toString(); // => '2082-04-26'
grid[0].map(c => c.isWeekend); // => [false, false, false, false, true, true, false]
grid.flat().filter(c => c.events.length).map(c => `${c.bs}:${c.events.join('|')}`); // => ['2082-05-01:first', '2082-05-10:Teej', '2082-06-01:first']

// At the edge of the data the outside cells are blank.
getMonthGrid(2000, 1, { today })[0].map(c => c.bs?.toString() ?? null); // => [null, null, null, '2000-01-01', '2000-01-02', '2000-01-03', '2000-01-04']
```

Dart: `getMonthGrid<E>(year, month, {weekStartsOn, events, getEvents, weekendDays, sixRows, today})` returns `List<List<GridCell<E>>>`. `GridCell.bs` is `NepaliDate?` and `ad` is a UTC-midnight `DateTime?`. Events are keyed by `toIsoString()`.

## Localized strings

`getStrings(language)` returns the label table for `'en'` or `'ne'` (the type `Language` in TypeScript; a plain `String` in Dart). Month and weekday names, the relative-time phrases and the date patterns all come from it, generated from `data/strings.en.json` and `data/strings.ne.json`; nothing user-facing is hard-coded in the formatter. The dates parts of the table are `months`, `monthsShort`, `weekdays`, `weekdaysShort`, `adMonths`, `adMonthsShort`, `relative`, `date.parseError` and `format.gatePattern` / `format.dualPattern`. The same table also holds the labels for other features (pickers, phone, address, money, receipts, SMS).

```js test
import { getStrings } from 'jhigu-patro-utils-ts';

getStrings('en').months[4]; // => 'Bhadra'
getStrings('ne').months[4]; // => 'भदौ'
getStrings('en').weekdays[2]; // => 'Tuesday'
getStrings('ne').weekdays[2]; // => 'मंगलबार'
getStrings('en').adMonthsShort[7]; // => 'Aug'
getStrings('ne').format.gatePattern; // => 'YYYY [साल] MMMM D [गते]'
getStrings('xx') === getStrings('en'); // => true
```

Dart: `getStrings('ne').months[4]`. Dart also exports `jhiguStringsEn` and `jhiguStringsNe`.

## Older formatting helpers

These existed before the token formatter and remain. They read the same string tables, so there is one source for names. They do not use the token formatter, and their output shapes are fixed.

| TypeScript | Dart | Example output |
|------------|------|----------------|
| `formatNepaliDate(date, 'en' \| 'ne')` | `NepaliCalendar.formatNepaliDate(date, nepali:)` | `Bhadra 10, 2082`, `भदौ 10, 2082` (ASCII digits in both) |
| `formatEnglishDate(date)` | `NepaliCalendar.formatEnglishDate(dateTime)` | `August 26, 2025` |
| `getNepaliMonthName(month, locale)` | `NepaliCalendar.getNepaliMonthName(month, nepali:)` | `भदौ` |
| `getNepaliDayName(jsDate, locale)` | `NepaliCalendar.getNepaliDayName(dateTime, nepali:)` | `Tuesday` |
| `formatNepaliDateWithDay(date)` | `NepaliCalendar.formatNepaliDateWithDay(date)` | `१० भदौ २०८२, मंगलबार` |
| `toNepaliDigits(n)` | `NepaliCalendar.toNepaliDigits(n)` | `२०८२` |
| `formatNepalDateTime(date)` | `NepaliCalendar.formatNepalDateTime(date)` | `2025-08-26 01:45` (Nepal time; empty string for null) |
| `getRelativeTimeInNepali(date)` | `NepaliCalendar.getRelativeTimeInNepali(date, now:)` | `१५ मिनेट अगाडि`; past midnight Nepal time it shows the BS date, `४ भदौ २०८२` |
| `getCurrentNepaliDate()` / `getCurrentNepaliDateFormatted()` | `NepaliCalendar.getCurrentNepaliDate()` / `getCurrentNepaliDateFormatted()` | Today in Nepal as fields / as `१० भदौ २०८२, मंगलबार` |
| `NEPALI_MONTHS_EN`, `NEPALI_MONTHS_NE`, `ENGLISH_MONTHS`, `NEPALI_DAYS_EN`, `NEPALI_DAYS_NE`, `NEPALI_DIGITS` | `nepaliMonthsEn`, `nepaliMonthsNe`, `englishMonths`, `nepaliDaysEn`, `nepaliDaysNe`, `nepaliDigits` | Name arrays, Sunday first |

```js test
import { formatNepaliDate, formatEnglishDate, getNepaliMonthName, formatNepaliDateWithDay, toNepaliDigits, formatNepalDateTime, NEPALI_MONTHS_EN } from 'jhigu-patro-utils-ts';

const d = { year: 2082, month: 5, day: 10 };
formatNepaliDate(d); // => 'Bhadra 10, 2082'
formatNepaliDate(d, 'ne'); // => 'भदौ 10, 2082'
formatEnglishDate(new Date(2025, 7, 26)); // => 'August 26, 2025'
getNepaliMonthName(5, 'ne'); // => 'भदौ'
formatNepaliDateWithDay(d); // => '१० भदौ २०८२, मंगलबार'
toNepaliDigits(2082); // => '२०८२'
formatNepalDateTime(new Date(Date.UTC(2025, 7, 25, 20, 0, 0))); // => '2025-08-26 01:45'
NEPALI_MONTHS_EN[2]; // => 'Ashadh'
```

For new code prefer `formatDate` and `formatPreset`. Notes on the old helpers:

- English names are `Ashadh` and `Sunday` to `Saturday`. Earlier versions printed `Asar` and `Aaitabar`, `Sombar` and so on; code that compared those strings must change.
- `formatNepaliDateWithDay` throws a plain `Error` (not `JhiguError`) for a date outside the data in TypeScript. `getNepaliMonthName` returns `''` for a month outside 1 to 12 in TypeScript.
- `getRelativeTimeInNepali` had a bug (it read local fields of a Nepal-shifted `Date`, so the BS date came out one day ahead in the evening in Kathmandu) that is fixed in TypeScript.

## Recipes

### 1. Show an AD timestamp as a BS date

Take the calendar date you want to show; the time zone of the machine does not matter once you hold a `Date` for that calendar day. For "now", use `NepaliDate.today()`, which reads the clock in Nepal.

```js test
import { NepaliDate, formatPreset } from 'jhigu-patro-utils-ts';

const issued = NepaliDate.fromAD(new Date(2025, 7, 26));
formatPreset(issued, 'long', 'ne'); // => '१० भदौ २०८२'
formatPreset(issued, 'dual', 'en'); // => '10 Bhadra 2082 (AD 26 August 2025)'
```

### 2. Read a typed date and show a message in the user's language

```js test
import { parseNepaliDate, JhiguError } from 'jhigu-patro-utils-ts';

function readDate(text, language) {
  try {
    return { ok: true, date: parseNepaliDate(text) };
  } catch (e) {
    if (e instanceof JhiguError && e.code === 'PARSE_ERROR') return { ok: false, message: e.localized(language) };
    throw e;
  }
}

readDate('१० भदौ २०८२', 'ne'); // => { ok: true, date: { year: 2082, month: 5, day: 10 } }
readDate('2082-05-32', 'ne'); // => { ok: false, message: 'यो मिति पढ्न सकिएन' }
```

### 3. A due date and how far away it is

```js test
import { NepaliDate, formatPreset } from 'jhigu-patro-utils-ts';

const invoiceDate = new NepaliDate(2082, 5, 10);
const due = invoiceDate.addDays(30);
due.toString(); // => '2082-06-09'
formatPreset(due, 'relative', 'en', { today: new NepaliDate(2082, 6, 8) }); // => 'tomorrow'
due.diff(invoiceDate); // => 30
```

### 4. Age in whole years

```js test
import { NepaliDate } from 'jhigu-patro-utils-ts';

const born = new NepaliDate(2060, 5, 10);
new NepaliDate(2082, 5, 9).diff(born, 'years'); // => 21
new NepaliDate(2082, 5, 10).diff(born, 'years'); // => 22
```

### 5. Group records by fiscal year

```js test
import { fiscalYear } from 'jhigu-patro-utils-ts';

const records = [
  { id: 1, date: { year: 2082, month: 3, day: 31 } },
  { id: 2, date: { year: 2082, month: 4, day: 1 } },
  { id: 3, date: { year: 2082, month: 11, day: 15 } },
];
const byYear = {};
for (const r of records) (byYear[fiscalYear(r.date).code] ??= []).push(r.id);
byYear; // => { '2081/82': [1], '2082/83': [2, 3] }
```

### 6. Draw a month as text

```js test
import { getMonthGrid } from 'jhigu-patro-utils-ts';

const rows = getMonthGrid(2082, 5, { weekStartsOn: 0, today: { year: 2082, month: 5, day: 10 } });
const text = rows.map(row => row.map(c => (c.inMonth ? String(c.bs.day).padStart(2) : '  ')).join(' '));
text[0]; // => ' 1  2  3  4  5  6  7'
text[4]; // => '29 30 31            '
```

### 7. Dart: parse, add, format

```dart
final due = parseNepaliDate('10 Bhadra 2082').addDays(30);
print(formatPreset(due, DatePreset.iso));                 // 2082-06-09
print(formatDate(due, 'D MMMM YYYY', language: 'ne'));    // ९ असोज २०८२
print(fiscalYear(due).code);                              // 2082/83
```

## Errors and edge cases

Dates throw `JhiguError` (TypeScript) with a stable `code`; Dart throws the matching subclass of the sealed `JhiguException`, with the same `code` string. A `JhiguError` is an `Error` with `name` `'JhiguError'`, the English `message`, and `details` holding the offending input (for `PARSE_ERROR`, the original text).

| Code | Dart class | When |
|------|------------|------|
| `INVALID_DATE` | `InvalidDateException` | The date does not exist (month 13, day 32, a 30th in a 29-day month), a part is not an integer, or an AD `Date` is invalid. |
| `OUT_OF_RANGE` | `OutOfRangeException` | The year, AD day or day number is outside the data (BS 2000 to 2100), or a fiscal year would be. Never clamped. |
| `INVALID_DATA` | `InvalidDataException` | A bad option: an unknown preset, or `weekStartsOn` not an integer from 0 to 6. |
| `PARSE_ERROR` | `ParseException` | `parseNepaliDate` could not read the text, or the date does not exist. |

```js test
import { NepaliDate, getMonthGrid, JhiguError } from 'jhigu-patro-utils-ts';

function codeOf(fn) {
  try { fn(); } catch (e) { return e instanceof JhiguError ? e.code : 'other'; }
  return 'none';
}

codeOf(() => new NepaliDate(2082, 5, 32)); // => 'INVALID_DATE'
codeOf(() => new NepaliDate(2082, 5.5, 1)); // => 'INVALID_DATE'
codeOf(() => new NepaliDate(2101, 1, 1)); // => 'OUT_OF_RANGE'
codeOf(() => new NepaliDate(2100, 12, 31).addDays(1)); // => 'OUT_OF_RANGE'
codeOf(() => new NepaliDate(2082, 5, 10).addDays(1.5)); // => 'INVALID_DATE'
```

Other edge cases:

- Dart `const NepaliDate(...)` does not validate; most functions that receive one check it themselves (`formatDate`, `fiscalYear`) and throw `InvalidDateException`.
- `NepaliDate.fromAD` and `today` read the calendar fields of the `Date`; they do not apply a time zone to a `Date` you pass. Only `today()` and `getCurrentNepaliDate()` shift the clock to Nepal time.
- A TypeScript `Date` returned by `toAD()` is local midnight; compare it with `toDateString()` or its local getters, not `toISOString()`.
- The month grid computes every cell on each call and never caches `getEvents` results.

## Accuracy, limits and known gaps

- The data covers BS 2000 to 2100 only. Before 1943-04-14 and after 2044-04-13 everything throws `OUT_OF_RANGE`.
- Month lengths for BS 2084 to 2100 are not verified against the official calendar, and BS 2062 months 1 and 2 are in dispute between sources. Conversions in those years work but may be off by a day. See the [calendar data guide](../calendar-data/README.md) for the exact record. **[SOURCE NEEDED]**
- Parser month-name alternates beyond the main list (Sawan, Saun, Bhadau, Phalgun, Fagun, Chait, Margashirsha, Kartick, Push, and the Sanskrit Nepali forms) were added without a source and need review by a native speaker. **[SOURCE NEEDED]**
- Nepali `short` and `MMM` output is one letter per month and is ambiguous.
- The Nepali weekday and month tables are from the string tables; their review status is in `data/STRINGS_NOTES.md`.
- The `dual` preset prints the AD part with ASCII digits in Nepali. This is a choice recorded in `data/DATES_NOTES.md`, not a rule from a source.
- TypeScript `convertADToBS`, `getCurrentNepaliDate` and `parseNepaliDate` return plain `NepaliDateFields`, not `NepaliDate`; wrap with `NepaliDate.from()` if you need the methods. The old TypeScript interface called `NepaliDate` is now `NepaliDateFields`, and `NepaliDate` is the class.
- The `grid` cell's `ad` depends on the machine time zone only for days a zone skipped (Kiritimati 1994-12-31, Apia 2011-12-30); `bs` is exact.

## How it is tested

Both languages read `testdata/dates.json`. Its groups:

| Group | What it holds |
|-------|---------------|
| `parse`, `parseInvalid` | 93 valid inputs (every pattern, every canonical month name in both languages, every alternate) and 23 invalid ones. |
| `fiscal`, `fiscalInvalid` | 8 fiscal years and 3 errors. |
| `adToBs`, `addDays`, `addMonths`, `addYears`, `diff`, `compare`, `weekday`, `monthBounds`, `dateErrors` | Conversion and arithmetic vectors, derived with an independent Python converter. |
| `formatTokens`, `formatPresets`, `formatRelative`, `formatAd`, `formatAdAscii`, `formatErrors` | Formatter vectors, produced by a separate Python formatter that reads the string files. |
| `grid` | 12 months including the first and last of the data, 5 and 6 rows, forced six rows, four week-start days, events and errors. |
| `convertErrors` | The old converters' errors: 4 AD, 6 BS and 2 edge pairs. |

The tests that run them are `ts/tests/dates.test.ts` and `dart/test/dates_test.dart`. In addition, `testdata/calendar-all-days.json` fingerprints all 36,891 days; `ts/tests/calendarAllDays.test.ts` and `dart/test/calendar_all_days_test.dart` convert every day both ways, and the TypeScript job runs in four time zones in CI. The weekday of every day from BS 2000 to 2100 is checked against the AD weekday, and `addDays` against plain AD arithmetic.

The `js test` blocks in this guide are run by `ts/tests/docs.test.ts`. The Dart samples are not run by the test suite.

The vectors check the code against an independent model of the same month-length table. They do not check the table itself against an official calendar.

## Related guides

- [Calendar data](../calendar-data/README.md): loading the data, accuracy, Nepal time, known gaps.
- [Tithi](../tithi/README.md): lunar-day data per BS day.
- [Headless widgets](../headless-widgets/README.md): date pickers and range pickers built on these functions.
- [Web components](../web-components/README.md): `<jhigu-date-picker>` and `<jhigu-calendar>`.
- [Usage guide](../../USAGE.md): the whole kit in one page.
