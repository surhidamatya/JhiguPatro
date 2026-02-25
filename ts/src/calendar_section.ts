/**
 * CalendarSection — vanilla DOM calendar renderer.
 *
 * Zero framework dependencies.  Mounts into any container element.
 * All business logic lives in CalendarController.
 */

import {
  toNepaliDigits,
  NEPALI_MONTHS_NE,
  NEPALI_MONTHS_EN,
  ENGLISH_MONTHS,
} from './nepaliCalendar.js';
import type { CalendarController } from './calendar_controller.js';
import type { CalendarDay } from './calendar_models.js';
import { WDAY_NE, WDAY_EN } from './consts.js';
import { STYLES } from './calendar_styles.js';
import { el } from './utils.js';

let _stylesInjected = false;
function injectStyles(): void {
  if (_stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}

// ── CalendarSection ───────────────────────────────────────────────────────────

export class CalendarSection {
  private readonly _calRoot: HTMLElement;
  private readonly _detailRoot: HTMLElement;
  private readonly _listRoot: HTMLElement;
  private _unsubscribe: (() => void) | null = null;

  /**
   * @param calContainer  The element that receives the calendar grid (60% column).
   * @param listContainer The element that receives the day list (35% column).
   * @param ctrl          The shared CalendarController.
   */
  constructor(
    private readonly calContainer: HTMLElement,
    private readonly listContainer: HTMLElement,
    private readonly ctrl: CalendarController,
  ) {
    injectStyles();

    this._calRoot = document.createElement('div');
    this._calRoot.className = 'jp-calendar';
    this.calContainer.appendChild(this._calRoot);

    // Detail bar sits outside the card so the gap shows the page background
    this._detailRoot = document.createElement('div');
    this.calContainer.appendChild(this._detailRoot);

    this._listRoot = document.createElement('div');
    this._listRoot.className = 'jp-list';
    this.listContainer.appendChild(this._listRoot);

    this._render();
    this._unsubscribe = ctrl.subscribe(() => this._render());
  }

  /** Remove all panels from the DOM and clean up. */
  destroy(): void {
    this._unsubscribe?.();
    this._calRoot.remove();
    this._detailRoot.remove();
    this._listRoot.remove();
  }

  // ── Full render ────────────────────────────────────────────────────────────

  private _render(): void {
    this._calRoot.innerHTML = '';
    this._calRoot.appendChild(this._buildHeader());
    this._calRoot.appendChild(this._buildWeekdayRow());
    this._calRoot.appendChild(this._buildGrid());

    this._detailRoot.innerHTML = '';
    this._detailRoot.appendChild(this._buildDetailBar());

    this._listRoot.innerHTML = '';
    this._listRoot.appendChild(this._buildListHeader());
    this._listRoot.appendChild(this._buildDayList());
  }

  // ── Calendar: Header ───────────────────────────────────────────────────────

  private _buildHeader(): HTMLElement {
    const header = el('div', 'jp-header');

    const navRow = el('div', 'jp-nav-row');

    const prevBtn = el('button', 'jp-nav-btn') as HTMLButtonElement;
    prevBtn.innerHTML = '&#8249;';
    prevBtn.setAttribute('aria-label', 'previous month');
    prevBtn.addEventListener('click', () => this.ctrl.prevMonth());

    const dropdowns = el('div', 'jp-dropdowns');
    dropdowns.appendChild(this._buildYearSelect());
    dropdowns.appendChild(this._buildMonthSelect());

    const nextBtn = el('button', 'jp-nav-btn') as HTMLButtonElement;
    nextBtn.innerHTML = '&#8250;';
    nextBtn.setAttribute('aria-label', 'next month');
    nextBtn.addEventListener('click', () => this.ctrl.nextMonth());

    const aajBtn = el('button', 'jp-aaj-btn') as HTMLButtonElement;
    aajBtn.textContent = 'आज';
    aajBtn.setAttribute('aria-label', 'go to today');
    aajBtn.addEventListener('click', () => this.ctrl.goToToday());

    navRow.appendChild(prevBtn);
    navRow.appendChild(dropdowns);
    navRow.appendChild(nextBtn);
    navRow.appendChild(aajBtn);
    header.appendChild(navRow);

    const bsLabel = el('div', 'jp-bs-label');
    bsLabel.textContent = this.ctrl.bsLabel;
    header.appendChild(bsLabel);

    const adLabel = el('div', 'jp-ad-label');
    adLabel.textContent = this.ctrl.adRangeLabel;
    header.appendChild(adLabel);

    return header;
  }

  private _buildYearSelect(): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'jp-select';
    for (const y of this.ctrl.availableYears) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = toNepaliDigits(y);
      if (y === this.ctrl.selectedYear) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      this.ctrl.selectYearMonth(Number(sel.value), this.ctrl.selectedMonth);
    });
    return sel;
  }

  private _buildMonthSelect(): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'jp-select';
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = NEPALI_MONTHS_NE[m - 1];
      if (m === this.ctrl.selectedMonth) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      this.ctrl.selectYearMonth(this.ctrl.selectedYear, Number(sel.value));
    });
    return sel;
  }

  // ── Calendar: Weekday row ──────────────────────────────────────────────────

  private _buildWeekdayRow(): HTMLElement {
    const row = el('div', 'jp-weekday-row');
    for (let i = 0; i < 7; i++) {
      const cell = el('div', `jp-weekday-cell${i === 6 ? ' saturday' : ''}`);
      const ne = el('div', 'jp-wday-ne');
      ne.textContent = WDAY_NE[i];
      const en = el('div', 'jp-wday-en');
      en.textContent = WDAY_EN[i];
      cell.appendChild(ne);
      cell.appendChild(en);
      row.appendChild(cell);
    }
    return row;
  }

  // ── Calendar: Grid ────────────────────────────────────────────────────────

  private _buildGrid(): HTMLElement {
    const grid = el('div', 'jp-grid');
    for (const day of this.ctrl.grid) {
      grid.appendChild(this._buildDayCell(day));
    }
    return grid;
  }

  private _buildDayCell(day: CalendarDay): HTMLElement {
    if (!day.bsDay) {
      return el('div', 'jp-day-cell empty');
    }

    const classes = ['jp-day-cell'];
    if (day.isToday)            classes.push('today');
    if (day.weekdayIndex === 6) classes.push('saturday');
    if (this.ctrl.selectedDay?.bsDay === day.bsDay &&
        this.ctrl.selectedDay?.bsDate?.month === day.bsDate?.month &&
        this.ctrl.selectedDay?.bsDate?.year  === day.bsDate?.year) {
      classes.push('selected');
    }

    const cell = el('div', classes.join(' '));
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', () => {
      this.ctrl.selectDay(day);
    });

    const numRow = el('div', 'jp-day-num-row');
    const num = el('span', 'jp-day-num');
    num.textContent = toNepaliDigits(day.bsDay);
    const adDay = el('span', 'jp-ad-day');
    adDay.textContent = String(day.adDate!.getDate());
    numRow.appendChild(num);
    numRow.appendChild(adDay);
    cell.appendChild(numRow);

    if (day.tithi || day.events.length > 0) {
      const wrap = el('div', 'jp-events-wrap');

      if (day.tithi) {
        const tithi = el('div', 'jp-tithi');
        tithi.textContent = day.tithi.tithiName;
        wrap.appendChild(tithi);
      }

      for (const ev of day.events.slice(0, 2)) {
        const evEl = el('div', `jp-event${ev.isSpecial ? ' special' : ''}`);
        evEl.textContent = ev.title;
        wrap.appendChild(evEl);
      }

      cell.appendChild(wrap);
    }

    return cell;
  }

  // ── Selected-day detail bar ────────────────────────────────────────────────

  private _buildDetailBar(): HTMLElement {
    const bar = el('div', 'jp-detail-bar');
    const day = this.ctrl.selectedDay;

    if (!day || !day.bsDate || !day.adDate) {
      // No selection — empty bar (shouldn't normally happen)
      return bar;
    }

    const bs = day.bsDate;
    const ad = day.adDate;

    // ── BS date ──
    const bsItem = el('div', 'jp-detail-item');
    const bsLabel = el('div', 'jp-detail-label');
    bsLabel.textContent = 'BS Date';
    const bsVal = el('div', 'jp-detail-value');
    bsVal.textContent = `${NEPALI_MONTHS_EN[bs.month - 1]} ${bs.day}, ${bs.year}`;
    bsItem.appendChild(bsLabel);
    bsItem.appendChild(bsVal);

    // ── AD date ──
    const adItem = el('div', 'jp-detail-item');
    const adLabel = el('div', 'jp-detail-label');
    adLabel.textContent = 'AD Date';
    const adVal = el('div', 'jp-detail-value');
    adVal.textContent = `${ENGLISH_MONTHS[ad.getMonth()]} ${ad.getDate()}, ${ad.getFullYear()}`;
    adItem.appendChild(adLabel);
    adItem.appendChild(adVal);

    // ── Tithi ──
    const tithiItem = el('div', 'jp-detail-item');
    const tithiLabel = el('div', 'jp-detail-label');
    tithiLabel.textContent = 'Tithi';
    const tithiVal = el('div', 'jp-detail-value tithi');
    tithiVal.textContent = day.tithi ? day.tithi.tithiName : '—';
    tithiItem.appendChild(tithiLabel);
    tithiItem.appendChild(tithiVal);

    bar.appendChild(bsItem);
    bar.appendChild(adItem);
    bar.appendChild(tithiItem);

    // ── Events (one item per event, or a single "—" item if none) ──
    if (day.events.length > 0) {
      for (const ev of day.events) {
        const evItem = el('div', 'jp-detail-item');
        const evLabel = el('div', 'jp-detail-label');
        evLabel.textContent = 'Event';
        const evVal = el('div', 'jp-detail-value event');
        evVal.textContent = ev.title;
        evItem.appendChild(evLabel);
        evItem.appendChild(evVal);
        bar.appendChild(evItem);
      }
    } else {
      const evItem = el('div', 'jp-detail-item');
      const evLabel = el('div', 'jp-detail-label');
      evLabel.textContent = 'Event';
      const evVal = el('div', 'jp-detail-value');
      evVal.textContent = '—';
      evItem.appendChild(evLabel);
      evItem.appendChild(evVal);
      bar.appendChild(evItem);
    }

    return bar;
  }

  // ── List panel ────────────────────────────────────────────────────────────

  private _buildListHeader(): HTMLElement {
    const h = el('div', 'jp-list-header');
    const m = this.ctrl.selectedMonth;
    const y = this.ctrl.selectedYear;
    h.textContent = `${NEPALI_MONTHS_EN[m - 1]} ${y}`;
    return h;
  }

  private _buildDayList(): HTMLElement {
    const body = el('div', 'jp-list-body');

    // Skip padding null cells
    const days = this.ctrl.grid.filter(d => d.bsDay !== null);

    for (const day of days) {
      const ad = day.adDate!;
      const bs = day.bsDate!;

      const rowClasses = ['jp-list-row'];
      if (day.isToday)            rowClasses.push('today');
      if (day.weekdayIndex === 6) rowClasses.push('saturday');
      const row = el('div', rowClasses.join(' '));

      // ── Left: BS day number + weekday label ──────────────────────────────
      const daynumWrap = el('div', 'jp-list-daynum');

      const bsNum = el('div', 'jp-list-bs');
      bsNum.textContent = toNepaliDigits(day.bsDay!);

      const wday = el('div', 'jp-list-wday');
      wday.textContent = WDAY_EN[day.weekdayIndex];

      daynumWrap.appendChild(bsNum);
      daynumWrap.appendChild(wday);

      // ── Right: detail block ──────────────────────────────────────────────
      const detail = el('div', 'jp-list-detail');

      // "Falgun 13, 2082"
      const bsFull = el('div', 'jp-list-bs-full');
      bsFull.textContent = `${NEPALI_MONTHS_EN[bs.month - 1]} ${bs.day}, ${bs.year}`;

      // "March 25, 2026"
      const adFull = el('div', 'jp-list-ad-full');
      adFull.textContent =
        `${ENGLISH_MONTHS[ad.getMonth()]} ${ad.getDate()}, ${ad.getFullYear()}`;

      detail.appendChild(bsFull);
      detail.appendChild(adFull);

      // Tithi name (only when panchang loaded)
      if (day.tithi) {
        const tithi = el('div', 'jp-list-tithi');
        tithi.textContent = day.tithi.tithiName;
        detail.appendChild(tithi);
      }

      // Events
      if (day.events.length > 0) {
        const evWrap = el('div', 'jp-list-events');
        for (const ev of day.events) {
          const evEl = el('div', `jp-list-event${ev.isSpecial ? ' special' : ''}`);
          evEl.textContent = ev.title;
          evWrap.appendChild(evEl);
        }
        detail.appendChild(evWrap);
      }

      row.appendChild(daynumWrap);
      row.appendChild(detail);
      body.appendChild(row);
    }

    return body;
  }
}
