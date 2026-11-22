# Calendar data

Every Bikram Sambat (BS) conversion, validation and month grid in this kit depends on one table: how many days each BS month has, for each BS year from 2000 to 2100. That table is `data/nepali_calendar_data.json`. You load it once at start-up and register it with `initializeCalendar` (TypeScript) or `NepaliCalendar.initialize` (Dart). This guide covers what the file holds, how to load it in each environment, how to ask how far to trust a year, the range helpers, Nepal time handling, how the file is validated, and the known gaps in it.

## When to use it

- You convert dates (`convertADToBS`, `convertBSToAD`, `NepaliDate`), validate them, or draw a calendar. All of these need the data loaded first.
- You want to warn users when a date falls in a year that has not been checked against an official calendar.
- You need the supported range, the days in a month, or the length of a year.
- You need "today in Nepal" on a server that runs in another time zone.

Money, phone numbers, addresses and SMS templates do not need the calendar data.

## What the data file holds

`data/nepali_calendar_data.json` is the source of truth. `ts/nepali_calendar_data.json` is a copy that ships in the npm package; CI checks that the two are identical.

| Field | Value in the current file | Meaning |
|-------|---------------------------|---------|
| `version` | `"1.0"` | File format version. |
| `supportedRange` | `{ "start": 2000, "end": 2100 }` | First and last BS year in the table. |
| `verifiedThrough` | `2083` | Last BS year checked against agreeing sources. Later years still convert, but are reported as unverified. See [Accuracy](#accuracy-limits-and-known-gaps). |
| `unverifiedYears` | text starting `2084-2100` | A note for people reading the file. Code does not read it. |
| `referencePoint` | BS 2000/1/1 = AD 1943-04-14 | The anchor every conversion counts from. |
| `years` | 101 entries, `"2000"` to `"2100"` | Each year is an array of 12 month lengths, Baisakh first. |

The data covers AD 1943-04-14 (BS 2000/1/1) to AD 2044-04-13 (BS 2100/12/31). That is 36,891 days. A date outside this range is refused, never clamped.

## Setup

Load the JSON once, before anything converts or validates a date. The first sample reads the file from disk in Node (the test suite runs it from the `ts/` folder):

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

// Node: read the file yourself. (Adjust the path for your project.)
const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));

