# Tithi (panchang data)

A tithi is a lunar day. It does not start and end at midnight, so one BS day can hold two tithis, and some days hold only one that carries over. The kit ships a table of tithi segments for each day of **BS 2081 and BS 2082 only**, and a small reader, `PanchangDataSource`, in TypeScript and Dart. The reader answers "which tithi is it at sunrise on this BS day" and "which tithi is active at this minute of this BS day". The `<jhigu-calendar>` web component can show the sunrise tithi under each day. This guide covers the data, the reader, loading it in each environment, the calendar display, the checks that run on the data, and the known gaps in the data.

## When to use it

- You need the tithi name and paksha (शुक्ल or कृष्ण) for a BS day in 2081 or 2082.
- You need the tithi at a given time of day, for example "now".
- You want `<jhigu-calendar>` to show the tithi on each day.

Do not use it for any other year. There is no data for it and the reader answers `null` (see [Accuracy, limits and known gaps](#accuracy-limits-and-known-gaps)). The data does not say where it came from.

## Setup

The data is two JSON files in `data/`: `2081_tithi.json` and `2082_tithi.json`. `data/` is the source of truth. `ts/2081_tithi.json`, `ts/2082_tithi.json` and `ts/src/data_sources/2081_tithi.json` are copies that CI compares with it. The npm package exports them as `jhigu-patro-utils-ts/2081_tithi.json` and `jhigu-patro-utils-ts/2082_tithi.json`.

### File shape

Each file is an array holding one year object.

```
[ { "year": 2082,
    "months": [ { "month": 1, "name": "Baisakh",
                  "days": [ { "bsDay": 1, "adDate": "2025-04-14",
                              "tithiSegments": [
                                { "tithiNumber": 1, "tithiName": "प्रतिपदा", "paksha": "कृष्ण",
                                  "startMinute": 0, "endMinute": 419 },
                                { "tithiNumber": 2, "tithiName": "द्वितीया", "paksha": "कृष्ण",
                                  "startMinute": 419, "endMinute": 1440 } ] } ] } ] } ]
```

| Field | Meaning |
| --- | --- |
| `year` | BS year. |
| `months[].month` | 1 to 12. |
| `months[].name` | English month name, for example `Baisakh`. |
| `days[].bsDay` | BS day of the month. Month lengths follow `data/nepali_calendar_data.json`. |
| `days[].adDate` | The Gregorian date, `YYYY-MM-DD`. |
| `tithiSegments[].tithiNumber` | 1 to 15. 15 is पूर्णिमा in शुक्ल paksha and औंसी in कृष्ण paksha. |
| `tithiSegments[].tithiName` | Nepali name, for example `प्रतिपदा`. |
| `tithiSegments[].paksha` | `शुक्ल` or `कृष्ण`. |
| `tithiSegments[].startMinute`, `endMinute` | Minutes from 00:00 Nepal time. The segment covers `startMinute <= minute < endMinute`. 1440 is the end of the day. |

### Loading it per environment

`PanchangDataSource` holds any number of years. Load each year once. A year that is not loaded answers `null`.

| Environment | How |
| --- | --- |
| Browser (TS) | `await panchang.load('/2082_tithi.json')`. It calls `fetch`, so the file must be served. |
| Node (TS) | Read the file with `readFileSync` and pass the parsed JSON to `addYear`. |
| Flutter / Dart | Read the file yourself (an asset, a file, a request), decode it, pass it to `addYear`. The Dart class has no `load`. |

For Flutter the usual way to read an asset is `rootBundle.loadString` and `jsonDecode`. The repo has no Flutter helper and no sample for it, so the asset declaration and call are not shown here. [SOURCE NEEDED]

The first block below is the shared setup. It stores the loaded source in `globalThis.panchang` because every block runs as its own function and the later blocks reuse it. The tithi reader itself does not need the calendar, but some recipes convert an AD date to BS and do.

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar, PanchangDataSource } from 'jhigu-patro-utils-ts';

const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));

