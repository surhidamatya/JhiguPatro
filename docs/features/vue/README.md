# Vue components (`jhigu-patro-vue`)

Vue 3 components for the six Jhigu Patro web components: `JhiguDatePicker`, `JhiguDateRangePicker`, `JhiguCalendar`, `JhiguAddressSelect`, `JhiguMoneyInput` and `JhiguPhoneInput`. This guide covers setup, every component with its props and events, the rules the wrapper follows, recipes, server rendering with Nuxt, and what has and has not been checked. The package README is [vue/README.md](../../../vue/README.md). The elements themselves are described in the [web components guide](../web-components/README.md).

## Overview

Each component is a thin wrapper over one custom element. It renders one `<div style="display: contents">`. After mount, the shared `ElementBinding` core (`jhigu-patro-utils-ts/element-binding`) creates the element by hand with `document.createElement`, sets its attributes before it is connected (so it builds once), listens for its events, and appends it to the wrapper. The prop-to-attribute tables live in `jhigu-patro-utils-ts/element-bindings` (the `/element-bindings` entry point), shared with the React package, so the two wrappers cannot drift apart.

After mount, the component writes a prop to the element only when that prop changed. A parent re-render does not reset a field the user has typed in.

The package is Vue 3 only. It does no rendering of its own: the picker, the field and the shadow DOM all belong to the element.

## When to use it

- You build a Vue 3 app (Vite, Nuxt, or another Vue 3 setup) and want the BS date picker, range picker, calendar, address select, money field or phone field with Vue props and Vue events.
- You want the fields to be real form controls: the elements are form-associated, so `name` puts the value in a normal `<form>` and `FormData`.
- You do not use Vue: use the elements directly (see the [web components guide](../web-components/README.md)), or the [React guide](../react/README.md).
- You want your own markup instead of the shipped look: use the [headless widgets](../headless-widgets/README.md).

## Install and setup

The packages are not published. Install them from this repository by path or by tarball. `jhigu-patro-utils-ts` is a **peer dependency**: it must be installed next to `jhigu-patro-vue`, so the app and the elements share one copy of the calendar state. The peer ranges are `vue >=3.3` and `jhigu-patro-utils-ts >=1.0.0 <2`.

```bash
# build the library and the wrapper once
(cd ts && npm ci && npm run build)
(cd vue && npm ci && npm run build)

# in your project: by path ...
npm install /path/to/JhiguPatro/ts /path/to/JhiguPatro/vue vue

# ... or by tarball (run npm pack in ts/ and in vue/ first)
npm install /path/to/jhigu-patro-utils-ts-1.0.0.tgz /path/to/jhigu-patro-vue-0.1.0.tgz vue
```

Both ways are described in [Step 1 of the examples guide](../../../examples/README.md). When the packages are published, this becomes `npm install jhigu-patro-vue jhigu-patro-utils-ts vue`.

### Load the calendar data first

The date picker, range picker and calendar need the calendar data loaded once, before the first render that shows dates. Money and phone need no calendar data. The address select uses the address data that ships with its own entry point. If an element connects before the data is loaded, the date picker shows an error line instead of throwing (see the [web components guide](../web-components/README.md)).

In a Vite app, fetch the JSON from a static path and initialise before `createApp(...).mount(...)`. This is `vue/example/src/main.js`:

```ts
import { createApp } from 'vue';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import App from './App.vue';

const cal = await (await fetch('/nepali_calendar_data.json')).json();
initializeCalendar(new InlineCalendarDataSource(
  cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
));
createApp(App).mount('#app');
```

The file `nepali_calendar_data.json` is in `data/` (the source of truth) and ships inside `jhigu-patro-utils-ts`. The example serves a copy from its `public/` folder. See the [calendar data guide](../calendar-data/README.md).

In Nuxt there is no single entry file that runs before server and client, so the example imports the bundled JSON and initialises at the top of `<script setup>`. That code runs on the server during the render and again in the browser. This is `vue/example-nuxt/app/app.vue`:

```vue
<script setup lang="ts">
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import cal from 'jhigu-patro-utils-ts/nepali_calendar_data.json';
import { JhiguDatePicker } from 'jhigu-patro-vue';

initializeCalendar(new InlineCalendarDataSource(
  cal.years as unknown as Record<string, number[]>, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
));
</script>
```

In the Vite case `initializeCalendar` runs once at start-up. In the Nuxt example it runs in the page's setup, on the server and in the browser.

## Quick start

```vue
<script setup>
import { ref } from 'vue';
import { JhiguDatePicker, JhiguMoneyInput, JhiguPhoneInput } from 'jhigu-patro-vue';

const dob = ref('2082-05-12');
const paisa = ref(null);
const e164 = ref(null);
</script>

<template>
  <form>
    <JhiguDatePicker name="dob" language="ne" :value="dob" required @change="d => (dob = d.bs)" />
    <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" @change="d => (paisa = d.paisa)" />
    <JhiguPhoneInput name="phone" label="Mobile" @change="d => (e164 = d.e164)" />
  </form>
</template>
```

