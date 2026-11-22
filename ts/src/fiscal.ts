/** Nepali fiscal year (guide 7.7, D-15): Shrawan 1 to Ashadh end. */
import { JhiguError } from './errors.js';
import { getDaysInBSMonth, isValidBSDate } from './nepaliCalendar.js';
import type { NepaliDateFields } from './types.js';

export interface FiscalYear {
  /** BS year the fiscal year starts in. */
  start: number;
  /** `start + 1`. */
  end: number;
  /** `2081/82`. */
  code: string;
  /** Shrawan 1 of `start`. */
  first: NepaliDateFields;
  /** Last day of Ashadh of `end`. */
  last: NepaliDateFields;
}

/**
 * Fiscal year containing `date`. Throws JhiguError INVALID_DATE for a date that
 * does not exist and OUT_OF_RANGE when the fiscal year reaches outside the
 * calendar data.
 */
export function fiscalYear(date: NepaliDateFields): FiscalYear {
  if (!isValidBSDate(date.year, date.month, date.day)) {
    throw new JhiguError('INVALID_DATE', 'Invalid BS date', date);
  }
  const start = date.month >= 4 ? date.year : date.year - 1;
  const end = start + 1;
  if (!isValidBSDate(start, 4, 1) || !isValidBSDate(end, 3, 1)) {
    throw new JhiguError('OUT_OF_RANGE', 'Fiscal year is outside the calendar data', date);
  }
  return {
    start,
    end,
    code: `${start}/${String(end % 100).padStart(2, '0')}`,
    first: { year: start, month: 4, day: 1 },
    last: { year: end, month: 3, day: getDaysInBSMonth(end, 3) },
  };
}
