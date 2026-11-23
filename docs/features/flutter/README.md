# Flutter widgets

`jhigu_patro_flutter` is a Flutter package in `flutter/`. It gives you Bikram Sambat (BS) widgets: a date picker, a month calendar with events, a range picker, money and phone fields, an address picker, date fields with dialogs, a theme extension, and PDF receipt helpers (a Devanagari renderer, print, share and an in-app preview). It is not published. This guide covers every public widget and function, setup, recipes, what is tested, and what is not verified.

The package README, [flutter/README.md](../../../flutter/README.md), is the short reference. This guide is the long one.

## How it relates to the Dart library

`jhigu_patro_flutter` depends on `jhigu_patro_utils` (the Dart library in [dart/](../../../dart/README.md)) by path. The Dart library holds the logic as headless state machines: `DatePicker`, `RangePicker`, `AddressPicker`, `MoneyInput` and `PhoneInput`. They have no Flutter code. Each Flutter widget is a thin view over one machine. It builds the machine, listens to it, draws its state and sends taps and keys to it. The web components use the same machines' TypeScript twins, so the rules match on the web and in Flutter.

Because of that:

- Dates are `NepaliDate`. Money is `Npr`, integer paisa, never a float. Phone numbers come out as E.164 text.
- Rules (min and max, range selection, address clearing, number grouping) live in the machines. See [headless widgets](../headless-widgets/README.md) for them.
- Errors are the Dart library's typed errors (`InvalidDataException`, `AddressException`, `MoneyException`).
- Labels come from the library's string tables, in `'en'` or `'ne'`. The widgets add no labels of their own. Where the tables have no words (OK, Cancel, range wording, the receipt preview buttons) the widgets have none either.

## When to use it

- You build a Flutter app and want BS date, amount, phone or address input that behaves like the web components.
- You want a BS month calendar with a list of events or holidays.
- You want to print, share or preview a receipt PDF with correct Nepali text.

Use the Dart machines directly if you need a different look than these widgets give you. Use the web components or React/Vue wrappers for web projects that are not Flutter.

## Install and setup

Nothing is published. Use path dependencies for both packages. In your app's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  jhigu_patro_flutter:
    path: ../JhiguPatro/flutter
  jhigu_patro_utils:
    path: ../JhiguPatro/dart
```

You need the second line because your code imports `package:jhigu_patro_utils/jhigu_patro_utils.dart` for `NepaliDate`, `Npr` and `NepaliCalendar`. `jhigu_patro_flutter` itself also depends on `pdf` and `printing`, so they are pulled in. The package declares `sdk: ">=3.0.0 <4.0.0"` and `flutter: ">=3.10.0"`. It was only checked with Flutter 3.44.2 (see [Platform notes](#platform-notes-and-what-is-not-verified)).

### Load the calendar data

The widgets need the calendar year table before the first one is built. If you skip this, the first call into the calendar throws a `StateError` from `NepaliCalendar` ("calendar not initialized"). The data is `data/nepali_calendar_data.json` in this repository. `data/` is the source of truth, so copy or link that file; do not edit a copy by hand.

1. Put the file in your app, for example `assets/nepali_calendar_data.json`, and declare it:

```yaml
flutter:
  assets:
    - assets/nepali_calendar_data.json
```

2. Read it, decode it and initialise before `runApp`:

```dart
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final cal = jsonDecode(
    await rootBundle.loadString('assets/nepali_calendar_data.json'),
  ) as Map<String, dynamic>;
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: (cal['years'] as Map<String, dynamic>)
        .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
    supportedStartYear: cal['supportedRange']['start'] as int,
    supportedEndYear: cal['supportedRange']['end'] as int,
    verifiedThrough: cal['verifiedThrough'] as int,
  ));
  runApp(const MyApp());
}
```

This is the same code the example app uses, and the same shape `flutter/test` uses with a file read. The file has these keys: `version`, `supportedRange` (2000 to 2100), `verifiedThrough` (2083 in the current file), `unverifiedYears`, `referencePoint` and `years`. Years after `verifiedThrough` still convert, but published sources disagree on them; see [calendar data](../calendar-data/README.md). The widgets do not mark unverified years on screen. If you need a warning, call `NepaliCalendar.getDateAccuracy(date)` yourself.

`example/` links its asset to `data/` with a symlink. A real app should copy the file, or use a build step that does.

## Quick start

A date field, in a Nepali-language app, after the setup above:

```dart
class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        theme: ThemeData(colorSchemeSeed: const Color(0xFF1D4ED8)),
        home: const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: Demo())),
      );
}

class Demo extends StatefulWidget {
  const Demo({super.key});
  @override
  State<Demo> createState() => _DemoState();
}

class _DemoState extends State<Demo> {
  NepaliDate? _date;

