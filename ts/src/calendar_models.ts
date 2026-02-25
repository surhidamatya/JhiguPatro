import type { NepaliDate, TithiSegment } from './types.js';

// ── Event ─────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  readonly date: NepaliDate;
  readonly title: string;
  /** When true the event is rendered in red (public holiday / special day). */
  readonly isSpecial: boolean;
}

// ── Day cell ──────────────────────────────────────────────────────────────────

/**
 * Data for a single cell in the 7-column calendar grid.
 * `bsDay === null` means an empty padding cell.
 */
export interface CalendarDay {
  /** BS day number (1-based). null for empty padding cells. */
  readonly bsDay: number | null;
  /** The full BS date, or null for padding cells. */
  readonly bsDate: NepaliDate | null;
  /** The corresponding AD date, or null for padding cells. */
  readonly adDate: Date | null;
  /** Day-of-week index: 0 = Sunday … 6 = Saturday. */
  readonly weekdayIndex: number;
  /** Dominant (sunrise) tithi for this day. Null when panchang data not loaded. */
  readonly tithi?: TithiSegment;
  /** Events on this day. */
  readonly events: CalendarEvent[];
  /** Whether this cell is today's date. */
  readonly isToday: boolean;
}
