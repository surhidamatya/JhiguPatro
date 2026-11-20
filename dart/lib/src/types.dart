/// Core types for Jhigu Patro Utils.

import 'errors.dart';
import 'nepali_calendar.dart';

enum CalendarType { ad, bs }

/// Unit for [NepaliDate.diff].
enum DiffUnit { days, months, years }

/// An immutable BS date (guide 7.4).
///
/// The `const` constructor does not check the date (kept for existing code);
/// use [NepaliDate.checked] to validate. Arithmetic uses day numbers (whole
/// days since 1970-01-01 UTC) built from calendar fields only, so it never
/// depends on the time zone. Needs the calendar initialised.
class NepaliDate implements Comparable<NepaliDate> {
  final int year;
  final int month; // 1–12
  final int day;

  const NepaliDate(
      {required this.year, required this.month, required this.day});

  /// Validated constructor. Throws [InvalidDateException] if the date does not
  /// exist and [OutOfRangeException] if the year is outside the calendar data.
  factory NepaliDate.checked(int year, int month, int day) {
    if (!NepaliCalendar.isValidBSDate(year, month, day)) {
      final r = NepaliCalendar.getSupportedBSRange();
      final details = '$year-$month-$day';
      if (year < r.start || year > r.end) {
        throw OutOfRangeException(
            'BS year is outside the calendar data', details);
      }
      throw InvalidDateException('Invalid BS date', details);
    }
    return NepaliDate(year: year, month: month, day: day);
  }

  /// True if the date exists and is inside the calendar data.
  static bool isValid(int year, int month, int day) =>
      NepaliCalendar.isValidBSDate(year, month, day);

  static const int _msPerDay = 86400000;

  static ({int min, int max}) _dayRange() {
    final r = NepaliCalendar.getSupportedBSRange();
    return (
      min: NepaliDate(year: r.start, month: 1, day: 1).dayNumber,
      max: NepaliDate(
        year: r.end,
        month: 12,
        day: NepaliCalendar.getDaysInBSMonth(r.end, 12),
      ).dayNumber,
    );
  }

  /// The BS date for an AD date, read from its year/month/day fields (the time
  /// of day is ignored). Throws [OutOfRangeException] outside the data.
  factory NepaliDate.fromAD(DateTime date) {
    final n =
        DateTime.utc(date.year, date.month, date.day).millisecondsSinceEpoch ~/
            _msPerDay;
    return NepaliDate.fromDayNumber(n);
  }

  /// Date for a day number (whole days since 1970-01-01 UTC).
  factory NepaliDate.fromDayNumber(int n) {
    final r = _dayRange();
    if (n < r.min || n > r.max) {
      throw OutOfRangeException('Day number is outside the calendar data', n);
    }
    return NepaliCalendar.convertADToBS(
      DateTime.fromMillisecondsSinceEpoch(n * _msPerDay, isUtc: true),
    );
  }

  /// Today in Nepal (UTC+05:45), whatever the device time zone. Pass [now] in
  /// tests.
  factory NepaliDate.today({DateTime? now}) {
    final nepal = (now ?? DateTime.now())
        .toUtc()
        .add(const Duration(hours: 5, minutes: 45));
    return NepaliDate.fromAD(DateTime.utc(nepal.year, nepal.month, nepal.day));
  }

  int get daysInMonth => NepaliCalendar.getDaysInBSMonth(year, month);

  /// 0 = Sunday ... 6 = Saturday.
  int get weekday => (dayNumber + 4) % 7;

  /// Whole days since 1970-01-01 UTC.
  int get dayNumber =>
      NepaliCalendar.convertBSToAD(year, month, day).millisecondsSinceEpoch ~/
      _msPerDay;

  /// The AD date as UTC midnight.
  DateTime toAD() => NepaliCalendar.convertBSToAD(year, month, day);

  NepaliDate addDays(int n) => NepaliDate.fromDayNumber(dayNumber + n);

