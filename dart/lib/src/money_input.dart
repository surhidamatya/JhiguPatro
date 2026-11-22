/// Headless money input (guide 15.1, P2): a framework-free state machine for an
/// amount text field. On every change it reformats with lakh grouping, keeps the
/// caret in place by counting the digits to its left, and accepts Devanagari
/// digits (shown as ASCII unless [MoneyDigits.native]).
///
/// Rules:
///  - Only digits and one decimal point are kept (a leading `-` when
///    `allowNegative`). A leading currency symbol (`Rs.`, `NPR`, `रु`) is
///    ignored; other characters are dropped.
///  - At most two decimal digits; extra ones are dropped.
///  - Leading zeros are removed (`007` is `7`); a lone `.` becomes `0.`.
///  - A change that would pass the largest amount ([maxPaisa]) is ignored.
///  - Every action that changes the state notifies listeners once.
library;

import 'input_caret.dart';
import 'money.dart';

/// Digit style of the text.
enum MoneyDigits { ascii, native }

/// Immutable state; a new instance is created on every change.
class MoneyInputState {
  /// The text to show in the field.
  final String text;

  /// Where the caret belongs in [text].
  final int caret;

  /// The amount, or null while the field is empty (or only `-`).
  final Npr? value;
  final MoneyDigits digits;
  final bool allowNegative;
  const MoneyInputState({
    required this.text,
    required this.caret,
    required this.value,
    required this.digits,
    required this.allowNegative,
  });

  MoneyInputState _with(
          {String? text, int? caret, Npr? value, bool keepValue = false}) =>
      MoneyInputState(
        text: text ?? this.text,
        caret: caret ?? this.caret,
        value: keepValue ? this.value : value,
        digits: digits,
        allowNegative: allowNegative,
      );
}

const _neDigits = '०१२३४५६७८९';

String _toAscii(String s) => s.split('').map((c) {
      final i = _neDigits.indexOf(c);
      return i < 0 ? c : i.toString();
    }).join();

String _toNative(String s) => s.split('').map((c) {
      final d = int.tryParse(c);
      return d == null ? c : _neDigits[d];
    }).join();

bool _isDigit(String c) =>
    c.compareTo('0') >= 0 && c.compareTo('9') <= 0 && c.length == 1;

final RegExp _symbol = RegExp(r'^(\s*-?\s*)(rs\.?|npr|रु|रू)');

class _Item {
  final String ch;
  final int idx;
  const _Item(this.ch, this.idx);
}

class MoneyInput {
  final MoneyDigits digits;
  final bool allowNegative;
  late MoneyInputState _state;
  final List<void Function(MoneyInputState)> _listeners = [];

  MoneyInput({
    Npr? value,
    this.digits = MoneyDigits.ascii,
    this.allowNegative = false,
  }) {
    _state = MoneyInputState(
      text: '',
      caret: 0,
      value: null,
      digits: digits,
      allowNegative: allowNegative,
    );
    if (value != null) _setFromValue(value, pad: false);
  }

  MoneyInputState get state => _state;

  /// Returns a function that unsubscribes.
  void Function() subscribe(void Function(MoneyInputState) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  String _show(String s) => digits == MoneyDigits.native ? _toNative(s) : s;

  void _commit(MoneyInputState next) {
    if (next.text == _state.text && next.caret == _state.caret) return;
    _state = next;
    for (final l in List.of(_listeners)) {
      l(_state);
    }
  }

  void _setFromValue(Npr? value, {required bool pad}) {
    if (value != null && value.isNegative && !allowNegative) {
      throw const MoneyException(MoneyErrorCode.invalidArgument);
    }
    final text = value == null
        ? ''
        : value.format(
            decimals: pad ? MoneyDecimals.always : MoneyDecimals.auto,
            devanagari: digits == MoneyDigits.native,
          );
    _commit(_state._with(text: text, caret: text.length, value: value));
  }

  /// The user changed the field. [text] is the raw field value and [caret] the
  /// caret position in it (default: the end).
  void input(String raw, [int? caret]) {
    final pos = caret ?? raw.length;
    final s = _toAscii(raw);
    final skip = <int>{};
    final m = _symbol.firstMatch(s.toLowerCase());
    if (m != null) {
      for (var i = m.group(1)!.length; i < m.group(0)!.length; i++) {
        skip.add(i);
      }
    }

    _Item? sign;
    _Item? dot;
    var intDigits = <_Item>[];
    final dec = <_Item>[];
    for (var i = 0; i < s.length; i++) {
      if (skip.contains(i)) continue;
      final ch = s[i];
      if (ch == '-' &&
          allowNegative &&
          sign == null &&
          dot == null &&
          intDigits.isEmpty) {
        sign = _Item(ch, i);
      } else if (ch == '.' && dot == null) {
        dot = _Item(ch, i);
      } else if (_isDigit(ch)) {
        if (dot != null) {
          if (dec.length < 2) dec.add(_Item(ch, i));
        } else {
          intDigits.add(_Item(ch, i));
        }
      }
    }
    // Leading zeros: keep at least one digit.
    while (intDigits.length > 1 && intDigits.first.ch == '0') {
      intDigits = intDigits.sublist(1);
    }
    if (dot != null && intDigits.isEmpty) intDigits = [_Item('0', dot.idx)];

    final intStr = intDigits.map((d) => d.ch).join();
    final decStr = dec.map((d) => d.ch).join();
    Npr? value;
    if (intStr.isNotEmpty) {
      var paisa = BigInt.parse(intStr) * BigInt.from(100) +
          BigInt.parse(
              decStr.padRight(2, '0').isEmpty ? '0' : decStr.padRight(2, '0'));
      if (paisa > BigInt.from(maxPaisa))
        return; // would pass the largest amount
      if (sign != null) paisa = -paisa;
      value = Npr.fromPaisa(paisa.toInt());
    }

    final seq = <_Item>[
      if (sign != null) sign,
      ...intDigits,
      if (dot != null) dot,
      ...dec,
    ];
    final text = _show(
      '${sign != null ? '-' : ''}${intStr.isEmpty ? '' : groupLakh(intStr)}${dot != null ? '.$decStr' : ''}',
    );
    final count = seq.where((it) => it.idx < pos).length;
    _commit(
      _state._with(
        text: text,
        caret: placeCaret(
          text,
          count,
          (c) => _isDigit(c) || c == '.' || c == '-' || _neDigits.contains(c),
        ),
        value: value,
      ),
    );
  }

  /// Leaving the field: show two decimal digits (`1,234.5` becomes `1,234.50`).
  void blur() {
    final v = _state.value;
    if (v == null) {
      _commit(_state._with(text: '', caret: 0));
      return;
    }
    _setFromValue(v, pad: true);
  }

  /// Set the amount from code (`null` empties the field).
  void setValue(Npr? value) => _setFromValue(value, pad: false);

  void clear() => _commit(_state._with(text: '', caret: 0, value: null));
}
