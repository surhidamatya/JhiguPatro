# Headless widgets

The headless widgets are framework-free state machines for the form controls of the toolkit: a BS date picker, a date range picker, an address picker, a money input and a phone input. They hold the state and the rules (which day is focused, which month is shown, how an amount is grouped, what is wrong with a phone number) and hand out plain values. They never touch the DOM or Flutter, so you can drive them from React, Vue, a terminal or a test, and build your own UI on top. The web components and the Flutter widgets are thin views over these same machines.

Every machine has the same shape: `getState()`, `subscribe(listener)` and `actions`. Date, address, money and phone logic is shared with the other guides; this guide covers only the state machines.

## When to use it

- You want a BS date picker, range picker, address select, money field or phone field with your own markup, design system or framework.
- You need the keyboard map, the ARIA attributes or the input formatting rules, but not the markup.
- You want to test form behaviour without a browser.

If you want a ready element, use the [web components](../web-components/README.md) (or the [React](../../../react/README.md) and [Vue](../../../vue/README.md) wrappers). For Flutter, use the widgets in [flutter/](../../../flutter/README.md).

## Setup

Install the package and import the entry point you need. Each machine has its own entry point so a bundler only includes what you use (names from `ts/package.json`):

| Machine | Entry point | Factory |
|---|---|---|
| Date picker | `jhigu-patro-utils-ts/date-picker` | `createDatePicker`, `keyAction` |
| Date range picker | `jhigu-patro-utils-ts/range-picker` | `createRangePicker` |
| Address picker | `jhigu-patro-utils-ts/address-picker` | `createAddressPicker` |
| Money input | `jhigu-patro-utils-ts/money-input` | `createMoneyInput` |
| Phone input | `jhigu-patro-utils-ts/phone-input` | `createPhoneInput` |

The caret helper `placeCaret` lives in `ts/src/inputCaret.ts` and has no entry point of its own; it is internal to the money and phone inputs (see [Input caret helper](#input-caret-helper)).

The date and range pickers need the calendar data loaded once at start-up. The address, money and phone inputs do not. In Node, set the calendar up like this (the same as the "Setup" section of [USAGE.md](../../USAGE.md); in a browser use `JsonCalendarDataSource` as shown there):

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

// Node: read the file yourself. (Adjust the path for your project.)
const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));
```

## The pattern

```
const machine = createXxx(options);
machine.getState();                 // the current state, a plain object
const stop = machine.subscribe(fn); // fn(state) on every change; returns an unsubscribe function
machine.actions.something(...);     // the only way to change the state
```

Rules that hold for all five machines (from the header comments of the sources and `data/PICKER_NOTES.md`):

- One notification per state-changing action, with the full new state. An action that changes nothing does not notify.
- `getState()` returns the same object until the next change, so `getState() === getState()`. You can pass `getState` and `subscribe` to a store hook that compares by reference.
- Invalid input throws a typed error and leaves the state and the subscribers untouched.
- Options are read once, when the machine is created. To change `min`, `max`, `weekStartsOn` or `showAd`, create a new machine. Only the language can change later (`setLanguage`).
- Subscribers are called synchronously, inside the action.

## Quick start: date picker

```js test
import { createDatePicker } from 'jhigu-patro-utils-ts/date-picker';

const today = { year: 2082, month: 5, day: 10 };
const picker = createDatePicker({ today });
const seen = [];
const stop = picker.subscribe(state => seen.push(state.title));

picker.getState().title; // => 'Bhadra 2082'
picker.actions.nextMonth();
picker.actions.nextMonth();
picker.getState().title; // => 'Kartik 2082'
seen; // => ['Ashwin 2082', 'Kartik 2082']

picker.actions.select({ year: 2082, month: 7, day: 3 });
picker.getState().value.toString(); // => '2082-07-03'
seen.length; // => 3

picker.actions.setLanguage('en'); // already English: nothing changed, no notification
seen.length; // => 3

stop();
picker.actions.clear();
picker.getState().value; // => null
seen.length; // => 3

