/**
 * Pure markup and styles for `<jhigu-date-picker>`. No DOM access: it turns a
 * `DatePickerState` into an HTML string, so it can be tested in Node.
 */
import { getStrings } from '../generated/strings.js';
import type { CellProps, DatePickerState } from '../datePicker.js';
import type { RangePosition } from '../rangePicker.js';
import type { GridCell } from '../monthGrid.js';

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const NE_DIGITS = '०१२३४५६७८९';
const dayLabel = (n: number, ne: boolean) => (ne ? String(n).replace(/\d/g, d => NE_DIGITS[+d]) : String(n));

/** Cell props from a date picker, or from a range picker (with range fields). */
export type AnyCellProps = CellProps & { rangePosition?: RangePosition | null; inPreview?: boolean };

/** Anything with the month view fields; a `DatePickerState` or a range picker state. */
export type CalendarState = Omit<DatePickerState, 'value'>;

export interface MarkupOptions {
  getCellProps: (cell: GridCell) => AnyCellProps;
  /** Show the Today and Clear buttons. */
  showFooter?: boolean;
  /** Show the Clear button (with `showFooter`). Default true. */
  showClear?: boolean;
  /** Event titles by BS date `YYYY-MM-DD`. Marked days get a dot and their titles in the ARIA label. */
  marks?: ReadonlyMap<string, readonly string[]>;
}

/** `class` and `part` values for a day cell, from its props. Shared by render and in-place patching. */
export function dayAttrs(cell: GridCell, p: AnyCellProps): { cls: string; part: string } {
  const pos = p.rangePosition ?? null;
  // Middle days of a range are aria-selected but use the band style, not the solid one.
  const selected = pos ? pos !== 'middle' : p['aria-selected'];
  const focused = p.tabIndex === 0;
  const off = p['aria-disabled'];
  const preview = p.inPreview ?? false;
  const cls = ['day', pos ? `range-${pos}` : '', preview ? 'preview' : '', cell.isToday ? 'today' : '', cell.isWeekend ? 'weekend' : '', selected ? 'selected' : '', off ? 'off' : '']
    .filter(Boolean).join(' ');
  const parts = ['day'];
  if (pos) parts.push(`range-${pos}`, 'in-range');
  if (preview) parts.push('preview');
  if (cell.isToday) parts.push('today');
  if (cell.isWeekend) parts.push('weekend');
  if (selected) parts.push('selected');
  if (focused) parts.push('focused');
  if (off) parts.push('disabled');
  return { cls, part: parts.join(' ') };
}

function daysView(state: CalendarState, o: MarkupOptions): string {
  const ne = state.language === 'ne';
  const head = state.weekdays.map(w => `<div role="columnheader" class="wd" part="weekday">${esc(w)}</div>`).join('');
  const rows = state.grid
    .map(row => {
      const cells = row
        .map(cell => {
          if (!cell.bs || !cell.inMonth) return '<div role="gridcell" class="blank" aria-hidden="true"></div>';
          const p = o.getCellProps(cell);
          const selected = p['aria-selected'];
          const { cls, part } = dayAttrs(cell, p);
          const titles = o.marks?.get(cell.bs.toString());
          const marked = !!titles && titles.length > 0;
          const label = marked ? `${p['aria-label']}. ${titles!.join(', ')}` : p['aria-label'];
          // The AD number and the dot are in the cell's label already (the AD date, and the titles), so they are
          // hidden from the accessible name: a cell's visible text is then just its BS day, which the label
          // contains (WCAG 2.5.3, label in name; voice control says "click 3").
          const dot = marked ? '<span class="dot" part="mark" aria-hidden="true"></span>' : '';
          const ad = state.showAd && cell.ad ? `<span class="ad" part="ad" aria-hidden="true">${cell.ad.getDate()}</span>` : '';
          return `<div role="gridcell" class="${cls}${marked ? ' marked' : ''}" part="${part}${marked ? ' marked' : ''}" tabindex="${p.tabIndex}" ` +
            `aria-selected="${selected}" aria-disabled="${p['aria-disabled']}" aria-label="${esc(label)}" ` +
            `data-act="day" data-date="${cell.bs.toString()}"><span class="bs">${dayLabel(cell.bs.day, ne)}</span>${ad}${dot}</div>`;
        })
        .join('');
      return `<div role="row" class="row">${cells}</div>`;
    })
    .join('');
  return `<div role="grid" class="grid" part="grid" aria-label="${esc(state.title)}">` +
    `<div role="row" class="row wdrow">${head}</div>${rows}</div>`;
}

