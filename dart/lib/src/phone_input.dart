/// Headless phone input (guide 15.1, P2): a framework-free state machine for a
/// phone number text field. It formats as the user types, shows the carrier once
/// the prefix is known, and gives a validation message from the string tables.
/// Validation is the same parser as [parsePhone]; this only adds the lenient,
/// partial-input handling around it.
///
/// Rules:
///  - Devanagari digits are converted; everything but digits and a leading `+`
///    is dropped. `+977` or `00977` (or `977` in front of more than 10 digits)
///    is kept as a `+977 ` prefix.
///  - A number whose first two digits can start a known mobile prefix (or a
///    lone 9) is a mobile: 10 digits, shown `984-1234567`, a leading trunk 0 is
///    dropped. Anything else is a landline: 8 digits, shown `01-4123456` (the
///    trunk 0 stays only if the user typed it). Digits past the length are kept
///    and reported as `TOO_LONG`, never cut off silently.
///  - Errors appear as early as they can be known (an unknown mobile prefix or
///    area code, an inactive prefix). `TOO_SHORT` is only reported after
///    [PhoneInput.blur].
///  - Every action that changes the state notifies listeners once.
library;

import 'generated/phone.dart';
import 'input_caret.dart';
import 'phone.dart';

/// Immutable state; a new instance is created on every change.
class PhoneInputState {
  /// The text to show in the field.
  final String text;

  /// Where the caret belongs in [text].
  final int caret;

  /// `+9779841234567` when the number is valid, else null.
  final String? e164;

  /// `984-1234567` / `01-4123456` when valid, else null.
  final String? national;
  final bool valid;

  /// `'mobile'` or `'landline'` once known; the parsed type when valid.
  final String? type;

  /// Carrier name once the 3-digit mobile prefix is known.
  final String? carrier;

  /// Landline area code once known (without the trunk 0).
  final String? areaCode;

  /// Why the number is not (yet) valid, when that is already known.
  final PhoneErrorCode? error;

  /// [error] in [language] from the string tables.
  final String? message;

  /// True after [PhoneInput.blur].
  final bool touched;
  final String language;

  const PhoneInputState({
    required this.text,
    required this.caret,
    required this.e164,
    required this.national,
    required this.valid,
    required this.type,
    required this.carrier,
    required this.areaCode,
    required this.error,
    required this.message,
    required this.touched,
    required this.language,
  });
}

const _neDigits = '०१२३४५६७८९';

String _toAscii(String s) => s.split('').map((c) {
      final i = _neDigits.indexOf(c);
      return i < 0 ? c : i.toString();
    }).join();

bool _isDigit(String c) =>
    c.length == 1 && c.compareTo('0') >= 0 && c.compareTo('9') <= 0;
bool _isSig(String c) => _isDigit(c) || c == '+';

/// Most digits kept after the country code; more are dropped.
const _maxDigits = 15;

final Map<String, PhoneMobilePrefix> _mobile = {
  for (final m in phoneMobilePrefixes) m.prefix: m,
};
final Set<String> _areas = {for (final a in phoneAreaCodes) a.code};

/// First two digits of every known mobile prefix (96, 97, 98, 90).
final Set<String> _mobileStart = {
  for (final m in phoneMobilePrefixes) m.prefix.substring(0, 2),
};

bool _mobileLike(String nsn) =>
    nsn.startsWith('9') &&
    (nsn.length < 2 || _mobileStart.contains(nsn.substring(0, 2)));

int _areaLength(String nsn) {
  if (nsn.startsWith('1')) {
    return nsn.length >= 2 && (nsn[1] == '0' || nsn[1] == '1') ? 2 : 1;
  }
  return 2;
}

/// BAD_PREFIX as soon as the landline structure is known to be wrong.
bool _landlineProblem(String nsn) {
  if (nsn.startsWith('1')) {
    return nsn.length >= 2 && !RegExp(r'^1[0-6]').hasMatch(nsn);
  }
  if (nsn.length >= 2 && !_areas.contains(nsn.substring(0, 2))) return true;
  if (nsn.length >= 3) {
    final re =
        nsn.substring(0, 2) == '99' ? RegExp(r'^[02-6]$') : RegExp(r'^[2-6]$');
    return !re.hasMatch(nsn[2]);
  }
  return false;
}

