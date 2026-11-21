/**
 * `<jhigu-money-input>` and `<jhigu-phone-input>`: form-associated web
 * components on the headless `createMoneyInput` and `createPhoneInput`
 * (guide 15.1 and 15.2, P2). Plain custom elements with shadow DOM, one native
 * `<input>` each, no dependencies.
 *
 *   defineJhiguMoneyInput();  defineJhiguPhoneInput();
 *
 *   <jhigu-money-input name="amount" symbol="Rs." devanagari required></jhigu-money-input>
 *   <jhigu-phone-input name="phone" language="ne" required></jhigu-phone-input>
 *
 * Money: attributes `value-paisa` (integer), `symbol` (`Rs.`, `रु`; shown beside
 * the field, not inside it), `devanagari`, `allow-negative`, `name`, `placeholder`,
 * `label` (accessible name), `disabled`, `readonly`, `required`, `theme`. The form
 * value is the integer paisa as text (`''` when empty). Property `valuePaisa` is a
 * number or null. Event `jhiguChange`: `detail: { paisa, value, text }`.
 *
 * Phone: attributes `value`, `allow-inactive`, `language`, `name`, `placeholder`,
 * `label`, `disabled`, `readonly`, `required`, `theme`. The form value is the E.164
 * number when valid, else `''`; a non-empty invalid number gives a custom
 * validity error with the message in the chosen language. Properties `value`
 * (field text) and `e164`. Event `jhiguChange`: `detail: { e164, national, valid,
 * carrier, type, text }`.
 *
 * Theming: the same CSS variables as the date picker (`--jhigu-color-primary`,
 * `-text`, `-surface`, `-muted`, `-holiday`, `--jhigu-radius`, `--jhigu-font-*`);
 * parts `field`, `symbol`, `input`, `carrier`, `message`.
 */
import { getStrings } from '../generated/strings.js';
import type { Language } from '../generated/strings.js';
import { MoneyError, Npr } from '../money.js';
import { createMoneyInput } from '../moneyInput.js';
import type { MoneyInput, MoneyInputState } from '../moneyInput.js';
import { createPhoneInput } from '../phoneInput.js';
import type { PhoneInput, PhoneInputState } from '../phoneInput.js';

