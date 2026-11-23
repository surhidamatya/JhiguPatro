# React components

`jhigu-patro-react` gives React six components for the Jhigu Patro web components: `JhiguDatePicker`, `JhiguDateRangePicker`, `JhiguCalendar`, `JhiguAddressSelect`, `JhiguMoneyInput` and `JhiguPhoneInput`. This guide covers setup, every prop, the behaviour rules, recipes and what was and was not checked. The package README is [react/README.md](../../../react/README.md).

## Overview

The components are thin wrappers over the elements described in the [web components guide](../web-components/README.md). They hold no calendar, money or phone logic of their own.

- Each component renders one `<div style="display: contents">`. In a layout effect it creates the custom element by hand (`document.createElement`), sets its attributes before it is connected, and appends it to that div. React never renders the element itself.
- The hand-made element avoids a React 18 versus 19 difference (per `react/src/wrap.ts`): the two versions treat props on custom elements differently, one writing attributes and the other properties, and React 18 does not apply `className` at all. Nothing in the wrapper depends on the React version.
- The mapping from props to attributes, properties and events is not in this package. It is the shared `ElementBinding` in `jhigu-patro-utils-ts/element-binding` and the prop tables in `jhigu-patro-utils-ts/element-bindings`. The Vue package uses the same two modules, so the frameworks cannot drift apart.
- A prop is written to the element only when it changed since the last write. This is why a parent rerender cannot reset a date the user picked or an amount the user typed.
- Callbacks are looked up on every event, so a new function on each render does not re-subscribe.

## When to use it

- You build a React 18 or 19 app (Vite, or the Next.js App Router) and want BS date, range, calendar, address, money or phone fields that post in a normal `<form>`.
- You want typed props and typed event details instead of `addEventListener` calls.
- Not for you: your own markup (use the [headless widgets](../headless-widgets/README.md)), React Native (not supported), or server-rendered fields (the elements exist only in the browser).

## Install and setup

The package is not published. Install it from a path or a tarball (`npm pack` in `react/` after `npm run build`). `jhigu-patro-utils-ts` is a **peer dependency** (`>=1.0.0 <2`), as is `react` (`>=18`). Install the three side by side so that the app and the elements import one copy of `jhigu-patro-utils-ts`. The calendar state set by `initializeCalendar` lives in that copy; a second copy would have no calendar data.

```bash
# from the app, with both packages built in the repo checkout
npm install ../JhiguPatro/ts ../JhiguPatro/react react react-dom
```

In this repo `react/package.json` links `jhigu-patro-utils-ts` from `../ts` as a dev dependency.

### Load the calendar data before the first render

The date picker, range picker and calendar need the calendar data. Address, money and phone do not. Call `initializeCalendar` once, before any component that needs it is rendered. Loading is covered in the [calendar data guide](../calendar-data/README.md).

Vite (a top-level `await` in the entry file, as in `react/example/src/main.jsx`; the JSON is in `public/`):

```jsx
import { createRoot } from 'react-dom/client';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import App from './App';

const cal = await (await fetch('/nepali_calendar_data.json')).json();
initializeCalendar(new InlineCalendarDataSource(
  cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
));

createRoot(document.getElementById('root')).render(<App />);
```

Next.js (a bundled JSON import at module level of a `'use client'` file, as in `react/example-next/app/form.tsx`; the same code runs on the server and in the browser, so no `fetch` is needed):

```tsx
'use client';

import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import cal from 'jhigu-patro-utils-ts/nepali_calendar_data.json';

initializeCalendar(new InlineCalendarDataSource(
  cal.years as unknown as Record<string, number[]>, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
));
```

If an element connects before the calendar is initialised, the date picker shows an error line instead of throwing (see the web components guide).

## Quick start

```tsx
import { useState } from 'react';
import { JhiguDatePicker, JhiguMoneyInput, JhiguPhoneInput } from 'jhigu-patro-react';

export function Form() {
  const [dob, setDob] = useState('2082-05-12');
  return (
    <form>
      <JhiguDatePicker name="dob" language="ne" value={dob} required onChange={d => setDob(d.bs)} />
      <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" onChange={d => console.log(d.paisa)} />
      <JhiguPhoneInput name="phone" label="Mobile" onChange={d => console.log(d.e164)} />
    </form>
  );
}
```

