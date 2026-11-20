/**
 * CalendarController — all calendar business logic.
 *
 * The UI layer (CalendarSection) only reads from this controller and calls
 * its navigation methods.  No date arithmetic lives in the view.
 */

import { getStrings } from './generated/strings.js';
import { getMonthGrid } from './monthGrid.js';
import {
  getCurrentNepaliDate,
  toNepaliDigits,
  getAvailableBSYears,
  NEPALI_MONTHS_NE,
} from './nepaliCalendar.js';
import { NepaliDate } from './nepaliDate.js';
import type { NepaliDateFields } from './types.js';
import type { CalendarDay, CalendarEvent } from './calendar_models.js';
import type { PanchangDataSource } from './data_sources/PanchangDataSource.js';

// ── Event source interface ────────────────────────────────────────────────────

export interface CalendarEventSource {
  getEventsForMonth(year: number, month: number): CalendarEvent[];
  getEventsForDay(date: NepaliDateFields): CalendarEvent[];
}

// ── Static default event source ───────────────────────────────────────────────

export class StaticCalendarEventSource implements CalendarEventSource {
  private readonly _events: Map<string, CalendarEvent[]> = new Map();

  constructor() {
    this._build();
  }

  private _key(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  private _add(y: number, m: number, d: number, title: string, isSpecial = false): void {
    const k = this._key(y, m, d);
    if (!this._events.has(k)) this._events.set(k, []);
    this._events.get(k)!.push({ date: { year: y, month: m, day: d }, title, isSpecial });
  }

  private _build(): void {
    // ── 2081 ────────────────────────────────────────────────────────────────
    this._add(2081, 1, 1, 'नयाँ वर्ष', true);
    this._add(2081, 1, 1, 'विश्व श्रमिक दिवस');
    this._add(2081, 9, 15, 'उधौली पूर्णिमा');
    this._add(2081, 11, 7, 'शहीद दिवस', true);
    this._add(2081, 12, 7, 'महाशिवरात्री', true);

    // ── 2082 ────────────────────────────────────────────────────────────────
    this._add(2082, 1, 1, 'नयाँ वर्ष २०८२', true);
    this._add(2082, 1, 1, 'विश्व श्रमिक दिवस');
    this._add(2082, 2, 15, 'बुद्ध जयन्ती', true);
    this._add(2082, 3, 1, 'गणतन्त्र दिवस', true);
    this._add(2082, 5, 29, 'तीज');
    this._add(2082, 6, 1, 'ऋषि पञ्चमी');
    this._add(2082, 7, 15, 'फुलपाती', true);
    this._add(2082, 7, 16, 'महाअष्टमी', true);
    this._add(2082, 7, 17, 'महानवमी', true);
    this._add(2082, 7, 18, 'विजयादशमी', true);
    this._add(2082, 8, 3, 'लक्ष्मी पूजा', true);
    this._add(2082, 8, 5, 'गोवर्धन पूजा');
    this._add(2082, 8, 6, 'भाइटीका', true);
    this._add(2082, 9, 15, 'उधौली पूर्णिमा');
    this._add(2082, 11, 7, 'शहीद दिवस', true);
    this._add(2082, 12, 7, 'महाशिवरात्री', true);
  }

  getEventsForMonth(year: number, month: number): CalendarEvent[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const result: CalendarEvent[] = [];
    for (const [k, v] of this._events) {
      if (k.startsWith(prefix)) result.push(...v);
    }
    return result;
  }

  getEventsForDay(date: NepaliDateFields): CalendarEvent[] {
    return this._events.get(this._key(date.year, date.month, date.day)) ?? [];
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

type Listener = () => void;

export class CalendarController {
  private _today: NepaliDateFields;
  private _year: number;
  private _month: number;
  private _grid: CalendarDay[];
  private _selectedDay: CalendarDay | null = null;
  private _listeners: Set<Listener> = new Set();

  /**
   * @param today Override "today" (for tests). Default: today in Nepal.
   */
  constructor(
    private readonly eventSource: CalendarEventSource,
    private readonly panchang?: PanchangDataSource,
    today?: NepaliDateFields,
  ) {
    this._today = today ?? getCurrentNepaliDate();
    this._year  = this._today.year;
    this._month = this._today.month;
    this._grid = this._makeGrid(this._year, this._month);
    // default selection = today
    this._selectedDay = this._grid.find(d => d.isToday) ?? null;
  }

  // ── Public state ────────────────────────────────────────────────────────────

  get selectedYear(): number  { return this._year; }
  get selectedMonth(): number { return this._month; }
  get today(): NepaliDateFields     { return this._today; }
  get grid(): readonly CalendarDay[] { return this._grid; }

  /** The currently selected day (defaults to today). */
  get selectedDay(): CalendarDay | null { return this._selectedDay; }

  get availableYears(): number[] {
    return getAvailableBSYears();
  }

  /** "२०८२ बैशाख" — large BS label shown in the header centre */
  get bsLabel(): string {
    return `${toNepaliDigits(this._year)} ${NEPALI_MONTHS_NE[this._month - 1]}`;
  }

  /** "Apr/May 2025" — AD range shown below the BS label */
  get adRangeLabel(): string {
    const first = new NepaliDate(this._year, this._month, 1);
    // Read AD fields from the day number in UTC so no time zone can shift them.
    const adOf = (d: NepaliDate) => {
      const u = new Date(d.dayNumber() * 86_400_000);
      return { month: u.getUTCMonth(), year: u.getUTCFullYear() };
    };
    const start = adOf(first);
    const end = adOf(first.endOfMonth());
    const short = getStrings('en').adMonthsShort;

    const startM = short[start.month];
    const endM   = short[end.month];
    const adYear = start.year !== end.year ? `${start.year}/${end.year}` : `${start.year}`;
    return startM === endM ? `${startM} ${adYear}` : `${startM}/${endM} ${adYear}`;
  }

  /** Combined label (kept for backwards compatibility) */
  get headerLabel(): string {
    return `${this.bsLabel}  |  ${this.adRangeLabel}`;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  prevMonth(): void {
    if (this._month === 1) this._setMonth(this._year - 1, 12);
    else                   this._setMonth(this._year, this._month - 1);
  }

  nextMonth(): void {
    if (this._month === 12) this._setMonth(this._year + 1, 1);
    else                    this._setMonth(this._year, this._month + 1);
  }

  selectYearMonth(year: number, month: number): void {
    if (this._year === year && this._month === month) return;
    // keep selection on today if it exists in the new month, else clear
    this._setMonth(year, month);
  }

  /** Navigate to the current month and select today. */
  goToToday(): void {
    this._setMonth(this._today.year, this._today.month);
  }

  /** Select a specific day cell. Pass null to fall back to today. */
  selectDay(day: CalendarDay | null): void {
    this._selectedDay = day ?? this._grid.find(d => d.isToday) ?? null;
    this._notify();
  }

  // ── Subscription (observer) ─────────────────────────────────────────────────

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // ── Grid builder ────────────────────────────────────────────────────────────

  /**
   * Move to a month. The grid is built first, so a month outside the calendar
   * data throws (JhiguError) and leaves the controller unchanged.
   */
  private _setMonth(year: number, month: number): void {
    const grid = this._makeGrid(year, month);
    this._year = year;
    this._month = month;
    this._grid = grid;
    this._selectedDay = grid.find(d => d.isToday) ?? null;
    this._notify();
  }

  /**
   * Flat list of cells for the 7-column view, built on `getMonthGrid`. Cells
   * outside the month are empty padding cells, as before.
   */
  private _makeGrid(year: number, month: number): CalendarDay[] {
    // Bucket events by day
    const eventsMap = new Map<number, CalendarEvent[]>();
    for (const ev of this.eventSource.getEventsForMonth(year, month)) {
      const list = eventsMap.get(ev.date.day) ?? [];
      list.push(ev);
      eventsMap.set(ev.date.day, list);
    }

    const rows = getMonthGrid(year, month, { weekStartsOn: 0, today: this._today });
    return rows.flat().map((cell, i): CalendarDay => {
      if (!cell.inMonth || !cell.bs) {
        return { bsDay: null, bsDate: null, adDate: null, weekdayIndex: i % 7, events: [], isToday: false };
      }
      const d = cell.bs.day;
      return {
        bsDay: d,
        bsDate: { year, month, day: d },
        adDate: cell.ad,
        weekdayIndex: cell.bs.weekday,
        tithi: this.panchang?.sunriseTithi(year, month, d) ?? undefined,
        events: eventsMap.get(d) ?? [],
        isToday: cell.isToday,
      };
    });
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }
}
