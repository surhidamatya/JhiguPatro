# Jhigu Patro Kit — Implementation Guide

**Companion to:** `PRD.md` (Draft v2)
**Purpose:** Explain how to build every feature in the PRD. Each section uses the same feature IDs as the PRD (D-1, M-7, U-5 and so on).

---

## 0. How to use this guide

- Build in the order of section 17. Do not skip phase 0 and phase 1.
- Every feature has: what to build, how to build it, and how to test it.
- Code here shows the shape of the solution. It is not final code.
- Some facts must come from outside sources. This guide marks them **[SOURCE NEEDED]**. Do not guess these. Examples: real calendar month lengths, the Sandesh API, the phone prefix list.
- Anything marked **[DECISION]** needs your call before you code.

## 1. Rules for the whole project

1. **Data lives in one place.** The JSON data package is the only source. Dart and TypeScript files are generated from it.
2. **Same input, same output.** Both languages must pass the same test vectors.
3. **Core code has no UI and no network.** Only the SMS gateway uses the network, and only when the developer sets it up.
4. **Money is always an integer.** Never use floating point for rupees.
5. **Dates ignore time zones.** Convert using year, month and day numbers only.
6. **Every public function has a test and a doc comment.**
7. **Errors are typed.** Never throw a bare string.
8. **Nepali and English everywhere.** No hard-coded labels in code. Labels come from the string tables.

## 2. Repository layout

One monorepo. Dart packages and JS packages sit side by side.

```
jhigu-patro-kit/
├─ data/                      # source of truth (JSON)
│  ├─ calendar.json
│  ├─ address.json
│  ├─ phone-prefixes.json
│  ├─ strings.ne.json
│  ├─ strings.en.json
│  ├─ nepali-numbers.json     # words for 0–99, scales
│  └─ schema/                 # JSON Schemas
├─ testdata/                  # shared test vectors (read by Dart and JS tests)
│  ├─ dates.json
│  ├─ money.json
│  ├─ phone.json
│  ├─ address.json
│  └─ receipt.json
├─ tools/
│  ├─ gen-data/               # reads data/, writes Dart and TS files
│  ├─ gen-address/            # builds address.json from upstream dataset
│  └─ check-calendar/         # compares calendar sources, builds the golden file
├─ packages/
│  ├─ dart/
│  │  ├─ jhigu_patro_kit/
│  │  └─ jhigu_patro_kit_flutter/
│  └─ js/
│     ├─ data/                # jhigu-patro-data
│     ├─ core/                # jhigu-patro-kit
│     ├─ headless/            # @jhigu-patro/headless
│     ├─ elements/            # @jhigu-patro/elements (Stencil)
│     ├─ react/               # @jhigu-patro/react (generated)
│     ├─ vue/                 # @jhigu-patro/vue (generated)
│     ├─ angular/             # @jhigu-patro/angular (generated)
│     ├─ svelte/              # @jhigu-patro/svelte (typings and helpers)
│     ├─ solid/               # @jhigu-patro/solid (typings and helpers)
│     └─ react-native/        # @jhigu-patro/react-native
├─ examples/
│  ├─ flutter_app/
│  ├─ react_app/ vue_app/ angular_app/ svelte_app/ solid_app/
│  ├─ react_native_app/
│  └─ plain_html/
├─ docs/                      # docs site
├─ .github/workflows/
├─ melos.yaml                 # Dart workspace
├─ pnpm-workspace.yaml        # JS workspace
├─ turbo.json
├─ CLAUDE.md
└─ AGENTS.md
```

### Tooling

| Need | Tool |
|------|------|
| JS workspace | pnpm and Turborepo |
| Dart workspace | Melos |
| JS build | tsup (core, headless). Stencil (elements and wrappers) |
| JS tests | Vitest (core, headless). Playwright (elements) |
| Dart tests | `dart test`. `flutter test` for widgets |
| Releases (JS) | Changesets with npm provenance |
| Releases (Dart) | GitHub Actions with pub.dev automated publishing |
| Docs | Astro Starlight or VitePress **[DECISION]** |

## 3. CI and release (X-5, X-6, X-9)

### 3.1 Pipelines

| Workflow | Runs on | Steps |
|----------|---------|-------|
| `ci-js` | Every pull request | install, lint, type-check, test, build, import check of built bundles |
| `ci-dart` | Every pull request | `dart analyze`, `dart format --set-exit-if-changed`, `dart test`, `flutter test` |
| `ci-data` | Every pull request touching `data/` | validate JSON against schemas, run calendar checks, run generators, fail if generated files changed |
| `ci-parity` | Every pull request | run all `testdata/` vectors in Dart and JS |
| `release-js` | Tag `js-v*` | Changesets publish to npm with provenance |
| `release-dart` | Tag `dart-v*` | publish to pub.dev |

### 3.2 Import check (X-5)

After building, load each bundle in plain Node and in a browser test. This catches broken `exports` maps.

```js
// scripts/import-check.mjs
const esm = await import('jhigu-patro-kit');
const cjs = require('jhigu-patro-kit');
if (!esm.adToBs || !cjs.adToBs) throw new Error('missing export');
```

### 3.3 Version policy (X-9)

- All packages share one major version.
- Data-only fixes bump the patch version of `jhigu-patro-data`. Core packages pick them up on the next release.
- Use `exports` maps in `package.json` for ESM and CJS, plus `types`.
- Set `"sideEffects": false` so bundlers can tree-shake (X-3).

## 4. Phase 0: setup

1. Create the `@jhigu-patro` org on npm. Reserve `jhigu-patro-kit` and `jhigu-patro-data`.
2. Reserve `jhigu_patro_kit`, `jhigu_patro_kit_flutter` and `jhigu_patro_data` on pub.dev with a first empty release.
3. Create the repo and the layout above.
4. Add CI that passes on empty packages.
5. Add licence files. Copy the MIT notices from both source repos into `THIRD_PARTY_NOTICES.md`.
6. **[DECISION]** Merge source repos with history or start fresh with credit. See PRD open questions.

## 5. Data package (C-1, C-2, C-3, L-2, P-7, A-1)

### 5.1 Calendar file format (C-1)

```json
{
  "schemaVersion": 1,
  "rangeStart": 1970,
  "rangeEnd": 2100,
  "verifiedThrough": 2086,
  "years": {
    "1970": { "months": [30,31,32,31,31,31,30,29,30,29,30,30], "adStart": "1913-04-13" }
  }
}
```

- The 1970 row above shows the shape only. **[SOURCE NEEDED]** for real month lengths. They come from the merge work in section 6.
- `adStart` is the AD date of Baisakh 1 of that BS year.
- Confirm the anchor dates in the golden file. Example to check: BS 2000-01-01 should map to AD 1943-04-14.

### 5.2 Validation (C-2)

Write one validator in TypeScript. Dart reuses the same rules through the generated tests.

Rules:

