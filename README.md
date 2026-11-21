# jhigu_patro_utils

Bikram Sambat (BS / Nepali) calendar utilities.
Converts between BS and AD (Gregorian), formats Nepali dates, handles Nepal timezone (GMT+5:45), and provides relative time strings in Nepali.

**Offline-first. No runtime dependencies in the TypeScript package; the Dart package's only dependency is `pdf`, used just by the optional `receipt_pdf.dart`.**

## The toolkit

This repository is growing from a calendar library into one toolkit for apps in Nepal, in TypeScript/JavaScript and Dart, with shared data and shared test vectors so both give the same answers:

| Area | What you get |
|------|--------------|
| Dates | `NepaliDate`, BS/AD conversion, token formatter, parser, fiscal year, month grid |
| Money | `Npr` (integer paisa), lakh grouping, VAT, allocation, amount in words (English) |
| Phone | Parse and validate Nepali mobile and landline numbers, carrier names |
| Address | Provinces, districts, local levels and wards; search and formatting |
| Receipts | Model, validation and totals (TS and Dart); HTML template for print or PDF (TS); PDF output (Dart) |
| SMS | Gateway interface (bring your own provider), templates, segment counter, retrying scheduler |
| Headless widgets | Framework-free state machines for date, range, address, money and phone inputs |
| Web components | `<jhigu-date-picker>`, `-date-range-picker`, `-calendar`, `-address-select`, `-money-input`, `-phone-input` |

**Start with [docs/USAGE.md](docs/USAGE.md).** Its JavaScript samples are run by the test suite. Design notes and known gaps are in `data/*_NOTES.md`; the plan is in `docs/PRD.md` and `docs/IMPLEMENTATION_GUIDE.md`. The sections below describe the original calendar library and CLI, which still work as described.

---

## What's inside (original layout)

The tree shows the calendar-era layout. Newer code is in `ts/src/` (dates, money, phone, address, receipts, SMS, pickers, `elements/`), `dart/lib/src/`, `data/` (shared JSON and notes), `testdata/` (shared vectors), `tools/` (generators and checks) and `docs/`.

```
jhigu_patro_utils/
├── data/                              Shared calendar data (BS 2000–2100)
│   ├── nepali_calendar_data.json
│   └── 2081_tithi.json                Panchang / lunar (tithi) data for 2081
│
├── ts/                                TypeScript / JavaScript library + browser demo
│   ├── src/
│   │   ├── types.ts
│   │   ├── nepaliCalendar.ts          Core engine
│   │   ├── consts.ts                  Weekday header constants
│   │   ├── calendar_models.ts         CalendarDay, CalendarEvent models
│   │   ├── calendar_controller.ts     Business logic for interactive calendar
│   │   ├── calendar_section.ts        Vanilla DOM renderer (no framework)
│   │   ├── calendar_styles.ts         CSS-in-JS styles
│   │   ├── calendar_demo.ts           Browser demo entry point
│   │   ├── data_sources/
│   │   │   ├── InlineCalendarDataSource.ts   In-memory (Node / server / test)
│   │   │   ├── JsonCalendarDataSource.ts     fetch()-based (browser / Vite)
│   │   │   └── PanchangDataSource.ts         Tithi / lunar data loader
│   │   └── index.ts                   Barrel export
│   ├── index.html                     Browser demo page
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
├── cli/                               Command-line tool (jhigu-patro)
└── react/                             React components for the web components (jhigu-patro-react)
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
jhigu-patro money  <amount> [--vat excl|incl] [--rate 13] [--words]
jhigu-patro phone  <number> [--allow-inactive]
jhigu-patro address <localLevelId> <ward> [--tole T] [--street S]
jhigu-patro address search <text> [--limit 10] [--in auto|en|ne]
jhigu-patro sms keys
jhigu-patro sms <template> [name=value ...]
jhigu-patro fmt    <BS date> <preset|pattern> [--digits native|ascii]
jhigu-patro parse  <date text>
jhigu-patro fiscal <BS date>
jhigu-patro help
```

