import '../types.dart';

/// Data source backed by an in-memory map.
///
/// Ideal for Flutter apps (load from assets), server Dart, or tests.
///
/// Usage:
/// ```dart
/// final source = InlineCalendarDataSource(
///   years: {2082: [31,31,32,31,31,31,30,29,30,29,30,30]},
///   startYear: 2082,
///   endYear: 2082,
/// );
/// NepaliCalendar.initialize(source);
/// ```
class InlineCalendarDataSource implements NepaliCalendarDataSource {
  final Map<int, List<int>> _years;
  @override final int supportedStartYear;
  @override final int supportedEndYear;

  const InlineCalendarDataSource({
    required Map<int, List<int>> years,
    required this.supportedStartYear,
    required this.supportedEndYear,
  }) : _years = years;

  @override
  List<int>? getYearData(int year) => _years[year];
}
