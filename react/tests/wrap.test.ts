import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement, createRef, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createJhiguComponent, attributeText } from '../src/wrap.js';
import type { ComponentSpec } from '../src/wrap.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A custom element that records how it was used. */
class Stub extends HTMLElement {
  static log: string[] = [];
  static instances = 0;
  static connections = 0;
  /** Attributes present at the moment of connecting. */
  static atConnect: Record<string, string>[] = [];
  note?: unknown;
  connectedCallback() {
    Stub.connections++;
    Stub.atConnect.push(Object.fromEntries(this.getAttributeNames().map(n => [n, this.getAttribute(n)!])));
  }
  constructor() { super(); Stub.instances++; }
}
if (!customElements.get('x-stub')) customElements.define('x-stub', Stub);

const spec: ComponentSpec = {
  attrs: {
    value: { attr: 'value', kind: 'string' },
    weekStartsOn: { attr: 'week-starts-on', kind: 'string' },
    disabled: { attr: 'disabled', kind: 'boolean' },
    showAd: { attr: 'show-ad', kind: 'falseOnly' },
  },
  properties: ['events'],
  events: { onChange: 'jhiguChange', onOpen: 'jhiguOpen' },
};
const defineSpy = vi.fn();
const Comp = createJhiguComponent<Stub, Record<string, unknown>>('x-stub', defineSpy, spec);

let container: HTMLDivElement;
let root: Root;
const render = (props: Record<string, unknown>, ref?: unknown, strict = false) => {
  const node = createElement(Comp as never, { ...props, ref } as never);
  act(() => root.render(strict ? createElement(StrictMode, null, node) : node));
};
const el = () => container.querySelector('x-stub') as Stub | null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Stub.connections = 0; Stub.atConnect = []; Stub.instances = 0;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('attributeText', () => {
  it('string: text, 0 and empty text are kept; undefined and null remove', () => {
    expect(attributeText('string', 'x')).toBe('x');
    expect(attributeText('string', 0)).toBe('0');
    expect(attributeText('string', '')).toBe('');
    expect(attributeText('string', 12)).toBe('12');
    expect(attributeText('string', undefined)).toBeNull();
    expect(attributeText('string', null)).toBeNull();
  });
  it('boolean: present for any truthy value (as React does), removed for falsy ones', () => {
    expect(attributeText('boolean', true)).toBe('');
    expect(attributeText('boolean', 1)).toBe('');
    expect(attributeText('boolean', 'yes')).toBe('');
    expect(attributeText('boolean', false)).toBeNull();
    expect(attributeText('boolean', 0)).toBeNull();
    expect(attributeText('boolean', '')).toBeNull();
    expect(attributeText('boolean', undefined)).toBeNull();
    expect(attributeText('boolean', null)).toBeNull();
  });
  it('falseOnly: "false" only for exactly false; 0, empty text and the rest leave it off', () => {
    expect(attributeText('falseOnly', false)).toBe('false');
    expect(attributeText('falseOnly', true)).toBeNull();
    expect(attributeText('falseOnly', 0)).toBeNull();
    expect(attributeText('falseOnly', '')).toBeNull();
    expect(attributeText('falseOnly', 'false')).toBeNull();
    expect(attributeText('falseOnly', undefined)).toBeNull();
    expect(attributeText('falseOnly', null)).toBeNull();
  });
});

