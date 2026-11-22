import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The real element classes are never created here: jsdom has no ElementInternals. Registering a stub under the real tag name
 * is all a component needs.
 */
function stubDefiner(tag: string) {
  return () => {
    if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
  };
}
vi.mock('jhigu-patro-utils-ts/date-picker-element', async importOriginal => ({
  ...(await importOriginal<object>()), defineJhiguDatePicker: stubDefiner('jhigu-date-picker'),
}));
vi.mock('jhigu-patro-utils-ts/range-picker-element', async importOriginal => ({
  ...(await importOriginal<object>()), defineJhiguDateRangePicker: stubDefiner('jhigu-date-range-picker'),
}));
vi.mock('jhigu-patro-utils-ts/calendar-element', async importOriginal => ({
  ...(await importOriginal<object>()), defineJhiguCalendar: stubDefiner('jhigu-calendar'),
}));
vi.mock('jhigu-patro-utils-ts/address-element', async importOriginal => ({
  ...(await importOriginal<object>()), defineJhiguAddressSelect: stubDefiner('jhigu-address-select'),
}));
vi.mock('jhigu-patro-utils-ts/field-elements', async importOriginal => ({
  ...(await importOriginal<object>()),
  defineJhiguMoneyInput: stubDefiner('jhigu-money-input'),
  defineJhiguPhoneInput: stubDefiner('jhigu-phone-input'),
}));

import {
  JhiguDatePicker, JhiguDateRangePicker, JhiguCalendar, JhiguAddressSelect, JhiguMoneyInput, JhiguPhoneInput,
} from '../src/index.js';
import type { ComponentSpec } from '../src/index.js';


interface Case {
  name: string;
  Component: unknown;
  tag: string;
  props: Record<string, unknown>;
  expectAttrs: Record<string, string>;
}

