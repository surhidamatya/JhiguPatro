import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _cal = _read('../data/nepali_calendar_data.json');
final Map<int, List<int>> _years = (_cal['years'] as Map<String, dynamic>).map(
  (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
);
final _v = _read('../testdata/calendar-all-days.json');

String _p2(int n) => n.toString().padLeft(2, '0');
String _adIso(DateTime d) => '${d.year}-${_p2(d.month)}-${_p2(d.day)}';

/// 64-bit FNV-1a over UTF-8 bytes, as lowercase hex. Dart ints are 64-bit and wrap.
String _fnv1a64(String text) {
  var h = 0xcbf29ce484222325;
  for (final b in utf8.encode(text)) {
    h ^= b;
    h *= 0x100000001b3;
  }
  // An int is signed 64-bit here: go through BigInt to print it unsigned.
  return BigInt.from(h).toUnsigned(64).toRadixString(16).padLeft(16, '0');
}

void main() {
  setUpAll(() {
    NepaliCalendar.initialize(InlineCalendarDataSource(
      years: _years,
      supportedStartYear: (_cal['supportedRange'] as Map)['start'] as int,
      supportedEndYear: (_cal['supportedRange'] as Map)['end'] as int,
      verifiedThrough: _cal['verifiedThrough'] as int,
    ));
  });

  group(
      'every day of the calendar data (shared fingerprint, made by an independent Python model)',
      () {
    final count = _v['count'] as int;
    final lines = <String>[];
    final problems = <String>[];

    /// AD date of the i-th day from 1943-04-14, by plain UTC arithmetic (no time zone involved).
    String expectedAd(int i) {
      final u = DateTime.utc(1943, 4, 14 + i);
      return '${u.year}-${_p2(u.month)}-${_p2(u.day)}';
    }

    /// Days that do not exist on the local clock in this time zone (a zone that skipped a date).
    final gaps = <String>[];

    test('walks every AD day from 1943-04-14 and converts it both ways', () {
      // Local-time DateTimes, stepped by calendar day. A time zone can skip a whole date (Pacific/Kiritimati
      // has no 31 December 1994): DateTime(1994, 12, 31) there is 1 January 1995, so that day cannot be asked
      // of the DateTime-based converters in that zone. Such a day is checked through the date-only
      // NepaliDate path.
      final start = NepaliDate(year: 2000, month: 1, day: 1);
      for (var i = 0; i < count; i++) {
        final ad = expectedAd(i);
        final d = DateTime(1943, 4, 14 + i);
        final NepaliDate bs;
        if (_adIso(d) == ad) {
          bs = NepaliCalendar.convertADToBS(d);
          final back = NepaliCalendar.convertBSToAD(bs.year, bs.month, bs.day);
          if (_adIso(back) != ad) {
            problems.add(
                '$ad: BS ${bs.year}-${bs.month}-${bs.day} converts back to ${_adIso(back)}');
          }
        } else {
          gaps.add(ad);
          bs = start.addDays(i);
        }
        lines.add(
            '$ad ${bs.year.toString().padLeft(4, '0')}-${_p2(bs.month)}-${_p2(bs.day)} ${bs.weekday} ${bs.dayNumber}');
      }
      expect(problems.take(5).toList(), isEmpty);
      expect(lines, hasLength(count));
    });

    test(
        'only a few days are missing from the local clock, and none in zones that never skipped a date',
        () {
      expect(gaps.length, lessThanOrEqualTo(3));
      final tz = Platform.environment['TZ'];
      if (tz == null ||
          ['Asia/Kathmandu', 'UTC', 'America/Los_Angeles'].contains(tz)) {
        expect(gaps, isEmpty);
      }
      // Not asserted: which days. Pacific/Kiritimati has no 1994-12-31 and Pacific/Apia no 2011-12-30; the
      // Dart VM also reports 2039-12-30 as missing in Apia (it extrapolates that zone's rules past 2037),
      // which V8 does not.
    });

    test('has the first and last day the model says', () {
      expect(lines.first, _v['first']);
      expect(lines.last, _v['last']);
      expect(_adIso(DateTime(1943, 4, 14 + count - 1)), _v['lastAd']);
    });

    test('matches the checkpoints, so a failure says which day went wrong', () {
      for (final c
          in (_v['checkpoints'] as List).cast<Map<String, dynamic>>()) {
        expect(lines[c['index'] as int], c['line'],
            reason: 'line ${c['index']}');
      }
    });

    test(
        'has the same 64-bit fingerprint as the Python model: every AD date, BS date, weekday and day number',
        () {
      expect(_fnv1a64(lines.map((l) => '$l\n').join()), _v['fnv1a64']);
    });

    test(
        'the day after the last day is outside the data, and so is the day before the first',
        () {
      expect(() => NepaliCalendar.convertADToBS(DateTime(1943, 4, 13)),
          throwsA(isA<JhiguException>()));
      expect(() => NepaliCalendar.convertADToBS(DateTime(1943, 4, 14 + count)),
          throwsA(isA<JhiguException>()));
    });
  });
}
