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

See [`example/`](example) for a working app (web) and
[`../data/PICKER_NOTES.md`](../data/PICKER_NOTES.md) for what was and was not
verified.

```
cd flutter && flutter pub get && flutter analyze && flutter test
cd example && flutter build web      # then serve build/web
```
