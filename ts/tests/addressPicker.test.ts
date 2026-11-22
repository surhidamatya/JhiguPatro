import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAddressPicker } from '../src/addressPicker.js';
import type { AddressPicker, AddressPickerActions, AddressPickerState } from '../src/addressPicker.js';
import { AddressError } from '../src/address.js';

const vectors = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../testdata/address-picker.json'), 'utf8'),
);

const LENGTHS = ['districts', 'localLevels', 'wards'];
function check(state: AddressPickerState, events: number, expected: Record<string, unknown>, ctx: string) {
  for (const [k, want] of Object.entries(expected)) {
    if (k === 'events') expect(events, `${ctx}: events`).toBe(want);
    else if (LENGTHS.includes(k)) expect((state as any)[k].length, `${ctx}: ${k}`).toBe(want);
    else expect((state as any)[k], `${ctx}: ${k}`).toEqual(want);
  }
}

function make(init: any) {
  const picker = createAddressPicker(init);
  let events = 0;
  picker.subscribe(() => { events++; });
  return { picker, count: () => events };
}

describe('address picker shared scenarios', () => {
  for (const sc of vectors.scenarios) {
    it(sc.name, () => {
      const { picker, count } = make(sc.init);
      if (sc.initExpect) check(picker.getState(), count(), sc.initExpect, 'init');
      sc.steps.forEach((step: any, i: number) => {
        const ctx = `step ${i + 1} ${step.action}(${JSON.stringify(step.arg)})`;
        const fn = (picker.actions as any)[step.action] as (a?: unknown) => void;
        if (step.error) {
          try {
            fn(step.arg);
            expect.unreachable(`${ctx} should throw`);
          } catch (e) {
            expect(e, ctx).toBeInstanceOf(AddressError);
            expect((e as AddressError).code, ctx).toBe(step.error);
          }
        } else {
          fn(step.arg);
        }
        if (step.expect) check(picker.getState(), count(), step.expect, ctx);
      });
    });
  }

  for (const v of vectors.initErrors) {
    it(`create with ${JSON.stringify(v.value)} throws ${v.code}`, () => {
      try {
        createAddressPicker({ value: v.value });
        expect.unreachable();
      } catch (e) {
        expect((e as AddressError).code).toBe(v.code);
      }
    });
  }
});

describe('address picker behaviour', () => {
  it('notifies with the full new state, once per action', () => {
    const picker: AddressPicker = createAddressPicker();
    const seen: AddressPickerState[] = [];
    picker.subscribe(s => seen.push(s));
    picker.actions.selectProvince(3);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(picker.getState());
    expect(seen[0].provinceId).toBe(3);
  });

  it('unsubscribe stops notifications', () => {
    const picker = createAddressPicker();
    let n = 0;
    const off = picker.subscribe(() => n++);
    picker.actions.selectProvince(3);
    off();
    picker.actions.selectProvince(4);
    expect(n).toBe(1);
  });

  it('exposes all provinces and ward numbers 1..wards', () => {
    const picker = createAddressPicker({ language: 'ne' });
    expect(picker.getState().provinces).toHaveLength(7);
    expect(picker.getState().language).toBe('ne');
    picker.actions.selectLocalLevel(307);
    const { wards } = picker.getState();
    expect(wards[0]).toBe(1);
    expect(wards[wards.length - 1]).toBe(32);
  });

  it('state is replaced, not mutated', () => {
    const picker = createAddressPicker();
    const before = picker.getState();
    picker.actions.selectProvince(3);
    expect(before.provinceId).toBeNull();
  });

  it('actions object has the documented methods', () => {
    const keys: Array<keyof AddressPickerActions> = [
      'selectProvince', 'selectDistrict', 'selectLocalLevel', 'selectWard', 'clear', 'setLanguage',
    ];
    const a = createAddressPicker().actions;
    for (const k of keys) expect(typeof a[k]).toBe('function');
  });
});
