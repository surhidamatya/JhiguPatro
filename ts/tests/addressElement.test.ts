import { describe, it, expect } from 'vitest';
import { JhiguAddressSelect, defineJhiguAddressSelect } from '../src/elements/addressElement.js';

describe('address element in Node', () => {
  it('can be imported without a DOM; defining needs a browser', () => {
    expect(typeof JhiguAddressSelect).toBe('function');
    expect(() => defineJhiguAddressSelect()).toThrow(/customElements/);
  });

  it('observes the documented attributes', () => {
    expect(JhiguAddressSelect.observedAttributes).toEqual(
      expect.arrayContaining(['value', 'ward', 'language', 'show-ward', 'name', 'required', 'disabled', 'theme']),
    );
  });
});