const stable = picker.getState() === picker.getState();
stable; // => true
```

`today` is optional. Without it the picker uses today in Nepal. Pass it in tests so results do not depend on the date you run them.

## Reference

### Date picker

`createDatePicker(options)` options (all optional):

| Option | Meaning |
|---|---|
| `value` | Selected date (`{ year, month, day }` or a `NepaliDate`). Must be inside `min`/`max`, else `OUT_OF_RANGE`. |
| `min`, `max` | Earliest and latest selectable day. `min` after `max` gives `INVALID_DATA`. |
| `language` | `'en'` (default) or `'ne'`. |
| `weekStartsOn` | First column, 0 = Sunday to 6 = Saturday. Default 0. Anything else gives `INVALID_DATA`. |
| `showAd` | Add the AD date to cell labels. Default true. |
| `today` | The day treated as today. Default: today in Nepal. |

State (`getState()`):

| Field | Meaning |
|---|---|
| `view` | `'days'`, `'months'` or `'years'`. The UI decides when to switch (the web element cycles days, months, years, days when the title is pressed). |
| `visibleYear`, `visibleMonth` | The month on screen. |
| `title` | `Bhadra 2082` or `भदौ २०८२`. Announce changes with `aria-live="polite"`. |
| `weekdays` | Seven short names, starting at `weekStartsOn`. |
| `grid` | Rows of seven `GridCell`s (5 or 6 rows). See `getMonthGrid`: `bs`, `ad`, `inMonth`, `inRange`, `isToday`, `isWeekend`. Cells of neighbouring months are real dates; where the calendar data ends they are blank (`bs` is null). `isWeekend` is Saturday only; the picker does not take a `weekendDays` option. |
| `months` | 12 items `{ month, label, disabled }`. A month is disabled when every day of it is outside `min`/`max`. |
| `years` | A page of 12 items `{ year, label, disabled }` that contains `visibleYear`. Pages are aligned to the first year of the calendar data, so with data from 2000 the page for 2082 is 2072 to 2083. |
| `value` | The selected `NepaliDate` or null. |
| `focused` | The day the keyboard is on. Initially `value`, else today, clamped into `[min, max]`. |
| `min`, `max` | As given, as `NepaliDate`s. |
| `canGoPrev`, `canGoNext` | False at the edge of the calendar data or at the month of `min`/`max`. |
| `language`, `weekStartsOn`, `showAd` | As set. |

Actions:

| Action | Behaviour |
|---|---|
| `prevMonth()`, `nextMonth()` | Move the focus one month, keeping the day number (clamped to the month length). Do nothing when `canGoPrev`/`canGoNext` is false. |
| `goTo(year, month)` | Show a month; the focus keeps its day number. A month outside `min`/`max` clamps to the nearest allowed one. A month that does not exist gives `INVALID_DATE`; a year outside the data gives `OUT_OF_RANGE`. Does not change `view`. |
| `setView(view)` | Switch between days, months and years. Does not change the month. |
| `select(date)` | Select a day, focus it, return to the `days` view. A disabled day (outside `min`/`max`, or outside the calendar data) throws `OUT_OF_RANGE`. |
| `selectToday()` | `select(today)`. Throws `OUT_OF_RANGE` when today is outside `min`/`max`. |
| `clear()` | `value` becomes null. Focus and the visible month stay. |
| `moveFocus(kind)` | `left`, `right`, `up`, `down` (day, week), `home`, `end` (start and end of the week), `pageUp`, `pageDown` (month), `shiftPageUp`, `shiftPageDown` (year). The result is clamped into `[min, max]`; a move past the calendar data stays where it is. The visible month follows the focus. |
| `setLanguage(language)` | `'en'` or `'ne'`. |

`getCellProps(cell)` is covered under [Accessibility](#accessibility).

### Keyboard map

`keyAction(key, shiftKey)` is a pure function from a DOM `KeyboardEvent.key` to an action name, or null for keys the picker does not use. Wire it to `keydown` on the grid:

| Key | Result | What to do with it |
|---|---|---|
| `ArrowLeft`, `ArrowRight` | `left`, `right` | `moveFocus` (one day) |
| `ArrowUp`, `ArrowDown` | `up`, `down` | `moveFocus` (one week) |
| `Home`, `End` | `home`, `end` | `moveFocus` (start, end of the week) |
| `PageUp`, `PageDown` | `pageUp`, `pageDown` | `moveFocus` (one month) |
| `Shift` + `PageUp`, `PageDown` | `shiftPageUp`, `shiftPageDown` | `moveFocus` (one year) |
| `Enter`, `Space` (`' '` or `'Spacebar'`) | `select` | `select(state.focused)` |
| `Escape` | `close` | Close your popup. The machine has no popup. |
| anything else | null | Ignore |

`Shift` only matters for Page Up and Page Down. `select` and `close` are not focus moves, so `moveFocus` does not take them.

```js test
import { createDatePicker, keyAction } from 'jhigu-patro-utils-ts/date-picker';

keyAction('ArrowLeft'); // => 'left'
keyAction('PageUp'); // => 'pageUp'
keyAction('PageUp', true); // => 'shiftPageUp'
keyAction('PageDown', true); // => 'shiftPageDown'
keyAction(' '); // => 'select'
keyAction('Escape'); // => 'close'
keyAction('Tab'); // => null

// The whole keyboard layer of a UI is this function.
function onKeyDown(picker, event) {
  const action = keyAction(event.key, event.shiftKey);
  if (action === null || action === 'close') return action;
  if (action === 'select') picker.actions.select(picker.getState().focused);
  else picker.actions.moveFocus(action);
  return action;
}

