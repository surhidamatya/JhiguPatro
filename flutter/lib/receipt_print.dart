/// Print and share PDF receipts from a Flutter app.
///
/// A separate entry point, because it needs the `printing` package (which has
/// platform plugins) and the main library does not:
///
/// ```dart
/// import 'package:jhigu_patro_flutter/receipt_print.dart';
///
/// await printReceipt(doc);   // the system print dialog
/// await shareReceipt(doc);   // the share sheet (a download on the web)
/// ```
///
/// Nepali receipts draw their text with [FlutterDevanagariRenderer] unless you
/// pass your own renderer. Both functions build the PDF with [buildReceiptPdf],
/// so a string that could not be drawn falls back as described there; pass
/// [onWarnings] to find out, instead of printing a receipt with `[?]` in it by
/// surprise.
///
/// [JhiguReceiptPreview] shows the receipt in the app (pages, zoom, and print and
/// share buttons).
///
/// What was and was not checked is in `data/PICKER_NOTES.md`: the calls into the
/// `printing` package are tested with a fake platform, not with a real printer or
/// share sheet.
library;

import 'dart:typed_data';

import 'package:flutter/widgets.dart';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:jhigu_patro_utils/receipt_pdf.dart';
import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:printing/printing.dart';

import 'src/devanagari_renderer.dart';

export 'package:jhigu_patro_utils/receipt_pdf.dart';

/// The paper a receipt is laid out for, as a print format.
PdfPageFormat receiptPageFormat(PageSize size) => switch (size) {
      PageSize.a4 => PdfPageFormat.a4,
      PageSize.a5 => PdfPageFormat.a5,
      PageSize.roll80 => PdfPageFormat.roll80,
    };

/// A file name for [doc]: its number with anything that is not a letter, digit,
/// dot, dash or underscore replaced by `_` (invoice numbers such as `2082/83-001`
/// are common), and `.pdf` added.
String receiptFileName(ReceiptDocument doc) {
  final base = doc.number.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
  return '${base.isEmpty ? 'receipt' : base}.pdf';
}

/// Builds the PDF for [doc] with a Flutter renderer for Devanagari (or the one
/// you pass). The warnings go to [onWarnings] when given.
Future<ReceiptPdf> buildReceiptPdfWithFlutter(
  ReceiptDocument doc, {
  DevanagariRenderer? renderer,
  void Function(List<String> warnings)? onWarnings,
}) async {
  final result = await buildReceiptPdf(
    doc,
    options:
        ReceiptPdfOptions(renderer: renderer ?? FlutterDevanagariRenderer()),
  );
  if (result.warnings.isNotEmpty) onWarnings?.call(result.warnings);
  return result;
}

/// Opens the system print dialog with [doc]. Returns true if the user printed
/// and false if they cancelled. The paper starts as the receipt's own size.
/// [jobName] defaults to the receipt number.
Future<bool> printReceipt(
  ReceiptDocument doc, {
  DevanagariRenderer? renderer,
  String? jobName,
  void Function(List<String> warnings)? onWarnings,
}) async {
  final result = await buildReceiptPdfWithFlutter(doc,
      renderer: renderer, onWarnings: onWarnings);
  final format = receiptPageFormat(doc.pageSize);
  return Printing.layoutPdf(
    // The PDF already has its page size; the dialog's paper must not reflow it.
    onLayout: (_) => result.bytes,
    name: jobName ?? doc.number,
    format: format,
    dynamicLayout: false,
  );
}

/// Opens the share sheet with [doc] as a PDF file (a download on the web).
/// Returns true if it was shared. [filename] defaults to [receiptFileName].
/// [bounds] is where an iPad share popover points from.
Future<bool> shareReceipt(
  ReceiptDocument doc, {
  DevanagariRenderer? renderer,
  String? filename,
  String? subject,
  String? body,
  Rect? bounds,
  void Function(List<String> warnings)? onWarnings,
}) async {
  final result = await buildReceiptPdfWithFlutter(doc,
      renderer: renderer, onWarnings: onWarnings);
  return Printing.sharePdf(
    bytes: result.bytes,
    filename: filename ?? receiptFileName(doc),
    bounds: bounds,
    subject: subject,
    body: body,
  );
}