data.supportedRange; // => { start: 2000, end: 2100 }
data.verifiedThrough; // => 2083
data.referencePoint; // => { bsYear: 2000, bsMonth: 1, bsDay: 1, adYear: 1943, adMonth: 4, adDay: 14 }
Object.keys(data.years).length; // => 101
data.years['2082']; // => [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]
```

### Data sources

A data source is anything that implements `NepaliCalendarDataSource`: `getYearData(year)` (12 month lengths, or `null`), `supportedStartYear`, `supportedEndYear` and an optional `verifiedThrough`.

| Source | Language | Use it for |
|--------|----------|------------|
| `InlineCalendarDataSource(years, start, end, verifiedThrough?)` | TypeScript | Data you already have in memory: Node, SSR, bundled JSON, tests. |
| `JsonCalendarDataSource` | TypeScript | Browsers. Call `await source.initialize(url)` to `fetch` the JSON once. |
| `InlineCalendarDataSource(years:, supportedStartYear:, supportedEndYear:, verifiedThrough:)` | Dart | Flutter apps (from assets), Dart servers and CLIs, tests. Named parameters; `years` is `Map<int, List<int>>`. |

The Dart package has no `JsonCalendarDataSource`: read the file yourself and build an `InlineCalendarDataSource`. `PanchangDataSource` (tithi data) is a separate source; see the tithi guide.

Two rules for every source:

- **Pass `verifiedThrough`.** If you leave it out, `isVerifiedYear` is `false` for every year and `getDateAccuracy` warns on every date ("any year" in the message).
- **Start at BS 2000.** Conversions count days from BS 2000/1/1, so the source must hold every year from `supportedRange.start` (2000) to `end`. A source that starts later does not fail in TypeScript, it gives wrong dates: with a source holding only BS 2082 and `supportedStartYear: 2082`, `convertBSToAD(2082, 1, 1)` returned 1943-04-14 when this was tried. In Dart the same source throws `ArgumentError` ("No calendar data for BS year 2000"). Use the full file, even in tests.

`initializeCalendar` precomputes the day offsets for every year (TypeScript). Calling it again replaces the source and rebuilds them.

### Setup per environment

**Node (server, scripts, tests).** Read the file and use `InlineCalendarDataSource`, as in the sample above. When the package is installed from npm the data file ships with it:

```js
import data from 'jhigu-patro-utils-ts/nepali_calendar_data.json' with { type: 'json' };
```

In a TypeScript project that imports JSON, turn on `resolveJsonModule`.

**Browser (Vite and similar).** Serve the JSON as a static file and fetch it:

```js
import { JsonCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

const source = new JsonCalendarDataSource();
await source.initialize('/nepali_calendar_data.json');
initializeCalendar(source);
```

`initialize` throws an `Error` with the URL, status and status text when the response is not OK. A second `initialize` call on the same instance does nothing. The file is not validated after it is read. Alternatively, import the JSON through the bundler and use `InlineCalendarDataSource`, as in the next paragraph; then there is no network request.

**Next.js and Nuxt (server rendering).** The two example apps in this repo bundle the JSON and call `initializeCalendar` at module level, so it runs on the server during the render and again in the browser, with no `fetch`:

```js
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import cal from 'jhigu-patro-utils-ts/nepali_calendar_data.json';

initializeCalendar(new InlineCalendarDataSource(
  cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
));
```

(`react/example-next/app/form.tsx` and `vue/example-nuxt/app/app.vue` cast `cal.years` to `Record<string, number[]>` for TypeScript.) The source is held in module state, one per server process. `tools/ssr-check/check.mjs` builds both examples and fails when the calendar is not initialised; see [How it is tested](#how-it-is-tested).

**Flutter.** Copy `data/nepali_calendar_data.json` to `assets/`, register it in `pubspec.yaml` (`flutter: assets: - assets/nepali_calendar_data.json`) and initialise before `runApp`, as `flutter/example/lib/main.dart` does (see the Dart section below).

**Dart server or CLI.** Read the file with `dart:io` and build an `InlineCalendarDataSource` (Dart section below).

## Quick start (TypeScript)

After setup, the range helpers, accuracy checks and conversions work:

```js test
import { getSupportedBSRange, getAvailableBSYears, getAvailableADYears, getDaysInBSMonth, getTotalDaysInBSYear, isValidBSDate } from 'jhigu-patro-utils-ts';
import { isVerifiedYear, getDateAccuracy, convertADToBS, convertBSToAD } from 'jhigu-patro-utils-ts';

getSupportedBSRange(); // => { start: 2000, end: 2100 }
getAvailableBSYears().length; // => 101
getAvailableADYears()[0]; // => 1943
getAvailableADYears().at(-1); // => 2044
getDaysInBSMonth(2082, 5); // => 31
getTotalDaysInBSYear(2082); // => 365
isValidBSDate(2082, 5, 31); // => true
isValidBSDate(2082, 13, 1); // => false
isValidBSDate(2101, 1, 1); // => false

isVerifiedYear(2083); // => true
isVerifiedYear(2084); // => false
getDateAccuracy({ year: 2082, month: 1, day: 1 }); // => { verified: true }
getDateAccuracy({ year: 2090, month: 1, day: 1 }).verified; // => false

convertADToBS(new Date(2024, 3, 13)); // => { year: 2081, month: 1, day: 1 }
convertADToBS(new Date(1943, 3, 14)); // => { year: 2000, month: 1, day: 1 }
convertADToBS(new Date(2044, 3, 13)); // => { year: 2100, month: 12, day: 31 }
convertBSToAD(2081, 1, 1).toDateString(); // => 'Sat Apr 13 2024'
```

`getDateAccuracy` never throws for an unverified year. It returns `{ verified: false, warning }`, where `warning` is an English sentence naming the year and the `verifiedThrough` value.

## Quick start (Dart)

```dart
import 'dart:convert';
import 'dart:io';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

void main() {
  final json = jsonDecode(File('data/nepali_calendar_data.json').readAsStringSync())
      as Map<String, dynamic>;
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: (json['years'] as Map<String, dynamic>)
        .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
    supportedStartYear: json['supportedRange']['start'] as int,
    supportedEndYear: json['supportedRange']['end'] as int,
    verifiedThrough: json['verifiedThrough'] as int,
  ));

  print(NepaliCalendar.getSupportedBSRange());              // (end: 2100, start: 2000)
  print(NepaliCalendar.getAvailableBSYears().length);       // 101
  print(NepaliCalendar.getDaysInBSMonth(2082, 5));          // 31
  print(NepaliCalendar.getTotalDaysInBSYear(2082));         // 365
  print(NepaliCalendar.isValidBSDate(2082, 5, 31));         // true
  print(NepaliCalendar.isVerifiedYear(2083));               // true
  print(NepaliCalendar.isVerifiedYear(2084));               // false
  print(NepaliCalendar.getDateAccuracy(
      NepaliDate(year: 2090, month: 1, day: 1)).verified);  // false
  print(NepaliCalendar.convertADToBS(DateTime.utc(2024, 4, 13))); // NepaliDate(2081/1/1)
  print(NepaliCalendar.convertBSToAD(2081, 1, 1));          // 2024-04-13 00:00:00.000Z
}
```

In Dart every function is a static method on `NepaliCalendar`. `convertBSToAD` returns a UTC midnight `DateTime`. `getAvailableADYears` exists only in TypeScript. The Flutter example passes `verifiedThrough` as above; the older README snippets for Flutter and Dart servers leave it out, which makes every year report as unverified.

## API reference

TypeScript names are free functions exported from `jhigu-patro-utils-ts`. Dart names are static methods of `NepaliCalendar`.

| Name | What it does | Throws |
|------|--------------|--------|
| `initializeCalendar(source)` / `NepaliCalendar.initialize(source)` | Registers the data source. Call once before anything else. TypeScript also precomputes day offsets. | Nothing. Every other function throws `Error` / `StateError` ("calendar not initialized") if this was not called. |
| `InlineCalendarDataSource` | Data source from an in-memory object or map. | Nothing. |
| `JsonCalendarDataSource` (TypeScript) | Data source that fetches a JSON URL via `initialize(url)`. | `Error` when the response is not OK. |
| `getSupportedBSRange()` | `{ start, end }` of the loaded source. | Nothing. |
| `getAvailableBSYears()` | BS years the source has data for. | Nothing. |
| `getAvailableADYears()` (TypeScript) | AD years spanned by the data (1943 to 2044). | Nothing. |
| `getDaysInBSMonth(year, month)` | Days in a BS month (month 1 to 12). | `Error` (Dart `ArgumentError`) for a year with no data. A month outside 1 to 12 is not checked: TypeScript returns `undefined`, Dart throws `RangeError`. |
| `getTotalDaysInBSYear(year)` | Days in a BS year. | `Error` (Dart `ArgumentError`) for a year with no data. |
| `isValidBSDate(year, month, day)` | `true` if the date exists and the year is in range. | Nothing; returns `false`. |
| `isVerifiedYear(year)` | `true` if `year <= verifiedThrough`. `false` for every year when `verifiedThrough` is not set. | Nothing. |
| `getDateAccuracy(date)` | `{ verified }`, plus an English `warning` when not verified. | Nothing. |
| `convertADToBS(date)` | AD `Date` to BS fields. The year, month and day of the `Date` are used, not the time of day. | `JhiguError` `OUT_OF_RANGE` outside 1943-04-14 to 2044-04-13; `INVALID_DATE` for an invalid `Date`. Dart: `OutOfRangeException`. |
| `convertBSToAD(y, m, d)` | BS date to AD `Date` (local midnight in TypeScript, UTC midnight in Dart). | `JhiguError` `OUT_OF_RANGE` for a year outside the data; `INVALID_DATE` for a date that does not exist or non-integer parts. Dart: `OutOfRangeException`, `InvalidDateException`. |
| `toNepalTime(date)` | Shifts a timestamp by +05:45. | Nothing. |
| `fromNepalTime(date)` | Reverses `toNepalTime`. | Nothing. |
| `getCurrentNepaliDate()` | Today's BS date in Nepal, whatever the machine's time zone. | `OUT_OF_RANGE` if the clock is outside the data. |

For the BS date type, arithmetic and formatting see the [dates guide](../dates/README.md).

## Nepal time handling

Nepal is UTC+05:45 all year. Two rules keep dates correct:

1. **A BS date is a calendar date, not an instant.** Conversion reads only the year, month and day of the `Date` you pass (local fields in TypeScript, the same fields of the `DateTime` in Dart). The time of day and the time zone play no part. Internally the library counts whole days as integers, so a machine's daylight-saving or time-zone rules cannot move a result.
2. **"Today" must be read in Nepal.** `getCurrentNepaliDate()` and `NepaliDate.today(now)` add 05:45 to the clock first, then take the date. A server in UTC at 18:00 on 25 August 2025 is already 23:45 on 25 August in Nepal; at 20:00 UTC it is 01:45 on 26 August.

```js test
import { toNepalTime, fromNepalTime, getCurrentNepaliDate, NepaliDate } from 'jhigu-patro-utils-ts';

