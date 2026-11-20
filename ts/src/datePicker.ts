/**
 * Headless date picker (guide 15.1, U-4): a framework-free state machine for a BS
 * date picker. No DOM, no React.
 *
 *   const picker = createDatePicker({ language: 'ne', min, max });
 *   picker.subscribe(state => render(state));
 *   picker.actions.nextMonth();
 *   picker.actions.select({ year: 2081, month: 1, day: 15 });
 *
 * Rules:
 *  - `focused` is the day the keyboard is on; the visible month follows it.
 *  - Previous/next month moves the focus to the same day (clamped to the month).
 *  - Days outside `min`/`max` or outside the calendar data are disabled: they
 *    cannot be selected and focus stops at the edge.
 *  - Every action that changes the state notifies subscribers once, with the full
 *    new state. An action that changes nothing does not notify.
 *  - Invalid input throws JhiguError and leaves the state unchanged.
 *
 * Needs the calendar initialised. Import from `jhigu-patro-utils-ts/date-picker`.
 */
import { JhiguError } from './errors.js';
import { formatAd, formatDate } from './dateFormat.js';
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';
import { getMonthGrid } from './monthGrid.js';
import type { GridCell } from './monthGrid.js';
import { getSupportedBSRange } from './nepaliCalendar.js';
import { NepaliDate } from './nepaliDate.js';
import type { NepaliDateFields } from './types.js';

export type PickerView = 'days' | 'months' | 'years';

export type FocusMove =
  | 'left' | 'right' | 'up' | 'down'
  | 'home' | 'end'
  | 'pageUp' | 'pageDown'
  | 'shiftPageUp' | 'shiftPageDown';

export type KeyAction = FocusMove | 'select' | 'close';

/**
 * Keyboard map (guide U-15). `key` is a DOM `KeyboardEvent.key`. Returns null for
 * keys the picker does not use. Shift only matters for Page Up and Page Down.
 */
export function keyAction(key: string, shiftKey = false): KeyAction | null {
  switch (key) {
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'Home': return 'home';
    case 'End': return 'end';
    case 'PageUp': return shiftKey ? 'shiftPageUp' : 'pageUp';
    case 'PageDown': return shiftKey ? 'shiftPageDown' : 'pageDown';
    case 'Enter':
    case ' ':
    case 'Spacebar': return 'select';
    case 'Escape': return 'close';
    default: return null;
  }
}

export interface DatePickerOptions {
  /** Selected date. Must be inside `min`/`max`. */
  value?: NepaliDateFields | null;
  min?: NepaliDateFields | null;
  max?: NepaliDateFields | null;
  language?: Language;
  /** First column: 0 = Sunday ... 6 = Saturday. Default 0. */
  weekStartsOn?: number;
  /** Add the AD date to cell labels. Default true. */
  showAd?: boolean;
  /** The day marked as today. Default: today in Nepal. Pass it in tests. */
  today?: NepaliDateFields;
}

export interface MonthItem {
  month: number;
  label: string;
  disabled: boolean;
}

export interface YearItem {
  year: number;
  label: string;
  disabled: boolean;
}