function monthsView(state: CalendarState): string {
  const items = state.months
    .map(m => {
      const current = m.month === state.visibleMonth;
      return `<button type="button" class="cell${current ? ' current' : ''}" part="month${current ? ' selected' : ''}" data-act="month" data-month="${m.month}"${m.disabled ? ' disabled' : ''}>${esc(m.label)}</button>`;
    })
    .join('');
  return `<div class="picks" part="months">${items}</div>`;
}

function yearsView(state: CalendarState): string {
  const items = state.years
    .map(y => {
      const current = y.year === state.visibleYear;
      return `<button type="button" class="cell${current ? ' current' : ''}" part="year${current ? ' selected' : ''}" data-act="year" data-year="${y.year}"${y.disabled ? ' disabled' : ''}>${esc(y.label)}</button>`;
    })
    .join('');
  return `<div class="picks" part="years">${items}</div>`;
}

/** The inside of the popover or inline calendar. */
export function renderCalendarMarkup(state: CalendarState, o: MarkupOptions): string {
  const s = getStrings(state.language).picker;
  const titleLabel = state.view === 'days' ? s.selectMonth : state.view === 'months' ? s.selectYear : s.selectMonth;
  const body = state.view === 'days' ? daysView(state, o) : state.view === 'months' ? monthsView(state) : yearsView(state);
  const paging = state.view === 'days';
  const nav = (act: string, label: string, glyph: string, disabled: boolean) =>
    `<button type="button" class="nav" part="nav ${act}" data-act="${act}" aria-label="${esc(label)}"${disabled ? ' disabled' : ''}>${glyph}</button>`;
  const footer = o.showFooter === false
    ? ''
    : `<div class="footer" part="footer"><button type="button" class="link" part="today-button" data-act="today">${esc(s.today)}</button>` +
      (o.showClear === false ? '' : `<button type="button" class="link" part="clear-button" data-act="clear">${esc(s.clear)}</button>`) + `</div>`;
  return `<div class="header" part="header">` +
    (paging ? nav('prev', s.previousMonth, '&#8249;', !state.canGoPrev) : '<span class="nav-gap"></span>') +
    // The visible title is part of the name (label in name), with what the button does after it.
    `<button type="button" class="title" part="title" data-act="title" aria-label="${esc(`${state.title}, ${titleLabel}`)}" aria-live="polite">${esc(state.title)}</button>` +
    (paging ? nav('next', s.nextMonth, '&#8250;', !state.canGoNext) : '<span class="nav-gap"></span>') +
    `</div>${body}${footer}`;
}