  /// The day is clamped to the length of the target month.
  NepaliDate addMonths(int n) {
    final total = year * 12 + (month - 1) + n;
    final y = (total / 12).floor();
    final m = total - y * 12 + 1;
    final r = NepaliCalendar.getSupportedBSRange();
    if (y < r.start || y > r.end) {
      throw OutOfRangeException(
        'Result is outside the calendar data',
        '$y-$m',
      );
    }
    final dim = NepaliCalendar.getDaysInBSMonth(y, m);
    return NepaliDate(year: y, month: m, day: day < dim ? day : dim);
  }

  NepaliDate addYears(int n) => addMonths(n * 12);

  /// `this - other` in [unit]. Months and years count whole units: step back
  /// one month if the later date's day is smaller than the earlier one's;
  /// years are whole months divided by 12, toward zero.
  int diff(NepaliDate other, {DiffUnit unit = DiffUnit.days}) {
    if (unit == DiffUnit.days) return dayNumber - other.dayNumber;
    var later = this;
    var earlier = other;
    var sign = 1;
    if (compareTo(other) < 0) {
      later = other;
      earlier = this;
      sign = -1;
    }
    var months =
        (later.year - earlier.year) * 12 + (later.month - earlier.month);
    if (later.day < earlier.day) months -= 1;
    final out = unit == DiffUnit.months ? months : months ~/ 12;
    return sign * out;
  }

  /// Compare as (year, month, day): negative, zero or positive. Needs no
  /// calendar data.
  @override
  int compareTo(NepaliDate other) {
    if (year != other.year) return year < other.year ? -1 : 1;
    if (month != other.month) return month < other.month ? -1 : 1;
    if (day != other.day) return day < other.day ? -1 : 1;
    return 0;
  }

  bool isBefore(NepaliDate other) => compareTo(other) < 0;
  bool isAfter(NepaliDate other) => compareTo(other) > 0;
  bool isSame(NepaliDate other) => compareTo(other) == 0;

  bool operator <(NepaliDate other) => isBefore(other);
  bool operator >(NepaliDate other) => isAfter(other);
  bool operator <=(NepaliDate other) => compareTo(other) <= 0;
  bool operator >=(NepaliDate other) => compareTo(other) >= 0;

  NepaliDate startOfMonth() => NepaliDate.checked(year, month, 1);
  NepaliDate endOfMonth() => NepaliDate.checked(year, month, daysInMonth);

  /// `2081-01-15`.
  String toIsoString() =>
      '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

  @override
  String toString() => 'NepaliDate($year/$month/$day)';

  @override
  bool operator ==(Object other) =>
      other is NepaliDate &&
      year == other.year &&
      month == other.month &&
      day == other.day;

  @override
  int get hashCode => Object.hash(year, month, day);
}

/// Abstract data source for BS calendar year data.
///
/// Implement this to provide year data from any source:
/// hardcoded map, JSON asset, remote API, etc.
abstract class NepaliCalendarDataSource {
  /// Returns the 12-element list of days-per-month for [year], or null if unavailable.
  List<int>? getYearData(int year);

  /// First supported BS year.
  int get supportedStartYear;

  /// Last supported BS year.
  int get supportedEndYear;

  /// Last BS year checked against agreeing sources, or null if unknown
  /// (every year is then reported as unverified). Years after it still
  /// convert, but [NepaliCalendar.getDateAccuracy] reports a warning.
  int? get verifiedThrough;
}

/// Accuracy of a BS date. See [NepaliCalendar.getDateAccuracy].
class DateAccuracy {
  final bool verified;
  final String? warning;

  const DateAccuracy({required this.verified, this.warning});

  @override
  String toString() => 'DateAccuracy(verified: $verified, warning: $warning)';

  @override
  bool operator ==(Object other) =>
      other is DateAccuracy &&
      verified == other.verified &&
      warning == other.warning;

  @override
  int get hashCode => Object.hash(verified, warning);
}
