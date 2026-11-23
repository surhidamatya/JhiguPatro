# jhigu-patro-vue

Vue 3 components for the Jhigu Patro web components: BS date picker, date range
picker, calendar with events, address select, money input and phone input.

Not published yet. `jhigu-patro-utils-ts` is a **peer dependency** (install it next to this package, so the
app and the elements share one copy of the calendar state); in this repo it is linked from `../ts` for
development. Vue 3.3 and later.

```bash
npm install jhigu-patro-vue jhigu-patro-utils-ts vue
```

Built on the same framework-neutral core as `jhigu-patro-react`
(`ElementBinding` and the prop tables in `jhigu-patro-utils-ts`).

```vue
<script setup>
import { ref } from 'vue';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import { JhiguDatePicker, JhiguMoneyInput, JhiguPhoneInput } from 'jhigu-patro-vue';

// Once, at start-up: the calendar data (money and phone do not need it).
const cal = await (await fetch('/nepali_calendar_data.json')).json();
initializeCalendar(new InlineCalendarDataSource(cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));

const dob = ref('2082-05-12');
</script>

<template>
  <form>
    <JhiguDatePicker name="dob" language="ne" :value="dob" required @change="d => (dob = d.bs)" />
    <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" @change="d => console.log(d.paisa)" />
    <JhiguPhoneInput name="phone" label="Mobile" @change="d => console.log(d.e164)" />
  </form>
</template>
```

## Components

| Component | Element | Events (first argument is the event's `detail`) |
|---|---|---|
| `JhiguDatePicker` | `<jhigu-date-picker>` | `@change`, `@open`, `@close` |
| `JhiguDateRangePicker` | `<jhigu-date-range-picker>` | `@change`, `@open`, `@close` |
| `JhiguCalendar` | `<jhigu-calendar>` | `@select`, `@month-change` |
| `JhiguAddressSelect` | `<jhigu-address-select>` | `@change` |
| `JhiguMoneyInput` | `<jhigu-money-input>` | `@change` |
| `JhiguPhoneInput` | `<jhigu-phone-input>` | `@change` |

Props are the elements' attributes in camelCase (`weekStartsOn`, which a template can
also write `week-starts-on`; `valuePaisa`). The handler gets the event's `detail`, then
the DOM event. The calendar takes `events` (`{ '2082-06-03': ['Laxmi Puja'] }`) and
`panchang` (a `PanchangDataSource` with its years loaded, for the tithi under each day) as
properties: pass stable objects, and a new object to change it (mutating one in place is
not seen). `showAd` and `showWard` default to on (pass `:show-ad="false"` to turn them
off); the other booleans are on when present (`required`, `popup`, `devanagari`, ...).

`class`, `style` (CSS custom properties work, for theming:
`:style="{ '--jhigu-color-primary': '#b91c1c' }"`), `id`, `title`, `hidden`, `slot`,
`data-*` and `aria-*` go to the custom element itself, not to the wrapper (an `aria-label` on `JhiguMoneyInput` or `JhiguPhoneInput` names the inner input when there is no `label`). A template
ref is the component; `ref.value.element` is the custom element, so `.show()` and
`.hide()` work on a popup picker. The elements' CSS variables and `::part`s are documented in their
headers under `ts/src/elements/`.

## How it behaves

- **A prop is written to the element only when it changes.** A parent re-render does
  not reset a field the user has typed in or a date they picked. To change the field
  from the parent, change its prop; the element follows without firing `@change` for
  that change. (There is no `v-model`: use `:value` and `@change`.)
- **Boolean props that are not given stay unset.** Vue casts an absent Boolean prop to
  `false`, which would switch off the default-on `showAd` and `showWard`; these
  components declare their Boolean props with `default: undefined` to prevent that.
- **Form fields work.** The elements are form-associated, so `name` puts their value in
  a normal `<form>` and `FormData` (the date as `YYYY-MM-DD`, money as integer paisa,
  phone as E.164, the range as `name_start` and `name_end`).
- **Client only.** The element is created on mount, so server rendering gives the empty
  wrapper (`<div style="display: contents">`) and the field appears on hydration. In Nuxt this
  needs no `<ClientOnly>`.

## Checked and not checked

- 75 tests (`npm test`) with stub elements in jsdom: attribute kinds, writing only what
  changed, attributes set before connecting, events (including `month-change` reaching
  `onMonthChange`), the latest handler, the ref, class/style/id/data/aria going to the
  element (and changing after mount), the Boolean-casting trap, no Vue warnings for the
  prop types, object props unwrapped from Vue proxies, unmount, server render. The
  mapping against the real elements' observed attributes and events is checked once, in
  `ts/tests/elementBindings.test.ts`. Sixteen mutations were caught; five only after a
  test was added or changed, and one redundant mechanism (a `watchEffect` next to
  `onUpdated`) was removed.
- Seen in Chromium (Vue 3.5, Vite, a single-file component) with the real elements in
  `example/`: all six render, one element each, no console errors; real clicks reach the
  handlers; typing in the money and phone fields formats them and survives a parent
  re-render; a parent-driven date updates the picker; toggling `class` from the parent
  changes the element's class (not the wrapper's); switching `language` re-renders in
  Nepali with values kept; a themed `style` custom property changes the colour; the form
  submits `dob`, `stay_start`, `stay_end`, `amount` and `phone`.
- Seen in Nuxt 4.6.4 (Vue 3.5, Nitro server) in `example-nuxt/`: a page with all five kinds of
  field is server-rendered (the HTML has five empty wrappers and no custom elements). In Chromium,
  after hydration each element exists once, the date picker draws its 31 days, typing in the money
  field formats it, and the form gives `dob` and `amount` (paisa). The console has no errors and no
  hydration warnings, from the production build (`node .output/server/index.mjs`) and from
  `nuxt dev`. The calendar data is imported from `jhigu-patro-utils-ts/nepali_calendar_data.json`
  and initialised in the page's setup, so the same code runs on the server and in the browser.
- All 75 tests pass, and `tsc --noEmit` is clean, on Vue 3.3.13 and 3.4.38 as well as 3.5.46 (the
  peer range is `>=3.3`). The example apps were run on 3.5 only.
- **Not checked:** the example apps on Vue 3.3 and 3.4, other frameworks (Quasar, Astro),
  Vue 2, Safari, Firefox, touch and screen readers (the same limits as the web components
  themselves).
