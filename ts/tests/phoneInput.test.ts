import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePhone } from '../src/index.js';
import { createPhoneInput } from '../src/phoneInput.js';
import type { PhoneInputState } from '../src/phoneInput.js';

const v = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../testdata/phone-input.json'), 'utf8'));
const phoneVectors = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../testdata/phone.json'), 'utf8'));

const check = (s: PhoneInputState, events: number, expected: Record<string, unknown>, ctx: string) => {
  for (const [k, want] of Object.entries(expected)) {
    const got = k === 'events' ? events : (s as unknown as Record<string, unknown>)[k];
    expect(got, `${ctx}: ${k}`).toEqual(want);
  }
};

describe('phone input shared scenarios', () => {
  for (const sc of v.scenarios) {
    it(sc.name, () => {
      const input = createPhoneInput(sc.init);
      let events = 0;
      input.subscribe(() => { events++; });
      if (sc.initExpect) check(input.getState(), events, sc.initExpect, 'init');
      sc.steps.forEach((step: any, i: number) => {
        const ctx = `step ${i + 1} ${step.action}(${JSON.stringify(step.text ?? step.arg)})`;
        if (step.action === 'input') input.actions.input(step.text, step.caret);
        else if (step.action === 'setLanguage') input.actions.setLanguage(step.arg);
        else (input.actions as any)[step.action]();
        if (step.expect) check(input.getState(), events, step.expect, ctx);
      });
    });
  }
});

describe('phone input agrees with parsePhone', () => {
  it('every valid vector from the parser is valid in the input with the same e164 and national form', () => {
    for (const t of phoneVectors.valid) {
      const input = createPhoneInput({ allowInactive: !!t.allowInactive });
      input.actions.input(t.in);
      const s = input.getState();
      const p = parsePhone(t.in, { allowInactive: !!t.allowInactive });
      expect(s.valid, t.in).toBe(true);
      expect(s.e164, t.in).toBe(p.e164);
      expect(s.national, t.in).toBe(p.national);
      expect(s.type, t.in).toBe(p.type);
      expect(s.error, t.in).toBeNull();
    }
  });

  it('numbers the parser rejects never show as valid', () => {
    for (const t of phoneVectors.invalid) {
      const input = createPhoneInput();
      input.actions.input(t.in);
      expect(input.getState().valid, JSON.stringify(t.in)).toBe(false);
    }
  });

  it('the formatted text parses back to the same number', () => {
    for (const t of phoneVectors.valid) {
      const input = createPhoneInput({ allowInactive: !!t.allowInactive });
      input.actions.input(t.in);
      const again = createPhoneInput({ allowInactive: !!t.allowInactive });
      again.actions.input(input.getState().text);
      expect(again.getState().text, t.in).toBe(input.getState().text);
      expect(again.getState().e164, t.in).toBe(input.getState().e164);
    }
  });

  it('typing a valid number one digit at a time ends valid with the caret at the end', () => {
    const input = createPhoneInput();
    for (const d of '9841234567') {
      const { text, caret } = input.getState();
      input.actions.input(text.slice(0, caret) + d + text.slice(caret), caret + 1);
      expect(input.getState().caret).toBe(input.getState().text.length);
    }
    expect(input.getState().valid).toBe(true);
  });

  it('notifies with the full state; unsubscribe stops it', () => {
    const input = createPhoneInput();
    const seen: PhoneInputState[] = [];
    const off = input.subscribe(s => seen.push(s));
    input.actions.input('98', 2);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(input.getState());
    off();
    input.actions.input('984', 3);
    expect(seen).toHaveLength(1);
  });
});
