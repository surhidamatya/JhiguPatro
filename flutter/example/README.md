# jhigu_example

A small Flutter app that shows every widget in [`jhigu_patro_flutter`](../README.md) on one scrolling page. It is a demo and a manual test bench, not a template. Events you trigger are written to a log at the bottom of the page.

Full guide: [docs/features/flutter/README.md](../../docs/features/flutter/README.md).

## Run it

The example depends on the package (`path: ..`) and on `jhigu_patro_utils` (`path: ../../dart`). It needs the Flutter SDK (it was checked with Flutter 3.44.2; the app's `pubspec.yaml` asks for Dart `^3.12.2`).

```
cd flutter/example
flutter pub get
flutter run -d chrome
```

Only the `web/` platform folder is in this directory, so the example targets the web. To run it on another platform you would first have to generate that platform's folder (for example `flutter create .` here); that was not tried.

What was run for this README: `flutter pub get`, `flutter analyze` (no issues) and `flutter build web` (succeeded, output in `build/web`, which is git-ignored). `flutter run -d chrome` was not run for this README. An earlier check in Chromium is recorded in [data/PICKER_NOTES.md](../../data/PICKER_NOTES.md). To serve the built files, serve `build/web` with any static server.

## The asset

`assets/nepali_calendar_data.json` is declared in `pubspec.yaml`. It is a symlink to `data/nepali_calendar_data.json` at the repository root, so the data is not copied. `main()` reads it with `rootBundle`, decodes it and calls `NepaliCalendar.initialize(InlineCalendarDataSource(...))` before `runApp`. Every widget needs that call first. A real app should copy the file instead of using a symlink.

## Map of `lib/main.dart`

| Where | What it shows |
|---|---|
| `main()` | Loads the asset and initialises `NepaliCalendar` (`supportedRange` and `verifiedThrough` come from the file). |
| `ExampleApp` | A light and a dark Material 3 theme from one seed colour. No `JhiguTheme`, so the widgets use the `ColorScheme`. |
| "English, AD shown" | `JhiguDatePicker` with defaults. |
| "Nepali, min 2082-05-05, max 2082-06-20" | `JhiguDatePicker` with `language: 'ne'`, `min`, `max` and a preset value. |
| "JhiguCalendar with events" | `JhiguCalendar` with `year`, `month`, three events, `onSelect` and `onMonthChanged`. |
| "JhiguRangePicker" | `JhiguRangePicker` with `onChanged`. |
| "JhiguMoneyField and JhiguPhoneField" | `JhiguMoneyField` (logs `paisa`) and `JhiguPhoneField` (logs the E.164 number). |
| "JhiguAddressPicker" | `JhiguAddressPicker`; a complete choice is turned into text with `formatAddress`. |
| "JhiguDateField and dialogs" | `JhiguDateField` with `max`, `JhiguDateRangeField`, and a button that calls `showJhiguDateRangePicker`. |
| "FlutterDevanagariRenderer" | A button that renders a Nepali string to a PNG and builds a Nepali receipt PDF (shows the picture size and PDF byte count). A button that opens `JhiguReceiptPreview` on a new page. A button that calls `shareReceipt`. |
| The log | The last events, newest first. |

`_nepaliReceipt()` builds the sample `ReceiptDocument` (number `2082/83-001`, Nepali language, A4). The widgets get a fixed `today` of 2082-05-10 so the screen looks the same on every day.

The `Key`s `preview`, `share`, `png`, `pdfnote` and `log` are there so a driver can find those widgets.

## Not covered here

The example does not use `JhiguTheme`, `showJhiguDatePicker` directly (the date field calls it), `printReceipt`, or a `Form`. For those, see the recipes in the guide. Nothing here was run on a phone, tablet or desktop target, or with a screen reader; the guide's platform notes list what is and is not verified.