- `years` has every year from `rangeStart` to `rangeEnd` with no gaps.
- Each year has exactly 12 months.
- Each month length is between 29 and 32.
- Each `adStart` is a real date.
- For every year N: `adStart(N)` + sum(`months(N)`) equals `adStart(N+1)`.
- `verifiedThrough` is inside the range.

```ts
export function validateCalendar(data: CalendarData): void {
  for (let y = data.rangeStart; y <= data.rangeEnd; y++) {
    const row = data.years[y];
    if (!row) throw err('INVALID_DATA', `missing year ${y}`);
    if (row.months.length !== 12) throw err('INVALID_DATA', `year ${y}: need 12 months`);
    row.months.forEach((m, i) => {
      if (m < 29 || m > 32) throw err('INVALID_DATA', `year ${y} month ${i + 1}: ${m}`);
    });
    if (y < data.rangeEnd) {
      const total = row.months.reduce((a, b) => a + b, 0);
      const next = addDays(row.adStart, total);
      if (next !== data.years[y + 1].adStart)
        throw err('INVALID_DATA', `year ${y}: AD start chain breaks`);
    }
  }
}
```

### 5.3 JSON Schema (C-3)

Write `data/schema/calendar.schema.json` from the shape above. Publish it in the data package. Use it in CI and in the runtime loader.

### 5.4 Generators

`tools/gen-data` reads `data/*.json` and writes:

- **TypeScript:** `packages/js/core/src/generated/*.ts`, each exporting typed `as const` objects.
- **Dart:** `packages/dart/jhigu_patro_kit/lib/src/generated/*.dart`, each with const lists and maps.

Rules:

- Generated files start with a "do not edit" header.
- CI regenerates and fails if the output differs from what is committed.
- Address data is large. In JS it is generated as a separate file and loaded on demand (section 11).

### 5.5 Strings (L-1, L-2)

`strings.en.json` and `strings.ne.json` use the same keys.

```json
{
  "months": ["Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"],
  "weekdays": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
  "weekdaysShort": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
  "picker": { "today": "Today", "clear": "Clear", "selectYear": "Select year", "selectMonth": "Select month" },
  "phone": { "tooShort": "...", "tooLong": "...", "badPrefix": "..." },
  "receipt": { "invoice": "...", "receipt": "...", "subtotal": "...", "vat": "...", "total": "...", "paid": "...", "balance": "..." }
}
```

- CI check: both files have identical key sets. A missing key fails the build.
- Write the Nepali values with a native speaker review.

### 5.6 Phone prefixes (P-7)

```json
{
  "mobile": [
    { "prefix": "984", "carrier": "NTC", "active": true }
  ],
  "landlineAreaCodes": [
    { "code": "1", "region": "Kathmandu Valley" }
  ]
}
```

The rows above show the shape only. **[SOURCE NEEDED]** for the real list. Use NTA published data where possible. Mark the file as best effort.

## 6. Calendar reconciliation (C-7, C-8, C-9)

This is the first real engineering task. Do it before writing any date code.

### 6.1 Build the comparison

`tools/check-calendar`:

1. Load the month-length table from nepal-kit.
2. Load the table from nepal-date-kit.
3. Load tables from two more libraries as extra references (for example `nepali-date-converter` and `nepali_utils`).
4. Write `testdata/calendar-golden.json` with one row per BS year and one column per source.
5. Print every year where any two sources differ.

### 6.2 Resolve

For each differing year:

1. Check the official Nepal Panchang Nirnayak Samiti calendar.
2. Write the chosen lengths in `data/calendar.json`.
3. Write the reason and the evidence link in `data/CALENDAR_NOTES.md`.

### 6.3 Set `verifiedThrough`

Set it to the last year that matches the official source with no disagreement. Years after it stay in the table but trigger a warning (C-5).

### 6.4 Tests

- **Round trip (C-9):** for every day from BS 1970-01-01 to the last day in range, convert AD to BS and back. The result must match.
- **Year length (C-8):** keep a separate table of total days per year from an independent source. Compare it with the sum of months.
- **Chain (C-2):** already covered by the validator.

```ts
test('round trip every day', () => {
  let d = parseAd(range.adStart);
  const end = parseAd(range.adEnd);
  while (d <= end) {
    const bs = adToBs(d);
    expect(bsToAd(bs.year, bs.month, bs.day)).toEqualDate(d);
    d = addDay(d);
  }
});
```

## 7. Dates (D-1 to D-19)

Write the JS version first. It already exists in nepal-date-kit. Then port it to Dart. Or write Dart first from nepal-kit and port to JS. Pick one source as the lead per feature to avoid drift.

### 7.1 Core data structures

Build these lookup arrays once at start-up from the calendar data:

- `yearStartDay[y]`: day number of Baisakh 1 of year `y`.
- `monthStartOffset[y][m]`: days from year start to the start of month `m` (running totals).
- `daysInMonth[y][m]`.

A **day number** is the count of whole days since 1970-01-01 UTC. It comes from calendar fields only.

```ts
const MS_PER_DAY = 86_400_000;
export const dayNumber = (y: number, m: number, d: number) =>
  Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
```

```dart
int dayNumber(int y, int m, int d) =>
    DateTime.utc(y, m, d).millisecondsSinceEpoch ~/ 86400000;
```

### 7.2 Conversion (D-1, D-2, D-3, D-4)

**AD to BS**

1. Read the year, month, day fields of the input. Do not use the time value.
2. Compute the day number `n`.
3. If `n` is before the first `yearStartDay` or after the last year end, throw `OUT_OF_RANGE`.
4. Binary search `yearStartDay` to find the BS year.
5. Find the month by scanning `monthStartOffset` for that year.
6. Day = `n - yearStartDay[y] - monthStartOffset[y][m] + 1`.

**BS to AD**

1. Validate year, month, day (D-3).
2. `n = yearStartDay[y] + monthStartOffset[y][m] + (d - 1)`.
3. Build the date from `n * MS_PER_DAY` in UTC.

**Return time (D-4)**

- Dart returns UTC midnight.
- JS returns local midnight built from `new Date(year, month, day)`. This matches what apps expect when they display the date.
- Document this in the README.

### 7.3 Today in Nepal (D-5)

Nepal is UTC+05:45. Do not use the device time zone.

```ts
export function today(): NepaliDate {
  const now = Date.now() + (5 * 60 + 45) * 60_000;
  const d = new Date(now);
  return adToBs(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
```

Add an optional clock parameter in tests so tests do not depend on the real time.

### 7.4 NepaliDate (D-6, D-7, D-8)

An immutable value class with `year`, `month`, `day`.

| Method | How |
|--------|-----|
| `addDays(n)` | Convert to day number, add, convert back |
| `addMonths(n)` | `total = year*12 + (month-1) + n`. New year is `total ~/ 12`. New month is `total % 12 + 1`. New day is `min(day, daysInMonth(newYear, newMonth))` |
| `addYears(n)` | `addMonths(n * 12)` |
| `diff(other, unit)` | Days: difference of day numbers. Months: whole months between, step back one if the day of the later date is smaller. Years: months divided by 12, same rule |
| `compare`, `isBefore`, `isAfter`, `isSame` | Compare as `(year, month, day)` tuples |
| `startOfMonth`, `endOfMonth` | Day 1 and `daysInMonth` |
| `daysInMonth` | Lookup |
| `isValid(y, m, d)` | In range, month 1 to 12, day 1 to `daysInMonth` |
| `weekday` | `(dayNumber + 4) % 7`, with Sunday as 0. Check: 1970-01-01 was a Thursday, so day 0 gives 4 |