Each callback gets the event's `detail` first and the DOM event second.

## Component reference

Prop names are the element's attributes in camelCase (`week-starts-on` is `weekStartsOn`, `value-paisa` is `valuePaisa`). How a prop becomes an attribute depends on its kind:

| Kind | Rule | Used by |
|---|---|---|
| string | `String(value)`. Removed when `undefined` or `null`. `0` and `''` are written. | text and number props |
| boolean | Present (empty) for any truthy value. Removed for `false`, `0`, `''`, `undefined`, `null`. | `disabled`, `required`, `popup`, `readonly`, `devanagari`, `allowNegative`, `allowInactive` |
| falseOnly | The text `"false"` only for exactly `false`. Removed otherwise. | `showAd`, `showTithi`, `showWard` (default on) |
| property | Assigned to the element as a property, again only when the object changes. | `events`, `panchang` |

Types shared by the tables: `Language` is `'en' | 'ne'`, `Theme` is `'light' | 'dark'` (with no `theme` the element follows the system), `Weekday` is `0` to `6` (0 is Sunday). `Handler<D>` is `(detail: D, event: CustomEvent<D>) => void`.

### `JhiguDatePicker` (`<jhigu-date-picker>`)

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `value` | `string` (BS `YYYY-MM-DD`) | none | `value` |
| `min`, `max` | `string` (BS) | none | `min`, `max` |
| `language` | `Language` | element default (`en`) | `language` |
| `weekStartsOn` | `Weekday` | element default | `week-starts-on` |
| `showAd` | `boolean` | on | `show-ad` (falseOnly) |
| `name` | `string` | none | `name` |
| `disabled`, `required` | `boolean` | off | `disabled`, `required` |
| `popup` | `boolean` | off (inline) | `popup` |
| `theme` | `Theme` | follows system | `theme` |
| `today` | `string` (BS) | none (the real today) | `today` (for tests and previews) |

| Callback | Detail type | When |
|---|---|---|
| `onChange` | `JhiguChangeDetail`: `{ bs: string; ad: string; value: NepaliDate \| null }` | The date changes. `bs` and `ad` are `''` when cleared. |
| `onOpen`, `onClose` | `unknown` | Popup mode only. |

### `JhiguDateRangePicker` (`<jhigu-date-range-picker>`)

Props: `start`, `end` (BS strings; an end needs a start), `min`, `max`, `language`, `weekStartsOn`, `showAd`, `name`, `disabled`, `required`, `popup`, `theme`, `today`. Types, defaults and attributes are as for the date picker; `start` and `end` map to the attributes of the same name.

| Callback | Detail type |
|---|---|
| `onChange` | `JhiguRangeChangeDetail`: `{ start; end; startAd; endAd: string; complete: boolean; days: number }`. `days` is inclusive and `0` until complete. Fires whenever start or end changes. |
| `onOpen`, `onClose` | `unknown` (popup mode). |

### `JhiguCalendar` (`<jhigu-calendar>`)

A display and navigation widget, not a form field: it has no `name`, `required`, `disabled` or `popup`.

| Prop | Type | Default | Attribute or property |
|---|---|---|---|
| `year`, `month` | `number` | none (element default) | `year`, `month` (give both; a later change moves the view) |
| `language` | `Language` | `en` | `language` |
| `weekStartsOn` | `Weekday` | element default | `week-starts-on` |
| `showAd` | `boolean` | on | `show-ad` (falseOnly) |
| `showTithi` | `boolean` | on | `show-tithi` (falseOnly). Has an effect only when `panchang` is set. |
| `panchang` | `TithiSource \| null` | none | property `panchang` |
| `events` | `Record<string, string \| string[]>` | none | property `events` |
| `theme` | `Theme` | follows system | `theme` |
| `today` | `string` (BS) | none (the real today) | `today` |

