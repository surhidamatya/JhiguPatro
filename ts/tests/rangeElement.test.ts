import { describe, it, expect } from 'vitest';
import { JhiguDateRangePicker, defineJhiguDateRangePicker } from '../src/elements/rangePickerElement.js';

describe('range picker element in Node', () => {
  it('can be imported without a DOM; defining needs a browser', () => {
    expect(typeof JhiguDateRangePicker).toBe('function');
    expect(() => defineJhiguDateRangePicker()).toThrow(/customElements/);
  });

  it('observes the documented attributes', () => {
    expect(JhiguDateRangePicker.observedAttributes).toEqual(
      expect.arrayContaining(['start', 'end', 'min', 'max', 'language', 'week-starts-on', 'show-ad', 'name', 'disabled', 'required', 'popup', 'theme', 'today']),
    );
  });
});