export interface DatePickerState {
  language: Language;
  weekStartsOn: number;
  showAd: boolean;
  view: PickerView;
  visibleYear: number;
  visibleMonth: number;
  /** `बैशाख २०८१` / `Baisakh 2081`. Announce changes with `aria-live="polite"`. */
  title: string;
  /** Seven short weekday names, starting at `weekStartsOn`. */
  weekdays: readonly string[];
  grid: GridCell[][];
  /** The 12 months of `visibleYear`. */
  months: readonly MonthItem[];
  /** A page of 12 years that contains `visibleYear`. */
  years: readonly YearItem[];
  value: NepaliDate | null;
  focused: NepaliDate;
  min: NepaliDate | null;
  max: NepaliDate | null;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export interface CellProps {
  role: 'gridcell';
  'aria-selected': boolean;
  'aria-disabled': boolean;
  /** Weekday, day, month, year, and the AD date when `showAd`. Empty for blank cells. */
  'aria-label': string;
  /** 0 for the focused cell, -1 for the rest (roving tabindex). */
  tabIndex: 0 | -1;
}

export interface DatePickerActions {
  /** No-op at the earliest month allowed by `min` and the calendar data. */
  prevMonth(): void;
  nextMonth(): void;
  /** Show a month. Throws INVALID_DATE / OUT_OF_RANGE outside the calendar data. */
  goTo(year: number, month: number): void;
  setView(view: PickerView): void;
  /** Throws OUT_OF_RANGE for a disabled date. */
  select(date: NepaliDateFields): void;
  clear(): void;
  selectToday(): void;
  moveFocus(kind: FocusMove): void;
  setLanguage(language: Language): void;
}

export interface DatePicker {
  getState(): DatePickerState;
  /** Returns an unsubscribe function. */
  subscribe(listener: (state: DatePickerState) => void): () => void;
  actions: DatePickerActions;
  /** ARIA attributes for a cell of `state.grid`. */
  getCellProps(cell: GridCell): CellProps;
}

const NE_DIGITS = '०१२३४५६७८९';
const digits = (n: number, language: Language) =>
  language === 'ne' ? String(n).replace(/\d/g, d => NE_DIGITS[+d]) : String(n);

interface Core {
  view: PickerView;
  visibleYear: number;
  visibleMonth: number;
  value: NepaliDate | null;
  focused: NepaliDate;
  language: Language;
}

const monthKey = (y: number, m: number) => y * 12 + (m - 1);

export function createDatePicker(options: DatePickerOptions = {}): DatePicker {
  const weekStartsOn = options.weekStartsOn ?? 0;
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new JhiguError('INVALID_DATA', 'weekStartsOn must be an integer from 0 to 6', weekStartsOn);
  }
  const showAd = options.showAd ?? true;
  const today = options.today ? NepaliDate.from(options.today) : NepaliDate.today();
  const min = options.min ? NepaliDate.from(options.min) : null;
  const max = options.max ? NepaliDate.from(options.max) : null;
  if (min && max && min.isAfter(max)) {
    throw new JhiguError('INVALID_DATA', 'min is after max', { min: min.toString(), max: max.toString() });
  }
  const range = getSupportedBSRange();

  const disabled = (d: NepaliDate) => (min !== null && d.isBefore(min)) || (max !== null && d.isAfter(max));
  const clamp = (d: NepaliDate): NepaliDate => (min && d.isBefore(min) ? min : max && d.isAfter(max) ? max : d);

  const value = options.value ? NepaliDate.from(options.value) : null;
  if (value && disabled(value)) {
    throw new JhiguError('OUT_OF_RANGE', 'value is outside min/max', value.toString());
  }
  const focused = clamp(value ?? today);

  let core: Core = {
    view: 'days',
    visibleYear: focused.year,
    visibleMonth: focused.month,
    value,
    focused,
    language: options.language ?? 'en',
  };

  /** A month is disabled when every day of it is outside min/max. */
  const monthDisabled = (y: number, m: number) => {
    const first = new NepaliDate(y, m, 1);
    return (min !== null && first.endOfMonth().isBefore(min)) || (max !== null && first.isAfter(max));
  };

  const resolve = (c: Core): DatePickerState => {
    const { language } = c;
    const s = getStrings(language);
    const rows = getMonthGrid(c.visibleYear, c.visibleMonth, { weekStartsOn, today });
    const prevKey = monthKey(c.visibleYear, c.visibleMonth) - 1;
    const nextKey = monthKey(c.visibleYear, c.visibleMonth) + 1;
    const inData = (key: number) => Math.floor(key / 12) >= range.start && Math.floor(key / 12) <= range.end;
    const canGoPrev =
      inData(prevKey) &&
      !(min && monthKey(min.year, min.month) > prevKey);
    const canGoNext =
      inData(nextKey) &&
      !(max && monthKey(max.year, max.month) < nextKey);
    const pageStart = c.visibleYear - ((c.visibleYear - range.start) % 12);
    return {
      language,
      weekStartsOn,
      showAd,
      view: c.view,
      visibleYear: c.visibleYear,
      visibleMonth: c.visibleMonth,
      title: `${s.months[c.visibleMonth - 1]} ${digits(c.visibleYear, language)}`,
      weekdays: Array.from({ length: 7 }, (_, i) => s.weekdaysShort[(weekStartsOn + i) % 7]),
      grid: rows,
      months: s.months.map((label, i) => ({ month: i + 1, label, disabled: monthDisabled(c.visibleYear, i + 1) })),
      years: Array.from({ length: 12 }, (_, i) => {
        const year = pageStart + i;
        const inRange = year >= range.start && year <= range.end;
        const off =
          !inRange ||
          (min !== null && year < min.year) ||
          (max !== null && year > max.year);
        return { year, label: digits(year, language), disabled: off };
      }),
      value: c.value,
      focused: c.focused,
      min,
      max,
      canGoPrev,
      canGoNext,
    };
  };

