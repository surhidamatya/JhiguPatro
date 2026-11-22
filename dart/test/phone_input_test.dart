import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _v = _read('../testdata/phone-input.json');
final _phone = _read('../testdata/phone.json');

PhoneInput _make(Map<String, dynamic> init) => PhoneInput(
      language: (init['language'] as String?) ?? 'en',
      allowInactive: (init['allowInactive'] as bool?) ?? false,
      value: init['value'] as String?,
    );

void _check(
    PhoneInputState s, int events, Map<String, dynamic> expected, String ctx) {
  expected.forEach((k, want) {
    final Object? got = switch (k) {
      'events' => events,
      'text' => s.text,
      'caret' => s.caret,
      'e164' => s.e164,
      'national' => s.national,
      'valid' => s.valid,
      'type' => s.type,
      'carrier' => s.carrier,
      'areaCode' => s.areaCode,
      'error' => s.error?.name_,
      'message' => s.message,
      'touched' => s.touched,
      'language' => s.language,
      _ => throw StateError('unknown key $k'),
    };
    expect(got, want, reason: '$ctx: $k');
  });
}

void main() {
  group('phone input shared scenarios', () {
    for (final sc in (_v['scenarios'] as List).cast<Map<String, dynamic>>()) {
      test(sc['name'] as String, () {
        final input = _make(sc['init'] as Map<String, dynamic>);
        var events = 0;
        input.subscribe((_) => events++);
        if (sc['initExpect'] != null) {
          _check(input.state, events, sc['initExpect'] as Map<String, dynamic>,
              'init');
        }
        final steps = (sc['steps'] as List).cast<Map<String, dynamic>>();
        for (var i = 0; i < steps.length; i++) {
          final step = steps[i];
          final ctx =
              'step ${i + 1} ${step['action']}(${jsonEncode(step['text'] ?? step['arg'])})';
          switch (step['action']) {
            case 'input':
              input.input(step['text'] as String, step['caret'] as int?);
            case 'blur':
              input.blur();
            case 'clear':
              input.clear();
            case 'setLanguage':
              input.setLanguage(step['arg'] as String);
          }
          if (step['expect'] != null) {
            _check(input.state, events, step['expect'] as Map<String, dynamic>,
                ctx);
          }
        }
      });
    }
  });

  group('phone input agrees with parsePhone', () {
    test('every valid vector from the parser is valid in the input', () {
      for (final t in (_phone['valid'] as List).cast<Map<String, dynamic>>()) {
        final allow = (t['allowInactive'] as bool?) ?? false;
        final input = PhoneInput(allowInactive: allow)
          ..input(t['in'] as String);
        final s = input.state;
        final p = parsePhone(t['in'] as String, allowInactive: allow);
        expect(s.valid, isTrue, reason: '${t['in']}');
        expect(s.e164, p.e164, reason: '${t['in']}');
        expect(s.national, p.national, reason: '${t['in']}');
        expect(s.type, p.type, reason: '${t['in']}');
        expect(s.error, isNull, reason: '${t['in']}');
      }
    });

    test('numbers the parser rejects never show as valid', () {
      for (final t
          in (_phone['invalid'] as List).cast<Map<String, dynamic>>()) {
        final input = PhoneInput()..input(t['in'] as String);
        expect(input.state.valid, isFalse, reason: jsonEncode(t['in']));
      }
    });

    test('the formatted text parses back to the same number', () {
      for (final t in (_phone['valid'] as List).cast<Map<String, dynamic>>()) {
        final allow = (t['allowInactive'] as bool?) ?? false;
        final first = PhoneInput(allowInactive: allow)
          ..input(t['in'] as String);
        final again = PhoneInput(allowInactive: allow)..input(first.state.text);
        expect(again.state.text, first.state.text, reason: '${t['in']}');
        expect(again.state.e164, first.state.e164, reason: '${t['in']}');
      }
    });

    test(
        'typing a valid number one digit at a time ends valid, caret at the end',
        () {
      final input = PhoneInput();
      for (final d in '9841234567'.split('')) {
        final s = input.state;
        input.input(
            s.text.substring(0, s.caret) + d + s.text.substring(s.caret),
            s.caret + 1);
        expect(input.state.caret, input.state.text.length);
      }
      expect(input.state.valid, isTrue);
    });

    test('notifies with the full state; unsubscribe stops it', () {
      final input = PhoneInput();
      final seen = <PhoneInputState>[];
      final off = input.subscribe(seen.add);
      input.input('98', 2);
      expect(seen, hasLength(1));
      expect(identical(seen.first, input.state), isTrue);
      off();
      input.input('984', 3);
      expect(seen, hasLength(1));
    });
  });
}