  @override
  Widget build(BuildContext context) => JhiguDateField(
        value: _date,
        language: 'ne',
        decoration: const InputDecoration(labelText: 'Date'),
        onChanged: (d) => setState(() => _date = d),
      );
}
```

Tapping the field opens a dialog with the picker. Picking a day closes it and fills the field.

## What the package exports

`package:jhigu_patro_flutter/jhigu_patro_flutter.dart` exports: `JhiguDatePicker`, `JhiguCalendar`, `JhiguRangePicker`, `JhiguMoneyField`, `JhiguPhoneField`, `JhiguAddressPicker`, `JhiguDateField`, `JhiguDateRangeField`, `showJhiguDatePicker`, `showJhiguDateRangePicker`, the `JhiguDateRange` typedef, `JhiguTheme`, `ResolvedJhiguTheme` and `FlutterDevanagariRenderer`.

`package:jhigu_patro_flutter/receipt_print.dart` is a separate entry point because it needs the `printing` package: `printReceipt`, `shareReceipt`, `buildReceiptPdfWithFlutter`, `receiptPageFormat`, `receiptFileName` and `JhiguReceiptPreview`. It also re-exports `package:jhigu_patro_utils/receipt_pdf.dart` (`ReceiptDocument`, `buildReceiptPdf` and the rest).

## Conventions shared by all widgets

- `language` is `'en'` (default) or `'ne'`. It is a per-widget argument. There is no app-wide setting and the widgets do not read `Localizations`. Pass the same value to each widget.
- `weekStartsOn`: 0 is Sunday (default), 6 is Saturday.
- `showAd`: show the AD day under each BS day (default true).
- `today`: the day marked as today. Default is today in Nepal. Pass a fixed day in tests and demos.
- Optional controlled values. `value`, `start`, `end`, `localLevelId` and `ward` are optional. If you pass them and change them later, the widget follows without calling its callback. See the note under each widget for the exact rule.
- Colours come from `JhiguTheme` (see [Theming](#jhigutheme)).
- Pickers are drawn inline with a maximum width of 340 logical pixels. Put one in a dialog or popup yourself, or use the dialog functions.

## JhiguDatePicker

An inline BS date picker over the headless `DatePicker`. It shows a month grid. The title opens a month list, then a year list. Footer buttons are Today and Clear.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `value` | `NepaliDate?` | null | Selected date. A value outside `min` and `max` is ignored. |
| `onChanged` | `ValueChanged<NepaliDate?>?` | null | Called when the selected date changes, or is cleared (null). |
| `onSelected` | `ValueChanged<NepaliDate>?` | null | Called on every pick (tap, Enter, Space, Today), even for the day already selected. Dialogs use it to close. |
| `min`, `max` | `NepaliDate?` | null | Days outside are disabled. |
| `language` | `String` | `'en'` | `'en'` or `'ne'`. |
| `weekStartsOn` | `int` | 0 | |
| `showAd` | `bool` | true | AD number under each day and AD date in the spoken label. |
| `today` | `NepaliDate?` | Nepal today | |
| `showFooter` | `bool` | true | Today and Clear buttons. |
| `showClear` | `bool` | true | Clear button, only if `showFooter`. |
| `autofocus` | `bool` | false | Take keyboard focus when first shown. |

```dart
JhiguDatePicker(
  value: _date,
  language: 'ne',
  min: NepaliDate.checked(2080, 1, 1),
  onChanged: (d) => setState(() => _date = d),
)
```

Keyboard, when the picker has focus and shows days: arrows move a day or a week, Home and End go to the start and end of the week, Page Up and Page Down change the month (with Shift, the year), Enter and Space select. These are the headless machine's `keyAction` rules; see the keyboard map in [headless widgets](../headless-widgets/README.md).

Controlled value: `JhiguDatePicker` compares `value` with its own selection on every rebuild. If the parent keeps passing a fixed `value` and never updates it in `onChanged`, a rebuild resets the user's pick to that value (from the code in `didUpdateWidget`; the notes in `data/PICKER_NOTES.md` say the same). Always update your state in `onChanged`, or leave `value` out. `JhiguCalendar`, `JhiguRangePicker` and the fields only follow the parent when the parent's value actually changes.

Changing `min`, `max`, `showAd`, `weekStartsOn` or `today` rebuilds the machine and keeps the month on screen.

## JhiguCalendar

A month calendar with marked days and an events list. It is a display and navigation widget, not a form field.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `events` | `Map<String, List<String>>` | `{}` | BS date text `YYYY-MM-DD` to titles. Keys that are not `YYYY-MM-DD` and blank titles are ignored. |
| `year`, `month` | `int?` | null | The month to show first. Both must be given. Later changes move the view. Default: month of `value`, or today's month. |
| `value` | `NepaliDate?` | null | Selected day. Without it the calendar keeps the user's pick. |
| `onSelect` | `void Function(NepaliDate, List<String>)?` | null | The picked day and the titles marked on it. Called when the selection changes. |
| `onMonthChanged` | `void Function(int year, int month)?` | null | Called when the shown month changes, by the user or by `year` and `month`. |
| `language`, `weekStartsOn`, `showAd`, `today`, `autofocus` | | as for the date picker | |

```dart
JhiguCalendar(
  language: 'ne',
  year: 2082,
  month: 6,
  events: {
    '2082-06-03': ['Laxmi Puja'],
    '2082-06-05': ['Bhai Tika', 'Holiday'],
  },
  onSelect: (date, titles) => debugPrint('${date.toIsoString()} $titles'),
  onMonthChanged: (y, m) => loadEvents(y, m),
)
```

Marked days get a dot. The selected day's titles are listed under the grid; with none, the list says "No events" (from the string tables, in the chosen language). The list can be long, so give the calendar room or put it in a scroll view. Use `onMonthChanged` to load events for the month on screen.

Does it show tithi? No. `JhiguCalendar` has no tithi, panchang or `PanchangDataSource` parameter, and nothing in `flutter/lib` mentions them. The Dart `PanchangDataSource` exists (see [tithi](../tithi/README.md)) and the web `<jhigu-calendar>` can show tithi, but the Flutter calendar cannot. `docs/USAGE.md` says the same. To show tithi in Flutter today, read it yourself from `PanchangDataSource` and pass the text as an event title for each day. That works but was not tried here.

## JhiguRangePicker

An inline range picker over the headless `RangePicker`. Rules (the same as the web `<jhigu-date-range-picker>`): the first tap sets the start. A second tap on or after it sets the end. A second tap before the start restarts from that day. A tap on a complete range starts a new one. While you choose the end, days up to the hovered day (mouse) or the keyboard-focused day are previewed. A footer shows Today, Clear and a "start – end" summary.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `start`, `end` | `NepaliDate?` | null | An end needs a start and must not be before it, or building the widget throws `InvalidDataException`. |
| `onChanged` | `void Function(NepaliDate? start, NepaliDate? end)?` | null | Start and no end after the first tap; both after the second; two nulls after Clear. |
| `min`, `max` | `NepaliDate?` | null | |
| `language`, `weekStartsOn`, `showAd`, `today`, `autofocus` | | as above | |
| `showFooter` | `bool` | true | Today, Clear and the summary line. |

```dart
JhiguRangePicker(
  start: _start,
  end: _end,
  min: NepaliDate.checked(2082, 1, 1),
  onChanged: (s, e) => setState(() { _start = s; _end = e; }),
)
```

When the parent changes `start` or `end` the picker follows without calling `onChanged`. A parent that does not pass them keeps the user's choice. The view opens on the month of the end. Touch has no hover, so there is no preview on a phone until the second tap.

## JhiguMoneyField

A `TextField` over the headless `MoneyInput`. A formatter runs every edit through the machine and returns its text and caret.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `value` | `Npr?` | null | Optional. When the parent changes it, the field follows without calling `onChanged`. |
| `onChanged` | `ValueChanged<Npr?>?` | null | The amount, or null while the field is empty. |
| `digits` | `MoneyDigits` | `MoneyDigits.ascii` | `MoneyDigits.native` shows Devanagari digits. |
| `allowNegative` | `bool` | false | Allows a leading minus. |
| `decoration`, `style` | | null | As for `TextField`. |
| `textAlign` | `TextAlign` | `TextAlign.start` | |
| `enabled`, `autofocus` | `bool` | true, false | |
| `focusNode` | `FocusNode?` | null | |

```dart
JhiguMoneyField(
  decoration: const InputDecoration(labelText: 'Amount', prefixText: 'Rs. '),
  onChanged: (Npr? amount) => setState(() => _amount = amount),
)
```

Behaviour (from the code and its tests): lakh grouping as you type (`12,34,567.50`), caret kept by counting digits, Devanagari digits accepted, a leading `Rs.`, `NPR` or `रु` dropped, two decimals at most, padded to two decimals when the field loses focus. An amount past the largest safe integer paisa is ignored. The value is integer paisa: `amount.paisa`. I ran a scratch test that entered `1234567.5` and the field showed `12,34,567.50`.

It is a `TextField`, not a `FormField`. It has no `validator`; see [Forms](#forms). See [money](../money/README.md) for the rounding and formatting rules of `Npr`.

## JhiguPhoneField

A `TextField` over the headless `PhoneInput`.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `value` | `String?` | null | Initial text. When the parent changes it, the field follows without calling the callbacks. |
| `onChanged` | `ValueChanged<String?>?` | null | The E.164 number (for example `+9779841234567`) when valid, else null. Called when that changes. |
| `onStateChanged` | `ValueChanged<PhoneInputState>?` | null | Every new state: text, carrier, error. |
| `language` | `String` | `'en'` | Language of the error message. |
| `allowInactive` | `bool` | false | Accept prefixes the data marks as inactive. |
| `showCarrier` | `bool` | true | Carrier as helper text. |
| `decoration`, `style`, `enabled`, `autofocus`, `focusNode` | | | As for `TextField`. |

```dart
JhiguPhoneField(
  language: 'ne',
  decoration: const InputDecoration(labelText: 'Mobile'),
  onChanged: (String? e164) => setState(() => _phone = e164),
)
```

Mobiles are shown as `984-1234567`, landlines as `01-4123456`. Devanagari digits and `+977` or `00977` are accepted. The carrier is the helper text and the error is the error text; your own `helperText` or `errorText` in `decoration` wins. "Too short" is reported only after the field loses focus. "Too long" is reported at once, and no digits are cut. In a widget test the helper and error text appear one frame after `enterText`, so call `pump`. I ran a scratch test that entered `9841234567` and the field showed `984-1234567`. The carrier prefix table is not an official list; see [phone](../phone/README.md) and `data/PHONE_NOTES.md`.

## JhiguAddressPicker

Four dropdowns (province, district, local level, ward) over the headless `AddressPicker`. Choosing a level clears the ones below it. A dropdown is disabled until the one above has a choice. The ward list is `1..wards` of the local level.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `localLevelId` | `int?` | null | A saved local level; its district and province are filled in. |
| `ward` | `int?` | null | A saved ward. Ignored if `showWard` is false. |
| `onChanged` | `ValueChanged<AddressPickerState>?` | null | The whole state: `provinceId`, `districtId`, `localLevelId`, `ward`, `complete`, and `selection` when complete. |
| `language` | `String` | `'en'` | Names and labels. |
| `showWard` | `bool` | true | If false the ward is never shown or reported. |
| `decoration` | `InputDecoration?` | null | Applied to every dropdown; its `labelText` is replaced by the level's name. |
| `enabled` | `bool` | true | |
| `spacing` | `double` | 12 | Space between dropdowns. |

```dart
JhiguAddressPicker(
  language: 'ne',
  localLevelId: _localLevelId,
  ward: _ward,
  onChanged: (s) => setState(() {
    _localLevelId = s.localLevelId;
    _ward = s.ward;
  }),
)
```

Turn a complete state into text with `formatAddress(localLevelId: ..., ward: ...)` from `jhigu_patro_utils`. The example does this. An unknown `localLevelId`, or a ward outside the local level, throws `AddressException`. The dropdowns are the stock `DropdownButton`, not a searchable list. Names come from the shared address data; the Nepali names of provinces 1 and 2 are the old numbered form (see [address](../address/README.md) and `data/ADDRESS_NOTES.md`).

## showJhiguDatePicker and showJhiguDateRangePicker

Dialog helpers. Both return null if the user dismisses the dialog (tap outside, Escape, back).

```dart
Future<NepaliDate?> showJhiguDatePicker({
  required BuildContext context,
  NepaliDate? initial, NepaliDate? min, NepaliDate? max,
  String language = 'en', int weekStartsOn = 0, bool showAd = true,
  NepaliDate? today, bool useRootNavigator = true, bool barrierDismissible = true,
});