  let state = resolve(core);
  const listeners = new Set<(s: DatePickerState) => void>();

  const sig = (c: Core) =>
    `${c.view}|${c.visibleYear}-${c.visibleMonth}|${c.value?.toString() ?? ''}|${c.focused.toString()}|${c.language}`;

  const commit = (patch: Partial<Core>) => {
    const next: Core = { ...core, ...patch };
    if (sig(next) === sig(core)) return;
    core = next;
    state = resolve(core);
    for (const l of [...listeners]) l(state);
  };

  /** Move focus to `d` (clamped to min/max); the visible month follows. */
  const focusOn = (d: NepaliDate, patch: Partial<Core> = {}) => {
    const f = clamp(d);
    commit({ ...patch, focused: f, visibleYear: f.year, visibleMonth: f.month });
  };

  const shiftMonths = (n: number) => {
    try {
      focusOn(core.focused.addMonths(n));
    } catch (e) {
      if (!(e instanceof JhiguError && e.code === 'OUT_OF_RANGE')) throw e;
    }
  };

  const actions: DatePickerActions = {
    prevMonth() {
      if (state.canGoPrev) shiftMonths(-1);
    },
    nextMonth() {
      if (state.canGoNext) shiftMonths(1);
    },
    goTo(year, month) {
      let target = new NepaliDate(year, month, 1); // validates
      if (min && monthKey(year, month) < monthKey(min.year, min.month)) target = min;
      else if (max && monthKey(year, month) > monthKey(max.year, max.month)) target = max;
      const day = Math.min(core.focused.day, new NepaliDate(target.year, target.month, 1).daysInMonth);
      focusOn(new NepaliDate(target.year, target.month, day));
    },
    setView(view) {
      commit({ view });
    },
    select(date) {
      const d = NepaliDate.from(date);
      if (disabled(d)) throw new JhiguError('OUT_OF_RANGE', 'Date is outside min/max', d.toString());
      focusOn(d, { value: d, view: 'days' });
    },
    clear() {
      commit({ value: null });
    },
    selectToday() {
      actions.select(today);
    },
    moveFocus(kind) {
      const f = core.focused;
      try {
        switch (kind) {
          case 'left': return focusOn(f.addDays(-1));
          case 'right': return focusOn(f.addDays(1));
          case 'up': return focusOn(f.addDays(-7));
          case 'down': return focusOn(f.addDays(7));
          case 'home': return focusOn(f.addDays(-((f.weekday - weekStartsOn + 7) % 7)));
          case 'end': return focusOn(f.addDays(6 - ((f.weekday - weekStartsOn + 7) % 7)));
          case 'pageUp': return focusOn(f.addMonths(-1));
          case 'pageDown': return focusOn(f.addMonths(1));
          case 'shiftPageUp': return focusOn(f.addYears(-1));
          case 'shiftPageDown': return focusOn(f.addYears(1));
        }
      } catch (e) {
        // Moving past the calendar data: stay where we are.
        if (!(e instanceof JhiguError && e.code === 'OUT_OF_RANGE')) throw e;
      }
    },
    setLanguage(language) {
      commit({ language });
    },
  };

  const adLabel = (d: NepaliDate, language: Language): string => {
    const u = new Date(d.dayNumber() * 86_400_000);
    return formatAd(new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()), 'D MMMM YYYY', language, { digits: 'ascii' });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    actions,
    getCellProps(cell) {
      const d = cell.bs;
      if (!d) return { role: 'gridcell', 'aria-selected': false, 'aria-disabled': true, 'aria-label': '', tabIndex: -1 };
      const language = state.language;
      let label = formatDate(d, 'dddd, D MMMM YYYY', language);
      if (showAd) label = getStrings(language).format.dualPattern.replace('{bs}', label).replace('{ad}', adLabel(d, language));
      return {
        role: 'gridcell',
        'aria-selected': state.value !== null && d.isSame(state.value),
        'aria-disabled': disabled(d),
        'aria-label': label,
        tabIndex: d.isSame(state.focused) ? 0 : -1,
      };
    },
  };
}
