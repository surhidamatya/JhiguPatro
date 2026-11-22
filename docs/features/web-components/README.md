# Web components

Six plain custom elements for Bikram Sambat forms and calendars: `<jhigu-date-picker>`, `<jhigu-date-range-picker>`, `<jhigu-calendar>`, `<jhigu-address-select>`, `<jhigu-money-input>` and `<jhigu-phone-input>`. They use shadow DOM, have no dependencies, and sit on top of the [headless widgets](../headless-widgets/README.md). Five are form-associated: their value posts with a normal `<form>`, and `required` and form reset work. The calendar is a display widget, not a form field. They run in the browser only.

## When to use it

- You want a working BS date picker, range picker, calendar, address select, money field or phone field in any page or framework, with no build step beyond loading a module.
- You use React or Vue: the wrappers in [react/](../../../react/README.md) and [vue/](../../../vue/README.md) are thin layers over these elements.
- You want your own markup instead: use the [headless widgets](../headless-widgets/README.md).

## Setup

Build the package once (the examples import `ts/dist`), then register the elements you use. The date picker, range picker and calendar need the calendar data loaded first. The address, money and phone elements do not.

| Element | Entry point | Register with |
|---|---|---|
| `<jhigu-date-picker>` | `jhigu-patro-utils-ts/date-picker-element` | `defineJhiguDatePicker()` |
| `<jhigu-date-range-picker>` | `jhigu-patro-utils-ts/range-picker-element` | `defineJhiguDateRangePicker()` |
| `<jhigu-calendar>` | `jhigu-patro-utils-ts/calendar-element` | `defineJhiguCalendar()` |
| `<jhigu-address-select>` | `jhigu-patro-utils-ts/address-element` | `defineJhiguAddressSelect()` |
| `<jhigu-money-input>` | `jhigu-patro-utils-ts/field-elements` | `defineJhiguMoneyInput()` |
| `<jhigu-phone-input>` | `jhigu-patro-utils-ts/field-elements` | `defineJhiguPhoneInput()` |

Each `define...` function takes an optional tag name, returns the class, and is safe to call twice. It throws an `Error` mentioning `customElements` when there is no browser. Importing the modules is safe without a browser (they fall back to an empty base class); only registering needs one.

```html
<script type="module">
  import { initializeCalendar, JsonCalendarDataSource } from 'jhigu-patro-utils-ts';
  import { defineJhiguDatePicker } from 'jhigu-patro-utils-ts/date-picker-element';
  import { defineJhiguDateRangePicker } from 'jhigu-patro-utils-ts/range-picker-element';
  import { defineJhiguCalendar } from 'jhigu-patro-utils-ts/calendar-element';
  import { defineJhiguAddressSelect } from 'jhigu-patro-utils-ts/address-element';
  import { defineJhiguMoneyInput, defineJhiguPhoneInput } from 'jhigu-patro-utils-ts/field-elements';

  // 1. The calendar data first (see docs/USAGE.md, "Setup").
  const source = new JsonCalendarDataSource();
  await source.initialize('/nepali_calendar_data.json');
  initializeCalendar(source);

  // 2. Then register.
  defineJhiguDatePicker(); defineJhiguDateRangePicker(); defineJhiguCalendar();
  defineJhiguAddressSelect(); defineJhiguMoneyInput(); defineJhiguPhoneInput();
</script>
```

If an element connects before the calendar is initialised, the date picker shows an error line (`role="alert"`) instead of throwing. Register after `initializeCalendar`. The example pages in `ts/examples/` read the data with `fetch('../nepali_calendar_data.json')` and `InlineCalendarDataSource`; both work.

## Quick start

