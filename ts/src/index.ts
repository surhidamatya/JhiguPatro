// Types & interfaces
export type {
  CalendarType,
  NepaliDate,
  EnglishDate,
  NepaliCalendarDataSource,
  CalendarJson,
} from './types.js';

// Data sources
export { InlineCalendarDataSource } from './data_sources/InlineCalendarDataSource.js';
export { JsonCalendarDataSource } from './data_sources/JsonCalendarDataSource.js';

// Calendar engine
export {
  // Setup
  initializeCalendar,

  // Names / constants
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NE,
  ENGLISH_MONTHS,
  NEPALI_DAYS_EN,
  NEPALI_DAYS_NE,
  NEPALI_DIGITS,

  // Data helpers
  getDaysInBSMonth,
  getTotalDaysInBSYear,
  isValidBSDate,
  getAvailableBSYears,
  getAvailableADYears,

  // Conversion
  convertADToBS,
  convertBSToAD,

  // Timezone
  toNepalTime,
  fromNepalTime,
  getCurrentNepaliDate,

  // Formatting
  toNepaliDigits,
  formatNepaliDate,
  formatEnglishDate,
  getNepaliMonthName,
  getNepaliDayName,
  formatNepaliDateWithDay,
  getCurrentNepaliDateFormatted,
  formatNepalDateTime,
  getRelativeTimeInNepali,
} from './nepaliCalendar.js';