globalThis.panchang = new PanchangDataSource(); // later blocks reuse it
panchang.addYear(JSON.parse(readFileSync('../data/2081_tithi.json', 'utf8')));
panchang.addYear(JSON.parse(readFileSync('../data/2082_tithi.json', 'utf8')));
panchang.loadedYears; // => [2081, 2082]
panchang.loadedYear; // => 2082
```

## Quick start (TypeScript)

`sunriseTithi` gives the tithi for a day. `tithiAt` gives the tithi at a minute. Both return a `TithiSegment` or `null`.

```js test
const day = panchang.sunriseTithi(2082, 1, 1);
day?.tithiName; // => 'प्रतिपदा'
day?.paksha; // => 'कृष्ण'
day?.tithiNumber; // => 1

// The same day changes tithi at minute 419.
panchang.tithiAt(2082, 1, 1, 418)?.tithiNumber; // => 1
panchang.tithiAt(2082, 1, 1, 419)?.tithiNumber; // => 2

panchang.getDay(2082, 1, 1)?.adDate; // => '2025-04-14'
panchang.getDay(2082, 1, 1)?.tithiSegments.length; // => 2
```

In a browser, load with `fetch` instead:

```js
import { PanchangDataSource } from 'jhigu-patro-utils-ts';

const panchang = new PanchangDataSource();
await panchang.load('/2081_tithi.json');
await panchang.load('/2082_tithi.json'); // years stay loaded together
```

`load` throws a plain `Error` when the response is not ok, and the message names the URL and status. The block below replaces `fetch` to show it.

```js test
import { readFileSync } from 'node:fs';
import { PanchangDataSource } from 'jhigu-patro-utils-ts';

const realFetch = globalThis.fetch;
globalThis.fetch = async url => url.endsWith('2082_tithi.json')
  ? { ok: true, json: async () => JSON.parse(readFileSync('../data/2082_tithi.json', 'utf8')) }
  : { ok: false, status: 404, statusText: 'Not Found' };
const viaFetch = new PanchangDataSource();
await viaFetch.load('/2082_tithi.json');
viaFetch.loadedYears; // => [2082]
const failure = await viaFetch.load('/missing.json').catch(e => e.message);
failure; // => 'Failed to load panchang data from /missing.json: 404 Not Found'
globalThis.fetch = realFetch;
```

## The same in Dart

The Dart library has `PanchangDataSource.addYear`, `getDay`, `sunriseTithi`, `tithiAt`, `loadedYear` and `loadedYears`. It has no `load`. Hand it the decoded JSON. This was run against the repo data and printed the values in the comments.

```dart
import 'dart:convert';
import 'dart:io';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

