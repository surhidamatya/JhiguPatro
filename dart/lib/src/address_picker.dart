/// Headless address picker (guide 11.5, 15.1): a framework-free state machine
/// for a province, district, local level and ward select. No Flutter.
///
/// Rules:
///  - Choosing a province clears district, local level and ward.
///  - Choosing a district clears local level and ward.
///  - Choosing a local level clears the ward (ward ranges differ per level).
///  - Choosing a child with no parent chosen fills the parents from the data,
///    so a saved local level can be restored in one call.
///  - Ward is 1..wards of the local level.
///  - Every action that changes the state notifies listeners once, with the
///    full state. An action that changes nothing does not notify.
///  - Invalid ids or wards throw [AddressException] and leave state unchanged.
library;

import 'address.dart';
import 'generated/address.dart';

/// A complete selection.
class AddressSelection {
  final int provinceId;
  final int districtId;
  final int localLevelId;

  /// Null when the picker has `showWard: false` and no ward is set.
  final int? ward;
  const AddressSelection({
    required this.provinceId,
    required this.districtId,
    required this.localLevelId,
    required this.ward,
  });
}

/// Immutable picker state. A new instance is created on every change.
class AddressPickerState {
  final String language;
  final bool showWard;
  final int? provinceId;
  final int? districtId;
  final int? localLevelId;
  final int? ward;

  /// Always all provinces.
  final List<AddressProvince> provinces;

  /// Districts of the chosen province; empty until one is chosen.
  final List<AddressDistrict> districts;

  /// Local levels of the chosen district; empty until one is chosen.
  final List<AddressLocalLevel> localLevels;

  /// `[1..wards]` of the chosen local level; empty until one is chosen.
  final List<int> wards;

  /// True when a local level is chosen and, if [showWard], a ward too.
  final bool complete;

  /// The full selection when [complete], else null.
  final AddressSelection? selection;

  const AddressPickerState._({
    required this.language,
    required this.showWard,
    required this.provinceId,
    required this.districtId,
    required this.localLevelId,
    required this.ward,
    required this.provinces,
    required this.districts,
    required this.localLevels,
    required this.wards,
    required this.complete,
    required this.selection,
  });
}

typedef _Core = ({int? province, int? district, int? localLevel, int? ward});

const _Core _empty =
    (province: null, district: null, localLevel: null, ward: null);

final Map<int, List<int>> _wardCache = {};
List<int> _wardsFor(int n) => _wardCache.putIfAbsent(
      n,
      () => List<int>.unmodifiable([for (var i = 1; i <= n; i++) i]),
    );

class AddressPicker {
  final bool showWard;
  String _language;
  _Core _core = _empty;
  late AddressPickerState _state;
  final List<void Function(AddressPickerState)> _listeners = [];

  /// [value] restores a saved selection and throws [AddressException] if it
  /// is not valid. [language] is `'en'` or `'ne'`.
  AddressPicker({
    ({int localLevelId, int? ward})? value,
    String language = 'en',
    this.showWard = true,
  }) : _language = language {
    if (value != null) _core = _fromLocalLevel(value.localLevelId, value.ward);
    _state = _resolve();
  }

  AddressPickerState get state => _state;

  /// Returns a function that unsubscribes.
  void Function() subscribe(void Function(AddressPickerState) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  AddressPickerState _resolve() {
    final c = _core;
    final ll = c.localLevel == null ? null : getLocalLevel(c.localLevel!);
    final complete = c.localLevel != null && (!showWard || c.ward != null);
    return AddressPickerState._(
      language: _language,
      showWard: showWard,
      provinceId: c.province,
      districtId: c.district,
      localLevelId: c.localLevel,
      ward: c.ward,
      provinces: provinces(),
      districts: c.province == null ? const [] : districtsOf(c.province!),
      localLevels: c.district == null ? const [] : localLevelsOf(c.district!),
      wards: ll == null ? const [] : _wardsFor(ll.wards),
      complete: complete,
      selection: complete
          ? AddressSelection(
              provinceId: c.province!,
              districtId: c.district!,
              localLevelId: c.localLevel!,
              ward: c.ward,
            )
          : null,
    );
  }

  _Core _fromLocalLevel(int id, int? ward) {
    final ll = getLocalLevel(id);
    if (ll == null) {
      throw const AddressException(AddressErrorCode.unknownLocalLevel);
    }
    if (ward != null && (ward < 1 || ward > ll.wards)) {
      throw const AddressException(AddressErrorCode.badWard);
    }
    final district = getDistrict(ll.districtId)!;
    return (
      province: district.provinceId,
      district: ll.districtId,
      localLevel: id,
      ward: ward,
    );
  }

  void _commit(_Core next, [String? language]) {
    final nextLanguage = language ?? _language;
    if (next == _core && nextLanguage == _language) return;
    _core = next;
    _language = nextLanguage;
    _state = _resolve();
    for (final l in List.of(_listeners)) {
      l(_state);
    }
  }

  /// Null clears the province and everything below it.
  void selectProvince(int? id) {
    if (id == null) return _commit(_empty);
    if (getProvince(id) == null) {
      throw const AddressException(AddressErrorCode.unknownProvince);
    }
    if (id == _core.province) return;
    _commit((province: id, district: null, localLevel: null, ward: null));
  }

  void selectDistrict(int? id) {
    if (id == null) {
      return _commit((
        province: _core.province,
        district: null,
        localLevel: null,
        ward: null,
      ));
    }
    final d = getDistrict(id);
    if (d == null) {
      throw const AddressException(AddressErrorCode.unknownDistrict);
    }
    if (id == _core.district) return;
    _commit(
        (province: d.provinceId, district: id, localLevel: null, ward: null));
  }

  void selectLocalLevel(int? id) {
    if (id == null) {
      return _commit((
        province: _core.province,
        district: _core.district,
        localLevel: null,
        ward: null,
      ));
    }
    final next = _fromLocalLevel(id, null);
    if (id == _core.localLevel) return;
    _commit(next);
  }

  /// Null clears the ward. Throws bad ward outside 1..wards or with no local
  /// level chosen.
  void selectWard(int? ward) {
    if (ward == null) {
      return _commit((
        province: _core.province,
        district: _core.district,
        localLevel: _core.localLevel,
        ward: null,
      ));
    }
    final ll =
        _core.localLevel == null ? null : getLocalLevel(_core.localLevel!);
    if (ll == null || ward < 1 || ward > ll.wards) {
      throw const AddressException(AddressErrorCode.badWard);
    }
    _commit((
      province: _core.province,
      district: _core.district,
      localLevel: _core.localLevel,
      ward: ward,
    ));
  }

  /// Clear everything.
  void clear() => _commit(_empty);

  void setLanguage(String language) => _commit(_core, language);
}