```html
<form>
  <jhigu-date-picker name="dob" language="ne" popup required min="2070-01-01"></jhigu-date-picker>
  <jhigu-date-range-picker name="stay" popup></jhigu-date-range-picker>
  <jhigu-address-select name="home" required></jhigu-address-select>
  <jhigu-money-input name="amount" symbol="Rs." label="Amount" required></jhigu-money-input>
  <jhigu-phone-input name="phone" label="Mobile" required></jhigu-phone-input>
  <button>Save</button>
</form>
<jhigu-calendar language="ne" marked='{"2082-06-03": ["Laxmi Puja"]}'></jhigu-calendar>

<script type="module">
  document.querySelector('jhigu-date-picker')
    .addEventListener('jhiguChange', e => console.log(e.detail.bs, e.detail.ad));
</script>
```

Form data from this form (as the element sources post it): `dob=2082-05-12`, `stay_start=...`, `stay_end=...`, `home=<local level id>` plus `home_ward`, `home_district`, `home_province`, `amount=123450` (integer paisa), `phone=+9779841234567`.

## Reference

### Shared behaviour

- **Attributes are the API.** Set them in HTML or with `setAttribute`. Boolean attributes (`disabled`, `required`, `popup`, `readonly`, `devanagari`, `allow-negative`, `allow-inactive`) are on when present. `show-ad`, `show-ward` and `show-tithi` default to on; only the text `"false"` turns them off. A bare boolean attribute cannot default to on, which is why these are text.
- **Language.** `language` is `en` (default) or `ne`. Anything else is English.
- **Dates are BS text** `YYYY-MM-DD`. An unreadable `value`, `start`, `end`, `min` or `max` is handled as in each element's table below.
- **Events** are `CustomEvent`s that bubble and are composed, so you can listen on `document`. Details are plain objects.
- **Form association.** `form`, `validity`, `validationMessage`, `willValidate`, `checkValidity()` and `reportValidity()` are on every form-associated element. Reset puts the value back to what the attributes say. The browser's disabled-by-fieldset and state-restore callbacks are handled (`disabled` is toggled; the value is restored).
- **Messages.** Validation messages and labels come from the string tables, in the chosen language. The Nepali strings are unreviewed by a native speaker.
- **`today`** (date picker, range picker, calendar) is a BS date to treat as today. It exists for tests and screenshots.

### Binding table (`element-bindings`)

`jhigu-patro-utils-ts/element-bindings` exports `elementBindings`, one entry per element with its `tag`, `define` and a `spec` (the prop-to-attribute table the React and Vue packages use). Prop names are the attribute names in camelCase. A `string` prop is `String(value)`; a `boolean` prop is present when truthy; a `falseOnly` prop is written only as `"false"`.

| Key | Tag | Attribute props | Property props | Callback props (DOM event) |
|---|---|---|---|---|
| `datePicker` | `jhigu-date-picker` | `value`, `min`, `max`, `language`, `weekStartsOn` (number), `showAd` (falseOnly), `name`, `disabled`, `required`, `popup`, `theme`, `today` | | `onChange` (`jhiguChange`), `onOpen` (`jhiguOpen`), `onClose` (`jhiguClose`) |
| `dateRangePicker` | `jhigu-date-range-picker` | `start`, `end`, `min`, `max`, `language`, `weekStartsOn`, `showAd`, `name`, `disabled`, `required`, `popup`, `theme`, `today` | | `onChange`, `onOpen`, `onClose` |
| `calendar` | `jhigu-calendar` | `year` (number), `month` (number), `language`, `weekStartsOn`, `showAd`, `showTithi` (falseOnly), `theme`, `today` | `events`, `panchang` | `onSelect` (`jhiguSelect`), `onMonthChange` (`jhiguMonthChange`) |
| `addressSelect` | `jhigu-address-select` | `value` (number), `ward` (number), `language`, `showWard` (falseOnly), `name`, `required`, `disabled`, `theme` | | `onChange` |
| `moneyInput` | `jhigu-money-input` | `valuePaisa` (number), `symbol`, `devanagari`, `allowNegative`, `name`, `placeholder`, `label`, `language`, `disabled`, `readonly`, `required`, `theme` | | `onChange` |
| `phoneInput` | `jhigu-phone-input` | `value`, `allowInactive`, `name`, `placeholder`, `label`, `language`, `disabled`, `readonly`, `required`, `theme` | | `onChange` |

