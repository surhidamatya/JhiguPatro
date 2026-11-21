import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:jhigu_patro_utils/receipt_pdf.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _cal = _read('../data/nepali_calendar_data.json');
final Map<int, List<int>> _years = (_cal['years'] as Map<String, dynamic>).map(
  (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
);

// A valid 1x1 PNG.
final Uint8List _png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);

class _FakeRenderer implements DevanagariRenderer {
  final List<String> calls = [];
  final Map<String, int> colors = {};
  @override
  Future<RenderedText> render(
    String text, {
    required double fontSize,
    required bool bold,
    required int color,
  }) async {
    calls.add(text);
    colors[text] = color;
    return RenderedText(
        png: _png,
        widthPt: fontSize * text.length * 0.5,
        heightPt: fontSize * 1.3);
  }
}

ReceiptDocument _doc({
  ReceiptLanguage language = ReceiptLanguage.en,
  PageSize pageSize = PageSize.a4,
  List<ReceiptLine>? lines,
  ReceiptStamp? stamp,
  Discount? discount,
  VatMode vatMode = VatMode.exclusive,
  Npr? paid,
  String customer = 'Ram Shrestha',
  String? notes,
}) =>
    ReceiptDocument(
      kind: ReceiptKind.invoice,
      number: 'INV-001',
      issueDate: NepaliDate.checked(2082, 5, 10),
      dueDate: NepaliDate.checked(2082, 5, 20),
      business: const Business(
          name: 'Himal Traders',
          address: 'Thamel',
          pan: '123456789',
          vat: '987654321'),
      customer: Party(name: customer),
      lines: lines ??
          [
            ReceiptLine(
                description: 'Rice',
                qtyMilli: 2500,
                unit: 'kg',
                unitPrice: Npr.fromPaisa(15050)),
          ],
      discount: discount,
      vatMode: vatMode,
      paid: paid ?? Npr.zero,
      notes: notes,
      stamp: stamp,
      language: language,
      pageSize: pageSize,
    );

const _plain = ReceiptPdfOptions(compress: false);

/// Text drawn with a built-in font appears as `[(word)]TJ` in the page stream.
String _text(Uint8List bytes) {
  final s = latin1.decode(bytes);
  final out = StringBuffer();
  for (final m
      in RegExp(r'\[((?:\((?:[^()\\]|\\.)*\)|-?[0-9.]+)*)\]TJ').allMatches(s)) {
    final parts = RegExp(r'\(((?:[^()\\]|\\.)*)\)').allMatches(m.group(1)!);
    out.write(parts
        .map((p) =>
            p.group(1)!.replaceAllMapped(RegExp(r'\\(.)'), (e) => e.group(1)!))
        .join());
    out.write(' ');
  }
  return out.toString().replaceAll(RegExp(r'\s+'), ' ');
}

List<double> _mediaBox(Uint8List bytes) {
  final m = RegExp(r'/MediaBox\[([^\]]*)\]').firstMatch(latin1.decode(bytes))!;
  return m.group(1)!.trim().split(RegExp(r'\s+')).map(double.parse).toList();
}

