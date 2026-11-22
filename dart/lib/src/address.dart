/// Nepal address data and search (guide section 11). Pure logic, no network.
///
/// Data comes from data/address.json via generated/address.dart.
///
/// Known divergence from the TypeScript port: TypeScript normalises the search
/// query to Unicode NFC; Dart's core library has no normaliser, so the query
/// is used as typed. The data itself is NFC.
library;

import 'generated/address.dart';
import 'generated/strings.dart';
import 'nepali_calendar.dart' show nepaliDigits;

/// Why an address could not be formatted.
enum AddressErrorCode {
  unknownProvince('UNKNOWN_PROVINCE'),
  unknownDistrict('UNKNOWN_DISTRICT'),
  unknownLocalLevel('UNKNOWN_LOCAL_LEVEL'),
  badWard('BAD_WARD');

  const AddressErrorCode(this.name_);

  /// Stable code shared with the TypeScript library.
  final String name_;
}

/// Typed address error. [message] is English; use [localized] for `ne`.
class AddressException implements Exception {
  final AddressErrorCode code;
  const AddressException(this.code);

  String get message => localized('en');

  String localized(String language) {
    final a = getStrings(language).address;
    return switch (code) {
      AddressErrorCode.unknownProvince => a.unknownProvince,
      AddressErrorCode.unknownDistrict => a.unknownDistrict,
      AddressErrorCode.unknownLocalLevel => a.unknownLocalLevel,
      AddressErrorCode.badWard => a.badWard,
    };
  }

  @override
  String toString() => 'AddressException(${code.name_}): $message';
}

// ── Lookups ──────────────────────────────────────────────────────────────────

class _Index {
  final Map<int, AddressProvince> province;
  final Map<int, AddressDistrict> district;
  final Map<int, AddressLocalLevel> localLevel;
  final Map<int, List<AddressDistrict>> districtsByProvince;
  final Map<int, List<AddressLocalLevel>> localLevelsByDistrict;
  _Index(
    this.province,
    this.district,
    this.localLevel,
    this.districtsByProvince,
    this.localLevelsByDistrict,
  );
}

_Index? _index;

_Index _getIndex() {
  final existing = _index;
  if (existing != null) return existing;
  final byProvince = <int, List<AddressDistrict>>{};
  for (final d in addressDistricts) {
    byProvince.putIfAbsent(d.provinceId, () => []).add(d);
  }
  final byDistrict = <int, List<AddressLocalLevel>>{};
  for (final m in addressLocalLevels) {
    byDistrict.putIfAbsent(m.districtId, () => []).add(m);
  }
  return _index = _Index(
    {for (final p in addressProvinces) p.id: p},
    {for (final d in addressDistricts) d.id: d},
    {for (final m in addressLocalLevels) m.id: m},
    byProvince,
    byDistrict,
  );
}

/// All 7 provinces.
List<AddressProvince> provinces() => addressProvinces;

/// Districts of a province, in data order. Empty for an unknown id.
List<AddressDistrict> districtsOf(int provinceId) =>
    _getIndex().districtsByProvince[provinceId] ?? const [];

/// Local levels of a district, in data order. Empty for an unknown id.
List<AddressLocalLevel> localLevelsOf(int districtId) =>
    _getIndex().localLevelsByDistrict[districtId] ?? const [];

AddressProvince? getProvince(int id) => _getIndex().province[id];

AddressDistrict? getDistrict(int id) => _getIndex().district[id];

AddressLocalLevel? getLocalLevel(int id) => _getIndex().localLevel[id];

// ── Search ───────────────────────────────────────────────────────────────────

enum AddressKind { province, district, localLevel }

enum AddressMatchRank { exact, prefix, substring }

/// Which name a search matches against.
enum AddressSearchLanguage { en, ne, auto }

/// One search result.
class AddressMatch {
  final AddressKind kind;
  final int id;
  final String en;
  final String ne;

  /// `'en'` or `'ne'`: which name matched.
  final String matchedOn;
  final AddressMatchRank rank;
  const AddressMatch({
    required this.kind,
    required this.id,
    required this.en,
    required this.ne,
    required this.matchedOn,
    required this.rank,
  });
}

