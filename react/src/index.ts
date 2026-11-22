/**
 * React components for the Jhigu Patro web components.
 *
 *   import { JhiguDatePicker, JhiguPhoneInput } from 'jhigu-patro-react';
 *
 *   <JhiguDatePicker language="ne" min="2080-01-01" onChange={d => setDate(d.bs)} />
 *   <JhiguPhoneInput name="phone" onChange={d => setPhone(d.e164)} />
 *
 * Before the first render that needs dates, load the calendar data once
 * (`initializeCalendar` from `jhigu-patro-utils-ts`). Money and phone need no data.
 *
 * Props are the elements' attributes in camelCase (`week-starts-on` becomes
 * `weekStartsOn`). Each callback prop gets the event's `detail` first and the DOM
 * event second. A `ref` is the custom element, so its methods work
 * (`ref.current.open()` on a popup picker). A prop is written to the element only
 * when it changes, so a rerender does not reset a field the user has typed in; to
 * change a field from the parent, change its prop. Style them with `className`,
 * `style` (CSS custom properties work) or the elements' CSS variables and `::part`s.
 *
 * Client only: the elements are created after the first render, so a server render
 * has the empty wrapper. Nothing here depends on the React version (18 and later).
 */
import type { JhiguChangeDetail, JhiguDatePicker as DatePickerElement } from 'jhigu-patro-utils-ts/date-picker-element';
import type { JhiguRangeChangeDetail, JhiguDateRangePicker as RangePickerElement } from 'jhigu-patro-utils-ts/range-picker-element';
import type { JhiguCalendar as CalendarElement, JhiguMonthChangeDetail, JhiguSelectDetail, TithiSource } from 'jhigu-patro-utils-ts/calendar-element';
import type { JhiguAddressChangeDetail, JhiguAddressSelect as AddressElement } from 'jhigu-patro-utils-ts/address-element';
import type {
  JhiguMoneyChangeDetail, JhiguMoneyInput as MoneyElement,
  JhiguPhoneChangeDetail, JhiguPhoneInput as PhoneElement,
} from 'jhigu-patro-utils-ts/field-elements';
import { elementBindings as b } from 'jhigu-patro-utils-ts/element-bindings';
import { createJhiguComponent } from './wrap.js';
import type { HostProps } from './wrap.js';

export { createJhiguComponent } from './wrap.js';
export type { AttrKind, AttrSpec, ComponentSpec, HostProps } from './wrap.js';
export type {
  JhiguChangeDetail, JhiguRangeChangeDetail, JhiguSelectDetail, JhiguMonthChangeDetail, TithiSource,
  JhiguAddressChangeDetail, JhiguMoneyChangeDetail, JhiguPhoneChangeDetail,
  DatePickerElement, RangePickerElement, CalendarElement, AddressElement, MoneyElement, PhoneElement,
};

type Language = 'en' | 'ne';
type Theme = 'light' | 'dark';
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The callback gets the event's detail, then the DOM event. */
type Handler<D> = (detail: D, event: CustomEvent<D>) => void;
type PlainHandler = (detail: unknown, event: CustomEvent) => void;

// ── Date picker ──────────────────────────────────────────────────────────────

export interface JhiguDatePickerProps extends HostProps {
  /** BS date `YYYY-MM-DD`. Setting it again from the parent changes the selection. */
  value?: string;
  min?: string;
  max?: string;
  language?: Language;
  /** 0 is Sunday. */
  weekStartsOn?: Weekday;
  /** Show the AD day under each BS day. Default on. */
  showAd?: boolean;
  /** Form field name; the BS date is submitted with the form. */
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Show a button that opens the calendar in a popup. */
  popup?: boolean;
  theme?: Theme;
  /** The day marked as today (for tests and previews). */
  today?: string;
  onChange?: Handler<JhiguChangeDetail>;
  onOpen?: PlainHandler;
  onClose?: PlainHandler;
}

export const JhiguDatePicker = createJhiguComponent<DatePickerElement, JhiguDatePickerProps>(b.datePicker.tag, b.datePicker.define, b.datePicker.spec);

