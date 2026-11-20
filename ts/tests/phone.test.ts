import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePhone, isValidPhone, PhoneError } from '../src/index.js';

const vectors = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../testdata/phone.json'), 'utf8'),
);

describe('parsePhone shared vectors', () => {
  for (const v of vectors.valid) {
    it(`accepts ${JSON.stringify(v.in)}`, () => {
      const r = parsePhone(v.in, { allowInactive: v.allowInactive });
      expect(r.e164).toBe(v.e164);
      expect(r.national).toBe(v.national);
      expect(r.type).toBe(v.type);
      expect(r.carrier).toBe(v.type === 'mobile' ? v.carrier : null);
      expect(r.areaCode).toBe(v.areaCode);
    });
  }

  for (const v of vectors.invalid) {
    it(`rejects ${JSON.stringify(v.in)} with ${v.code}`, () => {
      expect(() => parsePhone(v.in)).toThrow(PhoneError);
      try {
        parsePhone(v.in);
      } catch (e) {
        expect((e as PhoneError).code).toBe(v.code);
      }
      expect(isValidPhone(v.in)).toBe(false);
    });
  }
});

describe('PhoneError', () => {
  it('has English and Nepali messages from the string tables', () => {
    try {
      parsePhone('98412');
    } catch (e) {
      const err = e as PhoneError;
      expect(err.message).toBe('Phone number is too short');
      expect(err.localized('ne')).toBe('फोन नम्बर धेरै छोटो छ');
    }
  });

  it('isValidPhone never throws', () => {
    expect(isValidPhone(undefined as unknown as string)).toBe(false);
    expect(isValidPhone('9841234567')).toBe(true);
  });
});
