import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jhigu_patro_flutter/jhigu_patro_flutter.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

Widget _app(Widget child, {ThemeData? theme}) => MaterialApp(
      theme: theme,
      home: Scaffold(body: Center(child: SizedBox(width: 340, child: child))),
    );

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

  final province = find.byKey(const ValueKey('address-province'));
  final district = find.byKey(const ValueKey('address-district'));
  final local = find.byKey(const ValueKey('address-local-level'));
  final ward = find.byKey(const ValueKey('address-ward'));

  bool enabledOf(WidgetTester t, Finder f) =>
      t.widget<DropdownButton<int>>(f).onChanged != null;

  /// Open a dropdown and pick an entry by its visible text.
  Future<void> pick(WidgetTester t, Finder dropdown, String text) async {
    await t.tap(dropdown);
    await t.pumpAndSettle();
    await t.tap(find.text(text).last);
    await t.pumpAndSettle();
  }

  Widget picker({
    int? localLevelId,
    int? wardNo,
    String language = 'en',
    bool showWard = true,
    bool enabled = true,
    InputDecoration? decoration,
    ValueChanged<AddressPickerState>? onChanged,
  }) =>
      _app(SingleChildScrollView(
        child: JhiguAddressPicker(
          localLevelId: localLevelId,
          ward: wardNo,
          language: language,
          showWard: showWard,
          enabled: enabled,
          decoration: decoration,
          onChanged: onChanged,
        ),
      ));

  // Bagmati (3), Bhaktapur (23), Bhaktapur Municipality (274, 10 wards).
  Future<void> chooseAll(WidgetTester t, {int wardNo = 3}) async {
    await pick(t, province, 'Bagmati');
    await pick(t, district, 'Bhaktapur');
    await pick(t, local, 'Bhaktapur Municipality');
    await pick(t, ward, 'Ward $wardNo');
  }

  group('choosing', () {
    testWidgets('starts with four empty dropdowns and only the first enabled',
        (t) async {
      await t.pumpWidget(picker());
      final s = getStrings('en').address;
      for (final label in [s.province, s.district, s.localLevel, s.wardLabel]) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
      expect(find.text(s.choose), findsNWidgets(4));
      expect(enabledOf(t, province), isTrue);
      expect(enabledOf(t, district), isFalse);
      expect(enabledOf(t, local), isFalse);
      expect(enabledOf(t, ward), isFalse);
    });

    testWidgets('each choice enables the next dropdown', (t) async {
      await t.pumpWidget(picker());
      await pick(t, province, 'Bagmati');
      expect(enabledOf(t, district), isTrue);
      expect(enabledOf(t, local), isFalse);
      await pick(t, district, 'Bhaktapur');
      expect(enabledOf(t, local), isTrue);
      expect(enabledOf(t, ward), isFalse);
      await pick(t, local, 'Bhaktapur Municipality');
      expect(enabledOf(t, ward), isTrue);
    });

    testWidgets('a full choice reports the selection', (t) async {
      final seen = <AddressPickerState>[];
      await t.pumpWidget(picker(onChanged: seen.add));
      await chooseAll(t);
      final s = seen.last;
      expect(s.complete, isTrue);
      expect(s.selection!.provinceId, 3);
      expect(s.selection!.districtId, 23);
      expect(s.selection!.localLevelId, 274);
      expect(s.selection!.ward, 3);
      expect(seen.where((s) => s.complete), hasLength(1));
      expect(seen.take(3).every((s) => !s.complete), isTrue);
    });

    testWidgets('the ward list is 1 to the wards of the local level',
        (t) async {
      await t.pumpWidget(picker(localLevelId: 274));
      await t.tap(ward);
      await t.pumpAndSettle();
      expect(find.text('Ward 10'), findsOneWidget);
      expect(find.text('Ward 11'), findsNothing);
      expect(find.text('Ward 1'), findsWidgets);
    });

    testWidgets('a new province clears everything below it', (t) async {
      final seen = <AddressPickerState>[];
      await t.pumpWidget(picker(onChanged: seen.add));
      await chooseAll(t);
      await pick(t, province, 'Gandaki');
      final s = seen.last;
      expect([s.provinceId, s.districtId, s.localLevelId, s.ward],
          [4, null, null, null]);
      expect(enabledOf(t, local), isFalse);
      expect(find.text('Bhaktapur Municipality'), findsNothing);
    });

    testWidgets('a new district clears the local level and ward', (t) async {
      final seen = <AddressPickerState>[];
      await t.pumpWidget(picker(onChanged: seen.add));
      await chooseAll(t);
      await pick(t, district, 'Chitwan');
      final s = seen.last;
      expect([s.provinceId, s.districtId, s.localLevelId, s.ward],
          [3, 24, null, null]);
    });

    testWidgets('a new local level clears the ward', (t) async {
      final seen = <AddressPickerState>[];
      await t.pumpWidget(picker(onChanged: seen.add));
      await chooseAll(t);
      await pick(t, local, 'Changunarayan Municipality');
      final s = seen.last;
      expect([s.districtId, s.localLevelId, s.ward], [23, 275, null]);
      expect(s.complete, isFalse);
    });

    testWidgets('choosing Select clears that level and the ones below',
        (t) async {
      final seen = <AddressPickerState>[];
      await t.pumpWidget(picker(onChanged: seen.add));
      await chooseAll(t);
      await pick(t, district, getStrings('en').address.choose);
      final s = seen.last;
      expect([s.provinceId, s.districtId, s.localLevelId, s.ward],
          [3, null, null, null]);
    });
  });

  group('saved address', () {
    testWidgets('a local level id fills in the levels above it, quietly',
        (t) async {
      var calls = 0;
      await t.pumpWidget(
          picker(localLevelId: 274, wardNo: 3, onChanged: (_) => calls++));
      expect(find.text('Bagmati'), findsOneWidget);
      expect(find.text('Bhaktapur'), findsOneWidget);
      expect(find.text('Bhaktapur Municipality'), findsOneWidget);
      expect(find.text('Ward 3'), findsOneWidget);
      expect(calls, 0);
    });

    testWidgets('an unknown local level is an error', (t) async {
      await t.pumpWidget(picker(localLevelId: 99999));
      expect(t.takeException(), isA<AddressException>());
    });

    testWidgets('a ward outside the local level is an error', (t) async {
      await t.pumpWidget(picker(localLevelId: 274, wardNo: 11));
      expect(t.takeException(), isA<AddressException>());
    });

    testWidgets('a value from the parent is followed without onChanged',
        (t) async {
      var calls = 0;
      Widget build(int? id, int? w) =>
          picker(localLevelId: id, wardNo: w, onChanged: (_) => calls++);
      await t.pumpWidget(build(null, null));
      await t.pumpWidget(build(274, 2));
      expect(find.text('Bhaktapur Municipality'), findsOneWidget);
      expect(find.text('Ward 2'), findsOneWidget);
      await t.pumpWidget(build(275, null));
      expect(find.text('Changunarayan Municipality'), findsOneWidget);
      expect(find.text('Ward 2'), findsNothing);
      await t.pumpWidget(build(null, null));
      expect(find.text('Changunarayan Municipality'), findsNothing);
      expect(calls, 0);
    });

    testWidgets('without saved values, a rebuild keeps the choice', (t) async {
      await t.pumpWidget(picker());
      await chooseAll(t);
      await t.pumpWidget(picker());
      expect(find.text('Bhaktapur Municipality'), findsOneWidget);
      expect(find.text('Ward 3'), findsOneWidget);
    });
  });

  group('options', () {
    testWidgets(
        'showWard false drops the ward and completes at the local level',
        (t) async {
      final seen = <AddressPickerState>[];
      await t.pumpWidget(picker(showWard: false, onChanged: seen.add));
      expect(ward, findsNothing);
      await pick(t, province, 'Bagmati');
      await pick(t, district, 'Bhaktapur');
      await pick(t, local, 'Bhaktapur Municipality');
      expect(seen.last.complete, isTrue);
      expect(seen.last.selection!.ward, isNull);
    });

    testWidgets('a hidden ward is not part of a saved value', (t) async {
      await t.pumpWidget(picker(localLevelId: 274, wardNo: 3, showWard: false));
      expect(find.text('Ward 3'), findsNothing);
    });

    testWidgets('a hidden ward is not reported either', (t) async {
      final seen = <AddressPickerState>[];
      Widget build(String lang) => picker(
          localLevelId: 274,
          wardNo: 3,
          showWard: false,
          language: lang,
          onChanged: seen.add);
      await t.pumpWidget(build('en'));
      await t.pumpWidget(build('ne')); // a language change reports the state
      expect(seen.last.localLevelId, 274);
      expect(seen.last.ward, isNull);
    });

    testWidgets('turning the ward off keeps the rest and drops the ward',
        (t) async {
      await t.pumpWidget(picker());
      await chooseAll(t);
      await t.pumpWidget(picker(showWard: false));
      expect(find.text('Bhaktapur Municipality'), findsOneWidget);
      expect(ward, findsNothing);
      await t.pumpWidget(picker(showWard: true));
      expect(find.text('Bhaktapur Municipality'), findsOneWidget);
      expect(find.text('Ward 3'), findsNothing); // the hidden ward was dropped
    });

    testWidgets('Nepali labels, names and ward digits', (t) async {
      await t.pumpWidget(picker(localLevelId: 274, wardNo: 3, language: 'ne'));
      final s = getStrings('ne').address;
      expect(find.text(s.province), findsOneWidget);
      expect(find.text(s.localLevel), findsOneWidget);
      expect(find.text('बाग्मती'), findsOneWidget);
      expect(find.text('भक्तपुर'), findsOneWidget);
      expect(find.text(s.ward.replaceAll('{n}', '३')), findsOneWidget);
    });

    testWidgets('switching language keeps the choice', (t) async {
      await t.pumpWidget(picker(localLevelId: 274, wardNo: 3));
      await t.pumpWidget(picker(localLevelId: 274, wardNo: 3, language: 'ne'));
      expect(find.text('बाग्मती'), findsOneWidget);
      expect(find.text('Bagmati'), findsNothing);
      await t.pumpWidget(picker(localLevelId: 274, wardNo: 3));
      expect(find.text('Ward 3'), findsOneWidget);
    });

    testWidgets('enabled false disables every dropdown', (t) async {
      await t.pumpWidget(picker(localLevelId: 274, enabled: false));
      for (final f in [province, district, local, ward]) {
        expect(enabledOf(t, f), isFalse);
      }
    });

    testWidgets('decoration is applied to every dropdown', (t) async {
      await t.pumpWidget(picker(
          decoration: const InputDecoration(border: OutlineInputBorder())));
      final boxes = t.widgetList<InputDecorator>(find.byType(InputDecorator));
      expect(boxes, hasLength(4));
      expect(boxes.every((b) => b.decoration.border is OutlineInputBorder),
          isTrue);
    });

    testWidgets('long names do not overflow at a narrow width and large text',
        (t) async {
      await t.pumpWidget(MaterialApp(
        builder: (c, w) => MediaQuery(
            data: MediaQuery.of(c)
                .copyWith(textScaler: const TextScaler.linear(1.6)),
            child: w!),
        home: const Scaffold(
          body: SingleChildScrollView(
            child: SizedBox(
              width: 220,
              child: JhiguAddressPicker(localLevelId: 274, ward: 3),
            ),
          ),
        ),
      ));
      expect(t.takeException(), isNull);
    });
  });
}
