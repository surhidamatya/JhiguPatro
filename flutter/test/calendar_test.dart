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

  const events = {
    '2082-05-12': ['Teej'],
    '2082-05-15': ['Fulpati', 'Holiday'],
  };
  final dots = find.byKey(const ValueKey('jhigu-mark'));

  group('rendering', () {
    testWidgets('shows the month of today by default, with no events list',
        (t) async {
      await t.pumpWidget(_app(JhiguCalendar(today: _today)));
      expect(find.text('Bhadra 2082'), findsOneWidget);
      expect(find.text('No events'), findsNothing);
      expect(dots, findsNothing);
    });

    testWidgets('year and month pick the first month', (t) async {
      await t
          .pumpWidget(_app(JhiguCalendar(today: _today, year: 2082, month: 7)));
      expect(find.text('Kartik 2082'), findsOneWidget);
    });

    testWidgets('a month outside the data is ignored', (t) async {
      await t
          .pumpWidget(_app(JhiguCalendar(today: _today, year: 1999, month: 1)));
      expect(find.text('Bhadra 2082'), findsOneWidget);
    });

    testWidgets('marked days get a dot and their titles in the spoken label',
        (t) async {
      await t.pumpWidget(_app(JhiguCalendar(today: _today, events: events)));
      expect(dots, findsNWidgets(2));
      expect(_day(r'\w+, 12 Bhadra 2082.*\. Teej$'), findsOneWidget);
      expect(
          _day(r'\w+, 15 Bhadra 2082.*\. Fulpati, Holiday$'), findsOneWidget);
      expect(_day(r'\w+, 13 Bhadra 2082.*AD \d+ \w+ \d+\)$'), findsOneWidget);
    });

    testWidgets('the dot sits in the corner of its cell, not on the digits',
        (t) async {
      await t.pumpWidget(_app(JhiguCalendar(today: _today, events: const {
        '2082-05-12': ['Teej']
      })));
      final dot = t.getRect(dots);
      final cell = t.getRect(
          find.ancestor(of: dots, matching: find.byType(InkWell)).first);
      expect(dot.right, lessThanOrEqualTo(cell.right - 3));
      expect(dot.top, lessThanOrEqualTo(cell.top + 6));
      expect(dot.center.dx, greaterThan(cell.center.dx + 8));
    });

    testWidgets('empty titles, blank titles and bad keys make no marks',
        (t) async {
      await t.pumpWidget(_app(JhiguCalendar(today: _today, events: const {
        '2082-05-12': [],
        '2082-05-13': ['  '],
        '2082/05/14': ['Bad key'],
        'tomorrow': ['Bad key'],
      })));
      expect(dots, findsNothing);
    });

    testWidgets('marks only show in their own month', (t) async {
      await t.pumpWidget(_app(JhiguCalendar(today: _today, events: const {
        '2082-06-03': ['Laxmi Puja']
      })));
      expect(dots, findsNothing);
      await t.tap(find.byTooltip('Next month'));
      await t.pump();
      expect(dots, findsOneWidget);
    });

    testWidgets('Nepali digits, month name and weekday names', (t) async {
      await t.pumpWidget(
          _app(JhiguCalendar(today: _today, language: 'ne', events: events)));
      expect(find.text('भदौ २०८२'), findsOneWidget);
      expect(find.text('१५'), findsOneWidget);
      expect(dots, findsNWidgets(2));
    });
  });

  group('selecting', () {
    testWidgets('tap selects, reports the titles and lists them', (t) async {
      NepaliDate? got;
      List<String>? titles;
      await t.pumpWidget(_app(JhiguCalendar(
        today: _today,
        events: events,
        onSelect: (d, e) {
          got = d;
          titles = e;
        },
      )));
      await t.tap(_day(r'\w+, 15 Bhadra 2082'));
      await t.pump();
      expect(got, _d(2082, 5, 15));
      expect(titles, ['Fulpati', 'Holiday']);
      expect(find.text('• Fulpati'), findsOneWidget);
      expect(find.text('• Holiday'), findsOneWidget);
      expect(find.text('No events'), findsNothing);
    });

    testWidgets('a day without events shows No events', (t) async {
      List<String>? titles;
      await t.pumpWidget(_app(JhiguCalendar(
        today: _today,
        events: events,
        onSelect: (d, e) => titles = e,
      )));
      await t.tap(_day(r'\w+, 20 Bhadra 2082'));
      await t.pump();
      expect(titles, isEmpty);
      expect(find.text('No events'), findsOneWidget);
    });

    testWidgets('the events list follows the language', (t) async {
      await t.pumpWidget(_app(JhiguCalendar(
          today: _today, language: 'ne', value: _d(2082, 5, 20))));
      expect(find.text(getStrings('ne').picker.noEvents), findsOneWidget);
    });

    testWidgets('a value from the parent is followed without onSelect',
        (t) async {
      var calls = 0;
      Widget build(NepaliDate? v) => _app(JhiguCalendar(
            today: _today,
            events: events,
            value: v,
            onSelect: (d, e) => calls++,
          ));
      await t.pumpWidget(build(null));
      await t.pumpWidget(build(_d(2082, 5, 12)));
      expect(find.text('• Teej'), findsOneWidget);
      await t.pumpWidget(build(null));
      expect(find.text('• Teej'), findsNothing);
      expect(calls, 0);
    });

    testWidgets('without a value, a rebuild keeps what the user picked',
        (t) async {
      Widget build(int n) => _app(JhiguCalendar(
            key: const ValueKey('c'),
            today: _today,
            events: events,
            onMonthChanged: (y, m) {},
            // A different callback each time, as a parent that rebuilds would.
            onSelect: (d, e) => n,
          ));
      await t.pumpWidget(build(1));
      await t.tap(_day(r'\w+, 15 Bhadra 2082'));
      await t.pump();
      expect(find.text('• Fulpati'), findsOneWidget);
      await t.pumpWidget(build(2));
      expect(find.text('• Fulpati'), findsOneWidget);
    });

    testWidgets('changing events updates marks and the list', (t) async {
      Widget build(Map<String, List<String>> e) =>
          _app(JhiguCalendar(today: _today, events: e, value: _d(2082, 5, 12)));
      await t.pumpWidget(build(events));
      expect(find.text('• Teej'), findsOneWidget);
      await t.pumpWidget(build(const {
        '2082-05-12': ['Other']
      }));
      expect(find.text('• Teej'), findsNothing);
      expect(find.text('• Other'), findsOneWidget);
      expect(dots, findsOneWidget);
    });
  });

  group('months and keyboard', () {
    testWidgets('onMonthChanged fires for the arrows, not for the first build',
        (t) async {
      final seen = <String>[];
      await t.pumpWidget(_app(JhiguCalendar(
        today: _today,
        onMonthChanged: (y, m) => seen.add('$y-$m'),
      )));
      expect(seen, isEmpty);
      await t.tap(find.byTooltip('Next month'));
      await t.pump();
      await t.tap(find.byTooltip('Previous month'));
      await t.pump();
      await t.tap(find.byTooltip('Previous month'));
      await t.pump();
      expect(seen, ['2082-6', '2082-5', '2082-4']);
    });

    testWidgets('changing year and month props moves the view', (t) async {
      final seen = <String>[];
      Widget build(int m) => _app(JhiguCalendar(
            today: _today,
            year: 2082,
            month: m,
            onMonthChanged: (y, mo) => seen.add('$y-$mo'),
          ));
      await t.pumpWidget(build(5));
      await t.pumpWidget(build(8));
      expect(find.text('Mangsir 2082'), findsOneWidget);
      expect(seen, ['2082-8']);
    });

    testWidgets('the title opens the month list and a month can be chosen',
        (t) async {
      await t.pumpWidget(_app(JhiguCalendar(today: _today, events: const {
        '2082-01-03': ['New year']
      })));
      await t.tap(find.text('Bhadra 2082'));
      await t.pump();
      await t.tap(find.text('Baisakh'));
      await t.pump();
      expect(find.text('Baisakh 2082'), findsOneWidget);
      expect(dots, findsOneWidget);
    });

    testWidgets('arrow keys and Enter select a day', (t) async {
      NepaliDate? got;
      await t.pumpWidget(_app(JhiguCalendar(
        today: _today,
        autofocus: true,
        onSelect: (d, e) => got = d,
      )));
      await t.pump();
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.sendKeyEvent(LogicalKeyboardKey.enter);
      await t.pump();
      expect(got, _d(2082, 5, 11));
    });

    testWidgets('weekStartsOn and showAd are passed on', (t) async {
      await t.pumpWidget(_app(JhiguCalendar(
          today: _today, weekStartsOn: 1, showAd: false, events: events)));
      expect(find.text('Mon'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('AD ')), findsNothing);
    });
  });

  group('theming and layout', () {
    testWidgets('uses JhiguTheme colours for the mark', (t) async {
      const holiday = Color(0xFF00AA00);
      await t.pumpWidget(_app(
        JhiguCalendar(today: _today, events: events),
        theme: ThemeData(extensions: const [JhiguTheme(holiday: holiday)]),
      ));
      final box = t.widget<Container>(dots.first);
      expect((box.decoration! as BoxDecoration).color, holiday);
    });

    testWidgets('does not overflow sideways at a narrow width and large text',
        (t) async {
      // The events list can be long, so the calendar's height is the parent's
      // business: put it in a scroll view, as an app would.
      await t.pumpWidget(MaterialApp(
        builder: (c, w) => MediaQuery(
            data: MediaQuery.of(c)
                .copyWith(textScaler: const TextScaler.linear(1.6)),
            child: w!),
        home: Scaffold(
          body: SingleChildScrollView(
            child: SizedBox(
              width: 240,
              child: JhiguCalendar(
                  today: _today, events: events, value: _d(2082, 5, 15)),
            ),
          ),
        ),
      ));
      expect(t.takeException(), isNull);
    });
  });
}
