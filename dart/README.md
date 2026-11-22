# jhigu_patro_utils

Bikram Sambat (Nepali) calendar, money, phone, address, receipt and SMS utilities for Dart. Offline:
the only dependency is the `pdf` package, used by `receipt_pdf.dart`.

```dart
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

// Once, at start-up: the calendar data (BS 2000 to 2100). Load the shared JSON from your assets or disk.
NepaliCalendar.initialize(InlineCalendarDataSource(
  years: years, supportedStartYear: 2000, supportedEndYear: 2100, verifiedThrough: 2083,
));

NepaliCalendar.convertADToBS(DateTime(2025, 8, 26));          // 2082-05-10
formatDate(NepaliDate.checked(2082, 5, 10), 'D MMMM YYYY', language: 'ne'); // १० भदौ २०८२
Npr.fromRupees(1234567.5).format(symbol: MoneySymbol.rs);     // Rs. 12,34,567.50
parsePhone('9841234567').e164;                                // +9779841234567
```

What is in it: date conversion, formatting and parsing; money as integer paisa with lakh grouping and VAT;
Nepal phone numbers; provinces, districts, local levels and wards; receipt and invoice totals; SMS
templates, a gateway interface and a reminder scheduler (with a file-backed store in
`sms_file_store.dart`); headless pickers and inputs (state machines for the Flutter widgets and the web
components); PDF receipts (`receipt_pdf.dart`, with a command-line Devanagari renderer in
`devanagari_command_renderer.dart`).

The same logic and the same results as the TypeScript package, checked against shared test vectors. The
guide, the accuracy limits (calendar years after BS 2083 are not verified against the official calendar,
the Nepali strings are unreviewed by a native speaker) and the design notes are in the
[repository](https://github.com/surhidamatya/JhiguPatro).
