# PRD: Jhigu Patro Kit — Unified Toolkit for Nepal Apps

**Library name:** jhigu-patro-kit
**Status:** Draft v2
**Sources merged:** nepal-kit (Dart/Flutter, by lohanidamodar) and nepal-date-kit (TypeScript, by bijaybohora)
**New in v2:** final name, a JavaScript library, and a widget library for all major frontend frameworks

---

## 1. Summary

Jhigu Patro Kit is one toolkit for building apps in Nepal. It covers Bikram Sambat (BS) dates, Nepali money, phone numbers, addresses, receipts and SMS.

Today the pieces are split. nepal-kit is rich but Dart-only. nepal-date-kit is TypeScript-only and does dates only. A team that uses React and Flutter must pick one and give up the other.

This PRD merges both into one product. It has:

- One shared data source.
- A Dart library and a JavaScript library that give the same answers.
- A widget library that works in every major frontend framework.

## 2. Problem

- Nepal apps all rebuild the same things: BS dates, lakh grouping, Nepali digits, amount in words, VAT, phone checks.
- Existing libraries disagree on calendar data. Some dates are off by one day.
- Devanagari text breaks in most PDF tools. Conjuncts print wrong.
- Web teams (TypeScript) have no money, phone, address or receipt tools.
- Mobile teams (Flutter) have no shared logic with their web teams.
- There is no ready date picker for most web frameworks.
- Neither library has a single trusted calendar source that both languages share.

## 3. Goals

1. One feature set across Dart and JavaScript, with matching results.
2. One calendar data source, checked against several references, with clear accuracy flags.
3. Correct Devanagari output everywhere, including PDFs.
4. A widget library for Flutter, React Native, and all major web frameworks.
5. Easy to adopt: small, typed, well documented, published on pub.dev and npm.
6. Nepali and English support in every feature.

## 4. Non-goals (v1)

- Holidays, festivals and tithi data. We leave a hook for them (see 7.1, D-17).
- Payment gateways (eSewa, Khalti, ConnectIPS).
- Nepali keyboard or text input tools.
- Full accounting or tax filing logic beyond VAT.
- Dates outside BS 1970–2100.
- Wrappers for niche frameworks (Qwik, Blazor and similar) unless people ask.

## 5. Users

| User | Need |
|------|------|
| Flutter app developer | Date picker, receipts, SMS reminders, phone and address forms |
| React Native developer | Native date picker and calendar, plus core logic |
| Web developer (React, Vue, Angular, Svelte, Solid, plain HTML) | BS conversion, date picker, calendar, money and phone helpers |
| Backend developer (Node, Dart server, cloud functions) | Pure logic with no UI: dates, money, VAT, validation, SMS |
| Small business owner (end user of apps built with the kit) | Correct Nepali dates, readable receipts, rent and due reminders |

## 6. Product shape

### 6.1 Packages

| Layer | Package | Registry | Job |
|-------|---------|----------|-----|
| Data | `jhigu-patro-data` | npm, pub.dev | One JSON source for calendar, address, phone prefixes, strings |
| Dart core | `jhigu_patro_kit` | pub.dev | All logic, PDF, SMS. Pure Dart, no UI |
| Flutter widgets | `jhigu_patro_kit_flutter` | pub.dev | Native Flutter widgets, print, share, preview |
| JS core | `jhigu-patro-kit` | npm | Same logic in TypeScript. Zero dependencies |
| Headless UI | `@jhigu-patro/headless` | npm | Picker and calendar state and behaviour. No visuals |
| Web components | `@jhigu-patro/elements` | npm | `<jhigu-date-picker>`, `<jhigu-calendar>`, `<jhigu-address-select>` |
| React wrapper | `@jhigu-patro/react` | npm | Typed React components around the elements |
| Vue wrapper | `@jhigu-patro/vue` | npm | Typed Vue components with `v-model` |
| Angular wrapper | `@jhigu-patro/angular` | npm | Angular components with `ngModel` and forms support |
| Svelte wrapper | `@jhigu-patro/svelte` | npm | Svelte components |
| Solid wrapper | `@jhigu-patro/solid` | npm | Solid components |
| React Native | `@jhigu-patro/react-native` | npm | Native widgets built on the headless layer |

**Key rules**

- The JSON data package is the single source of truth. Build scripts generate the Dart and TypeScript data files from it. Nobody edits generated files by hand.
- Write UI logic once in the headless layer. Web components and React Native both use it.
- Web components work in any framework and in plain HTML. Wrappers only add typed props, events and form binding.
- React Native cannot use web components. It gets its own views on top of the headless layer.

### 6.2 Naming notes

