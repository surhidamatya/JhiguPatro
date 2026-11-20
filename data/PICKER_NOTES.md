# Headless date picker notes (guide 15.1, U-4)

`createDatePicker` (TS, entry `./date-picker`) and `DatePicker` (Dart) are framework-free state
machines built on `NepaliDate` and `getMonthGrid`. No DOM, no Flutter. Same subscribe/notify model
as the address picker: one notification per state-changing action, none for no-ops, typed errors
leave the state unchanged. Not yet in a separate `@jhigu-patro/headless` package (the repo is not
restructured).

## Implemented
- State: `view`, `visibleYear/Month`, `title`, `weekdays` (short, from `weekStartsOn`), `grid`
  (a `getMonthGrid` result), `months` (12 items), `years` (a page of 12), `value`, `focused`, `min`,
  `max`, `canGoPrev`, `canGoNext`.
- Actions: `prevMonth`, `nextMonth`, `goTo(year, month)`, `setView`, `select`, `clear`, `selectToday`,
  `moveFocus(kind)`, plus `setLanguage`.
- Keyboard map as a pure function `keyAction(key, shift)` (DOM `key` names): arrows, Home/End (start and
  end of the week), Page Up/Down (month), Shift+Page Up/Down (year), Enter/Space select, Escape close.
- `getCellProps(cell)`: `role="gridcell"`, `aria-selected`, `aria-disabled`, `aria-label` (weekday, day,
  month, year, plus the AD date when `showAd`, using `format.dualPattern`), and a roving `tabIndex`
  (0 only for the focused cell).

## Decisions (guide silent)
- Previous/next month and Page Up/Down keep the same day number, clamped to the month length; the
  focus is then clamped into `[min, max]`.
- Disabled = outside `min`/`max`, or outside the calendar data. Focus moves stop at the edge (clamp to
  min/max; stay put at the data edge). `prevMonth`/`nextMonth` do nothing when the neighbouring month is
  entirely disabled. `select` of a disabled date throws `OUT_OF_RANGE`; `goTo` into a month outside
  min/max clamps to the nearest allowed month.
- `goTo` does not change `view`; `select` returns to the `days` view. The UI chooses when to switch
  views after picking a month or year.
- `value` must lie inside `min`/`max` (else `OUT_OF_RANGE`); `min` after `max` gives `INVALID_DATA`.
  Initial focus is `value`, else today, clamped.
- The years page is 12 years aligned to the first year of the calendar data (2000 -> 2000-2011, ... 2072-2083).
- Labels use Devanagari digits in Nepali; the AD part of the label keeps ASCII digits (see DATES_NOTES.md).
- Nepali weekday header uses `weekdaysShort`, which is fine for weekdays (the ambiguous short names are
  only the months).

## Not done
- Calendar widget behaviour spec, Stencil/React/Flutter widgets, `prefers-reduced-motion`
  handling (needs a UI), `aria-live` title wiring (the `title` string is provided).
- Vectors (`testdata/date-picker.json`) are hand-derived with an independent Python day model, not from
  an official source.

# Headless range picker

`createRangePicker` (TS, entry `./range-picker`) and `RangePicker` (Dart) compose the date picker for the
month view, focus, keyboard moves, `min`/`max` and ARIA labels, and add the two-click range logic. The
guide only names the element (`<jhigu-date-range-picker>`, props `start`, `end`, `min`, `max`,
`language`), so the behaviour below is my design.

- **Selection:** first click = start (`phase: 'end'`); a click on or after the start = end (`complete`);
  a click before the start restarts from that day; a click on a complete range starts a new one. Same
  day twice gives a one-day range (`rangePosition: 'single'`).
- **Preview:** while choosing the end, `previewEnd` is the hovered day, else the focused day, so keyboard
  users get the same preview. `getCellProps(cell)` returns the date picker props plus `rangePosition`
  (`start`/`middle`/`end`/`single`/null) and `inPreview` (days after the start up to `previewEnd`);
  `aria-selected` is true for every day in the range.
