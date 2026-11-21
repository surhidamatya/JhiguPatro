/**
 * `<jhigu-date-range-picker>`: a BS date range picker web component (guide 15.2)
 * on the headless `createRangePicker`. Plain custom element, shadow DOM, no
 * dependencies. Same look, theming variables, keyboard map and popup behaviour as
 * `<jhigu-date-picker>`.
 *
 *   defineJhiguDateRangePicker();
 *   <jhigu-date-range-picker name="stay" language="ne" popup required></jhigu-date-range-picker>
 *
 * Choosing: the first click sets the start, the second (on or after it) sets the
 * end; a second click before the start restarts the range; a click on a complete
 * range starts a new one. While choosing the end, days up to the hovered (or
 * keyboard-focused) day are previewed.
 *
 * Attributes: `start`, `end` (BS `YYYY-MM-DD`), `min`, `max`, `language`,
 * `week-starts-on`, `show-ad` (default on; `"false"` turns it off), `name`,
 * `disabled`, `required`, `popup`, `theme`, `today` (for tests). Properties:
 * `start`, `end` (BS text, `''` when empty) and `complete`.
 *
 * Form data (when `name` is set and the range is complete): `name_start` and
 * `name_end`, both BS `YYYY-MM-DD`. `required` is satisfied only by a complete
 * range; an unreadable or invalid `start`/`end` gives `badInput`.
 *
 * Events (bubbling, composed): `jhiguChange` whenever start or end changes, with
 * `detail: { start, end, startAd, endAd, complete, days }` (`days` is the
 * inclusive number of days, 0 until complete; dates are `''` when empty), and in
 * popup mode `jhiguOpen` and `jhiguClose`. Parts: as the date picker, plus
 * `range-start`, `range-middle`, `range-end`, `range-single`, `in-range`, `preview`.
 */
import { keyAction } from '../datePicker.js';
import { formatPreset } from '../dateFormat.js';
import { JhiguError } from '../errors.js';
import { getStrings } from '../generated/strings.js';
import type { Language } from '../generated/strings.js';
import { NepaliDate } from '../nepaliDate.js';
import { createRangePicker } from '../rangePicker.js';
import type { RangePicker, RangePickerState } from '../rangePicker.js';
import { adIso } from './datePickerElement.js';
import { dayAttrs, esc, PICKER_CSS, renderCalendarMarkup } from './pickerMarkup.js';

export interface JhiguRangeChangeDetail {
  start: string;
  end: string;
  startAd: string;
  endAd: string;
  complete: boolean;
  /** Inclusive day count, 0 until the range is complete. */
  days: number;
}