- pub.dev needs underscores, so Dart packages use `jhigu_patro_kit`.
- npm uses hyphens: `jhigu-patro-kit`.
- Element tags: `<jhigu-date-picker>`, `<jhigu-calendar>`, `<jhigu-address-select>`.
- Flutter classes stay short: `JhiguDatePicker`, `JhiguCalendar`. Core types keep plain names: `NepaliDate`, `Npr`.
- Claim the `@jhigu-patro` npm org and reserve all package names on npm and pub.dev before launch.

### 6.3 Layer diagram

```
            jhigu-patro-data (JSON)
              /                \
     jhigu_patro_kit      jhigu-patro-kit
        (Dart core)         (JS core)
            |                    |
  jhigu_patro_kit_flutter   @jhigu-patro/headless
     (Flutter widgets)        /            \
                     @jhigu-patro/elements   @jhigu-patro/react-native
                      /   |    |    |   \
                 react  vue angular svelte solid
```

## 7. Feature requirements

Priority: **P0** = must ship in v1. **P1** = ship soon after. **P2** = later.
Source: **K** = from nepal-kit. **D** = from nepal-date-kit. **New** = added by this merge.

### 7.1 Bikram Sambat dates

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| D-1 | Convert AD to BS and BS to AD | K, D | P0 |
| D-2 | Support BS 1970–2100 (the wider Dart range), AD 1913–2044 | K | P0 |
| D-3 | Throw a clear error outside the range | K, D | P0 |
| D-4 | No time-zone day shifts. Read calendar fields only. Document the returned time (UTC midnight in Dart, local midnight in JS) | K, D | P0 |
| D-5 | `today()` returns today in Nepal (UTC+05:45) | K | P0 |
| D-6 | NepaliDate object with add or subtract days, months, years. Clamp the day when the new month is shorter | K, D | P0 |
| D-7 | `diff` in days, months, years. `compare`, `isBefore`, `isAfter`, `isSame` | D | P0 |
| D-8 | `startOfMonth`, `endOfMonth`, `daysInMonth`, `isValid`, `weekday` | D | P0 |
| D-9 | Format presets: full, long, iso, slash, dmy, short, monthYear, gate, dual, relative, fiscal | D | P0 |
| D-10 | Custom format tokens: `YYYY YY MM M DD D MMMM MMM dddd ddd` and `[literal]` text | D, K | P0 |
| D-11 | Nepali and English output. Devanagari digits in Nepali. ASCII digits for iso, slash, dmy | K, D | P0 |
| D-12 | Format AD dates in Nepali | K | P1 |
| D-13 | Parse many BS inputs: ISO, slash, dot, Devanagari, month names, गते, साल, वि.सं., leading weekday | D, K | P0 |
| D-14 | Accept common English month spellings (Asoj, Poush, Ashadh) | D | P1 |
| D-15 | Fiscal year: starts 1 Shrawan. Return start year, end year, code like 2083/84 | D | P0 |
| D-16 | Month grid for UI: weeks, cells, weekStartsOn, in-range flag, AD date per cell, today flag | K, D | P0 |
| D-17 | Event hook on the grid: pass events, or fill them with a callback. This is also the future hook for holidays and festivals | D | P1 |
| D-18 | Digit helpers: `toNepaliDigits`, `toEnglishDigits` | K, D | P0 |
| D-19 | Typed error codes: `OUT_OF_RANGE`, `INVALID_DATE`, `INVALID_DATA`, `PARSE_ERROR` | D | P0 |

### 7.2 Calendar data and accuracy

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| C-1 | One JSON calendar file: month lengths plus AD start of each BS year | D | P0 |
| C-2 | Validate the file: shape, 12 months of 29–32 days, years in a row, AD starts line up | D | P0 |
| C-3 | Publish a JSON Schema for editors and API payloads | D | P1 |
| C-4 | Load a newer calendar at runtime with merge or replace. A failed load changes nothing | D | P0 |
| C-5 | `isVerifiedYear` and `getDateAccuracy` with a warning for unverified years | D | P0 |
| C-6 | `getCalendarMeta` and `getCalendarData` return the active range and watermark | D | P1 |
| C-7 | Golden test suite shared by both languages (see section 9) | New | P0 |
| C-8 | Year lengths cross-checked against an independent day-count table | K | P0 |
| C-9 | Round-trip test for every day in range (about 47,800 days) | K | P0 |