void main() {
  final panchang = PanchangDataSource();
  for (final y in [2081, 2082]) {
    panchang.addYear(jsonDecode(File('data/${y}_tithi.json').readAsStringSync()));
  }
  print(panchang.loadedYears);                    // [2081, 2082]
  print(panchang.loadedYear);                     // 2082

  final s = panchang.sunriseTithi(2082, 1, 1)!;
  print('${s.tithiNumber} ${s.tithiName} ${s.paksha}');  // 1 प्रतिपदा कृष्ण
  print(panchang.tithiAt(2082, 1, 1, 419)!.tithiName);   // द्वितीया
  print(panchang.getDay(2082, 1, 1)!.adDate);            // 2025-04-14
  print(panchang.getDay(2083, 1, 1));                    // null
}
```

Dart types: `TithiSegment` (`tithiNumber`, `tithiName`, `paksha`, `startMinute`, `endMinute`) and `PanchangDay` (`bsDay`, `adDate`, `tithiSegments`). Both have `fromJson`. The Dart port gives the same answers as the TS class for the same data. That is checked with the shared vectors, see [How it is tested](#how-it-is-tested).

## API reference

| Name | What it does | Throws |
| --- | --- | --- |
| `new PanchangDataSource()` | Empty source. No year is loaded. | Nothing. |
| `load(url)` (TS only, async) | `fetch`es the URL, parses the JSON and calls `addYear`. | `Error` if the response is not ok: `Failed to load panchang data from <url>: <status> <statusText>`. A network or JSON error from `fetch` propagates as is. |
| `addYear(json)` | Adds one year from parsed JSON. Takes the array of one year object as the files have it, or the year object itself. Loading a year again replaces it. | Not checked. A value that does not have `year` and `months` fails with a plain `TypeError` (TS) or a cast error (Dart). |
| `loadedYear` | The year loaded last, or `null` when nothing is loaded. | Nothing. |
| `loadedYears` | Every loaded year, ascending, whatever the load order. | Nothing. |
| `getDay(year, month, day)` | The `PanchangDay`, or `null` when the year is not loaded or the day is not in it. | Nothing. |
| `sunriseTithi(year, month, day)` | The tithi at minute 375 (06:15 Nepal time). If no segment covers 375, the first segment stands in. `null` when the year is not loaded, the day is not in it, or the day has no segments. | Nothing. |
| `tithiAt(year, month, day, minute)` | The segment with `startMinute <= minute < endMinute`, or `null`. `minute` is 0 to 1439, Nepal time. | Nothing. |

Rules for `sunriseTithi`, from the code and `ts/tests/panchang.test.ts`:

- A segment that starts at 375 covers sunrise. A segment that ends at 375 does not.
- If no segment covers 375, `sunriseTithi` returns the first segment, but `tithiAt(..., 375)` returns `null` for the same day.
- Days are looked up by month and day number, not by order in the file.

`TithiSegment`, `PanchangDay`, `PanchangMonth` and `PanchangJson` are exported as TypeScript types. In `ts/src/types.ts` the comment on `tithiNumber` says `1–30`, but the data and the validator use 1 to 15 with a paksha.

## Using it in the calendar

### `<jhigu-calendar>`

Set the `panchang` property on the element. It takes a `PanchangDataSource`, or any object with `sunriseTithi(year, month, day)` that returns `{ tithiName, paksha }` or `null`. Setting it redraws the element. This needs a DOM, so the sample is not run.

```js
import { defineJhiguCalendar } from 'jhigu-patro-utils-ts/calendar-element';
import { PanchangDataSource } from 'jhigu-patro-utils-ts';

defineJhiguCalendar();
const panchang = new PanchangDataSource();
await panchang.load('/2082_tithi.json');

const cal = document.querySelector('jhigu-calendar');
cal.panchang = panchang;
cal.addEventListener('jhiguSelect', e => console.log(e.detail.tithi)); // e.g. 'प्रतिपदा'
```

What it does, from `ts/src/elements/calendarElement.ts` and its tests:

- Each day shows its sunrise tithi name under the day number. The name is hidden from assistive technology (`aria-hidden`) and added to the day's ARIA label instead, after the date: `... . Tithi: प्रतिपदा`. In `language="ne"` the label word is `तिथि`. It comes before event titles in the label.
- The selected day's panel lists the tithi with its paksha, for example `Tithi: प्रतिपदा, कृष्ण`.
- The `jhiguSelect` event detail is `{ bs, ad, events }` plus `tithi` (the name only) when the day has one.
- `show-tithi="false"` hides it. The default is on, but nothing shows without a `panchang`.
- The names and pakshas are Nepali in both languages. They are data, not translated labels.
- A day or month the data does not hold shows nothing. A source that throws is treated as having no tithi.
- The tithi is a shadow part named `tithi` for styling.

The element has no way to load data itself. Load the years first, then set the property. A month in a year that is not loaded (anything but 2081 and 2082) shows no tithi.

### `CalendarController`

`CalendarController` (`ts/src/calendar_controller.ts`) takes a `PanchangDataSource` as its second constructor argument and puts `sunriseTithi` on each grid day as `tithi`. It is not in the package `exports` map, so it is used from inside this repo (the demo in `ts/src/calendar_demo.ts` does). This sample is not run.

```js
import { CalendarController, StaticCalendarEventSource } from './calendar_controller.js';

