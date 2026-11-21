import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:jhigu_patro_flutter/receipt_print.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:printing/printing.dart';
// The platform interface is not in the public exports; the plugin's own tests
// replace it the same way.
// ignore: implementation_imports
import 'package:printing/src/interface.dart' show PrintingPlatform;

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

/// Records what the app asked the platform to do.
class _FakePrinting extends PrintingPlatform {
  final layouts = <({
    String name,
    PdfPageFormat format,
    bool dynamicLayout,
    Uint8List bytes
  })>[];
  final shares = <({
    Uint8List bytes,
    String filename,
    Rect bounds,
    String? subject,
    String? body
  })>[];
  LayoutCallback? lastOnLayout;
  bool result = true;

  @override
  Future<bool> layoutPdf(
    Printer? printer,
    LayoutCallback onLayout,
    String name,
    PdfPageFormat format,
    bool dynamicLayout,
    bool usePrinterSettings,
    OutputType outputType,
    bool forceCustomPrintPaper,
    bool windowsModernDialog,
  ) async {
    lastOnLayout = onLayout;
    final bytes = await onLayout(format);
    layouts.add((
      name: name,
      format: format,
      dynamicLayout: dynamicLayout,
      bytes: bytes
    ));
    return result;
  }

  @override
  Future<bool> sharePdf(Uint8List bytes, String filename, Rect bounds,
      String? subject, String? body, List<String>? emails) async {
    shares.add((
      bytes: bytes,
      filename: filename,
      bounds: bounds,
      subject: subject,
      body: body
    ));
    return result;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} is not faked');
}

ReceiptDocument _doc({
  String number = 'INV-001',
  PageSize pageSize = PageSize.a4,
  ReceiptLanguage language = ReceiptLanguage.en,
  String customer = 'Ram Shrestha',
}) =>
    ReceiptDocument(
      kind: ReceiptKind.invoice,
      number: number,
      issueDate: NepaliDate.checked(2082, 5, 10),
      business: const Business(name: 'Himal Traders', address: 'Thamel'),
      customer: Party(name: customer),
      lines: [
        ReceiptLine(
            description: 'Rice',
            qtyMilli: 2500,
            unit: 'kg',
            unitPrice: Npr.fromPaisa(15050)),
      ],
      vatMode: VatMode.exclusive,
      paid: Npr.zero,
      language: language,
      pageSize: pageSize,
    );

class _FailingRenderer implements DevanagariRenderer {
  @override
  Future<RenderedText> render(String text,
          {required double fontSize,
          required bool bold,
          required int color}) async =>
      throw const DevanagariRenderException('boom');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _FakePrinting fake;

  setUpAll(() {
    final cal = _read('../data/nepali_calendar_data.json');
    NepaliCalendar.initialize(InlineCalendarDataSource(
      years: (cal['years'] as Map<String, dynamic>)
          .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
      supportedStartYear: cal['supportedRange']['start'] as int,
      supportedEndYear: cal['supportedRange']['end'] as int,
      verifiedThrough: cal['verifiedThrough'] as int,
    ));
  });

  setUp(() {
    fake = _FakePrinting();
    PrintingPlatform.instance = fake;
  });

  group('helpers', () {
    test('page format follows the receipt size', () {
      expect(receiptPageFormat(PageSize.a4), PdfPageFormat.a4);
      expect(receiptPageFormat(PageSize.a5), PdfPageFormat.a5);
      expect(receiptPageFormat(PageSize.roll80), PdfPageFormat.roll80);
    });

    test('file name is the number, made safe, plus .pdf', () {
      expect(receiptFileName(_doc(number: 'INV-001')), 'INV-001.pdf');
      expect(receiptFileName(_doc(number: '2082/83-001')), '2082_83-001.pdf');
      expect(receiptFileName(_doc(number: 'a b:c')), 'a_b_c.pdf');
      expect(receiptFileName(_doc(number: '../x')), '.._x.pdf');
      expect(receiptFileName(_doc(number: '')), 'receipt.pdf');
    });
  });

