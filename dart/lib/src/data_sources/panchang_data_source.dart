/// One tithi inside a day. Same fields as the TS `TithiSegment`.
class TithiSegment {
  /// 1 to 15 (15 is पूर्णिमा in the शुक्ल paksha and औंसी in the कृष्ण paksha).
  final int tithiNumber;

  /// Nepali name, e.g. प्रतिपदा.
  final String tithiName;

  /// शुक्ल or कृष्ण.
  final String paksha;

  /// Minutes from 00:00 Nepal time.
  final int startMinute;

  /// Minutes from 00:00 Nepal time. 1440 is the end of the day; a day's last real tithi can run past
  /// it (the data has a few of these).
  final int endMinute;

  const TithiSegment({
    required this.tithiNumber,
    required this.tithiName,
    required this.paksha,
    required this.startMinute,
    required this.endMinute,
  });

  factory TithiSegment.fromJson(Map<String, dynamic> j) => TithiSegment(
        tithiNumber: j['tithiNumber'] as int,
        tithiName: j['tithiName'] as String,
        paksha: j['paksha'] as String,
        startMinute: j['startMinute'] as int,
        endMinute: j['endMinute'] as int,
      );
}

/// One BS day of panchang data.
class PanchangDay {
  final int bsDay;

  /// `YYYY-MM-DD` Gregorian date.
  final String adDate;
  final List<TithiSegment> tithiSegments;

  const PanchangDay({
    required this.bsDay,
    required this.adDate,
    required this.tithiSegments,
  });

  factory PanchangDay.fromJson(Map<String, dynamic> j) => PanchangDay(
        bsDay: j['bsDay'] as int,
        adDate: j['adDate'] as String,
        tithiSegments: [
          for (final s in j['tithiSegments'] as List)
            TithiSegment.fromJson(s as Map<String, dynamic>),
        ],
      );
}

/// Holds panchang (tithi) data for one or more BS years, with O(1) day lookup and a tithi-at-minute
/// query. Port of the TS `PanchangDataSource`: same answers for the same data (shared vectors in
/// `testdata/tithi.json`).
///
/// ```dart
/// final panchang = PanchangDataSource()
///   ..addYear(jsonDecode(File('data/2082_tithi.json').readAsStringSync()));
/// panchang.tithiAt(2082, 1, 3, 720);
/// ```
///
/// Reading the file (an asset, a file, a request) is up to the app; hand over the decoded JSON.
class PanchangDataSource {
  // year -> ("month-bsDay" -> day)
  final Map<int, Map<String, PanchangDay>> _years = {};
  int? _last;

  /// Adds one year from the decoded file: a list holding one year object, or the year object itself.
  /// Loading a year again replaces it.
  void addYear(Object json) {
    final root = (json is List ? json.first : json) as Map<String, dynamic>;
    final lookup = <String, PanchangDay>{};
    for (final m in root['months'] as List) {
      final month = (m as Map<String, dynamic>)['month'] as int;
      for (final d in m['days'] as List) {
        final day = PanchangDay.fromJson(d as Map<String, dynamic>);
        lookup['$month-${day.bsDay}'] = day;
      }
    }
    final year = root['year'] as int;
    _years[year] = lookup;
    _last = year;
  }

  /// The year loaded last, or null when nothing is loaded.
  int? get loadedYear => _last;

  /// Every loaded year, ascending.
  List<int> get loadedYears => _years.keys.toList()..sort();

  /// The day, or null when that year is not loaded or the day is not in it.
  PanchangDay? getDay(int bsYear, int bsMonth, int bsDay) =>
      _years[bsYear]?['$bsMonth-$bsDay'];

  /// The tithi at sunrise (minute 375, 06:15 Nepal time). If no segment covers it, the first
  /// segment stands in. Null when the year is not loaded, the day is not in it, or it has no segments.
  TithiSegment? sunriseTithi(int bsYear, int bsMonth, int bsDay) {
    final day = getDay(bsYear, bsMonth, bsDay);
    if (day == null) return null;
    for (final s in day.tithiSegments) {
      if (375 >= s.startMinute && 375 < s.endMinute) return s;
    }
    return day.tithiSegments.isEmpty ? null : day.tithiSegments.first;
  }

  /// The tithi at [minuteOfDay] (0 to 1439, Nepal time), or null when none covers it.
  TithiSegment? tithiAt(int bsYear, int bsMonth, int bsDay, int minuteOfDay) {
    final day = getDay(bsYear, bsMonth, bsDay);
    if (day == null) return null;
    for (final s in day.tithiSegments) {
      if (minuteOfDay >= s.startMinute && minuteOfDay < s.endMinute) return s;
    }
    return null;
  }
}
