/// PDF output for receipts and invoices (guide 12.3, 12.4, R-3 to R-5).
///
/// Import it separately: `import 'package:jhigu_patro_utils/receipt_pdf.dart';`.
/// It is not exported from the main library because it needs the `pdf` package,
/// which is the only runtime dependency of this package.
///
/// ```dart
/// final result = await buildReceiptPdf(doc);
/// File('invoice.pdf').writeAsBytesSync(result.bytes);
/// for (final w in result.warnings) { print(w); }
/// ```
///
/// Latin text and digits are real, selectable PDF text in a built-in font. The
/// PDF library cannot shape Devanagari, so any string with a character in
/// U+0900 to U+097F is drawn as an image made by a [DevanagariRenderer] you
/// pass in (guide 12.4). Without one, Devanagari labels fall back to English
/// and Devanagari text from the document (names, notes) is replaced by `[?]`;
/// both are reported in [ReceiptPdf.warnings], never silently.
///
/// Page sizes: A4 and A5 (multi-page, header row repeats), 80 mm roll (one
/// column, no table borders, as tall as needed). Amount in words is English for
/// `en` and `bilingual` and Nepali for `ne` (the Nepali words are not
/// native-speaker reviewed); it is left out for a negative total.
///
/// Not built here: a Flutter renderer, an atlas or command renderer, the FFI
/// shaper, and print or share helpers (they belong in a Flutter package).
library;

import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'src/date_format.dart';
import 'src/generated/strings.dart';
import 'src/money.dart';
import 'src/receipt.dart';
import 'src/types.dart';

/// A Devanagari string drawn to an image.
class RenderedText {
  /// PNG bytes.
  final Uint8List png;

  /// Size to place the image at, in PDF points.
  final double widthPt;
  final double heightPt;
  const RenderedText({
    required this.png,
    required this.widthPt,
    required this.heightPt,
  });
}

/// Draws strings that contain Devanagari to images, because the PDF library
/// cannot shape them. Each platform plugs in its own implementation.
abstract class DevanagariRenderer {
  /// [color] is `0xAARRGGBB`.
  Future<RenderedText> render(
    String text, {
    required double fontSize,
    required bool bold,
    required int color,
  });
}

/// A [DevanagariRenderer] could not produce an image. [buildReceiptPdf] catches
/// it, falls back for that string and adds a warning.
class DevanagariRenderException implements Exception {
  /// A short reason. It never contains the text that was being drawn.
  final String message;
  const DevanagariRenderException(this.message);

  @override
  String toString() => 'DevanagariRenderException: $message';
}

/// Result of [buildReceiptPdf].
class ReceiptPdf {
  final Uint8List bytes;

  /// Things that did not come out as asked, for example Devanagari that could
  /// not be drawn. Empty when everything was drawn as requested.
  final List<String> warnings;
  const ReceiptPdf(this.bytes, this.warnings);
}

/// Options for [buildReceiptPdf].
class ReceiptPdfOptions {
  /// Draws Devanagari text. Without one, see the library comment.
  final DevanagariRenderer? renderer;

  /// Compress the PDF streams. Default true; turn off to inspect the file or
  /// search it for text.
  final bool compress;
  const ReceiptPdfOptions({this.renderer, this.compress = true});
}

bool _hasDevanagari(String s) {
  for (final r in s.runes) {
    if (r >= 0x0900 && r <= 0x097F) return true;
  }
  return false;
}

String _stripDevanagari(String s) => s.replaceAll(RegExp('[ऀ-ॿ]+'), '[?]');

String _qty(int milli) {
  final whole = milli ~/ 1000;
  final frac = (milli % 1000)
      .toString()
      .padLeft(3, '0')
      .replaceFirst(RegExp(r'0+$'), '');
  return frac.isEmpty ? '$whole' : '$whole.$frac';
}

String _percent(int bp) {
  final whole = bp ~/ 100;
  final frac =
      (bp % 100).toString().padLeft(2, '0').replaceFirst(RegExp(r'0+$'), '');
  return frac.isEmpty ? '$whole' : '$whole.$frac';
}

class _Builder {
  final ReceiptDocument doc;
  final ReceiptPdfOptions options;
  final List<String> warnings = [];
  final Map<String, RenderedText> _cache = {};
  int _devanagariFallbacks = 0;
  int _devanagariLabels = 0;
  int _renderFailures = 0;
  String _lastFailure = '';

  _Builder(this.doc, this.options);