- **Actions:** all date picker navigation (`prevMonth`, `nextMonth`, `goTo`, `setView`, `moveFocus`,
  `setLanguage`), plus `select`, `selectFocused` (Enter/Space), `selectToday`, `setRange(start, end)`,
  `hover(date|null)` and `clear`. The single-value `value` of the date picker is not exposed.
- **Errors:** `select` of a disabled day gives `OUT_OF_RANGE`; `setRange` with the end before the start
  gives `INVALID_DATA` and checks both ends against min/max before changing anything; an `end` without a
  `start`, or an end before the start, in the options gives `INVALID_DATA`. Rejected actions leave state
  and subscribers untouched (tested).
- Notification model as the other pickers: one event per state-changing action, none for no-ops.
- Not done: maximum/minimum range length, disabled days inside a range, preset ranges (this week, this
  month), the widgets themselves.
- Vectors (`testdata/range-picker.json`, 19 scenarios, 4 init errors): expected values from a small
  independent Python model of these rules, not from an official source.

# Headless money and phone inputs (guide 15.1, P2)

`createMoneyInput` / `MoneyInput` and `createPhoneInput` / `PhoneInput` (TS entries `./money-input`,
`./phone-input`; shared caret helper `placeCaret`). Same subscribe/notify model as the pickers. The
UI feeds `input(text, caret)` on every change and writes `state.text` and `state.caret` back.

## Money input
- Lakh grouping on every change; the caret is placed after the same number of significant
  characters (digits, `.`, `-`) that were to its left. Devanagari digits are accepted and shown as
  ASCII (`digits: 'native'` shows Devanagari). The guide says "convert them"; ASCII output is my reading.
- Dropped: every other character; a second `.`; decimals past two; leading zeros (`007` -> `7`). A
  leading `Rs.`/`NPR`/`रु` is ignored (the guide's parser strips symbols anywhere; here only at the
  start, as in `Npr.parse`). `.` -> `0.`. A leading `-` only with `allowNegative` (default false).
- A change that would pass the largest amount (2^53-1 paisa) is ignored (state and caret stay).
- `blur()` pads to two decimals (`1,234.5` -> `1,234.50`, `1,234.` -> `1,234.00`, `0` -> `0.00`) and
  clears a lone `-`. `setValue(Npr|null)` writes the amount with `auto` decimals and throws
  `INVALID_ARGUMENT` for a negative amount unless allowed.

## Phone input
- Uses `parsePhone` for the verdict on a complete number; the rest is partial-input handling.
- Shapes: a number whose first two digits can start a known mobile prefix (96, 97, 98, 90) or a lone
  9 is a mobile (10 digits, `984-1234567`, trunk 0 dropped). Anything else is a landline (8 digits,
  area-length hyphen: `1-4123456`, `061-520123` with the trunk 0 only if typed, `10`/`11` have a
  two-digit area). `+977`, `00977` and `977` before more than 10 digits become `+977 `.
- Errors as early as they are known: unknown mobile prefix or area code, invalid third digit of the
  area code, inactive prefix (`allowInactive` lifts it) -> `BAD_PREFIX` / `INACTIVE_PREFIX`; a
  foreign country code -> `BAD_PREFIX`. `TOO_SHORT` only after `blur()`.
- **Over-long numbers are kept, not cut:** `98412345678` stays `984-12345678` with `TOO_LONG`. My first
  version cut the extra digit, which turned a typo into a different valid number; found by testing the
  input against the parser's invalid vectors. At most 15 digits are kept.
- `carrier` appears at 3 digits of a known mobile prefix; `areaCode` once known. Messages come from the
  `phone` strings group (Nepali wording unreviewed).
- Known gap: a mobile with a prefix that is not in `data/phone-prefixes.json` is called `BAD_PREFIX`;
  the data is best effort (see PHONE_NOTES.md).

## Not done
- Fixed-length "mask" mode, paste handling beyond what `input` does, the widgets.
- Vectors (`testdata/money-input.json`, 28 scenarios; `testdata/phone-input.json`, 30 scenarios) are
  hand-derived from these rules, not from an official source. The phone input is also tested against
  every valid and invalid vector of `testdata/phone.json`.