const picker = createDatePicker({ today: { year: 2082, month: 5, day: 10 } });
onKeyDown(picker, { key: 'End', shiftKey: false }); // => 'end'
picker.getState().focused.toString(); // => '2082-05-14'
onKeyDown(picker, { key: 'Home', shiftKey: false }); // => 'home'
picker.getState().focused.toString(); // => '2082-05-08'
onKeyDown(picker, { key: 'PageDown', shiftKey: false }); // => 'pageDown'
picker.getState().title; // => 'Ashwin 2082'
onKeyDown(picker, { key: 'PageUp', shiftKey: true }); // => 'shiftPageUp'
picker.getState().focused.toString(); // => '2081-06-08'
onKeyDown(picker, { key: 'Enter', shiftKey: false }); // => 'select'
picker.getState().value.toString(); // => '2081-06-08'
```

### Date range picker

`createRangePicker(options)` takes the date picker options except `value`, plus `start` and `end`. An `end` without a `start`, or an `end` before the `start`, gives `INVALID_DATA`. Both ends are checked against `min`/`max`.

It reuses the date picker for the month view, focus, keyboard moves and labels, so the state has the same fields except `value`, plus:

| Field | Meaning |
|---|---|
| `start`, `end` | `NepaliDate` or null. |
| `phase` | `'start'` when the next click chooses a start, `'end'` when it chooses the end. |
| `complete` | True when both are set. |
| `hovered` | The day under the pointer, or null. |
| `previewEnd` | While `phase` is `'end'`: the hovered day, else the focused day (so keyboard users get the same preview). Otherwise null. |

Selection rules (`select(date)`): the first click sets the start. A click on or after the start sets the end. A click before the start restarts from that day. A click on a complete range starts a new one. The same day twice gives a one-day range.

Actions: all the date picker navigation (`prevMonth`, `nextMonth`, `goTo`, `setView`, `moveFocus`, `setLanguage`), plus `select`, `selectFocused()` (Enter and Space), `selectToday()` (treated as a click), `setRange(start, end)`, `hover(date | null)` and `clear()`. `setRange` checks both ends against `min`/`max` and the order before it changes anything; the view moves to the month of the end. A disabled day in `select` throws `OUT_OF_RANGE`.

`getCellProps(cell)` returns the date picker props plus `rangePosition` (`'start'`, `'middle'`, `'end'`, `'single'` or null) and `inPreview` (days after the start up to and including `previewEnd`, only while choosing the end). `aria-selected` is true for every day in the range, including the days in between.

```js test
import { createRangePicker } from 'jhigu-patro-utils-ts/range-picker';

const today = { year: 2082, month: 5, day: 10 };
const day = (d, m = 5) => ({ year: 2082, month: m, day: d });
const range = createRangePicker({ today });
const cellOf = (state, bs) => state.grid.flat().find(c => c.bs && c.bs.toString() === bs);

range.actions.select(day(8));
range.getState().phase; // => 'end'
range.getState().complete; // => false

range.actions.hover(day(12));
const preview = range.getState();
preview.previewEnd.toString(); // => '2082-05-12'
range.getCellProps(cellOf(preview, '2082-05-08')).rangePosition; // => 'start'
range.getCellProps(cellOf(preview, '2082-05-10')).inPreview; // => true
range.getCellProps(cellOf(preview, '2082-05-13')).inPreview; // => false

range.actions.select(day(5)); // before the start: restarts
range.getState().start.toString(); // => '2082-05-05'
range.getState().end; // => null

range.actions.select(day(19));
range.getState().complete; // => true
range.getState().previewEnd; // => null
const done = range.getState();
range.getCellProps(cellOf(done, '2082-05-12')).rangePosition; // => 'middle'
range.getCellProps(cellOf(done, '2082-05-12'))['aria-selected']; // => true
range.getCellProps(cellOf(done, '2082-05-19')).rangePosition; // => 'end'

range.actions.select(day(20)); // complete range: a click starts a new one
range.getState().start.toString(); // => '2082-05-20'
range.getState().end; // => null
range.actions.select(day(20));
range.getCellProps(cellOf(range.getState(), '2082-05-20')).rangePosition; // => 'single'

range.actions.setRange(day(8), day(2, 6));
range.getState().title; // => 'Ashwin 2082'
'value' in range.getState(); // => false
```

### Address picker

`createAddressPicker(options)`: `value` (`{ localLevelId, ward }` to restore a saved selection), `language` (`'en'` or `'ne'`), `showWard` (default true).

| State field | Meaning |
|---|---|
| `provinceId`, `districtId`, `localLevelId`, `ward` | The choice so far; null when not chosen. |
| `provinces` | Always all provinces. |
| `districts` | Districts of the chosen province; empty until one is chosen. |
| `localLevels` | Local levels of the chosen district; empty until one is chosen. |
| `wards` | `[1..n]` for the chosen local level; empty until one is chosen. |
| `complete` | A local level is chosen and, when `showWard`, a ward too. |
| `selection` | `{ provinceId, districtId, localLevelId, ward }` when complete, else null. |
| `language`, `showWard` | As set. |

Items carry both names: show `item[state.language]` (`item.en` or `item.ne`).

Actions: `selectProvince(id | null)`, `selectDistrict(id | null)`, `selectLocalLevel(id | null)`, `selectWard(ward | null)`, `clear()`, `setLanguage(language)`.

- Choosing a province clears district, local level and ward. Choosing a district clears local level and ward. Choosing a local level clears the ward, because ward counts differ per local level.
- Choosing a child with no parent chosen fills the parents from the data, so a saved local level is restored in one call.
- Choosing what is already chosen does nothing.
- Unknown ids throw `AddressError` with `UNKNOWN_PROVINCE`, `UNKNOWN_DISTRICT` or `UNKNOWN_LOCAL_LEVEL`. A ward outside `1..wards`, or a ward with no local level chosen, throws `BAD_WARD`. `error.localized('ne')` gives the message in Nepali.
- A machine created with `showWard: false` still keeps a `ward` you pass in `value`. The `<jhigu-address-select>` element drops it before creating the machine.

```js test
import { createAddressPicker } from 'jhigu-patro-utils-ts/address-picker';