class _Entry {
  final AddressKind kind;
  final int id;
  final String en;
  final String ne;
  final String enLower;
  _Entry(this.kind, this.id, this.en, this.ne) : enLower = en.toLowerCase();
}

List<_Entry>? _entries;

List<_Entry> _getEntries() => _entries ??= [
      for (final r in addressProvinces)
        _Entry(AddressKind.province, r.id, r.en, r.ne),
      for (final r in addressDistricts)
        _Entry(AddressKind.district, r.id, r.en, r.ne),
      for (final r in addressLocalLevels)
        _Entry(AddressKind.localLevel, r.id, r.en, r.ne),
    ];

AddressMatchRank? _rankOf(String haystack, String needle) {
  if (haystack == needle) return AddressMatchRank.exact;
  if (haystack.startsWith(needle)) return AddressMatchRank.prefix;
  if (haystack.contains(needle)) return AddressMatchRank.substring;
  return null;
}

/// Search provinces, districts and local levels by name.
///
/// The query is trimmed; English is compared lower-case. Ranking: exact, then
/// prefix, then substring; ties by matched-name length, then province before
/// district before local level, then id. [limit] defaults to 10.
List<AddressMatch> searchAddress(
  String query, {
  AddressSearchLanguage language = AddressSearchLanguage.auto,
  int limit = 10,
}) {
  final q = query.trim();
  if (q.isEmpty || limit < 1) return const [];
  final qEn = q.toLowerCase();

  final found = <({AddressMatch m, int len})>[];
  for (final e in _getEntries()) {
    ({String on, AddressMatchRank rank, int len})? best;
    if (language != AddressSearchLanguage.ne) {
      final rank = _rankOf(e.enLower, qEn);
      if (rank != null) best = (on: 'en', rank: rank, len: e.en.length);
    }
    if (language != AddressSearchLanguage.en) {
      final rank = _rankOf(e.ne, q);
      if (rank != null) {
        if (best == null ||
            rank.index < best.rank.index ||
            (rank == best.rank && e.ne.length < best.len)) {
          best = (on: 'ne', rank: rank, len: e.ne.length);
        }
      }
    }
    if (best != null) {
      found.add((
        m: AddressMatch(
          kind: e.kind,
          id: e.id,
          en: e.en,
          ne: e.ne,
          matchedOn: best.on,
          rank: best.rank,
        ),
        len: best.len,
      ));
    }
  }
  found.sort((a, b) {
    var c = a.m.rank.index - b.m.rank.index;
    if (c != 0) return c;
    c = a.len - b.len;
    if (c != 0) return c;
    c = a.m.kind.index - b.m.kind.index;
    if (c != 0) return c;
    return a.m.id - b.m.id;
  });
  return [for (final f in found.take(limit)) f.m];
}

// ── Format ───────────────────────────────────────────────────────────────────

String _digits(int n, String language) => language == 'ne'
    ? n.toString().split('').map((c) => nepaliDigits[int.parse(c)]).join()
    : n.toString();

/// Format an address as `Street, Tole, Ward N, Local Level, District, Province`
/// (empty street and tole are skipped). [language] is `'ne'` or `'en'`; Nepali
/// output uses Nepali names and Devanagari ward digits. Throws
/// [AddressException] for an unknown local level or a ward outside 1..wards.
String formatAddress({
  required int localLevelId,
  required int ward,
  String? tole,
  String? street,
  String language = 'en',
}) {
  final ll = getLocalLevel(localLevelId);
  if (ll == null) {
    throw const AddressException(AddressErrorCode.unknownLocalLevel);
  }
  if (ward < 1 || ward > ll.wards) {
    throw const AddressException(AddressErrorCode.badWard);
  }
  final district = getDistrict(ll.districtId)!;
  final province = getProvince(district.provinceId)!;
  final ne = language == 'ne';
  final wardLabel = getStrings(language).address.ward.replaceAll(
        '{n}',
        _digits(ward, language),
      );
  return [
    street?.trim(),
    tole?.trim(),
    wardLabel,
    ne ? ll.ne : ll.en,
    ne ? district.ne : district.en,
    ne ? province.ne : province.en,
  ].where((s) => s != null && s.isNotEmpty).join(', ');
}
