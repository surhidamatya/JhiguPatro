import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _v = _read('../testdata/money-words-ne.json');
final _table = _read('../data/nepali-numbers.json');
Npr _p(int n) => Npr.fromPaisa(n);

List<Map<String, dynamic>> _list(Object? x) =>
    (x as List).cast<Map<String, dynamic>>();

String _code(void Function() fn) {
  try {
    fn();
  } on MoneyException catch (e) {
    return e.code.name_;
  }
  return 'NO_ERROR';
}

String _ne(int n) => numberToWords(n, language: 'ne');
String _amt(int paisa,
        {String? rupeesLabel,
        String? prefix,
        String? suffix,
        String? paisaLabel,
        String? joiner,
        String letterCase = 'title'}) =>
    amountInWords(_p(paisa),
        language: 'ne',
        rupeesLabel: rupeesLabel,
        prefix: prefix,
        suffix: suffix,
        paisaLabel: paisaLabel,
        joiner: joiner,
        letterCase: letterCase);

void main() {
  group('Nepali word table (data/nepali-numbers.json)', () {
    test('has 100 distinct words and the generated copy matches the data file',
        () {
      final words = (_table['words'] as List).cast<String>();
      expect(words, hasLength(100));
      expect(words.toSet(), hasLength(100));
      expect(nepaliNumberWords, words);
      expect(nepaliNumberReview, (_table['review'] as List).cast<String>());
      final scales = _table['scales'] as Map<String, dynamic>;
      expect(nepaliScaleHundred, scales['hundred']);
      expect(nepaliScaleThousand, scales['thousand']);
      expect(nepaliScaleLakh, scales['lakh']);
      expect(nepaliScaleCrore, scales['crore']);
      expect(nepaliScaleArba, scales['arba']);
      expect(nepaliScaleKharba, scales['kharba']);
    });
    test('says it is not native-speaker reviewed, and labels every word', () {
      expect(_table['reviewed'], false);
      final review = (_table['review'] as List).cast<String>();
      expect(review, hasLength(100));
      for (final r in review) {
        expect(['two-sources', 'single-source', 'disputed'], contains(r));
      }
    });
    test('lists the other spellings only for the disputed words', () {
      final review = (_table['review'] as List).cast<String>();
      final disputed = [
        for (var i = 0; i < review.length; i++)
          if (review[i] == 'disputed') '$i'
      ]..sort();
      final variants = _table['variants'] as Map<String, dynamic>;
      expect(variants.keys.toList()..sort(), disputed);
      variants.forEach((i, alts) {
        for (final a in (alts as List).cast<String>()) {
          expect(a, isNot(nepaliNumberWords[int.parse(i)]),
              reason: 'variant of $i');
        }
      });
    });
    test('has no space in any word', () {
      for (final w in nepaliNumberWords) {
        expect(w, isNot(contains(' ')));
      }
    });
  });

  group('numberToWords in Nepali', () {
    for (final t in _list(_v['numbers'])) {
      test('${t['in']}', () => expect(_ne(t['in'] as int), t['out']));
    }
    for (final t in _list((_v['fromNepalKit'] as Map)['numbers'])) {
      test(
          'nepal-kit: ${t['in']}', () => expect(_ne(t['in'] as int), t['out']));
    }
    test('every number 1..99 is its own single word', () {
      for (var n = 1; n < 100; n++) {
        expect(_ne(n), nepaliNumberWords[n]);
      }
    });
    test('is right at the largest amount (checked against a BigInt division)',
        () {
      final kharba = BigInt.from(maxPaisa) ~/ BigInt.from(100000000000);
      expect(
        _ne(maxPaisa).startsWith('${_ne(kharba.toInt())} $nepaliScaleKharba '),
        isTrue,
      );
    });
    test('rejects negative and too large numbers', () {
      expect(_code(() => _ne(-1)), 'INVALID_ARGUMENT');
      expect(_code(() => _ne(maxPaisa + 1)), 'INVALID_ARGUMENT');
    });
    test('English stays the default', () {
      expect(numberToWords(21), 'twenty-one');
      expect(numberToWords(21, language: 'en'), 'twenty-one');
    });
    test('rejects an unknown language', () {
      expect(_code(() => numberToWords(1, language: 'fr')), 'INVALID_ARGUMENT');
    });
  });

  group('amountInWords in Nepali', () {
    for (final t in _list(_v['amount'])) {
      test('${t['paisa']}', () => expect(_amt(t['paisa'] as int), t['out']));
    }
    for (final t in _list((_v['fromNepalKit'] as Map)['amount'])) {
      test('nepal-kit: ${t['paisa']}',
          () => expect(_amt(t['paisa'] as int), t['out']));
    }
    test('Npr.inWords takes the language', () {
      expect(_p(12345).inWords(language: 'ne'), _amt(12345));
    });
    test('rupees come after their words, then paisa, then the closing word',
        () {
      final s = _amt(12345);
      expect(s.endsWith(' पैसा मात्र'), isTrue);
      expect(s.indexOf('रुपैयाँ'), lessThan(s.indexOf('पैसा')));
    });
    test(
        'zero rupees with paisa drops the rupee part; zero is शून्य रुपैयाँ मात्र',
        () {
      expect(_amt(50), '${nepaliNumberWords[50]} पैसा मात्र');
      expect(_amt(0), 'शून्य रुपैयाँ मात्र');
    });
    test('a negative amount starts with ऋण', () {
      expect(_amt(-100), 'ऋण एक रुपैयाँ मात्र');
    });
    test('labels can be replaced, and letterCase does not touch Devanagari',
        () {
      expect(
        _amt(10150,
            rupeesLabel: 'रु',
            paisaLabel: 'पै',
            suffix: '',
            joiner: 'र',
            letterCase: 'lower'),
        '${_ne(101)} रु र ${_ne(50)} पै',
      );
      expect(_amt(100, prefix: 'रकम', suffix: ''), 'रकम एक रुपैयाँ');
    });
    test('English output is unchanged by the Nepali options', () {
      expect(amountInWords(_p(12345)),
          'Rupees One Hundred Twenty-Three and Forty-Five Paisa Only');
      expect(amountInWords(_p(12345), language: 'en', rupeesLabel: 'x'),
          amountInWords(_p(12345)));
    });
  });
}