const codeOf = fn => { try { fn(); return null; } catch (e) { return e.code; } };

const picker = createAddressPicker();
let renders = 0;
picker.subscribe(() => { renders++; });

picker.actions.selectProvince(3);
picker.getState().provinces.length; // => 7
picker.getState().districts.length; // => 13
picker.actions.selectProvince(3); // same again: no change, no notification
renders; // => 1

picker.actions.selectDistrict(23);
picker.getState().localLevels.length; // => 4
picker.actions.selectLocalLevel(274);
picker.getState().localLevels.find(l => l.id === 274).en; // => 'Bhaktapur Municipality'
picker.getState().wards.length; // => 10
picker.getState().complete; // => false
picker.actions.selectWard(1);
picker.getState().selection; // => { provinceId: 3, districtId: 23, localLevelId: 274, ward: 1 }

codeOf(() => picker.actions.selectWard(999)); // => 'BAD_WARD'
codeOf(() => picker.actions.selectProvince(99)); // => 'UNKNOWN_PROVINCE'
picker.getState().selection.ward; // => 1

picker.actions.selectProvince(1); // a different province clears everything below
picker.getState().districtId; // => null
picker.getState().selection; // => null

// Restore a saved address in one call; the parents are filled in.
const saved = createAddressPicker({ value: { localLevelId: 274, ward: 3 } });
saved.getState().provinceId; // => 3
saved.getState().selection.ward; // => 3
codeOf(() => createAddressPicker({ value: { localLevelId: 1, ward: 99 } })); // => 'BAD_WARD'

const noWard = createAddressPicker({ showWard: false });
noWard.actions.selectLocalLevel(1);
noWard.getState().complete; // => true
noWard.getState().selection; // => { provinceId: 1, districtId: 1, localLevelId: 1, ward: null }
```

### Money input

`createMoneyInput(options)`: `value` (an `Npr`), `digits` (`'ascii'` default, or `'native'` for Devanagari digits in the text), `allowNegative` (default false).

State: `text` (what to show), `caret` (where the caret belongs in `text`), `value` (an `Npr` or null while the field is empty or only `-`), `digits`, `allowNegative`.

Actions:

| Action | Behaviour |
|---|---|
| `input(text, caret?)` | The user changed the field. `text` is the raw field value, `caret` the caret in it (default: the end). Reformats `text` and moves `caret`. |
| `blur()` | Pads to two decimals (`1,234.5` becomes `1,234.50`, `1,234.` becomes `1,234.00`, `0` becomes `0.00`). A lone `-` is cleared. |
| `setValue(npr \| null)` | Set the amount from code (`auto` decimals). A negative amount throws `INVALID_ARGUMENT` unless `allowNegative`. |
| `clear()` | Empty the field. |

What `input` does to the text:

- Lakh grouping on every change (`12,34,567`).
- Devanagari digits are accepted and shown as ASCII, unless `digits: 'native'`.
- Dropped: every character that is not a digit or the first `.`; digits after the second decimal place; leading zeros (`007` becomes `7`). A leading `Rs.`, `NPR` or `रु` (any case) is ignored, not kept. A lone `.` becomes `0.`. A leading `-` is kept only with `allowNegative`.
- The caret is placed after the same number of significant characters (digits, `.`, `-`) that were to its left, so typing in the middle of a number does not jump.
- A change that would pass the largest amount (2^53-1 paisa) is ignored: the state, the caret and the subscribers are untouched. Write `state.text` back to the field after every `input` so an ignored change is undone on screen.

```js test
import { createMoneyInput } from 'jhigu-patro-utils-ts/money-input';
import { Npr } from 'jhigu-patro-utils-ts';

const codeOf = fn => { try { fn(); return null; } catch (e) { return e.code; } };

const money = createMoneyInput();
let renders = 0;
money.subscribe(() => { renders++; });

money.actions.input('1234567.5', 9);
money.getState().text; // => '12,34,567.5'
money.getState().caret; // => 11
money.getState().value.paisa; // => 123456750
money.actions.blur();
money.getState().text; // => '12,34,567.50'
renders; // => 2

// Typing a 9 after "1,23," in the middle of 1,23,456: the caret stays after the 9.
const mid = createMoneyInput();
mid.actions.input('1,23,456');
mid.actions.input('1,23,9456', 6);
mid.getState().text; // => '12,39,456'
mid.getState().caret; // => 5

