/// Receipt and invoice model, validation and totals (guide section 12, R-1,
/// R-2). No rendering. Money is integer paisa ([Npr]); quantity is an integer
/// in thousandths (1.5 is 1500).
///
/// Order of calculation ([computeTotals]):
///  1. line amount = qty * unit price / 1000, rounded half away from zero
///  2. gross = sum of line amounts
///  3. discount (amount, or basis points of gross rounded half away from zero)
///  4. VAT on the discounted amount:
///       none       taxable = discounted, VAT 0, total = discounted
///       exclusive  VAT = taxable * rate, total = taxable + VAT
///       inclusive  taxable = discounted / (1 + rate) rounded, VAT = discounted - taxable
///  5. balance = total - paid; negative balance sets `overpaid`
///
/// The logo from the guide's model is a rendering concern and is not part of
/// this model.
library;

import 'generated/strings.dart';
import 'money.dart';
import 'types.dart';

enum ReceiptKind { invoice, receipt, quotation, creditNote }

enum VatMode { none, exclusive, inclusive }

enum ReceiptStamp { paid, cancelled }

enum ReceiptLanguage { ne, en, bilingual }

enum PageSize { a4, a5, roll80 }

class Business {
  final String name;
  final String? address;
  final String? pan;
  final String? vat;
  final String? phone;
  const Business(
      {required this.name, this.address, this.pan, this.vat, this.phone});
}

class Party {
  final String name;
  final String? address;
  final String? pan;
  final String? phone;
  const Party({required this.name, this.address, this.pan, this.phone});
}

class ReceiptLine {
  final String description;

  /// Quantity in thousandths: 1.5 is 1500. Positive integer.
  final int qtyMilli;
  final String? unit;
  final Npr unitPrice;
  const ReceiptLine({
    required this.description,
    required this.qtyMilli,
    this.unit,
    required this.unitPrice,
  });

  /// `qtyMilli * unitPrice / 1000`, half away from zero.
  Npr get amount => unitPrice.dividedBy(1000, times: qtyMilli);
}

/// A discount: an amount, or basis points of the gross.
sealed class Discount {
  const Discount();
  const factory Discount.amount(Npr amount) = AmountDiscount;
  const factory Discount.percent(int basisPoints) = PercentDiscount;
}

class AmountDiscount extends Discount {
  final Npr amount;
  const AmountDiscount(this.amount);
}

class PercentDiscount extends Discount {
  final int basisPoints;
  const PercentDiscount(this.basisPoints);
}

class ReceiptDocument {
  final ReceiptKind kind;
  final String number;
  final NepaliDate issueDate;
  final NepaliDate? dueDate;
  final Business business;
  final Party customer;
  final List<ReceiptLine> lines;
  final Discount? discount;
  final VatMode vatMode;

  /// Default 1300 (13%).
  final int vatBasisPoints;
  final Npr paid;
  final String? notes;
  final ReceiptStamp? stamp;
  final ReceiptLanguage language;
  final PageSize pageSize;

  const ReceiptDocument({
    required this.kind,
    required this.number,
    required this.issueDate,
    this.dueDate,
    required this.business,
    required this.customer,
    required this.lines,
    this.discount,
    required this.vatMode,
    this.vatBasisPoints = 1300,
    required this.paid,
    this.notes,
    this.stamp,
    required this.language,
    required this.pageSize,
  });
}

enum ReceiptErrorCode {
  emptyNumber('EMPTY_NUMBER'),
  noLines('NO_LINES'),
  emptyDescription('EMPTY_DESCRIPTION'),
  badQuantity('BAD_QUANTITY'),
  badUnitPrice('BAD_UNIT_PRICE'),
  badDiscount('BAD_DISCOUNT'),
  badVatRate('BAD_VAT_RATE'),
  badPaid('BAD_PAID'),
  dueBeforeIssue('DUE_BEFORE_ISSUE');

  const ReceiptErrorCode(this.name_);

  /// Stable code shared with the TypeScript library.
  final String name_;
}

/// One validation problem. [line] is the 0-based line index for line problems.
class ReceiptIssue {
  final ReceiptErrorCode code;
  final int? line;
  const ReceiptIssue(this.code, [this.line]);

  @override
  bool operator ==(Object other) =>
      other is ReceiptIssue && other.code == code && other.line == line;

  @override
  int get hashCode => Object.hash(code, line);

  @override
  String toString() =>
      'ReceiptIssue(${code.name_}${line == null ? '' : ', line $line'})';
}

/// Typed receipt error. [message] is English; use [localized] for `ne`.
class ReceiptException implements Exception {
  final ReceiptErrorCode code;
  final int? line;
  const ReceiptException(this.code, [this.line]);

  String get message => localized('en');

  String localized(String language) {
    final r = getStrings(language).receipt;
    return switch (code) {
      ReceiptErrorCode.emptyNumber => r.emptyNumber,
      ReceiptErrorCode.noLines => r.noLines,
      ReceiptErrorCode.emptyDescription => r.emptyDescription,
      ReceiptErrorCode.badQuantity => r.badQuantity,
      ReceiptErrorCode.badUnitPrice => r.badUnitPrice,
      ReceiptErrorCode.badDiscount => r.badDiscount,
      ReceiptErrorCode.badVatRate => r.badVatRate,
      ReceiptErrorCode.badPaid => r.badPaid,
      ReceiptErrorCode.dueBeforeIssue => r.dueBeforeIssue,
    };
  }