Future<JhiguDateRange?> showJhiguDateRangePicker({
  required BuildContext context,
  NepaliDate? initialStart, NepaliDate? initialEnd, NepaliDate? min, NepaliDate? max,
  String language = 'en', int weekStartsOn = 0, bool showAd = true,
  NepaliDate? today, bool useRootNavigator = true, bool barrierDismissible = true,
});
```

`JhiguDateRange` is the record `({NepaliDate start, NepaliDate end})`.

```dart
final date = await showJhiguDatePicker(context: context, initial: _date, language: 'ne');
final range = await showJhiguDateRangePicker(context: context);
if (range != null) debugPrint('${range.start.toIsoString()} ${range.end.toIsoString()}');
```

Picking a day closes the date dialog at once, including the day that was already selected. The range dialog closes when the second day is chosen. There are no OK or Cancel buttons because the string tables have no words for them, and the date dialog has no Clear button (a dismissal and a clear would both be null). The range dialog returns only complete ranges. The dialog is the 340-pixel picker inside a stock `Dialog`; there is no full-screen layout for small phones.

## JhiguDateField and JhiguDateRangeField

Read-only text fields that show the date and open the dialog on tap. Use them as form inputs.

`JhiguDateField` parameters:

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `value` | `NepaliDate?` | null | Optional. Followed only when the parent changes it. |
| `onChanged` | `ValueChanged<NepaliDate?>?` | null | The picked day, or null when cleared. |
| `min`, `max`, `language`, `weekStartsOn`, `showAd`, `today` | | as above | Passed to the dialog. |
| `format` | `String` | `'D MMMM YYYY'` | `formatDate` tokens. |
| `decoration`, `style` | | null | |
| `enabled` | `bool` | true | |
| `clearable` | `bool` | true | Clear button when there is a value. |

`JhiguDateRangeField` has the same parameters, but `start` and `end` instead of `value`, `onChanged(start, end)` (both together, or two nulls when cleared), and `separator` (default `' – '`).

```dart
JhiguDateField(
  value: _date,
  max: NepaliDate.today(),
  decoration: const InputDecoration(labelText: 'Date of birth'),
  onChanged: (d) => setState(() => _date = d),
)

