import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import type { App } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { ElementSpec } from 'jhigu-patro-utils-ts/element-binding';
import { createJhiguComponent, hostProps, parseStyleText, vueEventName } from '../src/wrap.js';

/** A custom element that records how it was used. */
class Stub extends HTMLElement {
  static instances = 0;
  static connections = 0;
  static atConnect: Record<string, string>[] = [];
  connectedCallback() {
    Stub.connections++;
    Stub.atConnect.push(Object.fromEntries(this.getAttributeNames().map(n => [n, this.getAttribute(n)!])));
  }
  constructor() { super(); Stub.instances++; }
}
if (!customElements.get('x-stub')) customElements.define('x-stub', Stub);

const spec: ElementSpec = {
  attrs: {
    value: { attr: 'value', kind: 'string' },
    weekStartsOn: { attr: 'week-starts-on', kind: 'string', type: 'number' },
    disabled: { attr: 'disabled', kind: 'boolean', type: 'boolean' },
    showAd: { attr: 'show-ad', kind: 'falseOnly', type: 'boolean' },
  },
  properties: ['events'],
  events: { onChange: 'jhiguChange', onMonthChange: 'jhiguMonthChange' },
};
const defineSpy = vi.fn();
const Comp = createJhiguComponent('XStub', 'x-stub', defineSpy, spec);

let container: HTMLDivElement;
let app: App | null;
/** Mount the component with reactive props, so tests can change them and let Vue re-render. */
function mount(initial: Record<string, unknown> = {}, refHolder?: { value: unknown }) {
  const state = reactive<Record<string, unknown>>({ ...initial });
  app = createApp({
    render: () => h(Comp as never, { ...state, ref: (r: unknown) => { if (refHolder) refHolder.value = r; } }),
  });
  app.mount(container);
  return state;
}
const el = () => container.querySelector('x-stub') as Stub | null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  Stub.connections = 0; Stub.atConnect = []; Stub.instances = 0;
  app = null;
});
afterEach(() => {
  app?.unmount();
  container.remove();
});

describe('helpers', () => {
  it('vueEventName: onChange is change, onMonthChange is month-change', () => {
    expect(vueEventName('onChange')).toBe('change');
    expect(vueEventName('onMonthChange')).toBe('month-change');
    expect(vueEventName('onOpen')).toBe('open');
    expect(vueEventName('onSelect')).toBe('select');
  });

  it('parseStyleText reads text styles, keeps custom properties, camel-cases the rest', () => {
    expect(parseStyleText('color: red; background-color: #fff; --jhigu-color-primary: #c00;')).toEqual({
      color: 'red', backgroundColor: '#fff', '--jhigu-color-primary': '#c00',
    });
    expect(parseStyleText('')).toEqual({});
    expect(parseStyleText('nonsense; : x; a:')).toEqual({});
  });

  it('hostProps reads class (any Vue form), style, id, title, slot, hidden, data and aria', () => {
    expect(hostProps({ class: ['a', { b: true, c: false }, 'd'] }).className).toBe('a b d');
    expect(hostProps({ class: 'x y' }).className).toBe('x y');
    expect(hostProps({ class: '' }).className).toBeUndefined();
    expect(hostProps({ style: { color: 'red' } }).style).toEqual({ color: 'red' });
    expect(hostProps({ style: [{ color: 'red' }, { width: '4px' }] }).style).toEqual({ color: 'red', width: '4px' });
    expect(hostProps({ style: 'color: red' }).style).toEqual({ color: 'red' });
    expect(hostProps({ id: 'i', title: 't', slot: 's' })).toMatchObject({ id: 'i', title: 't', slot: 's' });
    expect(hostProps({ hidden: '' }).hidden).toBe(true);
    expect(hostProps({ hidden: false }).hidden).toBeUndefined();
    expect(hostProps({ 'data-x': 1, 'aria-label': 'L', other: 'dropped', onClick: () => {} })).toEqual({ 'data-x': 1, 'aria-label': 'L' });
  });
});

