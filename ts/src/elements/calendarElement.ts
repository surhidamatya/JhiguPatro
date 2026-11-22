/**
 * `<jhigu-calendar>`: a BS month calendar with marked days and an events list
 * (guide 15.2) on the headless `createDatePicker`. Plain custom element, shadow
 * DOM, no dependencies; same look, theming variables and keyboard map as
 * `<jhigu-date-picker>`. It is a display and navigation widget, not a form field.
 *
 *   defineJhiguCalendar();
 *   <jhigu-calendar language="ne" year="2082" month="5"
 *     marked='{"2082-05-10": ["Teej"], "2082-05-15": "Fulpati"}'></jhigu-calendar>
 *
 * Attributes: `year` and `month` (the month to show first), `language`,
 * `week-starts-on`, `show-ad` (default on; `"false"` turns it off), `marked`,
 * `theme`, `today` (for tests). `marked` is JSON: an object from BS date
 * (`YYYY-MM-DD`) to a title or a list of titles, or a plain array of dates.
 * Property `events` takes the same object form (`Record<string, string |
 * string[]>`) and replaces `marked`.
 *
 * Marked days show a dot, and their titles are added to the day's ARIA label and
 * listed under the grid when the day is selected. Click or press Enter on a day
 * to select it.
 *
 * Events (bubbling, composed): `jhiguSelect` with `detail: { bs, ad, events }`;
 * `jhiguMonthChange` with `detail: { year, month }`. Parts: as the date picker,
 * plus `mark` (the dot), `events` and `event`.
 */
import { createDatePicker, keyAction } from '../datePicker.js';
import { formatPreset } from '../dateFormat.js';
import type { DatePicker, DatePickerState } from '../datePicker.js';
import { JhiguError } from '../errors.js';
import { getStrings } from '../generated/strings.js';
import type { Language } from '../generated/strings.js';
import { NepaliDate } from '../nepaliDate.js';
import { adIso } from './datePickerElement.js';
import { esc, PICKER_CSS, renderCalendarMarkup } from './pickerMarkup.js';

export interface JhiguSelectDetail {
  bs: string;
  ad: string;
  events: string[];
}

export interface JhiguMonthChangeDetail {
  year: number;
  month: number;
}

const BS_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;

const CALENDAR_CSS = `${PICKER_CSS}
.events { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(128,128,128,.3); }
.events h3 { margin: 0 0 4px; font-size: 0.9em; font-weight: 600; }
.events ul { margin: 0; padding-left: 1.2em; }
.events .none { color: var(--jhigu-color-muted); }
`;

/** Accept an object of date to title(s), or an array of dates. Unreadable keys are ignored. */
export function parseMarks(input: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (date: string, titles: string[]) => {
    if (!BS_TEXT.test(date) || titles.length === 0) return;
    out.set(date, [...(out.get(date) ?? []), ...titles]);
  };
  if (Array.isArray(input)) {
    for (const d of input) if (typeof d === 'string') add(d, [d]);
  } else if (input && typeof input === 'object') {
    for (const [date, v] of Object.entries(input as Record<string, unknown>)) {
      const titles = (Array.isArray(v) ? v : [v]).filter((t): t is string => typeof t === 'string' && t.trim() !== '');
      add(date, titles);
    }
  } else if (input !== null && input !== undefined) {
    throw new JhiguError('INVALID_DATA', 'marked must be an object or an array', input);
  }
  return out;
}

