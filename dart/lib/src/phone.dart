/// Nepali phone number parsing (guide section 10). Pure logic, no network.
///
/// Data comes from data/phone-prefixes.json via generated/phone.dart and is
/// best effort (see data/PHONE_NOTES.md).
library;

import 'generated/phone.dart';
import 'generated/strings.dart';

/// Why a phone number was rejected.
enum PhoneErrorCode {
  empty('EMPTY'),
  tooShort('TOO_SHORT'),
  tooLong('TOO_LONG'),
  badPrefix('BAD_PREFIX'),
  inactivePrefix('INACTIVE_PREFIX'),
  badCharacters('BAD_CHARACTERS');

  const PhoneErrorCode(this.name_);

  /// Stable code shared with the TypeScript library (e.g. `TOO_SHORT`).
  final String name_;
}

/// Typed phone validation error. [message] is English; use [localized] for `ne`.
class PhoneException implements Exception {
  final PhoneErrorCode code;
  const PhoneException(this.code);

  String get message => localized('en');

  /// Message in [language] (`'ne'` or `'en'`), from the string tables.
  String localized(String language) {
    final p = getStrings(language).phone;
    return switch (code) {
      PhoneErrorCode.empty => p.empty,
      PhoneErrorCode.tooShort => p.tooShort,
      PhoneErrorCode.tooLong => p.tooLong,
      PhoneErrorCode.badPrefix => p.badPrefix,
      PhoneErrorCode.inactivePrefix => p.inactivePrefix,
      PhoneErrorCode.badCharacters => p.badCharacters,
    };
  }

  @override
  String toString() => 'PhoneException(${code.name_}): $message';
}

/// A parsed Nepali phone number.
class ParsedPhone {
  /// `+9779841234567`. Store this form.
  final String e164;

  /// Display form: `984-1234567` (mobile) or `01-4123456` (landline).
  final String national;

  /// `'mobile'` or `'landline'`.
  final String type;

  /// Carrier name from the prefix table; null for landlines and unknown carriers.
  final String? carrier;

  /// Landline area code without the leading 0.
  final String? areaCode;

  const ParsedPhone({
    required this.e164,
    required this.national,
    required this.type,
    this.carrier,
    this.areaCode,
  });

  @override
  String toString() => e164;
}

const String _neDigits = '०१२३४५६७८९';

String _toAscii(String s) =>
    s.replaceAllMapped(RegExp('[०-९]'), (m) => '${_neDigits.indexOf(m[0]!)}');

String _format(String pattern, String digits) {
  final b = StringBuffer();
  var i = 0;
  for (final ch in pattern.split('')) {
    b.write(ch == 'd' ? digits[i++] : ch);
  }
  return b.toString();
}

final Map<String, PhoneMobilePrefix> _mobile = {
  for (final m in phoneMobilePrefixes) m.prefix: m,
};
final Set<String> _areaCodes = {for (final a in phoneAreaCodes) a.code};

/// Area code for an 8-digit landline NSN, or null if the structure is invalid.
String? _landlineArea(String nsn) {
  if (nsn[0] == '1') {
    if (!RegExp(r'^1[0-6]').hasMatch(nsn)) return null;
    final two = nsn.substring(0, 2);
    return two == '10' || two == '11' ? two : '1';
  }
  final area = nsn.substring(0, 2);
  if (!_areaCodes.contains(area)) return null;
  // 99 uses [02-6] as third digit; every other area uses [2-6].
  final third = RegExp(area == '99' ? r'^[02-6]$' : r'^[2-6]$');
  return third.hasMatch(nsn[2]) ? area : null;
}

/// Parse and validate a Nepali phone number. Accepts Devanagari digits,
/// spaces, dashes, dots, brackets, a leading 0, `+977`, `00977` or `977`.
/// Throws [PhoneException] on failure.
ParsedPhone parsePhone(String text, {bool allowInactive = false}) {
  var s = _toAscii(text).replaceAll(RegExp(r'[\s\-.()]'), '');
  if (s.isEmpty) throw const PhoneException(PhoneErrorCode.empty);
  if (!RegExp(r'^\+?\d+$').hasMatch(s)) {
    throw const PhoneException(PhoneErrorCode.badCharacters);
  }

  if (s.startsWith('00')) s = '+${s.substring(2)}';
  String nsn;
  if (s.startsWith('+')) {
    if (!s.startsWith('+977')) {
      throw const PhoneException(PhoneErrorCode.badPrefix);
    }
    nsn = s.substring(4);
  } else if (s.startsWith('977') && (s.length == 13 || s.length == 11)) {
    nsn = s.substring(3);
  } else {
    nsn = s;
  }
  if (nsn.startsWith('0')) nsn = nsn.substring(1);

  if (nsn.length == phoneMobileLength) {
    if (nsn[0] != '9') throw const PhoneException(PhoneErrorCode.badPrefix);
    final entry = _mobile[nsn.substring(0, 3)];
    if (entry == null) throw const PhoneException(PhoneErrorCode.badPrefix);
    if (!entry.active && !allowInactive) {
      throw const PhoneException(PhoneErrorCode.inactivePrefix);
    }
    return ParsedPhone(
      e164: '+977$nsn',
      national: _format(phoneFormatMobile, nsn),
      type: 'mobile',
      carrier: entry.carrier,
    );
  }

  if (nsn.length == phoneLandlineLength) {
    final area = _landlineArea(nsn);
    if (area == null) throw const PhoneException(PhoneErrorCode.badPrefix);
    final pattern =
        area == '1' ? phoneFormatLandlineKathmandu : phoneFormatLandlineOther;
    return ParsedPhone(
      e164: '+977$nsn',
      national: '0${_format(pattern, nsn)}',
      type: 'landline',
      areaCode: area,
    );
  }

  // 9 digits starting with 9 is a mobile missing a digit; otherwise by length.
  if (nsn.length < phoneLandlineLength || (nsn.length == 9 && nsn[0] == '9')) {
    throw const PhoneException(PhoneErrorCode.tooShort);
  }
  throw const PhoneException(PhoneErrorCode.tooLong);
}

/// True if [text] is a valid Nepali phone number. Never throws.
bool isValidPhone(String text, {bool allowInactive = false}) {
  try {
    parsePhone(text, allowInactive: allowInactive);
    return true;
  } on PhoneException {
    return false;
  }
}
