# jhigu_patro_utils

Bikram Sambat (BS / Nepali) calendar utilities.
Converts between BS and AD (Gregorian), formats Nepali dates, handles Nepal timezone (GMT+5:45), and provides relative time strings in Nepali.

**Zero external dependencies. Offline-first. Works everywhere.**

---

## What's inside

```
jhigu_patro_utils/
├── data/                              Shared calendar data (BS 2000–2100)
│   └── nepali_calendar_data.json
│
├── ts/                                TypeScript / JavaScript library
│   ├── src/
│   │   ├── types.ts
│   │   ├── nepaliCalendar.ts          Core engine
│   │   ├── data_sources/
│   │   │   ├── InlineCalendarDataSource.ts   In-memory (Node / server / test)
│   │   │   └── JsonCalendarDataSource.ts     fetch()-based (browser / Vite)
│   │   └── index.ts                   Barrel export
│   └── tests/
│       └── nepaliCalendar.test.ts
│
├── dart/                              Dart / Flutter library
│   ├── lib/
│   │   ├── jhigu_patro_utils.dart     Library entry point
│   │   └── src/
│   │       ├── types.dart
│   │       ├── nepali_calendar.dart   Core engine (NepaliCalendar static class)
│   │       └── data_sources/
│   │           └── inline_calendar_data_source.dart
│   ├── pubspec.yaml
│   └── test/
│       └── nepali_calendar_test.dart
│
└── cli/                               Command-line tool (jhigu-patro)
    ├── src/
    │   └── index.ts
    ├── dist/
    │   └── index.js                   Compiled executable
    ├── package.json
    └── tsconfig.json
```

---

## CLI — `jhigu-patro`

### Install globally

```bash
cd cli
npm install
npm run build
npm install -g .
```

### Commands

```
jhigu-patro today
jhigu-patro ad2bs  <YYYY-MM-DD>
jhigu-patro bs2ad  <YYYY-MM-DD>
jhigu-patro month  [BS-YYYY] [1-12]
jhigu-patro info   <YYYY-MM-DD>
jhigu-patro help
```

### Examples

```bash
$ jhigu-patro today
────────────────────────────────────────────
  आजको मिति (Today's Date)
────────────────────────────────────────────
  Nepali (BS):        ८ फागुन २०८२, शुक्रबार
  English (AD):       February 20, 2026
  BS (numeric):       2082-11-08
  AD (numeric):       2026-02-20
  Month (EN):         Falgun
  Month (NE):         फागुन
  Day (EN):           Shukrabar
  Day (NE):           शुक्रबार
────────────────────────────────────────────

$ jhigu-patro ad2bs 2025-02-20
────────────────────────────────────────────
  AD → BS  (2025-02-20)
────────────────────────────────────────────
  AD (input):         February 20, 2025
  BS (result):        Falgun 8, 2081
  BS (Nepali):        फागुन 8, 2081
  BS (numeric):       2081-11-08
  Weekday (EN):       Bihibar
  Weekday (NE):       बिहिबार
  Relative:           ८ फागुन २०८१
────────────────────────────────────────────

$ jhigu-patro bs2ad 2082-11-08
────────────────────────────────────────────
  BS → AD  (2082-11-08)
────────────────────────────────────────────
  BS (input):         Falgun 8, 2082
  BS (Nepali):        फागुन 8, 2082
  AD (result):        February 20, 2026
  AD (numeric):       2026-02-20
  Weekday (EN):       Shukrabar
  Weekday (NE):       शुक्रबार
────────────────────────────────────────────

$ jhigu-patro month 2082 11
────────────────────────────────────────────
  फागुन २०८२  (Falgun 2082)
  2026-02-12 onwards
────────────────────────────────────────────
     आइ   सोम   मंग   बुध  बिहि शुक्र   शनि
  ───────────────────────────────────
                                1     2
       3     4     5     6     7     8     9
      10    11    12    13    14    15    16
      17    18    19    20    21    22    23
      24    25    26    27    28    29    30
────────────────────────────────────────────
  Total days: 30
────────────────────────────────────────────

$ jhigu-patro info 2082-11-08
────────────────────────────────────────────
  Date Info  (input treated as BS)
────────────────────────────────────────────
  BS:                 ८ फागुन २०८२, शुक्रबार
  BS (Nepali):        फागुन 8, 2082
  BS (numeric):       2082-11-08
  AD:                 February 20, 2026
  AD (numeric):       2026-02-20
  Weekday (EN):       Shukrabar
  Weekday (NE):       शुक्रबार
  Relative (NE):      हालै
────────────────────────────────────────────
```

> `info` auto-detects whether the input is BS or AD based on the year value (≥ 2000 → treated as BS).

---

## TypeScript / JavaScript Library

### Setup

```bash
cd ts
npm install
npm run build   # outputs to ts/dist/
npm run test:run
```

Or run everything from the root:

```bash
npm run build      # builds ts/ and cli/
npm run test:run   # runs ts/ tests
```

### Browser (Vite / Next.js / React)

Serve `data/nepali_calendar_data.json` from your `public/` folder, then:

```ts
import { JsonCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils';

const source = new JsonCalendarDataSource();
await source.initialize('/nepali_calendar_data.json');
initializeCalendar(source);
```

### Node.js / Server-side

