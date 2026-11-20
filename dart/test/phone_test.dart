import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

final Map<String, dynamic> _vectors =
    jsonDecode(File('../testdata/phone.json').readAsStringSync())
        as Map<String, dynamic>;

void main() {
  group('parsePhone shared vectors', () {
    for (final v in (_vectors['valid'] as List).cast<Map<String, dynamic>>()) {
      test('accepts ${jsonEncode(v['in'])}', () {
        final r = parsePhone(
          v['in'] as String,
          allowInactive: (v['allowInactive'] as bool?) ?? false,
        );
        expect(r.e164, v['e164']);
        expect(r.national, v['national']);
        expect(r.type, v['type']);
        expect(r.carrier, v['type'] == 'mobile' ? v['carrier'] : null);
        expect(r.areaCode, v['areaCode']);
      });
    }

    for (final v
        in (_vectors['invalid'] as List).cast<Map<String, dynamic>>()) {
      test('rejects ${jsonEncode(v['in'])} with ${v['code']}', () {
        expect(
          () => parsePhone(v['in'] as String),
          throwsA(
            isA<PhoneException>()
                .having((e) => e.code.name_, 'code', v['code']),
          ),
        );
        expect(isValidPhone(v['in'] as String), isFalse);
      });
    }
  });

  group('PhoneException', () {
    test('has English and Nepali messages from the string tables', () {
      try {
        parsePhone('98412');
        fail('should throw');
      } on PhoneException catch (e) {
        expect(e.message, 'Phone number is too short');
        expect(e.localized('ne'), 'फोन नम्बर धेरै छोटो छ');
      }
    });
  });
}