export const PICKER_CSS = `
:host {
  --jhigu-color-primary: #1d4ed8;
  --jhigu-color-on-primary: #ffffff;
  --jhigu-color-surface: #ffffff;
  --jhigu-color-text: #1a1a1a;
  --jhigu-color-muted: #6b7280;
  --jhigu-color-holiday: #c62828;
  --jhigu-color-today: #0f766e;
  --jhigu-radius: 8px;
  --jhigu-font-family: system-ui, -apple-system, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
  --jhigu-font-size: 14px;
  display: inline-block;
  position: relative;
  font-family: var(--jhigu-font-family);
  font-size: var(--jhigu-font-size);
  color: var(--jhigu-color-text);
}
:host([hidden]) { display: none; }
:host([theme="dark"]) {
  --jhigu-color-primary: #60a5fa;
  --jhigu-color-on-primary: #0b1220;
  --jhigu-color-surface: #1f2937;
  --jhigu-color-text: #f3f4f6;
  --jhigu-color-muted: #9ca3af;
  --jhigu-color-holiday: #f87171;
  --jhigu-color-today: #2dd4bf;
}
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"]):not([theme="dark"])) {
    --jhigu-color-primary: #60a5fa;
    --jhigu-color-on-primary: #0b1220;
    --jhigu-color-surface: #1f2937;
    --jhigu-color-text: #f3f4f6;
    --jhigu-color-muted: #9ca3af;
    --jhigu-color-holiday: #f87171;
    --jhigu-color-today: #2dd4bf;
  }
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.4; }
.trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 14em; padding: 8px 10px; border: 1px solid var(--jhigu-color-muted); border-radius: var(--jhigu-radius); background: var(--jhigu-color-surface); }
.trigger .placeholder { color: var(--jhigu-color-muted); }
:host([disabled]) .trigger { opacity: 0.5; cursor: not-allowed; }
.panel { width: 18.5em; padding: 10px; border: 1px solid rgba(128,128,128,.35); border-radius: var(--jhigu-radius); background: var(--jhigu-color-surface); box-shadow: 0 6px 24px rgba(0,0,0,.18); }
.popover { position: absolute; z-index: 10; top: calc(100% + 4px); left: 0; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 6px; }
.title { flex: 1; font-weight: 600; padding: 6px; border-radius: var(--jhigu-radius); }
.nav { width: 2em; height: 2em; border-radius: 50%; font-size: 1.2em; line-height: 1; }
.nav-gap { width: 2em; }
.nav:hover:not(:disabled), .title:hover, .link:hover, .cell:hover:not(:disabled) { background: rgba(128,128,128,.18); }
.row { display: grid; grid-template-columns: repeat(7, 1fr); }
.wd { text-align: center; color: var(--jhigu-color-muted); font-size: 0.85em; padding: 4px 0; }
.day, .blank { min-height: 2.6em; }
.day { display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: var(--jhigu-radius); cursor: pointer; user-select: none; }
.day .ad { font-size: 0.65em; color: var(--jhigu-color-muted); line-height: 1; }
.day.weekend .bs { color: var(--jhigu-color-holiday); }
.day.today { outline: 2px solid var(--jhigu-color-today); outline-offset: -2px; }
.day.off { opacity: 0.35; cursor: not-allowed; }
.day:hover:not(.off):not(.selected) { background: rgba(128,128,128,.18); }
.day { position: relative; }
.day .dot { position: absolute; top: 4px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--jhigu-color-holiday); }
.day.selected .dot { background: var(--jhigu-color-on-primary); }
.day.selected { background: var(--jhigu-color-primary); }
.day.range-middle { background: color-mix(in srgb, var(--jhigu-color-primary) 22%, transparent); border-radius: 0; }
.day.range-start { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.day.range-end { border-top-left-radius: 0; border-bottom-left-radius: 0; }
.day.preview { background: color-mix(in srgb, var(--jhigu-color-primary) 12%, transparent); border-radius: 0; }
.day.selected .bs, .day.selected .ad { color: var(--jhigu-color-on-primary); }
/* The small AD number on the range band: the muted grey is under 4.5:1 on the tinted band. */
.day.range-middle .ad, .day.preview .ad { color: var(--jhigu-color-text); opacity: 0.8; }
.day:focus-visible, button:focus-visible { outline: 2px solid var(--jhigu-color-primary); outline-offset: 1px; }
.picks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.cell { padding: 10px 4px; border-radius: var(--jhigu-radius); }
.cell.current { background: var(--jhigu-color-primary); color: var(--jhigu-color-on-primary); }
.footer { display: flex; justify-content: space-between; margin-top: 6px; }
.link { padding: 4px 8px; border-radius: var(--jhigu-radius); color: var(--jhigu-color-primary); }
.error { color: var(--jhigu-color-holiday); }
@media (prefers-reduced-motion: no-preference) {
  .nav, .title, .link, .cell, .day { transition: background-color .12s ease; }
}
`;
