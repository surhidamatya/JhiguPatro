# jhigu_patro_flutter

Flutter widgets for Bikram Sambat dates, built on the headless state machines in
[`jhigu_patro_utils`](../dart). Not published; it depends on `../dart` by path.

## `JhiguDatePicker`

An inline BS date picker with a month grid, month and year lists, min and max,
English or Nepali, an optional AD date under each day, keyboard control and
spoken labels on every day.

```dart
// Once, at start-up (load the shared JSON however your app likes):
NepaliCalendar.initialize(InlineCalendarDataSource(
  years: years, supportedStartYear: 2000, supportedEndYear: 2100, verifiedThrough: 2083,
));

JhiguDatePicker(
  value: _date,
  language: 'ne',
  min: NepaliDate.checked(2080, 1, 1),
  onChanged: (d) => setState(() => _date = d),
)
```

It is a thin view over the same `DatePicker` state machine the web component
uses, so both behave the same. Style it with a `JhiguTheme` in
`ThemeData.extensions`; anything left null falls back to your `ColorScheme`.

## `JhiguCalendar`

A month calendar with marked days and an events list, for showing a schedule or
holidays. It is a display and navigation widget, not a form field. Marked days
show a dot and their titles are added to the day's spoken label; the selected
day's titles are listed under the grid ("No events" when there are none).

```dart
JhiguCalendar(
  language: 'ne',
  events: {
    '2082-06-03': ['Laxmi Puja'],        // BS date text: YYYY-MM-DD
    '2082-06-05': ['Bhai Tika', 'Holiday'],
  },
  onSelect: (date, titles) => print('$date $titles'),
  onMonthChanged: (year, month) => load(year, month),
)
```

`year` and `month` pick the month to show (a later change moves the view).
`value` is optional: without it the calendar keeps the user's pick itself. Keys
that are not `YYYY-MM-DD` and blank titles are ignored. The events list can be
long, so give the calendar room or put it in a scroll view.

## `JhiguRangePicker`

An inline range picker over the headless `RangePicker`, with the same rules as
the web `<jhigu-date-range-picker>`: the first tap sets the start, a second tap
on or after it sets the end, a second tap before the start restarts, and a tap on
a complete range starts a new one. While choosing the end, days up to the hovered
(or keyboard-focused) day are previewed. A summary line shows "start – end".

```dart
JhiguRangePicker(
  start: _start,
  end: _end,
  min: NepaliDate.checked(2082, 1, 1),
  onChanged: (start, end) => setState(() { _start = start; _end = end; }),
)
```

`onChanged` is called with a start and no end after the first tap, with both
after the second, and with two nulls after Clear. `start` and `end` are optional;
when the parent changes them the picker follows without calling `onChanged`. An
end before the start throws `InvalidDataException`. The view opens on the month
of the end.

## `JhiguMoneyField` and `JhiguPhoneField`

Text fields over the headless `MoneyInput` and `PhoneInput`. They are plain
`TextField`s with a formatter, so `decoration`, `style`, `focusNode`, `enabled`
and `autofocus` work as you expect.

```dart
JhiguMoneyField(
  decoration: const InputDecoration(labelText: 'Amount', prefixText: 'Rs. '),
  onChanged: (Npr? amount) => setState(() => _amount = amount),
)

JhiguPhoneField(
  language: 'ne',
  decoration: const InputDecoration(labelText: 'Mobile'),
  onChanged: (String? e164) => setState(() => _phone = e164), // null unless valid
)
```

- **Money:** lakh grouping as you type (`12,34,567.50`), caret kept by counting
  digits, Devanagari digits accepted (shown as ASCII, or Devanagari with
  `digits: MoneyDigits.native`), a leading `Rs.`, `NPR` or `रु` dropped, two
  decimals at most, padded to two when the field loses focus. An amount past the
  largest safe integer paisa is ignored. `allowNegative` allows a leading minus.
  The value is `Npr` (integer paisa), never a float.
- **Phone:** `984-1234567` for mobiles and `01-4123456` for landlines, Devanagari
  digits and `+977` or `00977` accepted. The carrier shows as helper text and the
  error as error text (your own `helperText` or `errorText` wins). "Too short" is
  only reported after the field loses focus; "too long" at once, without cutting
  digits. `onStateChanged` gives every new `PhoneInputState`. Carrier prefixes are
  not an official list (see `data/PHONE_NOTES.md`).
- `value` is optional. When the parent changes it, the field follows without
  calling the callbacks; a parent that does not pass it keeps what was typed.

## `JhiguAddressPicker`

Four dropdowns (province, district, local level, ward) over the headless
`AddressPicker`, with the same rules as the web `<jhigu-address-select>`:
choosing a level clears the ones below it, a dropdown is disabled until the one
above it has a choice, and the ward list is `1..wards` of the local level.

```dart
JhiguAddressPicker(
  language: 'ne',
  localLevelId: _localLevelId,   // optional: restore a saved address
  ward: _ward,
  onChanged: (s) => setState(() { _localLevelId = s.localLevelId; _ward = s.ward; }),
)
```

`onChanged` gets the whole `AddressPickerState` (ids, `complete`, `selection`);
turn a complete one into text with `formatAddress`. `showWard: false` hides the
ward (it is then never reported). A saved `localLevelId` fills in the district and
province; an unknown id or a ward outside the local level throws
`AddressException`. When the parent changes the saved values the picker follows
without calling `onChanged`; a parent that does not pass them keeps the choice.
`decoration`, `enabled` and `spacing` style the dropdowns. Names are from the
shared address data; the Nepali province names are the old numbered form for
provinces 1 and 2 (see `data/ADDRESS_NOTES.md`).

See [`example/`](example) for a working app (web) and
[`../data/PICKER_NOTES.md`](../data/PICKER_NOTES.md) for what was and was not
verified.

```
cd flutter && flutter pub get && flutter analyze && flutter test
cd example && flutter build web      # then serve build/web
```