  bool get _wantsNepali =>
      doc.language == ReceiptLanguage.ne ||
      doc.language == ReceiptLanguage.bilingual;

  /// Labels are English when no renderer is available, even for `ne`.
  bool get _canDrawNepali => options.renderer != null;

  /// A text widget; Devanagari goes through the renderer or falls back.
  Future<pw.Widget> text(
    String s, {
    double size = 10,
    bool bold = false,
    pw.TextAlign align = pw.TextAlign.left,
    int color = 0xFF111111,

    /// Place a Devanagari image as is, without the expanding alignment box
    /// (needed inside a rotated, bordered stamp).
    bool bare = false,
  }) async {
    if (!_hasDevanagari(s)) {
      return pw.Text(
        s,
        textAlign: align,
        style: pw.TextStyle(
            fontSize: size,
            fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal),
      );
    }
    final renderer = options.renderer;
    if (renderer == null) {
      _devanagariFallbacks++;
      return pw.Text(
        _stripDevanagari(s),
        textAlign: align,
        style: pw.TextStyle(
            fontSize: size,
            fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal),
      );
    }
    final key = '$s|$size|$bold|$color';
    var r = _cache[key];
    if (r == null) {
      try {
        r = _cache[key] =
            await renderer.render(s, fontSize: size, bold: bold, color: color);
      } catch (e) {
        // Never print broken glyphs and never fail the whole PDF: use the
        // fallback and say so in the warnings.
        _renderFailures++;
        _lastFailure = e.runtimeType.toString();
        return pw.Text(
          _stripDevanagari(s),
          textAlign: align,
          style: pw.TextStyle(
              fontSize: size,
              fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal),
        );
      }
    }
    final image =
        pw.Image(pw.MemoryImage(r.png), width: r.widthPt, height: r.heightPt);
    if (bare) return image;
    return switch (align) {
      pw.TextAlign.right =>
        pw.Align(alignment: pw.Alignment.centerRight, child: image),
      pw.TextAlign.center =>
        pw.Align(alignment: pw.Alignment.center, child: image),
      _ => pw.Align(alignment: pw.Alignment.centerLeft, child: image),
    };
  }

  /// A label in the document language. Returns one or two widgets' worth in a column.
  Future<pw.Widget> label(String Function(JhiguStringsReceipt) pick,
      {double size = 10,
      bool bold = false,
      pw.TextAlign align = pw.TextAlign.left}) async {
    final en = pick(getStrings('en').receipt);
    final ne = pick(getStrings('ne').receipt);
    final wantNe = _wantsNepali;
    if (wantNe && !_canDrawNepali) _devanagariLabels++;
    final showNe = wantNe && _canDrawNepali;
    final showEn = doc.language != ReceiptLanguage.ne || !_canDrawNepali;
    final parts = <pw.Widget>[
      if (showNe) await text(ne, size: size, bold: bold, align: align),
      if (showEn)
        await text(en,
            size: size - (showNe ? 1.5 : 0),
            bold: bold && !showNe,
            align: align),
    ];
    if (parts.length == 1) return parts.first;
    return pw.Column(crossAxisAlignment: _cross(align), children: parts);
  }

  pw.CrossAxisAlignment _cross(pw.TextAlign a) => switch (a) {
        pw.TextAlign.right => pw.CrossAxisAlignment.end,
        pw.TextAlign.center => pw.CrossAxisAlignment.center,
        _ => pw.CrossAxisAlignment.start,
      };

  String money(Npr n) => n.format(decimals: MoneyDecimals.always);
  String moneyRs(Npr n) =>
      n.format(symbol: MoneySymbol.rs, decimals: MoneyDecimals.always);

  String adDate(NepaliDate d) => formatAd(
      DateTime.utc(1970, 1, 1).add(Duration(days: d.dayNumber)), 'D MMMM YYYY',
      asciiDigits: true);

  /// A plain-text label in the receipt language: Nepali only when the receipt
  /// is Nepali and a renderer can draw it, else English.
  String pl(String Function(JhiguStringsReceipt) pick) =>
      doc.language == ReceiptLanguage.ne && _canDrawNepali
          ? pick(getStrings('ne').receipt)
          : pick(getStrings('en').receipt);

  String bsDate(NepaliDate d) =>
      doc.language == ReceiptLanguage.ne && _canDrawNepali
          ? formatPreset(d, DatePreset.dual, language: 'ne')
          : _bsDateEn(d);