  @override
  String toString() => 'ReceiptException(${code.name_}): $message';
}

bool _lineOk(ReceiptLine l) => l.qtyMilli >= 1 && !l.unitPrice.isNegative;

/// All problems in a document, in a fixed order: number, no lines, each line
/// (description, quantity, unit price), discount, VAT rate, paid, due date.
/// An empty list means [computeTotals] throws no [ReceiptException] (a sum that
/// is too large still throws [MoneyException]). A discount amount is compared
/// with the gross of the valid lines only.
List<ReceiptIssue> validateReceipt(ReceiptDocument doc) {
  final issues = <ReceiptIssue>[];
  if (doc.number.trim().isEmpty) {
    issues.add(const ReceiptIssue(ReceiptErrorCode.emptyNumber));
  }
  if (doc.lines.isEmpty) {
    issues.add(const ReceiptIssue(ReceiptErrorCode.noLines));
  }
  for (var i = 0; i < doc.lines.length; i++) {
    final l = doc.lines[i];
    if (l.description.trim().isEmpty) {
      issues.add(ReceiptIssue(ReceiptErrorCode.emptyDescription, i));
    }
    if (l.qtyMilli < 1)
      issues.add(ReceiptIssue(ReceiptErrorCode.badQuantity, i));
    if (l.unitPrice.isNegative) {
      issues.add(ReceiptIssue(ReceiptErrorCode.badUnitPrice, i));
    }
  }
  final d = doc.discount;
  if (d is PercentDiscount) {
    if (d.basisPoints < 0 || d.basisPoints > 10000) {
      issues.add(const ReceiptIssue(ReceiptErrorCode.badDiscount));
    }
  } else if (d is AmountDiscount) {
    var gross = Npr.zero;
    for (final l in doc.lines.where(_lineOk)) {
      gross = gross.plus(l.amount);
    }
    if (d.amount.isNegative || d.amount.compareTo(gross) > 0) {
      issues.add(const ReceiptIssue(ReceiptErrorCode.badDiscount));
    }
  }
  if (doc.vatBasisPoints < 0 || doc.vatBasisPoints > 10000) {
    issues.add(const ReceiptIssue(ReceiptErrorCode.badVatRate));
  }
  if (doc.paid.isNegative) {
    issues.add(const ReceiptIssue(ReceiptErrorCode.badPaid));
  }
  final due = doc.dueDate;
  if (due != null && due.compareTo(doc.issueDate) < 0) {
    issues.add(const ReceiptIssue(ReceiptErrorCode.dueBeforeIssue));
  }
  return issues;
}

/// Computed amounts for a document.
class ReceiptTotals {
  /// Amount of each line, in order.
  final List<Npr> lines;
  final Npr gross;
  final Npr discount;

  /// Amount VAT is charged on (for `inclusive`, the price without VAT).
  final Npr taxable;
  final Npr vat;
  final Npr total;
  final Npr paid;

  /// `total - paid`; negative when overpaid.
  final Npr balance;
  final bool overpaid;
  const ReceiptTotals({
    required this.lines,
    required this.gross,
    required this.discount,
    required this.taxable,
    required this.vat,
    required this.total,
    required this.paid,
    required this.balance,
    required this.overpaid,
  });
}

/// Totals for a document. Throws [ReceiptException] (the first issue of
/// [validateReceipt]) for an invalid document, and [MoneyException]
/// (out of range) if a sum is too large.
ReceiptTotals computeTotals(ReceiptDocument doc) {
  final issues = validateReceipt(doc);
  if (issues.isNotEmpty) {
    throw ReceiptException(issues.first.code, issues.first.line);
  }
  final lines = [for (final l in doc.lines) l.amount];
  var gross = Npr.zero;
  for (final a in lines) {
    gross = gross.plus(a);
  }
  final d = doc.discount;
  final discount = switch (d) {
    null => Npr.zero,
    AmountDiscount() => d.amount,
    PercentDiscount() => gross.percent(d.basisPoints),
  };
  final after = gross.minus(discount);
  final bp = doc.vatBasisPoints;

  final Npr taxable, vat, total;
  switch (doc.vatMode) {
    case VatMode.none:
      taxable = after;
      vat = Npr.zero;
      total = after;
    case VatMode.exclusive:
      final r = vatExclusive(after, bp: bp);
      taxable = r.subtotal;
      vat = r.vat;
      total = r.total;
    case VatMode.inclusive:
      final r = vatInclusive(after, bp: bp);
      taxable = r.subtotal;
      vat = r.vat;
      total = r.total;
  }
  final balance = total.minus(doc.paid);
  return ReceiptTotals(
    lines: lines,
    gross: gross,
    discount: discount,
    taxable: taxable,
    vat: vat,
    total: total,
    paid: doc.paid,
    balance: balance,
    overpaid: balance.isNegative,
  );
}
