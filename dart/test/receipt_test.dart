import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _cal = _read('../data/nepali_calendar_data.json');
final Map<int, List<int>> _years = (_cal['years'] as Map<String, dynamic>).map(
  (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
);
final _v = _read('../testdata/receipt.json');

NepaliDate _date(List l) =>
    NepaliDate.checked(l[0] as int, l[1] as int, l[2] as int);

ReceiptDocument _build(Map<String, dynamic> c) {
  final d = c['discount'] as Map<String, dynamic>?;
  return ReceiptDocument(
    kind: ReceiptKind.invoice,
    number: (c['number'] as String?) ?? 'INV-1',
    issueDate: _date((c['issue'] as List?) ?? [2082, 5, 10]),
    dueDate: c['due'] == null ? null : _date(c['due'] as List),
    business: const Business(name: 'Shop'),
    customer: const Party(name: 'Customer'),
    lines: [
      for (final l in c['lines'] as List)
        ReceiptLine(
          description: (l as Map)['description'] as String,
          qtyMilli: l['qtyMilli'] as int,
          unitPrice: Npr.fromPaisa(l['unitPaisa'] as int),
        ),
    ],
    discount: d == null
        ? null
        : d['type'] == 'amount'
            ? Discount.amount(Npr.fromPaisa(d['paisa'] as int))
            : Discount.percent(d['basisPoints'] as int),
    vatMode: VatMode.values.byName(c['vatMode'] as String),
    vatBasisPoints: (c['vatBasisPoints'] as int?) ?? 1300,
    paid: Npr.fromPaisa(c['paidPaisa'] as int),
    language: ReceiptLanguage.en,
    pageSize: PageSize.a4,
  );
}

ReceiptErrorCode _code(String s) =>
    ReceiptErrorCode.values.firstWhere((c) => c.name_ == s);

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

  group('receipt totals (shared vectors)', () {
    for (final c in _v['totals'] as List) {
      final name = (c as Map)['name'] as String;
      test(name, () {
        final doc = c['doc'] as Map<String, dynamic>;
        final e = c['expect'] as Map<String, dynamic>;
        final t = computeTotals(_build(doc));
        expect(t.lines.map((n) => n.paisa).toList(), e['lines']);
        expect(t.gross.paisa, e['gross'], reason: 'gross');
        expect(t.discount.paisa, e['discount'], reason: 'discount');
        expect(t.taxable.paisa, e['taxable'], reason: 'taxable');
        expect(t.vat.paisa, e['vat'], reason: 'vat');
        expect(t.total.paisa, e['total'], reason: 'total');
        expect(t.paid.paisa, e['paid'], reason: 'paid');
        expect(t.balance.paisa, e['balance'], reason: 'balance');
        expect(t.overpaid, e['overpaid']);
      });
    }
  });

  group('receipt validation (shared vectors)', () {
    for (final c in _v['invalid'] as List) {
      final name = (c as Map)['name'] as String;
      test(name, () {
        final doc = _build(c['doc'] as Map<String, dynamic>);
        final want = [
          for (final i in c['issues'] as List)
            ReceiptIssue(
                _code((i as Map)['code'] as String), i['line'] as int?),
        ];
        expect(validateReceipt(doc), want);
        if (want.isEmpty) {
          computeTotals(doc);
        } else {
          expect(
            () => computeTotals(doc),
            throwsA(isA<ReceiptException>()
                .having((e) => e.code, 'code', want.first.code)
                .having((e) => e.line, 'line', want.first.line)),
          );
        }
      });
    }
  });

  group('receipt extras', () {
    test('messages localise', () {
      const e = ReceiptException(ReceiptErrorCode.noLines);
      expect(e.message, 'At least one line is required.');
      expect(e.localized('ne'), contains('लाइन'));
    });

    test('sum overflow is a MoneyException', () {
      final big = Npr.fromPaisa(9007199254740991);
      final doc = ReceiptDocument(
        kind: ReceiptKind.invoice,
        number: 'X',
        issueDate: _date([2082, 5, 10]),
        business: const Business(name: 'S'),
        customer: const Party(name: 'C'),
        lines: [
          ReceiptLine(description: 'a', qtyMilli: 1000, unitPrice: big),
          ReceiptLine(description: 'b', qtyMilli: 1000, unitPrice: big),
        ],
        vatMode: VatMode.none,
        paid: Npr.zero,
        language: ReceiptLanguage.en,
        pageSize: PageSize.a4,
      );
      expect(() => computeTotals(doc), throwsA(isA<MoneyException>()));
    });
  });
}
