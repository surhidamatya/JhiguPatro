// Types & interfaces
export type {
  CalendarType,
  NepaliDateFields,
  EnglishDate,
  NepaliCalendarDataSource,
  CalendarJson,
  TithiSegment,
  PanchangDay,
  PanchangMonth,
  PanchangJson,
} from './types.js';

// Data sources
export { InlineCalendarDataSource } from './data_sources/InlineCalendarDataSource.js';
export { JsonCalendarDataSource } from './data_sources/JsonCalendarDataSource.js';
export { PanchangDataSource } from './data_sources/PanchangDataSource.js';

// Localised label tables (generated from data/strings.*.json)
export { getStrings, stringsEn, stringsNe } from './generated/strings.js';
export type { Language, Strings } from './generated/strings.js';

// Phone numbers
export { parsePhone, isValidPhone, PhoneError } from './phone.js';
export type { ParsedPhone, ParsePhoneOptions, PhoneErrorCode } from './phone.js';

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
  getSupportedBSRange,
  getAvailableADYears,

  // Accuracy
  isVerifiedYear,
  getDateAccuracy,

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

// Money
export { Npr, MoneyError, groupLakh, vatExclusive, vatInclusive, MAX_PAISA, numberToWords, amountInWords } from './money.js';
export type { NprFormatOptions, VatResult, MoneyErrorCode, AmountInWordsOptions } from './money.js';

// Date parsing, fiscal year, errors
export { parseNepaliDate } from './dateParser.js';
export { fiscalYear } from './fiscal.js';
export type { FiscalYear } from './fiscal.js';
export { JhiguError } from './errors.js';
export type { JhiguErrorCode } from './errors.js';

// NepaliDate value class
export { NepaliDate } from './nepaliDate.js';
export type { DiffUnit } from './nepaliDate.js';

// Date formatting
export { formatDate, formatAd, formatPreset } from './dateFormat.js';
export type { DatePreset, FormatOptions, PresetOptions } from './dateFormat.js';

// Month grid
export { getMonthGrid } from './monthGrid.js';
export type { GridCell, MonthGridOptions } from './monthGrid.js';