JhiguDateRangeField(
  start: _start,
  end: _end,
  decoration: const InputDecoration(labelText: 'Stay'),
  onChanged: (s, e) => setState(() { _start = s; _end = e; }),
)
```

An empty field shows "Select a date" (the date picker's placeholder, in `language`). The range field uses the same text because the string tables have no range wording ([SOURCE NEEDED] for range wording). A `suffixIcon` in your `decoration` replaces the clear button and the calendar icon. The range field throws `InvalidDataException` when the dialog opens if `end` has no `start` or is before it. The field disables text selection because the text is only a display.

## JhiguTheme

A `ThemeExtension` that restyles the pickers, the calendar and the range picker. Add it to `ThemeData.extensions`. Every field is nullable. A null field falls back to the app's `ColorScheme`.

| Field | Falls back to | Used for |
|---|---|---|
| `primary` | `colorScheme.primary` | Selected day, focus ring, selected month or year. |
| `onPrimary` | `colorScheme.onPrimary` | Text on the selected day. |
| `surface` | `colorScheme.surface` | Widget background. |
| `text` | `colorScheme.onSurface` | Main text. |
| `muted` | `colorScheme.onSurfaceVariant` | Weekday names, AD numbers, borders. |
| `holiday` | `colorScheme.error` | Weekend days (Saturday by default). |
| `today` | `colorScheme.tertiary` | Outline of today. |
| `radius` | 8 | Corner radius of the widget and day cells. |

```dart
ThemeData(
  colorSchemeSeed: const Color(0xFF1D4ED8),
  extensions: const [
    JhiguTheme(primary: Color(0xFF0F766E), holiday: Color(0xFFB91C1C), radius: 4),
  ],
)
```

`JhiguTheme.of(context)` returns a `ResolvedJhiguTheme` with every field filled in. `copyWith` and `lerp` work, so theme animation works. The money, phone and address widgets and the date fields use your `InputDecoration` and `ThemeData`, not `JhiguTheme`.

## FlutterDevanagariRenderer

The `pdf` package cannot shape Devanagari. `buildReceiptPdf` therefore asks a `DevanagariRenderer` for a picture of each Nepali string. `FlutterDevanagariRenderer` draws them with Flutter's text engine, so it works on every Flutter platform, the web included.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `fontFamily` | `String?` | null (platform font) | Name of a font you bundle, for example `'NotoSansDevanagari'`. |
| `fontFamilyFallback` | `List<String>` | Noto Sans Devanagari, Kohinoor Devanagari, Devanagari Sangam MN, Mangal | Tried when `fontFamily` lacks a glyph. |
| `package` | `String?` | null | Package that holds `fontFamily`. |
| `scale` | `double` | 290 / 72 | Pixels per PDF point (about 290 dpi). Must be above 0, or `ArgumentError`. |

```dart
import 'package:jhigu_patro_utils/receipt_pdf.dart';