const junk = createMoneyInput();
junk.actions.input('Rs. 1500', 8);
junk.getState().text; // => '1,500'
junk.actions.input('007');
junk.getState().text; // => '7'
junk.actions.input('.');
junk.getState().text; // => '0.'
junk.actions.input('12.345');
junk.getState().text; // => '12.34'
junk.actions.input('१२३४५');
junk.getState().text; // => '12,345'

const native = createMoneyInput({ digits: 'native' });
native.actions.input('1234567.5');
native.getState().text; // => '१२,३४,५६७.५'
native.getState().value.paisa; // => 123456750

const signed = createMoneyInput({ allowNegative: true });
signed.actions.input('-1234.5');
signed.getState().value.paisa; // => -123450
const unsigned = createMoneyInput();
unsigned.actions.input('-5');
unsigned.getState().text; // => '5'

// The largest amount is 90,07,19,92,54,74,099.91 rupees (2^53 - 1 paisa).
const big = createMoneyInput();
big.actions.input('90071992547409.91');
big.getState().value.paisa; // => 9007199254740991
big.actions.input('90071992547409.92'); // one paisa more: ignored
big.getState().text; // => '9,00,71,99,25,47,409.91'

codeOf(() => unsigned.actions.setValue(Npr.fromPaisa(-5))); // => 'INVALID_ARGUMENT'
unsigned.actions.setValue(Npr.fromPaisa(1234567));
unsigned.getState().text; // => '12,345.67'
```

### Phone input

`createPhoneInput(options)`: `language` (`'en'` or `'ne'`), `allowInactive` (accept prefixes whose carrier no longer operates, default false), `value` (initial text; not an event).

State:

| Field | Meaning |
|---|---|
| `text`, `caret` | What to show and where the caret belongs. |
| `e164` | `+9779841234567` when the number is valid, else null. |
| `national` | `984-1234567` or `01-4123456` when valid, else null. |
| `valid` | True when the full number passes `parsePhone`. |
| `type` | `'mobile'` once 3 digits of a mobile-like number are typed, `'landline'` once 2 digits of a landline-like number are typed; the parsed type when valid. |
| `carrier` | Carrier name once the 3-digit mobile prefix is known. |
| `areaCode` | Landline area code once known, without the trunk 0. |
| `error` | A `PhoneErrorCode` when the problem is already known, else null. |
| `message` | `error` in `language` from the string tables. |
| `touched` | True after `blur()`. |

Actions: `input(text, caret?)`, `blur()`, `setValue(text)`, `clear()`, `setLanguage(language)`.

How it formats:

- Devanagari digits are converted. Everything except digits and a leading `+` is dropped.
- A number whose first two digits can start a known mobile prefix (96, 97, 98, 90), or a lone 9, is a mobile: up to 10 digits, shown `984-1234567`, a leading trunk 0 dropped. Anything else is a landline: 8 digits, hyphen after the area code (`1-4123456`, `061-520123`; `10` and `11` are two-digit areas). The trunk 0 is kept only if the user typed it.
- `+977`, `00977`, and `977` in front of more than 10 digits become a `+977 ` prefix.
- Errors appear as soon as they are known: an unknown mobile prefix or area code, an invalid third digit of an area code, an inactive prefix (`INACTIVE_PREFIX`, lifted by `allowInactive`), a foreign country code (`BAD_PREFIX`). `TOO_SHORT` is reported only after `blur()`.
- Over-long numbers are kept, not cut: `98412345678` stays `984-12345678` with `TOO_LONG`. Cutting the extra digit would turn a typo into a different valid number. At most 15 digits are kept.

```js test
import { createPhoneInput } from 'jhigu-patro-utils-ts/phone-input';

const phone = createPhoneInput();
let renders = 0;
phone.subscribe(() => { renders++; });

phone.actions.input('9841234', 7);
phone.getState().text; // => '984-1234'
phone.getState().carrier; // => 'NTC'
phone.getState().valid; // => false
phone.getState().error; // => null
phone.actions.input('9841234', 7); // same text and caret: nothing changed
renders; // => 1

phone.actions.input('9841234567');
phone.getState().text; // => '984-1234567'
phone.getState().e164; // => '+9779841234567'
phone.getState().national; // => '984-1234567'
phone.getState().type; // => 'mobile'

const short = createPhoneInput();
short.actions.input('984123');
short.getState().error; // => null
short.actions.blur();
short.getState().error; // => 'TOO_SHORT'
short.getState().message; // => 'Phone number is too short'

const nepali = createPhoneInput({ language: 'ne' });
nepali.actions.input('984');
nepali.actions.blur();
nepali.getState().message; // => 'फोन नम्बर धेरै छोटो छ'
nepali.actions.setLanguage('en');
nepali.getState().message; // => 'Phone number is too short'

const long = createPhoneInput();
long.actions.input('98412345678');
long.getState().text; // => '984-12345678'
long.getState().error; // => 'TOO_LONG'

const forms = createPhoneInput();
forms.actions.input('+9779841234567');
forms.getState().text; // => '+977 984-1234567'
forms.actions.input('९८४१२३४५६७');
forms.getState().e164; // => '+9779841234567'
forms.actions.input('09841234567');
forms.getState().text; // => '984-1234567'

