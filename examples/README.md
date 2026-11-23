# Examples and integration guide

Runnable examples of the Jhigu Patro Kit, and a step-by-step guide for adding it to your own project.

The packages are **not published yet**, so every example installs them from this repository. Step 1 of the
guide shows the two ways to do that.

- [The examples](#the-examples)
- [Step by step: add the library to your project](#step-by-step-add-the-library-to-your-project)
  - [Step 1. Get the packages](#step-1-get-the-packages)
  - [Step 2. Load the calendar data](#step-2-load-the-calendar-data)
  - [Step 3. Pick your path](#step-3-pick-your-path)
  - [Step 4. Check it works](#step-4-check-it-works)
- [Paths](#paths)
  - [A. Node script or backend](#a-node-script-or-backend)
  - [B. A plain web page (Vite)](#b-a-plain-web-page-vite)
  - [C. React](#c-react)
  - [D. Vue 3](#d-vue-3)
  - [E. Next.js](#e-nextjs)
  - [F. Nuxt](#f-nuxt)
  - [G. Dart](#g-dart)
  - [H. Flutter](#h-flutter)
  - [I. Command line](#i-command-line)
- [Troubleshooting](#troubleshooting)

## The examples

| Example | What it shows | Run it |
|---|---|---|
| [`node-script/`](node-script/README.md) | Plain Node: dates, money, phone, address, SMS template, receipt, tithi | `cd examples/node-script && npm install && npm start` |
| [`web-vite/`](web-vite/README.md) | A Vite page with the web components: date picker, money, phone, address, a calendar with tithi, a form that posts BS values | `cd examples/web-vite && npm install && npm run dev` |
| [`dart-console/`](dart-console/README.md) | Plain Dart: the same features as the Node script | `cd examples/dart-console && dart pub get && dart run bin/main.dart` |

Examples that already live next to their packages:

| Example | What it shows |
|---|---|
| [`react/example/`](../react/example) | React 19 and Vite: all six components, language switch, parent-driven values, theming |
| [`react/example-next/`](../react/example-next) | Next.js (App Router): server rendering and hydration |
| [`vue/example/`](../vue/example) | Vue 3 and Vite: all six components |
| [`vue/example-nuxt/`](../vue/example-nuxt) | Nuxt: server rendering and hydration |
| [`flutter/example/`](../flutter/example) | Flutter app using the widgets |
| [`ts/examples/`](../ts/examples) | One HTML page per web component, no framework |

Before running anything, build the TypeScript library once (the examples use its `dist/` folder):

```bash
cd ts && npm ci && npm run build
```

## Step by step: add the library to your project

### Step 1. Get the packages

Pick one way. Both were checked: the examples use the first, and the second was run in an empty project.

**Way 1: a path dependency (best while you develop next to this repository).**
In your project's `package.json`:

```json
{
  "dependencies": {
    "jhigu-patro-utils-ts": "file:../JhiguPatro/ts"
  }
}
```

Then `npm install`. npm links the folder, so a rebuild of `ts/` is seen by your project. In `pubspec.yaml` (Dart
and Flutter) use a path dependency in the same way:

```yaml
dependencies:
  jhigu_patro_utils:
    path: ../JhiguPatro/dart
```

**Way 2: a tarball (best for a CI build or a project that lives anywhere).**

```bash
cd JhiguPatro/ts && npm ci && npm run build
npm pack                                   # makes jhigu-patro-utils-ts-1.0.0.tgz
cd /path/to/your-project
npm install /path/to/JhiguPatro/ts/jhigu-patro-utils-ts-1.0.0.tgz
```

The React and Vue packages work the same way (`react/` and `vue/`: build, then `npm pack`). They need
`jhigu-patro-utils-ts` installed next to them, because it is a peer dependency: the app and the elements must
share one copy of the calendar state. `node tools/pack-check/check.mjs` packs all three and imports them from a
scratch project, which is a way to check the tarballs before you use them.

When the packages are published, this step becomes `npm install jhigu-patro-utils-ts` (and `pub add`).

### Step 2. Load the calendar data

Dates (conversion, validation, the date picker, the calendar) need the calendar data loaded **once, before first
use**. Money, phone, address and SMS templates do not.

The data file ships with the package. Load it the way your environment allows:

```js
// Node (ES module): resolve the file through the package.
import { createRequire } from 'node:module';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';

const data = createRequire(import.meta.url)('jhigu-patro-utils-ts/nepali_calendar_data.json');
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));
```

```js
// A bundler (Vite, webpack, Next, Nuxt): import the JSON; it is bundled, so the same code runs on the
// server and in the browser.
import data from 'jhigu-patro-utils-ts/nepali_calendar_data.json';
```

Always pass `data.verifiedThrough`. Without it every year is reported as unverified. Other ways to load
(`fetch` in a browser, Flutter assets) are in the [calendar-data guide](../docs/features/calendar-data/README.md).

### Step 3. Pick your path

| You are building | Go to |
|---|---|
| A script, API or backend job in Node | [A](#a-node-script-or-backend) |
| A web page with no framework | [B](#b-a-plain-web-page-vite) |
| A React app | [C](#c-react) |
| A Vue 3 app | [D](#d-vue-3) |
| A Next.js app | [E](#e-nextjs) |
| A Nuxt app | [F](#f-nuxt) |
| A Dart program or server | [G](#g-dart) |
| A Flutter app | [H](#h-flutter) |
| Quick conversions in a terminal | [I](#i-command-line) |

### Step 4. Check it works

After setup, check these four things. They catch almost every integration mistake:

1. **Conversion:** `convertADToBS(new Date(2025, 7, 26))` gives `{ year: 2082, month: 5, day: 10 }`.
2. **Money:** `Npr.fromRupees(1234567.5).format({ symbol: 'Rs.' })` gives `Rs. 12,34,567.50`.
3. **A field (web):** the date picker shows a month grid, and submitting the form posts `YYYY-MM-DD`.
4. **No console errors** when the page loads. A message about the calendar not being initialised means Step 2
   ran too late.

## Paths

### A. Node script or backend

Working code: [`node-script/index.mjs`](node-script/index.mjs).

1. Create the project and install the library (Step 1):
   ```bash
   mkdir my-app && cd my-app && npm init -y
   npm pkg set type=module
   npm install /path/to/JhiguPatro/ts      # or the tarball
   ```
2. Load the calendar data (Step 2) at the top of your entry file.
3. Import only what you use. Subpath imports keep the code you load small:
   ```js
   import { convertADToBS, Npr, parsePhone } from 'jhigu-patro-utils-ts';
   import { formatAddress } from 'jhigu-patro-utils-ts/address';
   import { renderSmsTemplate } from 'jhigu-patro-utils-ts/sms';
   import { computeTotals } from 'jhigu-patro-utils-ts/receipt';
   ```
4. Keep money in integer paisa (`Npr.fromRupees(…)`, `.paisa`). Store the paisa value, not a float, in your
   database. Dates are plain calendar fields: store BS dates as `YYYY-MM-DD` text, and do not add a time zone.
5. Catch the typed errors (`PhoneError`, `MoneyError`, `JhiguError`, `AddressError`, `ReceiptError`). Each has a
   stable `code` and a message in English or Nepali (`err.localized('ne')`).
6. Sending SMS needs your own provider: pass a `CallbackSmsGateway` (see the [SMS guide](../docs/features/sms/README.md)).

### B. A plain web page (Vite)

Working code: [`web-vite/`](web-vite/README.md).

1. Create a Vite project and install the library:
   ```bash
   npm create vite@latest my-site -- --template vanilla
   cd my-site && npm install /path/to/JhiguPatro/ts
   ```
2. In your entry file, load the calendar data **first** (Step 2), then register the elements you use:
   ```js
   import { defineJhiguDatePicker } from 'jhigu-patro-utils-ts/date-picker-element';
   import { defineJhiguMoneyInput, defineJhiguPhoneInput } from 'jhigu-patro-utils-ts/field-elements';
   defineJhiguDatePicker();
   defineJhiguMoneyInput();
   defineJhiguPhoneInput();
   ```
3. Use the tags in your HTML. `name` puts the value in the form:
   ```html
   <form id="f">
     <jhigu-date-picker name="visit" popup required></jhigu-date-picker>
     <jhigu-money-input name="amount" symbol="Rs."></jhigu-money-input>
     <jhigu-phone-input name="phone"></jhigu-phone-input>
     <button>Send</button>
   </form>
   ```
4. Read the form with `new FormData(form)`. The date is `YYYY-MM-DD` (BS), money is integer paisa, the phone is
   E.164 (`+977...`).
5. Optional: set `language="ne"`, theme with CSS variables **on the element** (`jhigu-calendar { --jhigu-color-primary: #b91c1c; }`),
   and listen for events (`jhiguChange`, `jhiguSelect`). Everything is listed in the
   [web-components guide](../docs/features/web-components/README.md).
6. Tithi: set the calendar's `panchang` property (see `web-vite/src/main.js`).

### C. React

Working code: [`react/example/`](../react/example). Full reference: the [React guide](../docs/features/react/README.md) and [`react/README.md`](../react/README.md).

1. Install the library, the wrapper and React (Step 1). The utils package is a peer dependency of the wrapper:
   ```bash
   npm install /path/to/JhiguPatro/ts /path/to/JhiguPatro/react react react-dom
   ```
   Build the wrapper first (`cd react && npm ci && npm run build`), or install its tarball (`npm pack`).
2. Load the calendar data once at start-up (Step 2), before the first render.
3. Use the components. They are controlled by props, and the first argument of each callback is the event detail:
   ```jsx
   import { JhiguDatePicker, JhiguMoneyInput } from 'jhigu-patro-react';

   function Form() {
     const [dob, setDob] = useState('2082-05-12');
     return (
       <form>
         <JhiguDatePicker name="dob" language="ne" value={dob} required onChange={d => setDob(d.bs)} />
         <JhiguMoneyInput name="amount" symbol="Rs." onChange={d => console.log(d.paisa)} />
       </form>
     );
   }
   ```
4. Pass **stable objects** for object props (the calendar's `events` and `panchang`): state, a constant or
   `useMemo`. A new object on every render rewrites the element.
5. React 18 and 19 are supported. StrictMode is fine.

### D. Vue 3

Working code: [`vue/example/`](../vue/example). Full reference: the [Vue guide](../docs/features/vue/README.md) and [`vue/README.md`](../vue/README.md).

1. Install the library, the wrapper and Vue (Step 1):
   ```bash
   npm install /path/to/JhiguPatro/ts /path/to/JhiguPatro/vue vue
   ```
   Build the wrapper first (`cd vue && npm ci && npm run build`), or install its tarball (`npm pack`).
2. Load the calendar data in `main.js` **before** `createApp(...).mount(...)` (Step 2).
3. Use the components. Events are Vue events (`@change`, `@select`, `@month-change`):
   ```vue
   <script setup>
   import { ref } from 'vue';
   import { JhiguDatePicker } from 'jhigu-patro-vue';
   const dob = ref('2082-05-12');
   </script>

   <template>
     <JhiguDatePicker name="dob" language="ne" :value="dob" required @change="d => (dob = d.bs)" />
   </template>
   ```
4. Vue 3.3, 3.4 and 3.5 are covered by tests.

### E. Next.js

Working code: [`react/example-next/`](../react/example-next).

1. Install as in [C](#c-react).
2. Put every component in a file that starts with `'use client'`. The elements exist only in the browser; the
   server renders an empty wrapper, and the field appears on hydration.
3. Import the calendar JSON and initialise at module level in that client file, so the code runs on the server
   and in the browser:
   ```tsx
   'use client';
   import cal from 'jhigu-patro-utils-ts/nepali_calendar_data.json';
   initializeCalendar(new InlineCalendarDataSource(
     cal.years as unknown as Record<string, number[]>, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
   ));
   ```
4. With a linked (path) install in a monorepo, set `turbopack.root` to the repository root in `next.config.mjs`
   (see the example). That setup was checked only with linked installs.
5. Check with `next build`: the prerendered HTML has empty wrappers and no `<jhigu-*>` element. `tools/ssr-check`
   automates this check.

### F. Nuxt

Working code: [`vue/example-nuxt/`](../vue/example-nuxt).

1. Install as in [D](#d-vue-3).
2. Import the calendar JSON and initialise it at the top of a component's `<script setup>` or in a plugin, so it
   runs on the server and in the browser (see `app/app.vue` in the example).
3. Use the components in templates. As in Next, the server renders an empty wrapper, and the field appears on
   hydration.
4. Check with `nuxt build` and `node .output/server/index.mjs`, or run `tools/ssr-check`.

### G. Dart

Working code: [`dart-console/bin/main.dart`](dart-console/bin/main.dart).

1. Add the path dependency (Step 1) and run `dart pub get`.
2. Read `nepali_calendar_data.json` yourself (from a file or an asset) and initialise (the data is in `data/`,
   copy it into your project):
   ```dart
   NepaliCalendar.initialize(InlineCalendarDataSource(
     years: (data['years'] as Map<String, dynamic>)
         .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
     supportedStartYear: (data['supportedRange'] as Map)['start'] as int,
     supportedEndYear: (data['supportedRange'] as Map)['end'] as int,
     verifiedThrough: data['verifiedThrough'] as int,
   ));
   ```
3. Import `package:jhigu_patro_utils/jhigu_patro_utils.dart`. The API matches the TypeScript one. Where a
   language difference exists (for example `NepaliDate.toIsoString()` instead of `toString()`), the
   [feature guides](../docs/features/dates/README.md) say so.
4. The receipt PDF and the SMS file store are separate imports (`receipt_pdf.dart`, `sms_file_store.dart`) so a
   program that does not use them does not load the `pdf` package.

### H. Flutter

Working code: [`flutter/example/`](../flutter/example) (see its [README](../flutter/example/README.md)). Full
reference: the [Flutter guide](../docs/features/flutter/README.md) and [`flutter/README.md`](../flutter/README.md).

1. Add both packages as path dependencies in `pubspec.yaml`. Your code imports `jhigu_patro_utils` for
   `NepaliDate`, `Npr` and `NepaliCalendar`, so it needs its own line:
   ```yaml
   dependencies:
     flutter:
       sdk: flutter
     jhigu_patro_flutter:
       path: ../JhiguPatro/flutter
     jhigu_patro_utils:
       path: ../JhiguPatro/dart
   ```
2. Copy `data/nepali_calendar_data.json` into your app (for example `assets/`) and declare it. Copy the file;
   the example only symlinks it:
   ```yaml
   flutter:
     assets:
       - assets/nepali_calendar_data.json
   ```
3. Read it and initialise **before `runApp`**. This is the same code the example uses:
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
   Skipping this makes the first widget throw a `StateError` ("calendar not initialized").
4. Use the widgets:
   ```dart
   JhiguDatePicker(value: _date, language: 'ne', onChanged: (d) => setState(() => _date = d))
   JhiguMoneyField(onChanged: (Npr? amount) => setState(() => _amount = amount))   // an Npr, in paisa
   JhiguPhoneField(onChanged: (String? e164) => setState(() => _phone = e164))      // E.164 when valid, else null
   ```
   The fields are plain `TextField`s, not `FormField`s: `Form.validate()` does not check them, so read their
   values when the user submits.
5. Pop-up pickers: `showJhiguDatePicker(context: ...)` and `showJhiguDateRangePicker(...)` return the chosen
   date (or range), or null when dismissed.
6. Style with a `JhiguTheme` in `ThemeData.extensions`; anything left unset falls back to your `ColorScheme`.
7. Verified so far: `flutter analyze` and `flutter test` in `flutter/`, and a web build of the example. Not
   verified: running on a phone, desktop, or in a browser by hand, touch, and screen readers.

### I. Command line

1. Build the library and the CLI, then install it globally:
   ```bash
   cd ts && npm ci && npm run build
   cd ../cli && npm ci && npm run build && npm install -g .
   ```
2. Try it: `jhigu-patro ad2bs 2025-08-26`, `jhigu-patro money 1234567.5 --vat excl --words`,
   `jhigu-patro phone 9841234567 --json`. Every command is in the [CLI README](../cli/README.md).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `calendar not initialized. Call initializeCalendar() first.` | A date function ran before Step 2. Initialise at start-up, before the first render or request. |
| The tags show nothing | The element was not registered. Call its `defineJhigu...()` function (Step B2), after the page's modules load. In React, Vue, Next and Nuxt the wrappers do this for you. |
| The date picker or calendar shows an error message instead of a grid | The calendar data was probably not loaded before the element was created. Load it first. |
| `customElements is not available` | A `defineJhigu...()` call ran on the server. Call it only in the browser (in a `'use client'` file or after mount). |
| Every date says "unverified" | `verifiedThrough` was not passed to `InlineCalendarDataSource`. Pass `data.verifiedThrough`. |
| A CSS variable has no effect | Set it on the element itself (`jhigu-calendar { --jhigu-color-primary: … }`), not on `:root`. |
| Vite serves an old copy of the library (stale React, old elements) | Delete `node_modules/.vite` and restart the dev server. |
| Next.js cannot find the library's files | With a linked install, set `turbopack.root` to the repository root (see `react/example-next/next.config.mjs`). |
| `ref.current.open is not a function` | The popup pickers have `show()` and `hide()`, not `open()`. |
| Changing a parent's state resets a field | You passed a new object each render to an object prop (`events`, `panchang`). Keep it stable. |
| An AD date is a day off when you print it | In TypeScript `toAD()` returns local midnight, and `toISOString()` converts to UTC, which can move the date. Read `getFullYear()`, `getMonth()` and `getDate()` instead, or use `formatAd`. In Dart `toAD()` is UTC midnight. |

More detail for each feature is in the [feature guides](../docs/features/calendar-data/README.md).