final pdf = await buildReceiptPdf(
  doc,
  options: ReceiptPdfOptions(renderer: FlutterDevanagariRenderer()),
);
// pdf.bytes, pdf.warnings
```

`render(text, fontSize:, bold:, color:)` returns a transparent PNG as a `RenderedText` (`png`, `widthPt`, `heightPt`). The height is 1.6 times the font size and the baseline is at 1.0 times, the same as the command renderer, so Nepali text lines up in table rows. It ignores the user's text-scale setting. Failures throw `DevanagariRenderException`, whose message never contains the text (it may be a customer's name).

The package ships no font. If a platform has no Devanagari font, the glyphs come out as empty boxes and nothing can detect it. Bundle a font and check a sample receipt on every platform you ship. In `flutter test` the default font is Ahem (square glyphs), so real shaping tests need a font; see [How it is tested](#how-it-is-tested).

## Receipts: print, share and preview

Import `package:jhigu_patro_flutter/receipt_print.dart`. The document model, totals, VAT and validation are in [receipts](../receipts/README.md); this section covers only the Flutter side.

| Function | Returns | What it does |
|---|---|---|
| `printReceipt(doc, {renderer, jobName, onWarnings})` | `Future<bool>` | Opens the system print dialog. False if cancelled. `jobName` defaults to the receipt number. The dialog starts with the receipt's own paper and does not reflow the PDF (`dynamicLayout: false`). |
| `shareReceipt(doc, {renderer, filename, subject, body, bounds, onWarnings})` | `Future<bool>` | Opens the share sheet (a download on the web). `filename` defaults to `receiptFileName(doc)`. `bounds` is where an iPad popover points from. |
| `buildReceiptPdfWithFlutter(doc, {renderer, onWarnings})` | `Future<ReceiptPdf>` | Builds the PDF with `FlutterDevanagariRenderer` unless you pass `renderer`. Calls `onWarnings` only if there are warnings. |
| `receiptPageFormat(PageSize)` | `PdfPageFormat` | A4, A5 or `roll80` to the matching print format. |
| `receiptFileName(doc)` | `String` | The receipt number with every character outside `A-Za-z0-9._-` replaced by `_`, plus `.pdf`. `2082/83-001` gives `2082_83-001.pdf`. An empty result gives `receipt.pdf`. |

Pass `onWarnings` to hear about text that could not be drawn (it falls back to `[?]` or English) instead of printing a receipt with `[?]` in it by surprise.

`JhiguReceiptPreview` shows the receipt as it will print: the pages in a scrollable view with print and share buttons. It is `PdfPreview` from `printing`, set up for a receipt.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `doc` | `ReceiptDocument` | required | A different `doc` (by identity) rebuilds the PDF. |
| `renderer` | `DevanagariRenderer?` | Flutter renderer | A different one rebuilds. |
| `onWarnings` | `void Function(List<String>)?` | null | |
| `allowPrinting`, `allowSharing` | `bool` | true | |
| `maxPageWidth` | `double?` | null | |
| `fileName` | `String?` | `receiptFileName(doc)` | Used when sharing. |
| `onPrinted`, `onShared` | `VoidCallback?` | null | |
| `errorBuilder` | `Widget Function(BuildContext, Object)?` | printing's error text | |

```dart
SizedBox(height: 600, child: JhiguReceiptPreview(doc: doc))
```

The PDF is built once per `doc` and renderer and reused for the preview, printing and sharing. The paper size is the receipt's own and cannot be changed in the preview. It needs a bounded height (an `Expanded` or a `SizedBox`). On the web it loads pdf.js from a CDN to draw the pages; the `printing` README says how to host it yourself. The preview's buttons use the `printing` package's English labels; they are not translated here ([SOURCE NEEDED] for Nepali words).

`printing` has platform setup for some targets. Read its README before you ship to a target; this guide does not repeat it.

## Forms

The fields are not `FormField`s. `JhiguMoneyField`, `JhiguPhoneField`, `JhiguDateField` and `JhiguDateRangeField` are built on `TextField`, and none takes a `validator`, `onSaved`, `autovalidateMode` or a `GlobalKey<FormState>` hook. The address picker is four `DropdownButton`s. They will sit inside a `Form` without error, but `Form.validate()` will not check them.

The pattern that works: keep each value in your state from its `onChanged`, and check the values yourself when the user submits. The money, phone and address widgets already show their own errors where they have them (phone shows the error as error text). Recipe 1 below does this.

If you want `Form` validation, wrap a field in your own `FormField<T>` and set its value from `onChanged`. That is not provided and was not tried here.

## Recipes

Each recipe was compiled and run in a scratch widget test on the host with the repository's calendar data. Where an output is shown, it was printed by that test.

### 1. A booking form: date, amount, phone and address

The submit button is enabled only when all four are valid. The money, phone and address widgets report null or an incomplete state until the input is valid.

```dart
class BookingForm extends StatefulWidget {
  const BookingForm({super.key});
  @override
  State<BookingForm> createState() => _BookingFormState();
}

