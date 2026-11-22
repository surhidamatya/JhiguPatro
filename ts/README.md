# jhigu-patro-utils-ts

Bikram Sambat (Nepali) calendar utilities for TypeScript and JavaScript: date conversion, formatting and
parsing, money in integer paisa, Nepal phone numbers, addresses, SMS templates and reminders, receipts,
headless pickers and inputs, and web components for them.

No runtime dependencies. Offline-first. ES modules, with types. Not published to npm yet: build it from this
repository (below).

```ts
import { initializeCalendar, InlineCalendarDataSource, convertADToBS } from 'jhigu-patro-utils-ts';
import data from 'jhigu-patro-utils-ts/nepali_calendar_data.json' with { type: 'json' };

initializeCalendar(new InlineCalendarDataSource(data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough));
convertADToBS(new Date(2025, 7, 26)); // { year: 2082, month: 5, day: 10 }
```

- [Build and test](#build-and-test)
- [What is in the package](#what-is-in-the-package)
- [Entry points](#entry-points)
- [Loading the calendar data](#loading-the-calendar-data)
- [Using it in Node, a browser or a framework](#using-it-in-node-a-browser-or-a-framework)
- [Examples](#examples)
- [Accuracy and limits](#accuracy-and-limits)

## Build and test

```bash
cd ts
npm ci
npm run build       # tsc, output in dist/
npm run test:run    # vitest, once (npm test watches)
```

The test suite also runs the JavaScript samples in the feature guides and checks their links. The tests read the
shared vectors in `../testdata/` and the data in `../data/`.

## What is in the package

| Area | Main exports | Guide |
|---|---|---|
| Calendar data | `initializeCalendar`, `InlineCalendarDataSource`, `JsonCalendarDataSource`, `getDateAccuracy` | [calendar-data](../docs/features/calendar-data/README.md) |
| Dates | `NepaliDate`, `convertADToBS`, `convertBSToAD`, `formatDate`, `formatPreset`, `parseNepaliDate`, `fiscalYear`, `getMonthGrid` | [dates](../docs/features/dates/README.md) |
| Tithi | `PanchangDataSource` | [tithi](../docs/features/tithi/README.md) |
| Money | `Npr`, `groupLakh`, `vatExclusive`, `vatInclusive`, `numberToWords`, `amountInWords`, `MoneyError` | [money](../docs/features/money/README.md) |
| Phone | `parsePhone`, `isValidPhone`, `PhoneError` | [phone](../docs/features/phone/README.md) |
| Address | `/address` entry point | [address](../docs/features/address/README.md) |
| Receipts | `/receipt` and `/receipt-html` entry points | [receipts](../docs/features/receipts/README.md) |
| SMS | `/sms` and `/sms-file-store` entry points | [sms](../docs/features/sms/README.md) |
| Headless widgets | `createDatePicker`, range, address, money and phone input state machines | [headless-widgets](../docs/features/headless-widgets/README.md) |
| Web components | `<jhigu-date-picker>` and five more, plus the binding tables used by the React and Vue wrappers | [web-components](../docs/features/web-components/README.md) |

Localised label strings (`getStrings`, `stringsEn`, `stringsNe`) are generated from `data/strings.en.json` and
`data/strings.ne.json`.

## Entry points

The root import (`jhigu-patro-utils-ts`) holds the calendar, dates, money, phone and strings. Modules that not
everyone needs are separate entry points, so a bundler only includes what you import:

| Import | Holds |
|---|---|
| `jhigu-patro-utils-ts` | Calendar engine, dates, formatting, parsing, fiscal year, month grid, money, phone, `PanchangDataSource`, strings |
| `jhigu-patro-utils-ts/address` | Address data, lookup, search and formatting |
| `jhigu-patro-utils-ts/address-picker` | Address cascade state machine |
| `jhigu-patro-utils-ts/date-picker` | Date picker state machine |
| `jhigu-patro-utils-ts/range-picker` | Range picker state machine |
| `jhigu-patro-utils-ts/money-input` | Money input state machine |
| `jhigu-patro-utils-ts/phone-input` | Phone input state machine |
| `jhigu-patro-utils-ts/receipt` | Receipt model, totals and validation |
| `jhigu-patro-utils-ts/receipt-html` | Receipt HTML template |
| `jhigu-patro-utils-ts/sms` | SMS gateway interface, templates, segment counter, scheduler |
| `jhigu-patro-utils-ts/sms-file-store` | File-backed SMS store (Node) |
| `jhigu-patro-utils-ts/date-picker-element` | `<jhigu-date-picker>` |
| `jhigu-patro-utils-ts/range-picker-element` | `<jhigu-date-range-picker>` |
| `jhigu-patro-utils-ts/calendar-element` | `<jhigu-calendar>` |
| `jhigu-patro-utils-ts/address-element` | `<jhigu-address-select>` |
| `jhigu-patro-utils-ts/field-elements` | `<jhigu-money-input>` and `<jhigu-phone-input>` |
| `jhigu-patro-utils-ts/element-binding` | Framework-neutral binding core (used by React and Vue) |
| `jhigu-patro-utils-ts/element-bindings` | Prop tables for each element |
| `jhigu-patro-utils-ts/nepali_calendar_data.json` | The calendar data (BS 2000 to 2100) |
| `jhigu-patro-utils-ts/2081_tithi.json`, `/2082_tithi.json` | Tithi data |

In a TypeScript project that imports JSON, turn on `resolveJsonModule`.

## Loading the calendar data

Anything that converts or validates dates needs the calendar data loaded once at start-up. Money, phone and SMS
templates do not.

- **Node and servers:** `InlineCalendarDataSource` with the parsed JSON (shown at the top of this page).
- **Browsers:** serve `nepali_calendar_data.json` as a static file and use `JsonCalendarDataSource`, which uses
  `fetch`.
- **Next.js and Nuxt:** import the JSON and initialise at module level, so the same code runs on the server and
  in the browser.

All three are shown in the [calendar-data guide](../docs/features/calendar-data/README.md).

## Using it in Node, a browser or a framework

- **Node** (ES modules; CI runs Node 20 and 22, and no minimum is declared in `package.json`). Import by package name.
- **Browser:** the web components are plain custom elements with shadow DOM. Define them after the page loads,
  after the calendar data is loaded. See the [web-components guide](../docs/features/web-components/README.md).
- **React and Vue:** thin wrappers over the same elements: [react](../react/README.md), [vue](../vue/README.md).
- **Server rendering:** the elements are client-only. Server HTML contains an empty wrapper, and the field
  appears on hydration. This is checked in Next.js and Nuxt (`tools/ssr-check`).

## Examples

Working pages for each element are in `examples/`. Build first, then serve this directory over HTTP:

```bash
npm run build
npx serve .          # then open /examples/date-picker.html, calendar.html, inputs.html, ...
```

`index.html` is the older calendar demo.

## Accuracy and limits

- The calendar data covers BS 2000 to 2100. Years after `verifiedThrough` (2083) are not verified against an
  official calendar; `getDateAccuracy` tells you which a date is.
- Dates are calendar fields only. No time zone enters a conversion.
- Money is integer paisa. The largest amount is 2^53 - 1 paisa.
- Tithi data exists for BS 2081 and 2082 only.
- The web components were checked in Chromium only. Firefox, Safari, touch devices and real screen readers are
  not verified.

The full list of known gaps is in the [repository README](../README.md#known-gaps).
