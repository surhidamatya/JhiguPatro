import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

dynamic _read(String p) => jsonDecode(File(p).readAsStringSync());

final _v = _read('../testdata/tithi.json') as Map<String, dynamic>;

PanchangDataSource _load(Iterable<int> years) {
  final p = PanchangDataSource();
  for (final y in years) {
    p.addYear(_read('../data/${y}_tithi.json') as Object);
  }
  return p;
}

String _label(TithiSegment? t) =>
    t == null ? '-' : '${t.tithiNumber}${t.paksha == 'शुक्ल' ? 'S' : 'K'}';

/// 64-bit FNV-1a over UTF-8 bytes, as lowercase hex. Dart ints are 64-bit and wrap.
String _fnv1a64(String text) {
  var h = 0xcbf29ce484222325;
  for (final b in utf8.encode(text)) {
    h ^= b;
    h *= 0x100000001b3;
  }
  return BigInt.from(h).toUnsigned(64).toRadixString(16).padLeft(16, '0');
}

void main() {
  final years = (_v['years'] as List).cast<int>();
  final minutes = (_v['minutes'] as List).cast<int>();

  test(
    'has the same fingerprint as the Python model: the tithi at four minutes of every day of 2081 and 2082',
    () {
      final p = _load(years);
      final lines = <String>[];
      for (final y in years) {
        final file = (_read('../data/${y}_tithi.json') as List).first
            as Map<String, dynamic>;
        for (final m in file['months'] as List) {
          for (final d in (m as Map<String, dynamic>)['days'] as List) {
            final day = (d as Map<String, dynamic>)['bsDay'] as int;
            lines.add(
              '$y-${m['month']}-$day ' +
                  minutes
                      .map(
                        (x) => _label(p.tithiAt(y, m['month'] as int, day, x)),
                      )
                      .join(' '),
            );
          }
        }
      }
      expect(lines, hasLength(_v['count'] as int));
      expect(lines.first, _v['first']);
      expect(lines.last, _v['last']);
      for (final c
          in (_v['checkpoints'] as List).cast<Map<String, dynamic>>()) {
        expect(
          lines[c['index'] as int],
          c['line'],
          reason: 'line ${c['index']}',
        );
      }
      expect(_fnv1a64(lines.map((l) => '$l\n').join()), _v['fnv1a64']);
    },
  );

  test(
    'answers the single lookups of the shared vectors, including edges and years that are not loaded',
    () {
      final p = _load(years);
      for (final q in (_v['probes'] as List).cast<Map<String, dynamic>>()) {
        final y = q['year'] as int, m = q['month'] as int, d = q['day'] as int;
        final got = p.getDay(y, m, d) == null
            ? null
            : _label(p.tithiAt(y, m, d, q['minute'] as int));
        expect(got, q['tithi'], reason: '$q');
      }
    },
  );

  test('keeps several years at once, and tells which are loaded', () {
    final p = _load([2081, 2082]);
    expect(p.loadedYears, [2081, 2082]);
    expect(p.loadedYear, 2082);
    expect(p.getDay(2081, 1, 1)?.adDate, '2024-04-13');
    expect(p.getDay(2082, 1, 1)?.adDate, '2025-04-14');
    expect(p.getDay(2083, 1, 1), isNull);
    expect(p.tithiAt(2083, 1, 1, 0), isNull);
    expect(p.sunriseTithi(2083, 1, 1), isNull);
  });

  test(
      'lists the loaded years ascending whatever the order they were loaded in',
      () {
    expect(_load([2082, 2081]).loadedYears, [2081, 2082]);
  });

  test(
    'takes the file as a list of one year or as the year object, and a second load of a year replaces it',
    () {
      final file = _read('../data/2082_tithi.json') as List;
      final a = PanchangDataSource()..addYear(file.first as Object);
      final b = PanchangDataSource()..addYear(file);
      expect(
        a.sunriseTithi(2082, 1, 1)?.tithiNumber,
        b.sunriseTithi(2082, 1, 1)?.tithiNumber,
      );
      a.addYear({
        'year': 2082,
        'months': [
          {
            'month': 1,
            'name': 'Baisakh',
            'days': [
              {'bsDay': 1, 'adDate': '2025-04-14', 'tithiSegments': []},
            ],
          },
        ],
      });
      expect(a.sunriseTithi(2082, 1, 1), isNull);
      expect(a.getDay(2082, 1, 2), isNull);
      expect(a.loadedYears, [2082]);
    },
  );

  test('is empty until something is loaded', () {
    final p = PanchangDataSource();
    expect(p.loadedYear, isNull);
    expect(p.loadedYears, isEmpty);
    expect(p.getDay(2082, 1, 1), isNull);
  });

  test(
    'sunrise is minute 375: a segment that starts at 375 counts, one that ends at 375 does not',
    () {
      Map<String, dynamic> seg(int n, int a, int b) => {
            'tithiNumber': n,
            'tithiName': 'x',
            'paksha': 'शुक्ल',
            'startMinute': a,
            'endMinute': b,
          };
      final p = PanchangDataSource()
        ..addYear({
          'year': 2090,
          'months': [
            {
              'month': 1,
              'name': 'Baisakh',
              'days': [
                {
                  'bsDay': 1,
                  'adDate': '2033-04-14',
                  'tithiSegments': [seg(3, 0, 375), seg(4, 375, 1440)],
                },
                {
                  'bsDay': 3,
                  'adDate': '2033-04-16',
                  'tithiSegments': [seg(7, 0, 376), seg(8, 376, 1440)],
                },
                {
                  'bsDay': 2,
                  'adDate': '2033-04-15',
                  'tithiSegments': [seg(5, 0, 100), seg(6, 100, 200)],
                },
              ],
            },
          ],
        });
      expect(p.sunriseTithi(2090, 1, 1)?.tithiNumber, 4);
      expect(p.tithiAt(2090, 1, 1, 374)?.tithiNumber, 3);
      expect(p.sunriseTithi(2090, 1, 2)?.tithiNumber, 5);
      expect(p.tithiAt(2090, 1, 2, 500), isNull);
      // 375 is still inside a segment that ends at 376.
      expect(p.sunriseTithi(2090, 1, 3)?.tithiNumber, 7);
    },
  );
}