With this template the date picker element gets the attributes `value="2082-05-12"`, `language="ne"`, `name="dob"` and `required=""`. When the element fires `jhiguChange` with `bs: '2082-06-01'`, `dob` becomes `2082-06-01` and the element's `value` attribute is written with the same text. Setting `dob.value = '2082-07-02'` in the parent writes `value="2082-07-02"`. These values were seen in a run with stub elements.

## Component reference

All six components are exported from `jhigu-patro-vue`:

```ts
import {
  JhiguDatePicker, JhiguDateRangePicker, JhiguCalendar,
  JhiguAddressSelect, JhiguMoneyInput, JhiguPhoneInput,
} from 'jhigu-patro-vue';
```

How to read the tables:

- **Prop** is the name in the component. In a template a camelCase prop can also be written in kebab-case (`weekStartsOn` as `week-starts-on`).
- **Attribute** is what the wrapper writes on the element (the element's own attribute).
- **Default**: every prop is `undefined` in the wrapper, which means it is not written. The element's own default is in brackets.
- A **boolean** prop is written as a present, empty attribute when truthy and removed otherwise. A **show-*** prop (`showAd`, `showTithi`, `showWard`) is written only as the text `false` when it is exactly `false`, and removed otherwise. The elements default these to on.
- Dates are BS text `YYYY-MM-DD`. `language` is `'en'` or `'ne'`. `theme` is `'light'` or `'dark'`. `weekStartsOn` is a number from 0 (Sunday) to 6.

### JhiguDatePicker

Element: `<jhigu-date-picker>`. Props interface: `JhiguDatePickerProps`.

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `value` | `string` | not written | `value` |
| `min` | `string` | not written | `min` |
| `max` | `string` | not written | `max` |
| `language` | `'en' \| 'ne'` | not written (`en`) | `language` |
| `weekStartsOn` | `0..6` | not written (0) | `week-starts-on` |
| `showAd` | `boolean` | not written (on) | `show-ad` (`"false"` only) |
| `name` | `string` | not written | `name` |
| `disabled` | `boolean` | not written (off) | `disabled` |
| `required` | `boolean` | not written (off) | `required` |
| `popup` | `boolean` | not written (off) | `popup` |
| `theme` | `'light' \| 'dark'` | not written (follows the system) | `theme` |
| `today` | `string` | not written | `today` (a BS date treated as today, for tests) |

| Event | Detail type | Fires |
|---|---|---|
| `@change` | `JhiguChangeDetail`: `{ bs, ad, value }` | The value changed (`bs` and `ad` are `''` when cleared; `value` is a `NepaliDate` or null). |
| `@open` | `unknown` (the element sends no detail) | Popup mode: the popup opened. |
| `@close` | `unknown` | Popup mode: the popup closed. |

### JhiguDateRangePicker

Element: `<jhigu-date-range-picker>`. Props interface: `JhiguDateRangePickerProps`.

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `start` | `string` | not written | `start` |
| `end` | `string` | not written | `end` (needs a start) |
| `min`, `max` | `string` | not written | `min`, `max` |
| `language` | `'en' \| 'ne'` | not written | `language` |
| `weekStartsOn` | `0..6` | not written | `week-starts-on` |
| `showAd` | `boolean` | not written (on) | `show-ad` (`"false"` only) |
| `name` | `string` | not written | `name` |
| `disabled`, `required`, `popup` | `boolean` | not written (off) | `disabled`, `required`, `popup` |
| `theme` | `'light' \| 'dark'` | not written | `theme` |
| `today` | `string` | not written | `today` |

| Event | Detail type | Fires |
|---|---|---|
| `@change` | `JhiguRangeChangeDetail`: `{ start, end, startAd, endAd, complete, days }` | Start or end changed. `days` is inclusive and 0 until the range is complete. |
| `@open`, `@close` | `unknown` | Popup mode. |

### JhiguCalendar

Element: `<jhigu-calendar>`. Props interface: `JhiguCalendarProps`. A display and navigation widget, not a form field: no `name`, `required`, `disabled` or `popup`.

| Prop | Type | Default | Attribute or property |
|---|---|---|---|
| `year` | `number` | not written | `year` (with `month`: the month to show first; a later change moves the view) |
| `month` | `number` | not written | `month` |
| `language` | `'en' \| 'ne'` | not written | `language` |
| `weekStartsOn` | `0..6` | not written | `week-starts-on` |
| `showAd` | `boolean` | not written (on) | `show-ad` (`"false"` only) |
| `showTithi` | `boolean` | not written (on) | `show-tithi` (`"false"` only; has an effect only when `panchang` is set) |
| `theme` | `'light' \| 'dark'` | not written | `theme` |
| `today` | `string` | not written | `today` |
| `events` | `Record<string, string \| string[]>` | not written | **property** `events` (titles by BS date) |
| `panchang` | `TithiSource \| null` | not written | **property** `panchang` (a `PanchangDataSource` with its years loaded) |

`events` and `panchang` are element properties, not attributes. The element does not get an `events` or `panchang` attribute.

| Event | Detail type | Fires |
|---|---|---|
| `@select` | `JhiguSelectDetail`: `{ bs, ad, events, tithi? }` | The selected day changed. `tithi` is present only when a panchang is set and has one for the day. |
| `@month-change` | `JhiguMonthChangeDetail`: `{ year, month }` | The shown month changed (by keyboard, `goTo`, or the `year` and `month` props). |

The calendar has no `@change`, `@open` or `@close`.

### JhiguAddressSelect

Element: `<jhigu-address-select>`. Props interface: `JhiguAddressSelectProps`.

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `value` | `number` | not written | `value` (a local level id; its district and province are filled in) |
| `ward` | `number` | not written | `ward` (initial ward) |
| `language` | `'en' \| 'ne'` | not written | `language` |
| `showWard` | `boolean` | not written (on) | `show-ward` (`"false"` only) |
| `name` | `string` | not written | `name` |
| `required`, `disabled` | `boolean` | not written (off) | `required`, `disabled` |
| `theme` | `'light' \| 'dark'` | not written | `theme` |

| Event | Detail type | Fires |
|---|---|---|
| `@change` | `JhiguAddressChangeDetail`: `{ provinceId, districtId, localLevelId, ward, complete, selection, text }` | Any choice changed. `text` is the formatted address when complete, else `''`. |

Form data with `name="home"`: `home` is the local level id, plus `home_ward`, `home_district` and `home_province` when chosen. See the [address guide](../address/README.md).

### JhiguMoneyInput

Element: `<jhigu-money-input>`. Props interface: `JhiguMoneyInputProps`. Money is integer paisa, never a float.

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `valuePaisa` | `number` | not written | `value-paisa` (integer paisa) |
| `symbol` | `string` | not written | `symbol` (`Rs.` or `रु`, shown beside the field) |
| `devanagari` | `boolean` | not written (off) | `devanagari` |
| `allowNegative` | `boolean` | not written (off) | `allow-negative` |
| `name` | `string` | not written | `name` |
| `placeholder` | `string` | not written | `placeholder` |
| `label` | `string` | not written | `label` (the accessible name of the inner input) |
| `language` | `'en' \| 'ne'` | not written | `language` |
| `disabled`, `readonly`, `required` | `boolean` | not written (off) | `disabled`, `readonly`, `required` |
| `theme` | `'light' \| 'dark'` | not written | `theme` |

| Event | Detail type | Fires |
|---|---|---|
| `@change` | `JhiguMoneyChangeDetail`: `{ paisa, value, text }` | The amount changed. `paisa` is an integer or `null` when empty; `value` is an `Npr` or null; `text` is what the field shows. |

The form value is the integer paisa as text. See the [money guide](../money/README.md).

### JhiguPhoneInput

Element: `<jhigu-phone-input>`. Props interface: `JhiguPhoneInputProps`.

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `value` | `string` | not written | `value` (the text in the field) |
| `allowInactive` | `boolean` | not written (off) | `allow-inactive` |
| `name` | `string` | not written | `name` |
| `placeholder` | `string` | not written | `placeholder` |
| `label` | `string` | not written | `label` |
| `language` | `'en' \| 'ne'` | not written | `language` |
| `disabled`, `readonly`, `required` | `boolean` | not written (off) | `disabled`, `readonly`, `required` |
| `theme` | `'light' \| 'dark'` | not written | `theme` |

| Event | Detail type | Fires |
|---|---|---|
| `@change` | `JhiguPhoneChangeDetail`: `{ e164, national, valid, carrier, type, text }` | `e164`, `valid`, `carrier` or `type` changed (not on every keystroke). |

The form value is the E.164 number when valid. See the [phone guide](../phone/README.md).

### Exported types and helpers

From `vue/src/index.ts`:

- Props interfaces: `JhiguDatePickerProps`, `JhiguDateRangePickerProps`, `JhiguCalendarProps`, `JhiguAddressSelectProps`, `JhiguMoneyInputProps`, `JhiguPhoneInputProps`.
- Detail types: `JhiguChangeDetail`, `JhiguRangeChangeDetail`, `JhiguSelectDetail`, `JhiguMonthChangeDetail`, `JhiguAddressChangeDetail`, `JhiguMoneyChangeDetail`, `JhiguPhoneChangeDetail`, and `TithiSource` (the object `panchang` takes: anything with `sunriseTithi(year, month, day)`).
- Element classes as types: `DatePickerElement`, `RangePickerElement`, `CalendarElement`, `AddressElement`, `MoneyElement`, `PhoneElement`.
- Functions: `createJhiguComponent`, `vueEventName`, `hostProps`, `parseStyleText` (see [Custom wrapping](#custom-wrapping-with-wrapts)).

The component types carry `$props` (the props interface, the event handlers, and any other key) and `element`. A type check with `strict` on accepted this:

```ts
import { ref } from 'vue';
import { JhiguDatePicker } from 'jhigu-patro-vue';
import type { JhiguChangeDetail, JhiguDatePickerProps } from 'jhigu-patro-vue';

type Picker = InstanceType<typeof JhiguDatePicker>;
const picker = ref<Picker | null>(null);
picker.value?.element?.show();                       // element is typed as DatePickerElement | null
const props: JhiguDatePickerProps = { value: '2082-05-12', weekStartsOn: 1 };
function onChange(d: JhiguChangeDetail, e: CustomEvent<JhiguChangeDetail>) { return d.bs + e.type; }
```

## Behaviour rules

### Kebab-case and camelCase

A template can write a camelCase prop either way: `weekStartsOn` or `week-starts-on`, `valuePaisa` or `value-paisa`, `showAd` or `show-ad`. Use `:` binding for numbers and booleans:

```vue
<JhiguDatePicker :week-starts-on="1" :show-ad="false" popup required min="2080-01-01" />
<JhiguCalendar :year="2082" :month="5" />
```

Details seen in a run:

- A bare `popup` or `required` is `true`. The element gets `popup=""` and `required=""`.
- `:show-ad="false"` writes `show-ad="false"`. `:show-ad="true"` writes nothing, because the element defaults to on.
- `:popup="false"` and `:required="false"` write nothing.
- A literal string for a number prop (`week-starts-on="1"`, `year="2082"`) still writes the right attribute (`week-starts-on="1"`, `year="2082"`), but Vue logs a prop type warning in development: `Invalid prop: type check failed for prop "weekStartsOn". Expected Number`. Bind with `:` to avoid it.
- Boolean props that are not given stay unset. Vue normally turns an absent Boolean prop into `false`, which would switch off the default-on `showAd`, `showTithi` and `showWard`. The wrapper declares every prop with `default: undefined` to prevent that. With no props at all, the element has no attributes.

### Events

An element event becomes a Vue event. The handler receives the event's `detail` first and the DOM `CustomEvent` second:

```vue
<JhiguDatePicker popup @change="(d, e) => pick(d.bs, e.type)" @open="onOpen" @close="onClose" />
<JhiguCalendar @select="d => show(d.bs, d.events)" @month-change="d => load(d.year, d.month)" />
```

| Vue event | DOM event | Components |
|---|---|---|
| `@change` | `jhiguChange` | all except the calendar |
| `@open` | `jhiguOpen` | date picker, range picker |
| `@close` | `jhiguClose` | date picker, range picker |
| `@select` | `jhiguSelect` | calendar |
| `@month-change` | `jhiguMonthChange` | calendar |

The name is the callback prop minus `on`, in kebab-case (`onMonthChange` becomes `month-change`). A handler that is replaced by the parent is looked up again on every event, so the newest one runs and nothing is subscribed twice. An event with no handler does nothing. Listeners are removed on unmount.

### Host attributes

Fallthrough attributes go to the **custom element**, not to the wrapper `div` (the component sets `inheritAttrs: false`):

| Attribute | Where it goes |
|---|---|
| `class` (any Vue form: string, array, object) | the element's `class` |
| `style` (object, array or text; CSS custom properties work) | the element's inline style |
| `id`, `title`, `slot` | the same attribute on the element |
| `hidden` | the `hidden` attribute (a bare `hidden` is true; `false` removes it) |
| `data-*`, `aria-*` | the same attribute on the element |

Anything else (for example `onClick` or an unknown prop) is not forwarded. A run with `id`, `title`, `class`, `style`, `data-testid`, `aria-label`, `hidden` and `slot` on `JhiguMoneyInput` put all of them on `<jhigu-money-input>`, and the wrapper kept only `style="display: contents"`. Changing `class` or `style` from the parent later is applied too, and removing one removes it. An `aria-label` on the money or phone component names the inner input when there is no `label`; `label` wins.

```vue
<JhiguDatePicker
  class="brand"
  :style="{ '--jhigu-color-primary': '#047857', '--jhigu-radius': '2px' }"
  data-testid="dob"
  aria-label="Date of birth"
/>
```

### Template refs

A template ref is the **component**. Its only exposed member is `element`, the custom element (`null` before mount and after unmount):

```vue
<script setup>
import { ref } from 'vue';
import { JhiguDatePicker } from 'jhigu-patro-vue';
const picker = ref(null);
const openIt = () => picker.value.element.show();
</script>

<template>
  <JhiguDatePicker ref="picker" popup />
  <button type="button" @click="openIt">Choose a date</button>
</template>
```

`show()` and `hide()` exist on the date picker and range picker elements, and work in popup mode. The component itself has no `open()`, `show()` or `hide()` (the ref exposes `element` only). The other element methods (`setRange`, `clear`, `goTo`, `select`, `setAddress`, `focus`) are listed in the [web components guide](../web-components/README.md).

### v-model

The package does **not** support `v-model`. The components declare no `modelValue` prop and emit no `update:*` event. Use `:value` and `@change`.

What the code does with each form, seen in a run:

- `v-model="dob"`: nothing happens. No attribute is written, no warning is logged, and `dob` is never updated.
- `v-model:value="dob"`: the initial value is written as `value="2082-05-12"` (it is a normal prop), but the element's change never updates `dob`, because no `update:value` event is emitted.

The pattern that works:

```vue
<script setup>
import { ref } from 'vue';
const dob = ref('2082-05-12');
</script>

<template>
  <JhiguDatePicker :value="dob" @change="d => (dob = d.bs)" />
</template>
```

Money and phone work the same way: `@change="d => (paisa = d.paisa)"`, and pass `:value-paisa="paisa"` only if the parent also sets the amount.

### One-way writes: the parent changes a prop, the element follows

- The element's own changes (the user picks a date, types an amount) do not go back to the parent unless a handler copies them.
- A prop change from the parent writes the attribute, and the element follows **without firing `@change`** for that change (stated in the package README).
- The wrapper compares each prop with what it wrote last, not with what the element shows. So if the user picked `2082-06-01` while the prop stayed `2082-05-12`, setting the prop to `2082-05-12` again writes nothing and the element keeps `2082-06-01`. Setting it to `2082-05-13` writes the new value. Keep the prop in step with `@change` so these two stay equal.

### Object props must be stable

`events` and `panchang` are assigned to the element as properties. The component assigns again only when the prop is a **different object**. Changing an object in place is not seen:

```vue
<script setup>
import { ref } from 'vue';
const events = ref({ '2082-06-03': ['Office closed'] });

function addEvent() {
  // A new object: the calendar is updated.
  events.value = { ...events.value, '2082-06-04': ['Training'] };
}
function brokenAddEvent() {
  // In place: the calendar is NOT updated (seen in a run: no property write).
  events.value['2082-06-05'] = ['Inspection'];
}
</script>

<template>
  <JhiguCalendar :events="events" />
</template>
```

If you pass a Vue `ref` or `reactive` object, the component unwraps the proxy with `toRaw` and hands the element the plain object. A `ref(panchangSource)` and a `shallowRef(panchangSource)` both gave the element the original `PanchangDataSource` object (`element.panchang === source`). For a class instance such as `PanchangDataSource`, `shallowRef` or `markRaw` avoids a deep proxy and is the simpler choice.

Defining the events object inline in the template (`:events="{ ... }"`) makes a new object on every render, so the element's property is written on every parent render. Declare it once in `<script setup>`.

### Forms and FormData

The five field elements are form-associated, so with a `name` they take part in a normal `<form>`:

| Component | Posts |
|---|---|
| `JhiguDatePicker` `name="dob"` | `dob=2082-05-12` (BS text) |
| `JhiguDateRangePicker` `name="stay"` | `stay_start` and `stay_end` (when the range is complete) |
| `JhiguAddressSelect` `name="home"` | `home`, `home_ward`, `home_district`, `home_province` |
| `JhiguMoneyInput` `name="amount"` | `amount=123450` (integer paisa) |
| `JhiguPhoneInput` `name="phone"` | `phone=+9779841234567` (E.164, only when valid) |

`JhiguCalendar` is not a form field. `required`, reset and validity work as in the elements. In the Vue example (Chromium, Vue 3.5) the form gave `dob`, `stay_start`, `stay_end`, `amount` and `phone`; in the Nuxt example it gave `dob` and `amount` in paisa. Reading it:

```vue
<script setup>
function submit(e) {
  const data = Object.fromEntries(new FormData(e.currentTarget));
  console.log(data);
}
</script>

<template>
  <form @submit.prevent="submit">
    <JhiguDatePicker name="dob" required />
    <JhiguMoneyInput name="amount" label="Amount" />
    <button type="submit">Save</button>
  </form>
</template>
```

### Theming

Set CSS custom properties on the component with `style` (they go to the element), or with a `class` and a stylesheet rule:

```vue
<JhiguDateRangePicker :style="{ '--jhigu-color-primary': '#047857' }" />
<JhiguDatePicker theme="dark" />
```

```css
jhigu-date-picker.brand { --jhigu-color-primary: #b91c1c; --jhigu-radius: 4px; }
jhigu-date-picker.brand::part(selected) { font-weight: 700; }
```

The `theme` prop is `light` or `dark`; without it the element follows the system. The variables (`--jhigu-color-primary`, `-on-primary`, `-surface`, `-text`, `-muted`, `-holiday`, `-today`, `--jhigu-radius`, `--jhigu-font-family`, `--jhigu-font-size`) and the `::part` names are in the element headers under `ts/src/elements/` and in the theming section of the [web components guide](../web-components/README.md). Setting `--jhigu-color-primary` through a `style` object was seen to take effect in Chromium (example app).

### Language

`language` is `'en'` or `'ne'` on every component. Changing it re-renders the element in the other language and keeps its values (seen in Chromium in the example app). All six elements took `language="ne"` from one shared `ref` in a run with stub elements. Messages come from the string tables, so there are no labels to hard-code. The Nepali strings are unreviewed by a native speaker (see the [web components guide](../web-components/README.md)).

## Custom wrapping with `wrap.ts`

`createJhiguComponent(name, tag, define, spec)` is the function that builds each component. It is exported, so you can wrap another custom element the same way. `spec` is an `ElementSpec`: the `attrs` (prop name to `{ attr, kind, type }`), the object `properties`, and the `events` (callback prop name to DOM event name).

```ts
import { createJhiguComponent } from 'jhigu-patro-vue';

export const XRating = createJhiguComponent('XRating', 'x-rating', () => defineXRating(), {
  attrs: {
    value: { attr: 'value', kind: 'string', type: 'number' },
    readOnly: { attr: 'read-only', kind: 'boolean', type: 'boolean' },
  },
  properties: ['labels'],
  events: { onRate: 'ratingRate', onClearAll: 'ratingClearAll' },
});
```

```vue
<XRating :value="3" read-only :labels="labels" @rate="(d, e) => save(d, e.type)" @clear-all="reset" class="r" />
```

A run with this spec on a plain `x-rating` element gave the attributes `value="3"`, `read-only=""` and `class="r"`, set `element.labels` to the array, and called `@rate` with `({ n: 4 }, 'ratingRate')` and `@clear-all` with its event. The component had `name` `XRating`, `emits` `["rate","clear-all"]` and props `value`, `readOnly`, `labels`. `define` is called once, only when `customElements` exists. `defineXRating` above stands for your own registration function.

Kinds: `string` writes `String(value)`; `boolean` writes a present empty attribute when truthy; `falseOnly` writes the text `false` only when exactly `false`. `type` is the Vue prop type (`string`, `number`, `boolean`, `object`; default `string`).

The other exports are the pieces the component uses:

| Function | Result (seen in a run) |
|---|---|
| `vueEventName('onClearAll')` | `clear-all` |
| `parseStyleText('color: red; --x: 1')` | `{ color: 'red', '--x': '1' }` |
| `hostProps({ class: ['a', { b: true }], style: 'color: red', hidden: '', 'data-x': 1, foo: 2 })` | `{ className: 'a b', style: { color: 'red' }, hidden: true, 'data-x': 1 }` |

## Recipes

### Booking form

A date of birth, a stay range, an address, an amount in paisa and a phone number. Each field keeps its own state; the form posts the same values by `name`.

```vue
<script setup>
import { ref } from 'vue';
import {
  JhiguDatePicker, JhiguDateRangePicker, JhiguAddressSelect, JhiguMoneyInput, JhiguPhoneInput,
} from 'jhigu-patro-vue';

const dob = ref('');
const stay = ref({ start: '', end: '', days: 0 });
const address = ref('');
const paisa = ref(null);
const e164 = ref(null);

function submit(e) {
  console.log(Object.fromEntries(new FormData(e.currentTarget)));
  console.log({ dob: dob.value, stay: stay.value, address: address.value, paisa: paisa.value, e164: e164.value });
}
</script>

<template>
  <form @submit.prevent="submit">
    <JhiguDatePicker name="dob" :value="dob" required @change="d => (dob = d.bs)" />
    <JhiguDateRangePicker name="stay" popup @change="d => (stay = { start: d.start, end: d.end, days: d.days })" />
    <JhiguAddressSelect name="home" required @change="d => (address = d.complete ? d.text : '')" />
    <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" @change="d => (paisa = d.paisa)" />
    <JhiguPhoneInput name="phone" label="Mobile" @change="d => (e164 = d.e164)" />
    <button type="submit">Book</button>
  </form>
</template>
```

In a run with stub elements, firing the five `jhiguChange` events (date `2082-05-12`; range `2082-05-10` to `2082-05-15`, 6 days; paisa `123450`; E.164 `+9779841234567`) left `dob` at `2082-05-12`, `stay` at `{ start: '2082-05-10', end: '2082-05-15', days: 6 }`, `paisa` at `123450` and `e164` at `+9779841234567`. Store the paisa as an integer. Do not divide it into rupees as a float.

### Calendar with events and tithi

Load the panchang once, then give the calendar a stable object. The tithi data covers BS 2081 and 2082 only; see the [tithi guide](../tithi/README.md).

```vue
<script setup>
import { onMounted, shallowRef } from 'vue';
import { PanchangDataSource } from 'jhigu-patro-utils-ts';
import { JhiguCalendar } from 'jhigu-patro-vue';

const panchang = shallowRef(null);
const events = { '2082-06-03': ['Office closed'], '2082-06-10': ['Training', 'Review'] };

onMounted(async () => {
  const source = new PanchangDataSource();
  await source.load('/2082_tithi.json');   // load first, then assign
  panchang.value = source;
});
</script>

<template>
  <JhiguCalendar
    language="ne" :year="2082" :month="6" :events="events" :panchang="panchang"
    @select="d => console.log(d.bs, d.events, d.tithi)"
    @month-change="d => console.log(d.year, d.month)"
  />
</template>
```

Before `panchang` is set the calendar shows no tithi. `:show-tithi="false"` hides it again while the source stays set. With the repo data loaded through `addYear`, `sunriseTithi(2082, 6, 3)` returned `tithiNumber` 13, `tithiName` `त्रयोदशी`, `paksha` `कृष्ण`. The tithi names are Nepali whatever `language` is. The calendar does not read the built-in holiday data: events come only from `events`.

`source.load` calls `fetch`, so the JSON must be served. For a bundled import, use `addYear(JSON.parse(...))` with the data from `jhigu-patro-utils-ts/2082_tithi.json`.

### Nepali switch

One `ref` drives every field:

```vue
<script setup>
import { ref } from 'vue';
const lang = ref('en');
</script>

<template>
  <button type="button" @click="lang = lang === 'en' ? 'ne' : 'en'">{{ lang }}</button>
  <JhiguDatePicker :language="lang" />
  <JhiguMoneyInput :language="lang" label="Amount" />
  <JhiguPhoneInput :language="lang" label="Mobile" />
</template>
```

Values are kept when the language changes. A `label` you pass is your own text: it is not translated. Pass a translated label yourself.

### Testing a component that uses the fields

The tests in `vue/tests` do not use `@vue/test-utils`. They use `createApp` and `h`, and replace the element definitions with stubs. jsdom has no `ElementInternals`, so the real elements do not run there. Register a stub under the real tag name with `vi.mock`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';

vi.mock('jhigu-patro-utils-ts/date-picker-element', async importOriginal => ({
  ...(await importOriginal<object>()),
  defineJhiguDatePicker: () => {
    if (!customElements.get('jhigu-date-picker')) customElements.define('jhigu-date-picker', class extends HTMLElement {});
  },
}));

import { JhiguDatePicker } from 'jhigu-patro-vue';

describe('date field', () => {
  it('writes the value and turns jhiguChange into @change', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onChange = vi.fn();
    const state = reactive({ value: '2082-05-12' });
    const app = createApp({ render: () => h(JhiguDatePicker as never, { value: state.value, onChange }) });
    app.mount(container);

    const el = container.querySelector('jhigu-date-picker')!;
    expect(el.getAttribute('value')).toBe('2082-05-12');

    el.dispatchEvent(new CustomEvent('jhiguChange', { detail: { bs: '2082-06-01' }, bubbles: true, composed: true }));
    expect(onChange.mock.calls[0][0]).toEqual({ bs: '2082-06-01' });

    state.value = '2082-07-02';
    await nextTick();
    expect(el.getAttribute('value')).toBe('2082-07-02');
    app.unmount();
  });
});
```

Use a Vitest `jsdom` environment (`environment: 'jsdom'` as in `vue/vitest.config.ts`). In a test, `vi.mock` must target the same entry point the component imports (the table in the [web components guide](../web-components/README.md) lists them). A real browser test is needed to check the real element (see [How it is tested](#how-it-is-tested)). `@vue/test-utils` is not a dependency and was not run in this repo, so this guide does not claim it works.

## Nuxt and server rendering

The element is created on mount, in the browser. On the server the component renders only its wrapper:

```text
<div style="display:contents;"></div>
```

(Seen from `renderToString` for `JhiguMoneyInput`, and for a `form` holding a date picker and a phone input: two empty wrappers inside the form.) The field appears on hydration. The wrapper is the same on server and client, so there is no hydration mismatch, and no `<ClientOnly>` is needed. The wrapper has `display: contents`, so it adds no box of its own. The component calls `define()` only when `customElements` exists, so importing it on the server is safe.

Run in this repo (`node tools/ssr-check/check.mjs --only nuxt`, Nuxt 4.6.4, Vue 3.5): the app builds; the server HTML has five empty wrappers and no custom element; after hydration each of the five elements exists once; the date picker draws its 31 days; typing in the money field formats it; the form gives `dob` and `amount` in paisa; there is no console error or warning and no page error. All seven checks printed `ok`. The package README reports the same from `nuxt dev` and from the production build.

What `vue/example-nuxt` does, and so what is verified:

- It imports the components from `jhigu-patro-vue` explicitly in `<script setup>`.
- It initialises the calendar from the bundled JSON at the top of `<script setup>`.
- `nuxt.config.ts` has no module, plugin or auto-import setting for the package.

A Nuxt module, a plugin, or components auto-import for `jhigu-patro-vue` is not provided and was not tried. [SOURCE NEEDED] if you want auto-import. The example (a linked install in this monorepo) is also the only setup run: other Nuxt versions and a published install are not covered.

## Accessibility

Accessibility comes from the elements: native inputs and selects, `role="dialog"` on the popup, an alert line for errors, and the keyboard map described in the [web components guide](../web-components/README.md). What the Vue layer adds:

- Pass `label` on `JhiguMoneyInput` and `JhiguPhoneInput`. It names the inner input. Without it, an `aria-label` on the component is used. With neither, the field has no accessible name.
- `aria-*` and `data-*` go to the element, so `aria-label`, `aria-describedby` and similar work on the component.
- `required` and `disabled` are forwarded as attributes. The elements set validity and form state.

Screen readers, touch, Safari and Firefox are not verified (same limit as the elements).

## Known gaps and not verified

Verified by running:

- `cd vue && npm ci && npm run build && npm test` on Vue 3.5.46: build clean, 75 tests passed in 2 files (`components.test.ts`, `wrap.test.ts`).
- `node tools/ssr-check/check.mjs --only nuxt`: all checks passed (Chromium, Nuxt 4.6.4).
- Every sample behaviour quoted above that says "seen in a run" came from a scratch test with stub elements (deleted after), in jsdom, on Vue 3.5.46.

From the package README and CI, not re-run for this guide:

- Seen in Chromium with the real elements in `vue/example` (Vue 3.5, Vite): all six render, one element each, real clicks reach the handlers, typing in money and phone formats them and survives a parent re-render, a parent-driven date updates the picker, a class toggle changes the element's class, switching `language` re-renders in Nepali with values kept, a custom property changes the colour, the form submits its fields.
- The tests and type check pass on Vue 3.3.13 and 3.4.38 (CI matrix `vue-versions`).

Not verified:

- The example apps on Vue 3.3 and 3.4. Only the tests and the type check run there. Vue 3.5 is the only version the example apps were run on.
- Vue 2: not supported. The package uses Vue 3 APIs.
- React Native and any non-web target: not supported. The elements are web components.
- Other frameworks and setups: Quasar, Astro, Vite SSR without Nuxt.
- Safari, Firefox, touch, and screen readers. Only Chromium was used.
- `@vue/test-utils`, as noted in the testing recipe.
- Vue plugin and auto-import for Nuxt (see above).
- The real elements in jsdom: not possible, since jsdom lacks `ElementInternals`. The jsdom tests use stubs; the match to the real elements is checked once in `ts/tests/elementBindings.test.ts`.

Behaviour to keep in mind:

- No `v-model`.
- A literal string given to a number prop logs a Vue warning in development (the attribute is still right). Bind with `:`.
- In-place changes to `events` or `panchang` are not seen.
- A parent cannot force the element back to a value it already wrote (see [One-way writes](#one-way-writes-the-parent-changes-a-prop-the-element-follows)).
- Client only: the field is absent from server HTML.
- The tithi data covers BS 2081 and 2082 only.

## How it is tested

- **`vue/tests/components.test.ts`** (45 tests). For each of the six components: the right tag and name from the shared table, every prop written as the right attribute, no attributes when no props are given, a prop change writes just that attribute, each event handler is called for its own DOM event with the detail, the events the component emits match the shared table, and the ref exposes the element. Also: number props, and the calendar's `events` and `panchang` as properties.
- **`vue/tests/wrap.test.ts`** (30 tests). The helpers (`vueEventName`, `parseStyleText`, `hostProps`), element creation (one wrapper, attributes set before connecting, the Boolean-casting trap, no Vue warnings), updates (only what changed, the same element stays, removal), events (detail first and DOM event second, the latest handler, no re-subscribe, unmount), the ref, fallthrough attributes (including after mount), lifecycle, and the server render (the empty wrapper).
- **The shared mapping** is checked against the real elements' observed attributes and events once, in `ts/tests/elementBindings.test.ts`.
- **Examples.** `vue/example` (Vite) and `vue/example-nuxt` (Nuxt), run in Chromium by hand. See the [examples guide](../../../examples/README.md).
- **`tools/ssr-check`** builds `vue/example-nuxt` (and the Next example) and checks server HTML and hydration in Chromium. It runs in CI as the `examples` job.
- **CI `vue-versions`** (`.github/workflows/ci-js.yml`): on Vue 3.3.13 and 3.4.38 it installs the package, runs `npx tsc --noEmit -p .` and `npm test`.

Commands:

```bash
cd vue && npm ci && npm run build && npm test
(cd vue/example-nuxt && npm ci) && node tools/ssr-check/check.mjs --only nuxt
```

## Related guides

- [Web components](../web-components/README.md): the six elements, their attributes, events, parts and CSS variables.
- [Tithi](../tithi/README.md): the panchang data and `PanchangDataSource`.
- [Calendar data](../calendar-data/README.md): loading the data the pickers need.
- [Headless widgets](../headless-widgets/README.md): the state machines under the elements.
- [Money](../money/README.md), [Phone](../phone/README.md), [Address](../address/README.md), [Dates](../dates/README.md): the logic behind each field.
- [React](../react/README.md): the same wrappers for React.
- [vue/README.md](../../../vue/README.md): the package README.
- [Examples and integration guide](../../../examples/README.md): installing the packages and running the examples.