const cases: Case[] = [
  {
    name: 'JhiguDatePicker', Component: JhiguDatePicker, tag: 'jhigu-date-picker',
    props: { value: '2082-05-10', min: '2080-01-01', max: '2090-12-30', language: 'ne', weekStartsOn: 1, showAd: false, name: 'dob', disabled: true, required: true, popup: true, theme: 'dark', today: '2082-05-10' },
    expectAttrs: { value: '2082-05-10', min: '2080-01-01', max: '2090-12-30', language: 'ne', 'week-starts-on': '1', 'show-ad': 'false', name: 'dob', disabled: '', required: '', popup: '', theme: 'dark', today: '2082-05-10' },
  },
  {
    name: 'JhiguDateRangePicker', Component: JhiguDateRangePicker, tag: 'jhigu-date-range-picker',
    props: { start: '2082-05-10', end: '2082-05-15', min: '2080-01-01', max: '2090-12-30', language: 'en', weekStartsOn: 0, showAd: false, name: 'stay', disabled: true, required: true, popup: true, theme: 'light', today: '2082-05-10' },
    expectAttrs: { start: '2082-05-10', end: '2082-05-15', min: '2080-01-01', max: '2090-12-30', language: 'en', 'week-starts-on': '0', 'show-ad': 'false', name: 'stay', disabled: '', required: '', popup: '', theme: 'light', today: '2082-05-10' },
  },
  {
    name: 'JhiguCalendar', Component: JhiguCalendar, tag: 'jhigu-calendar',
    props: { year: 2082, month: 5, language: 'ne', weekStartsOn: 6, showAd: false, showTithi: false, theme: 'dark', today: '2082-05-10' },
    expectAttrs: { year: '2082', month: '5', language: 'ne', 'week-starts-on': '6', 'show-ad': 'false', 'show-tithi': 'false', theme: 'dark', today: '2082-05-10' },
  },
  {
    name: 'JhiguAddressSelect', Component: JhiguAddressSelect, tag: 'jhigu-address-select',
    props: { value: 274, ward: 3, language: 'ne', showWard: false, name: 'addr', required: true, disabled: true, theme: 'dark' },
    expectAttrs: { value: '274', ward: '3', language: 'ne', 'show-ward': 'false', name: 'addr', required: '', disabled: '', theme: 'dark' },
  },
  {
    name: 'JhiguMoneyInput', Component: JhiguMoneyInput, tag: 'jhigu-money-input',
    props: { valuePaisa: 0, symbol: 'Rs.', devanagari: true, allowNegative: true, name: 'amount', placeholder: '0.00', label: 'Amount', language: 'ne', disabled: true, readonly: true, required: true, theme: 'dark' },
    expectAttrs: { 'value-paisa': '0', symbol: 'Rs.', devanagari: '', 'allow-negative': '', name: 'amount', placeholder: '0.00', label: 'Amount', language: 'ne', disabled: '', readonly: '', required: '', theme: 'dark' },
  },
  {
    name: 'JhiguPhoneInput', Component: JhiguPhoneInput, tag: 'jhigu-phone-input',
    props: { value: '9841234567', allowInactive: true, name: 'phone', placeholder: '98XXXXXXXX', label: 'Mobile', language: 'ne', disabled: true, readonly: true, required: true, theme: 'dark' },
    expectAttrs: { value: '9841234567', 'allow-inactive': '', name: 'phone', placeholder: '98XXXXXXXX', label: 'Mobile', language: 'ne', disabled: '', readonly: '', required: '', theme: 'dark' },
  },
];

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe.each(cases)('$name', c => {
  const spec = (c.Component as { spec: ComponentSpec }).spec;

  // That the mapping matches the real elements' observed attributes and events is checked once,
  // in ts/tests/elementBindings.test.ts.

  it('writes each prop as the right attribute', () => {
    act(() => root.render(createElement(c.Component as never, c.props as never)));
    const e = container.querySelector(c.tag)!;
    expect(e).not.toBeNull();
    const got = Object.fromEntries(e.getAttributeNames().map(n => [n, e.getAttribute(n)!]));
    expect(got).toEqual(c.expectAttrs);
  });

  it('each callback prop is called for its own event, with the detail', () => {
    const handlers: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const prop of Object.keys(spec.events)) handlers[prop] = vi.fn();
    act(() => root.render(createElement(c.Component as never, handlers as never)));
    const e = container.querySelector(c.tag)!;
    for (const [prop, eventName] of Object.entries(spec.events)) {
      const detail = { from: eventName };
      e.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
      expect(handlers[prop]).toHaveBeenCalledTimes(1);
      expect(handlers[prop].mock.calls[0][0]).toEqual(detail);
      for (const [other, fn] of Object.entries(handlers)) if (other !== prop) expect(fn).toHaveBeenCalledTimes(0);
      handlers[prop].mockClear();
    }
  });

  it('the ref is the element', () => {
    const ref = createRef<HTMLElement>();
    act(() => root.render(createElement(c.Component as never, { ref } as never)));
    expect(ref.current).toBe(container.querySelector(c.tag));
  });
});

describe('calendar events', () => {
  it('are given as a property, not an attribute', () => {
    const events = { '2082-06-03': ['Laxmi Puja'] };
    act(() => root.render(createElement(JhiguCalendar as never, { events } as never)));
    const e = container.querySelector('jhigu-calendar') as unknown as { events: unknown };
    expect(e.events).toBe(events);
    expect((e as unknown as Element).hasAttribute('events')).toBe(false);
  });

  it('the panchang is a property too, and null clears it', () => {
    const panchang = { sunriseTithi: () => null };
    act(() => root.render(createElement(JhiguCalendar as never, { panchang } as never)));
    const e = container.querySelector('jhigu-calendar') as unknown as Element & { panchang: unknown };
    expect(e.panchang).toBe(panchang);
    expect(e.hasAttribute('panchang')).toBe(false);
    act(() => root.render(createElement(JhiguCalendar as never, { panchang: undefined } as never)));
    expect(e.panchang).toBeUndefined();
  });
});
