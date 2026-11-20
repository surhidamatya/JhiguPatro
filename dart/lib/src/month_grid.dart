/// Month grid for a calendar view (guide 7.8, D-16, D-17).
///
/// Always whole weeks: 5 or 6 rows of 7 cells (`sixRows: true` forces 6).
/// Cells before and after the month show the neighbouring months' days when
/// those are inside the calendar data; otherwise they are blank ([GridCell.bs]
/// and [GridCell.ad] null, `inRange` false). Needs the calendar initialised.
library;

import 'errors.dart';
import 'types.dart';

/// One cell of a month grid.
class GridCell<E> {
  /// The BS date, or null for a blank cell outside the calendar data.
  final NepaliDate? bs;

  /// The AD date as UTC midnight, or null for a blank cell.
  final DateTime? ad;

  /// True for the days of the requested month.
  final bool inMonth;

  /// True when the cell has a date (it is inside the calendar data).
  final bool inRange;
  final bool isToday;

  /// Saturday by default; see `weekendDays` of [getMonthGrid].
  final bool isWeekend;
  final List<E> events;

  const GridCell({
    required this.bs,
    required this.ad,
    required this.inMonth,
    required this.inRange,
    required this.isToday,
    required this.isWeekend,
    required this.events,
  });
}

/// Grid for BS [year] and [month] as rows of 7 cells.
///
/// - [weekStartsOn]: first column, 0 = Sunday ... 6 = Saturday.
/// - [events]: events by `YYYY-MM-DD` key, for any day shown.
/// - [getEvents]: called once per dated cell on every call (nothing is
///   cached); its events are added after those from [events].
/// - [weekendDays]: weekday numbers shown as weekend. Default Saturday.
/// - [today]: the day to mark as today. Default: today in Nepal.
///
/// Throws [InvalidDateException] or [OutOfRangeException] for a month outside
/// the data and [InvalidDataException] for a bad [weekStartsOn].
List<List<GridCell<E>>> getMonthGrid<E>(
  int year,
  int month, {
  int weekStartsOn = 0,
  Map<String, List<E>>? events,
  List<E> Function(NepaliDate date)? getEvents,
  List<int> weekendDays = const [6],
  bool sixRows = false,
  NepaliDate? today,
}) {
  if (weekStartsOn < 0 || weekStartsOn > 6) {
    throw InvalidDataException(
      'weekStartsOn must be an integer from 0 to 6',
      weekStartsOn,
    );
  }
  final first = NepaliDate.checked(year, month, 1);
  final weekend = weekendDays.toSet();
  final todayDate = today ?? NepaliDate.today();

  final leading = (first.weekday - weekStartsOn + 7) % 7;
  var total = ((leading + first.daysInMonth + 6) ~/ 7) * 7;
  if (sixRows && total < 42) total = 42;

  final firstDay = first.dayNumber;
  final cells = <GridCell<E>>[];
  for (var i = 0; i < total; i++) {
    NepaliDate? date;
    try {
      date = NepaliDate.fromDayNumber(firstDay - leading + i);
    } on OutOfRangeException {
      date = null;
    }
    if (date == null) {
      cells.add(
        GridCell<E>(
          bs: null,
          ad: null,
          inMonth: false,
          inRange: false,
          isToday: false,
          isWeekend: weekend.contains((weekStartsOn + (i % 7)) % 7),
          events: const [],
        ),
      );
      continue;
    }
    final cellEvents = <E>[
      ...?events?[date.toIsoString()],
      if (getEvents != null) ...getEvents(date),
    ];
    cells.add(
      GridCell<E>(
        bs: date,
        ad: date.toAD(),
        inMonth: date.year == year && date.month == month,
        inRange: true,
        isToday: date.isSame(todayDate),
        isWeekend: weekend.contains(date.weekday),
        events: cellEvents,
      ),
    );
  }

  return [
    for (var r = 0; r < cells.length; r += 7) cells.sublist(r, r + 7),
  ];
}
