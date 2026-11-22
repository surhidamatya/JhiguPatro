import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jhigu_patro_flutter/jhigu_patro_flutter.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

final _today = NepaliDate.checked(2082, 5, 10);

NepaliDate _d(int y, int m, int d) => NepaliDate.checked(y, m, d);

Widget _app(Widget child, {ThemeData? theme}) => MaterialApp(
      theme: theme,
      home: Scaffold(body: Center(child: SizedBox(width: 340, child: child))),
    );

Finder _day(String label) => find.bySemanticsLabel(RegExp('^$label'));

void main() {
  setUpAll(() {
    final cal =
        jsonDecode(File('../data/nepali_calendar_data.json').readAsStringSync())
            as Map<String, dynamic>;
    NepaliCalendar.initialize(InlineCalendarDataSource(
      years: (cal['years'] as Map<String, dynamic>)
          .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
      supportedStartYear: cal['supportedRange']['start'] as int,
      supportedEndYear: cal['supportedRange']['end'] as int,
      verifiedThrough: cal['verifiedThrough'] as int,
    ));
  });

  Finder key(String k) => find.byKey(ValueKey('range-$k'));
  Future<void> tapDay(WidgetTester t, int d) async {
    await t.tap(_day(r'\w+, ' '$d' r' Bhadra 2082'));
    await t.pump();
  }

  group('choosing', () {
    testWidgets('starts empty: no summary, no range cells', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(today: _today)));
      expect(find.text('Bhadra 2082'), findsOneWidget);
      expect(find.textContaining('–'), findsNothing);
      expect(key('start'), findsNothing);
    });

    testWidgets('first tap sets the start and waits for the end', (t) async {
      final calls = <String>[];
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        onChanged: (s, e) =>
            calls.add('${s?.toIsoString()} ${e?.toIsoString()}'),
      )));
      await tapDay(t, 15);
      expect(calls, ['2082-05-15 null']);
      expect(key('start'), findsOneWidget);
      expect(find.textContaining('15 Bhadra 2082 (AD 31 August 2025) – …'),
          findsOneWidget);
    });

    testWidgets('second tap on or after the start completes the range',
        (t) async {
      final calls = <String>[];
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        onChanged: (s, e) =>
            calls.add('${s?.toIsoString()} ${e?.toIsoString()}'),
      )));
      await tapDay(t, 15);
      await tapDay(t, 19);
      expect(calls.last, '2082-05-15 2082-05-19');
      expect(key('start'), findsOneWidget);
      expect(key('middle'), findsNWidgets(3));
      expect(key('end'), findsOneWidget);
      expect(find.textContaining('19 Bhadra 2082'), findsOneWidget);
    });

    testWidgets('the same day twice is a one-day range', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(today: _today)));
      await tapDay(t, 15);
      await tapDay(t, 15);
      expect(key('single'), findsOneWidget);
      expect(key('middle'), findsNothing);
    });

    testWidgets('a second tap before the start restarts from that day',
        (t) async {
      final calls = <String>[];
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        onChanged: (s, e) =>
            calls.add('${s?.toIsoString()} ${e?.toIsoString()}'),
      )));
      await tapDay(t, 15);
      await tapDay(t, 12);
      expect(calls.last, '2082-05-12 null');
      expect(key('end'), findsNothing);
    });

    testWidgets('a tap on a complete range starts a new one', (t) async {
      final calls = <String>[];
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        onChanged: (s, e) =>
            calls.add('${s?.toIsoString()} ${e?.toIsoString()}'),
      )));
      await tapDay(t, 15);
      await tapDay(t, 19);
      await tapDay(t, 22);
      expect(calls.last, '2082-05-22 null');
      expect(key('middle'), findsNothing);
    });

    testWidgets('Clear empties the range and reports two nulls', (t) async {
      final calls = <String>[];
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        onChanged: (s, e) =>
            calls.add('${s?.toIsoString()} ${e?.toIsoString()}'),
      )));
      await tapDay(t, 15);
      await t.tap(find.text('Clear'));
      await t.pump();
      expect(calls.last, 'null null');
      expect(key('start'), findsNothing);
    });

    testWidgets('Today sets the start to today', (t) async {
      NepaliDate? start;
      await t.pumpWidget(_app(
          JhiguRangePicker(today: _today, onChanged: (s, e) => start = s)));
      await t.tap(find.text('Today'));
      await t.pump();
      expect(start, _today);
    });

    testWidgets('days outside min and max cannot be chosen', (t) async {
      var calls = 0;
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        min: _d(2082, 5, 5),
        max: _d(2082, 5, 25),
        onChanged: (s, e) => calls++,
      )));
      await t.tap(_day(r'\w+, 3 Bhadra 2082'), warnIfMissed: false);
      await t.tap(_day(r'\w+, 28 Bhadra 2082'), warnIfMissed: false);
      await t.pump();
      expect(calls, 0);
      await tapDay(t, 6);
      expect(calls, 1);
    });

    testWidgets('the range stays when moving to the next month', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        start: _d(2082, 5, 28),
        end: _d(2082, 6, 3),
      )));
      // The view opens on the month of the end.
      expect(find.text('Ashwin 2082'), findsOneWidget);
      expect(key('middle'), findsNWidgets(2)); // 1, 2 Ashwin
      expect(key('end'), findsOneWidget);
      await t.tap(find.byTooltip('Previous month'));
      await t.pump();
      expect(find.text('Bhadra 2082'), findsOneWidget);
      expect(key('start'), findsOneWidget);
      expect(key('middle'), findsNWidgets(3)); // 29, 30, 31 Bhadra
    });
  });

  group('preview', () {
    testWidgets('hovering a later day previews the days up to it', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(today: _today)));
      await tapDay(t, 15);
      final mouse = await t.createGesture(kind: PointerDeviceKind.mouse);
      await mouse.addPointer(location: Offset.zero);
      await mouse.moveTo(t.getCenter(_day(r'\w+, 19 Bhadra 2082')));
      await t.pump();
      expect(key('preview'), findsNWidgets(4)); // 16 to 19
      await mouse.moveTo(Offset.zero);
      await t.pump();
      expect(key('preview'), findsNothing);
    });

    testWidgets('no preview once the range is complete', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(today: _today)));
      await tapDay(t, 15);
      await tapDay(t, 17);
      final mouse = await t.createGesture(kind: PointerDeviceKind.mouse);
      await mouse.addPointer(location: Offset.zero);
      await mouse.moveTo(t.getCenter(_day(r'\w+, 25 Bhadra 2082')));
      await t.pump();
      expect(key('preview'), findsNothing);
    });
  });

  group('parent and options', () {
    testWidgets('start and end from the parent are shown without onChanged',
        (t) async {
      var calls = 0;
      Widget build(NepaliDate? s, NepaliDate? e) => _app(JhiguRangePicker(
            today: _today,
            start: s,
            end: e,
            onChanged: (a, b) => calls++,
          ));
      await t.pumpWidget(build(null, null));
      await t.pumpWidget(build(_d(2082, 5, 12), _d(2082, 5, 14)));
      expect(key('middle'), findsOneWidget);
      await t.pumpWidget(build(_d(2082, 5, 12), null));
      expect(key('middle'), findsNothing);
      expect(key('start'), findsOneWidget);
      await t.pumpWidget(build(null, null));
      expect(key('start'), findsNothing);
      expect(calls, 0);
    });

    testWidgets('without start and end, a rebuild keeps the choice', (t) async {
      Widget build(int n) =>
          _app(JhiguRangePicker(today: _today, onChanged: (s, e) => n));
      await t.pumpWidget(build(1));
      await tapDay(t, 15);
      await tapDay(t, 18);
      await t.pumpWidget(build(2));
      expect(key('middle'), findsNWidgets(2));
    });

    testWidgets('an end before the start is rejected', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(
          today: _today, start: _d(2082, 5, 20), end: _d(2082, 5, 10))));
      expect(t.takeException(), isA<InvalidDataException>());
    });

    testWidgets('Nepali digits in the grid and summary', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        language: 'ne',
        start: _d(2082, 5, 12),
        end: _d(2082, 5, 14),
      )));
      expect(find.text('भदौ २०८२'), findsOneWidget);
      expect(find.textContaining('–'), findsOneWidget);
      expect(find.textContaining('१२'), findsWidgets);
    });

    testWidgets('showFooter false drops the buttons and the summary',
        (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        showFooter: false,
        start: _d(2082, 5, 12),
        end: _d(2082, 5, 14),
      )));
      expect(find.text('Today'), findsNothing);
      expect(find.textContaining('–'), findsNothing);
    });

    testWidgets('the title opens the month list', (t) async {
      await t.pumpWidget(_app(JhiguRangePicker(
          today: _today, start: _d(2082, 1, 3), end: _d(2082, 1, 5))));
      expect(find.text('Baisakh 2082'), findsOneWidget);
      await t.tap(find.text('Baisakh 2082'));
      await t.pump();
      await t.tap(find.text('Jestha'));
      await t.pump();
      expect(find.text('Jestha 2082'), findsOneWidget);
      expect(key('end'), findsNothing);
      await t.tap(find.byTooltip('Previous month'));
      await t.pump();
      expect(key('end'), findsOneWidget);
    });
  });

  group('keyboard, semantics, theme', () {
    testWidgets('arrows and Enter choose a start and an end', (t) async {
      NepaliDate? s;
      NepaliDate? e;
      await t.pumpWidget(_app(JhiguRangePicker(
        today: _today,
        autofocus: true,
        onChanged: (a, b) {
          s = a;
          e = b;
        },
      )));
      await t.pump();
      await t.sendKeyEvent(LogicalKeyboardKey.enter); // start: today, the 10th
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.sendKeyEvent(LogicalKeyboardKey.enter);
      await t.pump();
      expect(s, _d(2082, 5, 10));
      expect(e, _d(2082, 5, 12));
    });

    testWidgets('range ends are selected for assistive technology', (t) async {
      final handle = t.ensureSemantics();
      await t.pumpWidget(_app(JhiguRangePicker(
          today: _today, start: _d(2082, 5, 12), end: _d(2082, 5, 14))));
      expect(t.getSemantics(_day(r'\w+, 12 Bhadra 2082')),
          isSemantics(isSelected: true, isButton: true));
      expect(t.getSemantics(_day(r'\w+, 13 Bhadra 2082')),
          isSemantics(isSelected: true, isButton: true));
      expect(t.getSemantics(_day(r'\w+, 20 Bhadra 2082')),
          isSemantics(isSelected: false, isButton: true));
      handle.dispose();
    });

    testWidgets('range ends use the JhiguTheme primary colour', (t) async {
      const primary = Color(0xFF00AA00);
      await t.pumpWidget(_app(
        JhiguRangePicker(
            today: _today, start: _d(2082, 5, 12), end: _d(2082, 5, 14)),
        theme: ThemeData(extensions: const [JhiguTheme(primary: primary)]),
      ));
      for (final k in ['start', 'end']) {
        final box = t.widget<Container>(key(k));
        expect((box.decoration! as BoxDecoration).color, primary, reason: k);
      }
    });

    testWidgets(
        'days between the ends get a lighter band of the primary colour',
        (t) async {
      const primary = Color(0xFF00AA00);
      await t.pumpWidget(_app(
        JhiguRangePicker(
            today: _today, start: _d(2082, 5, 12), end: _d(2082, 5, 14)),
        theme: ThemeData(extensions: const [JhiguTheme(primary: primary)]),
      ));
      final box = t.widget<Container>(key('middle'));
      final color = (box.decoration! as BoxDecoration).color!;
      expect(color.toARGB32() & 0xFFFFFF, 0x00AA00);
      expect(color.a, closeTo(0.22, 0.01));
      expect(
          (box.decoration! as BoxDecoration).borderRadius, BorderRadius.zero);
    });

    testWidgets('does not overflow sideways at a narrow width and large text',
        (t) async {
      await t.pumpWidget(MaterialApp(
        builder: (c, w) => MediaQuery(
            data: MediaQuery.of(c)
                .copyWith(textScaler: const TextScaler.linear(1.6)),
            child: w!),
        home: Scaffold(
          body: SingleChildScrollView(
            child: SizedBox(
              width: 240,
              child: JhiguRangePicker(
                  today: _today, start: _d(2082, 5, 12), end: _d(2082, 5, 14)),
            ),
          ),
        ),
      ));
      expect(t.takeException(), isNull);
    });
  });
}
