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
/// What was and was not checked is in `data/PICKER_NOTES.md`: the calls into the
/// `printing` package are tested with a fake platform, not with a real printer or
/// share sheet.
library;

import 'dart:ui' show Rect;

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