The calendar's `marked` attribute is not in the table: the wrappers pass `events` as a property. `ElementBinding` (`jhigu-patro-utils-ts/element-binding`) creates an element, sets its attributes before it connects (so it builds once), writes only what changed, and forwards events. Use it to wrap the elements for another framework.

### `<jhigu-date-picker>`

| Attribute | Meaning |
|---|---|
| `value` | Selected BS date. |
| `min`, `max` | Earliest and latest selectable day. |
| `language` | `en` or `ne`. |
| `week-starts-on` | 0 (Sunday, default) to 6. |
| `show-ad` | AD numbers under days and AD date in labels. On unless `"false"`. |
| `name` | Form field name. The BS date is posted under it. |
| `disabled`, `required` | As for a form field. |
| `popup` | Show a trigger button and open the calendar in a popover. Without it the calendar is always shown. |
| `theme` | `light` or `dark`. Default: follows the system. |
| `today` | A BS date to treat as today. |

Properties: `value` (BS text, `''` when empty; setting an unreadable text sets `badInput`), `valueAsNepaliDate` (a `NepaliDate` or null). Methods: `show()`, `hide()` (popup mode), `focus()`.

Events: `jhiguChange` with `detail: { bs, ad, value }`, where `bs` and `ad` are `YYYY-MM-DD` (`''` when cleared) and `value` is a `NepaliDate` or null. In popup mode also `jhiguOpen` and `jhiguClose`. `jhiguChange` fires when the value changes, not when the same day is picked again.

Form: posts the BS date under `name`. `required` and empty gives `valueMissing` (message `picker.required`, "Select a date"). An unreadable `value`, or one outside `min`/`max` or the calendar, is dropped and gives `badInput`. Reset restores the `value` attribute.

Behaviour:

- Popup: the trigger shows the date in the dual form, or the placeholder. Arrow Down on the trigger opens it. Escape closes it and returns focus to the trigger. A click or tap outside closes it. Choosing a day or pressing Today closes it. The popover has `role="dialog"`.
- Inline: the panel is `role="group"` with the placeholder text as its label.
- Title button cycles days, months, years, days. Picking a month goes back to days; picking a year goes to months. In the years view the title still shows the month and year.
- Today and Clear buttons are in the footer (the calendar has Today only).
- Error states: `min` after `max`, or an unreadable `min`/`max`, show the error message in a `role="alert"` line instead of the picker.

### `<jhigu-date-range-picker>`

Attributes: `start`, `end` (BS dates), `min`, `max`, `language`, `week-starts-on`, `show-ad`, `name`, `disabled`, `required`, `popup`, `theme`, `today`. Same look, popup behaviour and keyboard map as the date picker.

Choosing: the first click sets the start; a click on or after it sets the end; a click before the start restarts; a click on a complete range starts a new one. While choosing the end, days up to the hovered day (or the keyboard-focused day) are previewed. In popup mode choosing the end closes the popup.

Properties: `start`, `end` (BS text, `''` when empty), `complete` (read-only). Methods: `setRange(start, end)` (throws `JhiguError`: `INVALID_DATE` for unreadable or missing text, `INVALID_DATA` when reversed, `OUT_OF_RANGE` when disabled), `clear()`, `show()`, `hide()`, `focus()`.

Events: `jhiguChange` on every change of start or end, with `detail: { start, end, startAd, endAd, complete, days }`. `days` is the inclusive day count, 0 until complete; dates are `''` when empty. In popup mode also `jhiguOpen` and `jhiguClose`.

Form: when `name` is set and the range is complete, posts `name_start` and `name_end` (BS dates). Nothing is posted for a partial range. `required` needs a complete range. An unreadable, reversed or end-without-start `start`/`end`, or a start outside `min`/`max`, is dropped and gives `badInput`. Reset restores the attributes.

Parts: those of the date picker, plus `range-start`, `range-middle`, `range-end`, `range-single`, `in-range` and `preview` on day cells. Middle days are `aria-selected` but styled with the band, not the solid selected style.

### `<jhigu-calendar>`