The commands from `money` on take `--lang en|ne` (the language of labels and error messages) and `--json` (print the result as JSON; an error is JSON on stderr). Exit codes: `0` ok, `1` the input was rejected (bad amount, phone, date, ...), `2` the command was used wrongly. Errors are one line, never a stack trace. A negative amount can be given as is (`money -1500`).

```
$ jhigu-patro money 1234567.5 --vat excl --words
Amount:       Rs. 12,34,567.50
Paisa:        123456750
Devanagari:   रु १२,३४,५६७.५०
In words:     Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paisa Only (English only)

VAT 13% (added to the price):
  Subtotal:   Rs. 12,34,567.50
  VAT:        Rs. 1,60,493.78
  Total:      Rs. 13,95,061.28

$ jhigu-patro phone 9841234567 --json
{
  "e164": "+9779841234567",
  "national": "984-1234567",
  "type": "mobile",
  "carrier": "NTC",
  "areaCode": null
}

$ jhigu-patro address 274 3 --lang ne
वडा नं. ३, भक्तपुर नगरपालिका, भक्तपुर, बाग्मती

$ jhigu-patro sms appointment name=Ram date=2082-05-10 time=9:00 sender=Shop
Dear Ram, reminder: your appointment is on 2082-05-10 at 9:00. - Shop
gsm7, 69 units, 1 segment
```

`fmt` takes a preset (`full long iso slash dmy short monthYear gate dual fiscal`) or a token pattern such as `"D MMMM YYYY"`. `parse` reads a date written many ways and prints both BS and AD. A date that does not exist (like Poush 30, 2081) is a `PARSE_ERROR`, since it cannot be read from text. Carrier names are not an official list (`data/PHONE_NOTES.md`); amount in words is English only.

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
  Day (EN):           Friday
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
  Weekday (EN):       Thursday
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
  Weekday (EN):       Friday
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
  Weekday (EN):       Friday
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

CLI tests (after building `ts/` and `cli/`): `cd cli && npm test`.

### Browser (Vite / Next.js / React)

Serve `data/nepali_calendar_data.json` from your `public/` folder, then:

```ts
import { JsonCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

const source = new JsonCalendarDataSource();
await source.initialize('/nepali_calendar_data.json');
initializeCalendar(source);
```

### Node.js / Server-side

```ts
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';
import type { CalendarJson } from 'jhigu-patro-utils-ts';

const data: CalendarJson = JSON.parse(readFileSync('data/nepali_calendar_data.json', 'utf8'));
const source = new InlineCalendarDataSource(data.years, data.supportedRange.start, data.supportedRange.end);
initializeCalendar(source);
```

### Panchang / Lunar Data

For tithi (lunar phase) information, use `PanchangDataSource`:

```ts
import { PanchangDataSource } from 'jhigu-patro-utils-ts';

const panchang = new PanchangDataSource();
await panchang.load('/2081_tithi.json');

// Get all tithi segments for a given BS year/month/day
// Returns null if data for that year is not loaded
const day = panchang.getDay(2081, 11, 8);       // year 2081, month 11, day 8
// → PanchangDay { bsDay, adDate, tithiSegments: [...] }

// Dominant tithi at sunrise (minute 375 = 6:15 AM Nepal time)
const tithi = panchang.sunriseTithi(2081, 11, 8);
// → TithiSegment { tithiNumber, tithiName, paksha, startMinute, endMinute }
// → null if year doesn't match loaded data

// Tithi at any minute of the day
const current = panchang.tithiAt(2081, 11, 8, 720);  // noon
```

### API

