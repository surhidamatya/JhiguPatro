/**
 * Framework-neutral glue between a UI framework's props and one of the web
 * components (`<jhigu-date-picker>` and the others). The React and Vue packages
 * are thin layers over this; use it directly for any other framework.
 *
 *   const binding = new ElementBinding('jhigu-date-picker', spec);
 *   binding.mount(parentElement, () => props);   // create, set attributes, connect
 *   binding.update(props);                        // write only what changed
 *   binding.unmount();
 *
 * The element is created with `document.createElement` and its attributes are set
 * *before* it is connected, so it builds once rather than once per attribute.
 * Later `update` calls write only the props that changed since the last write, so a
 * re-render never resets a field the user has typed in. Callback props are looked up
 * on every event through the `getProps` function given to `mount`, so changing a
 * callback never re-subscribes.
 *
 * Client only: it needs `document`. `attributeText` and the spec types need nothing.
 */

/** How a prop becomes an attribute. */
export type AttrKind =
  /** `String(value)`; removed when `undefined` or `null`. */
  | 'string'
  /** Present (empty) when truthy; removed when `false`, `undefined` or any other falsy value. */
  | 'boolean'
  /** The text `"false"` when exactly `false`; removed otherwise. For attributes that default to on (`show-ad`). */
  | 'falseOnly';

/** The JavaScript type of a prop, for frameworks that declare prop types (Vue). */
export type PropValueType = 'string' | 'number' | 'boolean' | 'object';

export interface AttrSpec {
  /** The attribute name (`week-starts-on`). */
  attr: string;
  kind: AttrKind;
  /** Default `string`. */
  type?: PropValueType;
}

export interface ElementSpec {
  /** Props written as attributes, by prop name (`weekStartsOn`). */
  attrs: Record<string, AttrSpec>;
  /** Props written as element properties (values that are not text, such as the calendar's `events`). */
  properties?: readonly string[];
  /** Callback props, mapped to the DOM event they listen to (`onChange` to `jhiguChange`). */
  events: Record<string, string>;
}

type AnyProps = Record<string, unknown>;

/** The attribute text for a prop value, or null to remove the attribute. */
export function attributeText(kind: AttrKind, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  switch (kind) {
    case 'string':
      return String(value);
    case 'boolean':
      // As React does for HTML boolean attributes: any truthy value sets it.
      return value ? '' : null;
    case 'falseOnly':
      return value === false ? 'false' : null;
  }
}

const PASS_THROUGH = /^(data|aria)-/;

/** What was last written, so an update writes only what changed. */
interface Applied {
  attrs: Map<string, string | null>;
  properties: Map<string, unknown>;
  host: Map<string, unknown>;
  styleKeys: Set<string>;
  passThrough: Set<string>;
}

function setAttr(el: Element, name: string, text: string | null): void {
  if (text === null) el.removeAttribute(name);
  else el.setAttribute(name, text);
}

const UNITLESS = new Set(['opacity', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'order', 'lineHeight', 'fontWeight']);

function writeStyle(el: HTMLElement, style: Record<string, unknown> | undefined, applied: Applied): void {
  const next = new Set<string>();
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    next.add(key);
    if (key.startsWith('--')) el.style.setProperty(key, String(value));
    else (el.style as unknown as Record<string, string>)[key] = typeof value === 'number' && !UNITLESS.has(key) ? `${value}px` : String(value);
  }
  for (const key of applied.styleKeys) {
    if (next.has(key)) continue;
    if (key.startsWith('--')) el.style.removeProperty(key);
    else (el.style as unknown as Record<string, string>)[key] = '';
  }
  applied.styleKeys = next;
}

/**
 * Write every prop that is new or changed since [applied]. Host props understood
 * besides the spec's: `className`, `style` (an object; custom properties work),
 * `id`, `title`, `slot`, `hidden`, and any `data-*` or `aria-*` key.
 */