A month view with marked days and an events list. Not a form field: no `name`, `required`, `disabled` or `popup`.

| Attribute | Meaning |
|---|---|
| `year`, `month` | The month to show first. A later change moves the view. An invalid month is ignored. |
| `language`, `week-starts-on`, `show-ad`, `theme`, `today` | As for the date picker. Changing them keeps the shown month and the selection. |
| `marked` | JSON: an object from BS date to a title or a list of titles, or a plain array of dates. |
| `show-tithi` | On unless `"false"`. Only has an effect when a `panchang` is set. |

Properties and methods:

| Name | Meaning |
|---|---|
| `events` | Titles by BS date. The getter returns `Record<string, string[]>`. Setting it (the same object form as `marked`) replaces the marks of the attribute; setting the `marked` attribute again takes over again. A date with no titles is not marked. |
| `panchang` | A `PanchangDataSource`, or anything with `sunriseTithi(year, month, day)`. Setting it redraws. |
| `selected` | The selected day as BS text, `''` when none. |
| `goTo(year, month)` | Show a month. Throws `JhiguError` outside the calendar data. |
| `select(bs)` | Select a day and move to its month. Throws `JhiguError` for an invalid or unavailable date. |

Events:

| Event | `detail` |
|---|---|
| `jhiguSelect` | `{ bs, ad, events, tithi? }`. `events` is the list of titles for the day (empty when none). `tithi` is the sunrise tithi name, present only when a panchang is set and has one for the day. Fires when the selected day changes. |
| `jhiguMonthChange` | `{ year, month }`. Fires when the shown month changes, including by keyboard, `goTo` or the `year`/`month` attributes. |

Marked days show a dot (top-right). Their titles are added to the day's ARIA label and listed under the grid when the day is selected ("No events" otherwise). An unreadable `marked` attribute shows an English error line (it is a developer error).

#### Tithi

Give the calendar a `PanchangDataSource` with the years loaded. Load before you assign: the calendar reads the source when it draws.

```js
import { PanchangDataSource } from 'jhigu-patro-utils-ts';

const panchang = new PanchangDataSource();
await panchang.load('/2082_tithi.json');       // or panchang.addYear(parsedJson)
const cal = document.querySelector('jhigu-calendar');
cal.panchang = panchang;
cal.addEventListener('jhiguSelect', e => console.log(e.detail.bs, e.detail.tithi));
```

- Each day then shows its sunrise tithi name under the day number (part `tithi`).
- The ARIA label of the day gets `. Tithi: <name>` before any event titles (the word comes from `picker.tithi`).
- The selected day's panel shows `Tithi: <name>, <paksha>`.
- The names and pakshas are Nepali whatever the `language` is.
- A year that is not loaded, a day the source has no tithi for, or a source that throws shows nothing. `show-tithi="false"` hides it.
- The data files are `2081_tithi.json` and `2082_tithi.json`. The element does not read the built-in holiday data; events come only from `marked` and `events`. See the [tithi guide](../tithi/README.md).

### `<jhigu-address-select>`

Four native `<select>`s (province, district, local level, ward), so mobile pickers and screen readers use the platform's own controls. Each is disabled until the one above it is chosen. Options are in data order, not sorted. The address data is in this entry point, not in the main bundle.

Attributes: `value` (local level id), `ward` (initial ward), `language`, `show-ward` (on unless `"false"`), `name`, `required`, `disabled`, `theme`.

Properties and methods: `selection` (the full selection or null), `value` (local level id as text), `setAddress(localLevelId, ward?)` (throws `AddressError`: `UNKNOWN_LOCAL_LEVEL`, `BAD_WARD`), `clear()`, `focus()`.

Event: `jhiguChange` when any choice changes, with `detail: { provinceId, districtId, localLevelId, ward, complete, selection, text }`. `text` is the formatted address when complete, else `''`; for local level 274, ward 3 it is `Ward 3, Bhaktapur Municipality, Bhaktapur, Bagmati` in English and `वडा नं. ३, भक्तपुर नगरपालिका, भक्तपुर, बाग्मती` in Nepali (both seen in Chromium). Without a ward (`show-ward="false"`), `text` has no ward part.

