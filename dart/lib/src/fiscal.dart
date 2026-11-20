/// Nepali fiscal year (guide 7.7, D-15): Shrawan 1 to Ashadh end.
library;

import 'errors.dart';
import 'nepali_calendar.dart';
import 'types.dart';

/// A fiscal year.
class FiscalYear {
  /// BS year the fiscal year starts in.
  final int start;

  /// `start + 1`.
  final int end;

  /// `2081/82`.
  final String code;

  /// Shrawan 1 of [start].
  final NepaliDate first;

  /// Last day of Ashadh of [end].
  final NepaliDate last;

  const FiscalYear({
    required this.start,
    required this.end,
    required this.code,
    required this.first,
    required this.last,
  });
}

/// Fiscal year containing [date]. Throws [InvalidDateException] for a date
/// that does not exist and [OutOfRangeException] when the fiscal year reaches
/// outside the calendar data.
FiscalYear fiscalYear(NepaliDate date) {
  if (!NepaliCalendar.isValidBSDate(date.year, date.month, date.day)) {
    throw InvalidDateException('Invalid BS date', date);
  }
  final start = date.month >= 4 ? date.year : date.year - 1;
  final end = start + 1;
  if (!NepaliCalendar.isValidBSDate(start, 4, 1) ||
      !NepaliCalendar.isValidBSDate(end, 3, 1)) {
    throw OutOfRangeException(
      'Fiscal year is outside the calendar data',
      date,
    );
  }
  return FiscalYear(
    start: start,
    end: end,
    code: '$start/${(end % 100).toString().padLeft(2, '0')}',
    first: NepaliDate(year: start, month: 4, day: 1),
    last: NepaliDate(
      year: end,
      month: 3,
      day: NepaliCalendar.getDaysInBSMonth(end, 3),
    ),
  );
}