const instant = new Date(Date.UTC(2025, 7, 25, 20, 0, 0));
// toNepalTime encodes Nepal's wall clock in the UTC fields of the result.
toNepalTime(instant).toISOString(); // => '2025-08-26T01:45:00.000Z'
toNepalTime('2025-08-25T20:00:00Z').toISOString(); // => '2025-08-26T01:45:00.000Z'
fromNepalTime(toNepalTime(instant)).toISOString(); // => '2025-08-25T20:00:00.000Z'

// 20:00 UTC is already the next day in Nepal; 18:00 UTC is not.
NepaliDate.today(new Date(Date.UTC(2025, 7, 25, 20, 0, 0))).toString(); // => '2082-05-10'
NepaliDate.today(new Date(Date.UTC(2025, 7, 25, 18, 0, 0))).toString(); // => '2082-05-09'
typeof getCurrentNepaliDate().year; // => 'number'
```

The result of `toNepalTime` is a shifted `Date`: read its UTC fields (`getUTCHours()` and so on), not its local ones. In Dart, `NepaliCalendar.toNepalTime(utc)` returns a UTC `DateTime` shifted the same way.

A time zone can lack a calendar day: Pacific/Kiritimati has no 31 December 1994. A local-midnight `Date` for that day cannot be built there, so `convertBSToAD` and `NepaliDate.toAD()` return the next day in that zone. The date-only API (`NepaliDate`, day numbers, `fromAD`) has no such gap. See `data/DATES_NOTES.md`.

## Recipes

### 1. Load once at server start-up (Node)

Load before the first request, not per request. `initializeCalendar` replaces the registered source each time, so call it from one place.

```js
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

