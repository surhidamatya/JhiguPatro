import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InlineCalendarDataSource, initializeCalendar, JhiguError, NepaliDate } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { createRangePicker } from '../src/rangePicker.js';
import type { RangePickerState } from '../src/rangePicker.js';
import type { GridCell } from '../src/monthGrid.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const calendarJson: CalendarJson = read('../../data/nepali_calendar_data.json');
const v = read('../../testdata/range-picker.json');

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

const fields = (a: number[] | null) => (a ? { year: a[0], month: a[1], day: a[2] } : null);
const toInit = (init: any) => {
  const out: any = { ...init };
  for (const k of ['today', 'start', 'end', 'min', 'max']) if (Array.isArray(out[k])) out[k] = fields(out[k]);
  return out;
};
const cellOf = (a: number[]): GridCell => ({
  bs: new NepaliDate(a[0], a[1], a[2]), ad: null, inMonth: true, inRange: true, isToday: false, isWeekend: false, events: [],
});

const check = (s: RangePickerState, events: number, expected: Record<string, unknown>, ctx: string) => {
  for (const [k, want] of Object.entries(expected)) {
    const got: unknown = (() => {
      switch (k) {
        case 'events': return events;
        case 'visible': return [s.visibleYear, s.visibleMonth];
        case 'start': return s.start ? s.start.toString() : null;
        case 'end': return s.end ? s.end.toString() : null;
        case 'hovered': return s.hovered ? s.hovered.toString() : null;
        case 'previewEnd': return s.previewEnd ? s.previewEnd.toString() : null;
        case 'focused': return s.focused.toString();
        default: return (s as unknown as Record<string, unknown>)[k];
      }
    })();
    expect(got, `${ctx}: ${k}`).toEqual(want);
  }
};

const make = (init: any) => {
  const picker = createRangePicker(toInit(init));
  let events = 0;
  picker.subscribe(() => { events++; });
  return { picker, count: () => events };
};

const call = (picker: ReturnType<typeof createRangePicker>, action: string, arg: any) => {
  const a = picker.actions as any;
  switch (action) {
    case 'select': return a.select(fields(arg));
    case 'hover': return a.hover(fields(arg));
    case 'setRange': return a.setRange(fields(arg[0]), fields(arg[1]));
    default: return a[action](arg ?? undefined);
  }
};

describe('range picker shared scenarios', () => {
  for (const sc of v.scenarios) {
    it(sc.name, () => {
      const { picker, count } = make(sc.init);
      if (sc.initExpect) check(picker.getState(), count(), sc.initExpect, 'init');
      sc.steps.forEach((step: any, i: number) => {
        const ctx = `step ${i + 1} ${step.action}(${JSON.stringify(step.arg)})`;
        if (step.error) {
          try {
            call(picker, step.action, step.arg);
            expect.unreachable(`${ctx} should throw`);
          } catch (e) {
            expect(e, ctx).toBeInstanceOf(JhiguError);
            expect((e as JhiguError).code, ctx).toBe(step.error);
          }
        } else {
          call(picker, step.action, step.arg);
        }
        check(picker.getState(), count(), step.expect, ctx);
      });
      for (const c of sc.cells ?? []) {
        const p = picker.getCellProps(cellOf(c.date));
        expect(p.rangePosition, `cell ${c.date}`).toBe(c.position);
        expect(p.inPreview, `cell ${c.date} preview`).toBe(c.inPreview);
        expect(p['aria-selected'], `cell ${c.date} selected`).toBe(c.selected);
      }
    });
  }

  for (const e of v.initErrors) {
    it(`create with ${JSON.stringify(e.init)} throws ${e.code}`, () => {
      try {
        createRangePicker(toInit(e.init));
        expect.unreachable();
      } catch (err) {
        expect((err as JhiguError).code).toBe(e.code);
      }
    });
  }
});

describe('range picker behaviour', () => {
  const today = { year: 2081, month: 1, day: 15 };

  it('notifies once per action with the full state; unsubscribe stops it', () => {
    const picker = createRangePicker({ today });
    const seen: RangePickerState[] = [];
    const off = picker.subscribe(s => seen.push(s));
    picker.actions.select({ year: 2081, month: 1, day: 10 });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(picker.getState());
    off();
    picker.actions.select({ year: 2081, month: 1, day: 12 });
    expect(seen).toHaveLength(1);
  });

  it('a rejected select leaves the state and subscribers untouched', () => {
    const picker = createRangePicker({ today, min: { year: 2081, month: 1, day: 10 } });
    let n = 0;
    picker.subscribe(() => n++);
    const before = picker.getState();
    expect(() => picker.actions.select({ year: 2081, month: 1, day: 5 })).toThrow(JhiguError);
    expect(picker.getState()).toBe(before);
    expect(n).toBe(0);
  });

  it('a rejected setRange changes nothing even if the first end was fine', () => {
    const picker = createRangePicker({ today, max: { year: 2081, month: 1, day: 20 } });
    const before = picker.getState();
    expect(() => picker.actions.setRange({ year: 2081, month: 1, day: 10 }, { year: 2081, month: 1, day: 25 })).toThrow(JhiguError);
    expect(picker.getState().start).toBeNull();
    expect(picker.getState().focused.toString()).toBe(before.focused.toString());
  });

  it('state carries the date picker fields (grid, title, weekdays) but no single value', () => {
    const s = createRangePicker({ today }).getState() as unknown as Record<string, unknown>;
    expect(s.title).toBe('Baisakh 2081');
    expect(Array.isArray(s.grid)).toBe(true);
    expect('value' in s).toBe(false);
  });

  it('selectToday starts a range at today', () => {
    const picker = createRangePicker({ today });
    picker.actions.selectToday();
    expect(picker.getState().start!.toString()).toBe('2081-01-15');
    expect(picker.getState().phase).toBe('end');
  });

  it('every day of a long range is middle, with exact ends (in every time zone)', () => {
    const picker = createRangePicker({ today });
    const a = new NepaliDate(2081, 1, 1);
    const b = new NepaliDate(2081, 12, 30);
    picker.actions.select(a);
    picker.actions.select(b);
    let middle = 0;
    for (let d = a; d.isBefore(b); d = d.addDays(1)) {
      const pos = picker.getCellProps(cellOf([d.year, d.month, d.day])).rangePosition;
      if (d.isSame(a)) expect(pos).toBe('start');
      else { expect(pos).toBe('middle'); middle++; }
    }
    expect(middle).toBe(b.diff(a, 'days') - 1);
    expect(picker.getCellProps(cellOf([2081, 12, 30])).rangePosition).toBe('end');
  });
});
