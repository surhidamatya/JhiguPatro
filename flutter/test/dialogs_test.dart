import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jhigu_patro_flutter/jhigu_patro_flutter.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

final _today = NepaliDate.checked(2082, 5, 10);

NepaliDate _d(int y, int m, int d) => NepaliDate.checked(y, m, d);

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

  Finder dayIn(int d) => _day(r'\w+, ' '$d' r' Bhadra 2082');

  /// A button that opens a dialog and stores what it returned.
  Widget launcher<T>(
    Future<T?> Function(BuildContext) open,
    void Function(T?) done,
  ) =>
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (c) => ElevatedButton(
              onPressed: () async => done(await open(c)),
              child: const Text('open'),
            ),
          ),
        ),
      );

  Future<void> openIt(WidgetTester t) async {
    await t.tap(find.text('open'));
    await t.pumpAndSettle();
  }

  group('showJhiguDatePicker', () {
    Widget app(void Function(NepaliDate?) done,
            {NepaliDate? initial,
            NepaliDate? min,
            NepaliDate? max,
            String language = 'en',
            bool barrierDismissible = true}) =>
        launcher<NepaliDate>(
          (c) => showJhiguDatePicker(
            context: c,
            initial: initial,
            min: min,
            max: max,
            language: language,
            today: _today,
            barrierDismissible: barrierDismissible,
          ),
          done,
        );

    testWidgets('picking a day closes the dialog and returns it', (t) async {
      NepaliDate? got;
      var closed = false;
      await t.pumpWidget(app((d) {
        got = d;
        closed = true;
      }));
      await openIt(t);
      expect(find.text('Bhadra 2082'), findsOneWidget);
      await t.tap(dayIn(15));
      await t.pumpAndSettle();
      expect(closed, isTrue);
      expect(got, _d(2082, 5, 15));
      expect(find.text('Bhadra 2082'), findsNothing);
    });

    testWidgets('picking the day that was already selected still closes',
        (t) async {
      NepaliDate? got;
      await t.pumpWidget(app((d) => got = d, initial: _d(2082, 5, 12)));
      await openIt(t);
      await t.tap(dayIn(12));
      await t.pumpAndSettle();
      expect(got, _d(2082, 5, 12));
    });

    testWidgets('opens on the month of the initial day', (t) async {
      await t.pumpWidget(app((d) {}, initial: _d(2082, 7, 3)));
      await openIt(t);
      expect(find.text('Kartik 2082'), findsOneWidget);
    });

    testWidgets('tapping outside dismisses with null', (t) async {
      var calls = 0;
      NepaliDate? got = _today;
      await t.pumpWidget(app((d) {
        calls++;
        got = d;
      }));
      await openIt(t);
      await t.tapAt(const Offset(4, 4));
      await t.pumpAndSettle();
      expect(calls, 1);
      expect(got, isNull);
      expect(find.text('Bhadra 2082'), findsNothing);
    });

    testWidgets('Escape dismisses with null', (t) async {
      NepaliDate? got = _today;
      await t.pumpWidget(app((d) => got = d));
      await openIt(t);
      await t.sendKeyEvent(LogicalKeyboardKey.escape);
      await t.pumpAndSettle();
      expect(got, isNull);
      expect(find.text('Bhadra 2082'), findsNothing);
    });

    testWidgets('barrierDismissible false keeps it open', (t) async {
      await t.pumpWidget(app((d) {}, barrierDismissible: false));
      await openIt(t);
      await t.tapAt(const Offset(4, 4));
      await t.pumpAndSettle();
      expect(find.text('Bhadra 2082'), findsOneWidget);
    });

    testWidgets('Today picks today and there is no Clear button', (t) async {
      NepaliDate? got;
      await t.pumpWidget(app((d) => got = d, initial: _d(2082, 6, 1)));
      await openIt(t);
      expect(find.text('Clear'), findsNothing);
      await t.tap(find.text('Today'));
      await t.pumpAndSettle();
      expect(got, _today);
    });

    testWidgets('a day outside min and max does not close it', (t) async {
      var calls = 0;
      await t.pumpWidget(
          app((d) => calls++, min: _d(2082, 5, 5), max: _d(2082, 5, 25)));
      await openIt(t);
      await t.tap(dayIn(3), warnIfMissed: false);
      await t.pumpAndSettle();
      expect(calls, 0);
      expect(find.text('Bhadra 2082'), findsOneWidget);
    });

    testWidgets('the keyboard works at once: arrows and Enter pick', (t) async {
      NepaliDate? got;
      await t.pumpWidget(app((d) => got = d));
      await openIt(t);
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.sendKeyEvent(LogicalKeyboardKey.enter);
      await t.pumpAndSettle();
      expect(got, _d(2082, 5, 11));
    });

    testWidgets('Nepali', (t) async {
      await t.pumpWidget(app((d) {}, language: 'ne'));
      await openIt(t);
      expect(find.text('भदौ २०८२'), findsOneWidget);
    });
  });

  group('showJhiguDateRangePicker', () {
    Widget app(void Function(JhiguDateRange?) done,
            {NepaliDate? start, NepaliDate? end}) =>
        launcher<JhiguDateRange>(
          (c) => showJhiguDateRangePicker(
            context: c,
            initialStart: start,
            initialEnd: end,
            today: _today,
          ),
          done,
        );

    testWidgets('the second day closes it and returns both', (t) async {
      JhiguDateRange? got;
      var calls = 0;
      await t.pumpWidget(app((r) {
        got = r;
        calls++;
      }));
      await openIt(t);
      await t.tap(dayIn(15));
      await t.pumpAndSettle();
      expect(calls, 0);
      expect(find.text('Bhadra 2082'), findsOneWidget);
      await t.tap(dayIn(19));
      await t.pumpAndSettle();
      expect(calls, 1);
      expect(got!.start, _d(2082, 5, 15));
      expect(got!.end, _d(2082, 5, 19));
    });

    testWidgets('the same day twice is a one-day range', (t) async {
      JhiguDateRange? got;
      await t.pumpWidget(app((r) => got = r));
      await openIt(t);
      await t.tap(dayIn(15));
      await t.pumpAndSettle();
      await t.tap(dayIn(15));
      await t.pumpAndSettle();
      expect(got!.start, _d(2082, 5, 15));
      expect(got!.end, _d(2082, 5, 15));
    });

    testWidgets('dismissing after only a start returns null', (t) async {
      JhiguDateRange? got = (start: _today, end: _today);
      await t.pumpWidget(app((r) => got = r));
      await openIt(t);
      await t.tap(dayIn(15));
      await t.pumpAndSettle();
      await t.tapAt(const Offset(4, 4));
      await t.pumpAndSettle();
      expect(got, isNull);
    });

    testWidgets('an initial range is shown', (t) async {
      await t.pumpWidget(
          app((r) {}, start: _d(2082, 5, 12), end: _d(2082, 5, 14)));
      await openIt(t);
      expect(find.byKey(const ValueKey('range-start')), findsOneWidget);
      expect(find.byKey(const ValueKey('range-end')), findsOneWidget);
    });
  });

  group('JhiguDateField', () {
    Widget field({
      NepaliDate? value,
      ValueChanged<NepaliDate?>? onChanged,
      String language = 'en',
      String? format,
      bool enabled = true,
      bool clearable = true,
      NepaliDate? min,
      NepaliDate? max,
      InputDecoration? decoration,
    }) =>
        MaterialApp(
          home: Scaffold(
            body: JhiguDateField(
              value: value,
              onChanged: onChanged,
              language: language,
              format: format ?? 'D MMMM YYYY',
              enabled: enabled,
              clearable: clearable,
              min: min,
              max: max,
              today: _today,
              decoration: decoration,
            ),
          ),
        );
    String shown(WidgetTester t) =>
        t.widget<TextField>(find.byType(TextField)).controller!.text;

    testWidgets('empty shows the placeholder in the language', (t) async {
      await t.pumpWidget(field());
      expect(find.text(getStrings('en').picker.placeholder), findsOneWidget);
      expect(shown(t), '');
      await t.pumpWidget(field(language: 'ne'));
      expect(find.text(getStrings('ne').picker.placeholder), findsOneWidget);
    });

    testWidgets('shows the value in the format and language', (t) async {
      await t.pumpWidget(field(value: _d(2082, 5, 10)));
      expect(shown(t), '10 Bhadra 2082');
      await t.pumpWidget(field(value: _d(2082, 5, 10), language: 'ne'));
      expect(shown(t), '१० भदौ २०८२');
      await t.pumpWidget(field(value: _d(2082, 5, 10), format: 'YYYY-MM-DD'));
      expect(shown(t), '2082-05-10');
    });

    testWidgets('tap opens the picker, a pick fills the field', (t) async {
      final seen = <NepaliDate?>[];
      await t.pumpWidget(field(onChanged: seen.add));
      await t.tap(find.byType(TextField));
      await t.pumpAndSettle();
      expect(find.text('Bhadra 2082'), findsOneWidget);
      await t.tap(dayIn(15));
      await t.pumpAndSettle();
      expect(seen, [_d(2082, 5, 15)]);
      expect(shown(t), '15 Bhadra 2082');
      expect(find.text('Bhadra 2082'), findsNothing);
    });

    testWidgets('the picker opens on the current value', (t) async {
      await t.pumpWidget(field(value: _d(2082, 7, 3)));
      await t.tap(find.byType(TextField));
      await t.pumpAndSettle();
      expect(find.text('Kartik 2082'), findsOneWidget);
    });

    testWidgets('dismissing the picker leaves the value alone', (t) async {
      var calls = 0;
      await t
          .pumpWidget(field(value: _d(2082, 5, 10), onChanged: (d) => calls++));
      await t.tap(find.byType(TextField));
      await t.pumpAndSettle();
      await t.tapAt(const Offset(4, 4));
      await t.pumpAndSettle();
      expect(calls, 0);
      expect(shown(t), '10 Bhadra 2082');
    });

    testWidgets('the clear button empties the field and reports null',
        (t) async {
      final seen = <NepaliDate?>[];
      await t.pumpWidget(field(value: _d(2082, 5, 10), onChanged: seen.add));
      await t.tap(find.byTooltip('Clear'));
      await t.pump();
      expect(seen, [null]);
      expect(shown(t), '');
      expect(find.byTooltip('Clear'), findsNothing);
    });

    testWidgets('clearable false hides the clear button', (t) async {
      await t.pumpWidget(field(value: _d(2082, 5, 10), clearable: false));
      expect(find.byTooltip('Clear'), findsNothing);
    });

    testWidgets('a value from the parent is shown without onChanged',
        (t) async {
      var calls = 0;
      Widget build(NepaliDate? v) => field(value: v, onChanged: (d) => calls++);
      await t.pumpWidget(build(null));
      await t.pumpWidget(build(_d(2082, 6, 2)));
      expect(shown(t), '2 Ashwin 2082');
      await t.pumpWidget(build(null));
      expect(shown(t), '');
      expect(calls, 0);
    });

    testWidgets('without a value, a rebuild keeps the pick', (t) async {
      Widget build(int n) => field(onChanged: (d) => n);
      await t.pumpWidget(build(1));
      await t.tap(find.byType(TextField));
      await t.pumpAndSettle();
      await t.tap(dayIn(15));
      await t.pumpAndSettle();
      await t.pumpWidget(build(2));
      expect(shown(t), '15 Bhadra 2082');
    });

    testWidgets('changing the language re-formats the text', (t) async {
      await t.pumpWidget(field(value: _d(2082, 5, 10)));
      await t.pumpWidget(field(value: _d(2082, 5, 10), language: 'ne'));
      expect(shown(t), '१० भदौ २०८२');
    });

    testWidgets('disabled does not open the picker', (t) async {
      await t.pumpWidget(field(enabled: false));
      await t.tap(find.byType(TextField), warnIfMissed: false);
      await t.pumpAndSettle();
      expect(find.text('Bhadra 2082'), findsNothing);
    });

    testWidgets('min and max reach the dialog', (t) async {
      final seen = <NepaliDate?>[];
      await t.pumpWidget(field(
          onChanged: seen.add, min: _d(2082, 5, 5), max: _d(2082, 5, 25)));
      await t.tap(find.byType(TextField));
      await t.pumpAndSettle();
      await t.tap(dayIn(3), warnIfMissed: false);
      await t.pumpAndSettle();
      expect(seen, isEmpty);
      expect(find.text('Bhadra 2082'), findsOneWidget);
    });

    testWidgets('the decoration label is kept', (t) async {
      await t.pumpWidget(
          field(decoration: const InputDecoration(labelText: 'Date of birth')));
      expect(find.text('Date of birth'), findsOneWidget);
    });
  });

  group('JhiguDatePicker onSelected and showClear', () {
    Widget picker({
      NepaliDate? value,
      NepaliDate? min,
      void Function(NepaliDate)? onSelected,
      ValueChanged<NepaliDate?>? onChanged,
      bool showClear = true,
      bool autofocus = false,
    }) =>
        MaterialApp(
          home: Scaffold(
            body: JhiguDatePicker(
              value: value,
              min: min,
              today: _today,
              showClear: showClear,
              autofocus: autofocus,
              onSelected: onSelected,
              onChanged: onChanged,
            ),
          ),
        );

    testWidgets('fires for every pick, even the same day again', (t) async {
      final picked = <NepaliDate>[];
      var changes = 0;
      await t.pumpWidget(picker(
          value: _d(2082, 5, 12),
          onSelected: picked.add,
          onChanged: (d) => changes++));
      await t.tap(dayIn(12));
      await t.pump();
      expect(picked, [_d(2082, 5, 12)]);
      expect(changes, 0); // onChanged is only for a change
      await t.tap(dayIn(14));
      await t.pump();
      expect(picked.last, _d(2082, 5, 14));
      expect(changes, 1);
    });

    testWidgets('fires for Today and for Enter, not for a disabled day',
        (t) async {
      final picked = <NepaliDate>[];
      await t.pumpWidget(
          picker(min: _d(2082, 5, 5), onSelected: picked.add, autofocus: true));
      await t.pump();
      await t.tap(dayIn(3), warnIfMissed: false);
      await t.pump();
      expect(picked, isEmpty);
      await t.tap(find.text('Today'));
      await t.pump();
      expect(picked, [_today]);
      await t.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await t.sendKeyEvent(LogicalKeyboardKey.enter);
      await t.pump();
      expect(picked.last, _d(2082, 5, 11));
    });

    testWidgets('showClear false hides only the Clear button', (t) async {
      await t.pumpWidget(picker(showClear: false));
      expect(find.text('Clear'), findsNothing);
      expect(find.text('Today'), findsOneWidget);
    });
  });
}