const ctrl = new CalendarController(new StaticCalendarEventSource(), panchang);
ctrl.grid.find(d => d.bsDay === 1)?.tithi?.tithiName; // 'प्रतिपदा' when the shown month has data
```

Days outside the month have no `tithi`, and neither do days the data does not cover (`undefined`).

### Flutter

The Flutter `JhiguCalendar` widget has no tithi yet. The Dart `PanchangDataSource` exists, but nothing in `flutter/` uses it.

## Recipes

### 1. Show the tithi for a date

Convert an AD `Date` to BS, then look it up. `convertADToBS` reads the local year, month and day of the `Date` (month is 0-based in JavaScript), so the machine's time zone does not shift the result. The sample needs the calendar from the first block.

```js test
import { convertADToBS } from 'jhigu-patro-utils-ts';

const bs = convertADToBS(new Date(2025, 3, 14)); // local calendar fields: 14 April 2025
const t = panchang.sunriseTithi(bs.year, bs.month, bs.day);
`${bs.year}-${bs.month}-${bs.day} ${t?.tithiNumber} ${t?.paksha}`; // => '2082-1-1 1 कृष्ण'
```

### 2. The tithi right now

`tithiAt` wants minutes since midnight in Nepal time. `toNepalTime` shifts a `Date` to Nepal time (UTC+5:45) and encodes it as UTC, so read it with the UTC getters.

```js test
import { toNepalTime } from 'jhigu-patro-utils-ts';

