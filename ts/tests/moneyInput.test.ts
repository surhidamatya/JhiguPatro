import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Npr, MoneyError } from '../src/index.js';
import { createMoneyInput } from '../src/moneyInput.js';
import type { MoneyInputState } from '../src/moneyInput.js';
import { placeCaret } from '../src/inputCaret.js';

const v = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../testdata/money-input.json'), 'utf8'));

const toInit = (init: any) => ({ ...init, value: init.value === undefined ? undefined : Npr.fromPaisa(init.value) });

const check = (s: MoneyInputState, events: number, expected: Record<string, unknown>, ctx: string) => {
  for (const [k, want] of Object.entries(expected)) {
    const got = k === 'events' ? events : k === 'paisa' ? (s.value ? s.value.paisa : null) : (s as unknown as Record<string, unknown>)[k];
    expect(got, `${ctx}: ${k}`).toEqual(want);
  }
};

describe('money input shared scenarios', () => {
  for (const sc of v.scenarios) {
    it(sc.name, () => {
      const input = createMoneyInput(toInit(sc.init));
      let events = 0;
      input.subscribe(() => { events++; });
      if (sc.initExpect) check(input.getState(), events, sc.initExpect, 'init');
      sc.steps.forEach((step: any, i: number) => {
        const ctx = `step ${i + 1} ${step.action}(${JSON.stringify(step.text ?? step.arg)})`;
        const run = () => {
          if (step.action === 'input') input.actions.input(step.text, step.caret);
          else if (step.action === 'setValue') input.actions.setValue(step.arg === null ? null : Npr.fromPaisa(step.arg));
          else (input.actions as any)[step.action]();
        };
        if (step.error) {
          try { run(); expect.unreachable(`${ctx} should throw`); }
          catch (e) { expect(e).toBeInstanceOf(MoneyError); expect((e as MoneyError).code).toBe(step.error); }
        } else run();
        if (step.expect) check(input.getState(), events, step.expect, ctx);
      });
    });
  }
});

describe('money input behaviour', () => {
  it('notifies with the full new state; unsubscribe stops it', () => {
    const input = createMoneyInput();
    const seen: MoneyInputState[] = [];
    const off = input.subscribe(s => seen.push(s));
    input.actions.input('12', 2);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(input.getState());
    off();
    input.actions.input('123', 3);
    expect(seen).toHaveLength(1);
  });

  it('typing digits one at a time always yields the formatted amount with the caret at the end', () => {
    const input = createMoneyInput();
    let text = '';
    for (const d of '123456789012') {
      const caret = input.getState().caret;
      const s = input.getState().text;
      input.actions.input(s.slice(0, caret) + d + s.slice(caret), caret + 1);
      text = input.getState().text;
      expect(input.getState().caret).toBe(text.length);
    }
    expect(text).toBe('1,23,45,67,89,012');
    expect(input.getState().value!.paisa).toBe(123456789012 * 100);
  });

  it('deleting digits with backspace from the end keeps the caret at the end', () => {
    const input = createMoneyInput({ value: Npr.fromPaisa(123456700) });
    while (input.getState().text !== '') {
      const { text, caret } = input.getState();
      input.actions.input(text.slice(0, caret - 1) + text.slice(caret), caret - 1);
      if (input.getState().text !== '') expect(input.getState().caret).toBe(input.getState().text.length);
    }
    expect(input.getState().value).toBeNull();
  });
});

describe('placeCaret', () => {
  const digit = (c: string) => c >= '0' && c <= '9';
  it('counts significant characters', () => {
    expect(placeCaret('1,23,456', 0, digit)).toBe(0);
    expect(placeCaret('1,23,456', 1, digit)).toBe(1);
    expect(placeCaret('1,23,456', 2, digit)).toBe(3);
    expect(placeCaret('1,23,456', 6, digit)).toBe(8);
    expect(placeCaret('1,23,456', 99, digit)).toBe(8);
  });
});