Form: with `name` set, `name` is the local level id, plus `name_ward`, `name_district` and `name_province` when chosen. Nothing is posted until a local level is chosen. `required` is satisfied when the selection is complete (a ward is needed unless `show-ward="false"`); otherwise `valueMissing` with `address.required`. A `value` or `ward` that is not valid gives `badInput` (message `address.unknownLocalLevel`) and an empty selection. With `show-ward="false"` the ward is always null, even if a `ward` attribute is set. The `ward` attribute stays as written: changing `value` applies it again if valid for the new local level.

Accessibility: each select sits in a `<label>`, with `aria-required="true"` when `required`. The labels and the "choose" option come from the string tables.

### `<jhigu-money-input>`

One native text input (`inputmode="decimal"`, `autocomplete="off"`), formatted as you type.

Attributes: `value-paisa` (integer), `symbol` (`Rs.`, `रु`: shown beside the field, never in the text), `devanagari` (Devanagari digits in the text), `allow-negative`, `name`, `placeholder`, `label` (the accessible name), `language` (language of messages), `disabled`, `readonly`, `required`, `theme`. A host `aria-label` names the inner input when there is no `label`; `label` wins.

Property: `valuePaisa` (a number or null; get and set), `value` (paisa as text, `''` when empty, the form value). Methods: `focus()`, `select()`.

Event: `jhiguChange` with `detail: { paisa, value, text }` (`paisa` an integer or null; `value` an `Npr` or null; `text` as shown). It fires when the amount changes, not for a change that only reformats the text.