```ts
import {
  // Setup
  initializeCalendar,

  // Names / constants
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NE,
  ENGLISH_MONTHS,
  NEPALI_DAYS_EN,
  NEPALI_DAYS_NE,
  NEPALI_DIGITS,

  // Conversion
  convertADToBS,
  convertBSToAD,

  // Current date
  getCurrentNepaliDate,
  getCurrentNepaliDateFormatted,

  // Formatting
  formatNepaliDate,
  formatNepaliDateWithDay,
  formatEnglishDate,
  formatNepalDateTime,
  getNepaliMonthName,
  getNepaliDayName,
  toNepaliDigits,
  getRelativeTimeInNepali,

  // Timezone
  toNepalTime,
  fromNepalTime,

  // Data helpers
  getDaysInBSMonth,
  getTotalDaysInBSYear,
  isValidBSDate,
  getAvailableBSYears,
  getAvailableADYears,
} from 'jhigu-patro-utils-ts';

// Conversion
convertADToBS(new Date(2024, 3, 13));
// → { year: 2081, month: 1, day: 1 }

convertBSToAD(2082, 11, 8);
// → Date (February 20, 2026)

// Current date
getCurrentNepaliDate();
// → { year: 2082, month: 11, day: 8 }

getCurrentNepaliDateFormatted();
// → "८ फागुन २०८२, शुक्रबार"

// Formatting
formatNepaliDate({ year: 2082, month: 11, day: 8 }, 'en');
// → "Falgun 8, 2082"

formatNepaliDate({ year: 2082, month: 11, day: 8 }, 'ne');
// → "फागुन 8, 2082"

formatNepaliDateWithDay({ year: 2082, month: 11, day: 8 });
// → "८ फागुन २०८२, शुक्रबार"

formatEnglishDate(new Date(2026, 1, 20));
// → "February 20, 2026"

formatNepalDateTime(new Date());
// → "2082-11-08 14:30" (Nepal time)

getNepaliMonthName(11, 'en');
// → "Falgun"

getNepaliMonthName(11, 'ne');
// → "फागुन"

getNepaliDayName(new Date(2026, 1, 20), 'en');
// → "Friday"

// Relative time
getRelativeTimeInNepali(new Date(Date.now() - 300_000));
// → "५ मिनेट अगाडि"

// Digits
toNepaliDigits(2082);
// → "२०८२"

// Data helpers
getDaysInBSMonth(2082, 11);
// → 30

getTotalDaysInBSYear(2082);
// → 365

isValidBSDate(2082, 11, 8);
// → true

getAvailableBSYears();
// → [2000, 2001, ..., 2100]

getAvailableADYears();
// → [1943, 1944, ..., 2044]

// Timezone
toNepalTime(new Date());    // Add UTC+5:45 offset
fromNepalTime(new Date());  // Remove UTC+5:45 offset
```

---

## Browser Demo (Interactive Calendar UI)

The `ts/` package ships a zero-framework interactive calendar UI built with vanilla DOM APIs.

### Run locally

```bash
cd ts
npm install
npm run build
# Serve ts/ with any static file server, e.g.:
npx serve .
# Then open http://localhost:3000
```

The demo page (`ts/index.html`) renders a two-column layout:

- **Left (60%)** — Monthly calendar grid with navigation arrows, today highlight, and Nepali holidays
- **Right (35%)** — Detail panel for the selected day, showing events and tithi info

### Embed in your own page

```html
<div id="calendar-root"></div>
<div id="day-list-root"></div>
<script type="module" src="dist/calendar_demo.js"></script>
```

The calendar includes hardcoded Nepali public holidays for BS 2081–2082:
नयाँ वर्ष, बुद्ध जयन्ती, गणतन्त्र दिवस, तीज, विजयादशमी, लक्ष्मी पूजा, महाशिवरात्री, and more.

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

- Covers **BS 2000–2100** (AD 1943–2044)
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

`data/2081_tithi.json` holds Panchang (lunar phase) data for BS 2081, with per-day tithi segments including tithi number, name, paksha (शुक्ल/कृष्ण), and start/end minutes within the Nepal day.

---

## Quick reference

| BS Month | English name | Approx. AD period |
|----------|-------------|-------------------|
| 1  बैशाख | Baisakh  | Apr–May  |
| 2  जेठ   | Jestha   | May–Jun  |
| 3  असार  | Ashadh   | Jun–Jul  |
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

---

## License

MIT
