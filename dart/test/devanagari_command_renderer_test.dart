import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:jhigu_patro_utils/devanagari_command_renderer.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:jhigu_patro_utils/receipt_pdf.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _cal = _read('../data/nepali_calendar_data.json');
final Map<int, List<int>> _years = (_cal['years'] as Map<String, dynamic>).map(
  (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
);

/// A PNG header with the given size (enough for pngSize; not a decodable image).
Uint8List _fakePng(int w, int h) {
  final b = ByteData(24);
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (var i = 0; i < 8; i++) {
    b.setUint8(i, sig[i]);
  }
  b.setUint32(16, w);
  b.setUint32(20, h);
  return b.buffer.asUint8List();
}

final Uint8List _tinyPng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);

ReceiptDocument _doc(
        {String customer = 'राम श्रेष्ठ',
        ReceiptLanguage language = ReceiptLanguage.ne}) =>
    ReceiptDocument(
      kind: ReceiptKind.invoice,
      number: 'INV-001',
      issueDate: NepaliDate.checked(2082, 5, 10),
      business: const Business(name: 'Himal Traders'),
      customer: Party(name: customer),
      lines: [
        ReceiptLine(
            description: 'Rice',
            qtyMilli: 1000,
            unitPrice: Npr.fromPaisa(10000)),
      ],
      vatMode: VatMode.none,
      paid: Npr.zero,
      language: language,
      pageSize: PageSize.a4,
    );

bool get _haveRsvg {
  try {
    return Process.runSync('rsvg-convert', ['--version']).exitCode == 0;
  } on ProcessException {
    return false;
  }
}

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

  group('svg and runner', () {
    test(
        'the SVG escapes text and font, sets weight, colour, size and fixed height',
        () {
      final r = CommandDevanagariRenderer(fontFamily: "'A&B', serif");
      final svg = r.svgFor('राम <b> & "x"',
          fontSize: 10, bold: true, color: 0x80FF0000);
      expect(svg, contains('राम &lt;b&gt; &amp; &quot;x&quot;'));
      expect(svg, contains('font-family="\'A&amp;B\', serif"'));
      expect(svg, contains('font-weight="bold"'));
      expect(svg, contains('fill="#ff0000"'));
      expect(svg, contains('fill-opacity="0.502"'));
      expect(svg, contains('font-size="10.0"'));
      expect(svg, contains('height="16.0"')); // 1.6 x font size
      expect(svg, contains('y="10.0"')); // baseline at 1.0 x font size
      expect(svg, isNot(contains('<b>')));
    });

    test('runs the program with the scale filled in, text only on stdin',
        () async {
      String? exe;
      List<String>? args;
      String? stdinText;
      final r = CommandDevanagariRenderer(
        executable: 'my-render',
        arguments: const ['--png', '--zoom={scale}'],
        scale: 4,
        runner: (e, a, stdin) async {
          exe = e;
          args = a;
          stdinText = utf8.decode(stdin);
          return _fakePng(200, 64);
        },
      );
      final out = await r.render('नमस्ते',
          fontSize: 10, bold: false, color: 0xFF111111);
      expect(exe, 'my-render');
      expect(args, ['--png', '--zoom=4.0']);
      expect(stdinText, contains('नमस्ते'));
      expect(args!.join(' '), isNot(contains('नमस्ते')));
      expect(out.widthPt, 50); // 200 px / 4
      expect(out.heightPt, 16); // 64 px / 4
    });

    test('output that is not a PNG is an error', () async {
      final r = CommandDevanagariRenderer(
          runner: (_, __, ___) async => Uint8List.fromList([1, 2, 3]));
      await expectLater(
          r.render('x', fontSize: 10, bold: false, color: 0xFF000000),
          throwsA(isA<DevanagariRenderException>()));
    });

    test(
        'a missing program is a typed error that names the program, not the text',
        () async {
      final r = CommandDevanagariRenderer(
          executable: 'definitely-not-a-real-program-xyz');
      try {
        await r.render('गोप्य', fontSize: 10, bold: false, color: 0xFF000000);
        fail('should throw');
      } on DevanagariRenderException catch (e) {
        expect(e.message, contains('definitely-not-a-real-program-xyz'));
        expect(e.message, isNot(contains('गोप्य')));
      }
    });

    test('a bad scale is refused', () {
      expect(() => CommandDevanagariRenderer(scale: 0), throwsArgumentError);
    });

    test('pngSize reads dimensions and rejects other data', () {
      expect(pngSize(_fakePng(7, 9)), (width: 7, height: 9));
      expect(pngSize(Uint8List(30)), isNull);
      expect(pngSize(Uint8List(5)), isNull);
    });
  });

  group('inside the PDF builder', () {
    test(
        'a failing renderer falls back to [?] with a warning and still makes a PDF',
        () async {
      final r = CommandDevanagariRenderer(
          runner: (_, __, ___) async =>
              throw const DevanagariRenderException('boom'));
      final out = await buildReceiptPdf(_doc(),
          options: ReceiptPdfOptions(renderer: r, compress: false));
      expect(out.bytes.length, greaterThan(500));
      expect(out.warnings.length, 1);
      expect(out.warnings.single, startsWith('DEVANAGARI_RENDER_FAILED'));
      expect(out.warnings.single, contains('DevanagariRenderException'));
      expect(latin1.decode(out.bytes), contains('[?]'));
    });

    test('a good renderer gives images and no warnings', () async {
      final r =
          CommandDevanagariRenderer(runner: (_, __, ___) async => _tinyPng);
      final out = await buildReceiptPdf(_doc(),
          options: ReceiptPdfOptions(renderer: r, compress: false));
      expect(out.warnings, isEmpty);
      expect(latin1.decode(out.bytes), contains('/Subtype/Image'));
    });
  });

  group('real rsvg-convert', () {
    final skip = _haveRsvg ? null : 'rsvg-convert is not installed';

    test('renders Devanagari to a transparent PNG of fixed height', () async {
      final r = CommandDevanagariRenderer();
      final a =
          await r.render('राम', fontSize: 10, bold: false, color: 0xFF111111);
      final b = await r.render('श्रेष्ठ ज्ञ',
          fontSize: 10, bold: false, color: 0xFF111111);
      expect(pngSize(a.png), isNotNull);
      expect(
          a.heightPt, closeTo(16, 0.5)); // 1.6 x font size, the same for both
      expect(b.heightPt, a.heightPt);
      expect(b.widthPt, greaterThan(a.widthPt));
      expect(a.widthPt, greaterThan(5));
    }, skip: skip);

    test('a Nepali receipt gets real shaped text as images and no warnings',
        () async {
      final out = await buildReceiptPdf(
        _doc(customer: 'राम श्रेष्ठ'),
        options: ReceiptPdfOptions(
            renderer: CommandDevanagariRenderer(), compress: false),
      );
      expect(out.warnings, isEmpty);
      final s = latin1.decode(out.bytes);
      expect(RegExp('/Subtype/Image').allMatches(s).length, greaterThan(5));
      expect(s, isNot(contains('[?]')));
    }, skip: skip);
  });
}
