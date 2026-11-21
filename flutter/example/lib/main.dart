import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:jhigu_patro_flutter/jhigu_patro_flutter.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:jhigu_patro_utils/receipt_pdf.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final cal = jsonDecode(await rootBundle.loadString('assets/nepali_calendar_data.json'))
      as Map<String, dynamic>;
  NepaliCalendar.initialize(InlineCalendarDataSource(
    years: (cal['years'] as Map<String, dynamic>)
        .map((k, v) => MapEntry(int.parse(k), List<int>.from(v as List))),
    supportedStartYear: cal['supportedRange']['start'] as int,
    supportedEndYear: cal['supportedRange']['end'] as int,
    verifiedThrough: cal['verifiedThrough'] as int,
  ));
  runApp(const ExampleApp());
}

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Jhigu widgets',
        theme: ThemeData(colorSchemeSeed: const Color(0xFF1D4ED8), useMaterial3: true),
        darkTheme: ThemeData(
          colorSchemeSeed: const Color(0xFF1D4ED8),
          brightness: Brightness.dark,
          useMaterial3: true,
        ),
        home: const Home(),
      );
}

class Home extends StatefulWidget {
  const Home({super.key});

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  NepaliDate? _en;
  NepaliDate? _ne = NepaliDate.checked(2082, 5, 12);
  String _log = '';
  Uint8List? _png;
  String _pdfNote = '';

  Future<void> _renderNepali() async {
    final renderer = FlutterDevanagariRenderer();
    final r = await renderer.render('श्रेष्ठ क्ष भदौ २०८२',
        fontSize: 20, bold: false, color: 0xFFFFFFFF);
    final pdf = await buildReceiptPdf(
      ReceiptDocument(
        kind: ReceiptKind.invoice,
        number: 'INV-001',
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
      options: ReceiptPdfOptions(renderer: renderer),
    );
    setState(() {
      _png = r.png;
      _pdfNote =
          'picture ${r.widthPt.toStringAsFixed(1)} x ${r.heightPt.toStringAsFixed(1)} pt; PDF ${pdf.bytes.length} bytes, warnings: ${pdf.warnings.length}';
    });
  }

  void _note(String s) => setState(() => _log = '$s\n$_log');

  @override
  Widget build(BuildContext context) {
    final today = NepaliDate.checked(2082, 5, 10);
    return Scaffold(
      appBar: AppBar(title: const Text('Jhigu widgets')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 24,
          runSpacing: 24,
          children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('English, AD shown'),
              JhiguDatePicker(
                value: _en,
                today: today,
                onChanged: (d) {
                  setState(() => _en = d);
                  _note('en: ${d?.toIsoString()}');
                },
              ),
            ]),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Nepali, min 2082-05-05, max 2082-06-20'),
              JhiguDatePicker(
                value: _ne,
                today: today,
                language: 'ne',
                min: NepaliDate.checked(2082, 5, 5),
                max: NepaliDate.checked(2082, 6, 20),
                onChanged: (d) {
                  setState(() => _ne = d);
                  _note('ne: ${d?.toIsoString()}');
                },
              ),
            ]),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('JhiguCalendar with events'),
              JhiguCalendar(
                today: today,
                year: 2082,
                month: 5,
                events: const {
                  '2082-05-12': ['Teej'],
                  '2082-05-15': ['Fulpati', 'Holiday'],
                  '2082-06-03': ['Laxmi Puja'],
                },
                onSelect: (d, e) => _note('cal: ${d.toIsoString()} $e'),
                onMonthChanged: (y, m) => _note('month: $y-$m'),
              ),
            ]),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('JhiguRangePicker'),
              JhiguRangePicker(
                today: today,
                onChanged: (a, b) =>
                    _note('range: ${a?.toIsoString()} to ${b?.toIsoString()}'),
              ),
            ]),
            SizedBox(
              width: 340,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('JhiguMoneyField and JhiguPhoneField'),
                const SizedBox(height: 8),
                JhiguMoneyField(
                  decoration: const InputDecoration(
                      labelText: 'Amount', prefixText: 'Rs. ', border: OutlineInputBorder()),
                  onChanged: (a) => _note('money: ${a?.paisa}'),
                ),
                const SizedBox(height: 16),
                JhiguPhoneField(
                  decoration: const InputDecoration(
                      labelText: 'Mobile', border: OutlineInputBorder()),
                  onChanged: (e) => _note('phone: $e'),
                ),
              ]),
            ),
            SizedBox(
              width: 340,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('JhiguAddressPicker'),
                const SizedBox(height: 8),
                JhiguAddressPicker(
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                  onChanged: (s) => _note(s.complete
                      ? 'address: ${formatAddress(localLevelId: s.localLevelId!, ward: s.ward ?? 1)}'
                      : 'address: ${s.provinceId} ${s.districtId} ${s.localLevelId} ${s.ward}'),
                ),
              ]),
            ),
            SizedBox(
              width: 340,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('JhiguDateField and dialogs'),
                const SizedBox(height: 8),
                JhiguDateField(
                  decoration: const InputDecoration(
                      labelText: 'Date of birth', border: OutlineInputBorder()),
                  max: today,
                  today: today,
                  onChanged: (d) => _note('field: ${d?.toIsoString()}'),
                ),
                const SizedBox(height: 8),
                Builder(
                  builder: (context) => FilledButton(
                    onPressed: () async {
                      final r = await showJhiguDateRangePicker(
                          context: context, today: today);
                      _note('range dialog: ${r == null ? null : '${r.start.toIsoString()} to ${r.end.toIsoString()}'}');
                    },
                    child: const Text('Pick a range in a dialog'),
                  ),
                ),
              ]),
            ),
            SizedBox(
              width: 340,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('FlutterDevanagariRenderer'),
                const SizedBox(height: 8),
                FilledButton(
                    onPressed: _renderNepali, child: const Text('Render Nepali + build PDF')),
                if (_png != null) ...[
                  const SizedBox(height: 8),
                  Container(
                      color: Colors.black,
                      padding: const EdgeInsets.all(8),
                      child: Image.memory(_png!, key: const Key('png'))),
                  Text(_pdfNote, key: const Key('pdfnote')),
                ],
              ]),
            ),
            SizedBox(width: 340, child: Text(_log.isEmpty ? '(events appear here)' : _log, key: const Key('log'))),
          ],
        ),
      ),
    );
  }
}
