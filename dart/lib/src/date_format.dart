/// Date token formatter, presets and relative text (guide 7.5, D-9 to D-12).
/// Names and labels come from the string tables; nothing user-facing is
/// hard-coded.
///
/// Tokens: `YYYY YY MMMM MMM MM M dddd ddd DD D`. Text in `[brackets]` is
/// literal. In Nepali the digits of tokens are Devanagari unless
/// `asciiDigits` is true. Needs the calendar initialised.
library;

import 'errors.dart';
import 'fiscal.dart';
import 'generated/strings.dart';
import 'types.dart';

/// Named formats for [formatPreset].
enum DatePreset {
  full,
  long,
  iso,
  slash,
  dmy,
  short,
  monthYear,
  gate,
  dual,
  relative,
  fiscal,
}

/// Longer tokens first. Bracketed text is literal.
final RegExp _token = RegExp(
  r'\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D',
);

const _neDigits = '०१२३४५६७८९';

String _nativeDigits(String s) => s.split('').map((c) {
      final d = int.tryParse(c);
      return d == null ? c : _neDigits[d];
    }).join();

String _pad(int n, int width) => n.toString().padLeft(width, '0');

String _render(
  String pattern,
  int year,
  int month,
  int day,
  int weekday,
  List<String> months,
  List<String> monthsShort,
  String language,
  bool native,
) {
  final s = getStrings(language);
  String num(String text) =>
      native && language == 'ne' ? _nativeDigits(text) : text;
  return pattern.replaceAllMapped(_token, (m) {
    final literal = m.group(1);
    if (literal != null) return literal;
    return switch (m.group(0)!) {
      'YYYY' => num(_pad(year, 4)),
      'YY' => num(_pad(year % 100, 2)),
      'MMMM' => months[month - 1],
      'MMM' => monthsShort[month - 1],
      'MM' => num(_pad(month, 2)),
      'M' => num(month.toString()),
      'dddd' => s.weekdays[weekday],
      'ddd' => s.weekdaysShort[weekday],
      'DD' => num(_pad(day, 2)),
      _ => num(day.toString()), // 'D'
    };
  });
}

/// Format a BS date with a token pattern. [language] is `'ne'` or `'en'`.
/// Throws [InvalidDateException] for a date that does not exist.
String formatDate(
  NepaliDate date,
  String pattern, {
  String language = 'en',
  bool asciiDigits = false,
}) {
  final d = NepaliDate.checked(date.year, date.month, date.day);
  final s = getStrings(language);
  return _render(
    pattern,
    d.year,
    d.month,
    d.day,
    d.weekday,
    s.months,
    s.monthsShort,
    language,
    !asciiDigits,
  );
}

/// Format an AD date (read from its year, month and day) with the same tokens,
/// using the AD month names (guide D-12).
String formatAd(
  DateTime date,
  String pattern, {
  String language = 'en',
  bool asciiDigits = false,
}) {
  final s = getStrings(language);
  return _render(
    pattern,
    date.year,
    date.month,
    date.day,
    DateTime.utc(date.year, date.month, date.day).weekday % 7,
    s.adMonths,
    s.adMonthsShort,
    language,
    !asciiDigits,
  );
}

const _presets = <DatePreset, (String, bool)>{
  DatePreset.full: ('dddd, D MMMM YYYY', true),
  DatePreset.long: ('D MMMM YYYY', true),
  DatePreset.iso: ('YYYY-MM-DD', false),
  DatePreset.slash: ('YYYY/MM/DD', false),
  DatePreset.dmy: ('DD/MM/YYYY', false),
  DatePreset.short: ('D MMM YYYY', true),
  DatePreset.monthYear: ('MMMM YYYY', true),
};

String _relative(NepaliDate date, NepaliDate today, String language) {
  final r = getStrings(language).relative;
  String num(int n) => language == 'ne' ? _nativeDigits('$n') : '$n';
  final days = today.diff(date); // positive: date is in the past
  final abs = days.abs();
  final past = days > 0;
  if (abs == 0) return r.today;
  if (abs == 1) return past ? r.yesterday : r.tomorrow;
  String inDays() =>
      (past ? r.daysAgo : r.daysLater).replaceAll('{n}', num(abs));
  if (abs <= 30) return inDays();
  final months = today.diff(date, unit: DiffUnit.months).abs();
  if (months == 0) return inDays(); // 31 days can still be under one month
  if (months <= 12) {
    if (months == 1) return past ? r.monthAgo : r.monthLater;
    return (past ? r.monthsAgo : r.monthsLater).replaceAll('{n}', num(months));
  }
  final years = today.diff(date, unit: DiffUnit.years).abs();
  if (years == 1) return past ? r.yearAgo : r.yearLater;
  return (past ? r.yearsAgo : r.yearsLater).replaceAll('{n}', num(years));
}

/// Format with a named preset. `iso`, `slash`, `dmy` and `fiscal` keep ASCII
/// digits in Nepali; `dual` prints the AD part with ASCII digits (the guide
/// says Devanagari for BS only). [today] is the reference day for `relative`
/// (default: today in Nepal; pass it in tests).
String formatPreset(
  NepaliDate date,
  DatePreset preset, {
  String language = 'en',
  NepaliDate? today,
}) {
  final d = NepaliDate.checked(date.year, date.month, date.day);
  final known = _presets[preset];
  if (known != null) {
    return formatDate(d, known.$1, language: language, asciiDigits: !known.$2);
  }
  final s = getStrings(language);
  switch (preset) {
    case DatePreset.gate:
      return formatDate(d, s.format.gatePattern, language: language);
    case DatePreset.dual:
      final ad = d.toAD();
      final adText = _render(
        'D MMMM YYYY',
        ad.year,
        ad.month,
        ad.day,
        ad.weekday % 7,
        s.adMonths,
        s.adMonthsShort,
        language,
        false,
      );
      return s.format.dualPattern
          .replaceAll('{bs}', formatDate(d, 'D MMMM YYYY', language: language))
          .replaceAll('{ad}', adText);
    case DatePreset.relative:
      return _relative(d, today ?? NepaliDate.today(), language);
    case DatePreset.fiscal:
      return fiscalYear(d).code;
    default:
      throw InvalidDataException('Unknown date preset', preset.name);
  }
}