const Base = ((globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ?? class {}) as typeof HTMLElement;

export const FIELD_CSS = `
:host {
  --jhigu-color-primary: #1d4ed8;
  --jhigu-color-surface: #ffffff;
  --jhigu-color-text: #1a1a1a;
  --jhigu-color-muted: #6b7280;
  --jhigu-color-holiday: #c62828;
  --jhigu-radius: 8px;
  --jhigu-font-family: system-ui, -apple-system, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
  --jhigu-font-size: 14px;
  display: inline-block;
  font-family: var(--jhigu-font-family);
  font-size: var(--jhigu-font-size);
  color: var(--jhigu-color-text);
}
:host([hidden]) { display: none; }
:host([theme="dark"]) {
  --jhigu-color-primary: #60a5fa;
  --jhigu-color-surface: #1f2937;
  --jhigu-color-text: #f3f4f6;
  --jhigu-color-muted: #9ca3af;
  --jhigu-color-holiday: #f87171;
}
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"]):not([theme="dark"])) {
    --jhigu-color-primary: #60a5fa;
    --jhigu-color-surface: #1f2937;
    --jhigu-color-text: #f3f4f6;
    --jhigu-color-muted: #9ca3af;
    --jhigu-color-holiday: #f87171;
  }
}
* { box-sizing: border-box; }
.field { display: flex; align-items: center; gap: 8px; min-width: 14em; padding: 8px 10px; border: 1px solid var(--jhigu-color-muted); border-radius: var(--jhigu-radius); background: var(--jhigu-color-surface); }
.field:focus-within { border-color: var(--jhigu-color-primary); outline: 2px solid var(--jhigu-color-primary); outline-offset: -1px; }
.field.invalid { border-color: var(--jhigu-color-holiday); }
:host([disabled]) .field { opacity: 0.5; }
.symbol { color: var(--jhigu-color-muted); white-space: nowrap; }
.symbol:empty { display: none; }
input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; padding: 0; }
input::placeholder { color: var(--jhigu-color-muted); }
.carrier { font-size: 0.8em; padding: 1px 8px; border-radius: 999px; background: var(--jhigu-color-primary); color: var(--jhigu-color-surface); white-space: nowrap; }
.carrier:empty { display: none; }
.message { margin-top: 4px; min-height: 1.2em; font-size: 0.85em; color: var(--jhigu-color-holiday); }
.message:empty { display: none; }
`;

/** Shared behaviour: shadow DOM, one input, form association, common attributes. */
abstract class FieldBase extends Base {
  static formAssociated = true;

  protected readonly internals: ElementInternals;
  protected inputEl!: HTMLInputElement;
  protected fieldEl!: HTMLDivElement;
  protected messageEl!: HTMLDivElement;
  protected badInput = false;
  private composing = false;
  private connectedOnce = false;

  constructor() {
    super();
    this.internals = this.attachInternals();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = FIELD_CSS;
    root.append(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = this.template();
    root.append(...Array.from(wrap.childNodes));
    this.fieldEl = root.querySelector('.field') as HTMLDivElement;
    this.inputEl = root.querySelector('input') as HTMLInputElement;
    this.messageEl = root.querySelector('.message') as HTMLDivElement;
    this.inputEl.addEventListener('compositionstart', () => { this.composing = true; });
    this.inputEl.addEventListener('compositionend', () => { this.composing = false; this.handleInput(); });
    this.inputEl.addEventListener('input', () => { if (!this.composing) this.handleInput(); });
    this.inputEl.addEventListener('blur', () => this.handleBlur());
  }

  /** Markup for the field, built once. Must contain `.field`, one `input` and `.message`. */
  protected abstract template(): string;
  protected abstract handleInput(): void;
  protected abstract handleBlur(): void;
  /** Read attributes into a fresh state machine. */
  protected abstract configure(): void;
  protected abstract resetToAttributes(): void;
  protected abstract restoreFromState(state: string): void;

  static get observedAttributes(): string[] {
    return ['disabled', 'readonly', 'required', 'placeholder', 'label', 'theme', 'language'];
  }

  protected get language(): Language {
    return this.getAttribute('language') === 'ne' ? 'ne' : 'en';
  }

  connectedCallback(): void {
    if (!this.connectedOnce) this.connectedOnce = true;
    this.applyCommon();
    this.configure();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.connectedOnce) return;
    this.applyCommon();
    this.attributeChanged(name);
  }

  /** Called for attributes the subclass observes; the default re-configures. */
  protected attributeChanged(_name: string): void {
    this.configure();
  }

  formResetCallback(): void { this.resetToAttributes(); }
  formDisabledCallback(disabled: boolean): void { this.toggleAttribute('disabled', disabled); }
  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === 'string') this.restoreFromState(state);
  }

  get form(): HTMLFormElement | null { return this.internals.form; }
  get validity(): ValidityState { return this.internals.validity; }
  get validationMessage(): string { return this.internals.validationMessage; }
  get willValidate(): boolean { return this.internals.willValidate; }
  checkValidity(): boolean { return this.internals.checkValidity(); }
  reportValidity(): boolean { return this.internals.reportValidity(); }

  focus(options?: FocusOptions): void { this.inputEl.focus(options); }
  select(): void { this.inputEl.select(); }

  private applyCommon(): void {
    const i = this.inputEl;
    i.disabled = this.hasAttribute('disabled');
    i.readOnly = this.hasAttribute('readonly');
    i.required = this.hasAttribute('required');
    i.placeholder = this.getAttribute('placeholder') ?? '';
    const label = this.getAttribute('label');
    if (label) i.setAttribute('aria-label', label); else i.removeAttribute('aria-label');
  }

  /** Put machine text and caret into the field. */
  protected paint(text: string, caret: number): void {
    const i = this.inputEl;
    if (i.value !== text) i.value = text;
    if (this.shadowRoot!.activeElement === i && (i.selectionStart !== caret || i.selectionEnd !== caret)) {
      i.setSelectionRange(caret, caret);
    }
  }

  protected setMessage(text: string | null): void {
    this.messageEl.textContent = text ?? '';
    this.fieldEl.classList.toggle('invalid', !!text);
    this.inputEl.setAttribute('aria-invalid', text ? 'true' : 'false');
  }
}

// ── Money ────────────────────────────────────────────────────────────────────

export interface JhiguMoneyChangeDetail {
  /** Integer paisa, or null when empty. */
  paisa: number | null;
  value: Npr | null;
  /** The text shown in the field. */
  text: string;
}

export class JhiguMoneyInput extends FieldBase {
  static get observedAttributes(): string[] {
    return [...FieldBase.observedAttributes, 'value-paisa', 'symbol', 'devanagari', 'allow-negative'];
  }

  private machine: MoneyInput | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastPaisa: number | null = null;
  private current: Npr | null = null;

