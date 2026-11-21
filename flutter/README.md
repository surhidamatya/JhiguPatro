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

See [`example/`](example) for a working app (web) and
[`../data/PICKER_NOTES.md`](../data/PICKER_NOTES.md) for what was and was not
verified.

```
cd flutter && flutter pub get && flutter analyze && flutter test
cd example && flutter build web      # then serve build/web
```