  String _bsDateEn(NepaliDate d) =>
      '${formatDate(d, 'D MMMM YYYY', asciiDigits: true)} BS (${adDate(d)} AD)';

  Future<ReceiptPdf> build() async {
    final t = computeTotals(doc);
    final compress = options.compress;
    final pdf = pw.Document(
        compress: compress, title: '${doc.number}', author: doc.business.name);
    final isRoll = doc.pageSize == PageSize.roll80;
    final fontSize = isRoll ? 8.0 : 10.0;

    final header = <pw.Widget>[
      await text(doc.business.name, size: fontSize + 6, bold: true),
      if (doc.business.address != null &&
          doc.business.address!.trim().isNotEmpty)
        await text(doc.business.address!.trim(), size: fontSize),
      if (doc.business.phone != null && doc.business.phone!.trim().isNotEmpty)
        await text('${pl((r) => r.phone)}: ${doc.business.phone!.trim()}',
            size: fontSize),
      if (doc.business.pan != null && doc.business.pan!.trim().isNotEmpty)
        await text('${pl((r) => r.pan)}: ${doc.business.pan!.trim()}',
            size: fontSize),
      if (doc.business.vat != null && doc.business.vat!.trim().isNotEmpty)
        await text('${pl((r) => r.vatNo)}: ${doc.business.vat!.trim()}',
            size: fontSize),
    ];

    final kindLabel = await label(
      (r) => switch (doc.kind) {
        ReceiptKind.invoice => r.invoice,
        ReceiptKind.receipt => r.receipt,
        ReceiptKind.quotation => r.quotation,
        ReceiptKind.creditNote => r.creditNote,
      },
      size: fontSize + 5,
      bold: true,
      align: isRoll ? pw.TextAlign.left : pw.TextAlign.right,
    );
    final titleBlock = pw.Column(
      crossAxisAlignment:
          isRoll ? pw.CrossAxisAlignment.start : pw.CrossAxisAlignment.end,
      children: [
        kindLabel,
        await text('${pl((r) => r.number)} ${doc.number}', size: fontSize),
        await text('${pl((r) => r.date)}: ${bsDate(doc.issueDate)}',
            size: fontSize),
        if (doc.dueDate != null)
          await text('${pl((r) => r.dueDate)}: ${bsDate(doc.dueDate!)}',
              size: fontSize),
      ],
    );

    final customer =
        pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      await label((r) => r.billTo, size: fontSize, bold: true),
      await text(doc.customer.name, size: fontSize),
      if (doc.customer.address != null &&
          doc.customer.address!.trim().isNotEmpty)
        await text(doc.customer.address!.trim(), size: fontSize),
      if (doc.customer.phone != null && doc.customer.phone!.trim().isNotEmpty)
        await text('${pl((r) => r.phone)}: ${doc.customer.phone!.trim()}',
            size: fontSize),
      if (doc.customer.pan != null && doc.customer.pan!.trim().isNotEmpty)
        await text('${pl((r) => r.pan)}: ${doc.customer.pan!.trim()}',
            size: fontSize),
    ]);

    // Lines table.
    final border = isRoll
        ? null
        : pw.TableBorder.all(color: PdfColors.grey600, width: 0.5);
    final cellPad =
        pw.EdgeInsets.symmetric(horizontal: 3, vertical: isRoll ? 1.5 : 3);
    pw.Widget cell(pw.Widget w) => pw.Padding(padding: cellPad, child: w);
    final widths = isRoll
        ? <int, pw.TableColumnWidth>{
            0: const pw.FlexColumnWidth(3),
            1: const pw.FlexColumnWidth(1.3),
            2: const pw.FlexColumnWidth(1.4),
            3: const pw.FlexColumnWidth(1.6),
          }
        : <int, pw.TableColumnWidth>{
            0: const pw.FixedColumnWidth(22),
            1: const pw.FlexColumnWidth(4),
            2: const pw.FlexColumnWidth(1.4),
            3: const pw.FlexColumnWidth(1.5),
            4: const pw.FlexColumnWidth(1.7),
          };
    final headCells = <pw.Widget>[
      if (!isRoll)
        cell(await text('#',
            size: fontSize, bold: true, align: pw.TextAlign.right)),
      cell(await label((r) => r.description, size: fontSize, bold: true)),
      cell(await label((r) => r.quantity,
          size: fontSize, bold: true, align: pw.TextAlign.right)),
      cell(await label((r) => r.rate,
          size: fontSize, bold: true, align: pw.TextAlign.right)),
      cell(await label((r) => r.amount,
          size: fontSize, bold: true, align: pw.TextAlign.right)),
    ];
    final rows = <pw.TableRow>[
      pw.TableRow(
        repeat: true,
        decoration:
            isRoll ? null : const pw.BoxDecoration(color: PdfColors.grey200),
        children: headCells,
      ),
    ];
    for (var i = 0; i < doc.lines.length; i++) {
      final l = doc.lines[i];
      final unit = l.unit != null && l.unit!.trim().isNotEmpty
          ? ' ${l.unit!.trim()}'
          : '';
      rows.add(pw.TableRow(children: [
        if (!isRoll)
          cell(await text('${i + 1}',
              size: fontSize, align: pw.TextAlign.right)),
        cell(await text(l.description, size: fontSize)),
        cell(await text('${_qty(l.qtyMilli)}$unit',
            size: fontSize, align: pw.TextAlign.right)),
        cell(await text(money(l.unitPrice),
            size: fontSize, align: pw.TextAlign.right)),
        cell(await text(money(t.lines[i]),
            size: fontSize, align: pw.TextAlign.right)),
      ]));
    }
    final table =
        pw.Table(border: border, columnWidths: widths, children: rows);

    // Totals.
    final d = doc.discount;
    final discountSuffix =
        d is PercentDiscount ? ' (${_percent(d.basisPoints)}%)' : '';
    Future<pw.TableRow> totalRow(
        String Function(JhiguStringsReceipt) pick, Npr value,
        {String suffix = '', bool bold = false, bool rule = false}) async {
      final l = await label(pick, size: fontSize, bold: bold);
      final extra = suffix.isEmpty
          ? null
          : await text(suffix, size: fontSize, bold: bold);
      return pw.TableRow(
        decoration: rule
            ? const pw.BoxDecoration(
                border: pw.Border(top: pw.BorderSide(width: 1)))
            : null,
        children: [
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(horizontal: 3, vertical: 2),
            child: extra == null
                ? l
                : pw.Row(children: [l, pw.SizedBox(width: 3), extra]),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(horizontal: 3, vertical: 2),
            child: await text(moneyRs(value),
                size: fontSize, bold: bold, align: pw.TextAlign.right),
          ),
        ],
      );
    }

    final totalRows = <pw.TableRow>[
      await totalRow((r) => r.subtotal, t.gross),
      if (!t.discount.isZero)
        await totalRow((r) => r.discount, t.discount.negate(),
            suffix: discountSuffix),
      if (doc.vatMode != VatMode.none)
        await totalRow((r) => r.taxable, t.taxable),
      if (doc.vatMode != VatMode.none)
        await totalRow((r) => r.vat, t.vat,
            suffix: '(${_percent(doc.vatBasisPoints)}%)'),
      await totalRow((r) => r.total, t.total, bold: true, rule: true),
      await totalRow((r) => r.paid, t.paid),
      t.overpaid
          ? await totalRow((r) => r.overpaid, t.balance.negate(),
              bold: true, rule: true)
          : await totalRow((r) => r.balance, t.balance, bold: true, rule: true),
    ];
    final totals = pw.Table(
      columnWidths: const {
        0: pw.FlexColumnWidth(1.6),
        1: pw.FlexColumnWidth(1.4)
      },
      children: totalRows,
    );

    final words = !t.total.isNegative
        ? pw.Padding(
            padding: const pw.EdgeInsets.only(top: 8),
            child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  await label((r) => r.amountInWords,
                      size: fontSize, bold: true),
                  pw.SizedBox(width: 4),
                  pw.Expanded(
                      child: await text(
                          t.total.inWords(
                              language: doc.language == ReceiptLanguage.ne
                                  ? 'ne'
                                  : 'en'),
                          size: fontSize)),
                ]),
          )
        : pw.SizedBox();

    final notes = doc.notes != null && doc.notes!.trim().isNotEmpty
        ? pw.Padding(
            padding: const pw.EdgeInsets.only(top: 8),
            child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  await label((r) => r.notes, size: fontSize, bold: true),
                  await text(doc.notes!.trim(), size: fontSize),
                ]),
          )
        : pw.SizedBox();

    final signature = pw.Padding(
      padding: const pw.EdgeInsets.only(top: 30),
      child: pw.Align(
        alignment: pw.Alignment.centerRight,
        child: pw.Container(
          width: 130,
          decoration: const pw.BoxDecoration(
              border: pw.Border(top: pw.BorderSide(width: 0.8))),
          padding: const pw.EdgeInsets.only(top: 3),
          child: await label((r) => r.signature,
              size: fontSize, align: pw.TextAlign.center),
        ),
      ),
    );

    // Stamp: rotated, semi-transparent text drawn behind the content.
    pw.Widget Function(pw.Context)? background;
    if (doc.stamp != null) {
      final paid = doc.stamp == ReceiptStamp.paid;
      final stampText = (_wantsNepali && !_canDrawNepali
              ? getStrings('en')
              : getStrings(doc.language == ReceiptLanguage.ne ? 'ne' : 'en'))
          .receipt;
      final s = paid ? stampText.stampPaid : stampText.stampCancelled;
      // ARGB of green 800 and red 800, to match the border colour below.
      final stampWidget = await text(s,
          size: isRoll ? 26 : 44,
          bold: true,
          color: paid ? 0xFF2E7D32 : 0xFFC62828,
          bare: true);
      final color = paid ? PdfColors.green800 : PdfColors.red800;
      background = (ctx) => pw.FullPage(
            ignoreMargins: true,
            child: pw.Center(
              child: pw.Transform.rotate(
                angle: -0.42,
                child: pw.Opacity(
                  opacity: 0.22,
                  child: pw.Container(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 14),
                    decoration: pw.BoxDecoration(
                        border: pw.Border.all(color: color, width: 4)),
                    child: pw.DefaultTextStyle(
                        style: pw.TextStyle(color: color), child: stampWidget),
                  ),
                ),
              ),
            ),
          );
    }

    final body = <pw.Widget>[
      if (isRoll) ...[
        pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start, children: header),
        pw.SizedBox(height: 6),
        titleBlock,
      ] else
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: header),
            titleBlock
          ],
        ),
      pw.Divider(thickness: isRoll ? 0.5 : 1.5),
      customer,
      pw.SizedBox(height: 8),
      table,
      pw.SizedBox(height: 8),
      pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.SizedBox(
              width: isRoll ? double.infinity : 250, child: totals)),
      words,
      notes,
      signature,
    ];

    final format = switch (doc.pageSize) {
      PageSize.a4 => PdfPageFormat.a4,
      PageSize.a5 => PdfPageFormat.a5,
      PageSize.roll80 => PdfPageFormat.roll80,
    };
    final margin = switch (doc.pageSize) {
      PageSize.a4 => 36.0,
      PageSize.a5 => 24.0,
      PageSize.roll80 => 8.0,
    };
    final theme = pw.ThemeData.withFont(
        base: pw.Font.helvetica(), bold: pw.Font.helveticaBold());
    final pageTheme = pw.PageTheme(
      pageFormat: format,
      margin: pw.EdgeInsets.all(margin),
      theme: theme,
      buildBackground: background,
    );

    if (isRoll) {
      pdf.addPage(pw.Page(
          pageTheme: pageTheme,
          build: (ctx) => pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.stretch,
              children: body)));
    } else {
      pdf.addPage(pw.MultiPage(pageTheme: pageTheme, build: (ctx) => body));
    }

    if (_devanagariLabels > 0) {
      warnings.add(
          'DEVANAGARI_LABELS_UNAVAILABLE: no DevanagariRenderer was given, so $_devanagariLabels '
          'labels were drawn in English only');
    }
    if (_devanagariFallbacks > 0) {
      warnings.add(
          'DEVANAGARI_TEXT_UNAVAILABLE: no DevanagariRenderer was given, so $_devanagariFallbacks '
          'text values with Devanagari were replaced by [?]');
    }
    if (_renderFailures > 0) {
      warnings.add(
          'DEVANAGARI_RENDER_FAILED: the DevanagariRenderer failed for $_renderFailures '
          'strings ($_lastFailure), so they were replaced by [?]');
    }
    return ReceiptPdf(await pdf.save(), List.unmodifiable(warnings));
  }
}

/// Build a PDF for [doc]. Throws [ReceiptException] for an invalid document and
/// [MoneyException] if a sum is too large. See the library comment for the
/// Devanagari rules.
Future<ReceiptPdf> buildReceiptPdf(
  ReceiptDocument doc, {
  ReceiptPdfOptions options = const ReceiptPdfOptions(),
}) =>
    _Builder(doc, options).build();
