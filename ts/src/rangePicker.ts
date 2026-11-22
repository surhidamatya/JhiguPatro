/**
 * Headless date range picker (guide 15.1, `<jhigu-date-range-picker>`): a
 * framework-free state machine for choosing a start and an end BS date. It reuses
 * the date picker for the month view, focus, keyboard moves, `min`/`max` and ARIA
 * labels, and adds the two-click range logic.
 *
 *   const picker = createRangePicker({ language: 'ne', min, max });
 *   picker.subscribe(state => render(state));
 *   picker.actions.select(a);   // start
 *   picker.actions.select(b);   // end
 *
 * Selection rules:
 *  - First click sets the start (`phase` becomes `end`).
 *  - A second click on or after the start sets the end (`complete`).
 *  - A second click before the start restarts the range from that day.
 *  - A click when the range is complete starts a new range.
 *  - While choosing the end, `previewEnd` is the hovered day, or the focused day
 *    for keyboard users; days after the start up to it are `inPreview`.
 *  - Every action that changes the state notifies subscribers once, with the full
 *    new state. Invalid input throws JhiguError and leaves the state unchanged.
 *
 * Needs the calendar initialised. Import from `jhigu-patro-utils-ts/range-picker`.
 */
import { JhiguError } from './errors.js';
import { createDatePicker } from './datePicker.js';
import type { CellProps, DatePickerActions, DatePickerOptions, DatePickerState } from './datePicker.js';
import type { GridCell } from './monthGrid.js';
import { NepaliDate } from './nepaliDate.js';
import type { NepaliDateFields } from './types.js';

export type RangePhase = 'start' | 'end';

export type RangePosition = 'start' | 'middle' | 'end' | 'single';

export interface RangePickerOptions extends Omit<DatePickerOptions, 'value'> {
  /** Initial start. With only `start`, the picker waits for the end. */
  start?: NepaliDateFields | null;
  /** Initial end. Needs `start`; must not be before it. */
  end?: NepaliDateFields | null;
}

export interface RangePickerState extends Omit<DatePickerState, 'value'> {
  start: NepaliDate | null;
  end: NepaliDate | null;
  /** `start` when the next click chooses a start, `end` when it chooses the end. */
  phase: RangePhase;
  /** True when both start and end are set. */
  complete: boolean;
  /** The day the pointer is over, or null. */
  hovered: NepaliDate | null;
  /** While choosing the end: the hovered day, else the focused day. Otherwise null. */
  previewEnd: NepaliDate | null;
}

export interface RangeCellProps extends CellProps {
  /** Where the cell sits in the chosen range; null outside it. */
  rangePosition: RangePosition | null;
  /** True for days after the start up to `previewEnd` while choosing the end. */
  inPreview: boolean;
}

export type RangePickerActions = Omit<DatePickerActions, 'select' | 'clear' | 'selectToday'> & {
  /** Click a day: see the selection rules. Throws OUT_OF_RANGE for a disabled day. */
  select(date: NepaliDateFields): void;
  /** Select the focused day (Enter and Space). */
  selectFocused(): void;
  selectToday(): void;
  /** Set both ends at once. Throws INVALID_DATA if `start` is after `end`. */
  setRange(start: NepaliDateFields, end: NepaliDateFields): void;
  /** The pointer is over a day (null: left the grid). */
  hover(date: NepaliDateFields | null): void;
  /** Clear the range. */
  clear(): void;
};

export interface RangePicker {
  getState(): RangePickerState;
  /** Returns an unsubscribe function. */
  subscribe(listener: (state: RangePickerState) => void): () => void;
  actions: RangePickerActions;
  /** ARIA attributes plus range position for a cell of `state.grid`. */
  getCellProps(cell: GridCell): RangeCellProps;
}

interface RangeCore {
  start: NepaliDate | null;
  end: NepaliDate | null;
  hovered: NepaliDate | null;
}

const str = (d: NepaliDate | null) => (d ? d.toString() : '');

