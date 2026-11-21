/**
 * The one piece of machinery behind every component: `createJhiguComponent` makes
 * a React component for a custom element.
 *
 * The element is created by hand, not by React. React 18 and 19 treat props on
 * custom elements differently (attributes in one, properties in the other, and
 * `className` not at all in 18), and a rerender must never reset what the user
 * typed. So the component renders one `<div style="display: contents">` and, in a
 * layout effect, creates the element with `document.createElement`, sets its
 * attributes *before* it is connected (one build, not one per attribute), then
 * appends it. Later renders write only the props that changed. Events are
 * `addEventListener` calls that read the latest callback, so changing a callback
 * never re-subscribes. Nothing here depends on the React version.
 *
 * Because the element is made on the client, a server render produces only the
 * empty wrapper; the element appears after hydration.
 */
import { createElement, forwardRef, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ForwardRefExoticComponent, PropsWithoutRef, Ref, RefAttributes } from 'react';

/** How a prop becomes an attribute. */
export type AttrKind =
  /** `String(value)`; removed when `undefined` or `null`. */
  | 'string'
  /** Present (empty) when truthy (`true`); removed when `false`, `undefined` or any other falsy value. */
  | 'boolean'
  /** The text `"false"` when `false`; removed otherwise. For attributes that default to on (`show-ad`). */
  | 'falseOnly';

export interface AttrSpec {
  attr: string;
  kind: AttrKind;
}

export interface ComponentSpec {
  /** Props that are written as attributes. */
  attrs: Record<string, AttrSpec>;
  /** Props that are written as element properties (for values that are not text). */
  properties?: readonly string[];
  /** Callback props, mapped to the DOM event they listen to. */
  events: Record<string, string>;
}

/** Props every component accepts, applied to the element itself. */
export interface HostProps {
  className?: string;
  /** Inline style. Custom properties work: `{ '--jhigu-color-primary': '#c00' }`. */
  style?: CSSProperties & Record<`--${string}`, string | number | undefined>;
  id?: string;
  title?: string;
  hidden?: boolean;
  slot?: string;
  /** `data-*` and `aria-*` attributes are passed to the element. */
  [key: `data-${string}`]: string | number | undefined;
  [key: `aria-${string}`]: string | number | boolean | undefined;
}

const PASS_THROUGH = /^(data|aria)-/;

type AnyProps = Record<string, unknown>;

/** What was last written, so a render writes only what changed. */
interface Applied {
  attrs: Map<string, string | null>;
  properties: Map<string, unknown>;
  host: Map<string, unknown>;
  styleKeys: Set<string>;
  passThrough: Set<string>;
}

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

function setAttr(el: Element, name: string, text: string | null): void {
  if (text === null) el.removeAttribute(name);
  else el.setAttribute(name, text);
}

function writeStyle(el: HTMLElement, style: Record<string, unknown> | undefined, applied: Applied): void {
  const next = new Set<string>();
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    next.add(key);
    if (key.startsWith('--')) el.style.setProperty(key, String(value));
    else (el.style as unknown as Record<string, string>)[key] = typeof value === 'number' && key !== 'opacity' && key !== 'zIndex' && key !== 'flex' ? `${value}px` : String(value);
  }
  for (const key of applied.styleKeys) {
    if (next.has(key)) continue;
    if (key.startsWith('--')) el.style.removeProperty(key);
    else (el.style as unknown as Record<string, string>)[key] = '';
  }
  applied.styleKeys = next;
}

/** Write every prop that is new or changed since [applied]. */
function apply(el: HTMLElement, props: AnyProps, spec: ComponentSpec, applied: Applied): void {
  for (const [prop, { attr, kind }] of Object.entries(spec.attrs)) {
    const text = attributeText(kind, props[prop]);
    if (applied.attrs.has(prop) && applied.attrs.get(prop) === text) continue;
    // A first render with nothing to set needs no write.
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

function setRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * A React component for the custom element [tag]. [define] registers the element
 * (it is called once, at import, in a browser only). The component's `ref` is the
 * custom element itself.
 */
export function createJhiguComponent<El extends HTMLElement, P extends object>(
  tag: string,
  define: () => unknown,
  spec: ComponentSpec,
): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<El>> {
  // Server rendering has no customElements; the component still renders its wrapper.
  if (typeof customElements !== 'undefined') define();

  const Component = forwardRef<El, P>((props, outerRef) => {
    const host = useRef<HTMLDivElement | null>(null);
    const element = useRef<El | null>(null);
    const latest = useRef<AnyProps>(props as AnyProps);
    latest.current = props as AnyProps;
    const applied = useRef<Applied | null>(null);
    const outer = useRef<Ref<El> | undefined>(outerRef);
    outer.current = outerRef;

    // Create the element once and put it in the page.
    useLayoutEffect(() => {
      const el = document.createElement(tag) as El;
      const state: Applied = {
        attrs: new Map(), properties: new Map(), host: new Map(), styleKeys: new Set(), passThrough: new Set(),
      };
      applied.current = state;
      // Properties and attributes are set before the element is connected, so it
      // builds once.
      apply(el, latest.current, spec, state);
      const listeners: Array<[string, EventListener]> = [];
      for (const [prop, eventName] of Object.entries(spec.events)) {
        const listener: EventListener = event => {
          const handler = latest.current[prop] as ((detail: unknown, event: Event) => void) | undefined;
          handler?.((event as CustomEvent).detail, event);
        };
        el.addEventListener(eventName, listener);
        listeners.push([eventName, listener]);
      }
      host.current!.appendChild(el);
      element.current = el;
      setRef(outer.current, el);
      return () => {
        for (const [name, l] of listeners) el.removeEventListener(name, l);
        el.remove();
        element.current = null;
        applied.current = null;
        setRef(outer.current, null);
      };
    }, []);

    // Write what changed on every later render.
    useLayoutEffect(() => {
      if (element.current && applied.current) apply(element.current, props as AnyProps, spec, applied.current);
    });

    // A changed `ref` prop gets the element.
    useLayoutEffect(() => {
      if (element.current) setRef(outerRef, element.current);
    }, [outerRef]);

    return createElement('div', { ref: host, style: { display: 'contents' } });
  });
  Component.displayName = tag;
  // Exposed so a test (or tooling) can compare the mapping with the element's real attributes.
  Object.defineProperty(Component, 'spec', { value: spec, enumerable: false });
  return Component as unknown as ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<El>>;
}