### 7.3 Numbers and money

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| M-1 | Lakh and crore grouping (1,23,45,678) | K | P0 |
| M-2 | `Npr` type stored as integer paisa. No floats | K | P0 |
| M-3 | Format with Rs. or रु, optional Devanagari digits | K | P0 |
| M-4 | Parse text like रु १,२५०.५० | K | P0 |
| M-5 | `times` and `percent` round half away from zero | K | P0 |
| M-6 | `split` and `allocate` always add back to the original amount | K | P0 |
| M-7 | Amount in words, English (lakh and crore scale) | K | P0 |
| M-8 | Amount in words, Nepali, up to अर्ब and खर्ब | K | P0 |
| M-9 | VAT: standard 13%, exclusive or inclusive. Returns subtotal, VAT, total | K | P0 |

### 7.4 Phone numbers

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| P-1 | Parse and validate Nepali mobile and landline numbers | K | P0 |
| P-2 | Accept Devanagari digits, spaces, dashes and +977 | K | P0 |
| P-3 | Output E.164 for storage and a readable format for display | K | P0 |
| P-4 | Detect carrier: NTC and Ncell | K | P0 |
| P-5 | Reject inactive prefixes unless `allowInactive` is set | K | P1 |
| P-6 | Typed validation errors with Nepali and English messages | K | P0 |
| P-7 | Prefix list lives in the shared data package so it can be updated without a code change | New | P0 |

### 7.5 Address data

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| A-1 | 7 provinces, 77 districts, 753 local levels, each with English and Nepali names | K | P0 |
| A-2 | Ward count per local level | K | P0 |
| A-3 | Lookups: `districtsOf`, `localLevelsOf`, and search by name (English or Nepali) | K | P0 |
| A-4 | Format an address in Nepali or English | K | P0 |
| A-5 | Generator script that rebuilds data from the upstream MIT dataset and fixes split vowel signs | K | P1 |
| A-6 | Cascading province, district, local level picker in every widget package | K, New | P1 |

### 7.6 Receipts and invoices (PDF)

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| R-1 | `ReceiptDocument` model: kind, number, dates, business, customer, lines, VAT, language | K | P0 (Dart) |
| R-2 | Totals: subtotal, discount, taxable, VAT, total, paid, balance | K | P0 (Dart) |
| R-3 | PDF with logo, PAN and VAT numbers, BS and AD dates, due date, fractional quantities and units | K | P0 (Dart) |
| R-4 | Amount in words, notes, signature line, PAID and CANCELLED stamps | K | P0 (Dart) |
| R-5 | Page sizes: A4, A5 and 80 mm thermal roll | K | P0 (Dart) |
| R-6 | Correct Devanagari in PDF by drawing Devanagari strings as images (about 290 dpi). Latin text and numbers stay real text | K | P0 (Flutter) |
| R-7 | Bundled Noto Sans Devanagari regular and bold (OFL licence) | K | P0 |
| R-8 | Flutter: print, share, and preview widgets | K | P0 (Flutter) |
| R-9 | Pure-Dart server rasteriser for Devanagari PDFs (fixes the known server gap) | New | P1 |
| R-10 | JS receipt model and totals (same maths as Dart) | New | P1 |
| R-11 | JS PDF or print output with correct Devanagari (browser print or a server renderer) | New | P2 |

### 7.7 SMS reminders

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| S-1 | `SmsGateway` interface | K | P0 (Dart) |
| S-2 | Sandesh gateway: send one, send bulk, map error envelope, certificate pinning | K | P0 (Dart) |
| S-3 | `MockSmsGateway` for tests and demos | K | P0 (Dart) |
| S-4 | Reminder templates in Nepali and English: rent due, udhaaro, appointment | K | P0 |
| S-5 | `{placeholder}` template renderer that matches the Sandesh preview | K | P0 |
| S-6 | Client-side `ReminderScheduler` with retries and a pluggable `ReminderStore` | K | P0 (Dart) |
| S-7 | Templates and renderer in JS | New | P1 |
| S-8 | JS gateway and scheduler | New | P2 |

### 7.8 Localisation

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| L-1 | Shared `ne` and `en` string tables: months, weekdays, eras, picker labels, phone errors, receipt labels | K, D | P0 |
| L-2 | Strings live in the shared data package and generate both languages | New | P0 |
| L-3 | Flutter: `NepalKitLocalizations.delegate` and a language scope widget for per-subtree language | K | P0 |
| L-4 | Web and React Native: a `language` prop on every widget, plus a provider for app-wide default, independent of the app locale | New | P1 |

### 7.9 Widget library

The widget library is the main new scope in v2.

#### Widgets

