import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attributeText } from '../src/elementBinding.js';
import { elementBindings } from '../src/elementBindings.js';
import type { ElementBindingName } from '../src/elementBindings.js';
import { JhiguDatePicker } from '../src/elements/datePickerElement.js';
import { JhiguDateRangePicker } from '../src/elements/rangePickerElement.js';
import { JhiguCalendar } from '../src/elements/calendarElement.js';
import { JhiguAddressSelect } from '../src/elements/addressElement.js';
import { JhiguMoneyInput, JhiguPhoneInput } from '../src/elements/fieldElements.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = (file: string) => readFileSync(join(here, '../src/elements', file), 'utf8');

interface Case {
  name: ElementBindingName;
  observed: readonly string[];
  /** Attributes the element reads with getAttribute but does not list in observedAttributes. */
  unobserved: string[];
  /** Observed attributes a binding deliberately does not map (documented). */
  skipped: string[];
  file: string;
  define: string;
}

const cases: Case[] = [
  { name: 'datePicker', observed: JhiguDatePicker.observedAttributes, unobserved: ['name'], skipped: [], file: 'datePickerElement.ts', define: 'defineJhiguDatePicker' },
  { name: 'dateRangePicker', observed: JhiguDateRangePicker.observedAttributes, unobserved: [], skipped: [], file: 'rangePickerElement.ts', define: 'defineJhiguDateRangePicker' },
  // `marked` is the calendar's JSON attribute; the binding takes `events` as a property instead.
  { name: 'calendar', observed: JhiguCalendar.observedAttributes, unobserved: [], skipped: ['marked'], file: 'calendarElement.ts', define: 'defineJhiguCalendar' },
  { name: 'addressSelect', observed: JhiguAddressSelect.observedAttributes, unobserved: [], skipped: [], file: 'addressElement.ts', define: 'defineJhiguAddressSelect' },
  { name: 'moneyInput', observed: JhiguMoneyInput.observedAttributes, unobserved: ['name'], skipped: [], file: 'fieldElements.ts', define: 'defineJhiguMoneyInput' },
  { name: 'phoneInput', observed: JhiguPhoneInput.observedAttributes, unobserved: ['name'], skipped: [], file: 'fieldElements.ts', define: 'defineJhiguPhoneInput' },
];

describe('attributeText', () => {
  it('string: text, 0 and empty text are kept; undefined and null remove', () => {
    expect(attributeText('string', 'x')).toBe('x');
    expect(attributeText('string', 0)).toBe('0');
    expect(attributeText('string', '')).toBe('');
    expect(attributeText('string', 12)).toBe('12');
    expect(attributeText('string', undefined)).toBeNull();
    expect(attributeText('string', null)).toBeNull();
  });
  it('boolean: present for any truthy value (as React does), removed for falsy ones', () => {
    expect(attributeText('boolean', true)).toBe('');
    expect(attributeText('boolean', 1)).toBe('');
    expect(attributeText('boolean', 'yes')).toBe('');
    for (const v of [false, 0, '', undefined, null]) expect(attributeText('boolean', v)).toBeNull();
  });
  it('falseOnly: "false" only for exactly false', () => {
    expect(attributeText('falseOnly', false)).toBe('false');
    for (const v of [true, 0, '', 'false', undefined, null]) expect(attributeText('falseOnly', v)).toBeNull();
  });
});

describe.each(cases)('binding $name matches the element', c => {
  const { tag, spec } = elementBindings[c.name];

  it('writes only attributes the element observes or reads by name', () => {
    const known = new Set([...c.observed, ...c.unobserved]);
    for (const [prop, { attr }] of Object.entries(spec.attrs)) expect(known.has(attr), `${prop} -> ${attr}`).toBe(true);
  });

  it('covers every observed attribute (except the documented ones)', () => {
    const written = new Set(Object.values(spec.attrs).map(x => x.attr));
    expect(c.observed.filter(x => !written.has(x) && !c.skipped.includes(x))).toEqual([]);
  });

  it('listens only for events the element dispatches', () => {
    const src = source(c.file);
    for (const name of Object.values(spec.events)) {
      expect(new RegExp(`CustomEvent(?:<[^>]*>)?\\('${name}'`).test(src), name).toBe(true);
    }
  });

  it('the tag is the one the element is registered under by default', () => {
    expect(source(c.file)).toContain(`export function ${c.define}(tag = '${tag}')`);
  });

  it('prop names are camelCase of the attribute names', () => {
    const camel = (s: string) => s.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
    for (const [prop, { attr }] of Object.entries(spec.attrs)) {
      // `valuePaisa` and `weekStartsOn` follow the rule; the field props are the same names.
      expect(prop, attr).toBe(camel(attr));
    }
  });

  it('every attribute has a declared value type; booleans and numbers are typed', () => {
    for (const [prop, a] of Object.entries(spec.attrs)) {
      expect(['string', 'number', 'boolean']).toContain(a.type ?? 'string');
      if (a.kind === 'boolean' || a.kind === 'falseOnly') expect(a.type, prop).toBe('boolean');
    }
  });
});

describe('the whole table', () => {
  it('has every element once, with distinct tags', () => {
    const tags = Object.values(elementBindings).map(b => b.tag);
    expect(tags.sort()).toEqual([
      'jhigu-address-select', 'jhigu-calendar', 'jhigu-date-picker', 'jhigu-date-range-picker',
      'jhigu-money-input', 'jhigu-phone-input',
    ]);
  });

  it('numeric props are exactly the ones that are numbers in the elements', () => {
    const numeric = (n: ElementBindingName) => Object.entries(elementBindings[n].spec.attrs).filter(([, a]) => a.type === 'number').map(([p]) => p).sort();
    expect(numeric('datePicker')).toEqual(['weekStartsOn']);
    expect(numeric('dateRangePicker')).toEqual(['weekStartsOn']);
    expect(numeric('calendar')).toEqual(['month', 'weekStartsOn', 'year']);
    expect(numeric('addressSelect')).toEqual(['value', 'ward']);
    expect(numeric('moneyInput')).toEqual(['valuePaisa']);
    expect(numeric('phoneInput')).toEqual([]);
  });

  it('default-on attributes use falseOnly; the rest of the booleans use boolean', () => {
    for (const [name, b] of Object.entries(elementBindings)) {
      for (const [prop, a] of Object.entries(b.spec.attrs)) {
        if (prop === 'showAd' || prop === 'showWard') expect(a.kind, `${name}.${prop}`).toBe('falseOnly');
        else if (a.type === 'boolean') expect(a.kind, `${name}.${prop}`).toBe('boolean');
      }
    }
  });
});
