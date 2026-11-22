# jhigu-patro-react

React components for the Jhigu Patro web components: BS date picker, date range
picker, calendar with events, address select, money input and phone input.

Not published yet. `jhigu-patro-utils-ts` is a **peer dependency** (install it next to this package, so the
app and the elements share one copy of the calendar state); in this repo it is linked from `../ts` for
development. React 18 and later.

```bash
npm install jhigu-patro-react jhigu-patro-utils-ts react
```

```tsx
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import { JhiguDatePicker, JhiguMoneyInput, JhiguPhoneInput } from 'jhigu-patro-react';

// Once, at start-up: the calendar data (money and phone do not need it).
const cal = await (await fetch('/nepali_calendar_data.json')).json();
initializeCalendar(new InlineCalendarDataSource(cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));

function Form() {
  const [dob, setDob] = useState('2082-05-12');
  return (
    <form>
      <JhiguDatePicker name="dob" language="ne" value={dob} required
        onChange={d => setDob(d.bs)} />
      <JhiguMoneyInput name="amount" symbol="Rs." label="Amount"
        onChange={d => console.log(d.paisa)} />
      <JhiguPhoneInput name="phone" label="Mobile"
        onChange={d => console.log(d.e164)} />
    </form>
  );
}
```

## Components

| Component | Element | Callbacks (first argument is the event's `detail`) |
|---|---|---|
| `JhiguDatePicker` | `<jhigu-date-picker>` | `onChange`, `onOpen`, `onClose` |
| `JhiguDateRangePicker` | `<jhigu-date-range-picker>` | `onChange`, `onOpen`, `onClose` |
| `JhiguCalendar` | `<jhigu-calendar>` | `onSelect`, `onMonthChange` |
| `JhiguAddressSelect` | `<jhigu-address-select>` | `onChange` |
| `JhiguMoneyInput` | `<jhigu-money-input>` | `onChange` |
| `JhiguPhoneInput` | `<jhigu-phone-input>` | `onChange` |

Props are the elements' attributes in camelCase (`week-starts-on` is
`weekStartsOn`, `value-paisa` is `valuePaisa`). They are typed, and the detail types
are exported. `showAd` and `showWard` default to on (pass `false` to turn them off);
the other booleans (`disabled`, `required`, `popup`, `devanagari`, ...) are on when
true. The calendar takes `events` (`{ '2082-06-03': ['Laxmi Puja'] }`) and
`panchang` (a `PanchangDataSource` with its years loaded, for the tithi under each day) as
properties: pass stable objects (state, a constant, `useMemo`).

Every component also takes `className`, `style` (CSS custom properties work, for
theming: `style={{ '--jhigu-color-primary': '#b91c1c' }}`), `id`, `title`, `hidden`,
`slot`, and `data-*` / `aria-*` attributes (an `aria-label` on `JhiguMoneyInput` or `JhiguPhoneInput` names the inner input when there is no `label`). A `ref` is the custom element itself, so
`ref.current.open()` works on a popup picker. The elements' CSS variables and
`::part`s are documented in their headers under `ts/src/elements/`.

## How it behaves

- **A prop is written to the element only when it changes.** A parent rerender does
  not reset a field the user has typed in or a date they picked. To change the
  field from the parent, change its prop (`value`, `start`, `valuePaisa`, ...); the
  element follows without firing `onChange` for that change.
- **Form fields work.** The elements are form-associated, so `name` puts their value
  in a normal `<form>` and in `FormData` (the date as `YYYY-MM-DD`, money as integer
  paisa, phone as E.164, the range as `name_start` and `name_end`).
- **Built on a shared core.** The attribute mapping, property and event wiring are in
  `ElementBinding` and the prop tables in `jhigu-patro-utils-ts` (`element-binding`,
  `element-bindings`); the Vue package uses the same ones.
- **The element is created by hand,** not by React, with its attributes set before it
  is connected (one build, not one per attribute). React 18 and 19 treat props on
  custom elements differently; this avoids the difference. The component renders one
  `<div style="display: contents">` as the place to put it.
- **Client only.** The element is created after the first render, so server rendering
  gives the empty wrapper, and the field appears on hydration. Nothing is registered
  without a browser. In Next.js, use the components from a `'use client'` file.
- **StrictMode is fine** (mount, unmount, mount gives one element and one listener).

## Checked and not checked

- 56 tests (`npm test`; 8 of them test the shared core's lifecycle directly) with stub elements in jsdom: attribute kinds, writing only
  what changed, attributes set before connecting, events and the latest callback,
  refs, host props, StrictMode, server render, and that each component writes each of its props as
  the right attribute. That every mapped attribute and event matches the real elements (observed
  attributes, events dispatched in their source, every observed attribute covered) is checked once for
  all frameworks in `ts/tests/elementBindings.test.ts`. All 56 pass on React 19.2 and on React 18.3.1.
  Twenty-two mutations were caught (four only after tests were added), and nine more on the shared core
  after the refactor (one only after a test was added).
- Seen in Chromium (React 19, Vite, StrictMode) with the real elements in
  `example/`: all six render, one element each; real clicks reach the callbacks;
  typing into the money and phone fields formats them and survives a parent
  rerender; a parent-driven date updates the picker; switching `language` re-renders
  in Nepali with values kept; a themed `style` custom property changes the colour;
  submitting the form gives `dob`, `stay_start`, `stay_end`, `amount` and `phone`.
- Seen in Next.js 16.4.6 (App Router, Turbopack, React 19) in `example-next/`: a server component
  renders a client component with all six kinds of field. `next build` prerenders the page (the HTML
  has five empty wrappers and no custom elements, so nothing needs `customElements` on the server).
  In Chromium, after hydration each element exists once, the date picker draws its 31 days, typing
  into the money field formats it, and the form gives `dob` and `amount` (paisa). The console has
  no errors and no hydration warnings, in `next start` and in `next dev` (StrictMode). The calendar
  data is imported from `jhigu-patro-utils-ts/nepali_calendar_data.json` and initialised at module
  level, so the same code runs on the server and in the browser. In a monorepo with linked packages,
  set `turbopack.root` to the repo root (see `example-next/next.config.mjs`).
- Seen in Chromium with React 18.3.1 (the `example/` app, StrictMode, after clearing Vite's dependency
  cache so that 18 was really served): all six elements once, 31 days in the calendar, a parent-set date
  reaches the picker, switching `language` works, the money field keeps `1,234.50` through a parent
  rerender, the themed `style` custom property applies, and the form gives `dob` and `amount` (paisa).
  No console errors.
- **Not checked:** the Pages Router and webpack builds of
  Next.js, and other frameworks (Remix, Astro); Safari, Firefox, touch and
  screen readers (the same limits as the web components themselves).