describe('creating the element', () => {
  it('registers the element once at import', () => {
    expect(defineSpy).toHaveBeenCalledTimes(1);
  });

  it('renders one wrapper that takes no space, with the element inside', () => {
    render({});
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.style.display).toBe('contents');
    expect(wrapper.children).toHaveLength(1);
    expect(el()).toBeInstanceOf(Stub);
  });

  it('sets the attributes before the element is connected: one build, not one per attribute', () => {
    render({ value: '2082-05-10', weekStartsOn: 0, disabled: true, showAd: false });
    expect(Stub.connections).toBe(1);
    expect(Stub.atConnect[0]).toEqual({
      value: '2082-05-10', 'week-starts-on': '0', disabled: '', 'show-ad': 'false',
    });
  });

  it('writes nothing for props that are not given', () => {
    render({});
    expect(Stub.atConnect[0]).toEqual({});
  });

  it('a bare mount does not even try to remove attributes', () => {
    const remove = vi.spyOn(Element.prototype, 'removeAttribute');
    const set = vi.spyOn(Element.prototype, 'setAttribute');
    const toggle = vi.spyOn(Element.prototype, 'toggleAttribute');
    render({});
    const onStub = (spy: { mock: { contexts: unknown[] } }) => spy.mock.contexts.filter(c => c instanceof Stub).length;
    expect(onStub(remove)).toBe(0);
    expect(onStub(set)).toBe(0);
    expect(onStub(toggle)).toBe(0);
    vi.restoreAllMocks();
  });

  it('assigns properties before connecting, and only those that were given', () => {
    const events = { '2082-05-12': ['Teej'] };
    render({ events });
    expect(el()!.note).toBeUndefined();
    expect((el() as unknown as { events: unknown }).events).toBe(events);
  });

  it('does not forward callbacks or unknown props as attributes', () => {
    render({ onChange: () => {}, mystery: 'x', value: 'v' });
    expect(el()!.getAttributeNames().sort()).toEqual(['value']);
  });
});

describe('updating', () => {
  it('writes only what changed', () => {
    render({ value: 'a', weekStartsOn: 1 });
    const spySet = vi.spyOn(el()!, 'setAttribute');
    const spyRemove = vi.spyOn(el()!, 'removeAttribute');
    render({ value: 'a', weekStartsOn: 1 });
    expect(spySet).not.toHaveBeenCalled();
    expect(spyRemove).not.toHaveBeenCalled();
    render({ value: 'b', weekStartsOn: 1 });
    expect(spySet).toHaveBeenCalledTimes(1);
    expect(spySet).toHaveBeenCalledWith('value', 'b');
    expect(el()!.getAttribute('value')).toBe('b');
  });

  it('the same element stays: a rerender does not recreate it', () => {
    render({ value: 'a' });
    const first = el();
    render({ value: 'b' });
    render({ value: 'c', disabled: true });
    expect(el()).toBe(first);
    expect(Stub.instances).toBe(1);
    expect(Stub.connections).toBe(1);
  });

  it('removes an attribute when the prop goes away or false', () => {
    render({ value: 'a', disabled: true, showAd: false });
    render({});
    expect(el()!.getAttributeNames()).toEqual([]);
  });

  it('a changed prop does not rewrite the ones the user may have changed in the element', () => {
    // The parent's `value` stays "a" while the user types in the element: no write.
    render({ value: 'a' });
    const spySet = vi.spyOn(el()!, 'setAttribute');
    el()!.setAttribute('value', 'typed by the user');
    spySet.mockClear();
    render({ value: 'a', disabled: true });
    expect(spySet).toHaveBeenCalledTimes(1);
    expect(spySet).toHaveBeenCalledWith('disabled', '');
    expect(el()!.getAttribute('value')).toBe('typed by the user');
  });

  it('properties are assigned again only when the object changes', () => {
    const a = { x: 1 };
    render({ events: a });
    const desc = vi.fn();
    Object.defineProperty(el()!, 'events', { set: desc, get: () => a, configurable: true });
    render({ events: a });
    expect(desc).not.toHaveBeenCalled();
    const b = { x: 2 };
    render({ events: b });
    expect(desc).toHaveBeenCalledWith(b);
  });
});

