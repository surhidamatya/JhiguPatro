import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jhigu_patro_flutter/jhigu_patro_flutter.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:jhigu_patro_utils/receipt_pdf.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

/// RGBA pixels and size of a PNG.
Future<({int w, int h, Uint8List rgba})> _decode(Uint8List png) async {
  final codec = await ui.instantiateImageCodec(png);
  final frame = await codec.getNextFrame();
  final data = await frame.image.toByteData(format: ui.ImageByteFormat.rawRgba);
  final r = (
    w: frame.image.width,
    h: frame.image.height,
    rgba: data!.buffer.asUint8List(),
  );
  frame.image.dispose();
  codec.dispose();
  return r;
}

/// Bounding box of the pixels that are not fully transparent, or null.
({int top, int bottom, int left, int right})? _ink(
    ({int w, int h, Uint8List rgba}) img) {
  int top = img.h, bottom = -1, left = img.w, right = -1;
  for (var y = 0; y < img.h; y++) {
    for (var x = 0; x < img.w; x++) {
      if (img.rgba[(y * img.w + x) * 4 + 3] > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return bottom < 0
      ? null
      : (top: top, bottom: bottom, left: left, right: right);
}

/// A Devanagari font to test real shaping with, or null. Set
/// JHIGU_DEVANAGARI_FONT to a .ttf, or install Noto Sans Devanagari where
/// Linux puts it (CI does: package fonts-noto-core).
String? _fontPath() {
  final candidates = [
    Platform.environment['JHIGU_DEVANAGARI_FONT'],
    '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf',
  ];
  for (final c in candidates) {
    if (c != null && c.isNotEmpty && File(c).existsSync()) return c;
  }
  return null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const scale = 290 / 72;

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

  group('the picture (test font: every glyph is a 1 em square)', () {
    final r = FlutterDevanagariRenderer();

    testWidgets('is a PNG sized from the text and the font size', (t) async {
      await t.runAsync(() async {
        final out =
            await r.render('भदौ', fontSize: 10, bold: false, color: 0xFF112233);
        expect(out.png.sublist(0, 8),
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        final img = await _decode(out.png);
        // Height is 1.6 times the font size, in pixels at 290 dpi.
        expect(img.h, (10 * 1.6 * scale).ceil());
        expect(out.heightPt, closeTo(img.h / scale, 1e-9));
        expect(out.widthPt, closeTo(img.w / scale, 1e-9));
        // Three characters, one em each in the test font.
        expect(img.w, closeTo(3 * 10 * scale, 2));
      });
    });

    testWidgets('longer text is wider and a bigger size is bigger', (t) async {
      await t.runAsync(() async {
        final a =
            await r.render('अ', fontSize: 10, bold: false, color: 0xFF000000);
        final b = await r.render('अअअअ',
            fontSize: 10, bold: false, color: 0xFF000000);
        final c =
            await r.render('अ', fontSize: 20, bold: false, color: 0xFF000000);
        expect(b.widthPt, greaterThan(a.widthPt * 3.5));
        expect(c.widthPt, closeTo(a.widthPt * 2, 0.5));
        expect(c.heightPt, closeTo(a.heightPt * 2, 0.5));
      });
    });

    testWidgets('empty text is a valid one-pixel-wide picture', (t) async {
      await t.runAsync(() async {
        final out =
            await r.render('', fontSize: 10, bold: false, color: 0xFF000000);
        final img = await _decode(out.png);
        expect(img.w, 1);
        expect(_ink(img), isNull);
      });
    });

    testWidgets('is transparent, in the colour asked for, with its alpha',
        (t) async {
      await t.runAsync(() async {
        final out =
            await r.render('अ', fontSize: 10, bold: false, color: 0x80FF0000);
        final img = await _decode(out.png);
        var solid = 0;
        for (var i = 0; i < img.rgba.length; i += 4) {
          final a = img.rgba[i + 3];
          if (a == 0) continue;
          // Soft edge pixels are blended; the body of the glyph has the full
          // colour and the alpha that was asked for (about 0x80).
          if (a < 120) continue;
          solid++;
          // The engine gives premultiplied pixels: divide the alpha back out.
          expect(img.rgba[i] * 255 / a, greaterThan(230)); // red
          expect(img.rgba[i + 1] * 255 / a, lessThan(20));
          expect(img.rgba[i + 2] * 255 / a, lessThan(20));
          expect(a, inInclusiveRange(120, 136));
        }
        expect(solid, greaterThan(0));
        // The corner outside the glyph's em box above the ink is transparent.
        expect(img.rgba[3], 0);
      });
    });

    testWidgets('the baseline sits at 1.0 times the font size', (t) async {
      await t.runAsync(() async {
        final out =
            await r.render('अ', fontSize: 10, bold: false, color: 0xFF000000);
        final ink = _ink(await _decode(out.png))!;
        // The test font's square sits on the baseline and is 0.8 em tall, so its
        // bottom edge is at 1.0 em and its top at 0.2 em.
        expect(ink.bottom, closeTo(10 * scale, 2));
        expect(ink.top, closeTo(0.2 * 10 * scale, 2));
      });
    });

    testWidgets('the user text scale does not change the picture', (t) async {
      await t.runAsync(() async {
        final normal =
            await r.render('अअ', fontSize: 10, bold: false, color: 0xFF000000);
        t.platformDispatcher.textScaleFactorTestValue = 2.0;
        addTearDown(t.platformDispatcher.clearAllTestValues);
        final scaled =
            await r.render('अअ', fontSize: 10, bold: false, color: 0xFF000000);
        expect(scaled.widthPt, normal.widthPt);
        expect(scaled.heightPt, normal.heightPt);
      });
    });

    testWidgets('a custom scale changes the pixels but not the size in points',
        (t) async {
      await t.runAsync(() async {
        final lo = await FlutterDevanagariRenderer(scale: 2)
            .render('अ', fontSize: 10, bold: false, color: 0xFF000000);
        final hi = await FlutterDevanagariRenderer(scale: 8)
            .render('अ', fontSize: 10, bold: false, color: 0xFF000000);
        expect(hi.png.length, isNot(lo.png.length));
        expect(hi.widthPt, closeTo(lo.widthPt, 0.5));
        expect(hi.heightPt, closeTo(lo.heightPt, 0.5));
      });
    });

    test('bad arguments', () async {
      expect(() => FlutterDevanagariRenderer(scale: 0), throwsArgumentError);
      expect(() => FlutterDevanagariRenderer(scale: -1), throwsArgumentError);
      await expectLater(
          r.render('अ', fontSize: 0, bold: false, color: 0xFF000000),
          throwsA(isA<DevanagariRenderException>()));
      await expectLater(
          r.render('अ', fontSize: double.nan, bold: false, color: 0xFF000000),
          throwsA(isA<DevanagariRenderException>()));
    });
  });

  group('in a receipt PDF', () {
    ReceiptDocument doc(String customer) => ReceiptDocument(
          kind: ReceiptKind.invoice,
          number: 'INV-001',
          issueDate: NepaliDate.checked(2082, 5, 10),
          business: const Business(name: 'Himal Traders', address: 'Thamel'),
          customer: Party(name: customer),
          lines: [
            ReceiptLine(
                description: 'चामल',
                qtyMilli: 2500,
                unit: 'kg',
                unitPrice: Npr.fromPaisa(15050)),
          ],
          vatMode: VatMode.exclusive,
          paid: Npr.zero,
          language: ReceiptLanguage.ne,
          pageSize: PageSize.a4,
        );

    testWidgets('Nepali text becomes images and there are no warnings',
        (t) async {
      await t.runAsync(() async {
        final out = await buildReceiptPdf(
          doc('राम श्रेष्ठ'),
          options: ReceiptPdfOptions(
              renderer: FlutterDevanagariRenderer(), compress: false),
        );
        expect(out.warnings, isEmpty);
        final s = latin1.decode(out.bytes);
        expect(s, startsWith('%PDF'));
        expect(RegExp(r'/Subtype/Image').allMatches(s).length, greaterThan(3));
      });
    });

    testWidgets('without a renderer the same receipt warns instead', (t) async {
      await t.runAsync(() async {
        final out = await buildReceiptPdf(doc('राम श्रेष्ठ'),
            options: const ReceiptPdfOptions(compress: false));
        expect(out.warnings, isNotEmpty);
      });
    });
  });

  final font = _fontPath();
  group('with a real Devanagari font', () {
    setUpAll(() async {
      final bytes = File(font!).readAsBytesSync();
      final loader = FontLoader('TestDevanagari')
        ..addFont(Future.value(ByteData.sublistView(bytes)));
      await loader.load();
    });

    final r = FlutterDevanagariRenderer(fontFamily: 'TestDevanagari');

    Future<({int w, int h, Uint8List rgba})> draw(String text) async {
      final out =
          await r.render(text, fontSize: 20, bold: false, color: 0xFF000000);
      return _decode(out.png);
    }

    testWidgets('shapes: width is not one em per character', (t) async {
      await t.runAsync(() async {
        final img = await draw('भदौ २०८२');
        // The test font gives every character one em; a real font does not.
        expect(img.w, isNot(closeTo(8 * 20 * scale, 20)));
        expect(_ink(img), isNotNull);
      });
    });

    testWidgets('joins a conjunct: क्ष is narrower than its parts', (t) async {
      await t.runAsync(() async {
        final joined = await draw('क्ष');
        final ka = await draw('क');
        final ssa = await draw('ष');
        // Unshaped, it would be ka + a visible virama + ssa.
        expect(joined.w, lessThan(ka.w + ssa.w));
      });
    });

    testWidgets(
        'the baseline holds with real glyphs: ink stays inside the picture',
        (t) async {
      await t.runAsync(() async {
        final img = await draw('श्रेष्ठ');
        final ink = _ink(img)!;
        expect(ink.top, greaterThanOrEqualTo(0));
        expect(ink.bottom, lessThan(img.h));
        // The headline (shirorekha) is in the upper part, the body below it.
        expect(ink.top, lessThan(img.h * 0.5));
      });
    });

    testWidgets('bold is a different, wider-or-heavier picture', (t) async {
      await t.runAsync(() async {
        final plain = await r.render('श्रेष्ठ',
            fontSize: 20, bold: false, color: 0xFF000000);
        final bold = await r.render('श्रेष्ठ',
            fontSize: 20, bold: true, color: 0xFF000000);
        expect(bold.png, isNot(plain.png));
      });
    });

    testWidgets('the family you name is the one used', (t) async {
      await t.runAsync(() async {
        final named =
            await FlutterDevanagariRenderer(fontFamily: 'TestDevanagari')
                .render('भदौ', fontSize: 20, bold: false, color: 0xFF000000);
        final other = await FlutterDevanagariRenderer(
                fontFamily: 'NoSuchFamily', fontFamilyFallback: const [])
            .render('भदौ', fontSize: 20, bold: false, color: 0xFF000000);
        expect(named.widthPt, isNot(closeTo(other.widthPt, 1)));
      });
    });

    testWidgets('a receipt with the real font has no warnings', (t) async {
      await t.runAsync(() async {
        final out = await buildReceiptPdf(
          ReceiptDocument(
            kind: ReceiptKind.invoice,
            number: 'INV-002',
            issueDate: NepaliDate.checked(2082, 5, 10),
            business: const Business(name: 'हिमाल ट्रेडर्स', address: 'ठमेल'),
            customer: const Party(name: 'राम श्रेष्ठ'),
            lines: [
              ReceiptLine(
                  description: 'चामल',
                  qtyMilli: 1000,
                  unit: 'kg',
                  unitPrice: Npr.fromPaisa(10000)),
            ],
            vatMode: VatMode.none,
            paid: Npr.zero,
            language: ReceiptLanguage.ne,
            pageSize: PageSize.a4,
          ),
          options: ReceiptPdfOptions(renderer: r),
        );
        expect(out.warnings, isEmpty);
        expect(out.bytes.length, greaterThan(2000));
      });
    });
  },
      skip: font == null
          ? 'set JHIGU_DEVANAGARI_FONT to a Devanagari .ttf'
          : null);
}