export function createRangePicker(options: RangePickerOptions = {}): RangePicker {
  const { start: startOpt, end: endOpt, ...rest } = options;
  const inner = createDatePicker(rest);
  const innerActions = inner.actions;

  let start = startOpt ? NepaliDate.from(startOpt) : null;
  let end = endOpt ? NepaliDate.from(endOpt) : null;
  if (end && !start) throw new JhiguError('INVALID_DATA', 'end needs a start', end.toString());
  if (start && end && end.isBefore(start)) {
    throw new JhiguError('INVALID_DATA', 'end is before start', { start: start.toString(), end: end.toString() });
  }
  // Initial focus and the min/max check on the ends go through the inner picker.
  for (const d of [start, end]) if (d) innerActions.select(d);
  innerActions.clear();

  let core: RangeCore = { start, end, hovered: null };

  const sig = (): string => {
    const s = inner.getState();
    return [s.view, s.visibleYear, s.visibleMonth, s.focused.toString(), s.language, str(core.start), str(core.end), str(core.hovered)].join('|');
  };

  const resolve = (): RangePickerState => {
    const { value: _unused, ...base } = inner.getState();
    void _unused;
    const phase: RangePhase = core.start && !core.end ? 'end' : 'start';
    return {
      ...base,
      start: core.start,
      end: core.end,
      phase,
      complete: core.start !== null && core.end !== null,
      hovered: core.hovered,
      previewEnd: phase === 'end' ? core.hovered ?? base.focused : null,
    };
  };

  let state = resolve();
  let lastSig = sig();
  const listeners = new Set<(s: RangePickerState) => void>();

  /** Run an action; notify once if anything visible changed. */
  const run = (fn: () => void) => {
    try {
      fn();
    } finally {
      const now = sig();
      if (now !== lastSig) {
        lastSig = now;
        state = resolve();
        for (const l of [...listeners]) l(state);
      }
    }
  };

  /** Throws OUT_OF_RANGE if `d` is outside min/max, before anything is changed. */
  const assertEnabled = (d: NepaliDate) => {
    const { min, max } = inner.getState();
    if ((min && d.isBefore(min)) || (max && d.isAfter(max))) {
      throw new JhiguError('OUT_OF_RANGE', 'Date is outside min/max', d.toString());
    }
  };

  const pass =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => run(() => fn(...args));

  const select = (date: NepaliDateFields) => {
    const d = NepaliDate.from(date);
    innerActions.select(d); // checks min/max, moves focus and the visible month
    innerActions.clear(); // the range is ours; the inner single value stays empty
    const { start: s, end: e } = core;
    if (s && !e && !d.isBefore(s)) core = { start: s, end: d, hovered: null };
    else core = { start: d, end: null, hovered: null };
  };

  const actions: RangePickerActions = {
    prevMonth: pass(innerActions.prevMonth),
    nextMonth: pass(innerActions.nextMonth),
    goTo: pass(innerActions.goTo),
    setView: pass(innerActions.setView),
    moveFocus: pass(innerActions.moveFocus),
    setLanguage: pass(innerActions.setLanguage),
    select: pass(select),
    selectFocused: () => run(() => select(inner.getState().focused)),
    selectToday: () => run(() => {
      innerActions.selectToday();
      const t = inner.getState().focused;
      innerActions.clear();
      select(t);
    }),
    setRange(a, b) {
      run(() => {
        const s = NepaliDate.from(a);
        const e = NepaliDate.from(b);
        if (e.isBefore(s)) throw new JhiguError('INVALID_DATA', 'end is before start', { start: s.toString(), end: e.toString() });
        assertEnabled(s);
        assertEnabled(e);
        innerActions.select(s);
        innerActions.select(e); // focus and the visible month end up on the end
        innerActions.clear();
        core = { start: s, end: e, hovered: null };
      });
    },
    hover(date) {
      run(() => {
        core = { ...core, hovered: date ? NepaliDate.from(date) : null };
      });
    },
    clear() {
      run(() => {
        core = { start: null, end: null, hovered: null };
      });
    },
  };

  const positionOf = (d: NepaliDate): RangePosition | null => {
    const { start: s, end: e } = core;
    if (!s) return null;
    if (!e) return d.isSame(s) ? 'start' : null;
    if (d.isSame(s) && d.isSame(e)) return 'single';
    if (d.isSame(s)) return 'start';
    if (d.isSame(e)) return 'end';
    return d.isAfter(s) && d.isBefore(e) ? 'middle' : null;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    actions,
    getCellProps(cell) {
      const base = inner.getCellProps(cell);
      const d = cell.bs;
      if (!d) return { ...base, rangePosition: null, inPreview: false };
      const position = positionOf(d);
      const s = core.start;
      const preview = state.previewEnd;
      const inPreview =
        state.phase === 'end' && s !== null && preview !== null && d.isAfter(s) && !d.isAfter(preview);
      return { ...base, 'aria-selected': position !== null, rangePosition: position, inPreview };
    },
  };
}