| Widget | Description |
|--------|-------------|
| Date picker | BS date selection. Shows the AD date in small type. Saturday in holiday colour. Month and year chooser. Today button. Min and max bounds |
| Calendar | Month view with marked dates and callbacks |
| Date range picker | Start and end date selection |
| Address select | Cascading province, district, local level, with optional ward |
| Phone input | Formats as you type. Shows carrier. Shows validation error |
| Money input | Lakh grouping as you type. Optional Devanagari digits |
| Amount in words | Read-only display |
| Receipt preview | Flutter first. Web later (see R-11) |

#### Requirements per layer

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| U-1 | Flutter date picker and calendar with all behaviours above, semantics labels | K | P0 |
| U-2 | Flutter widgets use only `flutter/widgets.dart` (work with Material, Cupertino or custom design systems) | K | P0 |
| U-3 | Flutter theme: `NepalKitTheme` | K | P0 |
| U-4 | Headless layer: month navigation, selection, bounds, keyboard handling, focus management, ARIA state | New | P1 |
| U-5 | Web components: date picker, calendar, address select. Shadow DOM with exposed CSS parts | New | P1 |
| U-6 | Theming with CSS variables so one theme works in all web wrappers | New | P1 |
| U-7 | React wrapper with typed props, events and ref support | New | P1 |
| U-8 | React Native widgets: date picker, calendar, address select, built on headless | New | P1 |
| U-9 | Vue wrapper with `v-model` | New | P2 |
| U-10 | Angular wrapper with `ngModel` and reactive forms support | New | P2 |
| U-11 | Svelte wrapper | New | P2 |
| U-12 | Solid wrapper | New | P2 |
| U-13 | Date range picker, phone input, money input widgets in all packages | New | P2 |
| U-14 | Server-side rendering (Next.js, Nuxt, SvelteKit) works with the elements. Test it early | New | P1 |
| U-15 | Accessibility: labelled days, keyboard navigation, screen reader labels, focus ring, reduced-motion support | K, New | P0 |
| U-16 | Right-to-left is not needed. Devanagari is left-to-right | New | n/a |
| U-17 | Wrappers are generated or templated where possible to keep upkeep low | New | P1 |

#### Framework priority

- **P0:** Flutter.
- **P1:** web components, React, React Native.
- **P2:** Vue, Angular, Svelte, Solid.
- **On demand only:** Qwik, Preact, Lit-only, Blazor and other niche stacks.

#### Honest limits

- "All frameworks" is a long tail. Cover the top five and let web components serve the rest.
- Each wrapper needs tests and upkeep. Only add one when people ask or when it is cheap to generate.
- Flutter and React Native need their own theme objects. They cannot use CSS variables.

### 7.10 Developer experience

| # | Requirement | Source | Priority |
|---|-------------|--------|----------|
| X-1 | Example app in Flutter with tabs: Dates, Money, Phone, Address, Receipt, SMS | K | P0 |
| X-2 | Example site with the web widgets, with tabs for each framework | New | P1 |
| X-3 | Zero runtime dependencies in the JS core. ESM and CJS builds. Types. Tree-shakeable | D | P0 |
| X-4 | Pure Dart core usable on servers, CLIs and cloud functions | K | P0 |
| X-5 | CI: lint, types, tests, build, and an import check of the built bundles | K, D | P0 |
| X-6 | Automated release from tags to pub.dev and npm | K, D | P0 |
| X-7 | `CLAUDE.md` and `AGENTS.md` so AI coding tools use the toolkit correctly | K | P1 |
| X-8 | Docs site with live demos for each widget in each framework | New | P1 |
| X-9 | Monorepo with shared tooling and one version policy | New | P0 |

## 8. Cross-platform parity

Both languages must return the same result for the same input.

| Area | Dart | JavaScript | Gap to close |
|------|------|------------|--------------|
| Dates | Yes | Yes | Merge the best of both (see 7.1) |
| Calendar data loading | Missing | Yes | Add to Dart |
| Accuracy flags | Missing | Yes | Add to Dart |
| Formatting presets and parsing | Partial | Full | Add to Dart |
| Fiscal year | Missing | Yes | Add to Dart |
| Money, VAT, words | Yes | Missing | Add to JS |
| Phone | Yes | Missing | Add to JS |
| Address | Yes | Missing | Add to JS |
| Receipt maths | Yes | Missing | Add to JS (P1) |
| PDF | Yes | Missing | P2 for JS |
| SMS | Yes | Missing | Templates P1, gateway P2 |
| UI | Flutter | Missing | Headless, elements, wrappers, React Native |

## 9. Data and accuracy plan

This is the highest risk area.

