import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElementBinding } from 'jhigu-patro-utils-ts/element-binding';
import type { ElementSpec } from 'jhigu-patro-utils-ts/element-binding';

// Tests of the framework-neutral core on its own: no React involved.
class Plain extends HTMLElement {}
if (!customElements.get('x-plain')) customElements.define('x-plain', Plain);

const spec: ElementSpec = {
  attrs: { value: { attr: 'value', kind: 'string' }, disabled: { attr: 'disabled', kind: 'boolean', type: 'boolean' } },
  events: { onChange: 'jhiguChange' },
};

let parent: HTMLDivElement;
beforeEach(() => {
  parent = document.createElement('div');
  document.body.appendChild(parent);
});

describe('ElementBinding lifecycle', () => {
  it('mount creates the element in the parent and returns it', () => {
    const b = new ElementBinding<Plain>('x-plain', spec);
    expect(b.element).toBeNull();
    const el = b.mount(parent, () => ({ value: 'a' }));
    expect(el).toBeInstanceOf(Plain);
    expect(parent.firstElementChild).toBe(el);
    expect(b.element).toBe(el);
    expect(el.getAttribute('value')).toBe('a');
  });

  it('mounting twice without unmounting is an error, and does not add a second element', () => {
    const b = new ElementBinding('x-plain', spec);
    b.mount(parent, () => ({}));
    expect(() => b.mount(parent, () => ({}))).toThrow('already mounted');
    expect(parent.children).toHaveLength(1);
  });

  it('unmount removes the element and is safe to call twice', () => {
    const b = new ElementBinding('x-plain', spec);
    b.mount(parent, () => ({}));
    b.unmount();
    expect(parent.children).toHaveLength(0);
    expect(b.element).toBeNull();
    expect(() => b.unmount()).not.toThrow();
  });

  it('after unmount it can be mounted again, as a fresh element with fresh state', () => {
    const b = new ElementBinding<Plain>('x-plain', spec);
    const first = b.mount(parent, () => ({ value: 'a' }));
    b.unmount();
    const second = b.mount(parent, () => ({ value: 'a' }));
    expect(second).not.toBe(first);
    expect(second.getAttribute('value')).toBe('a'); // written again: the old state was dropped
  });

  it('update before mount, or after unmount, does nothing', () => {
    const b = new ElementBinding('x-plain', spec);
    expect(() => b.update({ value: 'x' })).not.toThrow();
    const el = b.mount(parent, () => ({}));
    b.unmount();
    b.update({ value: 'late' });
    expect(el.hasAttribute('value')).toBe(false);
  });

  it('events stop after unmount', () => {
    const b = new ElementBinding('x-plain', spec);
    const onChange = vi.fn();
    const el = b.mount(parent, () => ({ onChange }));
    el.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }));
    b.unmount();
    el.dispatchEvent(new CustomEvent('jhiguChange', { detail: 2 }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('the callback is looked up per event: the getter can return a different function later', () => {
    const b = new ElementBinding('x-plain', spec);
    let current = vi.fn();
    const el = b.mount(parent, () => ({ onChange: current }));
    const old = current;
    current = vi.fn();
    el.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }));
    expect(old).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
  });

  it('a prop that is not a function is ignored as a callback', () => {
    const b = new ElementBinding('x-plain', spec);
    const el = b.mount(parent, () => ({ onChange: 'not a function' }));
    expect(() => el.dispatchEvent(new CustomEvent('jhiguChange', { detail: 1 }))).not.toThrow();
  });
});
