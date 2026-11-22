/**
 * `<jhigu-date-picker>`: a BS date picker web component (guide 15.2, U-5, U-6,
 * U-15). Plain custom element with shadow DOM and no dependencies, built on the
 * headless `createDatePicker`. (The guide suggests Stencil for generated
 * framework wrappers; this does not use it. Wrappers can be added later.)
 *
 *   import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
 *   import { defineJhiguDatePicker } from 'jhigu-patro-utils-ts/date-picker-element';
 *   initializeCalendar(new InlineCalendarDataSource(...));   // the calendar must be ready first
 *   defineJhiguDatePicker();
 *
 *   <jhigu-date-picker name="dob" language="ne" min="2070-01-01" popup required></jhigu-date-picker>
 *
 * Attributes: `value` (BS `YYYY-MM-DD`), `min`, `max`, `language` (`en` | `ne`),
 * `week-starts-on` (0 = Sunday), `show-ad` (default on; `show-ad="false"` turns it
 * off), `name`, `disabled`, `required`, `popup`, `theme` (`light` | `dark`, default
 * follows the system), `today` (a BS date to treat as today, for tests).
 *
 * Property `value` is the BS date text, `''` when empty. Events (bubbling,
 * composed): `jhiguChange` with `detail: { bs, ad, value }` (`bs` and `ad` are
 * `YYYY-MM-DD`, `''` when cleared; `value` is a `NepaliDate` or null), and in
 * popup mode `jhiguOpen` and `jhiguClose`. The element is form-associated: the
 * BS value posts under `name`, `required` and reset work, and an unreadable
 * `value` sets `badInput`.
 *
 * Theming: CSS variables `--jhigu-color-primary`, `-on-primary`, `-surface`,
 * `-text`, `-muted`, `-holiday`, `-today`, `--jhigu-radius`, `--jhigu-font-family`,
 * `--jhigu-font-size`; parts `root`, `trigger`, `header`, `title`, `nav`, `grid`,
 * `weekday`, `day`, `today`, `weekend`, `selected`, `focused`, `disabled`, `ad`,
 * `months`, `month`, `years`, `year`, `footer`, `today-button`, `clear-button`.
 */
import { createDatePicker, keyAction } from '../datePicker.js';
import type { DatePicker, DatePickerState } from '../datePicker.js';
import { formatPreset } from '../dateFormat.js';
import { JhiguError } from '../errors.js';
import { getStrings } from '../generated/strings.js';
import type { Language } from '../generated/strings.js';
import { NepaliDate } from '../nepaliDate.js';
import { esc, PICKER_CSS, renderCalendarMarkup } from './pickerMarkup.js';

export interface JhiguChangeDetail {
  /** BS date `YYYY-MM-DD`, or `''` when cleared. */
  bs: string;
  /** AD date `YYYY-MM-DD`, or `''` when cleared. */
  ad: string;
  value: NepaliDate | null;
}

