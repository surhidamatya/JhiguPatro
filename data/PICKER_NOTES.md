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

## `<jhigu-date-picker>` web component (guide 15.2, U-5, U-6)
Code: `ts/src/elements/datePickerElement.ts` (`jhigu-patro-utils-ts/date-picker-element`),
`ts/src/elements/pickerMarkup.ts` (pure markup and CSS), example `ts/examples/date-picker.html`.
- Plain custom element, shadow DOM, no dependencies, on top of `createDatePicker`. The guide suggests Stencil for generated React/Vue/Angular wrappers and SSR; this does not use it, so there are no wrappers and no SSR build.
- The app must call `initializeCalendar` before the element connects, else the element shows the error text instead of throwing.
- Attributes, events, form behaviour, CSS variables and parts are listed in the file header.
- Form-associated (`ElementInternals`): posts the BS date under `name`; `required` gives `valueMissing`; an unreadable or out-of-range `value` is dropped and gives `badInput`; reset restores the `value` attribute.
- Popup mode: Escape closes, outside click closes, Arrow Down on the trigger opens, choosing a day closes.
- Keyboard in the grid uses the shared `keyAction` map. The whole panel re-renders on each state change and focus is restored to the focused cell or button.
- `show-ad` is on by default (`show-ad="false"` turns it off); a bare boolean attribute cannot default to on.
- **Checked in a real browser** (Chromium in the Claude app browser pane, served by `python3 -m http.server` from `ts/`, see `.claude/launch.json`): rendering of all three example pickers; click to select; next month; popup open, Escape (focus back to the trigger), outside-click close; arrow keys and Enter; `jhiguChange`/`jhiguOpen`/`jhiguClose` events with correct AD dates; form submit data; reset restoring the `value` attribute; `required` giving `valueMissing` with the Nepali message; title drill-down days, months, years and back; picking a year and month; min/max dimming and the disabled prev arrow; next arrow disabled at BS 2100 Chaitra; unreadable and out-of-range `value` giving `badInput`; `disabled` ignoring clicks; `week-starts-on`; `show-ad="false"`; property set and clear; `min` after `max` showing the error text.
- **Still not verified:** the screen-reader experience (the browser tool cannot see into shadow DOM, so ARIA is only checked in the markup tests); other browsers (Safari and Firefox `ElementInternals`); touch; narrow screens; `prefers-reduced-motion`; the light system theme; a popup near the screen edge (the popover is absolutely positioned and can overlap content or run off screen). In the years view the title still shows the month and year.
- Calendar, range picker, address, phone and money elements are not built.

## `<jhigu-money-input>` and `<jhigu-phone-input>` (guide 15.1, 15.2, P2)
Code: `ts/src/elements/fieldElements.ts` (`jhigu-patro-utils-ts/field-elements`), example `ts/examples/inputs.html`.
Plain custom elements, shadow DOM, one native `<input>` each, on the headless `createMoneyInput` / `createPhoneInput`. Attributes, events and parts are listed in the file header.
- Money form value is the integer paisa as text (`12993456750`), not the formatted text. The symbol (`Rs.`, `रु`) sits beside the field, never in the field text, so it is not posted.
- Phone form value is E.164 when valid, else empty. A non-empty invalid number gives a `customError` validity with the message in the chosen language (the "too short" text before blur, when the machine has no message yet).
- Typing is handled on `input` events (skipped during IME composition); after every change the field is repainted from the machine, so a change the machine ignores (past the maximum) is put back.
- **Checked in a real browser** (Chromium, `ts/examples/inputs.html`): real typing with caret kept after mid-number inserts; lakh grouping; blur padding to `.50`; Devanagari preset display; carrier badge at the 3-digit prefix; Nepali error text, red border and `aria-invalid`; phone completion and E.164; events; form submit data; validity before and after fixing; reset; `required`. By script: maximum amount accepted and one paisa more ignored, Devanagari digit typing shown as ASCII, symbol stripping, junk dropped, `.` to `0.`, negatives, bad and negative `value-paisa` giving `badInput`, toggling `devanagari` and `symbol`, property set and clear, `readonly` and `disabled`, `+977` input, too-long numbers, language switch, landline typing.
- **Not verified:** screen readers, Safari and Firefox, touch and mobile keyboards, IME composition, paste behaviour beyond a scripted input event, the light theme. No Stencil wrappers.
- Address select, calendar and range-picker elements are not built.