const landline = createPhoneInput();
landline.actions.input('014123456');
landline.getState().text; // => '01-4123456'
landline.getState().areaCode; // => '1'
landline.getState().type; // => 'landline'
landline.getState().e164; // => '+97714123456'

const inactive = createPhoneInput();
inactive.actions.input('9881234567');
inactive.getState().error; // => 'INACTIVE_PREFIX'
const lenient = createPhoneInput({ allowInactive: true });
lenient.actions.input('9881234567');
lenient.getState().e164; // => '+9779881234567'

const foreign = createPhoneInput();
foreign.actions.input('+14155550123');
foreign.getState().error; // => 'BAD_PREFIX'
```

### Input caret helper

`placeCaret(text, count, isSignificant)` returns the index just after the `count`-th significant character of `text` (0 when `count <= 0`, `text.length` when there are fewer). The money and phone inputs use it to keep the caret in place after reformatting; you do not call it yourself, because `state.caret` already has the answer. It is not exported from the package entry points. Dart has the same function in `dart/lib/src/input_caret.dart`.

## Accessibility

What the machines hand out:

- **Day cells.** `getCellProps(cell)` returns `role: 'gridcell'`, `aria-selected`, `aria-disabled`, `aria-label` and a roving `tabIndex` (0 only for the focused cell, -1 for the rest). The label has the weekday, day, month and year, plus the AD date when `showAd` is on: `Tuesday, 10 Bhadra 2082 (AD 26 August 2025)`. In Nepali the BS part uses Devanagari digits and the AD part keeps ASCII digits. A blank cell gets an empty label and `aria-disabled: true`. In the range picker `aria-selected` covers the whole range.
- **Title.** `state.title` is the string to announce when the month changes; put it in an `aria-live="polite"` region.
- **Translated words.** The strings for "Previous month", "Next month", "Select month", "Select year", "Today", "Clear" and "No events" are in the string tables (`getStrings(language).picker`, exported from `jhigu-patro-utils-ts`). Do not hard-code these labels.
- **Phone input.** `message` is the localized error text. Show it in an `aria-live` region and set `aria-invalid` on the field while it is non-null (this is what `<jhigu-phone-input>` does).

What the machines do not do: they render nothing, so the roles of the container (`grid`, `row`, `columnheader`), the labels of the buttons, focus management and the popup are yours. When you re-render, put DOM focus back on the cell with `tabIndex` 0. For a working reference of all of this, read `ts/src/elements/pickerMarkup.ts`; the [web components guide](../web-components/README.md) lists what it renders.

Not done: `prefers-reduced-motion` handling and `aria-live` wiring (the machines only supply the title string).

## Dart equivalents

The Dart classes are in `dart/lib/src/` and exported from `package:jhigu_patro_utils/jhigu_patro_utils.dart`. They have the same rules and read the same shared vectors in `testdata/` (`date-picker.json`, `range-picker.json`, `address-picker.json`, `money-input.json`, `phone-input.json`).

| TypeScript | Dart | File |
|---|---|---|
| `createDatePicker`, `keyAction` | `DatePicker`, `keyAction` | `date_picker.dart` |
| `createRangePicker` | `RangePicker` | `range_picker.dart` |
| `createAddressPicker` | `AddressPicker` | `address_picker.dart` |
| `createMoneyInput` | `MoneyInput` | `money_input.dart` |
| `createPhoneInput` | `PhoneInput` | `phone_input.dart` |
| `placeCaret` | `placeCaret` | `input_caret.dart` |

Differences in shape (the behaviour is the same):

- `picker.state` is a getter, not `getState()`. `subscribe(listener)` returns a function that unsubscribes.
- There is no `actions` object: the actions are methods on the machine (`picker.nextMonth()`).
- Options are named constructor arguments. `language` is a `String` (`'en'` or `'ne'`).
- Enums replace string unions: `PickerView`, `FocusMove`, `KeyAction`, `RangePhase`, `RangePosition`, `MoneyDigits`. `keyAction('PageDown', shift: true)` returns `KeyAction.shiftPageDown`.
- Cell props and states are classes with the same fields in camelCase (`ariaLabel`, `ariaSelected`, `tabIndex`). `RangePickerState` keeps the month fields in `state.base` and also forwards the common ones (`title`, `grid`, `focused`, and so on); `RangeCellProps` forwards the cell fields.
- Errors: `JhiguException` subclasses (`OutOfRangeException`, `InvalidDateException`, `InvalidDataException`) with a `code` string, `AddressException` with `code.name_`, `MoneyException`, `PhoneException`. The codes are the same as in TypeScript.
- Dates are `NepaliDate.checked(year, month, day)` instead of `{ year, month, day }` objects.
- Phone `error` is a `PhoneErrorCode` enum; use `error?.name_` for the shared code text (`TOO_SHORT`).

```dart
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

// After NepaliCalendar.initialize(InlineCalendarDataSource(...)):
final picker = DatePicker(today: NepaliDate.checked(2082, 5, 10));
var renders = 0;
final stop = picker.subscribe((_) => renders++);
picker.state.title;                              // Bhadra 2082
picker.nextMonth();
picker.select(NepaliDate.checked(2082, 6, 3));
picker.state.value!.toIsoString();               // 2082-06-03
renders;                                         // 2
keyAction('PageDown', shift: true);              // KeyAction.shiftPageDown
stop();

