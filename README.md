# Jhigu Patro Kit

A toolkit for apps in Nepal: Bikram Sambat (BS) dates, Nepali money, phone numbers, addresses, receipts and
SMS reminders. It comes as a TypeScript/JavaScript library, a Dart library, web components, React and Vue
wrappers, Flutter widgets and a command-line tool. The TypeScript and Dart libraries share their data and their
test vectors, so the same input gives the same output in both.

Offline-first. The TypeScript package has no runtime dependencies. The Dart package's only dependency is `pdf`,
used just by the optional receipt PDF output.

**Status: not published to npm or pub.dev yet.** Install from this repository (see [Install](#install)).

- [What you get](#what-you-get)
- [Install](#install)
- [Quick start](#quick-start)
- [Feature guides](#feature-guides)
- [Packages in this repository](#packages-in-this-repository)
- [Calendar data and accuracy](#calendar-data-and-accuracy)
- [Design rules](#design-rules)
- [Build, test and CI](#build-test-and-ci)
- [Known gaps](#known-gaps)
- [Documentation map](#documentation-map)
- [Quick reference: BS months](#quick-reference-bs-months)
- [License](#license)

## What you get

| Area | What it does | Guide |
|---|---|---|
| Calendar data | The BS month-length table (BS 2000 to 2100), data sources, loading it in every environment, accuracy flags | [calendar-data](docs/features/calendar-data/README.md) |
| Dates | `NepaliDate`, BS and AD conversion, token formatter and presets, date parser, fiscal year, month grid | [dates](docs/features/dates/README.md) |
| Tithi | Lunar-day (panchang) data for BS 2081 and 2082, a loader, and tithi in the calendar widgets | [tithi](docs/features/tithi/README.md) |
| Money | `Npr` in integer paisa, lakh grouping, VAT, allocation, amount in words (English, and Nepali under review) | [money](docs/features/money/README.md) |
| Phone | Parse and validate Nepali mobile and landline numbers, carrier names, E.164 | [phone](docs/features/phone/README.md) |
| Address | Provinces, districts, local levels and wards; search and formatting | [address](docs/features/address/README.md) |
| Receipts | Receipt model, totals and validation; HTML for print (TS); PDF output (Dart) | [receipts](docs/features/receipts/README.md) |
| SMS | Gateway interface (bring your own provider), templates, segment counter, retrying reminder scheduler | [sms](docs/features/sms/README.md) |
| Headless widgets | Framework-free state machines for date, range, address, money and phone inputs | [headless-widgets](docs/features/headless-widgets/README.md) |
| Web components | `<jhigu-date-picker>`, `<jhigu-date-range-picker>`, `<jhigu-calendar>`, `<jhigu-address-select>`, `<jhigu-money-input>`, `<jhigu-phone-input>` | [web-components](docs/features/web-components/README.md) |
| React | One component per web component | [react](react/README.md) |
| Vue 3 | One component per web component | [vue](vue/README.md) |
| Flutter | Date picker, range picker, calendar and more, on the Dart state machines | [flutter](flutter/README.md) |
| CLI | `jhigu-patro`: dates, money, phone, address, SMS from the terminal | [cli](cli/README.md) |

## Install

Nothing is published yet, so build from a clone:

```bash
git clone git@github.com:surhidamatya/JhiguPatro.git
cd JhiguPatro

# TypeScript library
cd ts && npm ci && npm run build

# Dart library
cd ../dart && dart pub get

# CLI (needs the TypeScript library built first)
cd ../cli && npm ci && npm run build && npm install -g .
```

`react/` and `vue/` link the TypeScript library from `../ts` for development. In an app, install
`jhigu-patro-utils-ts` next to them (it is a peer dependency, so the app and the elements share one copy of the
calendar state). Flutter depends on `../dart` by path.

## Quick start

### TypeScript or JavaScript

The calendar data has to be loaded once before dates are converted or validated. Money, phone and SMS
templates do not need it.

```ts
import { initializeCalendar, InlineCalendarDataSource, convertADToBS, Npr } from 'jhigu-patro-utils-ts';
import data from 'jhigu-patro-utils-ts/nepali_calendar_data.json' with { type: 'json' };

initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));

convertADToBS(new Date(2025, 7, 26));   // { year: 2082, month: 5, day: 10 }
```

In a browser, serve the JSON as a static file and use `JsonCalendarDataSource` instead. Loading in Node, the
browser, Next.js and Nuxt is covered in the [calendar-data guide](docs/features/calendar-data/README.md).

### Dart

```dart
import 'dart:convert';
import 'dart:io';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

void main() {
  final data = jsonDecode(File('../data/nepali_calendar_data.json').readAsStringSync()) as Map<String, dynamic>;
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: (data['years'] as Map<String, dynamic>).map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
    supportedStartYear: (data['supportedRange'] as Map)['start'] as int,
    supportedEndYear: (data['supportedRange'] as Map)['end'] as int,
    verifiedThrough: data['verifiedThrough'] as int,
  ));
  print(NepaliCalendar.convertADToBS(DateTime(2025, 8, 26)));
}
```

In Flutter, load the JSON from an asset instead of a file. See the [flutter README](flutter/README.md).

### Command line

```bash
jhigu-patro ad2bs 2025-08-26
jhigu-patro money 1234567.5 --vat excl --words
jhigu-patro phone 9841234567 --json
jhigu-patro month 2082 5
```

### In a web page, React or Vue

```html
<script type="module">
  import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
  import { defineJhiguDatePicker } from 'jhigu-patro-utils-ts/date-picker-element';
  // ... initializeCalendar(...) with the data, then:
  defineJhiguDatePicker();
</script>
<jhigu-date-picker name="dob" language="ne" required></jhigu-date-picker>
```

The element is form-associated: `name` puts its value (`YYYY-MM-DD`) in the surrounding form. All six elements,
their attributes, events and theming are in the [web-components guide](docs/features/web-components/README.md).
React and Vue wrap the same elements: [react](react/README.md), [vue](vue/README.md).

## Feature guides

Each guide has an overview, setup, TypeScript and Dart quick starts, an API table, recipes, errors, known gaps
and how the feature is tested. The JavaScript samples in them are run by the test suite, so they are known to
work.

1. [Calendar data](docs/features/calendar-data/README.md)
2. [Dates](docs/features/dates/README.md)
3. [Tithi (panchang)](docs/features/tithi/README.md)
4. [Money](docs/features/money/README.md)
5. [Phone numbers](docs/features/phone/README.md)
6. [Addresses](docs/features/address/README.md)
7. [Receipts](docs/features/receipts/README.md)
8. [SMS](docs/features/sms/README.md)
9. [Headless widgets](docs/features/headless-widgets/README.md)
10. [Web components](docs/features/web-components/README.md)

For one long page that covers the JavaScript API in order, see [docs/USAGE.md](docs/USAGE.md).

To add the library to your own project, follow the [integration guide](examples/README.md) and run the examples in `examples/`.

## Packages in this repository

| Directory | Package | What it is |
|---|---|---|
| `ts/` | `jhigu-patro-utils-ts` 1.0.0 | TypeScript library, headless widgets and web components. Subpath entry points (`/address`, `/sms`, `/money-input`, `/date-picker-element`, ...) keep bundles small. See [ts/README.md](ts/README.md). |
| `dart/` | `jhigu_patro_utils` 1.0.0 | Dart library with the same features. No Flutter needed. |
| `flutter/` | `jhigu_patro_flutter` 0.1.0 | Flutter widgets, dialogs and PDF receipt helpers. See [flutter/README.md](flutter/README.md). |
| `react/` | `jhigu-patro-react` 0.1.0 | React 18 and 19 components for the web components. |
| `vue/` | `jhigu-patro-vue` 0.1.0 | Vue 3.3, 3.4 and 3.5 components for the web components. |
| `cli/` | `jhigu-patro` 1.0.0 | Command-line tool. |
| `data/` | | Source of truth for shared data, plus a notes file per feature (`data/*_NOTES.md`). |
| `testdata/` | | Shared test vectors that the TypeScript and Dart tests both read. |
| `tools/` | | Generators and checks (data validators, browser and server-rendering checks, pack check). |
| `docs/` | | Feature guides, usage guide, product requirements and implementation guide. |

The directory `react/` also holds a Vite example and a Next.js example; `vue/` holds a Vite example and a Nuxt
example.

## Calendar data and accuracy

The BS month lengths for BS 2000 to 2100 live in `data/nepali_calendar_data.json`. BS has no formula, so the
table is data, not code.

- Up to the `verifiedThrough` year in the file (2083), the published tables compared in
  `data/CALENDAR_NOTES.md` agree with this one. That is agreement between sources, not an official
  verification. BS 2084 to 2099 are in the table and convert normally, but the sources disagree there, so
  they are treated as unverified. Use `isVerifiedYear` or `getDateAccuracy` to find out which a date is.
- Known disagreements between sources, and how they were handled, are in
  [`data/CALENDAR_NOTES.md`](data/CALENDAR_NOTES.md).
- Dates are calendar fields only. No time zone enters a conversion; `today` uses the date in Nepal (GMT+5:45).
- Tithi data exists only for BS 2081 and 2082, and has known gaps listed in the [tithi guide](docs/features/tithi/README.md).

## Design rules

These come from [CLAUDE.md](CLAUDE.md) and are checked by tests and CI.

- `data/` is the source of truth. The copies in `ts/` are checked against it in CI.
- The same input gives the same output in TypeScript and Dart. Shared vectors live in `testdata/`.
- Money is integer paisa, never a float. Dates ignore time zones.
- Errors are typed (`JhiguError`, `MoneyError`, `PhoneError`, ...), with stable codes. User-facing labels
  come from `data/strings.en.json` and `data/strings.ne.json`, not from the code.
- Nothing about the calendar, phone prefixes or provider APIs is guessed. Open facts are marked `[SOURCE NEEDED]`.

## Build, test and CI

```bash
# TypeScript: build, then the whole test suite (includes the docs samples)
cd ts && npm ci && npm run build && npm run test:run

# Dart
cd dart && dart pub get && dart test

# React, Vue, CLI
cd react && npm ci && npm test
cd vue && npm ci && npm test
cd cli && npm test

# Data checks (calendar, tithi, phone, address, strings, generated files)
node tools/check-calendar/validate.mjs
node tools/check-tithi/validate.mjs
node tools/gen-data/gen.mjs --check
```

Four GitHub Actions workflows run on every push: `ci-data` (data validators, generated files and the copies in
`ts/` match `data/`), `ci-js` (TypeScript tests in four time zones, package pack check, the Next.js and Nuxt
examples, the Vue 3.3 and 3.4 matrix), `ci-dart` and `ci-flutter`.

Browser checks are run by hand with Playwright: `tools/browser-check` drives the web components in real
browsers and runs an axe accessibility audit; `tools/ssr-check` builds the Next.js and Nuxt examples and checks
server rendering and hydration. See their READMEs for what each covers.

## Known gaps

These are the open items that matter when you depend on the toolkit. Each is also noted in the guide or notes
file for its feature.

- **Nothing is published**, and the packages have no `LICENSE` file inside them yet (they declare MIT).
- **Calendar:** BS 2084 to 2099 cannot be verified against an official source. For BS 2062, months 1 and 2,
  this table has 30 and 32 days; one other package and one calendar website give 31 and 31. The data was not
  changed pending an official calendar.
- **Tithi:** only BS 2081 and 2082. Three days have no tithi, four are doubtful, and where the data came from is
  not recorded.
- **Nepali words for numbers:** the 100-word table was taken from one package and compared with three web
  tables; 38 of the 100 words are disputed between sources, and no native speaker has reviewed it. The scale
  spellings अर्ब and खर्ब are unresolved.
- **Phone:** carrier names and prefixes are best effort, not an official list.
- **SMS:** no gateway is built in; you plug in your own provider. A Sandesh gateway is not built, because its
  API details are [SOURCE NEEDED].
- **Browsers:** the web components were checked in Chromium only. Firefox, Safari, touch devices and real screen
  readers are not verified.
- **React Native:** not supported. Only the web components, through React DOM, are covered.
- **Angular and Svelte wrappers:** not built.

## Documentation map

- Feature guides: [docs/features/](docs/features/calendar-data/README.md) (list above)
- Runnable examples and a step-by-step integration guide: [examples/](examples/README.md)
- Usage guide, one page: [docs/USAGE.md](docs/USAGE.md)
- Design notes and known gaps per feature: `data/CALENDAR_NOTES.md`, `DATES_NOTES.md`, `MONEY_NOTES.md`,
  `PHONE_NOTES.md`, `ADDRESS_NOTES.md`, `RECEIPT_NOTES.md`, `SMS_NOTES.md`, `PICKER_NOTES.md`, `STRINGS_NOTES.md`
- Plan: [docs/PRD.md](docs/PRD.md), [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md)
- Shared test vectors: [testdata/README.md](testdata/README.md)
- Third-party notices and data sources: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## Quick reference: BS months

| BS month | English name | Approx. AD period |
|---|---|---|
| 1 बैशाख | Baisakh | Apr to May |
| 2 जेठ | Jestha | May to Jun |
| 3 असार | Ashadh | Jun to Jul |
| 4 साउन | Shrawan | Jul to Aug |
| 5 भदौ | Bhadra | Aug to Sep |
| 6 असोज | Ashwin | Sep to Oct |
| 7 कार्तिक | Kartik | Oct to Nov |
| 8 मंसिर | Mangsir | Nov to Dec |
| 9 पौष | Poush | Dec to Jan |
| 10 माघ | Magh | Jan to Feb |
| 11 फागुन | Falgun | Feb to Mar |
| 12 चैत्र | Chaitra | Mar to Apr |

BS is about 56 to 57 years ahead of AD.

## License

MIT. Data and code taken from other projects, and their licences, are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
