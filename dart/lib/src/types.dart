/// Core types for Jhigu Patro Utils.

enum CalendarType { ad, bs }

/// A Bikram Sambat (Nepali) date.
class NepaliDate {
  final int year;
  final int month; // 1–12
  final int day;

  const NepaliDate({required this.year, required this.month, required this.day});

  @override
  String toString() => 'NepaliDate($year/$month/$day)';

  @override
  bool operator ==(Object other) =>
      other is NepaliDate && year == other.year && month == other.month && day == other.day;

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
}