export function setupCalendar(path = 'data/nepali_calendar_data.json') {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  initializeCalendar(new InlineCalendarDataSource(
    data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
  ));
}
```

### 2. Warn the user about an unverified year

A date in BS 2084 or later converts normally. Show the warning next to it instead of hiding the result.

```js test
import { getDateAccuracy, convertBSToAD } from 'jhigu-patro-utils-ts';

function describeDate(date) {
  const ad = convertBSToAD(date.year, date.month, date.day);
  const accuracy = getDateAccuracy(date);
  return { ad: ad.getFullYear(), warning: accuracy.verified ? null : accuracy.warning };
}

describeDate({ year: 2082, month: 5, day: 10 }); // => { ad: 2025, warning: null }
describeDate({ year: 2090, month: 1, day: 1 }).warning.includes('2083'); // => true
```

### 3. List which years are unverified

For a year picker that marks years or a settings page that tells users what is not checked:

```js test
import { getAvailableBSYears, isVerifiedYear } from 'jhigu-patro-utils-ts';

const unverified = getAvailableBSYears().filter(y => !isVerifiedYear(y));
unverified[0]; // => 2084
unverified.at(-1); // => 2100
unverified.length; // => 17
```

### 4. Check a user-entered BS date before saving

`isValidBSDate` returns a boolean and never throws, so it suits form validation. It does not accept a non-existent day such as 32 in a 31-day month.

```js test
import { isValidBSDate, getDaysInBSMonth } from 'jhigu-patro-utils-ts';