```ts
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils';
import type { CalendarJson } from 'jhigu-patro-utils';

const data: CalendarJson = JSON.parse(readFileSync('data/nepali_calendar_data.json', 'utf8'));
const source = new InlineCalendarDataSource(data.years, data.supportedRange.start, data.supportedRange.end);
initializeCalendar(source);
```

### API

```ts
import {
  convertADToBS,
  convertBSToAD,
  getCurrentNepaliDate,
  getCurrentNepaliDateFormatted,
  formatNepaliDate,
  formatNepaliDateWithDay,
  formatEnglishDate,
  getRelativeTimeInNepali,
  toNepalTime,
  fromNepalTime,
  toNepaliDigits,
  getNepaliMonthName,
  getNepaliDayName,
  getDaysInBSMonth,
  isValidBSDate,
} from 'jhigu-patro-utils';

convertADToBS(new Date(2024, 3, 13));
// → { year: 2081, month: 1, day: 1 }

convertBSToAD(2082, 11, 8);
// → Date (February 20, 2026)

getCurrentNepaliDateFormatted();
// → "८ फागुन २०८२, शुक्रबार"

formatNepaliDate({ year: 2082, month: 11, day: 8 }, 'ne');
// → "फागुन 8, 2082"

getRelativeTimeInNepali(new Date(Date.now() - 300_000));
// → "५ मिनेट अगाडि"

toNepaliDigits(2082);
// → "२०८२"

getDaysInBSMonth(2082, 11);
// → 30
```

---

## Dart / Flutter Library

### Setup

Add to your `pubspec.yaml`:

```yaml
dependencies:
  jhigu_patro_utils:
    path: /path/to/jhigu_patro_utils/dart
```

### Initialize (Flutter — from assets)

Copy `data/nepali_calendar_data.json` into your Flutter app's `assets/` folder and register it in `pubspec.yaml`:

```yaml
flutter:
  assets:
    - assets/nepali_calendar_data.json
```

Then initialize before `runApp`:

```dart
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

Future<void> initCalendar() async {
  final raw = await rootBundle.loadString('assets/nepali_calendar_data.json');
  final json = jsonDecode(raw) as Map<String, dynamic>;
  final years = (json['years'] as Map<String, dynamic>).map(
    (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
  );
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: years,
    supportedStartYear: json['supportedRange']['start'] as int,
    supportedEndYear:   json['supportedRange']['end']   as int,
  ));
}
```

### Initialize (Dart CLI / server)

```dart
import 'dart:convert';
import 'dart:io';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

void main() {
  final raw = File('data/nepali_calendar_data.json').readAsStringSync();
  final json = jsonDecode(raw) as Map<String, dynamic>;
  final years = (json['years'] as Map<String, dynamic>).map(
    (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
  );
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: years,
    supportedStartYear: json['supportedRange']['start'] as int,
    supportedEndYear:   json['supportedRange']['end']   as int,
  ));
}
```

### API

```dart
NepaliCalendar.convertADToBS(DateTime.utc(2024, 4, 13));
// → NepaliDate(year: 2081, month: 1, day: 1)

NepaliCalendar.convertBSToAD(2082, 11, 8);
// → DateTime.utc(2026, 2, 20)

NepaliCalendar.getCurrentNepaliDateFormatted();
// → "८ फागुन २०८२, शुक्रबार"

NepaliCalendar.formatNepaliDate(
  NepaliDate(year: 2082, month: 11, day: 8),
  nepali: true,
);
// → "फागुन 8, 2082"

NepaliCalendar.getRelativeTimeInNepali(
  DateTime.now().subtract(Duration(minutes: 5)),
);
// → "५ मिनेट अगाडि"

NepaliCalendar.toNepaliDigits(2082);
// → "२०८२"

NepaliCalendar.getDaysInBSMonth(2082, 11);
// → 30
```

### Run Dart tests

```bash
cd dart
dart pub get
dart test
```

---

## Calendar data

`data/nepali_calendar_data.json` is the single source of truth used by all three implementations.

- Covers **BS 2000–2100**
- Each year entry is a 12-element array: `[daysInBaisakh, daysInJestha, ..., daysInChaitra]`
- Reference point: **BS 2000/1/1 = AD 1943-04-14**

```json
{
  "version": "1.0",
  "supportedRange": { "start": 2000, "end": 2100 },
  "referencePoint": { "bsYear": 2000, "bsMonth": 1, "bsDay": 1,
                      "adYear": 1943, "adMonth": 4, "adDay": 14 },
  "years": {
    "2082": [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    ...
  }
}
```

---

## Quick reference

| BS Month | English name | Approx. AD period |
|----------|-------------|-------------------|
| 1  बैशाख | Baisakh  | Apr–May  |
| 2  जेठ   | Jestha   | May–Jun  |
| 3  असार  | Asar     | Jun–Jul  |
| 4  साउन  | Shrawan  | Jul–Aug  |
| 5  भदौ   | Bhadra   | Aug–Sep  |
| 6  असोज  | Ashwin   | Sep–Oct  |
| 7  कार्तिक | Kartik | Oct–Nov  |
| 8  मंसिर | Mangsir  | Nov–Dec  |
| 9  पौष   | Poush    | Dec–Jan  |
| 10 माघ   | Magh     | Jan–Feb  |
| 11 फागुन | Falgun   | Feb–Mar  |
| 12 चैत्र | Chaitra  | Mar–Apr  |

BS is approximately **56–57 years ahead** of AD.
