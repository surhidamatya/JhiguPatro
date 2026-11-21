import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import type { App } from 'vue';

/**
 * The real element classes are never created here (jsdom has no ElementInternals);
 * registering a stub under the real tag name is all a component needs. That the
 * mapping matches the real elements is checked in ts/tests/elementBindings.test.ts.
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
import { elementBindings } from 'jhigu-patro-utils-ts/element-bindings';

interface Case {
  name: string;
  Component: unknown;
  tag: string;
  binding: keyof typeof elementBindings;
  props: Record<string, unknown>;
  expectAttrs: Record<string, string>;
  /** The Vue event names (and handler props) the component emits. */
  events: Record<string, string>;
}

const cases: Case[] = [
  {
    name: 'JhiguDatePicker', Component: JhiguDatePicker, tag: 'jhigu-date-picker', binding: 'datePicker',
    props: { value: '2082-05-10', min: '2080-01-01', max: '2090-12-30', language: 'ne', weekStartsOn: 1, showAd: false, name: 'dob', disabled: true, required: true, popup: true, theme: 'dark', today: '2082-05-10' },
    expectAttrs: { value: '2082-05-10', min: '2080-01-01', max: '2090-12-30', language: 'ne', 'week-starts-on': '1', 'show-ad': 'false', name: 'dob', disabled: '', required: '', popup: '', theme: 'dark', today: '2082-05-10' },
    events: { onChange: 'jhiguChange', onOpen: 'jhiguOpen', onClose: 'jhiguClose' },
  },
  {
    name: 'JhiguDateRangePicker', Component: JhiguDateRangePicker, tag: 'jhigu-date-range-picker', binding: 'dateRangePicker',
    props: { start: '2082-05-10', end: '2082-05-15', min: '2080-01-01', max: '2090-12-30', language: 'en', weekStartsOn: 0, showAd: false, name: 'stay', disabled: true, required: true, popup: true, theme: 'light', today: '2082-05-10' },
    expectAttrs: { start: '2082-05-10', end: '2082-05-15', min: '2080-01-01', max: '2090-12-30', language: 'en', 'week-starts-on': '0', 'show-ad': 'false', name: 'stay', disabled: '', required: '', popup: '', theme: 'light', today: '2082-05-10' },
    events: { onChange: 'jhiguChange', onOpen: 'jhiguOpen', onClose: 'jhiguClose' },
  },
  {
    name: 'JhiguCalendar', Component: JhiguCalendar, tag: 'jhigu-calendar', binding: 'calendar',
    props: { year: 2082, month: 5, language: 'ne', weekStartsOn: 6, showAd: false, theme: 'dark', today: '2082-05-10' },
    expectAttrs: { year: '2082', month: '5', language: 'ne', 'week-starts-on': '6', 'show-ad': 'false', theme: 'dark', today: '2082-05-10' },
    events: { onSelect: 'jhiguSelect', onMonthChange: 'jhiguMonthChange' },
  },
  {
    name: 'JhiguAddressSelect', Component: JhiguAddressSelect, tag: 'jhigu-address-select', binding: 'addressSelect',
    props: { value: 274, ward: 3, language: 'ne', showWard: false, name: 'addr', required: true, disabled: true, theme: 'dark' },
    expectAttrs: { value: '274', ward: '3', language: 'ne', 'show-ward': 'false', name: 'addr', required: '', disabled: '', theme: 'dark' },
    events: { onChange: 'jhiguChange' },
  },
  {
    name: 'JhiguMoneyInput', Component: JhiguMoneyInput, tag: 'jhigu-money-input', binding: 'moneyInput',
    props: { valuePaisa: 0, symbol: 'Rs.', devanagari: true, allowNegative: true, name: 'amount', placeholder: '0.00', label: 'Amount', language: 'ne', disabled: true, readonly: true, required: true, theme: 'dark' },
    expectAttrs: { 'value-paisa': '0', symbol: 'Rs.', devanagari: '', 'allow-negative': '', name: 'amount', placeholder: '0.00', label: 'Amount', language: 'ne', disabled: '', readonly: '', required: '', theme: 'dark' },
    events: { onChange: 'jhiguChange' },
  },
  {
    name: 'JhiguPhoneInput', Component: JhiguPhoneInput, tag: 'jhigu-phone-input', binding: 'phoneInput',
    props: { value: '9841234567', allowInactive: true, name: 'phone', placeholder: '98XXXXXXXX', label: 'Mobile', language: 'ne', disabled: true, readonly: true, required: true, theme: 'dark' },
    expectAttrs: { value: '9841234567', 'allow-inactive': '', name: 'phone', placeholder: '98XXXXXXXX', label: 'Mobile', language: 'ne', disabled: '', readonly: '', required: '', theme: 'dark' },
    events: { onChange: 'jhiguChange' },
  },
];