`events` maps a BS date to a title or a list of titles: `{ '2082-06-03': ['Laxmi Puja'] }`. It is assigned as a property, never written as the `marked` attribute. `panchang` is a `PanchangDataSource` with its years loaded (or anything with `sunriseTithi(year, month, day)`); load before you pass it. The tithi display is described in the [tithi guide](../tithi/README.md). Pass both as stable objects (see [Stable object props](#stable-object-props)).

| Callback | Detail type |
|---|---|
| `onSelect` | `JhiguSelectDetail`: `{ bs: string; ad: string; events: string[]; tithi?: string }`. `tithi` is present only when a panchang is set and has one for the day. |
| `onMonthChange` | `JhiguMonthChangeDetail`: `{ year: number; month: number }`. Also fires for a change from the `year` and `month` props. |

### `JhiguAddressSelect` (`<jhigu-address-select>`)

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `value` | `number` (local level id; fills its district and province) | none | `value` |
| `ward` | `number` | none | `ward` |
| `language` | `Language` | `en` | `language` |
| `showWard` | `boolean` | on | `show-ward` (falseOnly) |
| `name` | `string` | none | `name` |
| `required`, `disabled` | `boolean` | off | `required`, `disabled` |
| `theme` | `Theme` | follows system | `theme` |

`onChange` gets `JhiguAddressChangeDetail`: `{ provinceId; districtId; localLevelId; ward: number | null; complete: boolean; selection: AddressSelection | null; text: string }`. `text` is the formatted address when complete, else `''`. It fires when any choice changes. The address data comes with the element's entry point; see the [address guide](../address/README.md).

### `JhiguMoneyInput` (`<jhigu-money-input>`)

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `valuePaisa` | `number` (integer paisa, never a float of rupees) | none | `value-paisa` |
| `symbol` | `string` (`Rs.` or `रु`) | none | `symbol` |
| `devanagari` | `boolean` | off | `devanagari` |
| `allowNegative` | `boolean` | off | `allow-negative` |
| `name`, `placeholder` | `string` | none | `name`, `placeholder` |
| `label` | `string` (accessible name) | none | `label` |
| `language` | `Language` | `en` | `language` |
| `disabled`, `readonly`, `required` | `boolean` | off | same names |
| `theme` | `Theme` | follows system | `theme` |

`onChange` gets `JhiguMoneyChangeDetail`: `{ paisa: number | null; value: Npr | null; text: string }`. `paisa` is `null` when empty; `text` is what is shown in the field. See the [money guide](../money/README.md).

### `JhiguPhoneInput` (`<jhigu-phone-input>`)

| Prop | Type | Default | Attribute |
|---|---|---|---|
| `value` | `string` (the text in the field) | none | `value` |
| `allowInactive` | `boolean` | off | `allow-inactive` |
| `name`, `placeholder`, `label` | `string` | none | same names |
| `language` | `Language` | `en` | `language` |
| `disabled`, `readonly`, `required` | `boolean` | off | same names |
| `theme` | `Theme` | follows system | `theme` |

`onChange` gets `JhiguPhoneChangeDetail`: `{ e164: string | null; national: string | null; valid: boolean; carrier: string | null; type: 'mobile' | 'landline' | null; text: string }`. See the [phone guide](../phone/README.md).

### Host props (every component)

| Prop | Effect |
|---|---|
| `className` | Written as the element's `class` attribute. Works on React 18 too. |
| `style` | An object. Normal keys are set on `element.style`; a number gets `px` unless the key is `opacity`, `zIndex`, `flex`, `flexGrow`, `flexShrink`, `order`, `lineHeight` or `fontWeight`. Keys that start with `--` are set as custom properties. A key removed from the object is removed from the element. |
| `id`, `title`, `slot` | Written as attributes; removed when `undefined`. |
| `hidden` | The `hidden` attribute, present only for exactly `true`. |
| `data-*`, `aria-*` | Written as attributes (`false`, `null` and `undefined` remove them; other values go through `String`). Removed when the key leaves the props. |

An `aria-label` on `JhiguMoneyInput` or `JhiguPhoneInput` names the inner input when there is no `label`. Any other prop is ignored, not forwarded.

### Exported types

From `react/src/index.ts`:

- Components: `JhiguDatePicker`, `JhiguDateRangePicker`, `JhiguCalendar`, `JhiguAddressSelect`, `JhiguMoneyInput`, `JhiguPhoneInput`, and `createJhiguComponent`.
- Props: `JhiguDatePickerProps`, `JhiguDateRangePickerProps`, `JhiguCalendarProps`, `JhiguAddressSelectProps`, `JhiguMoneyInputProps`, `JhiguPhoneInputProps`, `HostProps`.
- Detail types: `JhiguChangeDetail`, `JhiguRangeChangeDetail`, `JhiguSelectDetail`, `JhiguMonthChangeDetail`, `JhiguAddressChangeDetail`, `JhiguMoneyChangeDetail`, `JhiguPhoneChangeDetail`, and `TithiSource`.
- Element classes, for typing refs: `DatePickerElement`, `RangePickerElement`, `CalendarElement`, `AddressElement`, `MoneyElement`, `PhoneElement`.
- Binding types: `AttrKind`, `AttrSpec`, `ComponentSpec`.

## Behaviour rules

### Refs

The `ref` is the custom element, set after mount and `null` after unmount. A function ref and an object ref both work. The popup pickers have `show()` and `hide()`, not `open()`:

```tsx
import { useRef } from 'react';
import { JhiguDatePicker } from 'jhigu-patro-react';
import type { DatePickerElement } from 'jhigu-patro-react';

export function Picker() {
  const ref = useRef<DatePickerElement>(null);
  return (
    <>
      <JhiguDatePicker ref={ref} popup name="dob" />
      <button type="button" onClick={() => ref.current?.show()}>Choose a date</button>
    </>
  );
}
```

The `ref` sample above and the `className`, `id`, `title`, `hidden`, `slot`, `data-*`, `aria-label` and `style` host props were run with stub elements (`show()` reached the stub; each host prop appeared as the attribute described). The calendar has `goTo(year, month)` and `select(bs)` (both throw `JhiguError` for a date outside the calendar data) and a `selected` property. See the web components guide for each element's methods.

### Controlled and uncontrolled

- Passing a value prop (`value`, `start`, `end`, `valuePaisa`, `ward`) and no `onChange` gives an **uncontrolled** field with an initial value. The user edits it freely.
- A **controlled** field passes the value and updates it from `onChange`. When the parent changes the prop, the element follows, and `onChange` does not fire for that change.
- A parent rerender with an unchanged prop writes nothing. If the user picked a different value in the element, that value stays.
- Because only changes are written, setting the prop to the value it already has does nothing. If the field is uncontrolled and you need to restore the original value, change the prop to something else first, or give the component a new `key` so it mounts a fresh element.
- Clearing: set a string prop to `''` (it is written as an empty attribute; the date picker sample below ran this). `undefined` or `null` removes the attribute.

### Stable object props

`events` and `panchang` are assigned when the object identity changes. An object literal in JSX is a new object on every render, so the element would redraw its marks on every render. Use state, a module constant or `useMemo`:

```tsx
import { useMemo } from 'react';
import { JhiguCalendar } from 'jhigu-patro-react';

export function Holidays({ list }: { list: { bs: string; title: string }[] }) {
  const events = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const h of list) (out[h.bs] ??= []).push(h.title);
    return out;
  }, [list]);
  return <JhiguCalendar year={2082} month={6} events={events} />;
}
```

The same applies to `style`: a new object is compared by identity and rewritten, which is cheap but needless. Define it once if it is constant.

### Forms and FormData

The elements are form-associated (the calendar is not). With `name` set, a normal `<form>` and `new FormData(form)` contain:

| Component | Posted |
|---|---|
| `JhiguDatePicker` | `name` = the BS date `YYYY-MM-DD`. |
| `JhiguDateRangePicker` | `name_start` and `name_end`, both BS, only when the range is complete. |
| `JhiguAddressSelect` | `name` = the local level id; `name_ward`, `name_district` and `name_province` when chosen. |
| `JhiguMoneyInput` | `name` = integer paisa as text, `''` when empty. |
| `JhiguPhoneInput` | `name` = the E.164 number when valid, else `''`. |
| `JhiguCalendar` | nothing. |

`required` and form reset work through the element. The sources are the headers in `ts/src/elements/`. The example apps submitted `dob`, `stay_start`, `stay_end`, `amount` and `phone` in Chromium (Vite) and `dob` and `amount` (Next.js); see [How it is tested](#how-it-is-tested). The unit tests here use stub elements, so they do not test posting.

### Theming

Style with `className`, with `style` (including custom properties), or with the elements' own CSS variables and `::part`s. Custom properties belong on the element, which `style` and `className` do:

```tsx
<JhiguDateRangePicker name="stay" style={{ '--jhigu-color-primary': '#047857', '--jhigu-radius': '4px' }} />
```

The variables (`--jhigu-color-primary`, `-on-primary`, `-surface`, `-text`, `-muted`, `-holiday`, `-today`, `--jhigu-radius`, `--jhigu-font-family`, `--jhigu-font-size`), the parts and the dark theme rules are in the [web components guide](../web-components/README.md#theming-and-dark-mode). A value for a custom property is written as plain text (`String(value)`, no `px` added), so write the unit yourself. Parts are styled from a stylesheet: `jhigu-date-picker::part(day)`.

### Language

`language` is `'en'` or `'ne'`. The calendar's tithi names are Nepali whichever language is set. Changing it re-renders the element in the new language and keeps the values. The Nepali strings are unreviewed by a native speaker (web components guide).

### StrictMode

Safe. Mount, unmount, mount gives one element and one listener (tested; a `JhiguMoneyInput` under `StrictMode` left one element in the scratch run too).

## Recipes

Samples 1 to 6 below were run as a scratch test with stub elements under jsdom (React 19.3.1 and 18.3.1; the scratch test was deleted afterwards). The Vite and Next.js data-loading snippets were not run here; they are copies of the example apps checked in Chromium. The stubs stand in for the real elements, which need a browser, so the samples show wiring, not the elements' own behaviour.

### 1. A booking form

A range, a deposit in integer paisa, a phone and an address in one form.

```tsx
import { useState } from 'react';
import { JhiguDateRangePicker, JhiguMoneyInput, JhiguPhoneInput, JhiguAddressSelect } from 'jhigu-patro-react';

export function Booking({ onBook }: { onBook: (b: { start: string; end: string; days: number; depositPaisa: number | null }) => void }) {
  const [stay, setStay] = useState<{ start: string; end: string; days: number } | null>(null);
  const [paisa, setPaisa] = useState<number | null>(null);
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (stay) onBook({ ...stay, depositPaisa: paisa });
      }}
    >
      <JhiguDateRangePicker name="stay" popup required
        onChange={d => setStay(d.complete ? { start: d.start, end: d.end, days: d.days } : null)} />
      <JhiguMoneyInput name="deposit" symbol="Rs." label="Deposit" required onChange={d => setPaisa(d.paisa)} />
      <JhiguPhoneInput name="phone" label="Mobile" required />
      <JhiguAddressSelect name="home" />
      <p>{stay ? `${stay.days} days` : 'no dates'}</p>
      <button type="submit">Book</button>
    </form>
  );
}
```

Run result (the sample was run with a slightly different submit handler that recorded its values): the stub elements got `name="stay" popup required` and `name="deposit" symbol="Rs." label="Deposit" required`; after a `jhiguChange` with `days: 6` and one with `paisa: 123450`, the state held `{ start: '2082-05-10', end: '2082-05-15', days: 6 }` and `123450`, and there was still one money element. The `no dates` and `days` text is sample text only; real UI text comes from your own labels, not from this package.

### 2. A controlled date with a parent reset

```tsx
import { useState } from 'react';
import { JhiguDatePicker } from 'jhigu-patro-react';

export function Dob() {
  const [dob, setDob] = useState('2082-05-12');
  return (
    <>
      <JhiguDatePicker name="dob" value={dob} onChange={d => setDob(d.bs)} />
      <button type="button" onClick={() => setDob('')}>Clear</button>
      <button type="button" onClick={() => setDob('2082-06-02')}>Set 2082-06-02</button>
    </>
  );
}
```

Run result: the attribute started as `2082-05-12`; "Set" wrote `2082-06-02` without an `onChange` call; a `jhiguChange` with `bs: '2082-07-01'` updated the state and the attribute to `2082-07-01`; "Clear" wrote `value=""` on the same element (not a new one).

A pitfall, also run: with `value="2082-05-12"` fixed and the user having picked `2082-09-09`, a parent rerender left `2082-09-09` in place. Only a changed prop is written.

### 3. A calendar with events and tithi

```tsx
import { useMemo, useState } from 'react';
import { PanchangDataSource } from 'jhigu-patro-utils-ts';
import { JhiguCalendar } from 'jhigu-patro-react';
import type { JhiguSelectDetail } from 'jhigu-patro-react';

// Load once, at module level or in your data layer, before the calendar renders.
const panchang = new PanchangDataSource();
panchang.addYear(await (await fetch('/2082_tithi.json')).json());

export function Panchang() {
  const [picked, setPicked] = useState<JhiguSelectDetail | null>(null);
  const events = useMemo(() => ({ '2082-06-03': ['Laxmi Puja'] }), []);
  return (
    <>
      <JhiguCalendar year={2082} month={6} language="ne" events={events} panchang={panchang} onSelect={setPicked} />
      <p>{picked ? `${picked.bs}: ${picked.events.join(', ')} ${picked.tithi ?? ''}` : ''}</p>
    </>
  );
}
```

Run result (with `panchang.addYear` fed from `data/2082_tithi.json`): the element got only `year="2082"` and `month="6"` as attributes (this run did not pass `language`); `el.panchang` was the same object; after two parent rerenders `events` was not assigned again. A selection event reached `onSelect` once. With the inline literal `events={{ ... }}` the property was assigned a new object on every render. `showTithi={false}` writes `show-tithi="false"`.

The `useMemo` sample at "Stable object props" was not run as written. The data files are `data/2081_tithi.json` and `data/2082_tithi.json`; the tithi guide covers loading them per environment. A year that is not loaded shows no tithi.

### 4. A Nepali switch

```tsx
import { useState } from 'react';
import { JhiguCalendar, JhiguMoneyInput } from 'jhigu-patro-react';

export function Switchable() {
  const [language, setLanguage] = useState<'en' | 'ne'>('en');
  return (
    <>
      <button type="button" onClick={() => setLanguage(l => (l === 'en' ? 'ne' : 'en'))}>{language}</button>
      <JhiguCalendar language={language} />
      <JhiguMoneyInput language={language} devanagari={language === 'ne'} label="Amount" />
    </>
  );
}
```

Run result: the calendar's attribute went `language="en"` then `language="ne"` on the same element. `devanagari={false}` removes the attribute. A switch with the real elements in Chromium (React 19 and 18) re-rendered in Nepali with values kept, per [react/README.md](../../../react/README.md).

### 5. Wrapping another element with `createJhiguComponent`

`createJhiguComponent<El, Props>(tag, define, spec)` makes a component for any custom element from a `ComponentSpec`: `attrs` (prop to attribute and kind), optional `properties` and `events` (callback prop to DOM event name). `define` is called once at import, only when `customElements` exists. The component's `displayName` is the tag, and its `spec` is exposed (non-enumerable) for tooling.

```tsx
import { createJhiguComponent } from 'jhigu-patro-react';
import type { HostProps } from 'jhigu-patro-react';

interface BadgeProps extends HostProps {
  label?: string;
  compact?: boolean;
  onPick?: (detail: { n: number }, event: CustomEvent<{ n: number }>) => void;
}

export const Badge = createJhiguComponent<HTMLElement, BadgeProps>(
  'x-badge',
  () => { if (!customElements.get('x-badge')) customElements.define('x-badge', class extends HTMLElement {}); },
  {
    attrs: { label: { attr: 'label', kind: 'string' }, compact: { attr: 'compact', kind: 'boolean' } },
    events: { onPick: 'badgePick' },
  },
);
```

Run result: `<Badge label="Hi" compact />` gave attributes `label="Hi"` and `compact=""`; a `badgePick` event with `{ n: 3 }` called `onPick` with `{ n: 3 }`; `Badge.displayName` was `x-badge`. For a non-React framework, use `ElementBinding` directly (web components guide, "Binding table").

### 6. Testing components in Vitest or Jest with jsdom

jsdom has no `ElementInternals`, so the real elements cannot be created there. `react/tests` registers a stub under the real tag name and dispatches the real event names. The stub definers are replaced by mocking the element modules (Vitest shown; the same idea with `jest.mock` was not run):

```tsx
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi, it, expect } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('jhigu-patro-utils-ts/date-picker-element', async importOriginal => ({
  ...(await importOriginal<object>()),
  defineJhiguDatePicker: () => {
    if (!customElements.get('jhigu-date-picker')) customElements.define('jhigu-date-picker', class extends HTMLElement {});
  },
}));

import { JhiguDatePicker } from 'jhigu-patro-react';

it('calls onChange with the detail', () => {
  const onChange = vi.fn();
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  act(() => root.render(<JhiguDatePicker name="dob" onChange={onChange} />));

  const el = container.querySelector('jhigu-date-picker')!;
  act(() => {
    el.dispatchEvent(new CustomEvent('jhiguChange', {
      detail: { bs: '2082-05-10', ad: '2025-08-26', value: null }, bubbles: true, composed: true,
    }));
  });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].bs).toBe('2082-05-10');
  act(() => root.unmount());
});
```

Run result (React 19.3.1 and 18.3.1, the same test with a stub defined in the same way): the event reached `onChange` once, the detail's `bs` was `2082-05-10`, and the second argument was a `CustomEvent`. Assert on attributes (`el.getAttribute('value')`) and properties (`el.events`), and fire the event names from the tables above (`jhiguChange`, `jhiguSelect`, `jhiguMonthChange`, `jhiguOpen`, `jhiguClose`). Typing, formatting, validity and posting need a real browser. The repo's `vitest.config.ts` uses `environment: 'jsdom'` and `include: ['tests/**/*.test.ts']`; a `.tsx` test file needs the include widened, or write the test with `createElement` as `react/tests` does.

## Server rendering and Next.js

The elements exist only in the browser. A server render of any component is the empty wrapper. For `<JhiguDatePicker name="dob" value="2082-05-12" />`, `renderToString` gave exactly `<div style="display:contents"></div>` (run here). The field appears after hydration, when the layout effect creates the element.

- No `define` runs on the server: `createJhiguComponent` calls it only when `customElements` is defined, and the element modules import safely without a DOM.
- Next.js App Router: use the components from a file with `'use client'`. A server component can render that client component. See `react/example-next/app/page.tsx` (server) and `form.tsx` (client).
- Initialise the calendar at module level of the client file, from the bundled JSON, so that the server prerender and the browser run the same code (see Install and setup).
- Hydration: the wrapper has no children on the server and the element is added after hydration. react/README.md reports no hydration warning in `next start` and `next dev`; the `tools/ssr-check` run above reported no console error or warning.
- Linked packages in a monorepo: set `turbopack.root` in `next.config.mjs` to the repo root, as `react/example-next/next.config.mjs` does:

```js
import { fileURLToPath } from 'node:url';

export default { turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) } };
```

Run here: `node tools/ssr-check/check.mjs --only next` printed `ok` for all seven checks (builds; server HTML has five empty wrappers and no custom element; each of the five elements exists once after hydration; the date picker draws its 31 days; typing in the money field formats it; submitting the form gives `dob` and amount in paisa; no console error or warning and no page error), then `all checks passed`. Chromium was already installed locally.

## Accessibility

The wrappers add nothing to the markup. Roles, labels and keyboard behaviour come from the elements, listed in the [web components guide](../web-components/README.md#accessibility). On the React side:

- Give the money and phone fields a `label` (or an `aria-label` prop) so the inner input has an accessible name.
- `aria-*` props are written to the custom element (the host), not to the inner input, except as the money and phone elements use `aria-label` as described above.
- Screen readers were not used on any of this.

## Known gaps and what is not verified

- **Not published.** Install from a path or a tarball.
- **React versions run:** 19 (19.3.1 in this guide's run; 19.2 per react/README.md) and 18.3.1. The package declares `react >=18`. No other 18.x or 19.x version, and no React 17, was run.
- **Browsers run:** Chromium only (the example apps and `tools/ssr-check`). Safari, Firefox, touch and screen readers were not checked, the same limits as the web components.
- **Next.js:** 16.4.6, App Router, Turbopack, React 19 only. Not checked: the Pages Router, webpack builds, other Next.js versions. Remix, Astro and other frameworks are not covered. React Native is not supported: the elements are DOM custom elements.
- **No server-rendered fields.** The server HTML has an empty wrapper; the field appears after hydration.
- **Unit tests use stub elements.** Real element behaviour (typing, formatting, validity, posting, popups) was seen only in the browser runs, not in jsdom.
- **FormData** in the table above comes from the element headers and the browser runs of the examples. The Vite example posted `stay_start` and `stay_end` for the range; the address fields (`name_ward`, `name_district`, `name_province`) were not checked through React.
- **Data limits** are the elements' own: calendar years after 2083 are not verified against an official calendar, and the tithi data covers BS 2081 and 2082 only (calendar data and tithi guides).
- **`JhiguPhoneInput` and `JhiguMoneyInput` `readonly`** is spelled in lowercase, as the attribute is; `readOnly` is not a prop.
- Doc discrepancy found: `react/README.md` says 56 tests; `npm test` runs 57 (8 in `binding.test.ts`, 29 in `wrap.test.ts`, 20 in `components.test.ts`).

## How it is tested

- `react/tests` (Vitest, jsdom, stub elements): `wrap.test.ts` (attribute kinds, writing only what changed, attributes set before connecting, properties, events and the latest callback, refs, host props, StrictMode, server render), `binding.test.ts` (the shared `ElementBinding` on its own: mount, unmount, remount, events), and `components.test.ts` (each component writes each of its props as the right attribute, each callback maps to its own event, the ref is the element, `events` and `panchang` are properties).
- That every mapped attribute and event matches the real elements is checked once for all frameworks in `ts/tests/elementBindings.test.ts`.
- Run here: `cd react && npm ci && npm run build && npm test` built with `tsc` without errors and passed 57 of 57 tests in 3 files on React 19.3.1. After `npm install --no-save react@18.3.1 react-dom@18.3.1` the same 57 passed on React 18.3.1; `npm ci` restored 19.3.1.
- Examples: `react/example` (Vite, StrictMode) and `react/example-next` (Next.js) were driven in Chromium; see [react/README.md](../../../react/README.md) for what was seen, and the [examples](../../../examples/README.md) for the example index.
- `tools/ssr-check` builds and runs the Next.js example and checks the server HTML, hydration, the form data and the console in Chromium. Its README says the server-HTML check was not mutation-tested, and covers only Chromium.

```bash
cd react && npm ci && npm run build && npm test
node tools/ssr-check/check.mjs --only next
```

## Related guides

- [Web components](../web-components/README.md): the six elements, their attributes, events, theming and accessibility.
- [Vue](../vue/README.md): the Vue wrappers over the same binding core.
- [Calendar data](../calendar-data/README.md), [Dates](../dates/README.md), [Tithi](../tithi/README.md): data and types behind the pickers and the calendar.
- [Money](../money/README.md), [Phone](../phone/README.md), [Address](../address/README.md): the logic behind the three field components.
- [Headless widgets](../headless-widgets/README.md): the state machines, for your own markup.
- [react/README.md](../../../react/README.md) and [examples](../../../examples/README.md).
