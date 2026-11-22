/**
 * The prop-to-attribute tables for the six web components, in one place so the
 * React and Vue packages (and any other framework layer) cannot drift apart.
 * Each entry is `{ tag, define, spec }`: the custom element's tag name, the function
 * that registers it, and an `ElementSpec` for `ElementBinding`.
 *
 *   import { elementBindings } from 'jhigu-patro-utils-ts/element-bindings';
 *   const { tag, define, spec } = elementBindings.datePicker;
 *
 * Prop names are the attributes in camelCase (`week-starts-on` is `weekStartsOn`).
 * `showAd` and `showWard` default to on: only an explicit `false` turns them off.
 * The calendar's `events` is a property, not an attribute.
 */
import type { AttrSpec, ElementSpec, PropValueType } from './elementBinding.js';
import { defineJhiguAddressSelect } from './elements/addressElement.js';
import { defineJhiguCalendar } from './elements/calendarElement.js';
import { defineJhiguDatePicker } from './elements/datePickerElement.js';
import { defineJhiguMoneyInput, defineJhiguPhoneInput } from './elements/fieldElements.js';
import { defineJhiguDateRangePicker } from './elements/rangePickerElement.js';

export interface ElementBindingEntry {
  tag: string;
  /** Registers the custom element (safe to call more than once; needs a browser). */
  define: () => unknown;
  spec: ElementSpec;
}

const a = (attr: string, kind: AttrSpec['kind'], type: PropValueType = 'string'): AttrSpec => ({ attr, kind, type });
const str = (attr: string) => a(attr, 'string');
const num = (attr: string) => a(attr, 'string', 'number');
const bool = (attr: string) => a(attr, 'boolean', 'boolean');
const off = (attr: string) => a(attr, 'falseOnly', 'boolean');

export const elementBindings = {
  datePicker: {
    tag: 'jhigu-date-picker',
    define: () => defineJhiguDatePicker(),
    spec: {
      attrs: {
        value: str('value'), min: str('min'), max: str('max'), language: str('language'),
        weekStartsOn: num('week-starts-on'), showAd: off('show-ad'), name: str('name'),
        disabled: bool('disabled'), required: bool('required'), popup: bool('popup'),
        theme: str('theme'), today: str('today'),
      },
      events: { onChange: 'jhiguChange', onOpen: 'jhiguOpen', onClose: 'jhiguClose' },
    },
  },
  dateRangePicker: {
    tag: 'jhigu-date-range-picker',
    define: () => defineJhiguDateRangePicker(),
    spec: {
      attrs: {
        start: str('start'), end: str('end'), min: str('min'), max: str('max'), language: str('language'),
        weekStartsOn: num('week-starts-on'), showAd: off('show-ad'), name: str('name'),
        disabled: bool('disabled'), required: bool('required'), popup: bool('popup'),
        theme: str('theme'), today: str('today'),
      },
      events: { onChange: 'jhiguChange', onOpen: 'jhiguOpen', onClose: 'jhiguClose' },
    },
  },
  calendar: {
    tag: 'jhigu-calendar',
    define: () => defineJhiguCalendar(),
    spec: {
      attrs: {
        year: num('year'), month: num('month'), language: str('language'), weekStartsOn: num('week-starts-on'),
        showAd: off('show-ad'), showTithi: off('show-tithi'), theme: str('theme'), today: str('today'),
      },
      properties: ['events', 'panchang'],
      events: { onSelect: 'jhiguSelect', onMonthChange: 'jhiguMonthChange' },
    },
  },
  addressSelect: {
    tag: 'jhigu-address-select',
    define: () => defineJhiguAddressSelect(),
    spec: {
      attrs: {
        value: num('value'), ward: num('ward'), language: str('language'), showWard: off('show-ward'),
        name: str('name'), required: bool('required'), disabled: bool('disabled'), theme: str('theme'),
      },
      events: { onChange: 'jhiguChange' },
    },
  },
  moneyInput: {
    tag: 'jhigu-money-input',
    define: () => defineJhiguMoneyInput(),
    spec: {
      attrs: {
        valuePaisa: num('value-paisa'), symbol: str('symbol'), devanagari: bool('devanagari'),
        allowNegative: bool('allow-negative'), name: str('name'), placeholder: str('placeholder'),
        label: str('label'), language: str('language'), disabled: bool('disabled'),
        readonly: bool('readonly'), required: bool('required'), theme: str('theme'),
      },
      events: { onChange: 'jhiguChange' },
    },
  },
  phoneInput: {
    tag: 'jhigu-phone-input',
    define: () => defineJhiguPhoneInput(),
    spec: {
      attrs: {
        value: str('value'), allowInactive: bool('allow-inactive'), name: str('name'),
        placeholder: str('placeholder'), label: str('label'), language: str('language'),
        disabled: bool('disabled'), readonly: bool('readonly'), required: bool('required'), theme: str('theme'),
      },
      events: { onChange: 'jhiguChange' },
    },
  },
} satisfies Record<string, ElementBindingEntry>;

export type ElementBindingName = keyof typeof elementBindings;