Add `==` and `hashCode` in Dart, and `valueOf` and `toJSON` in JS.

### 7.5 Formatting (D-9, D-10, D-11, D-12, D-18)

**Digit helpers (D-18)**

```ts
const NE = '०१२३४५६७८९';
export const toNepaliDigits = (s: string | number) =>
  String(s).replace(/\d/g, d => NE[+d]);
export const toEnglishDigits = (s: string) =>
  s.replace(/[०-९]/g, c => String(NE.indexOf(c)));
```

**Token formatter (D-10)**

Use one regex. Order matters. Longer tokens go first. Bracketed text is literal.

```ts
const TOKEN = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D/g;
```

| Token | Output |
|-------|--------|
| `YYYY` `YY` | Year, four or two digits |
| `MMMM` `MMM` | Month name, full or short |
| `MM` `M` | Month number, padded or not |
| `DD` `D` | Day, padded or not |
| `dddd` `ddd` | Weekday, full or short |
| `[text]` | Literal text |

Rules:

- Look up names from the string tables (L-1).
- In Nepali, convert all digits to Devanagari. Exception: presets that must stay ASCII (see below).

**Presets (D-9)**

| Preset | Pattern | Digits in Nepali |
|--------|---------|------------------|
| `full` | `dddd, D MMMM YYYY` | Devanagari |
| `long` | `D MMMM YYYY` | Devanagari |
| `iso` | `YYYY-MM-DD` | ASCII always |
| `slash` | `YYYY/MM/DD` | ASCII always |
| `dmy` | `DD/MM/YYYY` | ASCII always |
| `short` | `D MMM YYYY` | Devanagari |
| `monthYear` | `MMMM YYYY` | Devanagari |
| `gate` | `YYYY साल MMMM D गते` | Devanagari |
| `dual` | BS date plus AD date, for example `... (AD ...)` | Devanagari for BS |
| `relative` | See below | Devanagari |
| `fiscal` | Fiscal year code | ASCII |

**Relative (D-9)**

- Compute diff in days against `today()`.
- 0 is "today". 1 is "yesterday" or "tomorrow". Up to 30 days uses days. Up to 12 months uses months. After that, years.
- Strings come from the table. Example in Nepali: `३ दिन अघि`.

**Format an AD date in Nepali (D-12, P1)**

Use the same month and weekday tables with an AD month list in Nepali. Add `formatAd(date, pattern, language)`.

### 7.6 Parsing (D-13, D-14)

Steps:

1. Convert Devanagari digits to ASCII.
2. Lowercase. Remove `वि.सं.`, `साल`, `गते`, `सम्वत्`, `BS`.
3. Remove a leading weekday name if present.
4. Replace `/`, `.`, `,` and `-` with a single space when the pattern is not ISO.
5. Split into tokens. Each token is a number or a month name.
6. Match patterns in this order:
   - `Y M D` where `Y` has four digits (ISO, slash, dot)
   - `D month Y` (month as a name)
   - `month D Y`
   - `D M Y` where the last token has four digits
7. Month names map from a table that includes Nepali names and English spellings. Include the common alternates: Asoj and Ashwin, Poush and Paush, Ashadh and Asar, Jestha and Jeth, Baisakh and Baishakh (D-14).
8. Check `isValid`. If it fails, throw `PARSE_ERROR` with the original text.

Test with at least 60 input strings covering every pattern and every alternate name.

### 7.7 Fiscal year (D-15)

```ts
export function fiscalYear(d: NepaliDate) {
  const start = d.month >= 4 ? d.year : d.year - 1;   // Shrawan = month 4
  const end = start + 1;
  return { start, end, code: `${start}/${String(end % 100).padStart(2, '0')}` };
}
```

Also return the first and last day of the fiscal year as `NepaliDate` values.

### 7.8 Month grid (D-16, D-17)

```ts
interface GridCell {
  bs: NepaliDate | null;
  ad: Date | null;
  inMonth: boolean;
  inRange: boolean;
  isToday: boolean;
  isWeekend: boolean;       // Saturday by default
  events: GridEvent[];
}
getMonthGrid(year, month, { weekStartsOn = 0, events, getEvents })
```

Steps:

1. Find the weekday of day 1.
2. Leading blanks = `(weekday - weekStartsOn + 7) % 7`.
3. Fill leading cells with days from the previous month if they are in range. Otherwise use out-of-range cells with `bs = null`.
4. Fill the month. Fill trailing cells to complete the last week.
5. For each cell, add the AD date (D-1), `isToday`, and events.
6. Events (D-17): accept a map `{ '2083-01-01': [...] }` or a callback `(date) => events`. Call the callback once per cell. Do not cache across calls.

Always return full weeks. A grid has 5 or 6 rows. Let the caller choose "always 6 rows" with an option.

### 7.9 Errors (D-19)

```ts
export class JhiguError extends Error {
  constructor(public code: 'OUT_OF_RANGE'|'INVALID_DATE'|'INVALID_DATA'|'PARSE_ERROR', message: string, public details?: unknown) { super(message); }
}
```

Dart: a sealed class hierarchy with the same four codes, plus a `code` getter.

### 7.10 Tests for dates

Use `testdata/dates.json`:

```json
{
  "adToBs": [ { "ad": "YYYY-MM-DD", "bs": "YYYY-MM-DD" } ],
  "bsToAd": [ ],
  "addMonths": [ { "from": "...", "n": 1, "to": "..." } ],
  "format": [ { "bs": "...", "preset": "full", "lang": "ne", "out": "..." } ],
  "parse": [ { "in": "...", "bs": "..." } ],
  "fiscal": [ ],
  "grid": [ ]
}
```

- Fill the vectors from the resolved golden calendar in section 6. **[SOURCE NEEDED]** Do not write vectors from memory.
- Include edge cases: first and last day of range, month ends, year ends, 32-day months, clamping on `addMonths`, and dates near midnight in different time zones.
- Run the date tests with `TZ` set to `Asia/Kathmandu`, `UTC`, `America/Los_Angeles` and `Pacific/Kiritimati` to prove no time-zone drift.

## 8. Calendar data loading and accuracy (C-4, C-5, C-6)

### 8.1 Runtime loader (C-4)

```ts
loadCalendarData(data: CalendarData, { mode = 'replace' }: { mode?: 'merge' | 'replace' } = {}): void
```

Steps:

1. Validate with the same validator (section 5.2).
2. In `merge` mode, overlay incoming years on the current table, then validate the combined table.
3. Build new lookup arrays in memory.
4. Swap the active tables in one step. If any earlier step fails, leave the current tables untouched.

