/**
 * `createJhiguComponent` makes a React component for a custom element, on top of
 * the framework-neutral `ElementBinding` from `jhigu-patro-utils-ts`.
 *
 * The element is created by hand, not by React. React 18 and 19 treat props on
 * custom elements differently (attributes in one, properties in the other, and
 * `className` not at all in 18), and a rerender must never reset what the user
 * typed. So the component renders one `<div style="display: contents">` and, in a
 * layout effect, has the binding create the element, set its attributes *before* it
 * is connected, and append it. Later renders write only the props that changed.
 * Events are `addEventListener` calls that read the latest callback, so changing a
 * callback never re-subscribes. Nothing here depends on the React version.
 *
 * Because the element is made on the client, a server render produces only the
 * empty wrapper; the element appears after hydration.
 */
import { createElement, forwardRef, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ForwardRefExoticComponent, PropsWithoutRef, Ref, RefAttributes } from 'react';
import { ElementBinding, attributeText } from 'jhigu-patro-utils-ts/element-binding';
import type { AttrKind, AttrSpec, ElementSpec } from 'jhigu-patro-utils-ts/element-binding';

export { attributeText };
export type { AttrKind, AttrSpec };
/** What a component needs to know about its element (the same type as `ElementSpec`). */
export type ComponentSpec = ElementSpec;

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

type AnyProps = Record<string, unknown>;

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
    const binding = useRef<ElementBinding<El> | null>(null);
    const latest = useRef<AnyProps>(props as AnyProps);
    latest.current = props as AnyProps;
    const outer = useRef<Ref<El> | undefined>(outerRef);
    outer.current = outerRef;

    // Create the element once and put it in the page.
    useLayoutEffect(() => {
      const b = new ElementBinding<El>(tag, spec);
      const el = b.mount(host.current!, () => latest.current);
      binding.current = b;
      setRef(outer.current, el);
      return () => {
        b.unmount();
        binding.current = null;
        setRef(outer.current, null);
      };
    }, []);

    // Write what changed on every later render.
    useLayoutEffect(() => {
      binding.current?.update(props as AnyProps);
    });

    // A changed `ref` prop gets the element.
    useLayoutEffect(() => {
      if (binding.current?.element) setRef(outerRef, binding.current.element);
    }, [outerRef]);

    return createElement('div', { ref: host, style: { display: 'contents' } });
  });
  Component.displayName = tag;
  // Exposed so a test (or tooling) can compare the mapping with the element's real attributes.
  Object.defineProperty(Component, 'spec', { value: spec, enumerable: false });
  return Component as unknown as ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<El>>;
}