  protected template(): string {
    return '<div class="field" part="field"><span class="symbol" part="symbol"></span>' +
      '<input part="input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"></div>' +
      '<div class="message" part="message" aria-live="polite"></div>';
  }

  /** Integer paisa, or null when empty. */
  get valuePaisa(): number | null { return this.current ? this.current.paisa : null; }
  set valuePaisa(paisa: number | null) { this.setPaisa(paisa); }

  /** Paisa as text, `''` when empty (the form value). */
  get value(): string { return this.current ? String(this.current.paisa) : ''; }

  protected configure(): void {
    this.unsubscribe?.();
    const symbol = this.getAttribute('symbol') ?? '';
    (this.shadowRoot!.querySelector('.symbol') as HTMLElement).textContent = symbol;
    this.machine = createMoneyInput({
      digits: this.hasAttribute('devanagari') ? 'native' : 'ascii',
      allowNegative: this.hasAttribute('allow-negative'),
    });
    this.unsubscribe = this.machine.subscribe(s => this.onState(s));
    this.badInput = false;
    this.loadAttribute();
    this.paintState();
    this.syncForm();
  }

  private loadAttribute(): void {
    const raw = this.getAttribute('value-paisa');
    if (raw === null || raw.trim() === '') { this.setCurrent(null); return; }
    try {
      if (!/^-?\d+$/.test(raw.trim())) throw new MoneyError('BAD_FORMAT');
      this.machine!.actions.setValue(Npr.fromPaisa(Number(raw)));
      this.badInput = false;
    } catch {
      this.machine!.actions.clear();
      this.badInput = true;
    }
    this.current = this.machine!.getState().value;
    this.lastPaisa = this.valuePaisa;
  }

  private setCurrent(v: Npr | null): void {
    this.current = v;
    this.lastPaisa = v ? v.paisa : null;
  }

  private setPaisa(paisa: number | null): void {
    if (!this.machine) return;
    try {
      this.machine.actions.setValue(paisa === null ? null : Npr.fromPaisa(paisa));
      this.badInput = false;
    } catch {
      this.badInput = true;
    }
    this.syncForm();
  }

  protected attributeChanged(name: string): void {
    if (name === 'value-paisa') { this.loadAttribute(); this.paintState(); this.syncForm(); return; }
    if (name === 'symbol' || name === 'devanagari' || name === 'allow-negative') {
      const keep = this.current;
      this.configure();
      if (keep) this.setPaisa(keep.paisa);
      return;
    }
    if (name === 'language') this.syncForm();
  }

  private onState(state: MoneyInputState): void {
    this.current = state.value;
    this.paint(state.text, state.caret);
    this.syncForm();
    const paisa = state.value ? state.value.paisa : null;
    if (paisa !== this.lastPaisa) {
      this.lastPaisa = paisa;
      this.dispatchEvent(new CustomEvent<JhiguMoneyChangeDetail>('jhiguChange', {
        bubbles: true,
        composed: true,
        detail: { paisa, value: state.value, text: state.text },
      }));
    }
  }

  private paintState(): void {
    if (!this.machine) return;
    const s = this.machine.getState();
    this.paint(s.text, s.caret);
  }

  protected handleInput(): void {
    if (!this.machine) return;
    const i = this.inputEl;
    this.machine.actions.input(i.value, i.selectionStart ?? i.value.length);
    // A change the machine ignores (past the maximum) leaves the field as typed: put it back.
    this.paintState();
    this.badInput = false;
  }

  protected handleBlur(): void {
    if (!this.machine) return;
    this.machine.actions.blur();
    this.paintState();
  }

  protected resetToAttributes(): void { this.configure(); }

  protected restoreFromState(state: string): void {
    if (/^-?\d+$/.test(state)) this.setPaisa(Number(state));
  }

  private syncForm(): void {
    this.internals.setFormValue(this.value === '' ? null : this.value);
    const s = getStrings(this.language);
    if (this.badInput) this.internals.setValidity({ badInput: true }, s.money.badFormat, this.inputEl);
    else if (this.hasAttribute('required') && !this.current) this.internals.setValidity({ valueMissing: true }, s.money.empty, this.inputEl);
    else this.internals.setValidity({});
  }
}

// ── Phone ────────────────────────────────────────────────────────────────────

export interface JhiguPhoneChangeDetail {
  e164: string | null;
  national: string | null;
  valid: boolean;
  carrier: string | null;
  type: 'mobile' | 'landline' | null;
  /** The text shown in the field. */
  text: string;
}

