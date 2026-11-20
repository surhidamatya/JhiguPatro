import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InlineCalendarDataSource, initializeCalendar, JhiguError, NepaliDate } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { createDatePicker, keyAction } from '../src/datePicker.js';
import type { DatePickerState } from '../src/datePicker.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const calendarJson: CalendarJson = read('../../data/nepali_calendar_data.json');
const v = read('../../testdata/date-picker.json');

beforeAll(() => {
  initializeCalendar(
    new InlineCalendarDataSource(
      calendarJson.years,
      calendarJson.supportedRange.start,
      calendarJson.supportedRange.end,
      calendarJson.verifiedThrough,
    ),
  );
});

const check = (s: DatePickerState, events: number, expected: Record<string, unknown>, ctx: string) => {
  for (const [k, want] of Object.entries(expected)) {
    const got: unknown = (() => {
      switch (k) {
        case 'events': return events;
        case 'visible': return [s.visibleYear, s.visibleMonth];
        case 'value': return s.value ? s.value.toString() : null;
        case 'focused': return s.focused.toString();
        case 'rows': return s.grid.length;
        case 'weekday0': return s.weekdays[0];
        case 'weekday6': return s.weekdays[6];
        case 'monthsDisabled': return s.months.filter(m => m.disabled).length;
        case 'yearsDisabled': return s.years.filter(y => y.disabled).length;
        case 'yearsFirst': return s.years[0].year;
        case 'yearsFirstLabel': return s.years[0].label;
        case 'monthsFirstLabel': return s.months[0].label;
        default: return (s as unknown as Record<string, unknown>)[k];
      }
    })();
    expect(got, `${ctx}: ${k}`).toEqual(want);
  }
};

/** Vectors store dates as [year, month, day]; the picker takes {year, month, day}. */
const toInit = (init: any) => {
  const out: any = { ...init };
  for (const k of ['today', 'value', 'min', 'max']) {
    if (Array.isArray(out[k])) out[k] = { year: out[k][0], month: out[k][1], day: out[k][2] };
  }
  return out;
};

const make = (init: any) => {
  const picker = createDatePicker(toInit(init));
  let events = 0;
  picker.subscribe(() => { events++; });
  return { picker, count: () => events };
};

describe('date picker shared scenarios', () => {
  for (const sc of v.scenarios) {
    it(sc.name, () => {
      const { picker, count } = make(sc.init);
      if (sc.initExpect) check(picker.getState(), count(), sc.initExpect, 'init');
      sc.steps.forEach((step: any, i: number) => {
        const ctx = `step ${i + 1} ${step.action}(${JSON.stringify(step.arg)})`;
        const fn = (picker.actions as any)[step.action] as (a?: unknown) => void;
        const arg = step.action === 'goTo' ? undefined : step.arg;
        if (step.error) {
          try {
            if (step.action === 'goTo') (picker.actions.goTo as any)(...step.arg);
            else if (step.action === 'select') fn(Array.isArray(arg) ? { year: arg[0], month: arg[1], day: arg[2] } : arg);
            else fn(arg);
            expect.unreachable(`${ctx} should throw`);
          } catch (e) {
            expect(e, ctx).toBeInstanceOf(JhiguError);
            expect((e as JhiguError).code, ctx).toBe(step.error);
          }
        } else if (step.action === 'goTo') {
          (picker.actions.goTo as any)(...step.arg);
        } else if (step.action === 'select') {
          fn(Array.isArray(arg) ? { year: arg[0], month: arg[1], day: arg[2] } : arg);
        } else {
          fn(arg);
        }
        if (step.expect) check(picker.getState(), count(), step.expect, ctx);
      });
    });
  }

  for (const e of v.initErrors) {
    it(`create with ${JSON.stringify(e.init)} throws ${e.code}`, () => {
      try {
        createDatePicker(toInit(e.init));
        expect.unreachable();
      } catch (err) {
        expect((err as JhiguError).code).toBe(e.code);
      }
    });
  }
});

describe('getCellProps shared vectors', () => {
  for (const t of v.cellProps) {
    it(`${t.date ? t.date.join('-') : 'blank'} ${JSON.stringify(t.init)}`, () => {
      const { picker } = make(t.init);
      const cells = picker.getState().grid.flat();
      const cell = t.date
        ? cells.find(c => c.bs?.toString() === new NepaliDate(t.date[0], t.date[1], t.date[2]).toString())!
        : cells.find(c => c.bs === null)!;
      expect(cell).toBeDefined();
      expect(picker.getCellProps(cell)).toEqual(t.props);
    });
  }
});

describe('keyAction', () => {
  for (const t of v.keyActions) {
    it(`${JSON.stringify(t.key)} shift=${t.shift}`, () => expect(keyAction(t.key, t.shift)).toBe(t.out));
  }
});

describe('date picker behaviour', () => {
  it('notifies with the full new state, once per action; unsubscribe stops it', () => {
    const picker = createDatePicker({ today: { year: 2081, month: 1, day: 15 } });
    const seen: DatePickerState[] = [];
    const off = picker.subscribe(s => seen.push(s));
    picker.actions.nextMonth();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(picker.getState());
    off();
    picker.actions.nextMonth();
    expect(seen).toHaveLength(1);
  });

  it('state is replaced, not mutated', () => {
    const picker = createDatePicker({ today: { year: 2081, month: 1, day: 15 } });
    const before = picker.getState();
    picker.actions.nextMonth();
    expect(before.visibleMonth).toBe(1);
    expect(picker.getState()).not.toBe(before);
  });

  it('grid cells show the picked month and today', () => {
    const picker = createDatePicker({ today: { year: 2081, month: 1, day: 15 } });
    const cells = picker.getState().grid.flat();
    expect(cells.filter(c => c.isToday).map(c => c.bs!.day)).toEqual([15]);
    expect(cells.filter(c => c.inMonth)).toHaveLength(31);
  });

  it('keyboard sequence from the keyAction map reaches the same cells as direct moves', () => {
    const picker = createDatePicker({ today: { year: 2081, month: 1, day: 15 } });
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight']) {
      const a = keyAction(key)!;
      picker.actions.moveFocus(a as any);
    }
    expect(picker.getState().focused.toString()).toBe('2081-01-15');
  });

  it('works in every time zone: focus walk over a whole year matches day numbers', () => {
    const picker = createDatePicker({ today: { year: 2081, month: 1, day: 1 } });
    let n = picker.getState().focused.dayNumber();
    for (let i = 0; i < 366; i++) {
      picker.actions.moveFocus('right');
      n += 1;
      expect(picker.getState().focused.dayNumber()).toBe(n);
    }
  });
});