class _BookingFormState extends State<BookingForm> {
  NepaliDate? _date;
  Npr? _amount;
  String? _phone;
  AddressPickerState? _address;

  bool get _valid =>
      _date != null &&
      _amount != null &&
      _phone != null &&
      (_address?.complete ?? false);

  void _submit() {
    final a = _address!.selection!; // set when complete is true
    debugPrint('${_date!.toIsoString()} ${_amount!.paisa} $_phone '
        '${a.localLevelId} ${_address!.ward}');
  }

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: [
      JhiguDateField(
        value: _date,
        min: NepaliDate.checked(2082, 5, 1),
        decoration: const InputDecoration(labelText: 'Check-in'),
        onChanged: (d) => setState(() => _date = d),
      ),
      JhiguMoneyField(
        decoration: const InputDecoration(labelText: 'Deposit', prefixText: 'Rs. '),
        onChanged: (a) => setState(() => _amount = a),
      ),
      JhiguPhoneField(
        decoration: const InputDecoration(labelText: 'Mobile'),
        onChanged: (p) => setState(() => _phone = p),
      ),
      JhiguAddressPicker(onChanged: (s) => setState(() => _address = s)),
      FilledButton(onPressed: _valid ? _submit : null, child: const Text('Book')),
    ]);
  }
}
```

In the scratch test, typing `1234567.5` into Deposit showed `12,34,567.50`, typing `9841234567` into Mobile showed `984-1234567`, and picking the 10th in the Check-in dialog showed `10 Bhadra 2082`. The submit step with a complete address was not run in that test; only the code compiled. Store the amount as `_amount!.paisa` (an `int`). Store the phone as the E.164 text. Store the address as `localLevelId` and `ward`, not as a formatted string, and call `formatAddress` when you show it.

### 2. A Nepali-language app

There is no global switch. Pass `language: 'ne'` to every widget. Keep it in one place:

```dart
const lang = 'ne';