## `<jhigu-address-select>` (guide 11.5, 15.2)
Code: `ts/src/elements/addressElement.ts` (`jhigu-patro-utils-ts/address-element`), example `ts/examples/address.html`.
Form-associated element with native `<select>`s (province, district, local level, ward) on the headless address picker. Attributes, form data and events are in the file header.
- Form data (when `name` is set): `name` = local level id; `name_ward`, `name_district`, `name_province` added when chosen. Nothing is posted until a local level is chosen.
- `required` is satisfied when the selection is complete (a ward is needed unless `show-ward="false"`). A `value` or `ward` that is not valid gives `badInput` and an empty selection.
- With `show-ward="false"` the ward is always null, even if a `ward` attribute is set; showing the ward again asks for it again.
- The `ward` attribute stays as written: changing `value` keeps applying it if it is valid for the new local level.
- Options are in data order (not sorted). Select labels and the placeholder come from the strings tables (new `address` keys: province, district, localLevel, wardLabel, choose, required; Nepali unreviewed).
- **Checked in a real browser:** cascade and disabled states, 7 provinces, ward counts, events with the formatted address in English and Nepali, form data, validity, reset, `setAddress` and its `BAD_WARD` error, province change clearing the rest, language switch, show/hide ward, disabled, focus kept across re-render, bad attributes, required with and without ward.
- **Not verified:** driving the native dropdown with real clicks or keys (changes were made by setting the select value and dispatching `change`, which is what a pick does), screen readers, Safari/Firefox, touch.
- **Data issue seen:** Nepali province names in `data/address.json` are old numbered names (`प्रदेश न. १`) while English uses `Koshi Province`. Already listed as unchecked in `data/ADDRESS_NOTES.md`; this makes it visible in the UI.
- No type-ahead search box yet, though `searchAddress` exists.

## `<jhigu-date-range-picker>` (guide 15.2)
Code: `ts/src/elements/rangePickerElement.ts` (`jhigu-patro-utils-ts/range-picker-element`), example `ts/examples/range-picker.html`. Shares markup and styles with the date picker (`pickerMarkup.ts`, now with range classes and parts).
- Form data when `name` is set and the range is complete: `name_start` and `name_end`. `required` needs a complete range. Event `jhiguChange` has `start`, `end`, AD dates, `complete`, `days` (inclusive).
- Hover only patches cell classes in place. A full re-render on hover replaced the cell under the pointer between mouse-down and mouse-up and lost real clicks (found in the browser, fixed, re-tested with repeated real clicks).
- Middle days are `aria-selected` but styled with the band, not the solid selected style (the solid style made their text unreadable).
- **Checked in a real browser:** inline and popup; real clicks for start and end; click before the start restarts; hover preview band and final range look; keyboard in the popup (focus starts on the start, Enter chooses the end and closes); events with `days`; form data; reset (restores `start`/`end` attributes); `required` partial and complete; `setRange` and its error; `clear`; `min`/`max` blocking clicks; `disabled`; Nepali labels; bad, reversed, end-without-start and below-min attributes giving `badInput`.
- **Not verified:** screen readers, Safari/Firefox, touch (no hover on touch, so no preview), narrow screens, the light theme. No Stencil wrappers.
- Calendar element (month view with events) is not built.

## `<jhigu-calendar>` (guide 15.2)
Code: `ts/src/elements/calendarElement.ts` (`jhigu-patro-utils-ts/calendar-element`), example `ts/examples/calendar.html`. A month view with marked days and an events list; a display and navigation widget, not a form field. Built on `createDatePicker` and the shared markup (new: day marks, `showClear`).
- `marked` attribute is JSON: object from BS date to a title or list of titles, or an array of dates. The `events` property takes the object form and replaces the attribute's marks; setting the attribute again takes over again. A date with no titles is not marked. An unreadable attribute shows an English error line (a developer error).
- Marked days: dot (top-right), titles in the ARIA label, and listed under the grid when the day is selected ("No events" otherwise; new string `picker.noEvents`, Nepali unreviewed).
- Events `jhiguSelect` and `jhiguMonthChange`. Changing `language`, `week-starts-on`, `show-ad` or `today` keeps the shown month and the selection.
- **Checked in a real browser:** rendering in English and Nepali; marks from attribute and property; real click selects and lists events; keyboard arrows and Enter; next month and `jhiguMonthChange`; `goTo`, `select` and their errors; `year`/`month` attribute changes; language switch; array form, mixed and bad `marked` values; `show-ad`, `week-starts-on`. Found and fixed: the dot overlapped the AD number; empty title lists created bogus entries; changing an option jumped the view back to the selected day's month; a bad `marked` failed silently.
- **Not verified:** screen readers, Safari/Firefox, touch, narrow screens, light theme. No Stencil wrappers. It does not read the tithi or the built-in holiday data (`StaticCalendarEventSource`); events come only from `marked`/`events`.
- With this, all six elements in the guide's table exist: date picker, calendar, range picker, address select, phone input and money input.