// ── Range picker ─────────────────────────────────────────────────────────────

export interface JhiguDateRangePickerProps extends HostProps {
  /** BS dates `YYYY-MM-DD`. An end needs a start. */
  start?: string;
  end?: string;
  min?: string;
  max?: string;
  language?: Language;
  weekStartsOn?: Weekday;
  showAd?: boolean;
  /** Form field name: `name_start` and `name_end` are submitted. */
  name?: string;
  disabled?: boolean;
  required?: boolean;
  popup?: boolean;
  theme?: Theme;
  today?: string;
  onChange?: Handler<JhiguRangeChangeDetail>;
  onOpen?: PlainHandler;
  onClose?: PlainHandler;
}

export const JhiguDateRangePicker = createJhiguComponent<RangePickerElement, JhiguDateRangePickerProps>(b.dateRangePicker.tag, b.dateRangePicker.define, b.dateRangePicker.spec);

// ── Calendar ─────────────────────────────────────────────────────────────────

export interface JhiguCalendarProps extends HostProps {
  /** The month to show first (both needed). Changing them moves the view. */
  year?: number;
  month?: number;
  language?: Language;
  weekStartsOn?: Weekday;
  showAd?: boolean;
  /** Show the tithi when `panchang` is set. Default on. */
  showTithi?: boolean;
  /** Where the tithi comes from: a `PanchangDataSource` with its years loaded. Pass a stable object. */
  panchang?: TithiSource | null;
  /**
   * Titles by BS date: `{ '2082-06-03': ['Laxmi Puja'] }`. Pass a stable object
   * (state, a constant or `useMemo`): a new object on every render rewrites the marks.
   */
  events?: Record<string, string | string[]>;
  theme?: Theme;
  today?: string;
  onSelect?: Handler<JhiguSelectDetail>;
  onMonthChange?: Handler<JhiguMonthChangeDetail>;
}

export const JhiguCalendar = createJhiguComponent<CalendarElement, JhiguCalendarProps>(b.calendar.tag, b.calendar.define, b.calendar.spec);

// ── Address ──────────────────────────────────────────────────────────────────

export interface JhiguAddressSelectProps extends HostProps {
  /** A saved local level id (its district and province are filled in). */
  value?: number;
  /** A saved ward. */
  ward?: number;
  language?: Language;
  /** Show the ward dropdown. Default on. */
  showWard?: boolean;
  /** Form field name: `name`, `name_ward`, `name_district` and `name_province` are submitted. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  theme?: Theme;
  onChange?: Handler<JhiguAddressChangeDetail>;
}

export const JhiguAddressSelect = createJhiguComponent<AddressElement, JhiguAddressSelectProps>(b.addressSelect.tag, b.addressSelect.define, b.addressSelect.spec);

// ── Money and phone ──────────────────────────────────────────────────────────

export interface JhiguMoneyInputProps extends HostProps {
  /** Integer paisa (never rupees as a float). Setting it again changes the field. */
  valuePaisa?: number;
  /** Shown beside the field: `Rs.` or `रु`. */
  symbol?: string;
  /** Show Devanagari digits. */
  devanagari?: boolean;
  allowNegative?: boolean;
  name?: string;
  placeholder?: string;
  /** The field's accessible name. */
  label?: string;
  language?: Language;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  theme?: Theme;
  onChange?: Handler<JhiguMoneyChangeDetail>;
}

export const JhiguMoneyInput = createJhiguComponent<MoneyElement, JhiguMoneyInputProps>(b.moneyInput.tag, b.moneyInput.define, b.moneyInput.spec);

export interface JhiguPhoneInputProps extends HostProps {
  /** The text in the field. Setting it again from the parent changes the field. */
  value?: string;
  allowInactive?: boolean;
  name?: string;
  placeholder?: string;
  label?: string;
  language?: Language;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  theme?: Theme;
  onChange?: Handler<JhiguPhoneChangeDetail>;
}

export const JhiguPhoneInput = createJhiguComponent<PhoneElement, JhiguPhoneInputProps>(b.phoneInput.tag, b.phoneInput.define, b.phoneInput.spec);
