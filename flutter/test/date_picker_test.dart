import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
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

  group('rendering', () {
    testWidgets(
        'shows the month, weekday names and every day with its AD number',
        (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today)));
      expect(find.text('Bhadra 2082'), findsOneWidget);
      for (final w in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
        expect(find.text(w), findsOneWidget, reason: w);
      }
      // Bhadra 2082 has 31 days; 1 Bhadra is 17 August 2025.
      expect(find.bySemanticsLabel(RegExp(r'^\w+, \d+ Bhadra 2082')),
          findsNWidgets(31));
      expect(_day(r'\w+, 10 Bhadra 2082'), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Clear'), findsOneWidget);
    });

    testWidgets('showAd false drops the AD number and the AD part of the label',
        (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today, showAd: false)));
      expect(find.bySemanticsLabel(RegExp(r'AD ')), findsNothing);
      expect(_day(r'\w+, 10 Bhadra 2082'), findsOneWidget);
    });

    testWidgets('weekStartsOn moves the first column', (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today, weekStartsOn: 1)));
      final texts =
          t.widgetList<Text>(find.byType(Text)).map((w) => w.data).toList();
      expect(texts.indexOf('Mon'), lessThan(texts.indexOf('Sun')));
    });

    testWidgets('Nepali: month, digits and buttons', (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today, language: 'ne')));
      expect(find.text('भदौ २०८२'), findsOneWidget);
      expect(find.text('१०'), findsOneWidget);
      expect(find.text('आज'), findsOneWidget);
      expect(find.text('हटाउनुहोस्'), findsOneWidget);
    });

    testWidgets('showFooter false hides Today and Clear', (t) async {
      await t
          .pumpWidget(_app(JhiguDatePicker(today: _today, showFooter: false)));
      expect(find.text('Today'), findsNothing);
      expect(find.text('Clear'), findsNothing);
    });
  });

  group('selecting', () {
    testWidgets('tapping a day calls onChanged and marks it selected',
        (t) async {
      NepaliDate? got;
      var calls = 0;
      await t.pumpWidget(_app(JhiguDatePicker(
        today: _today,
        onChanged: (d) {
          got = d;
          calls++;
        },
      )));
      await t.tap(_day(r'\w+, 12 Bhadra 2082'));
      await t.pump();
      expect(got?.toIsoString(), '2082-05-12');
      expect(calls, 1);
      expect(t.getSemantics(_day(r'\w+, 12 Bhadra 2082')),
          isSemantics(isSelected: true));
      expect(t.getSemantics(_day(r'\w+, 13 Bhadra 2082')),
          isNot(isSemantics(isSelected: true)));
    });

    testWidgets('Today selects today, Clear clears', (t) async {
      final seen = <String?>[];
      await t.pumpWidget(_app(JhiguDatePicker(
        value: _d(2082, 5, 20),
        today: _today,
        onChanged: (d) => seen.add(d?.toIsoString()),
      )));
      await t.tap(find.text('Today'));
      await t.pump();
      await t.tap(find.text('Clear'));
      await t.pump();
      expect(seen, ['2082-05-10', null]);
    });

    testWidgets('a value from the parent is shown and does not call onChanged',
        (t) async {
      var calls = 0;
      Widget build(NepaliDate? v) => _app(
          JhiguDatePicker(value: v, today: _today, onChanged: (_) => calls++));
      await t.pumpWidget(build(_d(2082, 5, 20)));
      expect(t.getSemantics(_day(r'\w+, 20 Bhadra 2082')),
          isSemantics(isSelected: true));
      await t.pumpWidget(build(_d(2082, 5, 25)));
      expect(t.getSemantics(_day(r'\w+, 25 Bhadra 2082')),
          isSemantics(isSelected: true));
      expect(t.getSemantics(_day(r'\w+, 20 Bhadra 2082')),
          isNot(isSemantics(isSelected: true)));
      await t.pumpWidget(build(null));
      expect(t.getSemantics(_day(r'\w+, 25 Bhadra 2082')),
          isNot(isSemantics(isSelected: true)));
      expect(calls, 0);
    });

    testWidgets('min and max disable days and arrows', (t) async {
      var calls = 0;
      await t.pumpWidget(_app(JhiguDatePicker(
        today: _today,
        min: _d(2082, 5, 5),
        max: _d(2082, 5, 20),
        onChanged: (_) => calls++,
      )));
      expect(t.getSemantics(_day(r'\w+, 4 Bhadra 2082')),
          isNot(isSemantics(isEnabled: true)));
      expect(t.getSemantics(_day(r'\w+, 5 Bhadra 2082')),
          isSemantics(isEnabled: true));
      await t.tap(_day(r'\w+, 4 Bhadra 2082'), warnIfMissed: false);
      await t.tap(_day(r'\w+, 21 Bhadra 2082'), warnIfMissed: false);
      await t.pump();
      expect(calls, 0);
      // The only month in range: both month arrows are off.
      final prev = t.widget<IconButton>(
          find.widgetWithIcon(IconButton, Icons.chevron_left));
      final next = t.widget<IconButton>(
          find.widgetWithIcon(IconButton, Icons.chevron_right));
      expect(prev.onPressed, isNull);
      expect(next.onPressed, isNull);
    });
  });

  group('navigating', () {
    testWidgets('arrows change the month; the tooltip names them', (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today)));
      expect(find.byTooltip('Next month'), findsOneWidget);
      await t.tap(find.byTooltip('Next month'));
      await t.pump();
      expect(find.text('Ashwin 2082'), findsOneWidget);
      await t.tap(find.byTooltip('Previous month'));
      await t.tap(find.byTooltip('Previous month'));
      await t.pump();
      expect(find.text('Shrawan 2082'), findsOneWidget);
    });

    testWidgets('the title opens months, then years, and a pick goes back down',
        (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today)));
      await t.tap(find.text('Bhadra 2082'));
      await t.pump();
      for (final m in [
        'Baisakh',
        'Jestha',
        'Ashadh',
        'Shrawan',
        'Bhadra',
        'Ashwin',
        'Kartik',
        'Mangsir',
        'Poush',
        'Magh',
        'Falgun',
        'Chaitra'
      ]) {
        expect(find.text(m), findsOneWidget, reason: m);
      }
      await t.tap(find.text('Bhadra 2082'));
      await t.pump();
      expect(find.text('2072'),
          findsOneWidget); // the page of 12 years holding 2082
      expect(find.text('2083'), findsOneWidget);
      await t.tap(find.text('2080'));
      await t.pump();
      expect(find.text('Magh'), findsOneWidget); // back on the month list
      await t.tap(find.text('Magh'));
      await t.pump();
      expect(find.text('Magh 2080'), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
    });
  });

  group('keyboard', () {
    testWidgets('arrows move the focus ring and Enter selects', (t) async {
      NepaliDate? got;
      await t.pumpWidget(_app(JhiguDatePicker(
          today: _today, autofocus: true, onChanged: (d) => got = d)));
      await t.pump();
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await t.sendKeyEvent(LogicalKeyboardKey.enter);
      await t.pump();
      expect(got?.toIsoString(), '2082-05-19'); // 10 + 2 + 7
    });

    testWidgets(
        'Page Down changes the month, Shift+Page Down the year, Home and End the week',
        (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today, autofocus: true)));
      await t.pump();
      await t.sendKeyEvent(LogicalKeyboardKey.pageDown);
      await t.pump();
      expect(find.text('Ashwin 2082'), findsOneWidget);
      await t.sendKeyDownEvent(LogicalKeyboardKey.shiftLeft);
      await t.sendKeyEvent(LogicalKeyboardKey.pageDown);
      await t.sendKeyUpEvent(LogicalKeyboardKey.shiftLeft);
      await t.pump();
      expect(find.text('Ashwin 2083'), findsOneWidget);
    });

    testWidgets('Space selects too, and keys do nothing in the month list',
        (t) async {
      NepaliDate? got;
      await t.pumpWidget(_app(JhiguDatePicker(
          today: _today, autofocus: true, onChanged: (d) => got = d)));
      await t.pump();
      await t.sendKeyEvent(LogicalKeyboardKey.space);
      await t.pump();
      expect(got?.toIsoString(), '2082-05-10');
      await t.tap(find.text('Bhadra 2082'));
      await t.pump();
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.pump();
      expect(find.text('Baisakh'), findsOneWidget); // still the month list
    });

    testWidgets('a disabled day cannot be selected by keyboard', (t) async {
      var calls = 0;
      await t.pumpWidget(_app(JhiguDatePicker(
        today: _today,
        max: _d(2082, 5, 10),
        autofocus: true,
        onChanged: (_) => calls++,
      )));
      await t.pump();
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight); // stops at max
      await t.sendKeyEvent(LogicalKeyboardKey.enter);
      await t.pump();
      expect(calls, 1);
    });
  });

  group('accessibility and theme', () {
    testWidgets('day cells are buttons with a full spoken label', (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today)));
      final s = t.getSemantics(_day(r'\w+, 10 Bhadra 2082'));
      expect(
          s, isSemantics(isButton: true, hasTapAction: true, isEnabled: true));
      expect(s.label, 'Tuesday, 10 Bhadra 2082 (AD 26 August 2025)');
    });

    testWidgets('Nepali spoken labels use Nepali names and digits', (t) async {
      await t.pumpWidget(_app(JhiguDatePicker(today: _today, language: 'ne')));
      final s = t
          .getSemantics(find.bySemanticsLabel(RegExp('^मंगलबार, १० भदौ २०८२')));
      expect(s.label, contains('ई.सं.'));
    });

    testWidgets('a JhiguTheme extension recolours the selected day', (t) async {
      const custom = Color(0xFF123456);
      await t.pumpWidget(_app(
        JhiguDatePicker(value: _d(2082, 5, 12), today: _today),
        theme: ThemeData(extensions: const [JhiguTheme(primary: custom)]),
      ));
      final filled = t.widgetList<Container>(find.byType(Container)).where((c) {
        final d = c.decoration;
        return d is BoxDecoration && d.color == custom;
      });
      expect(filled.length, 1);
    });

    testWidgets('without an extension the app colour scheme is used',
        (t) async {
      const seed = Color(0xFF00695C);
      await t.pumpWidget(_app(
        JhiguDatePicker(value: _d(2082, 5, 12), today: _today),
        theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: seed)),
      ));
      final primary = ColorScheme.fromSeed(seedColor: seed).primary;
      final filled = t.widgetList<Container>(find.byType(Container)).where((c) {
        final d = c.decoration;
        return d is BoxDecoration && d.color == primary;
      });
      expect(filled.length, 1);
    });

    test('JhiguTheme copyWith and lerp', () {
      const a = JhiguTheme(primary: Color(0xFF000000), radius: 4);
      final b = a.copyWith(primary: const Color(0xFFFFFFFF), radius: 12);
      final mid = a.lerp(b, 0.5);
      expect(mid.radius, 8);
      expect(mid.primary!.r, closeTo(0.5, 0.01));
      expect(a.lerp(null, 0.5), same(a));
    });
  });

  group('layout', () {
    testWidgets('fits a narrow screen without overflow', (t) async {
      await t.pumpWidget(MaterialApp(
        home: Scaffold(
            body: Center(
                child: SizedBox(
                    width: 280, child: JhiguDatePicker(today: _today)))),
      ));
      expect(t.takeException(), isNull);
      await t.tap(find.text('Bhadra 2082'));
      await t.pump();
      expect(t.takeException(), isNull);
      await t.tap(find.text('Bhadra 2082'));
      await t.pump();
      expect(t.takeException(), isNull);
    });

    testWidgets('survives large text scaling in every view', (t) async {
      await t.pumpWidget(MaterialApp(
        builder: (c, w) => MediaQuery(
            data: MediaQuery.of(c)
                .copyWith(textScaler: const TextScaler.linear(1.6)),
            child: w!),
        home: Scaffold(
            body: Center(
                child: SizedBox(
                    width: 340,
                    child: JhiguDatePicker(today: _today, language: 'ne')))),
      ));
      expect(t.takeException(), isNull);
      await t.tap(find.byType(TextButton).first);
      await t.pump();
      expect(t.takeException(), isNull);
    });
  });

  group('options change', () {
    testWidgets('changing min or showAd keeps the month you were on',
        (t) async {
      Widget build({bool ad = true}) =>
          _app(JhiguDatePicker(today: _today, showAd: ad));
      await t.pumpWidget(build());
      await t.tap(find.byTooltip('Next month'));
      await t.pump();
      expect(find.text('Ashwin 2082'), findsOneWidget);
      await t.pumpWidget(build(ad: false));
      expect(find.text('Ashwin 2082'), findsOneWidget);
    });

    testWidgets('switching language keeps the month and selection', (t) async {
      Widget build(String lang) => _app(JhiguDatePicker(
          value: _d(2082, 5, 12), today: _today, language: lang));
      await t.pumpWidget(build('en'));
      await t.pumpWidget(build('ne'));
      expect(find.text('भदौ २०८२'), findsOneWidget);
      expect(
          t.getSemantics(
              find.bySemanticsLabel(RegExp('^बिहिबार, १२ भदौ २०८२'))),
          isSemantics(isSelected: true));
    });
  });
}
