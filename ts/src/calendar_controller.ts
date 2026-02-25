/**
 * CalendarController — all calendar business logic.
 *
 * The UI layer (CalendarSection) only reads from this controller and calls
 * its navigation methods.  No date arithmetic lives in the view.
 */

import {
  getCurrentNepaliDate,
  getDaysInBSMonth,
  convertBSToAD,
  toNepaliDigits,
  getAvailableBSYears,
  NEPALI_MONTHS_NE,
} from './nepaliCalendar.js';
import type { NepaliDate } from './types.js';
import type { CalendarDay, CalendarEvent } from './calendar_models.js';
import type { PanchangDataSource } from './data_sources/PanchangDataSource.js';

// ── Event source interface ────────────────────────────────────────────────────

export interface CalendarEventSource {
  getEventsForMonth(year: number, month: number): CalendarEvent[];
  getEventsForDay(date: NepaliDate): CalendarEvent[];
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

  getEventsForDay(date: NepaliDate): CalendarEvent[] {
    return this._events.get(this._key(date.year, date.month, date.day)) ?? [];
  }
}

// ── Short English month abbreviations ─────────────────────────────────────────

const SHORT_MONTHS_EN = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// ── Controller ────────────────────────────────────────────────────────────────

type Listener = () => void;

export class CalendarController {
  private _today: NepaliDate;
  private _year: number;
  private _month: number;
  private _grid: CalendarDay[] = [];
  private _selectedDay: CalendarDay | null = null;
  private _listeners: Set<Listener> = new Set();

  constructor(
    private readonly eventSource: CalendarEventSource,
    private readonly panchang?: PanchangDataSource,
  ) {
    this._today = getCurrentNepaliDate();
    this._year  = this._today.year;
    this._month = this._today.month;
    this._buildGrid();
    // default selection = today
    this._selectedDay = this._grid.find(d => d.isToday) ?? null;
  }

  // ── Public state ────────────────────────────────────────────────────────────

  get selectedYear(): number  { return this._year; }
  get selectedMonth(): number { return this._month; }
  get today(): NepaliDate     { return this._today; }
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
    const adStart = convertBSToAD(this._year, this._month, 1);
    const lastDay = getDaysInBSMonth(this._year, this._month);
    const adEnd   = convertBSToAD(this._year, this._month, lastDay);

    const startM = SHORT_MONTHS_EN[adStart.getMonth()];
    const endM   = SHORT_MONTHS_EN[adEnd.getMonth()];
    const startY = adStart.getFullYear();
    const endY   = adEnd.getFullYear();

    const adYear  = startY !== endY ? `${startY}/${endY}` : `${startY}`;
    return startM === endM ? `${startM} ${adYear}` : `${startM}/${endM} ${adYear}`;
  }

  /** Combined label (kept for backwards compatibility) */
  get headerLabel(): string {
    return `${this.bsLabel}  |  ${this.adRangeLabel}`;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  prevMonth(): void {
    if (this._month === 1) { this._year -= 1; this._month = 12; }
    else                   { this._month -= 1; }
    this._buildGrid();
    this._selectedDay = this._grid.find(d => d.isToday) ?? null;
    this._notify();
  }

  nextMonth(): void {
    if (this._month === 12) { this._year += 1; this._month = 1; }
    else                    { this._month += 1; }
    this._buildGrid();
    this._selectedDay = this._grid.find(d => d.isToday) ?? null;
    this._notify();
  }

  selectYearMonth(year: number, month: number): void {
    if (this._year === year && this._month === month) return;
    this._year  = year;
    this._month = month;
    this._buildGrid();
    // keep selection on today if it exists in the new month, else clear
    this._selectedDay = this._grid.find(d => d.isToday) ?? null;
    this._notify();
  }

  /** Navigate to the current month and select today. */
  goToToday(): void {
    this._year  = this._today.year;
    this._month = this._today.month;
    this._buildGrid();
    this._selectedDay = this._grid.find(d => d.isToday) ?? null;
    this._notify();
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

  private _buildGrid(): void {
    const totalDays  = getDaysInBSMonth(this._year, this._month);
    const firstAD    = convertBSToAD(this._year, this._month, 1);
    // JS Date.getDay(): 0=Sun … 6=Sat — same as our weekdayIndex convention
    const firstWday  = firstAD.getDay();

    // Bucket events by day
    const eventsMap = new Map<number, CalendarEvent[]>();
    for (const ev of this.eventSource.getEventsForMonth(this._year, this._month)) {
      const list = eventsMap.get(ev.date.day) ?? [];
      list.push(ev);
      eventsMap.set(ev.date.day, list);
    }

    const cells: CalendarDay[] = [];

    // Leading empty cells
    for (let i = 0; i < firstWday; i++) {
      cells.push({ bsDay: null, bsDate: null, adDate: null,
                   weekdayIndex: i, events: [], isToday: false });
    }

    // Day cells
    for (let d = 1; d <= totalDays; d++) {
      const bsDate: NepaliDate = { year: this._year, month: this._month, day: d };
      const adDate = convertBSToAD(this._year, this._month, d);
      const weekdayIndex = adDate.getDay();
      const isToday =
        d === this._today.day &&
        this._month === this._today.month &&
        this._year  === this._today.year;

      cells.push({
        bsDay: d,
        bsDate,
        adDate,
        weekdayIndex,
        tithi: this.panchang?.sunriseTithi(this._month, d) ?? undefined,
        events: eventsMap.get(d) ?? [],
        isToday,
      });
    }

    // Trailing empty cells to fill the last row
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailing; i++) {
      cells.push({ bsDay: null, bsDate: null, adDate: null,
                   weekdayIndex: 0, events: [], isToday: false });
    }

    this._grid = cells;
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }
}
