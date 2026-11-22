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
final _v = _read('../testdata/date-picker.json');

NepaliDate? _d(Object? l) => l == null
    ? null
    : NepaliDate.checked((l as List)[0] as int, l[1] as int, l[2] as int);

DatePicker _make(Map<String, dynamic> init, void Function() onEvent) {
  final p = DatePicker(
    value: _d(init['value']),
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
  DatePickerState s,
  int events,
  Map<String, dynamic> expected,
  String ctx,
) {
  expected.forEach((k, want) {
    final Object? got = switch (k) {
      'events' => events,
      'visible' => [s.visibleYear, s.visibleMonth],
      'value' => s.value?.toIsoString(),
      'focused' => s.focused.toIsoString(),
      'rows' => s.grid.length,
      'weekday0' => s.weekdays[0],
      'weekday6' => s.weekdays[6],
      'monthsDisabled' => s.months.where((m) => m.disabled).length,
      'yearsDisabled' => s.years.where((y) => y.disabled).length,
      'yearsFirst' => s.years[0].year,
      'yearsFirstLabel' => s.years[0].label,
      'monthsFirstLabel' => s.months[0].label,
      'view' => s.view.name,
      'title' => s.title,
      'canGoPrev' => s.canGoPrev,
      'canGoNext' => s.canGoNext,
      _ => throw StateError('unknown expectation key $k'),
    };
    expect(got, want, reason: '$ctx: $k');
  });
}

void _run(DatePicker p, String action, Object? arg) {
  switch (action) {
    case 'nextMonth':
      p.nextMonth();
    case 'prevMonth':
      p.prevMonth();
    case 'goTo':
      final l = arg as List;
      p.goTo(l[0] as int, l[1] as int);
    case 'setView':
      p.setView(PickerView.values.firstWhere((v) => v.name == arg));
    case 'select':
      p.select(_d(arg)!);
    case 'clear':
      p.clear();
    case 'selectToday':
      p.selectToday();
    case 'moveFocus':
      p.moveFocus(FocusMove.values.firstWhere((m) => m.name == arg));
    case 'setLanguage':
      p.setLanguage(arg as String);
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

  group('date picker shared scenarios', () {
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
          if (step['expect'] != null) {
            _check(picker.state, events, step['expect'] as Map<String, dynamic>,
                ctx);
          }
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

  group('getCellProps shared vectors', () {
    for (final t in (_v['cellProps'] as List).cast<Map<String, dynamic>>()) {
      test('${t['date'] ?? 'blank'} ${jsonEncode(t['init'])}', () {
        final picker = _make(t['init'] as Map<String, dynamic>, () {});
        final cells = picker.state.grid.expand((r) => r).toList();
        final target = t['date'] == null ? null : _d(t['date']);
        final cell = target == null
            ? cells.firstWhere((c) => c.bs == null)
            : cells.firstWhere((c) => c.bs != null && c.bs!.isSame(target));
        final p = picker.getCellProps(cell);
        final want = t['props'] as Map<String, dynamic>;
        expect(p.role, want['role']);
        expect(p.ariaSelected, want['aria-selected']);
        expect(p.ariaDisabled, want['aria-disabled']);
        expect(p.ariaLabel, want['aria-label']);
        expect(p.tabIndex, want['tabIndex']);
      });
    }
  });

  group('keyAction', () {
    for (final t in (_v['keyActions'] as List).cast<Map<String, dynamic>>()) {
      test('${jsonEncode(t['key'])} shift=${t['shift']}', () {
        expect(keyAction(t['key'] as String, shift: t['shift'] as bool).name_,
            t['out']);
      });
    }
  });

  group('date picker behaviour', () {
    test('notifies with the full new state, once per action', () {
      final picker = DatePicker(today: NepaliDate.checked(2081, 1, 15));
      final seen = <DatePickerState>[];
      final off = picker.subscribe(seen.add);
      picker.nextMonth();
      expect(seen, hasLength(1));
      expect(identical(seen.first, picker.state), isTrue);
      off();
      picker.nextMonth();
      expect(seen, hasLength(1));
    });

    test('state is replaced, not mutated', () {
      final picker = DatePicker(today: NepaliDate.checked(2081, 1, 15));
      final before = picker.state;
      picker.nextMonth();
      expect(before.visibleMonth, 1);
    });

    test('grid cells show the picked month and today', () {
      final picker = DatePicker(today: NepaliDate.checked(2081, 1, 15));
      final cells = picker.state.grid.expand((r) => r).toList();
      expect(cells.where((c) => c.isToday).map((c) => c.bs!.day), [15]);
      expect(cells.where((c) => c.inMonth), hasLength(31));
    });

    test('focus walk over a whole year matches day numbers', () {
      final picker = DatePicker(today: NepaliDate.checked(2081, 1, 1));
      var n = picker.state.focused.dayNumber;
      for (var i = 0; i < 366; i++) {
        picker.moveFocus(FocusMove.right);
        n += 1;
        expect(picker.state.focused.dayNumber, n);
      }
    });

    test('focusMove maps key actions', () {
      expect(keyAction('ArrowLeft')!.focusMove, FocusMove.left);
      expect(keyAction('PageDown', shift: true)!.focusMove,
          FocusMove.shiftPageDown);
      expect(keyAction('Enter')!.focusMove, isNull);
      expect(keyAction('Escape')!.focusMove, isNull);
    });
  });
}

extension on KeyAction? {
  /// Shared-vector name (`null` for unused keys).
  String? get name_ => this?.name;
}