String? _landlineArea(String nsn) {
  if (nsn.startsWith('1')) {
    if (nsn.length < 2 || !RegExp(r'^1[0-6]').hasMatch(nsn)) return null;
    return _areaLength(nsn) == 2 ? nsn.substring(0, 2) : '1';
  }
  return nsn.length >= 2 && _areas.contains(nsn.substring(0, 2))
      ? nsn.substring(0, 2)
      : null;
}

class _Item {
  final String ch;
  final int idx;
  const _Item(this.ch, this.idx);
}

class PhoneInput {
  final bool allowInactive;
  String _language;
  bool _touched = false;
  late PhoneInputState _state;
  final List<void Function(PhoneInputState)> _listeners = [];

  /// [language] is `'en'` or `'ne'`. [value] is the initial text (not an
  /// event).
  PhoneInput(
      {String language = 'en', this.allowInactive = false, String? value})
      : _language = language {
    _state = PhoneInputState(
      text: '',
      caret: 0,
      e164: null,
      national: null,
      valid: false,
      type: null,
      carrier: null,
      areaCode: null,
      error: null,
      message: null,
      touched: false,
      language: _language,
    );
    if (value != null && value.isNotEmpty) _setRaw(value, value.length);
  }

  PhoneInputState get state => _state;

  /// Returns a function that unsubscribes.
  void Function() subscribe(void Function(PhoneInputState) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  bool _same(PhoneInputState a, PhoneInputState b) =>
      a.text == b.text &&
      a.caret == b.caret &&
      a.error == b.error &&
      a.language == b.language &&
      a.touched == b.touched &&
      a.valid == b.valid &&
      a.carrier == b.carrier &&
      a.type == b.type &&
      a.areaCode == b.areaCode &&
      a.e164 == b.e164;

  void _commit(PhoneInputState next) {
    if (_same(next, _state)) return;
    _state = next;
    for (final l in List.of(_listeners)) {
      l(_state);
    }
  }

  void _setRaw(String text, int caret) => _commit(_resolve(text, caret));

  /// Everything derived from the raw field text.
  PhoneInputState _resolve(String text, int caret) {
    final s = _toAscii(text);
    var plus = false;
    _Item? plusItem;
    var items = <_Item>[];
    for (var i = 0; i < s.length; i++) {
      final c = s[i];
      if (_isDigit(c)) {
        items.add(_Item(c, i));
      } else if (c == '+' && items.isEmpty && !plus) {
        plus = true;
        plusItem = _Item(c, i);
      }
    }
    // 00977... counts as +977...; bare 977 counts when too long to be national.
    if (!plus &&
        items.length >= 2 &&
        items[0].ch == '0' &&
        items[1].ch == '0') {
      plus = true;
      plusItem = items[0];
      items = items.sublist(2);
    } else if (!plus &&
        items.length > 10 &&
        items.take(3).map((i) => i.ch).join() == '977') {
      plus = true;
      plusItem = _Item('+', items[0].idx);
    }

    var cc = <_Item>[];
    var foreign = false;
    if (plus) {
      cc = items.take(3).toList();
      final typed = cc.map((i) => i.ch).join();
      foreign = typed != '977'.substring(0, typed.length);
      items = items.length > 3 ? items.sublist(3) : <_Item>[];
    }

    if (foreign) {
      // Not Nepal: keep what was typed (no formatting) and report BAD_PREFIX.
      final kept = [...cc, ...items].take(_maxDigits).toList();
      final out = '+${kept.map((i) => i.ch).join()}';
      final count = [if (plusItem != null) plusItem, ...kept]
          .where((i) => i.idx < caret)
          .length;
      return _finish(out, placeCaret(out, count, _isSig),
          PhoneErrorCode.badPrefix, null, null, null, null);
    }

    // National digits: trunk 0, mobile or landline shape.
    _Item? trunk;
    if (items.isNotEmpty && items[0].ch == '0') {
      trunk = items[0];
      items = items.sublist(1);
    }
    var nsn = items.map((i) => i.ch).join();
    final mobile = _mobileLike(nsn);
    final cap = mobile ? phoneMobileLength : phoneLandlineLength;
    // Never cut a number short silently: digits past the length stay.
    items = items.take(_maxDigits).toList();
    nsn = nsn.length > _maxDigits ? nsn.substring(0, _maxDigits) : nsn;
    final keepTrunk = trunk != null && !mobile;

    // Display.
    var formatted = nsn;
    if (mobile) {
      if (nsn.length > 3)
        formatted = '${nsn.substring(0, 3)}-${nsn.substring(3)}';
    } else if (nsn.isNotEmpty) {
      final al = _areaLength(nsn);
      if (nsn.length > al) {
        formatted = '${nsn.substring(0, al)}-${nsn.substring(al)}';
      }
    }
    final prefix = plus
        ? '+${cc.map((i) => i.ch).join()}${nsn.isNotEmpty || keepTrunk ? ' ' : ''}'
        : '';
    final out = '$prefix${keepTrunk ? '0' : ''}$formatted';
    final sig = <_Item>[
      if (plusItem != null) plusItem,
      ...cc,
      if (trunk != null && !mobile) trunk,
      ...items,
    ];
    final count = sig.where((i) => i.idx < caret).length;

    // Facts and errors.
    PhoneErrorCode? error;
    String? carrier;
    String? type;
    String? areaCode;
    if (nsn.isNotEmpty) {
      if (mobile) {
        if (nsn.length >= 3) {
          type = 'mobile';
          final entry = _mobile[nsn.substring(0, 3)];
          if (entry == null) {
            error = PhoneErrorCode.badPrefix;
          } else {
            carrier = entry.carrier;
            if (!entry.active && !allowInactive) {
              error = PhoneErrorCode.inactivePrefix;
            }
          }
        }
      } else {
        if (nsn.length >= 2) type = 'landline';
        areaCode = _landlineArea(nsn);
        if (_landlineProblem(nsn)) error = PhoneErrorCode.badPrefix;
      }
    }
    return _finish(out, placeCaret(out, count, _isSig), error, carrier, type,
        areaCode, nsn.length >= cap ? nsn : null, plus);
  }

  /// Validate a complete number with the real parser and build the state.
  PhoneInputState _finish(
    String out,
    int caret,
    PhoneErrorCode? earlyError,
    String? carrier,
    String? type,
    String? areaCode,
    String? complete, [
    bool plus = false,
  ]) {
    var error = earlyError;
    String? e164;
    String? national;
    var valid = false;
    if (out.isNotEmpty && earlyError == null && complete != null) {
      try {
        final p = parsePhone(
          '${plus ? '+977' : ''}$complete',
          allowInactive: allowInactive,
        );
        e164 = p.e164;
        national = p.national;
        valid = true;
        type = p.type;
        carrier = p.carrier;
        areaCode = p.areaCode;
      } on PhoneException catch (e) {
        error = e.code;
      }
    } else if (out.isNotEmpty && error == null && _touched) {
      error = PhoneErrorCode.tooShort;
    }
    return PhoneInputState(
      text: out,
      caret: caret,
      e164: e164,
      national: national,
      valid: valid,
      type: type,
      carrier: carrier,
      areaCode: areaCode,
      error: error,
      message:
          error == null ? null : PhoneException(error).localized(_language),
      touched: _touched,
      language: _language,
    );
  }

  /// The user changed the field. [caret] defaults to the end of [text].
  void input(String text, [int? caret]) => _setRaw(text, caret ?? text.length);

  /// Leaving the field: report `TOO_SHORT` for an unfinished number.
  void blur() {
    _touched = true;
    _commit(_resolve(_state.text, _state.caret));
  }

  /// Set the text from code (same as [input] with the caret at the end).
  void setValue(String text) => _setRaw(text, text.length);

  void clear() {
    _touched = false;
    _setRaw('', 0);
  }

  void setLanguage(String language) {
    _language = language;
    _commit(_resolve(_state.text, _state.caret));
  }
}