export class JhiguPhoneInput extends FieldBase {
  static get observedAttributes(): string[] {
    return [...FieldBase.observedAttributes, 'value', 'allow-inactive'];
  }

  private machine: PhoneInput | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastKey = '';

  protected template(): string {
    return '<div class="field" part="field"><input part="input" type="tel" inputmode="tel" autocomplete="tel" spellcheck="false">' +
      '<span class="carrier" part="carrier"></span></div>' +
      '<div class="message" part="message" aria-live="polite"></div>';
  }

  /** The text in the field. Setting it formats it like typing would. */
  get value(): string { return this.machine ? this.machine.getState().text : ''; }
  set value(text: string) { this.machine?.actions.setValue(text); this.syncForm(); }

  /** `+977…` when the number is valid, else null. */
  get e164(): string | null { return this.machine ? this.machine.getState().e164 : null; }

  protected configure(): void {
    this.unsubscribe?.();
    this.machine = createPhoneInput({
      language: this.language,
      allowInactive: this.hasAttribute('allow-inactive'),
      value: this.getAttribute('value') ?? undefined,
    });
    this.unsubscribe = this.machine.subscribe(s => this.onState(s));
    this.lastKey = this.keyOf(this.machine.getState());
    this.paintState(this.machine.getState());
    this.syncForm();
  }

  protected attributeChanged(name: string): void {
    if (name === 'language') {
      this.machine?.actions.setLanguage(this.language);
      this.syncForm();
      return;
    }
    if (name === 'value') {
      this.machine?.actions.setValue(this.getAttribute('value') ?? '');
      this.syncForm();
      return;
    }
    if (name === 'allow-inactive') {
      const text = this.value;
      this.configure();
      this.machine!.actions.setValue(text);
    }
  }

  private keyOf(s: PhoneInputState): string {
    return `${s.e164 ?? ''}|${s.valid}|${s.carrier ?? ''}|${s.type ?? ''}`;
  }

  private onState(state: PhoneInputState): void {
    this.paintState(state);
    this.syncForm();
    const key = this.keyOf(state);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.dispatchEvent(new CustomEvent<JhiguPhoneChangeDetail>('jhiguChange', {
        bubbles: true,
        composed: true,
        detail: { e164: state.e164, national: state.national, valid: state.valid, carrier: state.carrier, type: state.type, text: state.text },
      }));
    }
  }

  private paintState(state: PhoneInputState): void {
    this.paint(state.text, state.caret);
    (this.shadowRoot!.querySelector('.carrier') as HTMLElement).textContent = state.carrier ?? '';
    this.setMessage(state.message);
  }

  protected handleInput(): void {
    if (!this.machine) return;
    const i = this.inputEl;
    this.machine.actions.input(i.value, i.selectionStart ?? i.value.length);
    const s = this.machine.getState();
    this.paint(s.text, s.caret);
  }

  protected handleBlur(): void {
    this.machine?.actions.blur();
    this.syncForm();
  }

  protected resetToAttributes(): void { this.configure(); }

  protected restoreFromState(state: string): void {
    this.machine?.actions.setValue(state);
    this.syncForm();
  }

  private syncForm(): void {
    const s = this.machine?.getState();
    this.internals.setFormValue(s && s.e164 ? s.e164 : null);
    const strings = getStrings(this.language);
    if (s && s.text !== '' && !s.valid) {
      // Incomplete numbers have no message until blur; use the "too short" text then.
      const message = s.message ?? strings.phone.tooShort;
      this.internals.setValidity({ customError: true }, message, this.inputEl);
    } else if (this.hasAttribute('required') && (!s || s.text === '')) {
      this.internals.setValidity({ valueMissing: true }, strings.phone.empty, this.inputEl);
    } else {
      this.internals.setValidity({});
    }
  }
}

function define(tag: string, cls: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') throw new Error('customElements is not available in this environment');
  if (!customElements.get(tag)) customElements.define(tag, cls);
}

/** Register `<jhigu-money-input>`. Safe to call twice. */
export function defineJhiguMoneyInput(tag = 'jhigu-money-input'): typeof JhiguMoneyInput {
  define(tag, JhiguMoneyInput);
  return JhiguMoneyInput;
}

/** Register `<jhigu-phone-input>`. Safe to call twice. */
export function defineJhiguPhoneInput(tag = 'jhigu-phone-input'): typeof JhiguPhoneInput {
  define(tag, JhiguPhoneInput);
  return JhiguPhoneInput;
}
