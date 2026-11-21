import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:jhigu_patro_utils/receipt_pdf.dart';

/// A [DevanagariRenderer] for PDF receipts that draws Nepali text with Flutter's
/// own text engine (guide R-6). The PDF library cannot shape Devanagari, so
/// [buildReceiptPdf] asks a renderer for a picture of each string; Flutter
/// shapes it with HarfBuzz through the same fonts your app already uses.
///
/// ```dart
/// import 'package:jhigu_patro_utils/receipt_pdf.dart';
/// import 'package:jhigu_patro_flutter/jhigu_patro_flutter.dart';
///
/// final pdf = await buildReceiptPdf(
///   doc,
///   options: ReceiptPdfOptions(renderer: FlutterDevanagariRenderer()),
/// );
/// // pdf.bytes, pdf.warnings
/// ```
///
/// Works on every Flutter platform, the web included (the PDF library has no
/// `dart:io`). It needs a Devanagari font. Android, iOS, macOS and the web fall
/// back to a system or downloaded one when the family is not found; to be sure of
/// the look, bundle a font such as Noto Sans Devanagari in your app and name it in
/// [fontFamily]. This package does not ship one. If the platform has no font for
/// Devanagari at all, the glyphs come out as empty boxes and nothing here can tell,
/// so check a sample receipt on each platform you ship.
///
/// The picture is transparent. Its height is 1.6 times the font size with the
/// baseline at 1.0 times, the same as the command renderer, so Nepali text lines up
/// in table rows. Text size follows [fontSize] only, never the user's text scale
/// setting.
class FlutterDevanagariRenderer implements DevanagariRenderer {
  /// The font family to ask for first. Default: the platform's own.
  final String? fontFamily;

  /// Families to try when [fontFamily] does not cover a character.
  final List<String> fontFamilyFallback;

  /// The package that holds [fontFamily], when it comes from one.
  final String? package;

  /// Pixels per PDF point of the picture. Default 290 / 72 (about 290 dpi).
  final double scale;

  FlutterDevanagariRenderer({
    this.fontFamily,
    this.fontFamilyFallback = const [
      'Noto Sans Devanagari',
      'Kohinoor Devanagari',
      'Devanagari Sangam MN',
      'Mangal',
    ],
    this.package,
    this.scale = 290 / 72,
  }) {
    if (!(scale > 0)) throw ArgumentError('scale must be positive');
  }

  @override
  Future<RenderedText> render(
    String text, {
    required double fontSize,
    required bool bold,
    required int color,
  }) async {
    if (!(fontSize > 0)) {
      throw const DevanagariRenderException('font size must be positive');
    }
    try {
      final style = TextStyle(
        fontSize: fontSize * scale,
        fontWeight: bold ? FontWeight.bold : FontWeight.normal,
        color: Color(color),
        fontFamily: fontFamily,
        fontFamilyFallback: fontFamilyFallback,
        package: package,
        height: null,
      );
      final painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: TextDirection.ltr,
        textScaler: TextScaler.noScaling,
      )..layout();

      final width = math.max(1, painter.width.ceil());
      final height = math.max(1, (fontSize * 1.6 * scale).ceil());
      // Put the baseline at 1.0 times the font size, whatever the font's metrics.
      final baseline = painter.computeDistanceToActualBaseline(
        TextBaseline.alphabetic,
      );
      final dy = fontSize * scale - baseline;

      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(
        recorder,
        ui.Rect.fromLTWH(0, 0, width.toDouble(), height.toDouble()),
      );
      painter.paint(canvas, ui.Offset(0, dy));
      painter.dispose();
      final picture = recorder.endRecording();
      final image = await picture.toImage(width, height);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      picture.dispose();
      if (data == null) {
        throw const DevanagariRenderException(
            'the engine did not return a PNG image');
      }
      return RenderedText(
        png:
            Uint8List.view(data.buffer, data.offsetInBytes, data.lengthInBytes),
        widthPt: width / scale,
        heightPt: height / scale,
      );
    } on DevanagariRenderException {
      rethrow;
    } catch (_) {
      // Never put the text in the error: it may be a customer's name.
      throw const DevanagariRenderException('Flutter could not draw the text');
    }
  }
}
