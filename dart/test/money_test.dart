import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

final Map<String, dynamic> v =
    jsonDecode(File('../testdata/money.json').readAsStringSync())
        as Map<String, dynamic>;

List<Map<String, dynamic>> list(Object? x) =>
    (x as List).cast<Map<String, dynamic>>();

Npr p(num n) => Npr.fromPaisa(n.toInt());

String code(void Function() fn) {
  try {
    fn();
  } on MoneyException catch (e) {
    return e.code.name_;
  }
  return 'NO_ERROR';
}

List<int> paisas(List<Npr> xs) => xs.map((x) => x.paisa).toList();

MoneySymbol sym(String? s) => switch (s) {
      'Rs.' => MoneySymbol.rs,
      'रु' => MoneySymbol.ru,
      _ => MoneySymbol.none,
    };

MoneyDecimals dec(String? s) => switch (s) {
      'always' => MoneyDecimals.always,
      'never' => MoneyDecimals.never,
      _ => MoneyDecimals.auto,
    };

void main() {
  group('groupLakh', () {
    for (final t in list(v['groupLakh'])) {
      test(t['in'] as String,
          () => expect(groupLakh(t['in'] as String), t['out']));
    }
  });

  group('format', () {
    for (final t in list(v['format'])) {
      final o = t['options'] as Map<String, dynamic>;
      test('${t['paisa']} ${jsonEncode(o)}', () {
        expect(
          p(t['paisa'] as num).format(
            symbol: sym(o['symbol'] as String?),
            devanagari: (o['devanagari'] as bool?) ?? false,
            decimals: dec(o['decimals'] as String?),
          ),
          t['out'],
        );
      });
    }
  });

  group('parse', () {
    for (final t in list((v['parse'] as Map)['valid'])) {
      test('accepts ${jsonEncode(t['in'])}', () {
        expect(Npr.parse(t['in'] as String).paisa, t['paisa']);
      });
    }
    for (final t in list((v['parse'] as Map)['invalid'])) {
      test('rejects ${jsonEncode(t['in'])} with ${t['code']}', () {
        expect(code(() => Npr.parse(t['in'] as String)), t['code']);
      });
    }
    test('round-trips format(always) for many amounts', () {
      for (final n in [
        0,
        1,
        99,
        100,
        12345,
        -12345,
        99999999,
        1234567890123,
        -1234567890123
      ]) {
        expect(Npr.parse(p(n).format(decimals: MoneyDecimals.always)).paisa, n);
        expect(
          Npr.parse(
            p(n).format(decimals: MoneyDecimals.always, symbol: MoneySymbol.rs),
          ).paisa,
          n,
        );
        expect(
          Npr.parse(
            p(n).format(
              decimals: MoneyDecimals.always,
              symbol: MoneySymbol.ru,
              devanagari: true,
            ),
          ).paisa,
          n,
        );
      }
    });
  });

  group('constructors', () {
    for (final t in list((v['fromRupees'] as Map)['valid'])) {
      test('fromRupees(${t['in']})', () {
        expect(Npr.fromRupees((t['in'] as num).toDouble()).paisa, t['paisa']);
      });
    }
    for (final t in list((v['fromRupees'] as Map)['invalid'])) {
      test('fromRupees(${t['in']}) throws', () {
        expect(
            code(() => Npr.fromRupees((t['in'] as num).toDouble())), t['code']);
      });
    }
    for (final t in list((v['fromPaisa'] as Map)['invalid'])) {
      // 1.5 cannot be expressed as a Dart int.
      if (t['in'] is! int) continue;
      test('fromPaisa(${t['in']}) throws', () {
        expect(code(() => Npr.fromPaisa(t['in'] as int)), t['code']);
      });
    }
    test('rejects NaN and Infinity', () {
      expect(code(() => Npr.fromRupees(double.nan)), 'INVALID_ARGUMENT');
      expect(code(() => Npr.fromRupees(double.infinity)), 'INVALID_ARGUMENT');
    });
  });

  group('arithmetic', () {
    for (final t in list(v['percent'])) {
      test('percent ${t['paisa']} @${t['bp']}', () {
        expect(p(t['paisa'] as num).percent(t['bp'] as int).paisa, t['out']);
      });
    }
    for (final t in list((v['timesDecimal'] as Map)['valid'])) {
      test('${t['paisa']} x "${t['by']}"', () {
        expect(p(t['paisa'] as num).timesDecimal(t['by'] as String).paisa,
            t['out']);
      });
    }
    for (final s
        in ((v['timesDecimal'] as Map)['invalid'] as List).cast<String>()) {
      test('timesDecimal(${jsonEncode(s)}) throws', () {
        expect(code(() => p(1).timesDecimal(s)), 'INVALID_ARGUMENT');
      });
    }
    for (final t in list((v['times'] as Map)['valid'])) {
      test('${t['paisa']} x ${t['by']}', () {
        expect(p(t['paisa'] as num).times(t['by'] as int).paisa, t['out']);
      });
    }
    for (final t in list((v['times'] as Map)['invalid'])) {
      // 1.5 cannot be expressed as a Dart int.
      if (t['by'] is! int) continue;
      test('${t['paisa']} x ${t['by']} throws', () {
        expect(
            code(() => p(t['paisa'] as num).times(t['by'] as int)), t['code']);
      });
    }
    for (final t in list((v['dividedBy'] as Map)['valid'])) {
      test('${t['paisa']} * ${t['times']} / ${t['divisor']}', () {
        expect(
          p(t['paisa'] as num)
              .dividedBy(t['divisor'] as int, times: t['times'] as int)
              .paisa,
          t['out'],
        );
      });
    }
    for (final t in list((v['dividedBy'] as Map)['invalid'])) {
      test('dividedBy(${t['divisor']}) throws', () {
        expect(
          code(() => p(t['paisa'] as num)
              .dividedBy(t['divisor'] as int, times: t['times'] as int)),
          t['code'],
        );
      });
    }
    for (final t in list(v['range'])) {
      test('${t['op']} ${t['a']} ${t['b']}', () {
        Npr run() => t['op'] == 'plus'
            ? p(t['a'] as num).plus(p(t['b'] as num))
            : p(t['a'] as num).minus(p(t['b'] as num));
        if (t['code'] != null) {
          expect(code(run), t['code']);
        } else {
          expect(run().paisa, t['out']);
        }
      });
    }
    test('compare helpers', () {
      expect(p(1).compareTo(p(2)), lessThan(0));
      expect(p(2).compareTo(p(2)), 0);
      expect(p(3).compareTo(p(2)), greaterThan(0));
      expect(p(0).isZero, isTrue);
      expect(p(-1).isNegative, isTrue);
      expect(p(-5).abs().paisa, 5);
      expect(p(5).negate().paisa, -5);
      expect(p(5) == p(5), isTrue);
      expect(p(5).hashCode, p(5).hashCode);
    });
  });

  group('allocate and split', () {
    for (final t in list((v['allocate'] as Map)['valid'])) {
      test('allocate ${t['paisa']} ${jsonEncode(t['ratios'])}', () {
        expect(
          paisas(p(t['paisa'] as num)
              .allocate((t['ratios'] as List).cast<int>().toList())),
          t['out'],
        );
      });
    }
    for (final r in ((v['allocate'] as Map)['invalid'] as List)) {
      // A non-integer ratio cannot be expressed as a Dart int.
      if ((r as List).any((x) => x is! int)) continue;
      test('allocate ${jsonEncode(r)} throws', () {
        expect(code(() => p(10).allocate(r.cast<int>())), 'INVALID_ARGUMENT');
      });
    }
    for (final t in list((v['split'] as Map)['valid'])) {
      test('split ${t['paisa']} into ${t['n']}', () {
        expect(paisas(p(t['paisa'] as num).split(t['n'] as int)), t['out']);
      });
    }
    for (final n in ((v['split'] as Map)['invalid'] as List)) {
      if (n is! int) continue;
      test('split($n) throws', () {
        expect(code(() => p(10).split(n)), 'INVALID_ARGUMENT');
      });
    }

    test('10,000 random allocations always add up to the total', () {
      final rnd = Random(12345);
      for (var i = 0; i < 10000; i++) {
        final total = (rnd.nextBool() ? 1 : -1) * rnd.nextInt(1000000000);
        final ratios =
            List<int>.generate(1 + rnd.nextInt(12), (_) => rnd.nextInt(1000));
        if (ratios.every((r) => r == 0)) ratios[0] = 1;
        final shares = p(total).allocate(ratios);
        expect(shares.fold<int>(0, (a, s) => a + s.paisa), total);
        for (var k = 0; k < ratios.length; k++) {
          if (ratios[k] == 0) expect(shares[k].paisa, 0);
        }
      }
    });
  });

  group('VAT', () {
    for (final t in list(v['vatExclusive'])) {
      test('exclusive ${t['paisa']} @${t['bp']}', () {
        final r = vatExclusive(p(t['paisa'] as num), bp: t['bp'] as int);
        expect([r.subtotal.paisa, r.vat.paisa, r.total.paisa],
            [t['subtotal'], t['vat'], t['total']]);
      });
    }
    for (final t in list(v['vatInclusive'])) {
      test('inclusive ${t['paisa']} @${t['bp']}', () {
        final r = vatInclusive(p(t['paisa'] as num), bp: t['bp'] as int);
        expect([r.subtotal.paisa, r.vat.paisa, r.total.paisa],
            [t['subtotal'], t['vat'], t['total']]);
      });
    }
    test('default rate is 13% and parts always add up', () {
      expect(vatExclusive(p(100000)).vat.paisa, 13000);
      for (var n = 0; n < 2000; n++) {
        final r = vatInclusive(p(n));
        expect(r.subtotal.plus(r.vat).paisa, n);
      }
    });
  });

  test('errors localize', () {
    const e = MoneyException(MoneyErrorCode.badFormat);
    expect(e.message, e.localized('en'));
    expect(e.localized('ne'), isNot(e.localized('en')));
  });

  group('numberToWords', () {
    final words = v['words'] as Map<String, dynamic>;
    for (final t in list(words['numbers'])) {
      test('${t['in']}', () => expect(numberToWords(t['in'] as int), t['out']));
    }
    for (final n in (words['numberInvalid'] as List)) {
      if (n is! int) continue;
      test('rejects $n', () {
        expect(code(() => numberToWords(n)), 'INVALID_ARGUMENT');
      });
    }
    test('rejects above the range', () {
      expect(code(() => numberToWords(maxPaisa + 1)), 'INVALID_ARGUMENT');
    });
    test('matches an independent converter for 0..999', () {
      for (var n = 0; n < 1000; n++) {
        expect(numberToWords(n), _naive999(n), reason: '$n');
      }
    });
  });

  group('amountInWords', () {
    final words = v['words'] as Map<String, dynamic>;
    for (final t in list(words['amount'])) {
      final o = t['options'] as Map<String, dynamic>;
      test('${t['paisa']} ${jsonEncode(o)}', () {
        expect(
          amountInWords(
            p(t['paisa'] as num),
            letterCase: (o['letterCase'] as String?) ?? 'title',
            prefix: o['prefix'] as String?,
            suffix: o['suffix'] as String?,
            paisaLabel: o['paisaLabel'] as String?,
            joiner: o['joiner'] as String?,
            minus: o['minus'] as String?,
          ),
          t['out'],
        );
      });
    }
    test('Npr.inWords matches', () {
      expect(p(12345).inWords(), amountInWords(p(12345)));
    });
    test('an unsupported language is an error', () {
      expect(
        code(() => amountInWords(p(1),
            language: words['unsupportedLanguage'] as String)),
        'INVALID_ARGUMENT',
      );
    });
  });
}

/// Independent, naive English converter for 0..999 only.
String _naive999(int n) {
  const small = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tens = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety'
  ];
  if (n < 20) return small[n];
  if (n < 100) return tens[n ~/ 10] + (n % 10 != 0 ? '-${small[n % 10]}' : '');
  return '${small[n ~/ 100]} hundred${n % 100 != 0 ? ' ${_naive999(n % 100)}' : ''}';
}
