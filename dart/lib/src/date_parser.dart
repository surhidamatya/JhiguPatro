/// Parse BS dates from text (guide 7.6, D-13, D-14). Accepts ASCII or
/// Devanagari digits, English and Nepali month names with common alternate
/// spellings, and the usual separators.
///
/// Needs the calendar initialised (it checks the day against the month
/// length).
library;

import 'errors.dart';
import 'generated/month_names.dart';
import 'generated/strings.dart';
import 'nepali_calendar.dart';
import 'types.dart';

const _neDigits = '०१२३४५६७८९';

String _toAscii(String s) => s.split('').map((c) {
      final i = _neDigits.indexOf(c);
      return i < 0 ? c : i.toString();
    }).join();

String _norm(String s) => s.toLowerCase().replaceAll(RegExp('[‌‍]'), '');

final Set<String> _weekdays = {
  for (final lang in ['en', 'ne']) ...[
    for (final w in [
      ...getStrings(lang).weekdays,
      ...getStrings(lang).weekdaysShort,
    ])
      _norm(w),
  ],
};

/// Era and filler words removed before reading (guide step 2).
const _noise = ['वि.सं.', 'वि.सं', 'सम्वत्', 'संवत्', 'साल', 'गते'];

final _digitsOnly = RegExp(r'^\d+$');

/// Parses [text] as a BS date. Patterns tried in order (guide step 6, plus
/// `Y month D`, which the `gate` preset produces):
///
///  - `Y M D`: first token has 4 digits
///  - `D month Y`: month as a name, last token has 4 digits
///  - `month D Y`
///  - `Y month D`
///  - `D M Y`: last token has 4 digits
///
/// Separators `/ . , -` and spaces are all treated alike. Throws
/// [ParseException] (code `PARSE_ERROR`) with the original text as `details`.
NepaliDate parseNepaliDate(String text) {
  Never fail() => throw ParseException(getStrings('en').date.parseError, text);

  var s = _norm(_toAscii(text));
  for (final w in _noise) {
    s = s.split(w).join(' ');
  }
  s = s.replaceAll(RegExp(r'\bbs\b'), ' ').replaceAll(RegExp(r'[/.,\-]'), ' ');
  final words = s.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isNotEmpty && _weekdays.contains(words.first)) words.removeAt(0);
  if (words.length != 3) fail();

  // A token is either digits or a month name (number 1-12).
  final isNum = <bool>[];
  final val = <int>[];
  final len = <int>[];
  for (final w in words) {
    if (_digitsOnly.hasMatch(w)) {
      isNum.add(true);
      val.add(int.parse(w));
      len.add(w.length);
    } else {
      final m = monthNameTable[w];
      if (m == null) fail();
      isNum.add(false);
      val.add(m);
      len.add(0);
    }
  }

  bool four(int i) => isNum[i] && len[i] == 4;
  bool short(int i) => isNum[i] && len[i] <= 2;

  int year, month, day;
  if (four(0) && short(1) && short(2)) {
    (year, month, day) = (val[0], val[1], val[2]);
  } else if (short(0) && !isNum[1] && four(2)) {
    (day, month, year) = (val[0], val[1], val[2]);
  } else if (!isNum[0] && short(1) && four(2)) {
    (month, day, year) = (val[0], val[1], val[2]);
  } else if (four(0) && !isNum[1] && short(2)) {
    (year, month, day) = (val[0], val[1], val[2]);
  } else if (short(0) && short(1) && four(2)) {
    (day, month, year) = (val[0], val[1], val[2]);
  } else {
    fail();
  }

  if (!NepaliCalendar.isValidBSDate(year, month, day)) fail();
  return NepaliDate(year: year, month: month, day: day);
}
