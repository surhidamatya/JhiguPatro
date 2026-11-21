/**
 * `<jhigu-address-select>`: Nepal address select (province, district, local
 * level, ward) as a form-associated web component on the headless
 * `createAddressPicker` (guide 11.5, 15.2). Plain custom element, shadow DOM,
 * native `<select>`s (so mobile pickers and screen readers work), no
 * dependencies.
 *
 *   defineJhiguAddressSelect();
 *   <jhigu-address-select name="addr" language="ne" required></jhigu-address-select>
 *
 * Attributes: `value` (local level id), `ward` (initial ward), `language`
 * (`en` | `ne`), `show-ward` (default on; `show-ward="false"` hides the ward),
 * `name`, `required`, `disabled`, `theme`. Items are listed in data order.
 *
 * Form data, when `name` is set: `name` is the local level id; `name_ward`,
 * `name_district` and `name_province` are added when chosen. Property
 * `selection` is the full selection or null; `value` is the local level id text.
 * Event `jhiguChange` fires when any choice changes, with `detail: { provinceId,
 * districtId, localLevelId, ward, complete, selection, text }` (`text` is the
 * formatted address when complete, else `''`).
 *
 * Needs the address data, which is part of this entry point only (it is not in
 * the main bundle). Theming and parts: same variables as the other elements;
 * parts `root`, `item`, `label`, `select`, `province`, `district`, `local-level`,
 * `ward`.
 */
import { AddressError, formatAddress, getLocalLevel } from '../address.js';
import { createAddressPicker } from '../addressPicker.js';
import type { AddressPicker, AddressPickerState, AddressSelection } from '../addressPicker.js';
import { getStrings } from '../generated/strings.js';
import type { Language } from '../generated/strings.js';
import { FIELD_CSS } from './fieldElements.js';
import { esc } from './pickerMarkup.js';

export interface JhiguAddressChangeDetail {
  provinceId: number | null;
  districtId: number | null;
  localLevelId: number | null;
  ward: number | null;
  complete: boolean;
  selection: AddressSelection | null;
  /** Formatted address when complete, else `''`. */
  text: string;
}