const Base = ((globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ?? class {}) as typeof HTMLElement;

export class JhiguCalendar extends Base {
  static observedAttributes = ['year', 'month', 'language', 'week-starts-on', 'show-ad', 'marked', 'theme', 'today'];

  private picker: DatePicker | null = null;
  private unsubscribe: (() => void) | null = null;
  private marks = new Map<string, string[]>();
  private fromProperty = false;
  private markedError = false;
  private fatal: string | null = null;
  private lastMonth = '';
  private lastSelected = '';
  private connectedOnce = false;
  private app!: HTMLDivElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CALENDAR_CSS;
    this.app = document.createElement('div');
    this.app.setAttribute('part', 'root');
    root.append(style, this.app);
    this.app.addEventListener('click', e => this.onClick(e));
    this.app.addEventListener('keydown', e => this.onKeyDown(e as KeyboardEvent));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Titles by BS date. Setting it replaces the `marked` attribute's marks. */
  get events(): Record<string, string[]> {
    return Object.fromEntries(this.marks);
  }

  set events(value: Record<string, string | string[]>) {
    this.marks = parseMarks(value);
    this.fromProperty = true;
    this.markedError = false;
    this.render();
  }

  /** The selected day as BS text, `''` when none. */
  get selected(): string {
    return this.picker?.getState().value?.toString() ?? '';
  }

  /** Show a month. Throws JhiguError outside the calendar data. */
  goTo(year: number, month: number): void {
    this.requirePicker().actions.goTo(year, month);
  }

  /** Select a day (also moves to its month). Throws JhiguError for an invalid date. */
  select(bs: string): void {
    const m = BS_TEXT.exec(bs);
    if (!m) throw new JhiguError('INVALID_DATE', 'expected YYYY-MM-DD', bs);
    this.requirePicker().actions.select(new NepaliDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connectedCallback(): void {
    this.connectedOnce = true;
    this.readMarked();
    this.rebuild();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.connectedOnce) return;
    if (name === 'marked') { this.fromProperty = false; this.readMarked(); this.render(); return; }
    if (name === 'year' || name === 'month') {
      try { this.picker?.actions.goTo(this.yearAttr, this.monthAttr); } catch { /* ignore an invalid month */ }
      return;
    }
    const s = this.picker?.getState();
    this.rebuild(s?.value ?? null, s ? { year: s.visibleYear, month: s.visibleMonth } : null);
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private get language(): Language { return this.getAttribute('language') === 'ne' ? 'ne' : 'en'; }

  private get yearAttr(): number { return Number(this.getAttribute('year')); }
  private get monthAttr(): number { return Number(this.getAttribute('month')); }

  private requirePicker(): DatePicker {
    if (!this.picker) throw new Error('jhigu-calendar is not ready');
    return this.picker;
  }

  private readMarked(): void {
    if (this.fromProperty) return;
    const raw = this.getAttribute('marked');
    this.markedError = false;
    try {
      this.marks = raw === null || raw.trim() === '' ? new Map() : parseMarks(JSON.parse(raw));
    } catch {
      this.marks = new Map();
      this.markedError = true;
    }
  }

  private rebuild(value: NepaliDate | null = null, keepMonth: { year: number; month: number } | null = null): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.fatal = null;
    try {
      const todayAttr = this.getAttribute('today');
      const tm = todayAttr ? BS_TEXT.exec(todayAttr) : null;
      this.picker = createDatePicker({
        value,
        language: this.language,
        weekStartsOn: this.hasAttribute('week-starts-on') ? Number(this.getAttribute('week-starts-on')) : 0,
        showAd: this.getAttribute('show-ad') !== 'false',
        today: tm ? { year: Number(tm[1]), month: Number(tm[2]), day: Number(tm[3]) } : undefined,
      });
      if (keepMonth) {
        try { this.picker.actions.goTo(keepMonth.year, keepMonth.month); } catch { /* stay where the picker is */ }
      } else if (this.hasAttribute('year') && this.hasAttribute('month') && !value) {
        try { this.picker.actions.goTo(this.yearAttr, this.monthAttr); } catch { /* invalid month: stay on today */ }
      }
      this.unsubscribe = this.picker.subscribe(s => this.onState(s));
      const s = this.picker.getState();
      this.lastMonth = `${s.visibleYear}-${s.visibleMonth}`;
      this.lastSelected = s.value?.toString() ?? '';
    } catch (e) {
      this.picker = null;
      this.fatal = e instanceof Error ? e.message : String(e);
    }
    this.render();
  }

  private onState(state: DatePickerState): void {
    this.render();
    const month = `${state.visibleYear}-${state.visibleMonth}`;
    if (month !== this.lastMonth) {
      this.lastMonth = month;
      this.dispatchEvent(new CustomEvent<JhiguMonthChangeDetail>('jhiguMonthChange', {
        bubbles: true, composed: true, detail: { year: state.visibleYear, month: state.visibleMonth },
      }));
    }
    const sel = state.value?.toString() ?? '';
    if (sel !== this.lastSelected) {
      this.lastSelected = sel;
      if (state.value) {
        this.dispatchEvent(new CustomEvent<JhiguSelectDetail>('jhiguSelect', {
          bubbles: true, composed: true,
          detail: { bs: sel, ad: adIso(state.value), events: [...(this.marks.get(sel) ?? [])] },
        }));
      }
    }
  }

  private render(): void {
    const root = this.shadowRoot!;
    const active = root.activeElement as HTMLElement | null;
    let restore: string | null = null;
    if (active && this.app.contains(active)) {
      if (active.getAttribute('role') === 'gridcell') restore = '[role="gridcell"][tabindex="0"]';
      else if (active.dataset.act) restore = `[data-act="${active.dataset.act}"]`;
    }
    if (this.fatal !== null || !this.picker) {
      this.app.innerHTML = `<div class="panel error" role="alert">${esc(this.fatal ?? 'jhigu-calendar: no calendar')}</div>`;
      return;
    }
    const picker = this.picker;
    const state = picker.getState();
    const t = getStrings(state.language);
    const calendar = renderCalendarMarkup(state, { getCellProps: c => picker.getCellProps(c), marks: this.marks, showClear: false });
    const sel = state.value?.toString() ?? '';
    const titles = sel ? this.marks.get(sel) ?? [] : [];
    const list = !sel
      ? ''
      : `<div class="events" part="events" aria-live="polite"><h3>${esc(formatPreset(state.value!, 'dual', state.language))}</h3>` +
        (titles.length
          ? `<ul>${titles.map(x => `<li part="event">${esc(x)}</li>`).join('')}</ul>`
          : `<div class="none">${esc(t.picker.noEvents)}</div>`) + '</div>';
    // A developer error, so the text is English only.
    const problem = this.markedError ? '<div class="error" role="alert">jhigu-calendar: the marked attribute is not valid JSON</div>' : '';
    this.app.innerHTML = `<div class="panel" role="group" aria-label="${esc(state.title)}">${calendar}${list}${problem}</div>`;
    if (restore) root.querySelector<HTMLElement>(restore)?.focus();
  }

  private onClick(e: Event): void {
    const picker = this.picker;
    if (!picker) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || !this.app.contains(el)) return;
    const state = picker.getState();
    try {
      switch (el.dataset.act) {
        case 'day':
          if (el.getAttribute('aria-disabled') === 'true') return;
          picker.actions.select(new NepaliDate(...(el.dataset.date!.split('-').map(Number) as [number, number, number])));
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
      }
    } catch (err) {
      if (!(err instanceof JhiguError)) throw err;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    const picker = this.picker;
    if (!picker) return;
    if ((e.target as HTMLElement).getAttribute('role') !== 'gridcell') return;
    const action = keyAction(e.key, e.shiftKey);
    if (!action || action === 'close') return;
    e.preventDefault();
    try {
      if (action === 'select') picker.actions.select(picker.getState().focused);
      else picker.actions.moveFocus(action);
    } catch (err) {
      if (!(err instanceof JhiguError)) throw err;
    }
  }
}

/** Register `<jhigu-calendar>`. Safe to call twice. */
export function defineJhiguCalendar(tag = 'jhigu-calendar'): typeof JhiguCalendar {
  if (typeof customElements === 'undefined') throw new Error('customElements is not available in this environment');
  if (!customElements.get(tag)) customElements.define(tag, JhiguCalendar);
  return JhiguCalendar;
}
