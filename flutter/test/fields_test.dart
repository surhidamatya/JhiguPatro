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

  Widget field(Widget f) => _app(f);
  Finder input() => find.byType(TextField);
  String shown(WidgetTester t) =>
      t.widget<TextField>(input().first).controller!.text;
  int caret(WidgetTester t) =>
      t.widget<TextField>(input().first).controller!.selection.baseOffset;
  Future<void> type(WidgetTester t, String text, {Finder? into}) async {
    await t.enterText(into ?? input(), text);
    await t.pump();
  }

  group('JhiguMoneyField', () {
    testWidgets('groups as you type and reports the amount', (t) async {
      Npr? got;
      await t.pumpWidget(field(JhiguMoneyField(onChanged: (a) => got = a)));
      await type(t, '1234567.5');
      expect(shown(t), '12,34,567.5');
      expect(got, Npr.fromPaisa(123456750));
    });

    testWidgets('accepts Devanagari digits and shows them as ASCII', (t) async {
      await t.pumpWidget(field(const JhiguMoneyField()));
      await type(t, '१२३४');
      expect(shown(t), '1,234');
    });

    testWidgets('native digits shows Devanagari', (t) async {
      Npr? got;
      await t.pumpWidget(field(JhiguMoneyField(
          digits: MoneyDigits.native, onChanged: (a) => got = a)));
      await type(t, '1234');
      expect(shown(t), '१,२३४');
      expect(got, Npr.fromPaisa(123400));
    });

    testWidgets('drops a leading symbol, a third decimal and leading zeros',
        (t) async {
      await t.pumpWidget(field(const JhiguMoneyField()));
      await type(t, 'Rs. 500');
      expect(shown(t), '500');
      await type(t, '12.345');
      expect(shown(t), '12.34');
      await type(t, '007');
      expect(shown(t), '7');
    });

    testWidgets('empty field reports null', (t) async {
      final seen = <Npr?>[];
      await t.pumpWidget(field(JhiguMoneyField(onChanged: seen.add)));
      await type(t, '5');
      await type(t, '');
      expect(seen, [Npr.fromPaisa(500), null]);
    });

    testWidgets('pads to two decimals when the field loses focus', (t) async {
      Npr? got;
      await t.pumpWidget(_app(Column(children: [
        JhiguMoneyField(onChanged: (a) => got = a),
        const TextField(key: ValueKey('other')),
      ])));
      await t.tap(input().first);
      await type(t, '1234.5', into: input().first);
      expect(shown(t), '1,234.5');
      await t.tap(find.byKey(const ValueKey('other')));
      await t.pump();
      expect(shown(t), '1,234.50');
      expect(got, Npr.fromPaisa(123450));
    });

    testWidgets('an amount past the largest is ignored', (t) async {
      await t.pumpWidget(field(const JhiguMoneyField()));
      await type(t, '12');
      await type(t, '99999999999999999999');
      expect(shown(t), '12');
    });

    testWidgets('negative only when allowed', (t) async {
      Npr? got;
      await t.pumpWidget(field(JhiguMoneyField(onChanged: (a) => got = a)));
      await type(t, '-5');
      expect(shown(t), '5');
      await t.pumpWidget(field(JhiguMoneyField(
          key: const ValueKey('n'),
          allowNegative: true,
          onChanged: (a) => got = a)));
      await type(t, '-5');
      expect(shown(t), '-5');
      expect(got, Npr.fromPaisa(-500));
    });

    testWidgets('keeps the caret by counting digits to its left', (t) async {
      await t.pumpWidget(field(const JhiguMoneyField()));
      await type(t, '1234');
      expect(shown(t), '1,234');
      // The user types 9 after "1,2": raw is "1,29" + "34", caret after the 9.
      t.testTextInput.updateEditingValue(const TextEditingValue(
        text: '1,2934',
        selection: TextSelection.collapsed(offset: 4),
      ));
      await t.pump();
      expect(shown(t), '12,934');
      expect(caret(t), 4); // after "12," and the 9
    });

    testWidgets('a value from the parent is shown without onChanged',
        (t) async {
      var calls = 0;
      Widget build(Npr? v) =>
          field(JhiguMoneyField(value: v, onChanged: (a) => calls++));
      await t.pumpWidget(build(null));
      await t.pumpWidget(build(Npr.fromPaisa(123456)));
      expect(shown(t), '1,234.56');
      await t.pumpWidget(build(null));
      expect(shown(t), '');
      expect(calls, 0);
    });

    testWidgets('without a value, a rebuild keeps what was typed', (t) async {
      Widget build(int n) => field(JhiguMoneyField(onChanged: (a) => n));
      await t.pumpWidget(build(1));
      await type(t, '250');
      await t.pumpWidget(build(2));
      expect(shown(t), '250');
    });

    testWidgets('uses the decoration and the number keyboard', (t) async {
      await t.pumpWidget(field(const JhiguMoneyField(
          decoration: InputDecoration(labelText: 'Amount'))));
      expect(find.text('Amount'), findsOneWidget);
      expect(t.widget<TextField>(input()).keyboardType,
          const TextInputType.numberWithOptions(decimal: true));
    });

    testWidgets('allowNegative uses the signed number keyboard', (t) async {
      await t.pumpWidget(field(const JhiguMoneyField(allowNegative: true)));
      expect(t.widget<TextField>(input()).keyboardType,
          const TextInputType.numberWithOptions(decimal: true, signed: true));
    });

    testWidgets('disabled does not take input', (t) async {
      await t.pumpWidget(field(const JhiguMoneyField(enabled: false)));
      expect(t.widget<TextField>(input()).enabled, false);
    });
  });

  group('JhiguPhoneField', () {
    final carrierOf = PhoneInput(value: '9841234567').state.carrier;

    testWidgets('formats a mobile, reports E.164 and shows the carrier',
        (t) async {
      String? got = 'unset';
      await t.pumpWidget(field(JhiguPhoneField(onChanged: (e) => got = e)));
      await type(t, '9841234567');
      expect(shown(t), '984-1234567');
      expect(got, '+9779841234567');
      expect(carrierOf, isNotNull);
      expect(find.text(carrierOf!), findsOneWidget);
    });

    testWidgets('accepts Devanagari digits and a +977 prefix', (t) async {
      String? got;
      await t.pumpWidget(field(JhiguPhoneField(onChanged: (e) => got = e)));
      await type(t, '९८४१२३४५६७');
      expect(shown(t), '984-1234567');
      await type(t, '+977 9841234567');
      expect(got, '+9779841234567');
      expect(shown(t), startsWith('+977'));
    });

    testWidgets('formats a Kathmandu landline', (t) async {
      String? got;
      await t.pumpWidget(field(JhiguPhoneField(onChanged: (e) => got = e)));
      await type(t, '014123456');
      expect(shown(t), '01-4123456');
      expect(got, '+97714123456');
    });

    testWidgets('onChanged goes back to null when the number stops being valid',
        (t) async {
      final seen = <String?>[];
      await t.pumpWidget(field(JhiguPhoneField(onChanged: seen.add)));
      await type(t, '9841234567');
      await type(t, '984123456');
      expect(seen, ['+9779841234567', null]);
    });

    testWidgets('onChanged is not called while the number stays invalid',
        (t) async {
      final seen = <String?>[];
      await t.pumpWidget(field(JhiguPhoneField(onChanged: seen.add)));
      await type(t, '98');
      await type(t, '984');
      await type(t, '98412');
      expect(seen, isEmpty);
    });

    testWidgets('an unfinished number is only an error after leaving',
        (t) async {
      final headless = PhoneInput(value: '98412')..blur();
      final message = headless.state.message!;
      await t.pumpWidget(_app(const Column(children: [
        JhiguPhoneField(),
        TextField(key: ValueKey('other')),
      ])));
      await t.tap(input().first);
      await type(t, '98412', into: input().first);
      expect(find.text(message), findsNothing);
      await t.tap(find.byKey(const ValueKey('other')));
      await t.pump();
      expect(find.text(message), findsOneWidget);
    });

    testWidgets('a number that is too long is reported at once, not cut',
        (t) async {
      final message = PhoneInput(value: '98412345678').state.message!;
      await t.pumpWidget(field(const JhiguPhoneField()));
      await type(t, '98412345678');
      expect(find.text(message), findsOneWidget);
      expect(shown(t).replaceAll(RegExp(r'\D'), ''), '98412345678');
    });

    testWidgets('messages and the carrier follow the language', (t) async {
      final en = PhoneInput(value: '98412345678').state.message!;
      final ne =
          PhoneInput(language: 'ne', value: '98412345678').state.message!;
      expect(ne, isNot(en));
      Widget build(String l) => field(JhiguPhoneField(language: l));
      await t.pumpWidget(build('en'));
      await type(t, '98412345678');
      expect(find.text(en), findsOneWidget);
      await t.pumpWidget(build('ne'));
      expect(find.text(ne), findsOneWidget);
      expect(find.text(en), findsNothing);
    });

    testWidgets('showCarrier false hides the carrier', (t) async {
      await t.pumpWidget(field(const JhiguPhoneField(showCarrier: false)));
      await type(t, '9841234567');
      expect(find.text(carrierOf!), findsNothing);
    });

    testWidgets('a decoration helper replaces the carrier', (t) async {
      await t.pumpWidget(field(const JhiguPhoneField(
          decoration: InputDecoration(helperText: 'My help'))));
      await type(t, '9841234567');
      expect(find.text('My help'), findsOneWidget);
      expect(find.text(carrierOf!), findsNothing);
    });

    testWidgets('a decoration error text replaces the message', (t) async {
      final message = PhoneInput(value: '98412345678').state.message!;
      await t.pumpWidget(field(const JhiguPhoneField(
          decoration: InputDecoration(errorText: 'My error'))));
      await type(t, '98412345678');
      expect(find.text('My error'), findsOneWidget);
      expect(find.text(message), findsNothing);
    });

    testWidgets('onStateChanged gets every state', (t) async {
      final states = <PhoneInputState>[];
      await t.pumpWidget(field(JhiguPhoneField(onStateChanged: states.add)));
      await type(t, '9841234567');
      expect(states, isNotEmpty);
      expect(states.last.valid, isTrue);
      expect(states.last.e164, '+9779841234567');
    });

    testWidgets('a value from the parent is shown without callbacks',
        (t) async {
      var calls = 0;
      Widget build(String? v) => field(JhiguPhoneField(
          value: v, onChanged: (e) => calls++, onStateChanged: (s) => calls++));
      await t.pumpWidget(build(null));
      await t.pumpWidget(build('9841234567'));
      expect(shown(t), '984-1234567');
      expect(calls, 0);
      await t.pumpWidget(build(''));
      expect(shown(t), '');
    });

    testWidgets('without a value, a rebuild keeps what was typed', (t) async {
      Widget build(int n) => field(JhiguPhoneField(onChanged: (e) => n));
      await t.pumpWidget(build(1));
      await type(t, '9841234567');
      await t.pumpWidget(build(2));
      expect(shown(t), '984-1234567');
    });

    testWidgets('uses the phone keyboard', (t) async {
      await t.pumpWidget(field(const JhiguPhoneField()));
      expect(t.widget<TextField>(input()).keyboardType, TextInputType.phone);
    });
  });
}
