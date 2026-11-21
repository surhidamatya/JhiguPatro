import { describe, it, expect } from 'vitest';
import { FIELD_CSS, JhiguMoneyInput, JhiguPhoneInput, defineJhiguMoneyInput, defineJhiguPhoneInput } from '../src/elements/fieldElements.js';

describe('field elements in Node', () => {
  it('can be imported without a DOM', () => {
    expect(typeof JhiguMoneyInput).toBe('function');
    expect(typeof JhiguPhoneInput).toBe('function');
  });

  it('defining needs a browser', () => {
    expect(() => defineJhiguMoneyInput()).toThrow(/customElements/);
    expect(() => defineJhiguPhoneInput()).toThrow(/customElements/);
  });

  it('observes the documented attributes', () => {
    expect(JhiguMoneyInput.observedAttributes).toEqual(expect.arrayContaining(['value-paisa', 'symbol', 'devanagari', 'allow-negative', 'required', 'disabled', 'readonly']));
    expect(JhiguPhoneInput.observedAttributes).toEqual(expect.arrayContaining(['value', 'allow-inactive', 'language', 'required']));
  });

  it('stylesheet has theme variables, dark mode and parts hooks', () => {
    for (const v of ['--jhigu-color-primary', '--jhigu-color-surface', '--jhigu-color-text', '--jhigu-color-muted', '--jhigu-color-holiday', '--jhigu-radius', '--jhigu-font-family', '--jhigu-font-size', 'prefers-color-scheme: dark', ':host([theme="dark"])']) {
      expect(FIELD_CSS).toContain(v);
    }
  });
});
