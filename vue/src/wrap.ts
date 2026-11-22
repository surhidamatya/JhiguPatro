/**
 * `createJhiguComponent` makes a Vue 3 component for a custom element, on top of the
 * framework-neutral `ElementBinding` from `jhigu-patro-utils-ts`.
 *
 * The component renders one `<div style="display: contents">` and, once mounted,
 * has the binding create the element, set its attributes before it is connected,
 * and append it. After that a reactive effect writes only the props that changed,
 * so a re-render never resets a field the user has typed in. The element's events
 * become Vue events (`@change`, `@select`, `@month-change`, `@open`, `@close`) whose
 * first argument is the event's `detail`.
 *
 * Fallthrough attributes (`class`, `style`, `id`, `title`, `hidden`, `slot`,
 * `data-*`, `aria-*`) are applied to the element itself, not to the wrapper.
 * Client only: the element is created on mount, so a server render has the empty
 * wrapper.
 */
import {
  defineComponent, h, normalizeClass, normalizeStyle, onBeforeUnmount, onMounted, onUpdated, ref, toRaw,
} from 'vue';
import type { PropType, SetupContext } from 'vue';
import { ElementBinding } from 'jhigu-patro-utils-ts/element-binding';
import type { ElementSpec, PropValueType } from 'jhigu-patro-utils-ts/element-binding';

type AnyProps = Record<string, unknown>;

/** `onChange` becomes the Vue event `change`; `onMonthChange` becomes `month-change`. */
export function vueEventName(prop: string): string {
  return prop.replace(/^on/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

const CONSTRUCTORS = { string: String, number: Number, boolean: Boolean, object: Object } as const;

/** Vue prop options for a value type. Booleans default to `undefined`, not Vue's `false`. */
function propOptions(type: PropValueType) {
  // A Boolean prop that is absent is cast to `false` by Vue unless it has a default;
  // `showAd` and `showWard` default to on, so "not given" must stay `undefined`.
  return { type: CONSTRUCTORS[type] as unknown as PropType<unknown>, default: undefined };
}

/** Read an inline style given as text (`"color: red; width: 4px"`) into an object. */
export function parseStyleText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(';')) {
    const i = part.indexOf(':');
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key || !value) continue;
    // Custom properties keep their name; others become camelCase for `element.style`.
    out[key.startsWith('--') ? key : key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return out;
}

/** The host props (class, style, id, ...) found in Vue's fallthrough attributes. */
export function hostProps(attrs: AnyProps): AnyProps {
  const out: AnyProps = {};
  if (attrs.class !== undefined) {
    const cls = normalizeClass(attrs.class);
    if (cls) out.className = cls;
  }
  if (attrs.style !== undefined) {
    const style = normalizeStyle(attrs.style);
    out.style = typeof style === 'string' ? parseStyleText(style) : style;
  }
  for (const key of ['id', 'title', 'slot']) if (attrs[key] !== undefined) out[key] = attrs[key];
  // `hidden` as a bare attribute arrives as '' (present) and means hidden.
  if (attrs.hidden !== undefined && attrs.hidden !== false) out.hidden = true;
  for (const [key, value] of Object.entries(attrs)) if (/^(data|aria)-/.test(key)) out[key] = value;
  return out;
}

/**
 * A Vue component for the custom element [tag]. [define] registers the element
 * (called once, in a browser only). Props are [spec]'s props; the element is
 * available as `ref.value.element` on a template ref.
 */
export function createJhiguComponent(name: string, tag: string, define: () => unknown, spec: ElementSpec) {
  // Server rendering has no customElements; the component still renders its wrapper.
  if (typeof customElements !== 'undefined') define();

  const props: Record<string, ReturnType<typeof propOptions>> = {};
  for (const [prop, a] of Object.entries(spec.attrs)) props[prop] = propOptions(a.type ?? 'string');
  for (const prop of spec.properties ?? []) props[prop] = propOptions('object');
  const eventNames = Object.fromEntries(Object.keys(spec.events).map(p => [p, vueEventName(p)]));

  const Component = defineComponent({
    name,
    // The fallthrough attributes belong to the custom element, not to the wrapper div.
    inheritAttrs: false,
    props,
    emits: Object.values(eventNames),
    setup(vueProps, { emit, attrs, expose }: SetupContext) {
      const host = ref<HTMLElement | null>(null);
      const binding = new ElementBinding(tag, spec);

      // Callbacks the binding looks up per event: each one re-emits as a Vue event.
      const handlers: AnyProps = {};
      for (const [prop, vueName] of Object.entries(eventNames)) {
        handlers[prop] = (detail: unknown, event: Event) => emit(vueName, detail, event);
      }
      const collect = (): AnyProps => {
        const out: AnyProps = { ...vueProps, ...hostProps(attrs), ...handlers };
        // An object prop may arrive as a reactive proxy; the element gets the plain object.
        for (const prop of spec.properties ?? []) {
          if (out[prop] !== undefined && out[prop] !== null) out[prop] = toRaw(out[prop] as object);
        }
        return out;
      };

      onMounted(() => binding.mount(host.value!, collect));
      onBeforeUnmount(() => binding.unmount());
      // A changed prop or attribute makes the parent re-render this component, and this
      // runs after it. (Vue's `attrs` is not reactive, so an effect could not see them.)
      onUpdated(() => binding.update(collect()));

      expose({
        get element() {
          return binding.element;
        },
      });
      return () => h('div', { ref: host, style: { display: 'contents' } });
    },
  });
  return Component;
}
