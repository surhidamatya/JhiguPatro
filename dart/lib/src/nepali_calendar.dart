/// Jhigu Patro Utils — Core Calendar Engine (Dart)
///
/// Converts between Gregorian (AD) and Bikram Sambat (BS/Nepali) dates.
/// Zero external dependencies. Works in Flutter, Dart CLI, and server Dart.
///
/// Setup (call once before using conversion functions):
/// ```dart
/// NepaliCalendar.initialize(InlineCalendarDataSource(years: ..., ...));
/// ```
library;

import 'types.dart';

// ============================================================================
// CONSTANTS
// ============================================================================

const int _bsBaseYear = 2000;

/// BS 2000/1/1 = AD 1943-04-14
final DateTime _bsBaseDate = DateTime.utc(1943, 4, 14);

const Duration _nepalOffset = Duration(hours: 5, minutes: 45);

// ============================================================================
// NAMES
// ============================================================================

const List<String> nepaliMonthsEn = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

const List<String> nepaliMonthsNe = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फागुन', 'चैत्र',
];

const List<String> englishMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/// Sunday = index 0 (matches DateTime.sunday = 7, handled below).
const List<String> nepaliDaysEn = [
  'Aaitabar', 'Sombar', 'Mangalbar', 'Budhabar', 'Bihibar', 'Shukrabar', 'Shanibar',
];

const List<String> nepaliDaysNe = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार',
];

const List<String> nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

// ============================================================================
// DATA SOURCE INJECTION
// ============================================================================

class NepaliCalendar {
  NepaliCalendar._();

  static NepaliCalendarDataSource? _source;

  /// Register the data source. Must be called once before any conversion.
  static void initialize(NepaliCalendarDataSource source) {
    _source = source;
  }

  static NepaliCalendarDataSource get _ds {
    if (_source == null) {
      throw StateError(
        'jhigu_patro_utils: calendar not initialized. Call NepaliCalendar.initialize() first.',
      );
    }
    return _source!;
  }

  // ============================================================================
  // DATA HELPERS
  // ============================================================================

  /// Days in [month] (1-indexed) of BS [year].
  static int getDaysInBSMonth(int year, int month) {
    final data = _ds.getYearData(year);
    if (data == null) throw ArgumentError('No calendar data for BS year $year');
    return data[month - 1];
  }

  /// Total days in BS [year].
  static int getTotalDaysInBSYear(int year) {
    final data = _ds.getYearData(year);
    if (data == null) throw ArgumentError('No calendar data for BS year $year');
    return data.fold(0, (s, d) => s + d);
  }

  /// Returns true if the BS date is within range and valid.
  static bool isValidBSDate(int year, int month, int day) {
    if (month < 1 || month > 12 || day < 1) return false;
    final data = _ds.getYearData(year);
    if (data == null) return false;
    return day <= data[month - 1];
  }

  /// All supported BS years.
  static List<int> getAvailableBSYears() {
    final src = _ds;
    return [
      for (int y = src.supportedStartYear; y <= src.supportedEndYear; y++)
        if (src.getYearData(y) != null) y,
    ];
  }

  // ============================================================================
  // CONVERSION
  // ============================================================================

  /// Convert a Gregorian [DateTime] (AD) to a [NepaliDate] (BS).
  static NepaliDate convertADToBS(DateTime adDate) {
    final adUtc = DateTime.utc(adDate.year, adDate.month, adDate.day);
    int remaining = adUtc.difference(_bsBaseDate).inDays;

    int year = _bsBaseYear;
    int month = 1;

    while (remaining > 0) {
      final diy = getTotalDaysInBSYear(year);
      if (remaining >= diy) {
        remaining -= diy;
        year++;
      } else {
        break;
      }
    }

    while (remaining > 0) {
      final dim = getDaysInBSMonth(year, month);
      if (remaining >= dim) {
        remaining -= dim;
        month++;
      } else {
        break;
      }
    }

    return NepaliDate(year: year, month: month, day: remaining + 1);
  }

  /// Convert a BS date to a Gregorian [DateTime] (AD).
  static DateTime convertBSToAD(int bsYear, int bsMonth, int bsDay) {
    if (!isValidBSDate(bsYear, bsMonth, bsDay)) {
      throw ArgumentError('Invalid BS date: $bsYear/$bsMonth/$bsDay');
    }

    int total = 0;
    for (int y = _bsBaseYear; y < bsYear; y++) total += getTotalDaysInBSYear(y);
    for (int m = 1; m < bsMonth; m++) total += getDaysInBSMonth(bsYear, m);
    total += bsDay - 1;

    return _bsBaseDate.add(Duration(days: total));
  }

  // ============================================================================
  // TIMEZONE
  // ============================================================================

  /// Convert a UTC [DateTime] to Nepal time (GMT+5:45).
  static DateTime toNepalTime(DateTime utc) => utc.toUtc().add(_nepalOffset);