int _pages(Uint8List bytes) =>
    RegExp(r'/Type/Page[^s]').allMatches(latin1.decode(bytes)).length;

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

  group('content', () {
    test('English invoice: real text for names, numbers, totals and words',
        () async {
      final r = await buildReceiptPdf(_doc(), options: _plain);
      final t = _text(r.bytes);
      expect(r.warnings, isEmpty);
      expect(String.fromCharCodes(r.bytes.take(5)), '%PDF-');
      // 2.5 kg x 150.50 = 376.25; VAT 13% = 48.91; total 425.16 (same as the totals vectors).
      for (final s in [
        'Himal Traders',
        'Thamel',
        'PAN: 123456789',
        'VAT No.: 987654321',
        'Invoice',
        'No. INV-001',
        '10 Bhadra 2082 BS (26 August 2025 AD)',
        'Due date: 20 Bhadra 2082 BS',
        'Bill to',
        'Ram Shrestha',
        'Rice',
        '2.5 kg',
        '150.50',
        '376.25',
        'Subtotal',
        'VAT (13%)',
        'Rs. 48.91',
        'Rs. 425.16',
        'Balance',
        'Amount in words',
        'Rupees Four Hundred Twenty-Five and Sixteen Paisa Only',
        'Signature',
      ]) {
        expect(t, contains(s), reason: s);
      }
    });

    test(
        'totals shown match computeTotals for a discount, no VAT and overpayment',
        () async {
      final doc = _doc(
        discount: const Discount.percent(750),
        vatMode: VatMode.none,
        paid: Npr.fromPaisa(100000),
      );
      final totals = computeTotals(doc);
      final t = _text((await buildReceiptPdf(doc, options: _plain)).bytes);
      expect(t, contains('Discount (7.5%)'));
      expect(t, contains('-Rs. 28.22'));
      expect(t, isNot(contains('VAT (')));
      expect(t, isNot(contains('Taxable')));
      expect(t, contains('Overpaid'));
      expect(
          t,
          contains(
              'Rs. ${(totals.balance.negate().paisa / 100).toStringAsFixed(2)}'));
    });

    test('notes and long descriptions are included', () async {
      final t = _text(
          (await buildReceiptPdf(_doc(notes: 'Thank you'), options: _plain))
              .bytes);
      expect(t, contains('Notes'));
      expect(t, contains('Thank you'));
    });

    test('stamps are drawn with transparency', () async {
      for (final (stamp, word) in [
        (ReceiptStamp.paid, 'PAID'),
        (ReceiptStamp.cancelled, 'CANCELLED')
      ]) {
        final r = await buildReceiptPdf(_doc(stamp: stamp), options: _plain);
        expect(_text(r.bytes), contains(word));
        expect(latin1.decode(r.bytes), contains('/ca 0.22'));
      }
      final none = await buildReceiptPdf(_doc(), options: _plain);
      expect(latin1.decode(none.bytes), isNot(contains('/ca 0.22')));
    });

    test('default compression works and hides the text stream', () async {
      final r = await buildReceiptPdf(_doc());
      final plain = await buildReceiptPdf(_doc(), options: _plain);
      expect(String.fromCharCodes(r.bytes.take(5)), '%PDF-');
      expect(_text(r.bytes), isNot(contains('Himal')));
      expect(_text(plain.bytes), contains('Himal'));
    });
  });

  group('page sizes and paging', () {
    test('A4, A5 and 80 mm roll set the page size', () async {
      final a4 =
          _mediaBox((await buildReceiptPdf(_doc(), options: _plain)).bytes);
      final a5 = _mediaBox(
          (await buildReceiptPdf(_doc(pageSize: PageSize.a5), options: _plain))
              .bytes);
      final roll = _mediaBox((await buildReceiptPdf(
              _doc(pageSize: PageSize.roll80),
              options: _plain))
          .bytes);
      expect(a4[2], closeTo(595.28, 0.1));
      expect(a4[3], closeTo(841.89, 0.1));
      expect(a5[2], closeTo(419.53, 0.1));
      expect(a5[3], closeTo(595.28, 0.1));
      expect(roll[2], closeTo(226.77, 0.1)); // 80 mm
      expect(
          roll[3], lessThan(a4[3])); // as tall as the content, not a full sheet
    });

    test('roll80 is one page and has no # column', () async {
      final lines = [
        for (var i = 0; i < 40; i++)
          ReceiptLine(
              description: 'Item $i',
              qtyMilli: 1000,
              unitPrice: Npr.fromPaisa(100 + i))
      ];
      final r = await buildReceiptPdf(
          _doc(pageSize: PageSize.roll80, lines: lines),
          options: _plain);
      expect(_pages(r.bytes), 1);
      expect(_text(r.bytes), contains('Item 39'));
      expect(_text(r.bytes), isNot(contains('# Description')));
      expect(_text((await buildReceiptPdf(_doc(), options: _plain)).bytes),
          contains('# Description'));
    });

    test('many lines flow onto more pages and the header row repeats',
        () async {
      final lines = [
        for (var i = 0; i < 120; i++)
          ReceiptLine(
              description: 'Item $i',
              qtyMilli: 1000 + i,
              unitPrice: Npr.fromPaisa(1000 + i * 7))
      ];
      final r = await buildReceiptPdf(_doc(lines: lines), options: _plain);
      final pages = _pages(r.bytes);
      expect(pages, greaterThan(1));
      final t = _text(r.bytes);
      expect(t, contains('Item 119'));
      expect(RegExp('Description').allMatches(t).length, pages);
      expect(RegExp('Amount in words').allMatches(t).length, 1);
    });
  });

  group('Devanagari (guide 12.4)', () {
    test('without a renderer: English labels, [?] for text, and warnings',
        () async {
      final r = await buildReceiptPdf(
        _doc(language: ReceiptLanguage.ne, customer: 'राम श्रेष्ठ'),
        options: _plain,
      );
      final t = _text(r.bytes);
      expect(r.warnings.length, 2);
      expect(
          r.warnings.any((w) => w.startsWith('DEVANAGARI_LABELS_UNAVAILABLE')),
          isTrue);
      expect(r.warnings.any((w) => w.startsWith('DEVANAGARI_TEXT_UNAVAILABLE')),
          isTrue);
      expect(t, contains('Invoice'));
      expect(t, contains('[?]'));
      expect(
          latin1.decode(r.bytes).runes.any((c) => c >= 0x0900 && c <= 0x097F),
          isFalse);
    });

    test('Latin-only text in a Nepali receipt gives only the label warning',
        () async {
      final r = await buildReceiptPdf(_doc(language: ReceiptLanguage.bilingual),
          options: _plain);
      expect(r.warnings.length, 1);
      expect(r.warnings.single, startsWith('DEVANAGARI_LABELS_UNAVAILABLE'));
    });

    test(
        'English receipt with a Devanagari name and no renderer warns about the text only',
        () async {
      final r = await buildReceiptPdf(_doc(customer: 'राम'), options: _plain);
      expect(r.warnings.length, 1);
      expect(r.warnings.single, startsWith('DEVANAGARI_TEXT_UNAVAILABLE'));
    });

    test('with a renderer: Nepali labels and text become images, no warnings',
        () async {
      final fake = _FakeRenderer();
      final r = await buildReceiptPdf(
        _doc(language: ReceiptLanguage.ne, customer: 'राम श्रेष्ठ'),
        options: ReceiptPdfOptions(renderer: fake, compress: false),
      );
      expect(r.warnings, isEmpty);
      final s = latin1.decode(r.bytes);
      expect(RegExp(r'/Subtype/Image').hasMatch(s), isTrue);
      expect(fake.calls, contains('राम श्रेष्ठ'));
      expect(fake.calls, contains('बिजक')); // the Nepali word for invoice
      // The amount in words is in Nepali, drawn through the renderer, not English text.
      expect(_text(r.bytes), isNot(contains('Rupees')));
      expect(fake.calls, contains('अक्षरमा रकम'));
      expect(fake.calls, contains('चार सय पच्चीस रुपैयाँ सोह्र पैसा मात्र'));
      // Each distinct string is rendered once.
      expect(fake.calls.toSet().length, fake.calls.length);
    });

    test('bilingual with a renderer: Nepali images plus English text and words',
        () async {
      final fake = _FakeRenderer();
      final r = await buildReceiptPdf(
        _doc(language: ReceiptLanguage.bilingual),
        options: ReceiptPdfOptions(renderer: fake, compress: false),
      );
      expect(r.warnings, isEmpty);
      final t = _text(r.bytes);
      expect(fake.calls, contains('बिजक'));
      expect(t, contains('Invoice'));
      expect(t,
          contains('Rupees Four Hundred Twenty-Five and Sixteen Paisa Only'));
    });

    test('English receipt with a renderer renders only the Devanagari text',
        () async {
      final fake = _FakeRenderer();
      await buildReceiptPdf(
        _doc(customer: 'राम'),
        options: ReceiptPdfOptions(renderer: fake, compress: false),
      );
      expect(fake.calls, ['राम']);
    });
  });

  group('errors', () {
    test('an invalid document throws the same typed error as computeTotals',
        () async {
      await expectLater(
        buildReceiptPdf(_doc(lines: const [])),
        throwsA(isA<ReceiptException>()
            .having((e) => e.code, 'code', ReceiptErrorCode.noLines)),
      );
    });

    test('a sum that is too large throws MoneyException', () async {
      final big = Npr.fromPaisa(9007199254740991);
      await expectLater(
        buildReceiptPdf(_doc(lines: [
          ReceiptLine(description: 'a', qtyMilli: 1000, unitPrice: big),
          ReceiptLine(description: 'b', qtyMilli: 1000, unitPrice: big),
        ])),
        throwsA(isA<MoneyException>()),
      );
    });
  });
}