Add `resetCalendarData()` to go back to the bundled data.

### 8.2 Accuracy (C-5, C-6)

```ts
isVerifiedYear(year): boolean            // year <= verifiedThrough
getDateAccuracy(date): { verified: boolean; warning?: string }
getCalendarMeta(): { rangeStart, rangeEnd, verifiedThrough, schemaVersion, source }
getCalendarData(): CalendarData          // a deep copy
```

- Do not throw on unverified years. Return a warning only.
- Strings for the warning come from the string table.

### 8.3 Dart parity

Dart needs the same API. Put the tables in a `CalendarRegistry` class with a static instance and a `load` method.

## 9. Money (M-1 to M-9)

### 9.1 Npr type (M-2)

- Store paisa as an integer.
- Dart: `int` (64-bit on the VM). On Dart web, integers are 53-bit. Add a guard that throws if the value is above 2^53 on web.
- JS: use `number` with a safe-integer guard. **[DECISION]** Use `bigint` instead if you need amounts above about 90 trillion rupees.
- Constructors: `Npr.fromRupees(1250.5)` rounds once to paisa. `Npr.fromPaisa(125050)`. `Npr.parse(text)`.

### 9.2 Lakh grouping (M-1)

```ts
function groupLakh(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return parts.join(',') + ',' + last3;     // 12345678 -> 1,23,45,678
}
```

### 9.3 Format and parse (M-3, M-4)

- `format({ symbol: 'Rs.' | 'रु' | none, devanagari: bool, decimals: 'auto'|'always'|'never' })`.
- Always keep two paisa digits when `decimals` is `always`.
- Negative: put the minus sign before the symbol.
- `parse` steps: convert Devanagari digits, strip symbols (`Rs.`, `Rs`, `NPR`, `रु`, `रू`), remove commas and spaces, then match `^-?\d+(\.\d{1,2})?$`. Anything else is a typed parse error.

### 9.4 Arithmetic (M-5, M-6)

**Percent**

Use basis points as an integer (13% is 1300).

```ts
// round half away from zero, integer maths only
percent(bp: number): Npr {
  const n = this.paisa * bp;                   // check for overflow
  const q = Math.trunc(n / 10000);
  const r = n % 10000;
  const adj = Math.abs(r) * 2 >= 10000 ? Math.sign(n) : 0;
  return Npr.fromPaisa(q + adj);
}
```

**Times**

- `times(int)` is exact.
- `timesDecimal("1.5")` parses the decimal string into a numerator and a denominator, multiplies, and rounds the same way. Do not accept a floating-point number.

**Allocate and split (M-6)**

Use the largest remainder method.

1. `total = this.paisa`, `sum = sum(ratios)`.
2. For each ratio, `share = floor(total * ratio / sum)` and keep the remainder.
3. Distribute the leftover paisa one by one to the largest remainders. Break ties by lower index.
4. The shares always add up to `total`.

`split(n)` is `allocate([1,1,...,1])`.

Test with random inputs: for 10,000 random totals and ratio sets, the sum must always equal the total.

### 9.5 Amount in words (M-7, M-8)

Indian grouping works for both languages: the last three digits, then groups of two.

**Split into groups**

```
n = 1,23,45,678
groups (right to left): [678 (3 digits), 45, 23, 1]
scales:                 [—, thousand, lakh, crore, (arab, kharab)]
```

**English (M-7)**

1. Handle zero.
2. Convert each group with a helper for 0 to 99 and a hundreds step.
3. Join groups with scale names: thousand, lakh, crore. For values above 99 crore, say the crore group as its own number ("one hundred crore").
4. Wrap: `Rupees <words> [and <paisa words> Paisa] Only`. Make the wrapper configurable.
5. Use title case or lowercase by option.

**Nepali (M-8)**

- Nepali has a unique word for each number from 0 to 99. Store all 100 in `data/nepali-numbers.json` **[SOURCE NEEDED]** (review with a native speaker).
- Scales: सय (100), हजार (10^3), लाख (10^5), करोड (10^7), अर्ब (10^9), खर्ब (10^11).
- Group the number as: ones and tens (two digits), hundreds (one digit), then pairs for हजार, लाख, करोड, अर्ब, खर्ब.
- Join with spaces. Example shape: `<words> रुपैयाँ <words> पैसा मात्र`.
- Limit: below 10^13. Throw a typed error above it.

**Tests:** all numbers 0 to 999 against a hand-checked list. Plus all scale boundaries (999, 1,000, 99,999, 1,00,000, 99,99,999, 1,00,00,000 and the same pattern up to the limit).

### 9.6 VAT (M-9)

Standard rate 13%. Keep the rate as a parameter.

```ts
// exclusive: price does not include VAT
vatExclusive(base: Npr, bp = 1300) { vat = base.percent(bp); return { subtotal: base, vat, total: base.plus(vat) }; }

// inclusive: price already includes VAT
vatInclusive(total: Npr, bp = 1300) {
  // base = total * 10000 / (10000 + bp), rounded half away from zero
  const base = total.dividedBy(10000 + bp, /*times*/ 10000);
  return { subtotal: base, vat: total.minus(base), total };
}
```

Compute the VAT in inclusive mode as `total - base` so the pieces always add up.

## 10. Phone numbers (P-1 to P-7)

### 10.1 Pipeline

1. **Clean (P-2):** convert Devanagari digits, remove spaces, dashes, dots and brackets.
2. **Strip country code:** remove a leading `+977`, `00977` or `977` when the remaining length fits. Keep a flag `hadCountryCode`.
3. **Classify:**
   - Mobile: 10 digits and the first digit is 9.
   - Landline: leading 0 (optional) then an area code from the data table, then the local number.
   - Otherwise: invalid.
4. **Check the prefix (P-4, P-5):** look up the first three digits in the mobile prefix table. Return the carrier. If `active` is false, throw unless `allowInactive` is set.
5. **Output (P-3):**
   - `e164`: `+977` plus the national number without a leading zero.
   - `national`: the display format. Keep the format in the data file so it can change without code changes.
   - `carrier`, `type` (mobile or landline), `areaCode`.

### 10.2 Result and errors (P-1, P-6)

```ts
interface ParsedPhone { e164: string; national: string; type: 'mobile'|'landline'; carrier?: 'NTC'|'Ncell'|'Other'; areaCode?: string; }
```

Error codes: `EMPTY`, `TOO_SHORT`, `TOO_LONG`, `BAD_PREFIX`, `INACTIVE_PREFIX`, `BAD_CHARACTERS`. Each has a message in Nepali and English from the string table.

Also provide `isValidPhone(text)` that never throws.

### 10.3 Tests

`testdata/phone.json` with valid and invalid numbers for each case: each carrier, landlines, Devanagari input, +977 input, spaces and dashes, inactive prefix, wrong length. **[SOURCE NEEDED]** for real prefixes.

## 11. Address data (A-1 to A-6)

### 11.1 Data shape

