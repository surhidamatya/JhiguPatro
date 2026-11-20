import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _json = _read('../data/nepali_calendar_data.json');
final Map<int, List<int>> _years = (_json['years'] as Map<String, dynamic>).map(
  (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
);
final _v = _read('../testdata/dates.json');

NepaliDate _bs(List<dynamic> l) =>
    NepaliDate(year: l[0] as int, month: l[1] as int, day: l[2] as int);

void _sameDate(NepaliDate got, NepaliDate want) {
  expect([got.year, got.month, got.day], [want.year, want.month, want.day]);
}

void main() {
  setUpAll(() {
    NepaliCalendar.initialize(
      InlineCalendarDataSource(
        years: _years,
        supportedStartYear: _json['supportedRange']['start'] as int,
        supportedEndYear: _json['supportedRange']['end'] as int,
        verifiedThrough: _json['verifiedThrough'] as int,
      ),
    );
  });

  nepaliDateTests();
  formatterTests();
  monthGridTests();
  legacyFormatterTests();

  group('parseNepaliDate shared vectors', () {
    final valid = (_v['parse'] as List).cast<Map<String, dynamic>>();
    test('has at least 60 valid inputs', () {
      expect(valid.length, greaterThanOrEqualTo(60));
    });

    for (final t in valid) {
      test('parses ${jsonEncode(t['in'])}', () {
        _sameDate(parseNepaliDate(t['in'] as String), _bs(t['bs'] as List));
      });
    }

    for (final input in (_v['parseInvalid'] as List).cast<String>()) {
      test('rejects ${jsonEncode(input)}', () {
        expect(
          () => parseNepaliDate(input),
          throwsA(
            isA<ParseException>()
                .having((e) => e.code, 'code', 'PARSE_ERROR')
                .having((e) => e.details, 'details', input),
          ),
        );
      });
    }

    test('localizes the parse error', () {
      try {
        parseNepaliDate('nope');
        fail('should throw');
      } on JhiguException catch (e) {
        expect(e.message, e.localized('en'));
        expect(e.localized('ne'), isNot(e.localized('en')));
      }
    });
  });

  group('fiscalYear shared vectors', () {
    for (final t in (_v['fiscal'] as List).cast<Map<String, dynamic>>()) {
      test('${(t['bs'] as List).join('-')} is ${t['code']}', () {
        final f = fiscalYear(_bs(t['bs'] as List));
        expect(f.code, t['code']);
        expect(f.start, t['start']);
        expect(f.end, t['end']);
        _sameDate(f.first, _bs(t['first'] as List));
        _sameDate(f.last, _bs(t['last'] as List));
      });
    }
    for (final t
        in (_v['fiscalInvalid'] as List).cast<Map<String, dynamic>>()) {
      test('${(t['bs'] as List).join('-')} throws ${t['code']}', () {
        expect(
          () => fiscalYear(_bs(t['bs'] as List)),
          throwsA(
            isA<JhiguException>().having((e) => e.code, 'code', t['code']),
          ),
        );
      });
    }
    test('Shrawan 1 starts a new fiscal year', () {
      expect(
        fiscalYear(const NepaliDate(year: 2081, month: 3, day: 31)).code,
        '2080/81',
      );
      expect(
        fiscalYear(const NepaliDate(year: 2081, month: 4, day: 1)).code,
        '2081/82',
      );
    });
  });
}

// ── NepaliDate class ─────────────────────────────────────────────────────────

NepaliDate _nd(List<dynamic> t) =>
    NepaliDate.checked(t[0] as int, t[1] as int, t[2] as int);
List<int> _f(NepaliDate d) => [d.year, d.month, d.day];

String _isoUtc(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _codeOf(void Function() fn) {
  try {
    fn();
  } on JhiguException catch (e) {
    return e.code;
  }
  return 'NO_ERROR';
}

List<Map<String, dynamic>> _list(String key) =>
    (_v[key] as List).cast<Map<String, dynamic>>();

void nepaliDateTests() {
  group('NepaliDate shared vectors', () {
    for (final t in _list('adToBs')) {
      test('AD ${t['ad']} <-> BS ${(t['bs'] as List).join('-')}', () {
        final p = (t['ad'] as String).split('-').map(int.parse).toList();
        expect(_f(NepaliDate.fromAD(DateTime.utc(p[0], p[1], p[2]))), t['bs']);
        expect(_isoUtc(_nd(t['bs'] as List).toAD()), t['ad']);
      });
    }
    for (final t in _list('addDays')) {
      test('${(t['from'] as List).join('-')} + ${t['n']} days', () {
        expect(_f(_nd(t['from'] as List).addDays(t['n'] as int)), t['to']);
      });
    }
    for (final t in _list('addMonths')) {
      test('${(t['from'] as List).join('-')} + ${t['n']} months', () {
        expect(_f(_nd(t['from'] as List).addMonths(t['n'] as int)), t['to']);
      });
    }
    for (final t in _list('addYears')) {
      test('${(t['from'] as List).join('-')} + ${t['n']} years', () {
        expect(_f(_nd(t['from'] as List).addYears(t['n'] as int)), t['to']);
      });
    }
    for (final t in _list('diff')) {
      test('diff ${(t['a'] as List).join('-')} - ${(t['b'] as List).join('-')}',
          () {
        final a = _nd(t['a'] as List);
        final b = _nd(t['b'] as List);
        expect(a.diff(b), t['days']);
        expect(a.diff(b, unit: DiffUnit.months), t['months']);
        expect(a.diff(b, unit: DiffUnit.years), t['years']);
      });
    }
    for (final t in _list('compare')) {
      test(
          'compare ${(t['a'] as List).join('-')} ${(t['b'] as List).join('-')}',
          () {
        final a = _nd(t['a'] as List);
        final b = _nd(t['b'] as List);
        final out = t['out'] as int;
        expect(a.compareTo(b).sign, out);
        expect(a.isBefore(b), out < 0);
        expect(a.isAfter(b), out > 0);
        expect(a.isSame(b), out == 0);
        expect(a < b, out < 0);
        expect(a >= b, out >= 0);
      });
    }
    for (final t in _list('weekday')) {
      test('weekday of ${(t['bs'] as List).join('-')} (AD ${t['ad']})', () {
        expect(_nd(t['bs'] as List).weekday, t['weekday']);
      });
    }
    for (final t in _list('monthBounds')) {
      test('month bounds ${t['year']}-${t['month']}', () {
        final d = NepaliDate.checked(t['year'] as int, t['month'] as int, 1);
        expect(d.daysInMonth, t['daysInMonth']);
        expect(_f(d.startOfMonth()), t['start']);
        expect(_f(d.endOfMonth()), t['end']);
      });
    }
    final errs = _v['dateErrors'] as Map<String, dynamic>;
    for (final t in (errs['construct'] as List).cast<Map<String, dynamic>>()) {
      test('checked(${t['bs']}) throws ${t['code']}', () {
        expect(_codeOf(() => _nd(t['bs'] as List)), t['code']);
      });
    }
    for (final t in (errs['addDays'] as List).cast<Map<String, dynamic>>()) {
      test('${(t['from'] as List).join('-')} + ${t['n']} days throws', () {
        expect(_codeOf(() => _nd(t['from'] as List).addDays(t['n'] as int)),
            t['code']);
      });
    }
    for (final t in (errs['addMonths'] as List).cast<Map<String, dynamic>>()) {
      test('${(t['from'] as List).join('-')} + ${t['n']} months throws', () {
        expect(_codeOf(() => _nd(t['from'] as List).addMonths(t['n'] as int)),
            t['code']);
      });
    }
    for (final t in (errs['addYears'] as List).cast<Map<String, dynamic>>()) {
      test('${(t['from'] as List).join('-')} + ${t['n']} years throws', () {
        expect(_codeOf(() => _nd(t['from'] as List).addYears(t['n'] as int)),
            t['code']);
      });
    }
    for (final t in (errs['fromAD'] as List).cast<Map<String, dynamic>>()) {
      test('fromAD(${t['ad']}) throws', () {
        final p = (t['ad'] as String).split('-').map(int.parse).toList();
        expect(_codeOf(() => NepaliDate.fromAD(DateTime.utc(p[0], p[1], p[2]))),
            t['code']);
      });
    }
  });

  group('NepaliDate behaviour', () {
    test('prints ISO and compares by value', () {
      final d = NepaliDate.checked(2081, 1, 5);
      expect(d.toIsoString(), '2081-01-05');
      expect(d == NepaliDate.checked(2081, 1, 5), isTrue);
      expect(d.hashCode, NepaliDate.checked(2081, 1, 5).hashCode);
    });

    test('isValid', () {
      expect(NepaliDate.isValid(2081, 9, 29), isTrue);
      expect(NepaliDate.isValid(2081, 9, 30), isFalse);
    });

    test('every day in range: consecutive day numbers, weekday and AD match',
        () {
      var d = NepaliDate.checked(2000, 1, 1);
      var prev = d.dayNumber;
      var count = 1;
      while (true) {
        if (d.year == 2100 && d.month == 12 && d.day == d.daysInMonth) break;
        final next = d.addDays(1);
        expect(next.dayNumber, prev + 1);
        final ad = next.toAD();
        // Dart weekday: Monday 1 .. Sunday 7; ours: Sunday 0.
        expect(next.weekday, ad.weekday % 7);
        expect(NepaliDate.fromAD(ad), next);
        d = next;
        prev = next.dayNumber;
        count++;
      }
      expect(count, greaterThan(36000));
    });

    test('addDays agrees with plain AD date arithmetic', () {
      final start = NepaliDate.checked(2060, 3, 10);
      final ad = start.toAD();
      for (final n in [-4000, -365, -31, -1, 1, 30, 400, 3650]) {
        final via = NepaliCalendar.convertADToBS(ad.add(Duration(days: n)));
        expect(_f(start.addDays(n)), [via.year, via.month, via.day]);
      }
    });

    test('addMonths then diff gives back whole months when the day fits', () {
      final d = NepaliDate.checked(2070, 5, 10);
      for (final n in [-30, -12, -1, 0, 1, 7, 12, 25]) {
        expect(d.addMonths(n).diff(d, unit: DiffUnit.months), n);
      }
    });

    test('today uses Nepal time', () {
      final before = NepaliDate.today(now: DateTime.utc(2024, 4, 12, 18, 14));
      final after = NepaliDate.today(now: DateTime.utc(2024, 4, 12, 18, 15));
      expect(_isoUtc(before.toAD()), '2024-04-12');
      expect(_isoUtc(after.toAD()), '2024-04-13');
      expect(_f(after), [2081, 1, 1]);
    });
  });
}

// ── Formatter ────────────────────────────────────────────────────────────────

DatePreset _preset(String name) =>
    DatePreset.values.firstWhere((p) => p.name == name);

void formatterTests() {
  group('formatDate shared vectors', () {
    for (final t in _list('formatTokens')) {
      test(
          '${(t['bs'] as List).join('-')} ${jsonEncode(t['pattern'])} ${t['lang']}',
          () {
        expect(
          formatDate(_bs(t['bs'] as List), t['pattern'] as String,
              language: t['lang'] as String),
          t['out'],
        );
      });
    }
    test('asciiDigits keeps ASCII in Nepali', () {
      final d = _bs([2081, 1, 15]);
      expect(formatDate(d, 'YYYY-MM-DD', language: 'ne', asciiDigits: true),
          '2081-01-15');
      expect(formatDate(d, 'YYYY-MM-DD', language: 'ne'), '२०८१-०१-१५');
    });
    test('throws for a date that does not exist', () {
      final e =
          (_v['formatErrors'] as Map<String, dynamic>)['invalidDate'] as List;
      expect(() => formatDate(_bs(e), 'YYYY'),
          throwsA(isA<InvalidDateException>()));
    });
  });

  group('formatPreset shared vectors', () {
    for (final t in _list('formatPresets')) {
      test('${(t['bs'] as List).join('-')} ${t['preset']} ${t['lang']}', () {
        expect(
          formatPreset(_bs(t['bs'] as List), _preset(t['preset'] as String),
              language: t['lang'] as String),
          t['out'],
        );
      });
    }
    for (final t in _list('formatRelative')) {
      test(
          'relative ${t['days']} days (${(t['bs'] as List).join('-')}) ${t['lang']}',
          () {
        expect(
          formatPreset(_bs(t['bs'] as List), DatePreset.relative,
              language: t['lang'] as String, today: _bs(t['today'] as List)),
          t['out'],
        );
      });
    }
    test('relative defaults to today in Nepal', () {
      expect(formatPreset(NepaliDate.today(), DatePreset.relative), 'today');
    });
  });

  group('formatAd shared vectors', () {
    for (final t in _list('formatAd')) {
      test(
          '${(t['ad'] as List).join('-')} ${jsonEncode(t['pattern'])} ${t['lang']}',
          () {
        final a = (t['ad'] as List).cast<int>();
        expect(
          formatAd(DateTime.utc(a[0], a[1], a[2]), t['pattern'] as String,
              language: t['lang'] as String),
          t['out'],
        );
      });
    }
    for (final t in _list('formatAdAscii')) {
      test('ascii digits ${t['out']}', () {
        final a = (t['ad'] as List).cast<int>();
        expect(
          formatAd(DateTime.utc(a[0], a[1], a[2]), t['pattern'] as String,
              language: t['lang'] as String, asciiDigits: true),
          t['out'],
        );
      });
    }
  });
}

// ── Month grid ───────────────────────────────────────────────────────────────

String _cellKey(GridCell<Object?> c) =>
    c.bs == null ? '-' : (c.inMonth ? '' : '~') + c.bs!.toIsoString();

void monthGridTests() {
  final grid = _v['grid'] as Map<String, dynamic>;
  final todayList = grid['today'] as List;
  final events = (grid['events'] as Map<String, dynamic>).map(
    (k, v) => MapEntry(k, (v as List).cast<String>()),
  );

  group('getMonthGrid shared vectors', () {
    for (final c in (grid['cases'] as List).cast<Map<String, dynamic>>()) {
      test(c['name'] as String, () {
        final wso = c['weekStartsOn'] as int;
        final rows = getMonthGrid<String>(
          c['year'] as int,
          c['month'] as int,
          weekStartsOn: wso,
          sixRows: c['sixRows'] as bool,
          today: _bs(todayList),
        );
        expect(rows.map((r) => r.map(_cellKey).toList()).toList(), c['rows']);
        for (final row in rows) {
          expect(row, hasLength(7));
          for (var col = 0; col < 7; col++) {
            final cell = row[col];
            final weekday = (wso + col) % 7;
            expect(cell.inRange, cell.bs != null);
            expect(cell.ad == null, cell.bs == null);
            expect(cell.isWeekend, weekday == 6);
            if (cell.bs != null) expect(cell.bs!.weekday, weekday);
          }
        }
      });
    }

    test('marks today on exactly one cell', () {
      final rows = getMonthGrid<String>(2081, 1, today: _bs(todayList));
      final today = rows.expand((r) => r).where((c) => c.isToday).toList();
      expect(today, hasLength(1));
      expect(today.first.bs!.toIsoString(), '2081-01-15');
      expect(
        getMonthGrid<String>(2081, 2, today: _bs(todayList))
            .expand((r) => r)
            .any((c) => c.isToday),
        isFalse,
      );
    });

    test('puts events from a map on matching cells, incl. neighbouring months',
        () {
      final rows = getMonthGrid<String>(2081, 1, events: events);
      final byKey = {
        for (final c in rows.expand((r) => r))
          if (c.bs != null) c.bs!.toIsoString(): c.events,
      };
      events.forEach((k, evs) => expect(byKey[k], evs));
      expect(byKey['2081-01-16'], isEmpty);
    });

    test('calls the callback once per dated cell, every call', () {
      final calls = <String>[];
      List<String> cb(NepaliDate d) {
        calls.add(d.toIsoString());
        return d.day == 15 ? ['cb'] : [];
      }

      final rows = getMonthGrid<String>(
        2081,
        1,
        events: events,
        getEvents: cb,
        today: _bs(todayList),
      );
      final dated = rows.expand((r) => r).where((c) => c.bs != null).length;
      expect(calls, hasLength(dated));
      expect(calls.toSet(), hasLength(dated));
      final c15 = rows
          .expand((r) => r)
          .firstWhere((c) => c.bs?.toIsoString() == '2081-01-15');
      expect(c15.events, ['Holiday', 'cb']);
      getMonthGrid<String>(2081, 1, events: events, getEvents: cb);
      expect(calls, hasLength(dated * 2));
    });

    test('does not call the callback for blank cells', () {
      var n = 0;
      getMonthGrid<String>(
        2000,
        1,
        getEvents: (_) {
          n++;
          return [];
        },
      );
      expect(n, 35 - 3);
    });

    for (final t in (grid['errors'] as List).cast<Map<String, dynamic>>()) {
      test('month ${t['year']}-${t['month']} throws ${t['code']}', () {
        expect(
          _codeOf(
              () => getMonthGrid<String>(t['year'] as int, t['month'] as int)),
          t['code'],
        );
      });
    }
    for (final w in (grid['badWeekStartsOn'] as List)) {
      if (w is! int) continue;
      test('weekStartsOn $w throws INVALID_DATA', () {
        expect(
          _codeOf(() => getMonthGrid<String>(2081, 1, weekStartsOn: w)),
          'INVALID_DATA',
        );
      });
    }

    test('custom weekend days', () {
      final rows = getMonthGrid<String>(2081, 1, weekendDays: [0, 6]);
      for (final c in rows.expand((r) => r)) {
        if (c.bs != null) {
          expect(c.isWeekend, c.bs!.weekday == 0 || c.bs!.weekday == 6);
        }
      }
    });

    test('every month in range has 5 or 6 full rows covering exactly its days',
        () {
      for (var y = 2000; y <= 2100; y += 7) {
        for (var m = 1; m <= 12; m++) {
          final rows = getMonthGrid<String>(y, m, today: _bs([2081, 1, 1]));
          expect([5, 6], contains(rows.length));
          final days = rows
              .expand((r) => r)
              .where((c) => c.inMonth)
              .map((c) => c.bs!.day)
              .toList();
          expect(days, [
            for (var i = 1; i <= NepaliDate.checked(y, m, 1).daysInMonth; i++)
              i,
          ]);
        }
      }
    });
  });
}

// ── Legacy formatters, now reading the strings tables ────────────────────────

void legacyFormatterTests() {
  group('name tables follow the strings tables', () {
    test('constants equal the strings arrays', () {
      expect(nepaliMonthsEn, getStrings('en').months);
      expect(nepaliMonthsNe, getStrings('ne').months);
      expect(nepaliDaysEn, getStrings('en').weekdays);
      expect(nepaliDaysNe, getStrings('ne').weekdays);
      expect(englishMonths, getStrings('en').adMonths);
    });

    test('English names are the standard ones (changed from Asar / Aaitabar)',
        () {
      expect(NepaliCalendar.getNepaliMonthName(3), 'Ashadh');
      expect(NepaliCalendar.getNepaliMonthName(3, nepali: true), 'असार');
      expect(NepaliCalendar.getNepaliDayName(DateTime.utc(2024, 4, 13)),
          'Saturday');
      expect(
        NepaliCalendar.getNepaliDayName(DateTime.utc(2024, 4, 13),
            nepali: true),
        'शनिबार',
      );
    });

    test('formatNepaliDate keeps its shape and ASCII digits', () {
      const d = NepaliDate(year: 2081, month: 3, day: 5);
      expect(NepaliCalendar.formatNepaliDate(d), 'Ashadh 5, 2081');
      expect(NepaliCalendar.formatNepaliDate(d, nepali: true), 'असार 5, 2081');
    });

    test('formatEnglishDate', () {
      expect(NepaliCalendar.formatEnglishDate(DateTime.utc(2024, 4, 13)),
          'April 13, 2024');
    });

    test('formatNepaliDateWithDay', () {
      expect(
        NepaliCalendar.formatNepaliDateWithDay(
            const NepaliDate(year: 2081, month: 1, day: 1)),
        '१ बैशाख २०८१, शनिबार',
      );
      expect(
        NepaliCalendar.formatNepaliDateWithDay(
            const NepaliDate(year: 2081, month: 1, day: 16)),
        '१६ बैशाख २०८१, आइतबार',
      );
      for (var m = 1; m <= 12; m++) {
        final dim = NepaliDate.checked(2081, m, 1).daysInMonth;
        for (var d = 1; d <= dim; d++) {
          final wd = NepaliDate.checked(2081, m, d).weekday;
          expect(
            NepaliCalendar.formatNepaliDateWithDay(
                    NepaliDate(year: 2081, month: m, day: d))
                .endsWith(getStrings('ne').weekdays[wd]),
            isTrue,
          );
        }
      }
    });
  });

  group('getRelativeTimeInNepali', () {
    // 2024-04-13 12:00 UTC is 17:45 in Nepal, BS 2081-01-01.
    final now = DateTime.utc(2024, 4, 13, 12);
    String rel(Duration ago) =>
        NepaliCalendar.getRelativeTimeInNepali(now.subtract(ago), now: now);

    test('uses the Nepali relative strings', () {
      expect(NepaliCalendar.getRelativeTimeInNepali(null), 'हालै');
      expect(rel(const Duration(milliseconds: 500)), 'हालै');
      expect(rel(const Duration(seconds: 20)), '२० सेकेण्ड अगाडि');
      expect(rel(const Duration(seconds: 90)), '१ मिनेट अगाडि');
      expect(rel(const Duration(hours: 3)), '३ घण्टा अगाडि');
    });

    test('shows the BS date once it is before midnight Nepal time', () {
      expect(rel(const Duration(hours: 24)), '३० चैत्र २०८०');
      expect(rel(const Duration(hours: 18)), '३० चैत्र २०८०');
      expect(rel(const Duration(hours: 17, minutes: 30)), '१७ घण्टा अगाडि');
    });
  });
}
