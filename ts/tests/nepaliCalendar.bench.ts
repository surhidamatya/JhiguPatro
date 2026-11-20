import { describe, bench, beforeAll } from 'vitest';
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
  formatNepaliDateWithDay,
  formatEnglishDate,
  getRelativeTimeInNepali,
  toNepalTime,
  getCurrentNepaliDate,
} from '../src/index.js';
import { InlineCalendarDataSource } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';

const calendarJson: CalendarJson = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../data/nepali_calendar_data.json'), 'utf8')
);

beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(
    calendarJson.years,
    calendarJson.supportedRange.start,
    calendarJson.supportedRange.end,
  ));
});

// ── Conversion: early years (small offset from base) ──────────────────────────
describe('convertADToBS — early date (BS ~2000)', () => {
  bench('AD 1943-04-14 → BS 2000/1/1', () => {
    convertADToBS(new Date(1943, 3, 14));
  });
});

// ── Conversion: mid-range ─────────────────────────────────────────────────────
describe('convertADToBS — mid range (BS ~2050)', () => {
  bench('AD 1993-04-14 → BS ~2050', () => {
    convertADToBS(new Date(1993, 3, 14));
  });
});

// ── Conversion: far future (worst case — BS ~2100) ───────────────────────────
describe('convertADToBS — far future (BS ~2100)', () => {
  bench('AD 2043-04-14 → BS ~2100', () => {
    convertADToBS(new Date(2043, 3, 14));
  });
});

// ── convertBSToAD: early ──────────────────────────────────────────────────────
describe('convertBSToAD — early year (BS 2001)', () => {
  bench('BS 2001/1/1 → AD', () => {
    convertBSToAD(2001, 1, 1);
  });
});

// ── convertBSToAD: mid-range ──────────────────────────────────────────────────
describe('convertBSToAD — mid range (BS 2050)', () => {
  bench('BS 2050/6/15 → AD', () => {
    convertBSToAD(2050, 6, 15);
  });
});

// ── convertBSToAD: worst case (BS 2100) ──────────────────────────────────────
describe('convertBSToAD — far future (BS 2099)', () => {
  bench('BS 2099/12/30 → AD', () => {
    convertBSToAD(2099, 12, 30);
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────
describe('round-trip AD→BS→AD', () => {
  bench('round-trip recent date', () => {
    const bs = convertADToBS(new Date(2025, 5, 15));
    convertBSToAD(bs.year, bs.month, bs.day);
  });

  bench('round-trip far future date', () => {
    const bs = convertADToBS(new Date(2043, 0, 1));
    convertBSToAD(bs.year, bs.month, bs.day);
  });
});

// ── Data helpers ──────────────────────────────────────────────────────────────
describe('getDaysInBSMonth', () => {
  bench('getDaysInBSMonth 2082/11', () => {
    getDaysInBSMonth(2082, 11);
  });
});

describe('getTotalDaysInBSYear', () => {
  bench('getTotalDaysInBSYear 2082', () => {
    getTotalDaysInBSYear(2082);
  });
});

describe('isValidBSDate', () => {
  bench('valid date', () => {
    isValidBSDate(2082, 6, 15);
  });
  bench('invalid date', () => {
    isValidBSDate(2082, 13, 1);
  });
});

// ── Formatting ────────────────────────────────────────────────────────────────
describe('toNepaliDigits', () => {
  bench('toNepaliDigits(2082)', () => {
    toNepaliDigits(2082);
  });
});

describe('formatNepaliDate', () => {
  bench('en locale', () => {
    formatNepaliDate({ year: 2082, month: 11, day: 8 }, 'en');
  });
  bench('ne locale', () => {
    formatNepaliDate({ year: 2082, month: 11, day: 8 }, 'ne');
  });
});

describe('formatNepaliDateWithDay', () => {
  const adDate = new Date(2026, 1, 20);
  bench('with pre-computed adDate', () => {
    formatNepaliDateWithDay({ year: 2082, month: 11, day: 8 }, adDate);
  });
  bench('without adDate (triggers convertBSToAD internally)', () => {
    formatNepaliDateWithDay({ year: 2082, month: 11, day: 8 });
  });
});

describe('formatEnglishDate', () => {
  const d = new Date(2026, 1, 20);
  bench('formatEnglishDate', () => {
    formatEnglishDate(d);
  });
});

// ── Timezone ──────────────────────────────────────────────────────────────────
describe('toNepalTime', () => {
  const d = new Date();
  bench('toNepalTime', () => {
    toNepalTime(d);
  });
});

// ── getCurrentNepaliDate ──────────────────────────────────────────────────────
describe('getCurrentNepaliDate', () => {
  bench('getCurrentNepaliDate', () => {
    getCurrentNepaliDate();
  });
});

// ── getRelativeTimeInNepali ───────────────────────────────────────────────────
describe('getRelativeTimeInNepali', () => {
  const recent = new Date(Date.now() - 5 * 60_000);
  const old = new Date(Date.now() - 2 * 24 * 60 * 60_000);

  bench('recent (returns मिनेट अगाडि)', () => {
    getRelativeTimeInNepali(recent);
  });
  bench('old date (triggers convertADToBS)', () => {
    getRelativeTimeInNepali(old);
  });
});
