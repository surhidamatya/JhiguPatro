# Example: Dart console program

A plain Dart program that uses `jhigu_patro_utils`: dates, money, phone, address, an SMS template and tithi.
It prints the same results as the [Node example](../node-script/README.md), which is the point: the two
libraries give the same answers.

## Run

```bash
cd examples/dart-console
dart pub get
dart run bin/main.dart
```

Run it from this folder: the program reads the shared data from `../../data/`.

## What you should see

```
== Dates
AD 2025-08-26 is BS 2082-05-10
dual format:       10 Bhadra 2082 (AD 26 August 2025)
...
== Money
paisa:    123456750
format:   Rs. 12,34,567.50
VAT 13%:  Rs. 1,60,493.78 -> total Rs. 13,95,061.28
...
== Tithi
1 Baisakh 2082 at sunrise: प्रतिपदा (कृष्ण)
```

## How it is put together

1. **Install:** `pubspec.yaml` has a path dependency, `jhigu_patro_utils: { path: ../../dart }`. In your own
   project use a path to the repository (see [step 1 of the guide](../README.md#step-1-get-the-packages)).
2. **Calendar data:** the program reads `nepali_calendar_data.json` and calls `NepaliCalendar.initialize` once.
   In your app, copy the JSON in as a file or an asset. Pass `verifiedThrough`.
3. **Differences from TypeScript** that show up here: `NepaliDate.toIsoString()` (not `toString()`), enum
   arguments (`DatePreset.dual`, `MoneySymbol.rs`), named parameters (`language: 'ne'`), and
   `PhoneException` with `e.code.name_`.
4. **Tithi:** `PanchangDataSource.addYear` takes the decoded JSON; reading the file is up to you.

Related guides: [dates](../../docs/features/dates/README.md), [money](../../docs/features/money/README.md),
[phone](../../docs/features/phone/README.md), [address](../../docs/features/address/README.md),
[tithi](../../docs/features/tithi/README.md).