## Usage guide and doc tests
`docs/USAGE.md` documents every module. Its ```` ```js test ```` blocks are run by `ts/tests/docs.test.ts` (one shared session, in order; a line ending `// => value` is an assertion; imports resolve through the `package.json` `exports` map). The same test fails if an export is missing from the docs or points at a missing source file, and a deliberately broken expected value was confirmed to fail. Dart and HTML samples are not run; the Dart sample was run once by hand. The README now has a toolkit overview and uses the real package name `jhigu-patro-utils-ts`; its older calendar and CLI sections are unchanged.

## Flutter: `flutter/` (`jhigu_patro_flutter`) and `JhiguDatePicker`
A Flutter package that depends on `../dart` by path (not published). `JhiguDatePicker` is a StatefulWidget over the Dart `DatePicker` state machine: month grid, month and year lists, min/max, English/Nepali, optional AD numbers, Today and Clear, keyboard (arrows, Home/End, Page Up/Down, Shift for years, Enter/Space), a spoken label on every day cell, `JhiguTheme` (a `ThemeExtension`) with fallback to the app's `ColorScheme`. The parent can change `value` later and the picker follows without calling `onChanged`; changing `min`, `max`, `showAd`, `weekStartsOn` or `today` rebuilds the state machine and keeps the month on screen.
- **Tested (date picker):** 24 tests (`flutter test`): rendering, taps, Today/Clear, parent-driven value, min/max, month and year navigation, keyboard including Shift+Page Down and disabled days, semantics (button, selected, enabled, full label in English and Nepali), theme extension and colour-scheme fallback, narrow width and 1.6x text scale (found and fixed an overflow in the day cell), option and language changes. Two mutations (dropping the language update, calling `onChanged` for parent changes) were caught.
- **Seen in a real browser:** `flutter/example` built for web and opened in Chromium: layout in dark theme, today outline, preset selection, dimmed days before `min` and disabled previous arrow, Nepali digits and labels, click to select and the `onChanged` log, next month, keyboard (arrows and Enter), month list, year list. `Shift+Page Down` moved a month in the browser, probably because the tool does not send a separate Shift key-down (the widget test with a real Shift key-down passes), so that key was not confirmed in a browser.
- **Not verified:** phones and tablets (iOS, Android), touch, screen readers (TalkBack, VoiceOver), light theme by eye, right-to-left, desktop. Nepali text relied on the browser's fallback font.
- `flutter/example/assets/nepali_calendar_data.json` is a symlink to `data/`, so the data is not duplicated.
- CI: `.github/workflows/ci-flutter.yml` runs analyze and test; it has not run on GitHub yet.
- **`JhiguCalendar`** (display, marked days, events list; same state machine as the web `<jhigu-calendar>`): props `events` (BS date text to titles), `year`/`month`, optional `value`, `onSelect(date, titles)`, `onMonthChanged`, `language`, `weekStartsOn`, `showAd`, `today`. Shares the key map and month/year lists with the date picker (`picker_parts.dart`). 21 tests: default and chosen month, bad month ignored, dots and spoken labels with titles, bad keys and blank titles ignored, marks per month, Nepali digits, tap/select callbacks, "No events", language, parent-driven value, changed events, month callbacks, prop-driven month, month list, keyboard, theme colour, dot position, narrow width at 1.6x text. Mutations caught: label join, `onSelect`, month callback, blank-title filter, marks lookup, dot colour, dot layout, parent-value rule. One equivalent mutant (an empty title list makes no mark either way).
  - Two bugs found only in a real browser or by a test written after: the dot sat on the digits (the `Stack` shrank to the text; now `StackFit.expand`), and a parent without `value` cleared the user's pick on every rebuild (now `value` is followed only when it changes). `JhiguDatePicker` still follows `value` on every rebuild, which suits a controlled field, but a picker used without `onChanged` setting state would reset; not changed.
  - Seen in Chromium: dots in the corner, selection fill, events heading with the AD date and titles, month arrows and the `onMonthChanged` log. Not tried: Nepali list, touch, screen readers.