const Base = ((globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ?? class {}) as typeof HTMLElement;

const ADDRESS_CSS = `${FIELD_CSS}
.stack { display: grid; gap: 10px; min-width: 16em; }
.item { display: grid; gap: 4px; }
.lbl { font-size: 0.85em; color: var(--jhigu-color-muted); }
select { width: 100%; padding: 8px 10px; border: 1px solid var(--jhigu-color-muted); border-radius: var(--jhigu-radius); background: var(--jhigu-color-surface); color: inherit; font: inherit; }
select:focus-visible { outline: 2px solid var(--jhigu-color-primary); outline-offset: 1px; border-color: var(--jhigu-color-primary); }
select:disabled { opacity: 0.5; cursor: not-allowed; }
:host([hidden]) { display: none; }
`;

type Level = 'province' | 'district' | 'localLevel' | 'ward';
const PARTS: Record<Level, string> = { province: 'province', district: 'district', localLevel: 'local-level', ward: 'ward' };

const NE_DIGITS = '०१२३४५६७८९';

export class JhiguAddressSelect extends Base {
  static formAssociated = true;
  static observedAttributes = ['value', 'ward', 'language', 'show-ward', 'name', 'required', 'disabled', 'theme'];

  private readonly internals: ElementInternals;
  private picker: AddressPicker | null = null;
  private unsubscribe: (() => void) | null = null;
  private badInput = false;
  private fatal: string | null = null;
  private lastKey = '';
  private connectedOnce = false;
  private root!: HTMLDivElement;
  private pending: { localLevelId: number; ward: number | null } | null = null;

  constructor() {
    super();
    this.internals = this.attachInternals();
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ADDRESS_CSS;
    this.root = document.createElement('div');
    this.root.setAttribute('part', 'root');
    shadow.append(style, this.root);
    this.root.addEventListener('change', e => this.onChange(e));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** The full selection, or null until complete. */
  get selection(): AddressSelection | null {
    return this.picker ? this.picker.getState().selection : null;
  }

  /** Local level id as text, `''` when none. */
  get value(): string {
    const id = this.picker?.getState().localLevelId;
    return id == null ? '' : String(id);
  }

  /** Choose a local level (and ward) by id. Throws AddressError for an invalid id or ward. */
  setAddress(localLevelId: number, ward: number | null = null): void {
    this.requirePicker().actions.selectLocalLevel(localLevelId);
    if (ward !== null) this.picker!.actions.selectWard(ward);
  }

  clear(): void { this.picker?.actions.clear(); }

  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }

  focus(options?: FocusOptions): void {
    this.root.querySelector<HTMLSelectElement>('select:not(:disabled)')?.focus(options);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connectedCallback(): void {
    this.connectedOnce = true;
    this.rebuild(this.fromAttributes());
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.connectedOnce) return;
    if (name === 'value' || name === 'ward') { this.rebuild(this.fromAttributes()); return; }
    if (name === 'language') { this.picker?.actions.setLanguage(this.language); return; }
    if (name === 'show-ward') { this.rebuild(this.current()); return; }
    this.paint();
    this.syncForm();
  }

  formResetCallback(): void { this.rebuild(this.fromAttributes()); }
  formDisabledCallback(disabled: boolean): void { this.toggleAttribute('disabled', disabled); }
  formStateRestoreCallback(state: string | File | FormData | null): void {
    const raw = state instanceof FormData ? state.get(this.getAttribute('name') ?? '') : state;
    const ward = state instanceof FormData ? state.get(`${this.getAttribute('name') ?? ''}_ward`) : null;
    if (typeof raw === 'string' && /^\d+$/.test(raw)) {
      this.rebuild({ localLevelId: Number(raw), ward: typeof ward === 'string' && /^\d+$/.test(ward) ? Number(ward) : null });
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private get language(): Language { return this.getAttribute('language') === 'ne' ? 'ne' : 'en'; }
  private get showWard(): boolean { return this.getAttribute('show-ward') !== 'false'; }

  private requirePicker(): AddressPicker {
    if (!this.picker) throw new Error('jhigu-address-select is not ready');
    return this.picker;
  }

  private fromAttributes(): { localLevelId: number; ward: number | null } | null {
    const v = this.getAttribute('value');
    if (v === null || v.trim() === '') return null;
    const w = this.getAttribute('ward');
    // A hidden ward is never part of the value.
    return { localLevelId: Number(v), ward: !this.showWard || w === null || w.trim() === '' ? null : Number(w) };
  }

  private current(): { localLevelId: number; ward: number | null } | null {
    const s = this.picker?.getState();
    return s && s.localLevelId !== null ? { localLevelId: s.localLevelId, ward: this.showWard ? s.ward : null } : null;
  }

  private rebuild(value: { localLevelId: number; ward: number | null } | null): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.fatal = null;
    this.badInput = false;
    this.lastKey = '';
    const make = (v: typeof value) => createAddressPicker({ language: this.language, showWard: this.showWard, value: v });
    try {
      try {
        this.picker = make(value);
      } catch (e) {
        if (e instanceof AddressError) { this.badInput = true; this.picker = make(null); } else throw e;
      }
      this.unsubscribe = this.picker.subscribe(() => this.onState());
      this.lastKey = this.keyOf(this.picker.getState());
    } catch (e) {
      this.picker = null;
      this.fatal = e instanceof Error ? e.message : String(e);
    }
    this.paint();
    this.syncForm();
  }

  private keyOf(s: AddressPickerState): string {
    return `${s.provinceId ?? ''}|${s.districtId ?? ''}|${s.localLevelId ?? ''}|${s.ward ?? ''}`;
  }

  private onState(): void {
    const state = this.picker!.getState();
    this.badInput = false;
    this.paint();
    this.syncForm();
    const key = this.keyOf(state);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.dispatchEvent(new CustomEvent<JhiguAddressChangeDetail>('jhiguChange', {
      bubbles: true,
      composed: true,
      detail: {
        provinceId: state.provinceId,
        districtId: state.districtId,
        localLevelId: state.localLevelId,
        ward: state.ward,
        complete: state.complete,
        selection: state.selection,
        text: this.textOf(state),
      },
    }));
  }

  private textOf(state: AddressPickerState): string {
    if (!state.complete || state.localLevelId === null) return '';
    // With showWard off there is no ward; use ward 1 only to reuse the formatter's checks, then drop it.
    if (state.ward === null) {
      const ll = getLocalLevel(state.localLevelId);
      if (!ll) return '';
      return formatAddress({ localLevelId: state.localLevelId, ward: 1 }, state.language).replace(/^[^,]*,\s*/, '');
    }
    return formatAddress({ localLevelId: state.localLevelId, ward: state.ward }, state.language);
  }

  private onChange(e: Event): void {
    const picker = this.picker;
    const el = e.target as HTMLSelectElement;
    if (!picker || !el.dataset.level || this.hasAttribute('disabled')) return;
    const id = el.value === '' ? null : Number(el.value);
    try {
      switch (el.dataset.level as Level) {
        case 'province': picker.actions.selectProvince(id); break;
        case 'district': picker.actions.selectDistrict(id); break;
        case 'localLevel': picker.actions.selectLocalLevel(id); break;
        case 'ward': picker.actions.selectWard(id); break;
      }
    } catch (err) {
      if (!(err instanceof AddressError)) throw err;
      this.paint();
    }
  }

  private paint(): void {
    if (this.fatal !== null || !this.picker) {
      this.root.innerHTML = `<div class="message" role="alert" style="display:block">${esc(this.fatal ?? 'jhigu-address-select: no data')}</div>`;
      return;
    }
    const s = this.picker.getState();
    const t = getStrings(s.language);
    const ne = s.language === 'ne';
    const digits = (n: number) => (ne ? String(n).replace(/\d/g, d => NE_DIGITS[+d]) : String(n));
    const disabled = this.hasAttribute('disabled');
    const choose = `<option value="">${esc(t.address.choose)}</option>`;
    const opts = (items: ReadonlyArray<{ id: number; en: string; ne: string }>, selected: number | null) =>
      choose + items.map(i => `<option value="${i.id}"${i.id === selected ? ' selected' : ''}>${esc(i[s.language])}</option>`).join('');

    const field = (level: Level, label: string, options: string, off: boolean): string =>
      `<label class="item" part="item"><span class="lbl" part="label">${esc(label)}</span>` +
      `<select part="select ${PARTS[level]}" data-level="${level}"${disabled || off ? ' disabled' : ''}${this.hasAttribute('required') ? ' aria-required="true"' : ''}>${options}</select></label>`;

    const wardOptions = choose + s.wards
      .map(w => `<option value="${w}"${w === s.ward ? ' selected' : ''}>${esc(t.address.ward.replace('{n}', digits(w)))}</option>`)
      .join('');

    // Keep focus on the same select across the re-render.
    const active = this.shadowRoot!.activeElement as HTMLElement | null;
    const focusLevel = active?.dataset.level ?? null;

    this.root.className = 'stack';
    this.root.innerHTML =
      field('province', t.address.province, opts(s.provinces, s.provinceId), false) +
      field('district', t.address.district, opts(s.districts, s.districtId), s.provinceId === null) +
      field('localLevel', t.address.localLevel, opts(s.localLevels, s.localLevelId), s.districtId === null) +
      (s.showWard ? field('ward', t.address.wardLabel, wardOptions, s.localLevelId === null) : '');

    if (focusLevel) this.root.querySelector<HTMLElement>(`[data-level="${focusLevel}"]`)?.focus();
  }

  private syncForm(): void {
    const name = this.getAttribute('name');
    const s = this.picker?.getState();
    if (!name || !s || s.localLevelId === null) this.internals.setFormValue(null);
    else {
      const fd = new FormData();
      fd.append(name, String(s.localLevelId));
      if (s.ward !== null) fd.append(`${name}_ward`, String(s.ward));
      if (s.districtId !== null) fd.append(`${name}_district`, String(s.districtId));
      if (s.provinceId !== null) fd.append(`${name}_province`, String(s.provinceId));
      this.internals.setFormValue(fd);
    }
    const anchor = this.root.querySelector<HTMLElement>('select') ?? undefined;
    const lang = getStrings(this.language);
    if (this.badInput) this.internals.setValidity({ badInput: true }, lang.address.unknownLocalLevel, anchor);
    else if (this.hasAttribute('required') && s && !s.complete) this.internals.setValidity({ valueMissing: true }, lang.address.required, anchor);
    else this.internals.setValidity({});
  }
}

/** Register `<jhigu-address-select>`. Safe to call twice. */
export function defineJhiguAddressSelect(tag = 'jhigu-address-select'): typeof JhiguAddressSelect {
  if (typeof customElements === 'undefined') throw new Error('customElements is not available in this environment');
  if (!customElements.get(tag)) customElements.define(tag, JhiguAddressSelect);
  return JhiguAddressSelect;
}
