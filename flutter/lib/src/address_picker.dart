import 'package:flutter/material.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

const _neDigits = '०१२३४५६७८९';

String _digits(int n, String language) => language == 'ne'
    ? n.toString().split('').map((c) => _neDigits[int.parse(c)]).join()
    : n.toString();

/// A Nepal address picker: province, district, local level and ward, as four
/// dropdowns over the headless [AddressPicker]. It follows the same rules as the
/// web `<jhigu-address-select>`:
///
/// - Choosing a province clears the district, local level and ward; choosing a
///   district clears the local level and ward; choosing a local level clears the
///   ward (wards differ per local level).
/// - A dropdown is disabled until the one above it has a choice.
/// - The ward list is `1..wards` of the chosen local level.
///
/// ```dart
/// JhiguAddressPicker(
///   language: 'ne',
///   localLevelId: _localLevelId,
///   ward: _ward,
///   onChanged: (s) => setState(() {
///     _localLevelId = s.localLevelId;
///     _ward = s.ward;
///   }),
/// )
/// ```
///
/// [onChanged] gets the full [AddressPickerState] whenever any choice changes:
/// `provinceId`, `districtId`, `localLevelId`, `ward`, `complete` and, when
/// complete, `selection`. Format a complete address with `formatAddress` from
/// `jhigu_patro_utils`.
///
/// [localLevelId] and [ward] restore a saved address; they are optional, and a
/// parent that does not pass them keeps the user's choice. An id that does not
/// exist, or a ward outside the local level, throws an [AddressException].
/// Names come from the shared address data (BS-era numbered province names are
/// the old form; see `data/ADDRESS_NOTES.md`).
class JhiguAddressPicker extends StatefulWidget {
  /// A saved local level id (its district and province are filled in).
  final int? localLevelId;

  /// A saved ward. Ignored when [showWard] is false.
  final int? ward;

  final ValueChanged<AddressPickerState>? onChanged;

  /// `'en'` or `'ne'`.
  final String language;

  /// Show the ward dropdown. When false, the reported ward is always null.
  final bool showWard;

  /// Applied to every dropdown; its `labelText` is replaced by the level's name.
  final InputDecoration? decoration;
  final bool enabled;

  /// Space between the dropdowns.
  final double spacing;

  const JhiguAddressPicker({
    super.key,
    this.localLevelId,
    this.ward,
    this.onChanged,
    this.language = 'en',
    this.showWard = true,
    this.decoration,
    this.enabled = true,
    this.spacing = 12,
  });

  @override
  State<JhiguAddressPicker> createState() => _JhiguAddressPickerState();
}

class _JhiguAddressPickerState extends State<JhiguAddressPicker> {
  late AddressPicker _picker;
  void Function()? _unsubscribe;
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    _build(_saved());
  }

  ({int localLevelId, int? ward})? _saved() => widget.localLevelId == null
      ? null
      : (
          localLevelId: widget.localLevelId!,
          ward: widget.showWard ? widget.ward : null,
        );

  void _build(({int localLevelId, int? ward})? value) {
    _unsubscribe?.call();
    _picker = AddressPicker(
      value: value,
      language: widget.language,
      showWard: widget.showWard,
    );
    _unsubscribe = _picker.subscribe(_onState);
  }

  void _onState(AddressPickerState s) {
    if (!mounted) return;
    setState(() {});
    if (!_syncing) widget.onChanged?.call(s);
  }

  @override
  void didUpdateWidget(JhiguAddressPicker old) {
    super.didUpdateWidget(old);
    if (old.showWard != widget.showWard) {
      // Rebuild from what is chosen; a hidden ward is never part of the value.
      final s = _picker.state;
      final keep = s.localLevelId == null
          ? null
          : (
              localLevelId: s.localLevelId!,
              ward: widget.showWard ? s.ward : null,
            );
      _build(keep);
      setState(() {});
      return;
    }
    if (old.language != widget.language) _picker.setLanguage(widget.language);
    // Follow the parent only when it changes the saved address.
    if (old.localLevelId != widget.localLevelId || old.ward != widget.ward) {
      final s = _picker.state;
      if (s.localLevelId != widget.localLevelId ||
          (widget.showWard && s.ward != widget.ward)) {
        _syncing = true;
        try {
          if (widget.localLevelId == null) {
            _picker.clear();
          } else {
            _picker.selectLocalLevel(widget.localLevelId);
            _picker.selectWard(widget.showWard ? widget.ward : null);
          }
        } finally {
          _syncing = false;
        }
      }
    }
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    super.dispose();
  }

  Widget _dropdown<T>({
    required String label,
    required String choose,
    required T? value,
    required List<({T id, String text})> items,
    required ValueChanged<T?>? onChanged,
    required Key fieldKey,
  }) {
    final base = widget.decoration ?? const InputDecoration();
    return InputDecorator(
      decoration: base.copyWith(labelText: label),
      // The label always floats: the empty choice shows "Select" below it.
      isEmpty: false,
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          key: fieldKey,
          isExpanded: true,
          isDense: true,
          value: value,
          items: [
            DropdownMenuItem<T>(value: null, child: Text(choose)),
            for (final i in items)
              DropdownMenuItem<T>(value: i.id, child: Text(i.text)),
          ],
          onChanged: widget.enabled ? onChanged : null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _picker.state;
    final lang = s.language;
    final t = getStrings(lang).address;

    final children = <Widget>[
      _dropdown<int>(
        fieldKey: const ValueKey('address-province'),
        label: t.province,
        choose: t.choose,
        value: s.provinceId,
        items: [
          for (final p in s.provinces)
            (id: p.id, text: lang == 'ne' ? p.ne : p.en)
        ],
        onChanged: (v) => _picker.selectProvince(v),
      ),
      _dropdown<int>(
        fieldKey: const ValueKey('address-district'),
        label: t.district,
        choose: t.choose,
        value: s.districtId,
        items: [
          for (final d in s.districts)
            (id: d.id, text: lang == 'ne' ? d.ne : d.en)
        ],
        onChanged:
            s.provinceId == null ? null : (v) => _picker.selectDistrict(v),
      ),
      _dropdown<int>(
        fieldKey: const ValueKey('address-local-level'),
        label: t.localLevel,
        choose: t.choose,
        value: s.localLevelId,
        items: [
          for (final l in s.localLevels)
            (id: l.id, text: lang == 'ne' ? l.ne : l.en)
        ],
        onChanged:
            s.districtId == null ? null : (v) => _picker.selectLocalLevel(v),
      ),
      if (s.showWard)
        _dropdown<int>(
          fieldKey: const ValueKey('address-ward'),
          label: t.wardLabel,
          choose: t.choose,
          value: s.ward,
          items: [
            for (final w in s.wards)
              (id: w, text: t.ward.replaceAll('{n}', _digits(w, lang)))
          ],
          onChanged:
              s.localLevelId == null ? null : (v) => _picker.selectWard(v),
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) SizedBox(height: widget.spacing),
          children[i],
        ],
      ],
    );
  }
}