describe('creating the element', () => {
  it('registers the element once at import', () => {
    expect(defineSpy).toHaveBeenCalledTimes(1);
  });

  it('renders one wrapper that takes no space, with the element inside', () => {
    mount();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.style.display).toBe('contents');
    expect(wrapper.children).toHaveLength(1);
    expect(el()).toBeInstanceOf(Stub);
  });

  it('sets the attributes before the element is connected: one build, not one per attribute', () => {
    mount({ value: '2082-05-10', weekStartsOn: 0, disabled: true, showAd: false });
    expect(Stub.connections).toBe(1);
    expect(Stub.atConnect[0]).toEqual({ value: '2082-05-10', 'week-starts-on': '0', disabled: '', 'show-ad': 'false' });
  });

  it('a Boolean prop that is not given is NOT turned into false by Vue (showAd stays on)', () => {
    mount({});
    expect(Stub.atConnect[0]).toEqual({});
    expect(el()!.hasAttribute('show-ad')).toBe(false);
    expect(el()!.hasAttribute('disabled')).toBe(false);
  });

  it('numbers for number props and booleans for boolean props give no Vue warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount({ weekStartsOn: 1, disabled: true, showAd: false, value: 'v' });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a bare boolean attribute in a template ("") means true', () => {
    mount({ disabled: '' });
    expect(el()!.getAttribute('disabled')).toBe('');
  });

  it('assigns the object property before connecting, and only when given', () => {
    const events = { '2082-05-12': ['Teej'] };
    mount({ events });
    expect((el() as unknown as { events: unknown }).events).toBe(events);
    app!.unmount();
    mount({});
    expect((el() as unknown as { events?: unknown }).events).toBeUndefined();
  });

  it('an object property changes only when the parent passes a different object', async () => {
    const first = { '2082-05-12': ['Teej'] };
    const state = mount({ events: first });
    const e = el() as unknown as { events: unknown };
    const desc = vi.fn();
    Object.defineProperty(e, 'events', { set: desc, get: () => first, configurable: true });
    state.value = 'unrelated change';
    await nextTick();
    expect(desc).not.toHaveBeenCalled();
    const second = { '2082-06-03': ['Laxmi Puja'] };
    state.events = second;
    await nextTick();
    expect(desc).toHaveBeenCalledTimes(1);
    expect(desc.mock.calls[0][0]).toEqual(second);
    expect(desc.mock.calls[0][0]).toBe(second); // the plain object, not a proxy
  });

  it('does not forward callbacks or unknown props as attributes', () => {
    mount({ onChange: () => {}, mystery: 'x', value: 'v' });
    expect(el()!.getAttributeNames().sort()).toEqual(['value']);
  });
});

describe('updating', () => {
  it('writes only what changed', async () => {
    const state = mount({ value: 'a', weekStartsOn: 1 });
    const spySet = vi.spyOn(el()!, 'setAttribute');
    const spyRemove = vi.spyOn(el()!, 'removeAttribute');
    state.value = 'a';
    await nextTick();
    expect(spySet).not.toHaveBeenCalled();
    state.value = 'b';
    await nextTick();
    expect(spySet).toHaveBeenCalledTimes(1);
    expect(spySet).toHaveBeenCalledWith('value', 'b');
    expect(spyRemove).not.toHaveBeenCalled();
    expect(el()!.getAttribute('value')).toBe('b');
  });

  it('the same element stays: updates do not recreate it', async () => {
    const state = mount({ value: 'a' });
    const first = el();
    state.value = 'b';
    state.disabled = true;
    await nextTick();
    expect(el()).toBe(first);
    expect(Stub.instances).toBe(1);
    expect(Stub.connections).toBe(1);
  });

  it('removes an attribute when the prop becomes undefined or false', async () => {
    const state = mount({ value: 'a', disabled: true, showAd: false });
    state.value = undefined;
    state.disabled = false;
    state.showAd = undefined;
    await nextTick();
    expect(el()!.getAttributeNames()).toEqual([]);
  });

  it('a user edit inside the element is not overwritten by an unrelated update', async () => {
    const state = mount({ value: 'a' });
    el()!.setAttribute('value', 'typed by the user');
    state.disabled = true;
    await nextTick();
    expect(el()!.getAttribute('value')).toBe('typed by the user');
    expect(el()!.getAttribute('disabled')).toBe('');
  });
});