  /// Reverse of [toNepalTime].
  static DateTime fromNepalTime(DateTime nepDate) => nepDate.subtract(_nepalOffset);

  /// Current Nepal local date as a [NepaliDate].
  static NepaliDate getCurrentNepaliDate() {
    final nep = toNepalTime(DateTime.now().toUtc());
    return convertADToBS(DateTime.utc(nep.year, nep.month, nep.day));
  }

  // ============================================================================
  // FORMATTING
  // ============================================================================

  /// Convert an integer to Nepali (Devanagari) digit string.
  static String toNepaliDigits(int num) {
    return num.toString().split('').map((ch) {
      final d = int.tryParse(ch);
      return d != null ? nepaliDigits[d] : ch;
    }).join();
  }

  /// Day-of-week index (0=Sunday) from a [DateTime].
  static int _dayIndex(DateTime date) => date.weekday % 7;

  /// Weekday name for [date].
  static String getNepaliDayName(DateTime date, {bool nepali = false}) {
    final days = nepali ? nepaliDaysNe : nepaliDaysEn;
    return days[_dayIndex(date)];
  }

  /// Nepali month name (1-indexed).
  static String getNepaliMonthName(int month, {bool nepali = false}) {
    final months = nepali ? nepaliMonthsNe : nepaliMonthsEn;
    return months[month - 1];
  }

  /// Format a [NepaliDate] as a readable string.
  /// English: "Falgun 8, 2082"  Nepali: "फागुन 8, 2082"
  static String formatNepaliDate(NepaliDate date, {bool nepali = false}) {
    final month = getNepaliMonthName(date.month, nepali: nepali);
    return '$month ${date.day}, ${date.year}';
  }

  /// Format a Gregorian [DateTime] as "April 14, 2024".
  static String formatEnglishDate(DateTime date) =>
      '${englishMonths[date.month - 1]} ${date.day}, ${date.year}';

  /// Format a BS date with weekday name.
  /// Example: "८ फागुन २०८२, शुक्रबार"
  static String formatNepaliDateWithDay(NepaliDate nepaliDate, {DateTime? adDate}) {
    final ad = adDate ?? convertBSToAD(nepaliDate.year, nepaliDate.month, nepaliDate.day);
    final day = toNepaliDigits(nepaliDate.day);
    final month = nepaliMonthsNe[nepaliDate.month - 1];
    final year = toNepaliDigits(nepaliDate.year);
    final weekday = getNepaliDayName(ad, nepali: true);
    return '$day $month $year, $weekday';
  }

  /// Current Nepali date formatted with day name in Nepal time.
  static String getCurrentNepaliDateFormatted() {
    final nep = toNepalTime(DateTime.now().toUtc());
    final local = DateTime.utc(nep.year, nep.month, nep.day);
    return formatNepaliDateWithDay(convertADToBS(local), adDate: local);
  }

  /// Format a [DateTime] in Nepal timezone as "YYYY-MM-DD HH:mm".
  static String formatNepalDateTime(DateTime? date) {
    if (date == null) return '';
    final nep = toNepalTime(date.toUtc());
    final y = nep.year.toString().padLeft(4, '0');
    final mo = nep.month.toString().padLeft(2, '0');
    final d = nep.day.toString().padLeft(2, '0');
    final h = nep.hour.toString().padLeft(2, '0');
    final mi = nep.minute.toString().padLeft(2, '0');
    return '$y-$mo-$d $h:$mi';
  }

  /// Relative time string in Nepali (e.g. "१५ मिनेट अगाडि").
  /// Past midnight Nepal time → shows the BS date string.
  static String getRelativeTimeInNepali(DateTime? date) {
    if (date == null) return 'हालै';

    final nowNep = toNepalTime(DateTime.now().toUtc());
    final dateNep = toNepalTime(date.toUtc());

    final todayMidnight = DateTime.utc(nowNep.year, nowNep.month, nowNep.day);

    if (dateNep.isBefore(todayMidnight)) {
      return _bsDateString(convertADToBS(dateNep));
    }

    final diff = nowNep.difference(dateNep);
    if (diff.inSeconds < 1) return 'हालै';

    if (diff.inSeconds < 60) return '${toNepaliDigits(diff.inSeconds)} सेकेण्ड अगाडि';
    if (diff.inMinutes < 60) return '${toNepaliDigits(diff.inMinutes)} मिनेट अगाडि';
    if (diff.inHours < 24)   return '${toNepaliDigits(diff.inHours)} घण्टा अगाडि';
    return _bsDateString(convertADToBS(dateNep));
  }

  static String _bsDateString(NepaliDate nd) =>
      '${toNepaliDigits(nd.day)} ${nepaliMonthsNe[nd.month - 1]} ${toNepaliDigits(nd.year)}';
}
