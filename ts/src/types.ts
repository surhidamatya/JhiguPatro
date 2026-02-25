// ============================================================================
// CORE TYPES
// ============================================================================

export type CalendarType = 'AD' | 'BS';

export interface NepaliDate {
  year: number;
  month: number; // 1–12
  day: number;
}

export interface EnglishDate {
  year: number;
  month: number; // 1–12
  day: number;
}

// ============================================================================
// DATA SOURCE INTERFACE
// ============================================================================

/**
 * Abstract interface for Nepali calendar data sources.
 *
 * Phase 1: InlineCalendarDataSource (hardcoded map — great for Node/server)
 * Phase 2: JsonCalendarDataSource (loads from JSON file/URL — great for browsers)
 * Phase 3: RemoteCalendarDataSource (fetches from API, with local fallback)
 */
export interface NepaliCalendarDataSource {
  /** Returns the 12-element array of days-per-month for the given BS year, or null if not available. */
  getYearData(year: number): number[] | null;

  /** The first BS year supported by this data source. */
  readonly supportedStartYear: number;

  /** The last BS year supported by this data source. */
  readonly supportedEndYear: number;
}

export interface CalendarJson {
  version: string;
  supportedRange: { start: number; end: number };
  referencePoint: {
    bsYear: number;
    bsMonth: number;
    bsDay: number;
    adYear: number;
    adMonth: number;
    adDay: number;
  };
  years: Record<string, number[]>;
}

// ============================================================================
// PANCHANG / TITHI TYPES
// ============================================================================

export interface TithiSegment {
  /** 1–30 */
  tithiNumber: number;
  /** Nepali name e.g. "प्रतिपदा" */
  tithiName: string;
  /** "शुक्ल" or "कृष्ण" */
  paksha: 'शुक्ल' | 'कृष्ण';
  /** Minutes from 00:00 Nepal time. Canonical source of truth. */
  startMinute: number;
  /** Minutes from 00:00 Nepal time. 1440 = end of day. */
  endMinute: number;
}

export interface PanchangDay {
  bsDay: number;
  /** "YYYY-MM-DD" Gregorian date — matches convertBSToAD output. */
  adDate: string;
  tithiSegments: TithiSegment[];
}

export interface PanchangMonth {
  month: number;
  name: string;
  days: PanchangDay[];
}

/** Shape of a panchang_YYYY.json file (e.g. 2081_tithi.json). */
export interface PanchangJson {
  year: number;
  months: PanchangMonth[];
}
