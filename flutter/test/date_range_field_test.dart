import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
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

  Widget field({
    NepaliDate? start,
    NepaliDate? end,
    void Function(NepaliDate?, NepaliDate?)? onChanged,
    String language = 'en',
    String? format,
    String? separator,
    bool enabled = true,
    bool clearable = true,
    NepaliDate? min,
    NepaliDate? max,
    InputDecoration? decoration,
  }) =>
      MaterialApp(
        home: Scaffold(
          body: JhiguDateRangeField(
            start: start,
            end: end,
            onChanged: onChanged,
            language: language,
            format: format ?? 'D MMMM YYYY',
            separator: separator ?? ' – ',
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

  Future<void> openIt(WidgetTester t) async {
    await t.tap(find.byType(TextField));
    await t.pumpAndSettle();
  }

  testWidgets('empty shows the placeholder in the language', (t) async {
    await t.pumpWidget(field());
    expect(find.text(getStrings('en').picker.placeholder), findsOneWidget);
    expect(shown(t), '');
    await t.pumpWidget(field(language: 'ne'));
    expect(find.text(getStrings('ne').picker.placeholder), findsOneWidget);
  });

  testWidgets('shows both dates in the format, language and separator',
      (t) async {
    final s = _d(2082, 5, 10);
    final e = _d(2082, 5, 15);
    await t.pumpWidget(field(start: s, end: e));
    expect(shown(t), '10 Bhadra 2082 – 15 Bhadra 2082');
    await t.pumpWidget(field(start: s, end: e, language: 'ne'));
    expect(shown(t), '१० भदौ २०८२ – १५ भदौ २०८२');
    await t.pumpWidget(
        field(start: s, end: e, format: 'YYYY-MM-DD', separator: ' to '));
    expect(shown(t), '2082-05-10 to 2082-05-15');
  });

  testWidgets('a start without an end shows just the start', (t) async {
    await t.pumpWidget(field(start: _d(2082, 5, 10)));
    expect(shown(t), '10 Bhadra 2082');
  });

  testWidgets('tap opens the range dialog; two days fill the field', (t) async {
    final seen = <String>[];
    await t.pumpWidget(field(
        onChanged: (s, e) =>
            seen.add('${s?.toIsoString()} ${e?.toIsoString()}')));
    await openIt(t);
    expect(find.text('Bhadra 2082'), findsOneWidget);
    await t.tap(dayIn(15));
    await t.pumpAndSettle();
    expect(seen, isEmpty); // a start alone is not a result
    await t.tap(dayIn(19));
    await t.pumpAndSettle();
    expect(seen, ['2082-05-15 2082-05-19']);
    expect(shown(t), '15 Bhadra 2082 – 19 Bhadra 2082');
    expect(find.text('Bhadra 2082'), findsNothing);
  });

  testWidgets('the dialog opens on the current range', (t) async {
    await t.pumpWidget(field(start: _d(2082, 7, 3), end: _d(2082, 7, 5)));
    await openIt(t);
    expect(find.text('Kartik 2082'), findsOneWidget);
    expect(find.byKey(const ValueKey('range-start')), findsOneWidget);
    expect(find.byKey(const ValueKey('range-end')), findsOneWidget);
  });

  testWidgets('dismissing the dialog leaves the range alone', (t) async {
    var calls = 0;
    await t.pumpWidget(field(
        start: _d(2082, 5, 10),
        end: _d(2082, 5, 15),
        onChanged: (s, e) => calls++));
    await openIt(t);
    await t.tapAt(const Offset(4, 4));
    await t.pumpAndSettle();
    expect(calls, 0);
    expect(shown(t), '10 Bhadra 2082 – 15 Bhadra 2082');
  });

  testWidgets('the clear button empties the field and reports two nulls',
      (t) async {
    final seen = <String>[];
    await t.pumpWidget(field(
        start: _d(2082, 5, 10),
        end: _d(2082, 5, 15),
        onChanged: (s, e) => seen.add('$s $e')));
    await t.tap(find.byTooltip('Clear'));
    await t.pump();
    expect(seen, ['null null']);
    expect(shown(t), '');
    expect(find.byTooltip('Clear'), findsNothing);
  });

  testWidgets('clearable false hides the clear button', (t) async {
    await t.pumpWidget(
        field(start: _d(2082, 5, 10), end: _d(2082, 5, 15), clearable: false));
    expect(find.byTooltip('Clear'), findsNothing);
  });

  testWidgets('values from the parent are shown without onChanged', (t) async {
    var calls = 0;
    Widget build(NepaliDate? s, NepaliDate? e) =>
        field(start: s, end: e, onChanged: (a, b) => calls++);
    await t.pumpWidget(build(null, null));
    await t.pumpWidget(build(_d(2082, 6, 2), _d(2082, 6, 4)));
    expect(shown(t), '2 Ashwin 2082 – 4 Ashwin 2082');
    await t.pumpWidget(build(null, null));
    expect(shown(t), '');
    expect(calls, 0);
  });

  testWidgets('without start and end, a rebuild keeps the pick', (t) async {
    Widget build(int n) => field(onChanged: (a, b) => n);
    await t.pumpWidget(build(1));
    await openIt(t);
    await t.tap(dayIn(15));
    await t.pumpAndSettle();
    await t.tap(dayIn(19));
    await t.pumpAndSettle();
    await t.pumpWidget(build(2));
    expect(shown(t), '15 Bhadra 2082 – 19 Bhadra 2082');
  });

  testWidgets('changing the language re-formats the text', (t) async {
    final s = _d(2082, 5, 10);
    final e = _d(2082, 5, 15);
    await t.pumpWidget(field(start: s, end: e));
    await t.pumpWidget(field(start: s, end: e, language: 'ne'));
    expect(shown(t), '१० भदौ २०८२ – १५ भदौ २०८२');
  });

  testWidgets('disabled does not open the dialog', (t) async {
    await t.pumpWidget(field(enabled: false));
    await t.tap(find.byType(TextField), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(find.text('Bhadra 2082'), findsNothing);
  });

  testWidgets('min and max reach the dialog', (t) async {
    final seen = <String>[];
    await t.pumpWidget(field(
        onChanged: (s, e) =>
            seen.add('${s?.toIsoString()} ${e?.toIsoString()}'),
        min: _d(2082, 5, 5),
        max: _d(2082, 5, 25)));
    await openIt(t);
    await t.tap(dayIn(3), warnIfMissed: false); // before min: ignored
    await t.pumpAndSettle();
    await t.tap(dayIn(20)); // a valid start
    await t.pumpAndSettle();
    await t.tap(dayIn(28), warnIfMissed: false); // after max: cannot be the end
    await t.pumpAndSettle();
    expect(seen, isEmpty);
    expect(find.text('Bhadra 2082'), findsOneWidget); // still open
    await t.tap(dayIn(24)); // a valid end
    await t.pumpAndSettle();
    expect(seen, ['2082-05-20 2082-05-24']);
  });

  testWidgets('a bad saved range is a typed error when the dialog opens',
      (t) async {
    await t.pumpWidget(field(start: _d(2082, 5, 20), end: _d(2082, 5, 10)));
    await t.tap(find.byType(TextField));
    await t.pump();
    await t.pump(const Duration(milliseconds: 500));
    expect(t.takeException(), isA<InvalidDataException>());
  });

  testWidgets('the decoration label is kept', (t) async {
    await t.pumpWidget(
        field(decoration: const InputDecoration(labelText: 'Stay')));
    expect(find.text('Stay'), findsOneWidget);
  });
}
