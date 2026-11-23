// Plain Dart program that uses jhigu_patro_utils. Run it with `dart run`.
import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

/// The shared data files live in the repository's data/ folder. In your own app, copy
/// nepali_calendar_data.json (and the tithi files you need) into the app as assets or files.
String dataFile(String name) => '../../data/$name';

void main() {
  // Step 1: load the calendar data once. Dates need it; money, phone and SMS do not.
  final calendar = jsonDecode(File(dataFile('nepali_calendar_data.json')).readAsStringSync())
      as Map<String, dynamic>;
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: (calendar['years'] as Map<String, dynamic>)
        .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
    supportedStartYear: (calendar['supportedRange'] as Map)['start'] as int,
    supportedEndYear: (calendar['supportedRange'] as Map)['end'] as int,
    verifiedThrough: calendar['verifiedThrough'] as int,
  ));

  // Step 2: dates.
  print('== Dates');
  final bs = NepaliCalendar.convertADToBS(DateTime(2025, 8, 26));
  print('AD 2025-08-26 is BS ${bs.toIsoString()}');
  final d = NepaliDate.checked(2082, 5, 10);
  print('dual format:       ${formatPreset(d, DatePreset.dual)}');
  print('Nepali, Devanagari: ${formatDate(d, 'dddd, D MMMM YYYY', language: 'ne')}');
  print('+25 days:          ${d.addDays(25).toIsoString()}');
  print('parsed:            ${parseNepaliDate('10 Bhadra 2082').toIsoString()}');
  print('fiscal year:       ${fiscalYear(d).code}');

  // Step 3: money, in integer paisa.
  print('\n== Money');
  final price = Npr.fromRupees(1234567.5);
  print('paisa:    ${price.paisa}');
  print('format:   ${price.format(symbol: MoneySymbol.rs)}');
  final vat = vatExclusive(price);
  print('VAT 13%:  ${vat.vat.format(symbol: MoneySymbol.rs)} -> total ${vat.total.format(symbol: MoneySymbol.rs)}');
  print('in words: ${amountInWords(price)}');

  // Step 4: phone.
  print('\n== Phone');
  final phone = parsePhone('+977 984-1234567');
  print('${phone.e164} ${phone.type} ${phone.carrier}');
  try {
    parsePhone('98412');
  } on PhoneException catch (e) {
    print('rejected: ${e.code.name_} - ${e.message}');
  }

  // Step 5: address.
  print('\n== Address');
  print(formatAddress(localLevelId: 274, ward: 3));
  print(formatAddress(localLevelId: 274, ward: 3, language: 'ne'));

  // Step 6: SMS template and segment count (sending needs your own gateway).
  print('\n== SMS');
  final sms = renderSmsTemplate('appointment', 'en',
      {'name': 'Ram', 'date': '2082-05-10', 'time': '9:00', 'sender': 'Shop'});
  print(sms);

  // Step 7: tithi (BS 2081 and 2082 only). Hand the decoded JSON to addYear.
  print('\n== Tithi');
  final panchang = PanchangDataSource()
    ..addYear(jsonDecode(File(dataFile('2082_tithi.json')).readAsStringSync()) as Object);
  final t = panchang.sunriseTithi(2082, 1, 1)!;
  print('1 Baisakh 2082 at sunrise: ${t.tithiName} (${t.paksha})');
}
