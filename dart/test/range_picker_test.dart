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
final _v = _read('../testdata/range-picker.json');

NepaliDate? _d(Object? l) => l == null
    ? null
    : NepaliDate.checked((l as List)[0] as int, l[1] as int, l[2] as int);

RangePicker _make(Map<String, dynamic> init, void Function() onEvent) {
  final p = RangePicker(
    start: _d(init['start']),
    end: _d(init['end']),
    min: _d(init['min']),
    max: _d(init['max']),
    language: (init['language'] as String?) ?? 'en',
    weekStartsOn: (init['weekStartsOn'] as int?) ?? 0,
    showAd: (init['showAd'] as bool?) ?? true,
    today: _d(init['today']),
  );
  p.subscribe((_) => onEvent());
  return p;
}

void _check(
  RangePickerState s,
  int events,
  Map<String, dynamic> expected,
  String ctx,
) {
  expected.forEach((k, want) {
    final Object? got = switch (k) {
      'events' => events,
      'visible' => [s.visibleYear, s.visibleMonth],
      'start' => s.start?.toIsoString(),
      'end' => s.end?.toIsoString(),
      'hovered' => s.hovered?.toIsoString(),
      'previewEnd' => s.previewEnd?.toIsoString(),
      'focused' => s.focused.toIsoString(),
      'phase' => s.phase.name,
      'complete' => s.complete,
      _ => throw StateError('unknown expectation key $k'),
    };
    expect(got, want, reason: '$ctx: $k');
  });
}

void _run(RangePicker p, String action, Object? arg) {
  switch (action) {
    case 'select':
      p.select(_d(arg)!);
    case 'hover':
      p.hover(_d(arg));
    case 'setRange':
      final l = arg as List;
      p.setRange(_d(l[0])!, _d(l[1])!);
    case 'moveFocus':
      p.moveFocus(FocusMove.values.firstWhere((m) => m.name == arg));
    case 'selectFocused':
      p.selectFocused();
    case 'clear':
      p.clear();
    case 'nextMonth':
      p.nextMonth();
    case 'prevMonth':
      p.prevMonth();
    default:
      throw StateError('unknown action $action');
  }
}

String _codeOf(void Function() fn) {
  try {
    fn();
  } on JhiguException catch (e) {
    return e.code;
  }
  return 'NO_ERROR';
}

GridCell<Object?> _cellOf(List<dynamic> a) => GridCell<Object?>(
      bs: _d(a),
      ad: null,
      inMonth: true,
      inRange: true,
      isToday: false,
      isWeekend: false,
      events: const [],
    );

void main() {
  setUpAll(() {
    NepaliCalendar.initialize(
      InlineCalendarDataSource(
        years: _years,
        supportedStartYear: _cal['supportedRange']['start'] as int,
        supportedEndYear: _cal['supportedRange']['end'] as int,
        verifiedThrough: _cal['verifiedThrough'] as int,
      ),
    );
  });

  group('range picker shared scenarios', () {
    for (final sc in (_v['scenarios'] as List).cast<Map<String, dynamic>>()) {
      test(sc['name'] as String, () {
        var events = 0;
        final picker =
            _make(sc['init'] as Map<String, dynamic>, () => events++);
        if (sc['initExpect'] != null) {
          _check(picker.state, events, sc['initExpect'] as Map<String, dynamic>,
              'init');
        }
        final steps = (sc['steps'] as List).cast<Map<String, dynamic>>();
        for (var i = 0; i < steps.length; i++) {
          final step = steps[i];
          final ctx =
              'step ${i + 1} ${step['action']}(${jsonEncode(step['arg'])})';
          if (step['error'] != null) {
            expect(
              _codeOf(
                  () => _run(picker, step['action'] as String, step['arg'])),
              step['error'],
              reason: ctx,
            );
          } else {
            _run(picker, step['action'] as String, step['arg']);
          }
          _check(picker.state, events, step['expect'] as Map<String, dynamic>,
              ctx);
        }
        for (final c
            in ((sc['cells'] as List?) ?? []).cast<Map<String, dynamic>>()) {
          final p = picker.getCellProps(_cellOf(c['date'] as List));
          expect(p.rangePosition?.name, c['position'],
              reason: 'cell ${c['date']}');
          expect(p.inPreview, c['inPreview'],
              reason: 'cell ${c['date']} preview');
          expect(p.ariaSelected, c['selected'],
              reason: 'cell ${c['date']} selected');
        }
      });
    }

    for (final e in (_v['initErrors'] as List).cast<Map<String, dynamic>>()) {
      test('create with ${jsonEncode(e['init'])} throws ${e['code']}', () {
        expect(
          _codeOf(() => _make(e['init'] as Map<String, dynamic>, () {})),
          e['code'],
        );
      });
    }
  });

  group('range picker behaviour', () {
    NepaliDate today() => NepaliDate.checked(2081, 1, 15);

    test('notifies once per action with the full state', () {
      final picker = RangePicker(today: today());
      final seen = <RangePickerState>[];
      final off = picker.subscribe(seen.add);
      picker.select(NepaliDate.checked(2081, 1, 10));
      expect(seen, hasLength(1));
      expect(identical(seen.first, picker.state), isTrue);
      off();
      picker.select(NepaliDate.checked(2081, 1, 12));
      expect(seen, hasLength(1));
    });

    test('a rejected select leaves the state and listeners untouched', () {
      final picker =
          RangePicker(today: today(), min: NepaliDate.checked(2081, 1, 10));
      var n = 0;
      picker.subscribe((_) => n++);
      final before = picker.state;
      expect(
        () => picker.select(NepaliDate.checked(2081, 1, 5)),
        throwsA(isA<JhiguException>()),
      );
      expect(identical(picker.state, before), isTrue);
      expect(n, 0);
    });

    test('a rejected setRange changes nothing', () {
      final picker =
          RangePicker(today: today(), max: NepaliDate.checked(2081, 1, 20));
      final focus = picker.state.focused.toIsoString();
      expect(
        () => picker.setRange(
          NepaliDate.checked(2081, 1, 10),
          NepaliDate.checked(2081, 1, 25),
        ),
        throwsA(isA<JhiguException>()),
      );
      expect(picker.state.start, isNull);
      expect(picker.state.focused.toIsoString(), focus);
    });

    test('state carries the date picker fields', () {
      final s = RangePicker(today: today()).state;
      expect(s.title, 'Baisakh 2081');
      expect(s.grid, isNotEmpty);
    });

    test('selectToday starts a range at today', () {
      final picker = RangePicker(today: today())..selectToday();
      expect(picker.state.start!.toIsoString(), '2081-01-15');
      expect(picker.state.phase, RangePhase.end);
    });

    test('every day of a long range is middle, with exact ends', () {
      final picker = RangePicker(today: today());
      final a = NepaliDate.checked(2081, 1, 1);
      final b = NepaliDate.checked(2081, 12, 30);
      picker
        ..select(a)
        ..select(b);
      var middle = 0;
      for (var d = a; d.isBefore(b); d = d.addDays(1)) {
        final pos = picker
            .getCellProps(_cellOf([d.year, d.month, d.day]))
            .rangePosition;
        if (d.isSame(a)) {
          expect(pos, RangePosition.start);
        } else {
          expect(pos, RangePosition.middle);
          middle++;
        }
      }
      expect(middle, b.diff(a) - 1);
      expect(
        picker.getCellProps(_cellOf([2081, 12, 30])).rangePosition,
        RangePosition.end,
      );
    });
  });
}