const BS_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseBs(text: string | null): NepaliDate | null {
  if (text === null || text.trim() === '') return null;
  const m = BS_TEXT.exec(text.trim());
  if (!m) throw new JhiguError('INVALID_DATE', 'expected YYYY-MM-DD', text);
  return new NepaliDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

const Base = ((globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ?? class {}) as typeof HTMLElement;

export class JhiguDateRangePicker extends Base {
  static formAssociated = true;
  static observedAttributes = [
    'start', 'end', 'min', 'max', 'language', 'week-starts-on', 'show-ad', 'name', 'disabled', 'required', 'popup', 'theme', 'today',
  ];

  private readonly internals: ElementInternals;
  private picker: RangePicker | null = null;
  private unsubscribe: (() => void) | null = null;
  private start_: NepaliDate | null = null;
  private end_: NepaliDate | null = null;
  private badInput = false;
  private fatal: string | null = null;
  private open = false;
  private lastKey = '';
  private renderedKey = '';
  private connectedOnce = false;
  private app!: HTMLDivElement;
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
    this.app.addEventListener('mouseover', e => this.onHover(e));
    this.app.addEventListener('mouseleave', () => this.picker?.actions.hover(null));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** BS start date text, `''` when empty. */
  get start(): string { return this.start_ ? this.start_.toString() : ''; }
  /** BS end date text, `''` when empty. */
  get end(): string { return this.end_ ? this.end_.toString() : ''; }
  /** True when both ends are set. */
  get complete(): boolean { return this.start_ !== null && this.end_ !== null; }

  /** Set the range. Throws JhiguError for an unreadable, disabled or reversed range. */
  setRange(start: string, end: string): void {
    const a = parseBs(start);
    const b = parseBs(end);
    if (!a || !b) throw new JhiguError('INVALID_DATE', 'start and end are required', { start, end });
    this.requirePicker().actions.setRange(a, b);
  }

  clear(): void { this.picker?.actions.clear(); }

  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }

  show(): void { this.openPopup(); }
  hide(): void { this.closePopup(true); }

  focus(options?: FocusOptions): void {
    const target = this.shadowRoot?.querySelector<HTMLElement>('[tabindex="0"], .trigger');
    if (target) target.focus(options); else super.focus(options);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connectedCallback(): void {
    if (!this.connectedOnce) {
      this.connectedOnce = true;
      this.readEnds(this.getAttribute('start'), this.getAttribute('end'));
    }
    this.rebuild();
  }

  disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this.onDocPointer, true);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.connectedOnce) return;
    if (name === 'start' || name === 'end') this.readEnds(this.getAttribute('start'), this.getAttribute('end'));
    if (name === 'popup' && newValue === null) this.open = false;
    this.rebuild();
  }

  formResetCallback(): void {
    this.readEnds(this.getAttribute('start'), this.getAttribute('end'));
    this.rebuild();
  }

  formDisabledCallback(disabled: boolean): void { this.toggleAttribute('disabled', disabled); }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (state instanceof FormData) {
      const n = this.getAttribute('name') ?? '';
      const a = state.get(`${n}_start`);
      const b = state.get(`${n}_end`);
      if (typeof a === 'string' && typeof b === 'string') {
        this.readEnds(a, b);
        this.rebuild();
      }
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private get language(): Language { return this.getAttribute('language') === 'ne' ? 'ne' : 'en'; }
  private get isPopup(): boolean { return this.hasAttribute('popup'); }
  private get isDisabled(): boolean { return this.hasAttribute('disabled'); }

  private requirePicker(): RangePicker {
    if (!this.picker) throw new Error('jhigu-date-range-picker is not ready');
    return this.picker;
  }

  private readEnds(a: string | null, b: string | null): void {
    try {
      this.start_ = parseBs(a);
      this.end_ = parseBs(b);
      // An end needs a start, and must not be before it.
      if ((this.end_ && !this.start_) || (this.start_ && this.end_ && this.end_.isBefore(this.start_))) throw new JhiguError('INVALID_DATE', 'bad range', { a, b });
      this.badInput = false;
    } catch {
      this.start_ = null;
      this.end_ = null;
      this.badInput = true;
    }
  }

  private optionalDate(attr: string): NepaliDate | null {
    const raw = this.getAttribute(attr);
    return raw === null || raw.trim() === '' ? null : parseBs(raw);
  }

  private rebuild(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.fatal = null;
    try {
      const weekStartsOn = this.hasAttribute('week-starts-on') ? Number(this.getAttribute('week-starts-on')) : 0;
      const today = this.optionalDate('today');
      const create = (start: NepaliDate | null, end: NepaliDate | null) => createRangePicker({
        start, end,
        min: this.optionalDate('min'),
        max: this.optionalDate('max'),
        language: this.language,
        weekStartsOn,
        showAd: this.getAttribute('show-ad') !== 'false',
        today: today ?? undefined,
      });
      try {
        this.picker = create(this.start_, this.end_);
      } catch (e) {
        if (this.start_ && e instanceof JhiguError && e.code === 'OUT_OF_RANGE') {
          this.start_ = null;
          this.end_ = null;
          this.badInput = true;
          this.picker = create(null, null);
        } else throw e;
      }
      this.unsubscribe = this.picker.subscribe(s => this.onState(s));
      this.lastKey = `${this.start}|${this.end}`;
    } catch (e) {
      this.picker = null;
      this.fatal = e instanceof Error ? e.message : String(e);
    }
    this.syncForm();
    this.render();
  }

  private onState(state: RangePickerState): void {
    this.start_ = state.start;
    this.end_ = state.end;
    const key = `${this.start}|${this.end}`;
    const changed = key !== this.lastKey;
    if (changed) { this.badInput = false; this.syncForm(); }
    // A hover only changes the preview: patch the cells in place. Replacing them would
    // swallow a click that starts on the cell under the pointer.
    if (!changed && this.renderedKey === this.structureKey(state) && this.patchCells(state)) return;
    this.render();
    if (!changed) return;
    this.lastKey = key;
    const complete = this.complete;
    this.dispatchEvent(new CustomEvent<JhiguRangeChangeDetail>('jhiguChange', {
      bubbles: true,
      composed: true,
      detail: {
        start: this.start,
        end: this.end,
        startAd: this.start_ ? adIso(this.start_) : '',
        endAd: this.end_ ? adIso(this.end_) : '',
        complete,
        days: complete ? this.end_!.dayNumber() - this.start_!.dayNumber() + 1 : 0,
      },
    }));
    // Choosing the end finishes the job in popup mode.
    if (complete && this.isPopup && this.open) this.closePopup(true);
  }

  private syncForm(): void {
    const name = this.getAttribute('name');
    if (name && this.complete) {
      const fd = new FormData();
      fd.append(`${name}_start`, this.start);
      fd.append(`${name}_end`, this.end);
      this.internals.setFormValue(fd);
    } else this.internals.setFormValue(null);
    const s = getStrings(this.language);
    if (this.badInput) this.internals.setValidity({ badInput: true }, s.date.parseError, this.app);
    else if (this.hasAttribute('required') && !this.complete) this.internals.setValidity({ valueMissing: true }, s.picker.required, this.app);
    else this.internals.setValidity({});
  }

  /** Everything that needs a full render; hover and preview changes are not part of it. */
  private structureKey(s: RangePickerState): string {
    return `${s.start?.toString() ?? ''}|${s.end?.toString() ?? ''}|${s.view}|${s.visibleYear}-${s.visibleMonth}|${s.focused.toString()}|${s.language}|${s.phase}|${this.open}`;
  }

  /** Update day cell classes, parts and ARIA flags without replacing any element. */
  private patchCells(state: RangePickerState): boolean {
    const picker = this.picker;
    if (!picker || state.view !== 'days') return false;
    const byDate = new Map(state.grid.flat().filter(c => c.bs && c.inMonth).map(c => [c.bs!.toString(), c]));
    const els = this.app.querySelectorAll<HTMLElement>('[data-act="day"]');
    if (els.length !== byDate.size) return false;
    for (const el of Array.from(els)) {
      const cell = byDate.get(el.dataset.date ?? '');
      if (!cell) return false;
      const p = picker.getCellProps(cell);
      const { cls, part } = dayAttrs(cell, p);
      el.className = cls;
      el.setAttribute('part', part);
      el.setAttribute('aria-selected', String(p['aria-selected']));
      el.setAttribute('aria-disabled', String(p['aria-disabled']));
    }
    return true;
  }

  private render(): void {
    const root = this.shadowRoot!;
    const active = root.activeElement as HTMLElement | null;
    let restore: string | null = null;
    if (active && this.app.contains(active)) {
      if (active.getAttribute('role') === 'gridcell') restore = '[role="gridcell"][tabindex="0"]';
      else if (active.dataset.act) restore = `[data-act="${active.dataset.act}"]`;
      else if (active.classList.contains('trigger')) restore = '.trigger';
    }
    if (this.fatal !== null || !this.picker) {
      this.app.innerHTML = `<div class="panel error" role="alert">${esc(this.fatal ?? 'jhigu-date-range-picker: no calendar')}</div>`;
      return;
    }
    const picker = this.picker;
    const state = picker.getState();
    this.renderedKey = this.structureKey(state);
    const s = getStrings(state.language).picker;
    const calendar = renderCalendarMarkup(state, { getCellProps: c => picker.getCellProps(c) });
    if (this.isPopup) {
      const text = this.start_
        ? esc(`${formatPreset(this.start_, 'dual', state.language)}${this.end_ ? ` – ${formatPreset(this.end_, 'dual', state.language)}` : ' – …'}`)
        : `<span class="placeholder">${esc(s.placeholder)}</span>`;
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
    this.picker?.actions.hover(null);
    this.render();
    if (refocus) this.shadowRoot?.querySelector<HTMLElement>('.trigger')?.focus();
    this.dispatchEvent(new CustomEvent('jhiguClose', { bubbles: true, composed: true }));
  }

  private onHover(e: Event): void {
    const picker = this.picker;
    if (!picker || this.isDisabled) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act="day"]');
    if (!el || el.getAttribute('aria-disabled') === 'true') return;
    try { picker.actions.hover(parseBs(el.dataset.date ?? '')); } catch (err) { if (!(err instanceof JhiguError)) throw err; }
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
        case 'today': picker.actions.selectToday(); break;
        case 'clear': picker.actions.clear(); break;
      }
    } catch (err) {
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
      if (action === 'select') picker.actions.selectFocused();
      else picker.actions.moveFocus(action);
    } catch (err) {
      if (!(err instanceof JhiguError)) throw err;
    }
  }
}

/** Register `<jhigu-date-range-picker>`. Safe to call twice. */
export function defineJhiguDateRangePicker(tag = 'jhigu-date-range-picker'): typeof JhiguDateRangePicker {
  if (typeof customElements === 'undefined') throw new Error('customElements is not available in this environment');
  if (!customElements.get(tag)) customElements.define(tag, JhiguDateRangePicker);
  return JhiguDateRangePicker;
}