const BS_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseBs(text: string | null): NepaliDate | null {
  if (text === null || text.trim() === '') return null;
  const m = BS_TEXT.exec(text.trim());
  if (!m) throw new JhiguError('INVALID_DATE', 'expected YYYY-MM-DD', text);
  return new NepaliDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** AD date text for a BS date, computed from the day number so no time zone shifts it. */
export function adIso(d: NepaliDate): string {
  return new Date(d.dayNumber() * 86_400_000).toISOString().slice(0, 10);
}

const Base = ((globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ?? class {}) as typeof HTMLElement;

export class JhiguDatePicker extends Base {
  static formAssociated = true;
  static observedAttributes = [
    'value', 'min', 'max', 'language', 'week-starts-on', 'show-ad', 'disabled', 'required', 'popup', 'theme', 'today',
  ];

  private readonly internals: ElementInternals;
  private picker: DatePicker | null = null;
  private unsubscribe: (() => void) | null = null;
  private current: NepaliDate | null = null;
  private badInput = false;
  private fatal: string | null = null;
  private open = false;
  private app!: HTMLDivElement;
  private connectedOnce = false;
  private readonly onDocPointer = (e: Event) => {
    if (!e.composedPath().includes(this)) this.closePopup(false);
  };

  constructor() {
    super();
    this.internals = this.attachInternals();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PICKER_CSS;
    this.app = document.createElement('div');
    this.app.setAttribute('part', 'root');
    root.append(style, this.app);
    this.app.addEventListener('click', e => this.onClick(e));
    this.app.addEventListener('keydown', e => this.onKeyDown(e as KeyboardEvent));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** BS date text, `''` when empty. Setting an unreadable value sets `badInput`. */
  get value(): string {
    return this.current ? this.current.toString() : '';
  }

  set value(text: string) {
    this.setValueFromText(text);
    this.rebuild();
  }

  /** The value as a `NepaliDate`, or null. */
  get valueAsNepaliDate(): NepaliDate | null {
    return this.current;
  }

  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }

  /** Open the popup (popup mode only). */
  show(): void { this.openPopup(); }
  /** Close the popup (popup mode only). */
  hide(): void { this.closePopup(true); }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connectedCallback(): void {
    if (!this.connectedOnce) {
      this.connectedOnce = true;
      this.setValueFromText(this.getAttribute('value'));
    }
    this.rebuild();
  }

  disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this.onDocPointer, true);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.connectedOnce) return;
    if (name === 'value') this.setValueFromText(newValue);
    if (name === 'popup' && newValue === null) this.open = false;
    this.rebuild();
  }

  formResetCallback(): void {
    this.setValueFromText(this.getAttribute('value'));
    this.rebuild();
  }

  formDisabledCallback(disabled: boolean): void {
    this.toggleAttribute('disabled', disabled);
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === 'string') {
      this.setValueFromText(state);
      this.rebuild();
    }
  }

  focus(options?: FocusOptions): void {
    const target = this.shadowRoot?.querySelector<HTMLElement>('[tabindex="0"], .trigger');
    if (target) target.focus(options);
    else super.focus(options);
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private get language(): Language {
    return this.getAttribute('language') === 'ne' ? 'ne' : 'en';
  }

  private get isPopup(): boolean {
    return this.hasAttribute('popup');
  }

  private get isDisabled(): boolean {
    return this.hasAttribute('disabled');
  }

  private setValueFromText(text: string | null): void {
    try {
      this.current = parseBs(text);
      this.badInput = false;
    } catch {
      this.current = null;
      this.badInput = true;
    }
  }

  private optionalDate(attr: string): NepaliDate | null {
    const raw = this.getAttribute(attr);
    return raw === null || raw.trim() === '' ? null : parseBs(raw);
  }

  /** Create a fresh headless picker from the current attributes and value. */
  private rebuild(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.fatal = null;
    try {
      const weekStartsOn = this.hasAttribute('week-starts-on') ? Number(this.getAttribute('week-starts-on')) : 0;
      const todayAttr = this.optionalDate('today');
      const create = (value: NepaliDate | null) => createDatePicker({
        value,
        min: this.optionalDate('min'),
        max: this.optionalDate('max'),
        language: this.language,
        weekStartsOn,
        showAd: this.getAttribute('show-ad') !== 'false',
        today: todayAttr ?? undefined,
      });
      try {
        this.picker = create(this.current);
      } catch (e) {
        // A value outside min/max or the calendar is dropped and flagged, not fatal.
        if (this.current && e instanceof JhiguError && e.code === 'OUT_OF_RANGE') {
          this.current = null;
          this.badInput = true;
          this.picker = create(null);
        } else throw e;
      }
      this.unsubscribe = this.picker.subscribe(state => this.onState(state));
    } catch (e) {
      this.picker = null;
      this.fatal = e instanceof Error ? e.message : String(e);
    }
    this.syncForm();
    this.render();
  }

  private onState(state: DatePickerState): void {
    const next = state.value;
    const changed = (next?.toString() ?? '') !== this.value;
    this.current = next;
    if (changed) {
      this.badInput = false;
      this.syncForm();
    }
    this.render();
    if (changed) {
      this.dispatchEvent(new CustomEvent<JhiguChangeDetail>('jhiguChange', {
        bubbles: true,
        composed: true,
        detail: { bs: next ? next.toString() : '', ad: next ? adIso(next) : '', value: next },
      }));
    }
  }

  private syncForm(): void {
    this.internals.setFormValue(this.current ? this.current.toString() : null);
    const s = getStrings(this.language);
    if (this.badInput) this.internals.setValidity({ badInput: true }, s.date.parseError, this.app);
    else if (this.hasAttribute('required') && !this.current) this.internals.setValidity({ valueMissing: true }, s.picker.required, this.app);
    else this.internals.setValidity({});
  }

  private render(): void {
    const root = this.shadowRoot!;
    // Remember where focus was so a re-render does not drop it.
    const active = root.activeElement as HTMLElement | null;
    let restore: string | null = null;
    if (active && this.app.contains(active)) {
      if (active.getAttribute('role') === 'gridcell') restore = '[role="gridcell"][tabindex="0"]';
      else if (active.dataset.act) restore = `[data-act="${active.dataset.act}"]`;
      else if (active.classList.contains('trigger')) restore = '.trigger';
    }

    if (this.fatal !== null || !this.picker) {
      this.app.innerHTML = `<div class="panel error" role="alert">${esc(this.fatal ?? 'jhigu-date-picker: no calendar')}</div>`;
      return;
    }
    const state = this.picker.getState();
    const s = getStrings(state.language).picker;
    const calendar = renderCalendarMarkup(state, { getCellProps: c => this.picker!.getCellProps(c) });
    if (this.isPopup) {
      const text = this.current ? esc(formatPreset(this.current, 'dual', state.language)) : `<span class="placeholder">${esc(s.placeholder)}</span>`;
      this.app.innerHTML =
        `<button type="button" class="trigger" part="trigger" aria-haspopup="dialog" aria-expanded="${this.open}"${this.isDisabled ? ' disabled' : ''}>` +
        `<span>${text}</span><span aria-hidden="true">&#128197;</span></button>` +
        (this.open ? `<div class="popover panel" role="dialog" aria-label="${esc(s.placeholder)}">${calendar}</div>` : '');
    } else {
      this.app.innerHTML = `<div class="panel" role="group" aria-label="${esc(s.placeholder)}"${this.isDisabled ? ' aria-disabled="true"' : ''}>${calendar}</div>`;
    }
    if (restore) root.querySelector<HTMLElement>(restore)?.focus();
  }

  private openPopup(): void {
    if (!this.isPopup || this.open || this.isDisabled) return;
    this.open = true;
    document.addEventListener('pointerdown', this.onDocPointer, true);
    this.render();
    this.shadowRoot?.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')?.focus();
    this.dispatchEvent(new CustomEvent('jhiguOpen', { bubbles: true, composed: true }));
  }

  private closePopup(refocus: boolean): void {
    if (!this.open) return;
    this.open = false;
    document.removeEventListener('pointerdown', this.onDocPointer, true);
    this.render();
    if (refocus) this.shadowRoot?.querySelector<HTMLElement>('.trigger')?.focus();
    this.dispatchEvent(new CustomEvent('jhiguClose', { bubbles: true, composed: true }));
  }

  private onClick(e: Event): void {
    const picker = this.picker;
    if (!picker || this.isDisabled) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act], .trigger');
    if (!el || !this.app.contains(el)) return;
    if (el.classList.contains('trigger')) {
      if (this.open) this.closePopup(false); else this.openPopup();
      return;
    }
    const state = picker.getState();
    try {
      switch (el.dataset.act) {
        case 'day':
          if (el.getAttribute('aria-disabled') === 'true') return;
          picker.actions.select(parseBs(el.dataset.date ?? '')!);
          if (this.isPopup) this.closePopup(true);
          break;
        case 'prev': picker.actions.prevMonth(); break;
        case 'next': picker.actions.nextMonth(); break;
        case 'title': picker.actions.setView(state.view === 'days' ? 'months' : state.view === 'months' ? 'years' : 'days'); break;
        case 'month':
          picker.actions.goTo(state.visibleYear, Number(el.dataset.month));
          picker.actions.setView('days');
          break;
        case 'year':
          picker.actions.goTo(Number(el.dataset.year), state.visibleMonth);
          picker.actions.setView('months');
          break;
        case 'today':
          picker.actions.selectToday();
          if (this.isPopup) this.closePopup(true);
          break;
        case 'clear': picker.actions.clear(); break;
      }
    } catch (err) {
      // A disabled date or a month outside the calendar data: ignore the click.
      if (!(err instanceof JhiguError)) throw err;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    const picker = this.picker;
    if (!picker || this.isDisabled) return;
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.closePopup(true);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.classList.contains('trigger')) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.openPopup(); }
      return;
    }
    if (target.getAttribute('role') !== 'gridcell') return;
    const action = keyAction(e.key, e.shiftKey);
    if (!action || action === 'close') return;
    e.preventDefault();
    try {
      if (action === 'select') {
        const state = picker.getState();
        picker.actions.select(state.focused);
        if (this.isPopup) this.closePopup(true);
      } else picker.actions.moveFocus(action);
    } catch (err) {
      if (!(err instanceof JhiguError)) throw err;
    }
  }
}

/** Register the element. Safe to call twice. Returns the class. */
export function defineJhiguDatePicker(tag = 'jhigu-date-picker'): typeof JhiguDatePicker {
  if (typeof customElements === 'undefined') throw new Error('customElements is not available in this environment');
  if (!customElements.get(tag)) customElements.define(tag, JhiguDatePicker);
  return JhiguDatePicker;
}
