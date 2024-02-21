import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

const Map<int, List<int>> _years = {
  2079: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
};

void main() {
  setUpAll(() {
    NepaliCalendar.initialize(
      InlineCalendarDataSource(years: _years, supportedStartYear: 2079, supportedEndYear: 2082),
    );
  });

  group('convertADToBS', () {
    test('AD 2024-04-12 → BS 2080/12/30', () {
      expect(
        NepaliCalendar.convertADToBS(DateTime.utc(2024, 4, 12)),
        equals(NepaliDate(year: 2080, month: 12, day: 30)),
      );
    });

    test('AD 2024-04-13 → BS 2081/1/1 (new year)', () {
      expect(
        NepaliCalendar.convertADToBS(DateTime.utc(2024, 4, 13)),
        equals(NepaliDate(year: 2081, month: 1, day: 1)),
      );
    });

    test('AD 2025-09-17 → BS 2082/6/1', () {
      expect(
        NepaliCalendar.convertADToBS(DateTime.utc(2025, 9, 17)),
        equals(NepaliDate(year: 2082, month: 6, day: 1)),
      );
    });
  });

  group('convertBSToAD', () {
    test('BS 2081/1/1 → AD 2024-04-13', () {
      final result = NepaliCalendar.convertBSToAD(2081, 1, 1);
      expect(result.year, 2024);
      expect(result.month, 4);
      expect(result.day, 12);
    });

    test('BS 2080/12/30 → AD 2024-04-12', () {
      final result = NepaliCalendar.convertBSToAD(2080, 12, 30);
      expect(result.year, 2024);
      expect(result.month, 4);
      expect(result.day, 12);
    });

    test('round-trip AD→BS→AD', () {
      final original = DateTime.utc(2025, 1, 15);
      final bs = NepaliCalendar.convertADToBS(original);
      final back = NepaliCalendar.convertBSToAD(bs.year, bs.month, bs.day);
      expect(back.year, original.year);
      expect(back.month, original.month);
      expect(back.day, original.day);
    });

    test('throws on invalid date', () {
      expect(() => NepaliCalendar.convertBSToAD(2082, 13, 1), throwsArgumentError);
      expect(() => NepaliCalendar.convertBSToAD(2082, 1, 32), throwsArgumentError);
    });
  });

  group('isValidBSDate', () {
    test('accepts valid date', () => expect(NepaliCalendar.isValidBSDate(2082, 1, 1), isTrue));
    test('rejects month 0',    () => expect(NepaliCalendar.isValidBSDate(2082, 0, 1), isFalse));
    test('rejects month 13',   () => expect(NepaliCalendar.isValidBSDate(2082, 13, 1), isFalse));
    test('rejects day > month length', () => expect(NepaliCalendar.isValidBSDate(2082, 1, 32), isFalse));
    test('rejects unknown year',       () => expect(NepaliCalendar.isValidBSDate(1999, 1, 1), isFalse));
  });

  group('getDaysInBSMonth', () {
    test('2082 Baisakh = 31 days', () => expect(NepaliCalendar.getDaysInBSMonth(2082, 1), 31));
    test('2082 Falgun = 30 days',  () => expect(NepaliCalendar.getDaysInBSMonth(2082, 11), 30));
  });

  group('toNepaliDigits', () {
    test('0 → ०',       () => expect(NepaliCalendar.toNepaliDigits(0), '०'));
    test('2082 → २०८२', () => expect(NepaliCalendar.toNepaliDigits(2082), '२०८२'));
    test('15 → १५',     () => expect(NepaliCalendar.toNepaliDigits(15), '१५'));
  });

  group('formatNepaliDate', () {
    test('English format', () {
      expect(
        NepaliCalendar.formatNepaliDate(NepaliDate(year: 2082, month: 11, day: 8)),
        'Falgun 8, 2082',
      );
    });
    test('Nepali format', () {
      expect(
        NepaliCalendar.formatNepaliDate(NepaliDate(year: 2082, month: 11, day: 8), nepali: true),
        'फागुन 8, 2082',
      );
    });
  });

  group('toNepalTime / fromNepalTime', () {
    test('shifts UTC by +5:45', () {
      final utc = DateTime.utc(2025, 1, 1, 0, 0);
      final nep = NepaliCalendar.toNepalTime(utc);
      expect(nep.hour, 5);
      expect(nep.minute, 45);
    });

    test('round-trips', () {
      final utc = DateTime.utc(2025, 6, 15, 10, 30);
      expect(NepaliCalendar.fromNepalTime(NepaliCalendar.toNepalTime(utc)), equals(utc));
    });
  });

  group('getRelativeTimeInNepali', () {
    test('null → हालै', () => expect(NepaliCalendar.getRelativeTimeInNepali(null), 'हालै'));

    test('30 seconds ago → सेकेण्ड अगाडि', () {
      final recent = DateTime.now().subtract(const Duration(seconds: 30));
      expect(NepaliCalendar.getRelativeTimeInNepali(recent), contains('सेकेण्ड अगाडि'));
    });

    test('10 minutes ago → मिनेट अगाडि', () {
      final past = DateTime.now().subtract(const Duration(minutes: 10));
      expect(NepaliCalendar.getRelativeTimeInNepali(past), contains('मिनेट अगाडि'));
    });
  });
}
