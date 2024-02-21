import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeCalendar,
  convertADToBS,
  convertBSToAD,
  isValidBSDate,
  getDaysInBSMonth,
  getTotalDaysInBSYear,
  toNepaliDigits,
  formatNepaliDate,
  formatEnglishDate,
  getNepaliMonthName,
  getRelativeTimeInNepali,
  toNepalTime,
  fromNepalTime,
} from '../src/index.js';
import { InlineCalendarDataSource } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';

// Load full calendar JSON (BS 2000–2100) so conversion tests work correctly.
// The conversion engine iterates from BS 2000, so all intermediate years are required.
const calendarJson: CalendarJson = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../data/nepali_calendar_data.json'), 'utf8')
);

beforeAll(() => {
  const source = new InlineCalendarDataSource(
    calendarJson.years,
    calendarJson.supportedRange.start,
    calendarJson.supportedRange.end,
  );
  initializeCalendar(source);
});

describe('convertADToBS', () => {
  it('converts AD 2024-04-12 to BS 2080/12/30', () => {
    const result = convertADToBS(new Date(2024, 3, 12));
    expect(result).toEqual({ year: 2080, month: 12, day: 30 });
  });

  it('converts AD 2024-04-13 to BS 2081/1/1 (new year)', () => {
    const result = convertADToBS(new Date(2024, 3, 13));
    expect(result).toEqual({ year: 2081, month: 1, day: 1 });
  });

  it('converts AD 2025-09-17 to BS 2082/6/1', () => {
    const result = convertADToBS(new Date(2025, 8, 17));
    expect(result).toEqual({ year: 2082, month: 6, day: 1 });
  });
});

describe('convertBSToAD', () => {
  it('converts BS 2081/1/1 to AD 2024-04-13', () => {
    const result = convertBSToAD(2081, 1, 1);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(13);
  });

  it('converts BS 2080/12/30 to AD 2024-04-12', () => {
    const result = convertBSToAD(2080, 12, 30);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(12);
  });

  it('round-trips: AD→BS→AD', () => {
    const original = new Date(2025, 0, 15);
    const bs = convertADToBS(original);
    const back = convertBSToAD(bs.year, bs.month, bs.day);
    expect(back.getFullYear()).toBe(original.getFullYear());
    expect(back.getMonth()).toBe(original.getMonth());
    expect(back.getDate()).toBe(original.getDate());
  });

  it('throws on invalid BS date', () => {
    expect(() => convertBSToAD(2082, 13, 1)).toThrow();
    expect(() => convertBSToAD(2082, 1, 32)).toThrow();
  });
});

describe('isValidBSDate', () => {
  it('accepts valid dates', () => {
    expect(isValidBSDate(2082, 1, 1)).toBe(true);
    expect(isValidBSDate(2082, 1, 31)).toBe(true);
  });

  it('rejects out-of-range month', () => {
    expect(isValidBSDate(2082, 0, 1)).toBe(false);
    expect(isValidBSDate(2082, 13, 1)).toBe(false);
  });

  it('rejects day exceeding month length', () => {
    expect(isValidBSDate(2082, 1, 32)).toBe(false);
  });

  it('rejects unknown year', () => {
    expect(isValidBSDate(1999, 1, 1)).toBe(false);
  });
});

describe('getDaysInBSMonth', () => {
  it('returns correct days for BS 2082/1 (Baisakh)', () => {
    expect(getDaysInBSMonth(2082, 1)).toBe(31);
  });

  it('returns correct days for BS 2082/11 (Falgun)', () => {
    expect(getDaysInBSMonth(2082, 11)).toBe(30);
  });
});

describe('getTotalDaysInBSYear', () => {
  it('returns 365 or 366 for each known year', () => {
    const total = getTotalDaysInBSYear(2082);
    expect(total).toBeGreaterThanOrEqual(365);
    expect(total).toBeLessThanOrEqual(366);
  });
});

describe('toNepaliDigits', () => {
  it('converts 0 to ०', () => expect(toNepaliDigits(0)).toBe('०'));
  it('converts 2082 to २०८२', () => expect(toNepaliDigits(2082)).toBe('२०८२'));
  it('converts 15 to १५', () => expect(toNepaliDigits(15)).toBe('१५'));
});

describe('formatNepaliDate', () => {
  it('formats in English', () => {
    expect(formatNepaliDate({ year: 2082, month: 11, day: 8 }, 'en')).toBe('Falgun 8, 2082');
  });

  it('formats in Nepali', () => {
    expect(formatNepaliDate({ year: 2082, month: 11, day: 8 }, 'ne')).toBe('फागुन 8, 2082');
  });
});

describe('formatEnglishDate', () => {
  it('formats correctly', () => {
    expect(formatEnglishDate(new Date(2024, 3, 14))).toBe('April 14, 2024');
  });
});

describe('getNepaliMonthName', () => {
  it('returns Baisakh for month 1 in English', () => {
    expect(getNepaliMonthName(1, 'en')).toBe('Baisakh');
  });

  it('returns बैशाख for month 1 in Nepali', () => {
    expect(getNepaliMonthName(1, 'ne')).toBe('बैशाख');
  });
});

describe('toNepalTime / fromNepalTime', () => {
  it('shifts by +5:45', () => {
    const utc = new Date('2025-01-01T00:00:00Z');
    const nep = toNepalTime(utc);
    expect(nep.getUTCHours()).toBe(5);
    expect(nep.getUTCMinutes()).toBe(45);
  });

  it('round-trips', () => {
    const utc = new Date('2025-06-15T10:30:00Z');
    expect(fromNepalTime(toNepalTime(utc)).getTime()).toBe(utc.getTime());
  });
});

describe('getRelativeTimeInNepali', () => {
  it('returns हालै for null', () => {
    expect(getRelativeTimeInNepali(null)).toBe('हालै');
  });

  it('returns seconds ago for recent date', () => {
    const recent = new Date(Date.now() - 30_000);
    const result = getRelativeTimeInNepali(recent);
    expect(result).toContain('सेकेण्ड अगाडि');
  });

  it('returns minutes ago', () => {
    const past = new Date(Date.now() - 10 * 60_000);
    expect(getRelativeTimeInNepali(past)).toContain('मिनेट अगाडि');
  });
});