describe('events', () => {
  it('emits the Vue event with the detail first and the DOM event second', () => {
    const onChange = vi.fn();
    mount({ onChange });
    const ev = new CustomEvent('jhiguChange', { detail: { bs: '2082-05-10' }, bubbles: true, composed: true });
    el()!.dispatchEvent(ev);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({ bs: '2082-05-10' });
    expect(onChange.mock.calls[0][1]).toBe(ev);
  });

  it('a hyphenated event reaches the camelCase handler: month-change calls onMonthChange', () => {
    const onMonthChange = vi.fn();
    const onChange = vi.fn();
    mount({ onMonthChange, onChange });
    el()!.dispatchEvent(new CustomEvent('jhiguMonthChange', { detail: { year: 2082, month: 6 } }));
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls the latest handler after the parent passes a different one', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const state = mount({ onChange: first });
    state.onChange = second;
    await nextTick();
    el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe again when a handler changes', async () => {
    const state = mount({ onChange: () => {} });
    const spyAdd = vi.spyOn(el()!, 'addEventListener');
    state.onChange = () => {};
    await nextTick();
    expect(spyAdd).not.toHaveBeenCalled();
  });

  it('an event with no handler is fine', () => {
    mount({});
    expect(() => el()!.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }))).not.toThrow();
  });

  it('removes its listeners when unmounted', () => {
    mount({ onChange: () => {} });
    const spyRemove = vi.spyOn(el()!, 'removeEventListener');
    app!.unmount();
    app = null;
    expect(spyRemove.mock.calls.map(c => c[0]).sort()).toEqual(['jhiguChange', 'jhiguMonthChange']);
  });

  it('stops listening and removes the element when unmounted', () => {
    const onChange = vi.fn();
    mount({ onChange });
    const node = el()!;
    app!.unmount();
    app = null;
    node.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }));
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('x-stub')).toBeNull();
  });
});

describe('ref', () => {
  it('the component ref exposes the custom element', () => {
    const holder: { value: unknown } = { value: null };
    mount({}, holder);
    expect((holder.value as { element: unknown }).element).toBe(el());
  });
});

describe('fallthrough attributes go to the element, not the wrapper', () => {
  it('class, style, id, title, slot, hidden, data-* and aria-*', () => {
    mount({ class: ['a', { b: true }], style: { color: 'red', '--jhigu-color-primary': '#c00' }, id: 'x', title: 'T', slot: 's', hidden: '', 'data-testid': 'cal', 'aria-label': 'Pick' });
    const e = el()!;
    expect(e.getAttribute('class')).toBe('a b');
    expect(e.style.color).toBe('red');
    expect(e.style.getPropertyValue('--jhigu-color-primary')).toBe('#c00');
    expect(e.id).toBe('x');
    expect(e.title).toBe('T');
    expect(e.getAttribute('slot')).toBe('s');
    expect(e.hasAttribute('hidden')).toBe(true);
    expect(e.getAttribute('data-testid')).toBe('cal');
    expect(e.getAttribute('aria-label')).toBe('Pick');
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.hasAttribute('class')).toBe(false);
    expect(wrapper.id).toBe('');
    expect(wrapper.getAttribute('data-testid')).toBeNull();
  });

  it('a changed class or style is applied (Vue attrs are not reactive, so this needs the update hook)', async () => {
    const state = mount({ class: 'a', style: { color: 'red' } });
    state.class = 'b c';
    state.style = { color: 'blue', '--x': '1' };
    await nextTick();
    expect(el()!.getAttribute('class')).toBe('b c');
    expect(el()!.style.color).toBe('blue');
    expect(el()!.style.getPropertyValue('--x')).toBe('1');
    state.style = undefined;
    state.class = undefined;
    await nextTick();
    expect(el()!.hasAttribute('class')).toBe(false);
    expect(el()!.style.color).toBe('');
    expect(el()!.style.getPropertyValue('--x')).toBe('');
  });

  it('a changed data attribute is applied and a removed one is removed', async () => {
    const state = mount({ 'data-x': '1' });
    state['data-x'] = '2';
    await nextTick();
    expect(el()!.getAttribute('data-x')).toBe('2');
    delete state['data-x'];
    await nextTick();
    expect(el()!.hasAttribute('data-x')).toBe(false);
  });
});

describe('lifecycle', () => {
  it('two components make two independent elements', () => {
    app = createApp({ render: () => h('div', [h(Comp as never, { value: 'one' }), h(Comp as never, { value: 'two' })]) });
    app.mount(container);
    expect([...container.querySelectorAll('x-stub')].map(e => e.getAttribute('value'))).toEqual(['one', 'two']);
  });

  it('removing the component (v-if) removes its element', async () => {
    const show = reactive({ on: true });
    app = createApp(defineComponent({ render: () => (show.on ? h(Comp as never, { value: 'x' }) : null) }));
    app.mount(container);
    expect(el()).not.toBeNull();
    show.on = false;
    await nextTick();
    expect(el()).toBeNull();
  });

  it('a server render is just the empty wrapper', async () => {
    const html = await renderToString(createApp({ render: () => h(Comp as never, { value: 'x' }) }));
    expect(html.replace(/\s/g, '')).toBe('<divstyle="display:contents;"></div>');
  });
});