function apply(el: HTMLElement, props: AnyProps, spec: ElementSpec, applied: Applied): void {
  for (const [prop, { attr, kind }] of Object.entries(spec.attrs)) {
    const text = attributeText(kind, props[prop]);
    if (applied.attrs.has(prop) && applied.attrs.get(prop) === text) continue;
    // A first write with nothing to set needs no DOM call.
    if (!applied.attrs.has(prop) && text === null) { applied.attrs.set(prop, text); continue; }
    setAttr(el, attr, text);
    applied.attrs.set(prop, text);
  }
  for (const prop of spec.properties ?? []) {
    const value = props[prop];
    if (applied.properties.has(prop) ? applied.properties.get(prop) === value : value === undefined) continue;
    (el as unknown as AnyProps)[prop] = value;
    applied.properties.set(prop, value);
  }

  const host = applied.host;
  const className = props.className as string | undefined;
  if (host.get('className') !== className) {
    if (className) el.setAttribute('class', className); else el.removeAttribute('class');
    host.set('className', className);
  }
  for (const key of ['id', 'title', 'slot'] as const) {
    const v = props[key] as string | undefined;
    if (host.get(key) === v) continue;
    setAttr(el, key, v === undefined ? null : v);
    host.set(key, v);
  }
  const hidden = props.hidden === true;
  if ((host.get('hidden') ?? false) !== hidden) {
    el.toggleAttribute('hidden', hidden);
    host.set('hidden', hidden);
  }
  const style = props.style as Record<string, unknown> | undefined;
  if (host.get('style') !== style) {
    writeStyle(el, style, applied);
    host.set('style', style);
  }

  const seen = new Set<string>();
  for (const [key, value] of Object.entries(props)) {
    if (!PASS_THROUGH.test(key)) continue;
    seen.add(key);
    const text = value === undefined || value === null || value === false ? null : String(value);
    if (applied.attrs.get(key) === text && applied.passThrough.has(key)) continue;
    setAttr(el, key, text);
    applied.attrs.set(key, text);
    applied.passThrough.add(key);
  }
  for (const key of [...applied.passThrough]) {
    if (seen.has(key)) continue;
    el.removeAttribute(key);
    applied.attrs.delete(key);
    applied.passThrough.delete(key);
  }
}

export class ElementBinding<El extends HTMLElement = HTMLElement> {
  private el: El | null = null;
  private applied: Applied | null = null;
  private listeners: Array<[string, EventListener]> = [];

  constructor(
    private readonly tag: string,
    private readonly spec: ElementSpec,
  ) {}

  /** The element, once mounted. */
  get element(): El | null {
    return this.el;
  }

  /**
   * Create the element, write [getProps]'s props to it, listen for its events, and
   * append it to [parent]. [getProps] is called again on every event to find the
   * current callback. Mounting twice without `unmount` throws.
   */
  mount(parent: Element, getProps: () => AnyProps): El {
    if (this.el) throw new Error('already mounted');
    const el = document.createElement(this.tag) as El;
    const applied: Applied = {
      attrs: new Map(), properties: new Map(), host: new Map(), styleKeys: new Set(), passThrough: new Set(),
    };
    this.applied = applied;
    // Attributes and properties are set before the element is connected, so it builds once.
    apply(el, getProps(), this.spec, applied);
    for (const [prop, eventName] of Object.entries(this.spec.events)) {
      const listener: EventListener = event => {
        const handler = getProps()[prop] as ((detail: unknown, event: Event) => void) | undefined;
        if (typeof handler === 'function') handler((event as CustomEvent).detail, event);
      };
      el.addEventListener(eventName, listener);
      this.listeners.push([eventName, listener]);
    }
    parent.appendChild(el);
    this.el = el;
    return el;
  }

  /** Write the props that changed since the last write. Does nothing before `mount`. */
  update(props: AnyProps): void {
    if (this.el && this.applied) apply(this.el, props, this.spec, this.applied);
  }

  /** Stop listening and remove the element. Safe to call twice. */
  unmount(): void {
    const el = this.el;
    if (!el) return;
    for (const [name, l] of this.listeners) el.removeEventListener(name, l);
    this.listeners = [];
    el.remove();
    this.el = null;
    this.applied = null;
  }
}