- **`JhiguRangePicker`** (over the Dart `RangePicker`; same rules as the web element): props `start`, `end`, `onChanged(start, end)`, `min`, `max`, `language`, `weekStartsOn`, `showAd`, `today`, `showFooter` (Today, Clear and a "start – end" summary), `autofocus`. Ends are filled, days between get a band of the primary colour edge to edge, and hover (mouse) or the focused day (keyboard) previews the end. 23 tests: empty state, each selection rule, same-day range, Clear, Today, min/max, range across months, hover preview and its removal on leaving, none once complete, parent-driven start/end without `onChanged`, a rebuild without them keeps the choice, end-before-start rejected, Nepali, `showFooter`, month list, keyboard, selected semantics, theme colour and band colour, narrow width at 1.6x text. Eight mutations caught (one, the band colour, only after adding a test for it).
  - Found on the way: the Today and Clear row overflowed at 240 px and 1.6x text; it is now a `Wrap` (the date picker's footer too). The view opens on the month of the end because the Dart picker moves there when the range is set. The header row moved into a shared `PickerHeader`.
  - Seen in Chromium: start, hover preview band, end, complete range with a band, the summary line and the `onChanged` log. Not tried: touch (no hover there, so no preview), the Nepali list, screen readers. The spoken label does not say "range start" or "range end" (there are no Nepali words for it; `selected` is set on the ends and the days between).
- **`JhiguMoneyField` and `JhiguPhoneField`** (`fields.dart`): a `TextField` whose formatter runs every edit through `MoneyInput` / `PhoneInput` and returns the machine's text and caret. 29 tests: grouping, Devanagari in and out, symbol/decimals/leading zeros, empty is null, padding on blur, largest amount, negatives, caret by digit count, parent-driven value without callbacks, rebuild keeps typing, decoration and keyboard types; phone formatting, `+977`, landline, E.164 and null again, no callbacks while still invalid, TOO_SHORT only after leaving, TOO_LONG at once without cutting digits, language, `showCarrier`, helper and error text overrides, `onStateChanged`, parent value. Ten mutations; eight caught at once, two (calling `onChanged` while still invalid, the signed keyboard) only after adding tests.
  - In widget tests the helper and error text appear one frame after `enterText` (a `pump` is needed); in an app the rebuild is scheduled by itself.
  - Seen in Chromium with real keys: grouping and `Rs. ` prefix as typed, `12,34,567.50` after leaving, a digit typed inside the number keeps the caret after it through regrouping, the phone as `984-1234567` with the carrier and `+9779841234567` logged. Not tried: Nepali digits from a Devanagari keyboard (IME composition), Android and iOS keyboards (some hide the decimal point or minus), screen readers, autofill. The `Home` key did not reach Flutter in the browser tool, so it was not tested.
  - Carrier names come from the same unofficial prefix table as the web element.
- **`JhiguAddressPicker`** (`address_picker.dart`, over the Dart `AddressPicker`; `InputDecorator` + `DropdownButton` per level): props `localLevelId`, `ward`, `onChanged(AddressPickerState)`, `language`, `showWard`, `decoration`, `enabled`, `spacing`. 22 tests: empty start with only the province enabled, each choice enabling the next, full selection ids, ward list length, clearing below on a new province, district, local level or "Select", saved address filled in without `onChanged`, unknown id and bad ward throw `AddressException`, parent-driven values, a rebuild keeps the choice, `showWard` false and toggling it (a hidden ward is neither shown nor reported), Nepali labels, names and ward digits, language switch, `enabled`, `decoration`, narrow width at 1.6x text. Ten mutations; all caught (two only after a test was added or my sed fixed: a hidden ward in the report, and the district-enable rule).
  - Found in the browser, not by tests: the floating label and the "Select" hint overlapped on empty dropdowns; the label now always floats and the empty choice shows "Select" below it.
  - Seen in Chromium: province list, Bagmati's districts, Bhaktapur's four municipalities, wards 1 to 10, a completed address logged through `formatAddress` ("Ward 3, Bhaktapur Municipality, Bhaktapur, Bagmati"). Not tried: Nepali list, touch, screen readers, a very long list on a small phone (the menu is the stock dropdown menu, not a searchable list; 753 local levels are only ever shown for one district at a time).
- **Dialogs and `JhiguDateField`** (`dialogs.dart`, `date_field.dart`): `showJhiguDatePicker` (returns `NepaliDate?`), `showJhiguDateRangePicker` (returns `({NepaliDate start, NepaliDate end})?`), and a read-only `TextField` that opens the dialog. `JhiguDatePicker` got `onSelected` and `showClear`. No OK/Cancel buttons because the string tables have no words for them [SOURCE NEEDED]; the date dialog has no Clear button because a dismissal and a clear would both be null (the field has its own clear button, tooltip from `picker.clear`). 30 tests (dialogs, range dialog, field, `onSelected`/`showClear`): pick closes and returns, same day again closes, opens on the initial month, outside tap and Escape give null, `barrierDismissible: false`, Today, min/max, keyboard at once, Nepali; range: second day closes, one-day range, dismiss after a start gives null, initial range; field: placeholder and format in both languages, tap and pick, dismiss keeps the value, clear, `clearable`, parent value, rebuild keeps the pick, language change, disabled, min/max reach the dialog. Fourteen mutations, all caught.
  - Seen in Chromium: tapping the field opens the dialog with a scrim, days after `max` dimmed, no Clear; picking the 5th fills the field (`5 Bhadra 2082`) and logs `2082-05-05`; the range dialog stays open after the first day (summary shows "15 Bhadra 2082 (AD ...) – ...") and closes with `2082-05-15 to 2082-05-19`. The field showed a text-selection highlight, now off (`enableInteractiveSelection: false`).
  - Not built: a range field widget, a time or date-time picker, a full-screen dialog layout for small phones (the dialog is the 340 px picker with the stock `Dialog` insets). Not tried: touch, screen readers, focus return to the field after closing.
- **`FlutterDevanagariRenderer`** (`devanagari_renderer.dart`, guide R-6): a `DevanagariRenderer` for `buildReceiptPdf` that draws with `TextPainter` and `PictureRecorder` to a transparent PNG, same size contract as the command renderer (height 1.6 times the font size, baseline at 1.0, 290 dpi). `DevanagariRenderException` moved from `devanagari_command_renderer.dart` into `receipt_pdf.dart` (still re-exported from the command file) so the web-safe Flutter renderer can throw it; no behaviour change (Dart tests pass). 16 tests: PNG signature and size, width grows with text and size, empty text, transparent background with the asked colour and alpha (pixels come premultiplied), baseline position, user text scale ignored, custom scale, bad arguments, a Nepali receipt gives images and no warnings (and warnings without a renderer); and, when a Devanagari font is available (`JHIGU_DEVANAGARI_FONT` or Linux `fonts-noto-core`, which `ci-flutter.yml` now installs), real shaping: width is not one em per character, `क्ष` is narrower than its parts, ink stays inside the picture, bold differs, the named family is used, a receipt has no warnings. Nine of ten mutations caught; the tenth (`textScaler: noScaling`) is equivalent because `TextPainter` defaults to it.
  - The test font in `flutter test` is Ahem (every glyph a square), so shaping is only checked when a real font is loaded; without one those 6 tests are skipped, and a local run needs `JHIGU_DEVANAGARI_FONT=/path/to/NotoSansDevanagari.ttf`. They passed locally with Noto Sans Devanagari Regular; CI has not run them yet.
  - Seen in Chromium (CanvasKit): `श्रेष्ठ क्ष भदौ २०८२` drawn with conjuncts, vowel signs and Devanagari digits correct, and a Nepali receipt PDF built with no warnings (48,993 bytes). The browser fetched a fallback font itself; the PDF was not opened in a viewer, and no iOS, Android, macOS or Windows device was tried. If a platform has no Devanagari font the glyphs are empty boxes and the renderer cannot tell.
  - The package barrel now pulls in `package:jhigu_patro_utils/receipt_pdf.dart`, so apps that use the widgets also depend on the `pdf` package (tree shaking drops it if unused).
- Not built: print and share helpers.
