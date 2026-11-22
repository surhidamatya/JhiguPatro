import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
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

  /// What the preview asked to draw: the PDF bytes of each `raster` call.
  final rasters = <Uint8List>[];

  @override
  Future<PrintingInfo> info() async =>
      const PrintingInfo(canPrint: true, canShare: true, canRaster: true);

  @override
  Stream<PdfRaster> raster(Uint8List document, List<int>? pages, double dpi) {
    rasters.add(document);
    return const Stream.empty();
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

  group('JhiguReceiptPreview', () {
    Future<void> show(
      WidgetTester t,
      Widget preview, {
      bool settle = true,
    }) async {
      await t.pumpWidget(MaterialApp(
        home: Scaffold(body: SizedBox(height: 700, width: 500, child: preview)),
      ));
      if (settle) {
        // The PDF is built on a real event loop, not on the test's fake clock.
        await t.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 300)));
        await t.pump();
      }
    }

    PdfPreview pdfPreview(WidgetTester t) =>
        t.widget<PdfPreview>(find.byType(PdfPreview));

    testWidgets(
        'shows a PdfPreview at the receipt paper with no format controls',
        (t) async {
      await show(t, JhiguReceiptPreview(doc: _doc(pageSize: PageSize.a5)));
      final p = pdfPreview(t);
      expect(p.initialPageFormat, PdfPageFormat.a5);
      expect(p.canChangePageFormat, isFalse);
      expect(p.canChangeOrientation, isFalse);
      expect(p.canDebug, isFalse);
      expect(p.dynamicLayout, isFalse);
      expect(p.allowPrinting, isTrue);
      expect(p.allowSharing, isTrue);
    });

    testWidgets('the paper follows the receipt: A4 and the 80 mm roll too',
        (t) async {
      await show(t, JhiguReceiptPreview(doc: _doc(pageSize: PageSize.roll80)));
      expect(pdfPreview(t).initialPageFormat, PdfPageFormat.roll80);
      await show(t, JhiguReceiptPreview(doc: _doc()));
      expect(pdfPreview(t).initialPageFormat, PdfPageFormat.a4);
    });

    testWidgets('the file name is safe by default and can be set', (t) async {
      await show(t, JhiguReceiptPreview(doc: _doc(number: '2082/83-001')));
      expect(pdfPreview(t).pdfFileName, '2082_83-001.pdf');
      await show(t, JhiguReceiptPreview(doc: _doc(), fileName: 'bill.pdf'));
      expect(pdfPreview(t).pdfFileName, 'bill.pdf');
    });

    testWidgets('printing, sharing and the page width are passed on',
        (t) async {
      await show(
          t,
          JhiguReceiptPreview(
              doc: _doc(),
              allowPrinting: false,
              allowSharing: false,
              maxPageWidth: 320));
      final p = pdfPreview(t);
      expect(p.allowPrinting, isFalse);
      expect(p.allowSharing, isFalse);
      expect(p.maxPageWidth, 320);
    });

    testWidgets(
        'the PDF it draws is the receipt, and any paper gets the same file',
        (t) async {
      final calls = <String>[];
      await show(
          t,
          JhiguReceiptPreview(
              doc: _doc(language: ReceiptLanguage.ne, customer: 'राम'),
              renderer: _Recording(calls)));
      await t.runAsync(() async {
        final p = pdfPreview(t);
        final a = await p.build(PdfPageFormat.a4);
        final b =
            await p.build(PdfPageFormat.roll80); // any paper: the same PDF
        expect(String.fromCharCodes(a.sublist(0, 5)), '%PDF-');
        expect(b, a);
        // What the preview handed to the rasterizer is that same file.
        for (var i = 0; i < 10 && fake.rasters.isEmpty; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 100));
          await t.pump(const Duration(milliseconds: 100));
        }
        expect(fake.rasters, isNotEmpty);
        expect(fake.rasters.first, a);
      });
      expect(calls, isNotEmpty);
    });

    testWidgets('the same document instance is not built again on a rebuild',
        (t) async {
      final calls = <String>[];
      final renderer = _Recording(calls);
      final doc = _doc(language: ReceiptLanguage.ne, customer: 'राम');
      late StateSetter set;
      await t.pumpWidget(MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(builder: (c, setState) {
            set = setState;
            return SizedBox(
                height: 700,
                width: 500,
                child: JhiguReceiptPreview(doc: doc, renderer: renderer));
          }),
        ),
      ));
      await t.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 300)));
      await t.pump();
      final first = calls.length;
      expect(first, greaterThan(0));
      set(() {});
      await t.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 200)));
      await t.pump();
      expect(calls.length, first);
    });

    testWidgets('a different document is built and shown', (t) async {
      final calls = <String>[];
      final renderer = _Recording(calls);
      await show(
          t,
          JhiguReceiptPreview(
              doc: _doc(language: ReceiptLanguage.ne, customer: 'राम'),
              renderer: renderer));
      expect(calls, contains('राम'));
      await show(
          t,
          JhiguReceiptPreview(
              doc: _doc(language: ReceiptLanguage.ne, customer: 'सीता'),
              renderer: renderer));
      expect(calls, contains('सीता'));
      await t.runAsync(() async {
        final bytes = await pdfPreview(t).build(PdfPageFormat.a4);
        expect(String.fromCharCodes(bytes.sublist(0, 5)), '%PDF-');
      });
    });

    testWidgets('a different renderer for the same document builds again',
        (t) async {
      final one = <String>[];
      final two = <String>[];
      final doc = _doc(language: ReceiptLanguage.ne, customer: 'राम');
      await show(t, JhiguReceiptPreview(doc: doc, renderer: _Recording(one)));
      expect(one, isNotEmpty);
      await show(t, JhiguReceiptPreview(doc: doc, renderer: _Recording(two)));
      expect(two, isNotEmpty);
    });

    testWidgets('warnings are reported, and the preview still builds',
        (t) async {
      List<String>? seen;
      await show(
          t,
          JhiguReceiptPreview(
              doc: _doc(language: ReceiptLanguage.ne, customer: 'राम'),
              renderer: _FailingRenderer(),
              onWarnings: (w) => seen = w));
      expect(seen, isNotNull);
      expect(seen!.join(' '), contains('DevanagariRenderException'));
      await t.runAsync(() async {
        final bytes = await pdfPreview(t).build(PdfPageFormat.a4);
        expect(String.fromCharCodes(bytes.sublist(0, 5)), '%PDF-');
      });
    });

    testWidgets('onPrinted, onShared and the error builder are passed on',
        (t) async {
      var printed = 0;
      var shared = 0;
      Widget err(BuildContext c, Object e) => const Text('oops');
      await show(
          t,
          JhiguReceiptPreview(
              doc: _doc(),
              onPrinted: () => printed++,
              onShared: () => shared++,
              errorBuilder: err));
      final p = pdfPreview(t);
      p.onPrinted!(t.element(find.byType(PdfPreview)));
      p.onShared!(t.element(find.byType(PdfPreview)));
      expect(printed, 1);
      expect(shared, 1);
      expect(p.onError, same(err));
    });

    testWidgets('no callbacks given means none are installed', (t) async {
      await show(t, JhiguReceiptPreview(doc: _doc()));
      final p = pdfPreview(t);
      expect(p.onPrinted, isNull);
      expect(p.onShared, isNull);
      expect(p.onError, isNull);
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