Column(children: [
  const JhiguDateField(language: lang),
  const JhiguPhoneField(language: lang),
  const JhiguAddressPicker(language: lang),
  JhiguMoneyField(digits: MoneyDigits.native), // Devanagari digits
])
```

The language also changes the picker title, weekday names, month names, day digits, button labels, tooltips and spoken labels. Your own `InputDecoration` labels are yours to translate; the widgets do not touch them (the address picker replaces `labelText` with the level's name in the chosen language). For Nepali receipts use `ReceiptLanguage.ne` in the document and `FlutterDevanagariRenderer` (the default of the print helpers). Nepali on screen uses your app's font fallback. The package sets no font.

### 3. Theming

```dart
MaterialApp(
  theme: ThemeData(
    colorSchemeSeed: const Color(0xFF1D4ED8),
    extensions: const [
      JhiguTheme(primary: Color(0xFF0F766E), holiday: Color(0xFFB91C1C), radius: 4),
    ],
  ),
  home: ...,
)
```

The scratch test built this theme and read back a resolved `radius` of 4. Any field you leave out uses the `ColorScheme`, so a dark `ThemeData` works without a dark `JhiguTheme`. For two looks, give each `ThemeData` its own extension.

### 4. Print and share a receipt

```dart
import 'package:jhigu_patro_flutter/receipt_print.dart';

final doc = ReceiptDocument(
  kind: ReceiptKind.invoice,
  number: '2082/83-001',
  issueDate: NepaliDate.checked(2082, 5, 10),
  business: const Business(name: 'हिमाल ट्रेडर्स', address: 'ठमेल'),
  customer: const Party(name: 'राम श्रेष्ठ'),
  lines: [
    ReceiptLine(
      description: 'चामल',
      qtyMilli: 1000,
      unit: 'kg',
      unitPrice: Npr.fromPaisa(10000),
    ),
  ],
  vatMode: VatMode.none,
  paid: Npr.zero,
  language: ReceiptLanguage.ne,
  pageSize: PageSize.a4,
);