isValidBSDate(2082, 5, 32); // => false
isValidBSDate(2082, 3, 32); // => true
getDaysInBSMonth(2082, 3); // => 32
```

### 5. A source without `verifiedThrough`

Leaving the fourth argument out marks every year unverified. This is the right choice when you load your own data that nobody has checked. The sample then loads the real data again.

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar, isVerifiedYear, getDateAccuracy } from 'jhigu-patro-utils-ts';

const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(data.years, data.supportedRange.start, data.supportedRange.end));
isVerifiedYear(2082); // => false
getDateAccuracy({ year: 2082, month: 1, day: 1 }).warning.includes('any year'); // => true

initializeCalendar(new InlineCalendarDataSource(data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough));
isVerifiedYear(2082); // => true
```

### 6. Flutter: load from assets before `runApp`

```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final cal = jsonDecode(await rootBundle.loadString('assets/nepali_calendar_data.json'))
      as Map<String, dynamic>;
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: (cal['years'] as Map<String, dynamic>)
        .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
    supportedStartYear: cal['supportedRange']['start'] as int,
    supportedEndYear: cal['supportedRange']['end'] as int,
    verifiedThrough: cal['verifiedThrough'] as int,
  ));
  runApp(const MyApp());
}
```

## Errors and edge cases

- **Not initialised.** Any call before `initializeCalendar` throws a plain `Error` in TypeScript and a `StateError` in Dart, with the message "calendar not initialized".
- **Out of range.** `convertADToBS` and `convertBSToAD` throw `JhiguError` with code `OUT_OF_RANGE` (Dart: `OutOfRangeException`) for the AD days before 1943-04-14 or after 2044-04-13 and for BS years outside 2000 to 2100. They never clamp. Non-existent dates and non-integer parts give `INVALID_DATE`.
- **Helpers throw plain errors.** `getDaysInBSMonth` and `getTotalDaysInBSYear` throw a plain `Error` (Dart `ArgumentError`) for a year with no data, not `JhiguError`. Use `isValidBSDate` first when the year comes from user input.
- **Month outside 1 to 12** in `getDaysInBSMonth` is not checked (see the table).
- **The data source is global.** There is one per JavaScript module instance or Dart isolate. Two copies of the package in one bundle each hold their own source.
- **`getDateAccuracy` text is English only.** The `warning` is built in code, not from the string tables.

```js test
import { getDaysInBSMonth, convertADToBS, JhiguError } from 'jhigu-patro-utils-ts';

let message;
try { getDaysInBSMonth(2101, 1); } catch (e) { message = e.message; }
message; // => 'No calendar data for BS year 2101'

let code;
try { convertADToBS(new Date(2044, 3, 14)); } catch (e) { code = e instanceof JhiguError && e.code; }
code; // => 'OUT_OF_RANGE'
```

## Accuracy, limits and known gaps

**What "verified" means.** `verifiedThrough: 2083` records that the table was compared with four other published sources and that all agree through BS 2083, with one exception (BS 2062, below). It is agreement between sources, not verification against the official Nepal Panchang Nirnayak Samiti calendar. That check has not been done. **[SOURCE NEEDED]**

What `data/CALENDAR_NOTES.md` records, exactly:

- The table matches `nepal_kit` (pub.dev 0.1.0) for every year that package covers.
- Of the five sources compared (this repo, nepal_kit, nepal-date-kit, nepali-date-converter, @remotemerge/nepali-date-converter), 17 years have at least one disagreement: **2062** and **2084 to 2099**. All five agree on 2000 to 2061 and 2063 to 2083.
- **BS 2062, months 1 and 2.** This repo has Baisakh 30 and Jestha 32 days. Three of the other four sources agree; nepal-date-kit has 31 and 31. A later reading of Hamro Patro (one unofficial site, read once) also shows 31 and 31, so the latest evidence goes against the data. The notes warn that the sources that agree may share one origin, so "three against one" is weaker than it looks. Only the dates from AD 2005-05-14 to 2005-06-13 are affected; the year total (365) is the same. The data was **not** changed, and BS 2062 is not marked unverified by `verifiedThrough` (2062 is below 2083), so `getDateAccuracy` reports it as verified. It is still pending official confirmation. **[SOURCE NEEDED]**
- **BS 2084 to 2099.** nepal-date-kit and nepali-date-converter agree with each other (through 2090) and disagree with this repo, nepal_kit and @remotemerge. In several years the two groups differ by a whole day count (2084: 366 days against 365). BS 2087 splits three ways. BS 2093: @remotemerge also differs from this repo (months 9 and 10: 30,29 against 29,30). **[SOURCE NEEDED]**: none of these years has been checked against the official calendar, so they cannot be called verified or wrong. The notes say not to change the data until they are.
- **BS 2100.** It is not in the notes' list of disagreeing years, but the data file marks `2084-2100` as unverified, and `verifiedThrough` is 2083, so 2100 reports as unverified like 2084 to 2099.
- The notes record a decision (2026-11-20) to keep the table unchanged, set `verifiedThrough` to 2083, and have `getDateAccuracy` warn for 2084 and later.
- One line in the notes says Dart parity for `isVerifiedYear` and `getDateAccuracy` "is not done yet". That line is out of date: both exist in Dart (`NepaliCalendar.isVerifiedYear`, `NepaliCalendar.getDateAccuracy`) and have tests in `dart/test/nepali_calendar_test.dart`.

Other limits:

- The range is BS 2000 to 2100 only. There is no way to extend it without new, checked data.
- Month lengths vary by year and are never computed from a rule. Do not guess them; read them from the table.
- Checking "the data is wrong in the table" is out of reach of the tests: the every-day test builds its expected values from the same JSON, so a wrong month length would be wrong in both. Only the comparison with other sources can find that.

## How it is tested

- **Shape.** `node tools/check-calendar/validate.mjs` checks the file: every year in `supportedRange` is present with exactly 12 months, each month length is an integer from 29 to 32, no year lies outside the range, `verifiedThrough` is an integer inside the range, and `referencePoint` is Baisakh 1 of the first year with a real AD date. It does not check that a year has 365 or 366 days. It prints `calendar ok` or lists the errors and exits 1.
- **CI.** The `ci-data` workflow (`.github/workflows/ci-data.yml`) runs the validator and then `cmp`s `data/nepali_calendar_data.json` with `ts/nepali_calendar_data.json`, so the shipped copy cannot drift.
- **Every day.** `testdata/calendar-all-days.json` lists all 36,891 days (AD date, BS date, weekday, day number) produced by an independent model from the same JSON, with a 64-bit FNV-1a fingerprint. `ts/tests/calendarAllDays.test.ts` and `dart/test/calendar_all_days_test.dart` convert every day both ways and must reproduce the same text, so TypeScript and Dart agree on every day. Both run in several time zones in CI (the TypeScript job uses Asia/Kathmandu, UTC, America/Los_Angeles and Pacific/Kiritimati).
- **Accuracy.** `ts/tests/nepaliCalendar.test.ts` and `dart/test/nepali_calendar_test.dart` check `isVerifiedYear` and `getDateAccuracy` against 2083 and 2084.
- **Errors.** The `convertErrors` vectors in `testdata/dates.json` (4 AD, 6 BS, 2 edge pairs) are run by both languages.
- **Source comparison.** `node tools/check-calendar/compare.mjs` compares the table with the four other sources saved in `testdata/calendar-sources/` and rewrites `testdata/calendar-golden.json`. It is a report, not a gate: it always exits 0 and is not run in CI.
- **Server rendering.** `node tools/ssr-check/check.mjs` builds the Next.js and Nuxt examples; its README records that removing the calendar initialisation is caught by it.
- **These samples.** The `js test` blocks in this guide are run by `ts/tests/docs.test.ts`. The Dart samples are not run by the test suite.

## Related guides

- [Dates](../dates/README.md): the `NepaliDate` class, conversion, arithmetic, formatting, parsing and the month grid.
- [Tithi](../tithi/README.md): lunar-day data loaded through `PanchangDataSource`.
- [Web components](../web-components/README.md): elements that need the calendar loaded first.
- [Usage guide](../../USAGE.md): the setup section for the whole kit.
- Notes in the repo: `data/CALENDAR_NOTES.md` (source comparison and decisions), `data/DATES_NOTES.md` (time-zone findings).