const instant = new Date('2025-04-14T00:00:00Z'); // 05:45 in Nepal
const np = toNepalTime(instant);
const minute = np.getUTCHours() * 60 + np.getUTCMinutes();
minute; // => 345
panchang.tithiAt(2082, 1, 1, minute)?.tithiNumber; // => 1
```

### 3. List the tithi changes of a day

Segments are in time order. Format the minute yourself.

```js test
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const changes = panchang.getDay(2082, 1, 1).tithiSegments.map(s => `${hhmm(s.startMinute)} ${s.tithiName}`);
changes; // => ['00:00 प्रतिपदा', '06:59 द्वितीया']
```

### 4. Skip days without a tithi

A day with no segments is in the file but answers `null`. Test for `null` and do not assume every day has a tithi. 2081-2-32 is one of them.

```js test
panchang.getDay(2081, 2, 32)?.tithiSegments.length; // => 0
panchang.sunriseTithi(2081, 2, 32); // => null
panchang.tithiAt(2081, 2, 32, 720); // => null
```

### 5. Check which years you can answer for

Use `loadedYears` before you ask for a date, and treat `null` as "no data", not as "no tithi".

```js test
panchang.loadedYears.includes(2083); // => false
panchang.getDay(2083, 1, 1); // => null
panchang.sunriseTithi(2080, 1, 1); // => null
```

### 6. Tithi in a calendar page, with a fallback

Load both years once at start-up. If loading fails, leave `panchang` unset and the calendar draws without tithi, as `show-tithi` does with no source.

```js
const panchang = new PanchangDataSource();
try {
  await panchang.load('/2081_tithi.json');
  await panchang.load('/2082_tithi.json');
  document.querySelector('jhigu-calendar').panchang = panchang;
} catch (e) {
  console.warn('Tithi data not available; the calendar shows no tithi.', e);
}
```

## Errors and edge cases

- Nothing in the reader throws for an unknown year, month or day. It answers `null`. Only `load` throws (a failed response), and `addYear` fails on a malformed value.
- A day can exist with an empty `tithiSegments` list (see the known gaps). `getDay` returns it, `sunriseTithi` and `tithiAt` return `null`.
- `tithiAt` with a minute outside 0 to 1439 finds nothing and returns `null`, with one exception: see the tail segments below.
- Loading a year again replaces it and makes it `loadedYear`.
- Dates ignore time zones. The minute is Nepal clock time, and `getDay` takes BS calendar fields. Converting an instant to Nepal time is up to the caller (recipe 2).
- A tithi can run past midnight. The data has a few days where the last real segment ends after minute 1440 (for example 2081-4-12: tithi 7 कृष्ण ends at 1487). The reader returns it for any minute 0 to 1439. The next BS day starts from its own first segment at minute 0.

## Accuracy, limits and known gaps

- **Only BS 2081 and BS 2082 exist.** Any other year answers `null`. The calendar data covers more years, the tithi data does not.
- **Where the data came from is not recorded.** The files hold no source, method or date. [SOURCE NEEDED] Nothing in the repo shows how the minute values were computed, so treat them as unverified against any published panchang.
- **Sunrise is fixed at minute 375 (06:15 Nepal time)** for every day and place. The code calls this an approximation. Real sunrise changes through the year and with location.
- The validator reports these gaps and does not fix them, because the right values need a source. [SOURCE NEEDED]

| Gap | Days |
| --- | --- |
| Empty 32nd day (no segments) | 2081-2-32, 2081-4-32, 2082-3-32 |
| Tithi 15 कृष्ण is named पूर्णिमा (should be औंसी) | 2081-5-17 |
| Tithi 1 शुक्ल comes after 2 शुक्ल on the day before (goes backward) | 2082-2-14 |
| 14 शुक्ल is followed by 1 शुक्ल, then 1 कृष्ण on the 19th. 15 शुक्ल is missing and the 1 शुक्ल is probably it | 2082-8-18, 2082-8-19 |

- **Leftover tail segments.** Some days end with an extra segment that starts at or after minute 1440 and ends at 1440. It is never reached by minute 0 to 1439, so `tithiAt` and `sunriseTithi` ignore it. The validator counts 14 such days in 2081 and 21 in 2082. Example: 2081-4-12 has `7 सप्तमी 0..1487` followed by `8 अष्टमी 1487..1440`.
- Because of the doubtful days above, do not show a tithi on 2081-5-17, 2082-2-14, 2082-8-18 or 2082-8-19 as fact without a check.
- The data holds the tithi in the Nepal day only. It has no festival, nakshatra, yoga or karana.

## How it is tested

- **Validator.** `node tools/check-tithi/validate.mjs [year ...]` checks every `data/<year>_tithi.json` against `data/nepali_calendar_data.json`. Hard checks: 12 months; month lengths match the calendar; days numbered 1 to n; `adDate` is a real date, one day after the previous, and starts at the AD date of 1 Baisakh; segments are contiguous from minute 0 to 1440; start is before end; `tithiNumber` 1 to 15; the name matches number and paksha; and across the year the tithi only moves forward by 0, 1 or 2 steps (15 of one paksha is followed by 1 of the other). Anything not in the known lists fails with exit code 1. Current output: both files `ok`, with the known gaps above reported.
- **CI.** `.github/workflows/ci-data.yml` runs the validator, and checks that `ts/2081_tithi.json`, `ts/src/data_sources/2081_tithi.json` and `ts/2082_tithi.json` match `data/`.
- **Shared vectors.** `testdata/tithi.json` is made by `python3 tools/check-tithi/make_vectors.py`, which shares no code with the TS and Dart readers. It lists one line per day, `YYYY-M-D a b c d`, where a to d are the tithi at minutes 0, 375, 720 and 1439, written `<number><S|K>` or `-`. It stores a 64-bit FNV-1a hash of all 731 lines, checkpoints, and probes (single lookups, including edges such as minute 418 and 419, a day with no segments, and years and days that are not loaded). `ts/tests/panchang.test.ts` and `dart/test/panchang_test.dart` rebuild the lines from their own reader and compare. Same data, same answer in TS and Dart.
- **Reader tests** in `ts/tests/panchang.test.ts` cover several years at once, load order, both file shapes, replacing a year, the minute-375 rule, and `load` with a failing fetch.
- **Calendar tests.** `ts/tests/calendarElement.test.ts` checks the markup (name under the day, `aria-hidden`, ARIA label, escaping, nothing without a source). `ts/tests/calendarController.test.ts` checks that the controller puts the sunrise tithi on a day.
- **This guide.** The `js test` blocks above run in `ts/tests/docs.test.ts`. The Dart sample was run by hand against the repo data.

## Related guides

- [Calendar data](../calendar-data/README.md): month lengths and the supported range, which the tithi files are checked against.
- [Dates](../dates/README.md): `NepaliDate`, conversion and formatting.
- [Web components](../web-components/README.md): `<jhigu-calendar>` and its attributes and events.
- [Headless widgets](../headless-widgets/README.md): the state machines under the calendar.
- [Usage guide](../../USAGE.md): setup and the other features.