final printed = await printReceipt(doc, onWarnings: (w) => debugPrint('$w'));
final shared = await shareReceipt(doc, subject: 'Receipt');
// In a screen:
// SizedBox(height: 600, child: JhiguReceiptPreview(doc: doc))
```

This is the document the example app builds. The scratch test compiled the calls and built a `JhiguReceiptPreview` for an English 80 mm document, where `receiptFileName` returned `x.pdf` for number `x` and `receiptPageFormat(PageSize.roll80)` gave a width of about 226.77 points with unbounded height. It did not call `printReceipt` or `shareReceipt`, because they open native UI. The line quantity is `qtyMilli` (1000 is one unit). For every other field see [receipts](../receipts/README.md).

## Accessibility

What the code provides:

- Every day cell in the date picker, calendar and range picker is a `Semantics` button with `selected` and `enabled` set and a full label. English: `Tuesday, 10 Bhadra 2082 (AD 26 August 2025)`. With a marked event in the calendar the titles are appended: `Thursday, 12 Bhadra 2082 (AD 28 August 2025). Teej`. Nepali: `आइतबार, १ भदौ २०८२ (ई.सं. 17 अगस्ट 2025)`. These strings were printed by a scratch test. `showAd: false` drops the AD part.
- The weekday header row is excluded from semantics, so the day labels carry the weekday.
- The title is a live region, so a screen reader hears the month change.
- Month arrows have tooltips from the string tables (for example "Previous month"). The clear button on the date fields has a tooltip from `picker.clear`.
- Keyboard: arrows, Home, End, Page Up, Page Down (Shift for the year), Enter, Space, as described above. Each picker takes focus on tap and with `autofocus`. The dialogs set `autofocus` so keys work at once.
- The fields are normal `TextField`s, so `decoration.labelText` is the accessible name. Give each one a label.
- The address dropdowns carry the level name as their label.

Checked only in tests and in a desktop browser by a previous author (see below): no screen reader (TalkBack, VoiceOver, NVDA) was used. The range picker's spoken label does not say "range start" or "range end" because there are no Nepali words for it; `selected` is set on the ends and the days between. The calendar's day cell scales its text down on narrow screens and at large text sizes instead of overflowing; tests cover 1.6x text scale. Colour contrast of your custom `JhiguTheme` is yours to check.

## Platform notes and what is not verified

What I ran for this guide, on macOS, with Flutter 3.44.2:

- `cd flutter && flutter pub get && flutter analyze && flutter test`: analyze reported "No issues found!", and the tests reported "All tests passed!" with 198 passing and 6 skipped (the skipped ones need a Devanagari font; see below). These run on the host VM, not on a device.
- `cd flutter/example && flutter analyze`: no issues. `flutter build web`: succeeded (it also reported that a Wasm dry run succeeded).
- Scratch widget tests for the recipes and labels in this guide, on the host. They were deleted afterwards.

I did not run the example on a browser, an iOS or Android device or simulator, macOS desktop, Windows or Linux. I did not open a PDF, use a real printer or share sheet, or use a screen reader.

What earlier work recorded in `data/PICKER_NOTES.md` (not re-run here): the example built for web was opened in Chromium (CanvasKit) and the pickers, fields, dialogs, renderer and a share download were exercised there. The same notes list as not verified: iOS, Android, touch, screen readers, desktop, right-to-left, light theme by eye, Devanagari keyboards (IME), mobile keyboards for the decimal point or minus, the native print dialog, the iOS and Android share sheets, iPad popover bounds, and real or 80 mm roll printers.

Other facts:

- The example only has a `web/` platform folder. To run it on another platform you would need to generate that platform's folder (`flutter create .` inside `flutter/example`); that was not tried.
- Nepali text in the pickers uses the platform's font fallback. A Devanagari font is needed in PDFs (see the renderer).
- The CI workflow `.github/workflows/ci-flutter.yml` pins Flutter 3.44.2. The notes record that Flutter 3.50 deprecates `package:flutter/material.dart` in favour of `material_ui`, which makes `flutter analyze` fail on infos. Migrating is not done.

## Known gaps

- No tithi in `JhiguCalendar` (see above).
- No `FormField` support; no validators (see [Forms](#forms)).
- No time or date-time picker.
- No OK, Cancel or Clear in the date dialog; no full-screen dialog for small phones.
- No range wording in the string tables, so the range field's empty text is "Select a date". [SOURCE NEEDED]
- The receipt preview's buttons are English only. [SOURCE NEEDED] for Nepali words.
- The address picker is a plain dropdown, not a searchable list.
- Carrier names come from an unofficial prefix table.
- No print-to-file, no printer choice.
- The package ships no font.
- `language` is a per-widget argument; there is no app-wide locale.
- `JhiguDatePicker` resets to a fixed `value` on rebuild if you do not update state (see above).
- The package is not published; versions are path-based.

## How it is tested

Tests are in `flutter/test`, run with `flutter test` from `flutter/`. They load the calendar data from `../data/nepali_calendar_data.json`. Counts below are the number of test cases in each file (counted from the source, not from a report).

| File | Cases | Covers |
|---|---|---|
| `date_picker_test.dart` | 24 | Rendering, taps, Today and Clear, parent-driven value, min and max, month and year lists, keyboard, semantics, theme and fallback, narrow width and 1.6x text, option and language changes. |
| `calendar_test.dart` | 21 | Month selection, dots and labels with titles, bad keys and blank titles, callbacks, "No events", language, keyboard, theme, narrow width. |
| `range_picker_test.dart` | 23 | Selection rules, Clear, Today, min and max, hover preview, parent-driven values, end before start, Nepali, `showFooter`, keyboard, semantics, theme. |
| `fields_test.dart` | 29 | Money and phone: grouping, Devanagari, caret, blur padding, E.164, short and long errors, carrier, helper and error text, callbacks. |
| `address_picker_test.dart` | 22 | Enabling, clearing, saved address, errors, `showWard`, Nepali, `enabled`, `decoration`, narrow width. |
| `dialogs_test.dart` | 30 | Date dialog, range dialog, `JhiguDateField` and `onSelected`/`showClear`. |
| `date_range_field_test.dart` | 15 | Text, format and separator, dialog round trip, clear, parent values, errors. |
| `devanagari_renderer_test.dart` | 16 | PNG output, size contract, colour, baseline, text scale, errors; shaping tests that need a font. |
| `receipt_print_test.dart` | 24 | Print, share, file names, preview props, build once per document. Uses a fake `PrintingPlatform`. |

The 6 skipped tests are the renderer's shaping tests. They need a real Devanagari font: set `JHIGU_DEVANAGARI_FONT` to a `.ttf` path (CI installs `fonts-noto-core` on Linux). They are skipped on my run with the message "set JHIGU_DEVANAGARI_FONT to a Devanagari .ttf". Print and share are tested against a fake printing platform, not a real printer or share sheet. The notes in `data/PICKER_NOTES.md` list the mutation checks made during development; I did not repeat them.

## Related guides

- [Package README](../../../flutter/README.md) and the [example app](../../../flutter/example/README.md)
- [Headless widgets](../headless-widgets/README.md): the state machines under the widgets
- [Receipts](../receipts/README.md): the document model, totals and the PDF
- [Dates](../dates/README.md), [Money](../money/README.md), [Phone](../phone/README.md), [Address](../address/README.md)
- [Tithi](../tithi/README.md) and [Calendar data](../calendar-data/README.md)
- [Dart library](../../../dart/README.md) and [other examples](../../../examples/README.md)
- [Picker notes](../../../data/PICKER_NOTES.md): what was checked and what was not
