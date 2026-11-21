import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The real element classes are imported (for their `observedAttributes`) but never
 * created: jsdom has no ElementInternals. Registering a stub under the real tag name
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
import { JhiguDatePicker as DatePickerEl } from 'jhigu-patro-utils-ts/date-picker-element';
import { JhiguDateRangePicker as RangeEl } from 'jhigu-patro-utils-ts/range-picker-element';
import { JhiguCalendar as CalendarEl } from 'jhigu-patro-utils-ts/calendar-element';
import { JhiguAddressSelect as AddressEl } from 'jhigu-patro-utils-ts/address-element';
import { JhiguMoneyInput as MoneyEl, JhiguPhoneInput as PhoneEl } from 'jhigu-patro-utils-ts/field-elements';

const here = dirname(fileURLToPath(import.meta.url));
const elementSource = (file: string) =>
  readFileSync(join(here, '../../ts/src/elements', file), 'utf8');

interface Case {
  name: string;
  Component: unknown;
  tag: string;
  observed: readonly string[];
  /** Attributes the element reads with getAttribute but does not observe. */
  unobserved: string[];
  sourceFile: string;
  props: Record<string, unknown>;
  expectAttrs: Record<string, string>;
}

const cases: Case[] = [
  {
    name: 'JhiguDatePicker', Component: JhiguDatePicker, tag: 'jhigu-date-picker',
    observed: DatePickerEl.observedAttributes, unobserved: ['name'], sourceFile: 'datePickerElement.ts',
    props: { value: '2082-05-10', min: '2080-01-01', max: '2090-12-30', language: 'ne', weekStartsOn: 1, showAd: false, name: 'dob', disabled: true, required: true, popup: true, theme: 'dark', today: '2082-05-10' },
    expectAttrs: { value: '2082-05-10', min: '2080-01-01', max: '2090-12-30', language: 'ne', 'week-starts-on': '1', 'show-ad': 'false', name: 'dob', disabled: '', required: '', popup: '', theme: 'dark', today: '2082-05-10' },
  },
  {
    name: 'JhiguDateRangePicker', Component: JhiguDateRangePicker, tag: 'jhigu-date-range-picker',
    observed: RangeEl.observedAttributes, unobserved: [], sourceFile: 'rangePickerElement.ts',
    props: { start: '2082-05-10', end: '2082-05-15', min: '2080-01-01', max: '2090-12-30', language: 'en', weekStartsOn: 0, showAd: false, name: 'stay', disabled: true, required: true, popup: true, theme: 'light', today: '2082-05-10' },
    expectAttrs: { start: '2082-05-10', end: '2082-05-15', min: '2080-01-01', max: '2090-12-30', language: 'en', 'week-starts-on': '0', 'show-ad': 'false', name: 'stay', disabled: '', required: '', popup: '', theme: 'light', today: '2082-05-10' },
  },
  {
    name: 'JhiguCalendar', Component: JhiguCalendar, tag: 'jhigu-calendar',
    observed: CalendarEl.observedAttributes, unobserved: [], sourceFile: 'calendarElement.ts',
    props: { year: 2082, month: 5, language: 'ne', weekStartsOn: 6, showAd: false, theme: 'dark', today: '2082-05-10' },
    expectAttrs: { year: '2082', month: '5', language: 'ne', 'week-starts-on': '6', 'show-ad': 'false', theme: 'dark', today: '2082-05-10' },
  },
  {
    name: 'JhiguAddressSelect', Component: JhiguAddressSelect, tag: 'jhigu-address-select',
    observed: AddressEl.observedAttributes, unobserved: [], sourceFile: 'addressElement.ts',
    props: { value: 274, ward: 3, language: 'ne', showWard: false, name: 'addr', required: true, disabled: true, theme: 'dark' },
    expectAttrs: { value: '274', ward: '3', language: 'ne', 'show-ward': 'false', name: 'addr', required: '', disabled: '', theme: 'dark' },
  },
  {
    name: 'JhiguMoneyInput', Component: JhiguMoneyInput, tag: 'jhigu-money-input',
    observed: MoneyEl.observedAttributes, unobserved: ['name'], sourceFile: 'fieldElements.ts',
    props: { valuePaisa: 0, symbol: 'Rs.', devanagari: true, allowNegative: true, name: 'amount', placeholder: '0.00', label: 'Amount', language: 'ne', disabled: true, readonly: true, required: true, theme: 'dark' },
    expectAttrs: { 'value-paisa': '0', symbol: 'Rs.', devanagari: '', 'allow-negative': '', name: 'amount', placeholder: '0.00', label: 'Amount', language: 'ne', disabled: '', readonly: '', required: '', theme: 'dark' },
  },
  {
    name: 'JhiguPhoneInput', Component: JhiguPhoneInput, tag: 'jhigu-phone-input',
    observed: PhoneEl.observedAttributes, unobserved: ['name'], sourceFile: 'fieldElements.ts',
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

  it('every attribute it writes is one the element observes (or reads by name)', () => {
    const known = new Set([...c.observed, ...c.unobserved]);
    for (const [prop, { attr }] of Object.entries(spec.attrs)) {
      expect(known.has(attr), `${prop} -> ${attr}`).toBe(true);
    }
  });

  it('it covers every attribute the element observes', () => {
    const written = new Set(Object.values(spec.attrs).map(a => a.attr));
    const missing = c.observed.filter(a => !written.has(a));
    // `marked` is the calendar's JSON attribute; the component takes `events` instead.
    expect(missing.filter(a => !(c.tag === 'jhigu-calendar' && a === 'marked'))).toEqual([]);
  });

  it('every event it listens for is one the element dispatches', () => {
    const source = elementSource(c.sourceFile);
    for (const name of Object.values(spec.events)) {
      expect(new RegExp(`CustomEvent(?:<[^>]*>)?\\('${name}'`).test(source), name).toBe(true);
    }
  });

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
});