final money = MoneyInput();
money.input('1234567.5');
money.state.text;                                // 12,34,567.5
money.blur();
money.state.text;                                // 12,34,567.50
money.state.value!.paisa;                        // 123456750

final phone = PhoneInput();
phone.input('9841234567');
phone.state.carrier;                             // NTC
phone.state.e164;                                // +9779841234567
```

The values in this sample were produced by running it. Dart samples are not run by the test suite.

## Flutter widgets

The Flutter package in [flutter/](../../../flutter/README.md) depends on `../dart` by path and wraps these Dart machines: `JhiguDatePicker` and `JhiguRangePicker` (over `DatePicker` and `RangePicker`), `JhiguAddressPicker` (over `AddressPicker`), and `JhiguMoneyField` and `JhiguPhoneField` (a `TextField` whose formatter runs every edit through `MoneyInput` or `PhoneInput` and returns the machine's text and caret). `JhiguCalendar`, the dialogs and the date fields are built on the same pickers. Use the machines directly when you need a different widget; use the Flutter package when you want the widgets. The widget behaviour, props and what was checked are in the Flutter README, not here.

## Recipes

### 1. Use a machine with React (or any store-based framework)

`getState` and `subscribe` have the shape `useSyncExternalStore` wants, and `getState()` is reference-stable between changes (checked above). This sample is not run:

```tsx
import { useSyncExternalStore } from 'react';
import { createDatePicker } from 'jhigu-patro-utils-ts/date-picker';

const picker = createDatePicker({ language: 'ne' }); // create once, e.g. in useRef or module scope

function useMachine<S>(m: { getState(): S; subscribe(l: (s: S) => void): () => void }): S {
  return useSyncExternalStore(m.subscribe, m.getState);
}

function Title() {
  const state = useMachine(picker);
  return <h2 aria-live="polite">{state.title}</h2>;
}
```

For ready-made React and Vue components, see the [React](../../../react/README.md) and [Vue](../../../vue/README.md) packages.

### 2. A text calendar, for a terminal or a test

The grid and the labels are enough to draw a calendar with no DOM:

```js test
import { createDatePicker } from 'jhigu-patro-utils-ts/date-picker';

function draw(state) {
  const rows = state.grid.map(row => row
    .map(c => (!c.bs || !c.inMonth ? '    ' : String(c.bs.day).padStart(2) + (c.bs.isSame(state.focused) ? '*' : ' ') + ' '))
    .join(''));
  return [state.title, state.weekdays.join(' '), ...rows].join('\n');
}

const picker = createDatePicker({ today: { year: 2082, month: 5, day: 10 } });
const text = draw(picker.getState());
text.split('\n')[0]; // => 'Bhadra 2082'
text.split('\n')[2]; // => ' 1   2   3   4   5   6   7  '
text.split('\n')[3]; // => ' 8   9  10* 11  12  13  14  '
text.split('\n').length; // => 7
```

### 3. A booking range that starts today

Set `min` to today so earlier days are disabled and `prevMonth` stops at this month:

```js test
import { createRangePicker } from 'jhigu-patro-utils-ts/range-picker';

const today = { year: 2082, month: 5, day: 10 };
const booking = createRangePicker({ today, min: today });
booking.getState().canGoPrev; // => false
const early = booking.getState().grid.flat().find(c => c.bs && c.bs.toString() === '2082-05-09');
booking.getCellProps(early)['aria-disabled']; // => true

let code = null;
try { booking.actions.select({ year: 2082, month: 5, day: 9 }); } catch (e) { code = e.code; }
code; // => 'OUT_OF_RANGE'