  group('printReceipt', () {
    testWidgets('sends a PDF to the print dialog with the receipt size',
        (t) async {
      await t.runAsync(() async {
        final ok = await printReceipt(_doc(pageSize: PageSize.a5));
        expect(ok, isTrue);
        expect(fake.layouts, hasLength(1));
        final call = fake.layouts.single;
        expect(String.fromCharCodes(call.bytes.sublist(0, 5)), '%PDF-');
        expect(call.format, PdfPageFormat.a5);
        expect(call.name, 'INV-001');
        expect(call.dynamicLayout, isFalse);
      });
    });

    testWidgets('the same bytes come back whatever paper the dialog offers',
        (t) async {
      await t.runAsync(() async {
        await printReceipt(_doc());
        // Our PDF is laid out for its own size; the dialog must not reflow it.
        final first = fake.layouts.single.bytes;
        final again = await fake.lastOnLayout!(PdfPageFormat.roll80);
        expect(again, first);
      });
    });

    testWidgets('jobName overrides the receipt number', (t) async {
      await t.runAsync(() async {
        await printReceipt(_doc(), jobName: 'Counter 2');
        expect(fake.layouts.single.name, 'Counter 2');
      });
    });

    testWidgets('returns false when the user cancels', (t) async {
      await t.runAsync(() async {
        fake.result = false;
        expect(await printReceipt(_doc()), isFalse);
      });
    });
  });

  group('shareReceipt', () {
    testWidgets('shares a PDF under the safe file name', (t) async {
      await t.runAsync(() async {
        final ok = await shareReceipt(_doc(number: '2082/83-001'));
        expect(ok, isTrue);
        final s = fake.shares.single;
        expect(String.fromCharCodes(s.bytes.sublist(0, 5)), '%PDF-');
        expect(s.filename, '2082_83-001.pdf');
      });
    });

    testWidgets('filename, subject, body and bounds are passed on', (t) async {
      await t.runAsync(() async {
        const bounds = Rect.fromLTWH(10, 20, 30, 40);
        await shareReceipt(_doc(),
            filename: 'bill.pdf',
            subject: 'Your bill',
            body: 'Thanks',
            bounds: bounds);
        final s = fake.shares.single;
        expect(s.filename, 'bill.pdf');
        expect(s.subject, 'Your bill');
        expect(s.body, 'Thanks');
        expect(s.bounds, bounds);
      });
    });

    testWidgets('returns false when the share is cancelled', (t) async {
      await t.runAsync(() async {
        fake.result = false;
        expect(await shareReceipt(_doc()), isFalse);
      });
    });
  });

  group('Nepali text and warnings', () {
    testWidgets(
        'a Nepali receipt is drawn with the Flutter renderer: no warnings',
        (t) async {
      await t.runAsync(() async {
        List<String>? seen;
        await shareReceipt(
            _doc(language: ReceiptLanguage.ne, customer: 'राम श्रेष्ठ'),
            onWarnings: (w) => seen = w);
        expect(
            seen, isNull); // onWarnings is only called when there is something
        expect(fake.shares.single.bytes.length, greaterThan(2000));
      });
    });

    testWidgets('a renderer that fails still gives a PDF and reports warnings',
        (t) async {
      await t.runAsync(() async {
        List<String>? seen;
        await printReceipt(
            _doc(language: ReceiptLanguage.ne, customer: 'राम श्रेष्ठ'),
            renderer: _FailingRenderer(),
            onWarnings: (w) => seen = w);
        expect(fake.layouts, hasLength(1));
        expect(seen, isNotNull);
        expect(seen!.join(' '), contains('DevanagariRenderException'));
      });
    });

    testWidgets('your renderer is used instead of the Flutter one', (t) async {
      await t.runAsync(() async {
        final calls = <String>[];
        await buildReceiptPdfWithFlutter(
          _doc(language: ReceiptLanguage.ne, customer: 'राम'),
          renderer: _Recording(calls),
        );
        expect(calls, contains('राम'));
      });
    });

    testWidgets('an English receipt asks for no pictures', (t) async {
      await t.runAsync(() async {
        final calls = <String>[];
        await buildReceiptPdfWithFlutter(_doc(), renderer: _Recording(calls));
        expect(calls, isEmpty);
      });
    });
  });
}

class _Recording implements DevanagariRenderer {
  final List<String> calls;
  _Recording(this.calls);
  @override
  Future<RenderedText> render(String text,
      {required double fontSize,
      required bool bold,
      required int color}) async {
    calls.add(text);
    // A valid 1x1 PNG.
    return RenderedText(
      png: base64Decode(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
      widthPt: 20,
      heightPt: 12,
    );
  }
}