```json
{
  "provinces": [ { "id": 1, "en": "...", "ne": "..." } ],
  "districts": [ { "id": 1, "provinceId": 1, "en": "...", "ne": "..." } ],
  "localLevels": [ { "id": 1, "districtId": 1, "type": "metropolitan|sub-metropolitan|municipality|rural-municipality", "en": "...", "ne": "...", "wards": 0 } ]
}
```

Check counts in CI: 7 provinces, 77 districts, 753 local levels (A-1). Check that every `districtId` and `provinceId` exists. Check that every `wards` is a positive integer (A-2).

### 11.2 Generator (A-5)

`tools/gen-address`:

1. Read the upstream MIT dataset **[SOURCE NEEDED]** (the one named in nepal-kit's README).
2. Normalize all Nepali text to Unicode NFC.
3. Fix split vowel signs. These are cases where a vowel sign is separated from its consonant by a stray character. Find them with a regex, fix them by rule, and list every fix in a log file.
4. Assign stable numeric ids. Do not renumber on regeneration. Keep an id map file in the repo.
5. Write `data/address.json`.

### 11.3 API (A-3, A-4)

```ts
provinces(): Province[]
districtsOf(provinceId): District[]
localLevelsOf(districtId): LocalLevel[]
searchAddress(query, { language, limit }): Match[]
formatAddress({ localLevelId, ward, tole?, street? }, language): string
```

**Search**

- Normalize the query: trim, lowercase for English, NFC for Nepali.
- Match by prefix first, then by substring.
- Rank: exact, prefix, substring. Then by name length.
- Search both languages at once if `language` is `auto`.

**Format**

- English: `Tole, Ward N, Local Level, District, Province`.
- Nepali: same order with Nepali names and Devanagari ward digits.

### 11.4 Loading (JS)

- Put address data in its own entry point `jhigu-patro-kit/address`.
- Build search indexes the first time they are used. Not at import time.
- Dart: generated const lists need no lazy load.

### 11.5 Picker (A-6)

Implement in the headless layer (section 15.1) as a state machine:

- Choosing a province clears district and local level.
- Choosing a district clears local level.
- Ward is a number from 1 to the local level's `wards`.
- Emit one change event with the full selection.

## 12. Receipts and invoices (R-1 to R-11)

### 12.1 Model (R-1)

```dart
class ReceiptDocument {
  ReceiptKind kind;               // invoice, receipt, quotation, creditNote
  String number;
  NepaliDate issueDate;
  NepaliDate? dueDate;
  Business business;              // name, address, pan, vat, logo bytes, phone
  Party customer;
  List<ReceiptLine> lines;        // description, qty, unit, unitPrice
  Discount? discount;             // amount or percent
  VatMode vatMode;                // none, exclusive, inclusive
  int vatBasisPoints;             // default 1300
  Npr paid;
  String? notes;
  ReceiptStamp? stamp;            // paid, cancelled
  Language language;              // ne, en, bilingual
  PageSize pageSize;              // a4, a5, roll80
}
```

Quantity: store as an integer in thousandths (1.5 is 1500) to allow fractional quantities exactly (R-3).

### 12.2 Totals (R-2)

Order of calculation (write it in the docs and test it):

1. `lineAmount = round(qty * unitPrice)` per line, half away from zero.
2. `gross = sum(lineAmount)`.
3. Apply the discount to `gross`. Percent discounts use basis points.
4. VAT:
   - `none`: taxable = discounted amount, VAT = 0.
   - `exclusive`: VAT = percent of taxable. Total = taxable + VAT.
   - `inclusive`: the prices already include VAT. Use `vatInclusive` on the discounted amount.
5. `balance = total - paid`. If negative, mark as overpaid.

Put this in a pure function `computeTotals(doc)`. Port it to JS (R-10) with the same vectors in `testdata/receipt.json`.

### 12.3 PDF layout (R-3, R-4, R-5)

Use the Dart `pdf` package.

Layout from top to bottom:

1. Header: logo, business name, address, PAN and VAT numbers.
2. Title and number. BS issue date, with AD date beside it. Due date if present.
3. Customer block.
4. Lines table: description, qty and unit, rate, amount.
5. Totals block: gross, discount, taxable, VAT, total, paid, balance.
6. Amount in words (M-7, M-8) based on the language.
7. Notes.
8. Signature line.
9. Stamp (rotated, semi-transparent text) when set.

Page sizes:

| Size | Setting |
|------|---------|
| A4 | `PdfPageFormat.a4` |
| A5 | `PdfPageFormat.a5` |
| 80 mm roll | `PdfPageFormat.roll80` (or a custom format with 80 mm width and unlimited height) |

For the thermal roll, use a single column layout with smaller fonts and no table borders.

### 12.4 Devanagari in PDF (R-6, R-7, R-9)

**Problem:** the PDF library cannot shape Devanagari. Letters join wrong.

**Solution:** draw any string that contains Devanagari as an image. Keep Latin text and digits as real text.

Rule: a string is "Devanagari" if it has any character from U+0900 to U+097F.

Design: a small interface so each platform can plug in its own renderer.

```dart
abstract class DevanagariRenderer {
  Future<RenderedText> render(String text, {required double fontSize, required bool bold, required int color});
}
class RenderedText { final Uint8List png; final double widthPt; final double heightPt; }
```

**Implementations**

| Renderer | Where | How |
|----------|-------|-----|
| `FlutterDevanagariRenderer` (R-6) | Flutter apps | Load Noto Sans Devanagari with `FontLoader`. Lay out with `TextPainter`. Draw on a canvas scaled to about 290 dpi (scale factor 290 / 72). Convert with `Picture.toImage` and encode as PNG |
| `AtlasDevanagariRenderer` | Pure Dart server | Pre-render all fixed labels at build time. Look up by string. Fails for user text |
| `FfiShapingRenderer` (R-9, P1) | Pure Dart server | Bind HarfBuzz and FreeType through `dart:ffi`. Shape and draw glyphs to a bitmap |
| `CommandRenderer` | Any server | Call an external renderer (for example a small Node script or a headless browser) and read back the PNG |

- Cache by `(text, size, weight, color)`.
- The PDF builder places the image at the right width and baseline. Use the returned `widthPt` and `heightPt`.
- **[DECISION]** For R-9, ship `AtlasDevanagariRenderer` plus `CommandRenderer` first. Build `FfiShapingRenderer` only if users need it. Writing a correct shaper is large work.
- Bundle Noto Sans Devanagari Regular and Bold (R-7). Keep the OFL licence file next to the fonts.
- If a server has no renderer, fall back to English labels and print a clear warning. Never print broken glyphs without a warning.

### 12.5 Flutter print, share, preview (R-8)

- `ReceiptPreview` widget: use `PdfPreview` from the `printing` package.
- `printReceipt(doc)`: call `Printing.layoutPdf`.
- `shareReceipt(doc)`: call `Printing.sharePdf`.
- Keep these in `jhigu_patro_kit_flutter` so the core package stays free of Flutter.

### 12.6 JS receipts (R-10, R-11)

- **R-10:** model, totals, validation, and amount in words. No rendering.
- **R-11:** render an HTML template from the model. Use that one HTML template two ways:
  - Browser: open it in a print view. The browser shapes Devanagari correctly.
  - Server: use a headless browser to print it to PDF.
- Use CSS `@page` for A4, A5 and 80 mm sizes. Embed the Noto font with `@font-face` as a data URL so output is the same everywhere.
- **[DECISION]** Do not write a second PDF engine in JS. The HTML route is cheaper and shapes text correctly.

### 12.7 Tests

- Totals vectors in `testdata/receipt.json`. Both languages must match to the paisa.
- Golden images: render a receipt and compare to a stored image with a small tolerance. Do this for each page size and each language.
- A text-extraction test: confirm Latin numbers in the PDF are real text and can be copied.

## 13. SMS reminders (S-1 to S-8)

### 13.1 Gateway interface (S-1, S-3)

```dart
abstract class SmsGateway {
  Future<SmsResult> send(SmsMessage message);
  Future<List<SmsResult>> sendBulk(List<SmsMessage> messages);
}
class SmsMessage { final String toE164; final String text; final String? reference; }
class SmsResult { final bool ok; final String? providerId; final SmsError? error; }
```

`MockSmsGateway` stores sent messages in a list and can be told to fail on demand. Use it in tests and demos.

### 13.2 Sandesh gateway (S-2)

- **[SOURCE NEEDED]** Read the official Sandesh API docs. Do not guess endpoints, headers or the error format.
- Build with an injectable HTTP client so tests can use a fake.
- Map the provider's error envelope to typed `SmsError` values: auth, balance, bad number, rate limit, server, network.
- Bulk: split into batches at the provider's limit and keep results in input order.
- Certificate pinning (Dart, non-web): use `SecurityContext` and a custom `HttpClient`. Make pinning optional with a clear way to update pins. Pinning is not available on Dart web.
- Never log message text or phone numbers by default.

### 13.3 Templates and renderer (S-4, S-5, S-7)

- Template files are in the data package. Each has `ne` and `en` text and a list of required placeholders.
- Examples: rent due, udhaaro (money owed), appointment.
- Placeholder syntax: `{name}`.
- Renderer rules:
  1. Find every `{key}`.
  2. Replace from the values map.
  3. In strict mode, throw if a key is missing. In lenient mode, leave it empty.
- Match the Sandesh preview behaviour exactly. **[SOURCE NEEDED]** Test with a sample from their docs.
- Add `smsSegments(text)`. Nepali text uses UCS-2, so one SMS part holds about 70 characters. English-only GSM text holds 160. Show the part count so users can estimate cost.

### 13.4 Scheduler (S-6)

```dart
abstract class ReminderStore {
  Future<List<Reminder>> loadAll();
  Future<void> save(Reminder r);
  Future<void> delete(String id);
}
class ReminderScheduler {
  ReminderScheduler({required SmsGateway gateway, required ReminderStore store, Clock? clock});
  void start();   // runs a timer
  void stop();
  Future<void> runOnce();
}
```

- `Reminder` has: id, recipient, template key, values, send date as `NepaliDate` and time, status, attempt count.
- `runOnce`: load reminders, pick those due at or before now (Nepal time), send, update status.
- Retry with back-off (for example 1, 5, 30 minutes) up to a maximum, then mark failed.
- Provide an in-memory store and a file or SQLite example store.
- Document the limit: a client-side scheduler only runs while the app is open. For real use, run `runOnce` from a server job. Say this clearly in the README.

### 13.5 JS (S-7, S-8)

- **P1:** templates and renderer, plus `smsSegments`.
- **P2:** gateway and scheduler, with the same interfaces in TypeScript.

## 14. Localisation (L-1 to L-4)

### 14.1 Core

- `getStrings('ne' | 'en')` returns the typed table (generated, section 5.5).
- All formatting code takes a `language` argument and reads from this table.

### 14.2 Flutter (L-3)

```dart
class NepalKitLocalizations {
  static const LocalizationsDelegate<NepalKitStrings> delegate = _Delegate();
  static NepalKitStrings of(BuildContext context);
}
class NepalKitLanguageScope extends InheritedWidget {
  final Language language;   // overrides for the subtree
}
```

Lookup order: language scope, then the app locale, then English.

### 14.3 Web and React Native (L-4)

- Every widget has a `language` prop.
- A provider sets the default for a subtree: `<JhiguProvider language="ne">` for React and React Native. Web components use a `lang` attribute on any ancestor.
- Do not read the browser language unless the developer asks for `language="auto"`.

## 15. Widgets (U-1 to U-17)

### 15.1 Headless layer (U-4)

A small framework-free state engine for each widget. No DOM and no React.

```ts
const picker = createDatePicker({
  value: null, min, max, language: 'ne', weekStartsOn: 0, showAd: true,
});
picker.subscribe(state => render(state));
picker.actions.nextMonth();
picker.actions.select(date);
```

**State**

```ts
{
  view: 'days' | 'months' | 'years',
  visibleYear, visibleMonth,
  grid: GridCell[][],          // from getMonthGrid
  value: NepaliDate | null,
  focused: NepaliDate,
  canGoPrev: boolean, canGoNext: boolean,
}
```

**Actions:** `prevMonth`, `nextMonth`, `goTo(year, month)`, `setView`, `select`, `clear`, `selectToday`, `moveFocus(kind)`.

**Keyboard map (U-15)**

| Key | Action |
|-----|--------|
| Left, Right | Move focus 1 day |
| Up, Down | Move focus 7 days |
| Home, End | Start and end of the week |
| Page Up, Page Down | Previous and next month |
| Shift + Page Up, Page Down | Previous and next year |
| Enter, Space | Select the focused day |
| Escape | Close (popup mode) |

**Accessibility helpers**

- `getCellProps(cell)` returns `role="gridcell"`, `aria-selected`, `aria-disabled`, and `aria-label` with the full date in the chosen language (for example weekday, day, month name, year, and the AD date).
- The grid has `role="grid"`. The title has `aria-live="polite"` so month changes are announced.
- Respect `prefers-reduced-motion`.

Do the same for: calendar, range picker, address select (section 11.5), phone input, and money input.

**Phone input (P2)**

- Format as the user types using the same parser in a lenient mode.
- Show the carrier name when the prefix is known.
- Show the validation message from the string table.

**Money input (P2)**

- Reformat with lakh grouping on every change.
- Keep the caret in place: count the digits to the left of the caret before formatting, then place the caret after that many digits in the new text.
- Accept Devanagari digits and convert them.

### 15.2 Web components (U-5, U-6, U-14)

Use Stencil. **[DECISION]** Lit is the alternative. Stencil is chosen because it generates the React, Vue and Angular wrappers and the SSR hydrate build for you. This cuts the long-term upkeep a lot.

**Components**

| Tag | Main props |
|-----|-----------|
| `<jhigu-date-picker>` | `value`, `min`, `max`, `language`, `week-starts-on`, `show-ad`, `name`, `disabled`, `popup` |
| `<jhigu-calendar>` | `year`, `month`, `language`, `marked`, `week-starts-on` |
| `<jhigu-date-range-picker>` | `start`, `end`, `min`, `max`, `language` |
| `<jhigu-address-select>` | `value`, `language`, `show-ward` |
| `<jhigu-phone-input>` | `value`, `allow-inactive`, `language` |
| `<jhigu-money-input>` | `value-paisa`, `symbol`, `devanagari` |

**Events**

- `jhiguChange` with `detail: { bs: 'YYYY-MM-DD', ad: 'YYYY-MM-DD', value: NepaliDate }`.
- Plus `jhiguOpen`, `jhiguClose` for popup mode.

**Forms**

Use `formAssociated: true` and `ElementInternals` so the value posts with a normal `<form>` and works with `required` and validity.

**Theming (U-6)**

CSS variables, with sensible defaults:

```css
--jhigu-color-primary
--jhigu-color-on-primary
--jhigu-color-surface
--jhigu-color-text
--jhigu-color-muted
--jhigu-color-holiday     /* Saturday */
--jhigu-color-today
--jhigu-radius
--jhigu-font-family
--jhigu-font-size
```

- Expose parts with `part="day"`, `part="header"`, `part="selected"` so apps can style from outside the shadow DOM.
- Support dark mode through `prefers-color-scheme` and a `theme` attribute.

**SSR (U-14)**

- Enable Stencil's hydrate output.
- Test each framework: Next.js, Nuxt and Angular. Render on the server and hydrate on the client.
- Rule: nothing may touch `window` or `document` at import time.

Size: keep the date picker under 15 KB gzipped (PRD section 10). Lazy-load address data.

### 15.3 Wrappers (U-7, U-9, U-10, U-11, U-12, U-17)

| Package | How |
|---------|-----|
| `@jhigu-patro/react` | Stencil React output target. Typed props, event props like `onJhiguChange`, refs |
| `@jhigu-patro/vue` | Stencil Vue output target. Add `v-model` binding through the output target's model config |
| `@jhigu-patro/angular` | Stencil Angular output target. Add a value accessor so `ngModel` and reactive forms work |
| `@jhigu-patro/svelte` | No generated wrapper needed. Ship type declarations for the tags and a short guide. Add a tiny action for two-way binding |
| `@jhigu-patro/solid` | Same as Svelte. Ship JSX type declarations and a guide |

Rules:

- Wrappers hold no logic. All behaviour lives in headless and elements.
- Each wrapper has an example app and a smoke test that renders, selects a date, and checks the change event.
- Add a wrapper for another framework only when requested, or when it can be generated.

### 15.4 React Native (U-8)

- Built on `@jhigu-patro/headless`.
- Use `useSyncExternalStore` to subscribe to the headless store.
- Views: `Pressable` for cells, `Text`, `FlatList` only if needed for year lists.
- Accessibility: `accessibilityRole="button"`, `accessibilityState={{ selected, disabled }}`, and `accessibilityLabel` using the full date.
- Theme: a `JhiguTheme` context with a plain object (colors, radius, font family).
- Components: `JhiguDatePicker`, `JhiguCalendar`, `JhiguAddressSelect`. Phone and money inputs in P2.
- Fonts: Devanagari renders with system fonts on Android and iOS. Test on both.
- No web dependencies. No DOM APIs.

### 15.5 Flutter widgets (U-1, U-2, U-3, U-15)

- Import only `package:flutter/widgets.dart`. No Material or Cupertino imports.
- Widgets: `JhiguCalendar`, `JhiguDatePicker`, `showJhiguDatePicker(context, ...)`, `JhiguAddressSelect`, later phone and money inputs.
- Data and state: use the Dart core `getMonthGrid`. Keep widget state small.
- Keyboard: use `Focus`, `Shortcuts` and `Actions` with the same key map as section 15.1.
- Accessibility: wrap cells in `Semantics` with a full date label, `selected` and `enabled` flags.
- Theme: `JhiguTheme` as an `InheritedWidget` holding `JhiguThemeData`. Provide defaults. Let apps map their own design system into it.
- Tests: widget tests for selection, bounds, month change, keyboard, language switch. Golden tests for light and dark themes in both languages.

### 15.6 Behaviour parity

All widget packages follow one behaviour spec: `docs/widget-spec.md`.

- It lists every state, key, event and label.
- A shared set of scripted scenarios is written once (as JSON steps) and run in each package's tests: "open on 2083 Kartik, press Right 3 times, expect focus on day 4" and so on.
- Any change to the spec updates every package in the same pull request.

## 16. Developer experience (X-1 to X-8)

### 16.1 Example apps (X-1, X-2)

- **Flutter:** tabs for Dates, Money, Phone, Address, Receipt, SMS. SMS uses the mock gateway. Receipt tab prints and shares.
- **Web examples:** one small app per framework with the same tabs: Dates, Address, Phone, Money.
- **Plain HTML:** one file that loads the elements from a CDN. This proves it works with no build tool.

### 16.2 Docs site (X-8)

- Pages: Getting started (per framework), Dates, Money, Phone, Address, Receipts, SMS, Widgets, Theming, Calendar data and accuracy, FAQ.
- Each widget page has a live demo and the same code in each framework (tabs).
- Generate API reference from the TypeScript source (TypeDoc) and Dart source (`dart doc`).
- Test every code sample in CI: extract and compile or run it.

### 16.3 AI tool files (X-7)

`CLAUDE.md` and `AGENTS.md` at the repo root and inside each package:

- Package purpose and layout.
- Rules from section 1 of this guide.
- How to run tests and generators.
- A warning to never edit generated files.

### 16.4 Zero dependencies (X-3)

- JS core has no runtime `dependencies` in `package.json`. CI fails if one appears.
- Run `size-limit` in CI with the budgets from the PRD.

## 17. Build order

Size: **S** is about a day, **M** is a few days, **L** is a week or more.

### Phase 0: setup (all S)

- [ ] Reserve npm org and package names
- [ ] Reserve pub.dev package names
- [ ] Create monorepo, workspaces, empty packages
- [ ] CI for JS, Dart, data and parity
- [ ] Licence and notices files
- [ ] **[DECISION]** repo merge approach

### Phase 1: data (M to L)

- [ ] `tools/check-calendar` and the golden file (M)
- [ ] Resolve calendar differences and write `data/calendar.json` (M, needs research)
- [ ] Calendar validator and JSON Schema (S)
- [ ] Strings files and key-parity check (S)
- [ ] Phone prefix and area code data (M, needs research)
- [ ] Address generator and `address.json` (M)
- [ ] `gen-data` for Dart and TS (M)

### Phase 2: dates in both languages (L)

- [ ] Core lookup arrays, `adToBs`, `bsToAd`, `today` (M)
- [ ] NepaliDate and arithmetic (M)
- [ ] Digits, formatter, presets, relative (M)
- [ ] Parser with alternate month names (M)
- [ ] Fiscal year (S)
- [ ] Month grid with events (M)
- [ ] Runtime loader and accuracy API (M)
- [ ] Shared vectors and time-zone test matrix (M)
- [ ] Round-trip and year-length tests (S)

### Phase 3: JS core for the rest (L)

- [ ] `Npr`, grouping, format, parse (M)
- [ ] Percent, allocate, split (S)
- [ ] Words in English and Nepali (M)
- [ ] VAT (S)
- [ ] Phone parser (M)
- [ ] Address API and search (M)
- [ ] Localisation helpers (S)
- [ ] Parity vectors for money, phone, address (M)

### Phase 4: widgets, part 1 (L)

- [ ] Headless date picker and calendar (M)
- [ ] Widget behaviour spec and scripted scenarios (M)
- [ ] Stencil elements: date picker, calendar, address select (L)
- [ ] Theming and parts (S)
- [ ] React wrapper and example (S)
- [ ] SSR checks in Next.js (M)
- [ ] React Native date picker and calendar (L)
- [ ] Flutter widgets: calendar, picker, theme, tests (L)
- [ ] Accessibility pass (M)

### Phase 5: receipts and SMS in JS (M)

- [ ] Receipt model and totals in JS (M)
- [ ] SMS templates, renderer, segments in JS (S)
- [ ] Parity vectors for totals (S)

### Phase 6: widgets, part 2 (L)

- [ ] Vue and Angular wrappers (M)
- [ ] Svelte and Solid typings and guides (S)
- [ ] Range picker, phone input, money input in all packages (L)
- [ ] Phone and money inputs in React Native (M)

### Phase 7: hardening (L)

- [ ] Atlas and command renderers for server PDFs (M)
- [ ] JS HTML receipt template and print route (M)
- [ ] **[DECISION]** FFI shaping renderer (L, only if needed)
- [ ] Docs site with live demos (L)
- [ ] Sample code tests in CI (S)

### Phase 8: launch (M)

- [ ] Final audit against the PRD with the gap-report prompt
- [ ] Publish to pub.dev and npm
- [ ] Clean-project install test for each package
- [ ] Announce

## 18. Feature-to-code map

| PRD IDs | Dart location | JS location | Tests |
|---------|---------------|-------------|-------|
| D-1 to D-5 | `lib/src/dates/convert.dart` | `core/src/dates/convert.ts` | `testdata/dates.json`, round trip |
| D-6 to D-8 | `lib/src/dates/nepali_date.dart` | `core/src/dates/nepali-date.ts` | `testdata/dates.json` |
| D-9 to D-12, D-18 | `lib/src/dates/format.dart` | `core/src/dates/format.ts` | `testdata/dates.json` |
| D-13, D-14 | `lib/src/dates/parse.dart` | `core/src/dates/parse.ts` | 60+ parse strings |
| D-15 | `lib/src/dates/fiscal.dart` | `core/src/dates/fiscal.ts` | fiscal vectors |
| D-16, D-17 | `lib/src/dates/grid.dart` | `core/src/dates/grid.ts` | grid vectors |
| D-19 | `lib/src/errors.dart` | `core/src/errors.ts` | error code tests |
| C-1 to C-3 | `data/` and generator | `data/` and generator | schema and validator tests |
| C-4 to C-6 | `lib/src/calendar/registry.dart` | `core/src/calendar/registry.ts` | loader tests, atomic swap tests |
| C-7 to C-9 | `testdata/calendar-golden.json` | same | golden, round trip, year length |
| M-1 to M-6 | `lib/src/money/npr.dart` | `core/src/money/npr.ts` | `testdata/money.json`, random allocate test |
| M-7, M-8 | `lib/src/money/words.dart` | `core/src/money/words.ts` | 0 to 999 plus scale edges |
| M-9 | `lib/src/money/vat.dart` | `core/src/money/vat.ts` | VAT vectors |
| P-1 to P-7 | `lib/src/phone/` | `core/src/phone/` | `testdata/phone.json` |
| A-1 to A-5 | `lib/src/address/` | `core/src/address/` | count and link checks, search tests |
| A-6 | Flutter and RN widgets | headless and elements | picker state tests |
| R-1 to R-5 | `lib/src/receipt/` | `core/src/receipt/` (model only) | `testdata/receipt.json`, golden PDFs |
| R-6 to R-9 | `lib/src/receipt/devanagari/` | n/a | golden images |
| R-8 | `jhigu_patro_kit_flutter/lib/receipt/` | n/a | widget tests |
| R-10, R-11 | n/a | `core/src/receipt/`, `core/src/receipt/html.ts` | totals parity, print tests |
| S-1 to S-6 | `lib/src/sms/` | n/a | mock gateway tests, fake HTTP |
| S-7, S-8 | n/a | `core/src/sms/` | template tests |
| L-1, L-2 | generated | generated | key parity check |
| L-3 | `jhigu_patro_kit_flutter/lib/l10n/` | n/a | widget tests |
| L-4 | n/a | headless, elements, RN | language switch tests |
| U-1 to U-3 | `jhigu_patro_kit_flutter/lib/widgets/` | n/a | widget and golden tests |
| U-4 | n/a | `headless/` | state and keyboard tests |
| U-5, U-6, U-14 | n/a | `elements/` | Playwright, SSR tests |
| U-7, U-9 to U-12 | n/a | wrappers | smoke tests per framework |
| U-8 | n/a | `react-native/` | React Native Testing Library |
| U-13 | all widget packages | all widget packages | scripted scenarios |
| U-15 | all widget packages | all widget packages | axe tests (web), semantics tests (Flutter) |
| X-1 to X-9 | `examples/`, workflows | same | CI |

## 19. Definition of done

A feature is done when all of these are true:

1. It works in every package the PRD lists for it.
2. It has tests, and the shared vectors pass in both Dart and JS.
3. It has a doc comment and a docs page with an example.
4. It has Nepali and English strings with no hard-coded text.
5. Widgets pass the accessibility checks and the scripted scenarios.
6. Bundle size stays within the budgets.
7. CI is green on every workflow.

## 20. Things you must still decide or look up

| Item | Type | Why it matters |
|------|------|----------------|
| Real calendar month lengths and the resolution of source disagreements | [SOURCE NEEDED] | Wrong data gives wrong dates |
| Real phone prefix and area code list | [SOURCE NEEDED] | Wrong carrier results |
| Address upstream dataset and its licence | [SOURCE NEEDED] | Legal and accuracy |
| Sandesh API details and preview rules | [SOURCE NEEDED] | The gateway cannot be built without them |
| Nepali words for 0 to 99 | [SOURCE NEEDED] | Native speaker review |
| Repo merge approach and author permission | [DECISION] | Credit and licence |
| `bigint` or `number` for JS money | [DECISION] | Range versus simplicity |
| Stencil or Lit for elements | [DECISION] | Wrapper upkeep |
| Docs tool | [DECISION] | Setup time |
| Server Devanagari renderer scope | [DECISION] | Size of the work |
