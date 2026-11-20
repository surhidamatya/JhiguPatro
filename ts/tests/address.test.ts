import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AddressError,
  districtsOf,
  formatAddress,
  getDistrict,
  getLocalLevel,
  getProvince,
  localLevelsOf,
  provinces,
  searchAddress,
} from '../src/address.js';
import { addressDistricts, addressLocalLevels } from '../src/generated/address.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const vectors = read('../../testdata/address.json');
const data = read('../../data/address.json');

describe('address data', () => {
  it('generated data matches data/address.json', () => {
    expect(provinces().length).toBe(vectors.counts.provinces);
    expect(addressDistricts.length).toBe(vectors.counts.districts);
    expect(addressLocalLevels.length).toBe(vectors.counts.localLevels);
    expect(addressLocalLevels[306]).toEqual(data.localLevels[306]);
  });

  it('children counts', () => {
    for (const [id, n] of Object.entries(vectors.counts.districtsOfProvince)) {
      expect(districtsOf(+id).length).toBe(n);
    }
    for (const [id, n] of Object.entries(vectors.counts.localLevelsOfDistrict)) {
      expect(localLevelsOf(+id).length).toBe(n);
    }
    expect(districtsOf(vectors.unknownParent.districtsOf)).toEqual([]);
    expect(localLevelsOf(vectors.unknownParent.localLevelsOf)).toEqual([]);
  });

  it('every parent link resolves', () => {
    for (const d of addressDistricts) expect(getProvince(d.provinceId)).toBeDefined();
    for (const m of addressLocalLevels) expect(getDistrict(m.districtId)).toBeDefined();
    expect(getLocalLevel(307)?.wards).toBe(32);
    expect(getLocalLevel(0)).toBeUndefined();
  });
});

describe('formatAddress shared vectors', () => {
  for (const v of vectors.format.valid) {
    it(`${v.language} ${JSON.stringify(v.parts)}`, () => {
      expect(formatAddress(v.parts, v.language)).toBe(v.out);
    });
  }
  for (const v of vectors.format.invalid) {
    it(`rejects ${JSON.stringify(v.parts)} with ${v.code}`, () => {
      try {
        formatAddress(v.parts);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(AddressError);
        expect((e as AddressError).code).toBe(v.code);
      }
    });
  }
  it('localizes error messages', () => {
    const e = new AddressError('BAD_WARD');
    expect(e.message).toBe(e.localized('en'));
    expect(e.localized('ne')).not.toBe(e.localized('en'));
  });
  it('defaults to English', () => {
    expect(formatAddress({ localLevelId: 1, ward: 2 })).toBe(
      'Ward 2, Shadanand Municipality, Bhojpur, Koshi Province',
    );
  });
});

describe('searchAddress shared vectors', () => {
  for (const v of vectors.search) {
    it(`${JSON.stringify(v.query)} ${JSON.stringify({ language: v.language, limit: v.limit })}`, () => {
      const got = searchAddress(v.query, { language: v.language, limit: v.limit }).map(
        m => [m.kind, m.id, m.matchedOn, m.rank],
      );
      expect(got).toEqual(v.expect);
    });
  }
  it('results carry both names', () => {
    const [m] = searchAddress('pokhara');
    expect(m.en).toBe('Pokhara Metropolitan City');
    expect(m.ne).toBe('पोखरा महानगरपालिका');
  });
});
