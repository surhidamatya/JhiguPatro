/// A [DevanagariRenderer] that calls an external program (guide 12.4,
/// "CommandRenderer"), for servers and command-line tools that have no Flutter.
///
/// Import it separately (it uses `dart:io`, so it is not for the web):
/// `import 'package:jhigu_patro_utils/devanagari_command_renderer.dart';`
///
/// The default program is `rsvg-convert` (librsvg), which shapes Devanagari
/// through Pango and HarfBuzz. This renderer writes a small SVG with the text to
/// the program's standard input and reads a transparent PNG from its standard
/// output:
///
/// ```dart
/// final renderer = CommandDevanagariRenderer(
///   fontFamily: "'Noto Sans Devanagari', 'Kohinoor Devanagari'",
/// );
/// final result = await buildReceiptPdf(doc, options: ReceiptPdfOptions(renderer: renderer));
/// ```
///
/// You must have a Devanagari font installed on the machine that runs it, and
/// name it in [fontFamily]; this package does not bundle one. Any program that
/// reads SVG on stdin and writes PNG on stdout will do: change [executable] and
/// [arguments]. The image has a fixed height of 1.6 times the font size and the
/// baseline at 1.0 times, so Nepali text lines up in table rows.
///
/// Message text is never put on the command line or in errors, only sent on
/// stdin.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'receipt_pdf.dart';

/// Runs a program with [stdin] and returns its standard output. Throws if the
/// program fails. Replace it in tests.
typedef CommandRunner = Future<Uint8List> Function(
  String executable,
  List<String> arguments,
  Uint8List stdin,
);

/// The renderer could not produce an image.
class DevanagariRenderException implements Exception {
  /// A short reason. It never contains the text that was being drawn.
  final String message;
  const DevanagariRenderException(this.message);

  @override
  String toString() => 'DevanagariRenderException: $message';
}

Future<Uint8List> _runProcess(
  String executable,
  List<String> arguments,
  Uint8List stdin,
) async {
  final Process process;
  try {
    process = await Process.start(executable, arguments);
  } on ProcessException {
    throw DevanagariRenderException('could not start "$executable"');
  }
  final out = <int>[];
  final outDone = process.stdout.forEach(out.addAll);
  final errDone = process.stderr.drain<void>();
  process.stdin.add(stdin);
  await process.stdin.close();
  await Future.wait([outDone, errDone]);
  final code = await process.exitCode;
  if (code != 0) {
    throw DevanagariRenderException('"$executable" exited with code $code');
  }
  return Uint8List.fromList(out);
}

const List<int> _pngSignature = [
  0x89,
  0x50,
  0x4E,
  0x47,
  0x0D,
  0x0A,
  0x1A,
  0x0A
];

/// Width and height in pixels from a PNG header, or null if it is not a PNG.
({int width, int height})? pngSize(Uint8List png) {
  if (png.length < 24) return null;
  for (var i = 0; i < 8; i++) {
    if (png[i] != _pngSignature[i]) return null;
  }
  final d = ByteData.sublistView(png);
  return (width: d.getUint32(16), height: d.getUint32(20));
}

String _xmlEscape(String s) => s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/// Draws Devanagari text by running an external program. See the library comment.
class CommandDevanagariRenderer implements DevanagariRenderer {
  /// The program to run. Default `rsvg-convert`.
  final String executable;

  /// Arguments; `{scale}` is replaced by [scale]. Default `-f png -z {scale}`.
  final List<String> arguments;

  /// CSS `font-family` list for the SVG. A Devanagari font must be installed.
  final String fontFamily;

  /// Pixels per point of the output. Default 290 / 72 (about 290 dpi, as the guide suggests).
  final double scale;

  final CommandRunner _run;

  CommandDevanagariRenderer({
    this.executable = 'rsvg-convert',
    this.arguments = const ['-f', 'png', '-z', '{scale}'],
    this.fontFamily =
        "'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Devanagari MT', 'Mangal', sans-serif",
    this.scale = 290 / 72,
    CommandRunner? runner,
  }) : _run = runner ?? _runProcess {
    if (!(scale > 0)) throw ArgumentError('scale must be positive');
  }

  /// The SVG sent to the program for [text]. Public so it can be checked.
  String svgFor(String text,
      {required double fontSize, required bool bold, required int color}) {
    final a = (color >> 24) & 0xFF;
    final rgb = (color & 0xFFFFFF).toRadixString(16).padLeft(6, '0');
    final height = fontSize * 1.6;
    // The invisible rectangle fixes the image height and the baseline, whatever the glyphs.
    return '<svg xmlns="http://www.w3.org/2000/svg">'
        '<rect x="0" y="0" width="1" height="$height" fill="#000000" fill-opacity="0"/>'
        '<text x="0" y="$fontSize" font-family="${_xmlEscape(fontFamily)}" font-size="$fontSize" '
        'font-weight="${bold ? 'bold' : 'normal'}" fill="#$rgb" fill-opacity="${(a / 255).toStringAsFixed(3)}">'
        '${_xmlEscape(text)}</text></svg>';
  }

  @override
  Future<RenderedText> render(
    String text, {
    required double fontSize,
    required bool bold,
    required int color,
  }) async {
    final svg = svgFor(text, fontSize: fontSize, bold: bold, color: color);
    final args = [for (final a in arguments) a.replaceAll('{scale}', '$scale')];
    final png =
        await _run(executable, args, Uint8List.fromList(utf8.encode(svg)));
    final size = pngSize(png);
    if (size == null || size.width == 0 || size.height == 0) {
      throw const DevanagariRenderException(
          'the program did not return a PNG image');
    }
    return RenderedText(
      png: png,
      widthPt: size.width / scale,
      heightPt: size.height / scale,
    );
  }
}