describe('events', () => {
  it('calls the callback with the detail and the event', () => {
    const onChange = vi.fn();
    render({ onChange });
    const ev = new CustomEvent('jhiguChange', { detail: { bs: '2082-05-10' }, bubbles: true, composed: true });
    el()!.dispatchEvent(ev);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({ bs: '2082-05-10' });
    expect(onChange.mock.calls[0][1]).toBe(ev);
  });

  it('maps each callback prop to its own event', () => {
    const onChange = vi.fn();
    const onOpen = vi.fn();
    render({ onChange, onOpen });
    el()!.dispatchEvent(new CustomEvent('jhiguOpen', { detail: 1 }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('always calls the latest callback, without subscribing again', () => {
    const first = vi.fn();
    const second = vi.fn();
    render({ onChange: first });
    const spyAdd = vi.spyOn(el()!, 'addEventListener');
    render({ onChange: second });
    expect(spyAdd).not.toHaveBeenCalled();
    el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a callback added later, or removed, works', () => {
    render({});
    el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 })); // no callback: no error
    const onChange = vi.fn();
    render({ onChange });
    el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 2 }));
    render({});
    el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 3 }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stops listening when unmounted', () => {
    const onChange = vi.fn();
    render({ onChange });
    const node = el()!;
    act(() => root.render(null));
    node.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }));
    expect(onChange).not.toHaveBeenCalled();
    expect(el()).toBeNull();
  });

  it('events from inside the element reach the callback once (bubbling does not double it)', () => {
    const onChange = vi.fn();
    render({ onChange });
    el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1, bubbles: true, composed: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('ref', () => {
  it('an object ref is the element, and null after unmount', () => {
    const ref = createRef<Stub>();
    render({}, ref);
    expect(ref.current).toBe(el());
    act(() => root.render(null));
    expect(ref.current).toBeNull();
  });

  it('a function ref gets the element, then null', () => {
    const calls: unknown[] = [];
    render({}, (n: unknown) => calls.push(n));
    expect(calls[0]).toBe(el());
    act(() => root.render(null));
    expect(calls[calls.length - 1]).toBeNull();
  });
});

describe('host props', () => {
  it('className, id, title, slot and hidden go to the element', () => {
    render({ className: 'a b', id: 'x', title: 'T', slot: 's', hidden: true });
    const e = el()!;
    expect(e.getAttribute('class')).toBe('a b');
    expect(e.id).toBe('x');
    expect(e.title).toBe('T');
    expect(e.getAttribute('slot')).toBe('s');
    expect(e.hasAttribute('hidden')).toBe(true);
    render({});
    expect(e.hasAttribute('class')).toBe(false);
    expect(e.hasAttribute('id')).toBe(false);
    expect(e.hasAttribute('hidden')).toBe(false);
  });

  it('style: normal and custom properties, and removing them', () => {
    render({ style: { color: 'red', width: 10, '--jhigu-color-primary': '#c00' } });
    const e = el()!;
    expect(e.style.color).toBe('red');
    expect(e.style.width).toBe('10px');
    expect(e.style.getPropertyValue('--jhigu-color-primary')).toBe('#c00');
    render({ style: { color: 'blue' } });
    expect(e.style.color).toBe('blue');
    expect(e.style.width).toBe('');
    expect(e.style.getPropertyValue('--jhigu-color-primary')).toBe('');
    render({});
    expect(e.style.color).toBe('');
  });

  it('data-* and aria-* are passed, changed and removed', () => {
    render({ 'data-testid': 'cal', 'aria-label': 'Pick a date', 'aria-hidden': false });
    const e = el()!;
    expect(e.getAttribute('data-testid')).toBe('cal');
    expect(e.getAttribute('aria-label')).toBe('Pick a date');
    expect(e.hasAttribute('aria-hidden')).toBe(false);
    render({ 'data-testid': 'other' });
    expect(e.getAttribute('data-testid')).toBe('other');
    expect(e.hasAttribute('aria-label')).toBe(false);
  });
});

describe('lifecycle', () => {
  it('under StrictMode (mount, unmount, mount) there is exactly one element and one listener', () => {
    const onChange = vi.fn();
    render({ onChange, value: 'v' }, undefined, true);
    expect(container.querySelectorAll('x-stub')).toHaveLength(1);
    el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(el()!.getAttribute('value')).toBe('v');
  });

  it('two components make two independent elements', () => {
    act(() => root.render(createElement('div', null,
      createElement(Comp as never, { value: 'one' } as never),
      createElement(Comp as never, { value: 'two' } as never))));
    const all = [...container.querySelectorAll('x-stub')];
    expect(all.map(e => e.getAttribute('value'))).toEqual(['one', 'two']);
  });

  it('a server render is just the empty wrapper', () => {
    const html = renderToString(createElement(Comp as never, { value: 'x' } as never));
    expect(html).toBe('<div style="display:contents"></div>');
  });
});
