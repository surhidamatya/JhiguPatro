/**
 * Vue 3 components for the Jhigu Patro web components.
 *
 *   import { JhiguDatePicker, JhiguPhoneInput } from 'jhigu-patro-vue';
 *
 *   <JhiguDatePicker language="ne" :value="dob" min="2080-01-01" @change="d => dob = d.bs" />
 *   <JhiguPhoneInput name="phone" @change="d => phone = d.e164" />
 *
 * Before the first render that needs dates, load the calendar data once
 * (`initializeCalendar` from `jhigu-patro-utils-ts`). Money and phone need no data.
 *
 * Props are the elements' attributes in camelCase (`week-starts-on` is `weekStartsOn`,
 * which a template can also write as `week-starts-on`). Events are Vue events whose
 * first argument is the event's `detail` and second is the DOM event: `@change`,
 * `@select`, `@month-change`, `@open`, `@close`. A prop is written to the element only
 * when it changes, so a re-render does not reset a field the user has typed in; to change
 * a field from the parent, change its prop. `class`, `style` (CSS custom properties work),
 * `id`, `title`, `hidden`, `slot`, `data-*` and `aria-*` go to the element itself. A
 * template ref gives the component; `ref.value.element` is the custom element.
 *
 * Client only: the element is created on mount, so a server render has the empty wrapper.
 */
import { elementBindings as b } from 'jhigu-patro-utils-ts/element-bindings';
import type { JhiguChangeDetail, JhiguDatePicker as DatePickerElement } from 'jhigu-patro-utils-ts/date-picker-element';
import type { JhiguRangeChangeDetail, JhiguDateRangePicker as RangePickerElement } from 'jhigu-patro-utils-ts/range-picker-element';
import type { JhiguCalendar as CalendarElement, JhiguMonthChangeDetail, JhiguSelectDetail, TithiSource } from 'jhigu-patro-utils-ts/calendar-element';
import type { JhiguAddressChangeDetail, JhiguAddressSelect as AddressElement } from 'jhigu-patro-utils-ts/address-element';
import type {
  JhiguMoneyChangeDetail, JhiguMoneyInput as MoneyElement,
  JhiguPhoneChangeDetail, JhiguPhoneInput as PhoneElement,
} from 'jhigu-patro-utils-ts/field-elements';
import { createJhiguComponent } from './wrap.js';

export { createJhiguComponent, vueEventName, hostProps, parseStyleText } from './wrap.js';
export type {
  JhiguChangeDetail, JhiguRangeChangeDetail, JhiguSelectDetail, JhiguMonthChangeDetail, TithiSource,
  JhiguAddressChangeDetail, JhiguMoneyChangeDetail, JhiguPhoneChangeDetail,
  DatePickerElement, RangePickerElement, CalendarElement, AddressElement, MoneyElement, PhoneElement,
};

type Language = 'en' | 'ne';
type Theme = 'light' | 'dark';
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** What a template sees for a component: its props, its events and its `element`. */
type JhiguComponent<Props, Events, El> = new () => {
  $props: Props & Events & Record<string, unknown>;
  element: El | null;
};
type On<D> = { onChange?: (detail: D, event: CustomEvent<D>) => void };