let container: HTMLDivElement;
let app: App | null;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  app = null;
});
afterEach(() => {
  app?.unmount();
  container.remove();
});

describe.each(cases)('$name', c => {
  const mount = (props: Record<string, unknown>, ref?: (r: unknown) => void) => {
    const state = reactive({ ...props });
    app = createApp({ render: () => h(c.Component as never, { ...state, ...(ref ? { ref } : {}) }) });
    app.mount(container);
    return state;
  };

  it('has the name and tag from the shared table', () => {
    expect((c.Component as { name: string }).name).toBe(c.name);
    expect(elementBindings[c.binding].tag).toBe(c.tag);
  });

  it('writes each prop as the right attribute', () => {
    mount(c.props);
    const e = container.querySelector(c.tag)!;
    expect(e).not.toBeNull();
    expect(Object.fromEntries(e.getAttributeNames().map(n => [n, e.getAttribute(n)!]))).toEqual(c.expectAttrs);
  });

  it('with no props the element has no attributes (default-on props stay on)', () => {
    mount({});
    expect(container.querySelector(c.tag)!.getAttributeNames()).toEqual([]);
  });

  it('a prop change writes just that attribute', async () => {
    const state = mount({ language: 'en' });
    state.language = 'ne';
    await nextTick();
    expect(container.querySelector(c.tag)!.getAttribute('language')).toBe('ne');
  });

  it('each event handler is called for its own DOM event, with the detail', () => {
    const handlers: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const prop of Object.keys(c.events)) handlers[prop] = vi.fn();
    mount(handlers);
    const e = container.querySelector(c.tag)!;
    for (const [prop, eventName] of Object.entries(c.events)) {
      const detail = { from: eventName };
      e.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
      expect(handlers[prop]).toHaveBeenCalledTimes(1);
      expect(handlers[prop].mock.calls[0][0]).toEqual(detail);
      for (const [other, fn] of Object.entries(handlers)) if (other !== prop) expect(fn).toHaveBeenCalledTimes(0);
      handlers[prop].mockClear();
    }
  });

  it('the events it can emit are the ones in the shared table', () => {
    expect(Object.keys(c.events).sort()).toEqual(Object.keys(elementBindings[c.binding].spec.events).sort());
  });

  it('the ref exposes the element', () => {
    let r: unknown;
    mount({}, v => { r = v; });
    expect((r as { element: unknown }).element).toBe(container.querySelector(c.tag));
  });
});

describe('number props are Vue Number props', () => {
  it('a string given for a Number prop still writes the same attribute', () => {
    app = createApp({ render: () => h(JhiguCalendar as never, { year: '2082', month: '5' }) });
    app.mount(container);
    const e = container.querySelector('jhigu-calendar')!;
    expect([e.getAttribute('year'), e.getAttribute('month')]).toEqual(['2082', '5']);
  });
});

describe('calendar events', () => {
  it('are given as a property, not an attribute', () => {
    const events = { '2082-06-03': ['Laxmi Puja'] };
    app = createApp({ render: () => h(JhiguCalendar as never, { events }) });
    app.mount(container);
    const e = container.querySelector('jhigu-calendar') as unknown as Element & { events: unknown };
    expect(e.events).toBe(events);
    expect(e.hasAttribute('events')).toBe(false);
  });
});