Form: posts the integer paisa as text (for example `123450`), never the formatted text. `required` and empty gives `valueMissing` (`money.empty`). A bad `value-paisa` (not an integer, or negative without `allow-negative`) gives `badInput` (`money.badFormat`) and an empty field. Typing rules are those of the [money input machine](../headless-widgets/README.md#money-input): lakh grouping, two decimals, padding on blur, amounts past 2^53-1 paisa ignored.

### `<jhigu-phone-input>`

One native input (`type="tel"`, `inputmode="tel"`, `autocomplete="tel"`) with a carrier badge and a message line.

Attributes: `value`, `allow-inactive`, `name`, `placeholder`, `label`, `language`, `disabled`, `readonly`, `required`, `theme`.

Properties: `value` (the field text; setting it formats it as typing would), `e164` (`+977...` when valid, else null). Methods: `focus()`, `select()`.

Event: `jhiguChange` with `detail: { e164, national, valid, carrier, type, text }`. It fires when `e164`, `valid`, `carrier` or `type` changes, not on every keystroke.

Form: posts the E.164 number when valid, else nothing. A non-empty invalid number gives `customError` with the message in the chosen language (the "too short" text before blur, when the machine has no message yet). `required` and empty gives `valueMissing` (`phone.empty`). The message line is `aria-live="polite"`, and the input gets `aria-invalid` and a red border while there is a message. Formatting and error rules are those of the [phone input machine](../headless-widgets/README.md#phone-input).

Both field elements handle typing on `input` events, skip IME composition (and handle the text when composition ends), and repaint the field from the machine after every change, so a change the machine ignores is put back.

### Keyboard map

Inside the grid of the date picker, range picker and calendar (from the shared `keyAction`):

| Key | Action |
|---|---|
| Arrow Left, Right | Previous, next day |
| Arrow Up, Down | Previous, next week |
| Home, End | Start, end of the week |
| Page Up, Page Down | Previous, next month |
| Shift + Page Up, Page Down | Previous, next year |
| Enter, Space | Select the focused day (range picker: choose start or end) |
| Escape | Close the popup (popup mode) |

Focus stops at `min`, `max` and the edge of the calendar data. On a popup trigger, Arrow Down opens the popup. Disabled pickers ignore keys and clicks. The date and range pickers and the calendar redraw on every state change and put focus back on the focused cell or button.

### Theming and dark mode

Set CSS custom properties on the element itself:

```css
jhigu-date-picker.brand {
  --jhigu-color-primary: #b91c1c;
  --jhigu-radius: 4px;
}
```

| Variable | Used by | Default (light) |
|---|---|---|
| `--jhigu-color-primary` | all | `#1d4ed8` |
| `--jhigu-color-on-primary` | pickers, calendar | `#ffffff` |
| `--jhigu-color-surface` | all | `#ffffff` |
| `--jhigu-color-text` | all | `#1a1a1a` |
| `--jhigu-color-muted` | all | `#6b7280` |
| `--jhigu-color-holiday` | all (weekends, errors, the mark dot) | `#c62828` |
| `--jhigu-color-today` | pickers, calendar | `#0f766e` |
| `--jhigu-radius` | all | `8px` |
| `--jhigu-font-family` | all | system UI stack with Noto Sans Devanagari |
| `--jhigu-font-size` | all | `14px` |

- **Set the variables on the element, not on `:root` or `body`.** The component sets them on its own host, which wins over an inherited value. In Chromium, a value on `:root` did not change a selected day's colour; a value on the element did.
- **Dark mode.** `theme="dark"` forces the dark values, `theme="light"` forces light, and with no `theme` the element follows `prefers-color-scheme`. The pickers and the calendar draw their own surface. The address labels and the money and phone message lines sit outside any panel and take the page background, so with a dark theme use a dark page (the address example puts the dark select on a dark panel).
- **Parts.** Style with `::part(...)`, for example `jhigu-date-picker::part(day selected) { font-weight: 700 }`.

| Element | Parts |
|---|---|
| Date picker | `root`, `trigger`, `header`, `title`, `nav` (also `prev` or `next`), `grid`, `weekday`, `day` (plus `today`, `weekend`, `selected`, `focused`, `disabled` on the same cell), `ad`, `months`, `month`, `years`, `year` (each also `selected` when current), `footer`, `today-button`, `clear-button` |
| Range picker | those, plus `range-start`, `range-middle`, `range-end`, `range-single`, `in-range`, `preview` |
| Calendar | those, plus `mark` (the dot), `tithi`, `events`, `event`; `marked` on a marked day |
| Address select | `root`, `item`, `label`, `select`, `province`, `district`, `local-level`, `ward` |
| Money, phone | `field`, `symbol` (money), `input`, `carrier` (phone), `message` |

## Accessibility

What the markup does (from `ts/src/elements/pickerMarkup.ts`, checked by the unit tests and axe):

- The month is a `role="grid"` named by its title, with `row`, `columnheader` and `gridcell` roles. Each day is a `gridcell` with `aria-selected`, `aria-disabled`, a full `aria-label` (weekday, day, month, year, AD date, and for the calendar the tithi and event titles) and a roving `tabindex`.
- The visible BS day is part of the cell's name. The small AD number, the tithi text and the mark dot are `aria-hidden` because the label already contains them.
- The title button is named like `Ashwin 2082, Select month`, so its visible text starts its name, and has `aria-live="polite"` so a month change is announced. Previous and next are buttons with translated labels.
- Popup: the trigger has `aria-haspopup="dialog"` and `aria-expanded`; the popover is a `dialog`.
- Fields: validation messages are in `aria-live` regions; `aria-invalid` is set; the address `<select>`s are native.

What was and was not checked is in [How it is tested](#how-it-is-tested). Screen readers were not used.

## Server rendering

The elements are client only.

- Do not rely on them in server HTML. Without `define...` a `<jhigu-...>` tag is an unknown element with no content.
- Create or mount them after the first render. The React and Vue packages create the element after mount and render an empty `<div style="display: contents">` on the server; the field appears on hydration.
- Next.js: use the React components from a `'use client'` file. Nuxt: no `<ClientOnly>` is needed with the Vue components.
- Initialise the calendar in code that runs on both server and browser (the examples import `jhigu-patro-utils-ts/nepali_calendar_data.json` and call `initializeCalendar` at module level or in the page setup). Never call `define...` on the server.
- `tools/ssr-check` builds and runs the Next.js 16 (App Router) and Nuxt 4 examples and checks them in Chromium: five empty wrappers and no `<jhigu-*>` in the server HTML; after hydration one element each, 31 days drawn, typing in the money field gives `1,234.50`, the form gives `{"dob":"2082-05-12","amount":"123450"}`, and no console errors. It covers only Chromium, not the Pages Router, webpack builds or other frameworks.

## Recipes

### 1. A required date of birth in a normal form

```html
<form method="post">
  <label for="dob">Date of birth</label>
  <jhigu-date-picker id="dob" name="dob" language="ne" popup required
    min="2000-01-01" max="2082-12-30"></jhigu-date-picker>
  <button>Send</button>
</form>
```

Submitting with no date is blocked (`valueMissing`), and the posted value is the BS date `YYYY-MM-DD`. To get the AD date as well, listen to `jhiguChange` and read `e.detail.ad`. `min` and `max` dim the days outside, and the previous and next arrows stop at their months.

### 2. A calendar of holidays that loads its events

```js
const cal = document.querySelector('jhigu-calendar');
cal.addEventListener('jhiguMonthChange', async e => {
  const { year, month } = e.detail;
  const rows = await fetch(`/api/events?year=${year}&month=${month}`).then(r => r.json());
  cal.events = { ...cal.events, ...rows };   // { '2082-06-03': ['Laxmi Puja'] }
});
```

Setting `events` replaces the marks and redraws. Merge the new month into `cal.events` as above if you want the old ones to stay.

### 3. A booking range and its length

```html
<jhigu-date-range-picker id="stay" name="stay" popup required min="2082-05-10"></jhigu-date-range-picker>
<script type="module">
  document.getElementById('stay').addEventListener('jhiguChange', e => {
    if (e.detail.complete) console.log(`${e.detail.days} days`, e.detail.start, e.detail.end);
  });
</script>
```

A form post gives `stay_start` and `stay_end`. Both ends of the event are BS; `startAd` and `endAd` are AD.

### 4. An amount in integer paisa, sent as JSON

```js
const money = document.querySelector('jhigu-money-input');
money.addEventListener('jhiguChange', e => { payload.amountPaisa = e.detail.paisa; });
```

Send the integer. `e.detail.text` is for display only.

### 5. Restore a saved address and phone

```html
<jhigu-address-select name="home" value="274" ward="3"></jhigu-address-select>
<jhigu-phone-input name="phone" value="9841234567" label="Mobile"></jhigu-phone-input>
```

An invalid `value` gives an empty select and `badInput`. The attributes are also what Reset goes back to.

### 6. A calendar with tithi under each day

See [Tithi](#tithi). Load the year file, assign `panchang`, and hide it per instance with `show-tithi="false"`.

## Errors and edge cases

- Calendar data missing: the date picker shows an error line instead of throwing. Register after `initializeCalendar`.
- `min` after `max`, or an unreadable `min`/`max`: the error line shows in place of the picker.
- Unreadable or out-of-range `value`: dropped, `badInput`, empty value. Setting the `value` property to bad text does the same.
- Range `setRange` and calendar `goTo`/`select` throw `JhiguError`; address `setAddress` throws `AddressError`. Clicks on disabled days and months are ignored.
- `name` is not an observed attribute of the date picker, money input or phone input (the form reads it when it is submitted). The range picker and the address select do observe it.
- Changing attributes later: the pickers rebuild their state from the attributes and keep the current value. The money input keeps its amount when `symbol`, `devanagari` or `allow-negative` changes.
- The popover is absolutely positioned under the trigger. Near a screen edge it can overlap content or run off screen.
- Hover on the range picker patches the day cells in place; a full redraw on hover had swallowed real clicks (found and fixed in the browser).

## Accuracy, limits and known gaps

- The calendar data years after 2083 are not verified against an official calendar (see [Calendar data](../calendar-data/README.md)). Nepali strings, tithi names and carrier names are unreviewed or best effort.
- **Nepali province names** in `data/address.json` are the old numbered names (`प्रदेश न. १`); English uses `Koshi Province`. This shows in the address select.
- **Axe, known finding:** date cells report "label in name" because the visible text is the BS day plus the small AD number. It disappears with `show-ad="false"`. Left as is so `::part(ad)` stays available.
- **No type-ahead search** in the address select, though `searchAddress` exists.
- **The calendar** does not read the built-in holiday data; events come only from `marked` and `events`. The Flutter `JhiguCalendar` does not show tithi.
- **Not built:** Stencil-generated wrappers, Angular or Svelte wrappers (React and Vue exist), server-side rendering of the elements themselves.
- **Not verified:** see the next section.

## How it is tested

- Unit tests in Node (`cd ts && npx vitest run`) cover the markup (`pickerMarkup.test.ts`, 18), the calendar's `parseMarks` and markup (`calendarElement.test.ts`, 11), the element binding tables against each element's observed attributes and dispatched events (`elementBindings.test.ts`, 42), and that each element module imports without a DOM and refuses to register without `customElements`. Custom elements themselves need a browser, so the elements' runtime behaviour is covered by the browser checks below.
- **Browser check** (`tools/browser-check/check.mjs`, Playwright). It opens the pages in `ts/examples/` and drives the elements with real clicks, keys and typing: all six elements, form data, required validity, reset, popups, the address cascade, money and phone formatting, tithi and accessible names. It also fails if a page logs a console error or throws. Last run: **28 of 28 checks passed in Chromium 151**.
- **axe-core** (`tools/browser-check/a11y.mjs`): WCAG 2.0 to 2.2 A/AA and best practices on the example pages in 17 states each, light and dark (34 page states), looking into open shadow roots. This run: 0 distinct violations in Chromium, plus the known date-cell finding above.
- The tool's README also records an earlier WebKit run (Playwright's build, 25 of 25, before the tithi checks were added) and says Firefox did not start in the tool sandbox. Only Chromium has run the current 28 checks.
- **Not verified:** Firefox, Safari and iOS, touch input, narrow screens, on-screen keyboards, IME composition beyond a scripted event, paste behaviour beyond a scripted input event, `prefers-reduced-motion`, the light system theme by eye, **real screen readers** (axe finds many problems, not all), and a popup placed near the screen edge.

## Example pages

Build first, then serve `ts/` over HTTP (`cd ts && npm run build`, then for example `python3 -m http.server 5174 --directory ts`, as in `.claude/launch.json`) and open `/examples/<page>.html`:

| Page | Shows |
|---|---|
| `ts/examples/date-picker.html` | Inline English with AD, popup Nepali with `required` and `min`/`max`, dark theme with Monday start and a preset value; the form data. |
| `ts/examples/range-picker.html` | Inline, and popup Nepali `required` with `min` and a preset start. |
| `ts/examples/calendar.html` | Marked days from an attribute, events set from script (Nepali, Monday start), tithi from a `PanchangDataSource`, `show-tithi="false"`. |
| `ts/examples/address.html` | English `required`; Nepali with `show-ward="false"` and the dark theme. |
| `ts/examples/inputs.html` | Money (`Rs.`, `required`; Devanagari with `allow-negative`) and phone (English `required`; Nepali preset). |

For the framework versions, see the example apps in `react/` and `vue/` (Vite, Next.js, Nuxt).

## Related guides

- [Headless widgets](../headless-widgets/README.md): the state machines under the elements.
- [Calendar data](../calendar-data/README.md), [Dates](../dates/README.md), [Tithi](../tithi/README.md): data and types behind the calendar and pickers.
- [Money](../money/README.md), [Phone](../phone/README.md), [Address](../address/README.md): the logic behind the three field elements.
- [USAGE.md](../../USAGE.md): the short version of all modules.
- [React](../../../react/README.md) and [Vue](../../../vue/README.md): the framework wrappers.
- [Flutter](../../../flutter/README.md): the Flutter widgets over the Dart machines.
