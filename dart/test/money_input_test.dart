import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

final Map<String, dynamic> _v =
    jsonDecode(File('../testdata/money-input.json').readAsStringSync())
        as Map<String, dynamic>;

MoneyInput _make(Map<String, dynamic> init) => MoneyInput(
      value: init['value'] == null ? null : Npr.fromPaisa(init['value'] as int),
      digits:
          init['digits'] == 'native' ? MoneyDigits.native : MoneyDigits.ascii,
      allowNegative: (init['allowNegative'] as bool?) ?? false,
    );

void _check(
    MoneyInputState s, int events, Map<String, dynamic> expected, String ctx) {
  expected.forEach((k, want) {
    final Object? got = switch (k) {
      'events' => events,
      'paisa' => s.value?.paisa,
      'text' => s.text,
      'caret' => s.caret,
      _ => throw StateError('unknown key $k'),
    };
    expect(got, want, reason: '$ctx: $k');
  });
}

void main() {
  group('money input shared scenarios', () {
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
          void run() {
            switch (step['action']) {
              case 'input':
                input.input(step['text'] as String, step['caret'] as int?);
              case 'setValue':
                input.setValue(step['arg'] == null
                    ? null
                    : Npr.fromPaisa(step['arg'] as int));
              case 'blur':
                input.blur();
              case 'clear':
                input.clear();
            }
          }

          if (step['error'] != null) {
            try {
              run();
              fail('$ctx should throw');
            } on MoneyException catch (e) {
              expect(e.code.name_, step['error']);
            }
          } else {
            run();
          }
          if (step['expect'] != null) {
            _check(input.state, events, step['expect'] as Map<String, dynamic>,
                ctx);
          }
        }
      });
    }
  });

  group('money input behaviour', () {
    test('notifies with the full new state; unsubscribe stops it', () {
      final input = MoneyInput();
      final seen = <MoneyInputState>[];
      final off = input.subscribe(seen.add);
      input.input('12', 2);
      expect(seen, hasLength(1));
      expect(identical(seen.first, input.state), isTrue);
      off();
      input.input('123', 3);
      expect(seen, hasLength(1));
    });

    test('typing digits one at a time keeps the caret at the end', () {
      final input = MoneyInput();
      for (final d in '123456789012'.split('')) {
        final caret = input.state.caret;
        final s = input.state.text;
        input.input(s.substring(0, caret) + d + s.substring(caret), caret + 1);
        expect(input.state.caret, input.state.text.length);
      }
      expect(input.state.text, '1,23,45,67,89,012');
      expect(input.state.value!.paisa, 123456789012 * 100);
    });

    test('backspacing from the end keeps the caret at the end', () {
      final input = MoneyInput(value: Npr.fromPaisa(123456700));
      while (input.state.text != '') {
        final text = input.state.text;
        final caret = input.state.caret;
        input.input(
            text.substring(0, caret - 1) + text.substring(caret), caret - 1);
        if (input.state.text != '') {
          expect(input.state.caret, input.state.text.length);
        }
      }
      expect(input.state.value, isNull);
    });

    test('placeCaret counts significant characters', () {
      bool digit(String c) => c.compareTo('0') >= 0 && c.compareTo('9') <= 0;
      expect(placeCaret('1,23,456', 0, digit), 0);
      expect(placeCaret('1,23,456', 2, digit), 3);
      expect(placeCaret('1,23,456', 6, digit), 8);
      expect(placeCaret('1,23,456', 99, digit), 8);
    });
  });
}