- The two sources disagree. nepal-kit says its table matches two other libraries for every month of BS 1970–2100. nepal-date-kit says other libraries differ from its data around BS 2062 and from BS 2087 onward. Both cannot be fully right.
- **Step 1:** build a golden test file. List every BS year with month lengths from each source side by side.
- **Step 2:** find every year where sources differ. Check each one against the official Nepal Panchang Nirnayak Samiti calendar.
- **Step 3:** publish one merged table. Set `verifiedThrough` honestly. Keep the unverified-year warning for later years.
- **Step 4:** both languages run the same golden tests in CI. A change to the data file must pass in both.
- **Step 5:** publish a data-fix process. Anyone can send a corrected year with proof. Runtime loading lets apps patch quickly.

## 10. Non-functional requirements

- **Correctness:** 100% pass on the round-trip and golden tests in both languages.
- **Size:** JS core under 30 KB gzipped (excluding address data, which loads on demand). Date picker element under 15 KB gzipped.
- **Speed:** a date conversion takes under 1 ms.
- **Compatibility:** Node 18+. Modern browsers. Dart and Flutter versions follow the current stable release and the `pdf` package needs.
- **Licences:** MIT for code. OFL for fonts. MIT for address data. Keep all notices.
- **Privacy:** no network calls except the SMS gateway when the developer sets it up. No analytics.
- **Accessibility:** all widgets have screen reader labels and full keyboard support (web).

## 11. Milestones

| Phase | Scope | Exit check |
|-------|-------|------------|
| 0. Setup | Claim `@jhigu-patro` org and package names. Monorepo. CI | Names reserved. CI green on empty packages |
| 1. Data | Golden test file. Resolve calendar differences. Shared JSON data package and generators | Both languages load the same data and pass the same tests |
| 2. Dates parity | Bring Dart up to the full date feature set. Keep JS as is, on the new data | Date tests match across both |
| 3. JS core | Money, VAT, words, phone, address, strings | Same test vectors pass in Dart and JS |
| 4. Widgets, part 1 | Headless layer, web components, React wrapper, React Native, Flutter polish | Works in real React, React Native and Flutter apps. Accessibility pass. SSR test |
| 5. Receipts and SMS in JS | Receipt model and totals. SMS templates | Totals match Dart to the paisa |
| 6. Widgets, part 2 | Vue, Angular, Svelte, Solid wrappers. Range, phone and money widgets | Each wrapper passes the shared widget test suite |
| 7. Hardening | Server Devanagari rasteriser (Dart). JS PDF or print route. Docs site | Server PDFs show correct Devanagari |
| 8. Launch | Publish to pub.dev and npm. Announce | Install and quick start work from a clean project |

## 12. Success metrics

- Zero known date errors in the verified range.
- Both libraries and the widget packages published, with a clean install on a fresh project.
- At least 3 real apps using both the Dart and JS packages within 6 months.
- Issues about wrong dates answered within 7 days.
- Every docs example runs without edits.

## 13. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Calendar sources disagree | Wrong dates in production | Golden tests, official source checks, honest accuracy flags |
| Dart and JS logic drift apart | Different answers on web and mobile | Shared data, shared test vectors, CI in both |
| Too many wrapper packages | High upkeep, slow delivery | Web components do the work. Wrappers stay thin and generated. Add only on demand |
| Web components and SSR | Broken first render in Next.js or Nuxt | Test SSR early. Provide SSR-safe loading guidance |
| Code lifted from other repos has unclear licences | Legal risk | Check every lifted file. Replace or credit where needed |
| Phone prefix list is not official | Wrong carrier shown | Keep in data package. Mark as best effort. Update fast |
| Devanagari PDF on servers | Broken joins in receipts | Rasteriser in P1. Until then, document the English-label option |
| Sandesh gateway is small and specific | Limited SMS reach | Keep `SmsGateway` as an interface. Add more gateways later |
| Scope is large | Slow delivery | Phase plan. Dart is already built. Port, do not redesign |
| Name or npm scope taken | Cannot publish | Reserve names in phase 0 |

## 14. Open questions

1. Do we merge the two source repos, or start a fresh repo and credit both?
2. Do we have permission from both authors to merge their work? Both are MIT, but credit and agreement matter.
3. Should the Dart date range stay at BS 1970 or match the JS start of 2000 for simplicity?
4. Should we add holidays and festivals later as an optional data pack?
5. Is a hosted API in scope, or only open-source packages?
6. For JS PDFs, do we use browser print, a server renderer, or both?
7. Which web frameworks do we cover first after React? Vue and Angular are the likely next two.
8. Do we ship a plain CSS theme file, a Tailwind preset, or both?

## 15. Out of scope for this document

- Detailed API signatures. These come in a technical design doc.
- Visual design for the widgets.
- Pricing or any paid tier.
