import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _vectors = _read('../testdata/address.json');
final _data = _read('../data/address.json');

AddressSearchLanguage _lang(String? s) => switch (s) {
      'en' => AddressSearchLanguage.en,
      'ne' => AddressSearchLanguage.ne,
      _ => AddressSearchLanguage.auto,
    };

void main() {
  final counts = _vectors['counts'] as Map<String, dynamic>;

  group('address data', () {
    test('generated data matches data/address.json', () {
      expect(provinces().length, counts['provinces']);
      expect(addressDistricts.length, counts['districts']);
      expect(addressLocalLevels.length, counts['localLevels']);
      final raw = (_data['localLevels'] as List)[306] as Map<String, dynamic>;
      final ll = addressLocalLevels[306];
      expect(ll.id, raw['id']);
      expect(ll.en, raw['en']);
      expect(ll.ne, raw['ne']);
      expect(ll.wards, raw['wards']);
      expect(ll.type.wire, raw['type']);
    });

    test('children counts', () {
      (counts['districtsOfProvince'] as Map<String, dynamic>).forEach((id, n) {
        expect(districtsOf(int.parse(id)).length, n);
      });
      (counts['localLevelsOfDistrict'] as Map<String, dynamic>).forEach((
        id,
        n,
      ) {
        expect(localLevelsOf(int.parse(id)).length, n);
      });
      final unknown = _vectors['unknownParent'] as Map<String, dynamic>;
      expect(districtsOf(unknown['districtsOf'] as int), isEmpty);
      expect(localLevelsOf(unknown['localLevelsOf'] as int), isEmpty);
    });

    test('every parent link resolves', () {
      for (final d in addressDistricts) {
        expect(getProvince(d.provinceId), isNotNull);
      }
      for (final m in addressLocalLevels) {
        expect(getDistrict(m.districtId), isNotNull);
      }
      expect(getLocalLevel(307)?.wards, 32);
      expect(getLocalLevel(0), isNull);
    });
  });

  final format = _vectors['format'] as Map<String, dynamic>;

  group('formatAddress shared vectors', () {
    for (final v in (format['valid'] as List).cast<Map<String, dynamic>>()) {
      final p = v['parts'] as Map<String, dynamic>;
      test('${v['language']} ${jsonEncode(p)}', () {
        expect(
          formatAddress(
            localLevelId: p['localLevelId'] as int,
            ward: p['ward'] as int,
            tole: p['tole'] as String?,
            street: p['street'] as String?,
            language: v['language'] as String,
          ),
          v['out'],
        );
      });
    }

    for (final v in (format['invalid'] as List).cast<Map<String, dynamic>>()) {
      final p = v['parts'] as Map<String, dynamic>;
      // Dart's ward is an int, so the non-integer vector cannot be expressed.
      if (p['ward'] is! int) continue;
      test('rejects ${jsonEncode(p)} with ${v['code']}', () {
        expect(
          () => formatAddress(
            localLevelId: p['localLevelId'] as int,
            ward: p['ward'] as int,
          ),
          throwsA(
            isA<AddressException>().having(
              (e) => e.code.name_,
              'code',
              v['code'],
            ),
          ),
        );
      });
    }

    test('localizes error messages', () {
      const e = AddressException(AddressErrorCode.badWard);
      expect(e.message, e.localized('en'));
      expect(e.localized('ne'), isNot(e.localized('en')));
    });

    test('defaults to English', () {
      expect(
        formatAddress(localLevelId: 1, ward: 2),
        'Ward 2, Shadanand Municipality, Bhojpur, Koshi Province',
      );
    });
  });

  group('searchAddress shared vectors', () {
    for (final v in (_vectors['search'] as List).cast<Map<String, dynamic>>()) {
      test(
        '${jsonEncode(v['query'])} ${jsonEncode({
              'language': v['language'],
              'limit': v['limit']
            })}',
        () {
          final got = searchAddress(
            v['query'] as String,
            language: _lang(v['language'] as String?),
            limit: (v['limit'] as int?) ?? 10,
          ).map((m) => [m.kind.name, m.id, m.matchedOn, m.rank.name]).toList();
          expect(got, v['expect']);
        },
      );
    }

    test('results carry both names', () {
      final m = searchAddress('pokhara').first;
      expect(m.en, 'Pokhara Metropolitan City');
      expect(m.ne, 'पोखरा महानगरपालिका');
    });
  });
}