booking.actions.select({ year: 2082, month: 5, day: 12 });
booking.actions.select({ year: 2082, month: 5, day: 15 });
booking.getState().start.toString(); // => '2082-05-12'
booking.getState().end.toString(); // => '2082-05-15'
```

### 4. A controlled money field (DOM glue)

Feed `input` the raw value and caret, then write the machine's text and caret back. Not run (it needs a DOM):

```js
const field = document.querySelector('input');
const money = createMoneyInput();
field.addEventListener('input', () => {
  money.actions.input(field.value, field.selectionStart ?? field.value.length);
  const { text, caret } = money.getState();
  field.value = text;                  // also undoes a change the machine ignored
  field.setSelectionRange(caret, caret);
});
field.addEventListener('blur', () => {
  money.actions.blur();
  field.value = money.getState().text;
});
// Send money.getState().value?.paisa to your server: an integer, never a float.
```

Skip the handler while an IME is composing (`compositionstart` to `compositionend`), as `<jhigu-money-input>` does.

### 5. Restore a saved address into a form

Store only `localLevelId` and `ward`. On load, create the picker with `value` and read the parents from the state (see the address sample above). If the saved ids are no longer valid, catch `AddressError` and start with an empty picker.

### 6. A phone field that submits E.164

Show `state.text`, show `state.carrier` as a badge, show `state.message` under the field, and submit `state.e164` only when it is not null. Call `blur()` when the field loses focus so a short number reports `TOO_SHORT`.

## Errors and edge cases

| Machine | Throws | When |
|---|---|---|
| Date picker | `JhiguError` `OUT_OF_RANGE` | `value` or `select` outside `min`/`max` or the calendar data; `goTo` with a year outside the data; `selectToday` when today is outside `min`/`max` |
| | `INVALID_DATE` | `goTo` with a month that does not exist |
| | `INVALID_DATA` | `min` after `max`; `weekStartsOn` not an integer from 0 to 6 |
| Range picker | the same, plus `INVALID_DATA` | `end` without `start`; `end` before `start` (options or `setRange`) |
| Address picker | `AddressError` | `UNKNOWN_PROVINCE`, `UNKNOWN_DISTRICT`, `UNKNOWN_LOCAL_LEVEL`, `BAD_WARD` |
| Money input | `MoneyError` `INVALID_ARGUMENT` | `setValue` with a negative amount when `allowNegative` is false |
| Phone input | nothing | Problems are in `state.error` and `state.message`, not thrown |

Edge cases:

- A rejected action leaves the state and the subscribers untouched. This is tested explicitly for the range picker (`rejected select leaves the state and subscribers untouched`); the shared date picker scenarios check the state after each error step.
- A focus move past the first or last day of the calendar data (BS 2000 to 2100) stays where it is.
- `prevMonth` and `nextMonth` do nothing when the neighbouring month is entirely disabled.
- `getCellProps` accepts any cell of `state.grid`. Cells of neighbouring months have a date and full props; the web element draws them as blank, hidden cells.
- Subscribers added or removed during a notification do not break it (the machines iterate over a copy).
- Years after 2083 are not verified against an official calendar; see below.

## Accuracy, limits and known gaps

From `data/PICKER_NOTES.md`:

- The machines are not yet in a separate headless package. They are entry points of `jhigu-patro-utils-ts`.
- Choices the original spec did not make (these are decisions of this repo): same-day clamping on month moves, disabled-day rules, `goTo` clamping, the years page alignment, and Devanagari digits in Nepali labels with ASCII digits in the AD part.
- **Not done (date picker):** a calendar widget behaviour spec, `prefers-reduced-motion` handling, and `aria-live` wiring (only the `title` string is provided).
- **Not done (range picker):** a maximum or minimum range length, disabled days inside a range, preset ranges (this week, this month).
- **Not done (money and phone):** a fixed-length mask mode, and paste handling beyond what `input` does.
- **Money:** the Devanagari-to-ASCII output is the repo's reading of the guide's "convert them". Symbols are stripped only at the start of the text.
- **Phone:** a mobile prefix that is not in `data/phone-prefixes.json` is reported as `BAD_PREFIX`; that data is best effort (see `data/PHONE_NOTES.md`). Carrier names and active flags are unofficial. The Nepali messages are unreviewed by a native speaker.
- **Address:** names and ward counts are best effort (`data/ADDRESS_NOTES.md`). The Nepali province names in `data/address.json` are the old numbered names (`प्रदेश न. १`) while the English names are `Koshi Province`.
- **Vectors:** `testdata/date-picker.json`, `range-picker.json`, `money-input.json` and `phone-input.json` are hand-derived (with an independent Python model for the date and range pickers), not copied from an official source. The phone input is also tested against every valid and invalid vector of `testdata/phone.json`.
- Nepali labels (months, weekdays, messages) are unreviewed by a native speaker; short Nepali month names are ambiguous.

## How it is tested

- TypeScript: `ts/tests/datePicker.test.ts` (52 tests), `rangePicker.test.ts` (29), `addressPicker.test.ts` (22), `moneyInput.test.ts` (32) and `phoneInput.test.ts` (35). They read the shared vectors in `testdata/` and check notification counts, rejected actions and the caret. All passed when this guide was written (`cd ts && npx vitest run`).
- Dart: `dart/test/date_picker_test.dart`, `range_picker_test.dart`, `address_picker_test.dart`, `money_input_test.dart` and `phone_input_test.dart` read the same vectors. Those five files passed (169 tests in total) when this guide was written (`cd dart && dart test`).
- Samples in this guide: the `js test` blocks are run by `ts/tests/docs.test.ts`, in order, in one session. The Dart sample was run by hand once; it is not part of the suite.
- Not tested here: use of the machines inside React, Vue or Flutter apps beyond the wrapper and widget tests in those packages; real keyboards and assistive technology.

## Related guides

- [Web components](../web-components/README.md): the six custom elements built on these machines.
- [Dates](../dates/README.md), [Calendar data](../calendar-data/README.md): the `NepaliDate` type and the data the pickers need.
- [Money](../money/README.md), [Phone](../phone/README.md), [Address](../address/README.md): the logic behind the money, phone and address machines.
- [USAGE.md](../../USAGE.md): the short version of all modules.
- [React](../../../react/README.md), [Vue](../../../vue/README.md), [Flutter](../../../flutter/README.md): the framework layers.
