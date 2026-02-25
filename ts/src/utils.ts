/** Create a DOM element with a given tag and class name. */
export function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