export interface JhiguDatePickerProps {
  /** BS date `YYYY-MM-DD`. Setting it again from the parent changes the selection. */
  value?: string; min?: string; max?: string; language?: Language;
  /** 0 is Sunday. */
  weekStartsOn?: Weekday;
  /** Show the AD day under each BS day. Default on. */
  showAd?: boolean;
  /** Form field name; the BS date is submitted with the form. */
  name?: string; disabled?: boolean; required?: boolean;
  /** Show a button that opens the calendar in a popup. */
  popup?: boolean; theme?: Theme; today?: string;
}
export interface JhiguDateRangePickerProps {
  /** BS dates `YYYY-MM-DD`. An end needs a start. */
  start?: string; end?: string; min?: string; max?: string; language?: Language; weekStartsOn?: Weekday;
  showAd?: boolean;
  /** Form field name: `name_start` and `name_end` are submitted. */
  name?: string; disabled?: boolean; required?: boolean; popup?: boolean; theme?: Theme; today?: string;
}
export interface JhiguCalendarProps {
  /** The month to show first (both needed). Changing them moves the view. */
  year?: number; month?: number; language?: Language; weekStartsOn?: Weekday; showAd?: boolean;
  /** Show the tithi when `panchang` is set. Default on. */
  showTithi?: boolean;
  /** Where the tithi comes from: a `PanchangDataSource` with its years loaded. Pass a stable object (a ref or constant). */
  panchang?: TithiSource | null;
  /** Titles by BS date: `{ '2082-06-03': ['Laxmi Puja'] }`. Pass a stable object (a ref or constant). */
  events?: Record<string, string | string[]>;
  theme?: Theme; today?: string;
}
export interface JhiguAddressSelectProps {
  /** A saved local level id (its district and province are filled in). */
  value?: number; ward?: number; language?: Language;
  /** Show the ward dropdown. Default on. */
  showWard?: boolean;
  /** Form field name: `name`, `name_ward`, `name_district` and `name_province` are submitted. */
  name?: string; required?: boolean; disabled?: boolean; theme?: Theme;
}
export interface JhiguMoneyInputProps {
  /** Integer paisa (never rupees as a float). Setting it again changes the field. */
  valuePaisa?: number;
  /** Shown beside the field: `Rs.` or `रु`. */
  symbol?: string; devanagari?: boolean; allowNegative?: boolean; name?: string; placeholder?: string;
  /** The field's accessible name. */
  label?: string; language?: Language; disabled?: boolean; readonly?: boolean; required?: boolean; theme?: Theme;
}
export interface JhiguPhoneInputProps {
  /** The text in the field. Setting it again from the parent changes the field. */
  value?: string; allowInactive?: boolean; name?: string; placeholder?: string; label?: string;
  language?: Language; disabled?: boolean; readonly?: boolean; required?: boolean; theme?: Theme;
}

type OpenClose = {
  onOpen?: (detail: unknown, event: CustomEvent) => void;
  onClose?: (detail: unknown, event: CustomEvent) => void;
};

export const JhiguDatePicker = createJhiguComponent('JhiguDatePicker', b.datePicker.tag, b.datePicker.define, b.datePicker.spec) as unknown as
  JhiguComponent<JhiguDatePickerProps, On<JhiguChangeDetail> & OpenClose, DatePickerElement>;
export const JhiguDateRangePicker = createJhiguComponent('JhiguDateRangePicker', b.dateRangePicker.tag, b.dateRangePicker.define, b.dateRangePicker.spec) as unknown as
  JhiguComponent<JhiguDateRangePickerProps, On<JhiguRangeChangeDetail> & OpenClose, RangePickerElement>;
export const JhiguCalendar = createJhiguComponent('JhiguCalendar', b.calendar.tag, b.calendar.define, b.calendar.spec) as unknown as
  JhiguComponent<JhiguCalendarProps, {
    onSelect?: (detail: JhiguSelectDetail, event: CustomEvent<JhiguSelectDetail>) => void;
    onMonthChange?: (detail: JhiguMonthChangeDetail, event: CustomEvent<JhiguMonthChangeDetail>) => void;
  }, CalendarElement>;
export const JhiguAddressSelect = createJhiguComponent('JhiguAddressSelect', b.addressSelect.tag, b.addressSelect.define, b.addressSelect.spec) as unknown as
  JhiguComponent<JhiguAddressSelectProps, On<JhiguAddressChangeDetail>, AddressElement>;
export const JhiguMoneyInput = createJhiguComponent('JhiguMoneyInput', b.moneyInput.tag, b.moneyInput.define, b.moneyInput.spec) as unknown as
  JhiguComponent<JhiguMoneyInputProps, On<JhiguMoneyChangeDetail>, MoneyElement>;
export const JhiguPhoneInput = createJhiguComponent('JhiguPhoneInput', b.phoneInput.tag, b.phoneInput.define, b.phoneInput.spec) as unknown as
  JhiguComponent<JhiguPhoneInputProps, On<JhiguPhoneChangeDetail>, PhoneElement>;