/// Shows a receipt as it will print: its pages in a scrollable view with the
/// system's print and share buttons, built on `PdfPreview` from the `printing`
/// package.
///
/// ```dart
/// JhiguReceiptPreview(doc: doc, onWarnings: (w) => debugPrint('$w'))
/// ```
///
/// The PDF is built once for a given [doc] (and [renderer]) and reused for the
/// preview, printing and sharing, so what you see is what is printed. Pass a
/// different [doc] and the preview rebuilds. The paper is the receipt's own size and
/// cannot be changed in the preview, because the PDF is laid out for it.
///
/// Give it a bounded height (put it in an `Expanded` or a `SizedBox`). On the web it
/// loads pdf.js from a CDN to draw the pages (see the `printing` README to host it
/// yourself). The preview buttons use the `printing` package's own labels, in
/// English; they are not translated by this package.
class JhiguReceiptPreview extends StatefulWidget {
  final ReceiptDocument doc;

  /// Draws Nepali text. Default [FlutterDevanagariRenderer].
  final DevanagariRenderer? renderer;

  /// Called when some text could not be drawn as asked (see [printReceipt]).
  final void Function(List<String> warnings)? onWarnings;
  final bool allowPrinting;
  final bool allowSharing;

  /// Width limit of a page in the view.
  final double? maxPageWidth;

  /// The file name used when sharing. Default [receiptFileName].
  final String? fileName;
  final VoidCallback? onPrinted;
  final VoidCallback? onShared;

  /// What to show when the PDF could not be built or shown. Default: the
  /// `printing` package's own error text.
  final Widget Function(BuildContext context, Object error)? errorBuilder;

  const JhiguReceiptPreview({
    super.key,
    required this.doc,
    this.renderer,
    this.onWarnings,
    this.allowPrinting = true,
    this.allowSharing = true,
    this.maxPageWidth,
    this.fileName,
    this.onPrinted,
    this.onShared,
    this.errorBuilder,
  });

  @override
  State<JhiguReceiptPreview> createState() => _JhiguReceiptPreviewState();
}

class _JhiguReceiptPreviewState extends State<JhiguReceiptPreview> {
  late Future<Uint8List> Function(PdfPageFormat) _build;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  /// A new document gets a new build function, which is what makes the preview
  /// rebuild; the same document keeps its one PDF.
  void _prepare() {
    final pdf = buildReceiptPdfWithFlutter(
      widget.doc,
      renderer: widget.renderer,
      onWarnings: widget.onWarnings,
    );
    _build = (_) async => (await pdf).bytes;
  }

  @override
  void didUpdateWidget(JhiguReceiptPreview old) {
    super.didUpdateWidget(old);
    if (!identical(old.doc, widget.doc) || old.renderer != widget.renderer) {
      _prepare();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PdfPreview(
      build: _build,
      initialPageFormat: receiptPageFormat(widget.doc.pageSize),
      // The PDF is laid out for its own paper: no changing the format or reflowing.
      canChangePageFormat: false,
      canChangeOrientation: false,
      canDebug: false,
      dynamicLayout: false,
      allowPrinting: widget.allowPrinting,
      allowSharing: widget.allowSharing,
      maxPageWidth: widget.maxPageWidth,
      pdfFileName: widget.fileName ?? receiptFileName(widget.doc),
      onPrinted: widget.onPrinted == null ? null : (_) => widget.onPrinted!(),
      onShared: widget.onShared == null ? null : (_) => widget.onShared!(),
      onError: widget.errorBuilder,
    );
  }
}
