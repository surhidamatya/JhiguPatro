/**
 * Nepal address data and search (guide section 11). Pure logic, no network.
 * Data comes from data/address.json via src/generated/address.ts and is not
 * exported from the main entry point: import from `jhigu-patro-utils-ts/address`
 * so the data is only bundled when used. Indexes are built on first use.
 *
 * Known divergence from the Dart port: search normalises the query to Unicode
 * NFC here; Dart has no normaliser in its core library and does not.
 */
import {
  addressDistricts,
  addressLocalLevels,
  addressProvinces,
} from './generated/address.js';
import type {
  AddressDistrict,
  AddressLocalLevel,
  AddressLocalLevelType,
  AddressProvince,
} from './generated/address.js';
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';

export type {
  AddressDistrict,
  AddressLocalLevel,
  AddressLocalLevelType,
  AddressProvince,
  Language,
};

export type AddressErrorCode =
  | 'UNKNOWN_PROVINCE'
  | 'UNKNOWN_DISTRICT'
  | 'UNKNOWN_LOCAL_LEVEL'
  | 'BAD_WARD';

const MESSAGE_KEY = {
  UNKNOWN_PROVINCE: 'unknownProvince',
  UNKNOWN_DISTRICT: 'unknownDistrict',
  UNKNOWN_LOCAL_LEVEL: 'unknownLocalLevel',
  BAD_WARD: 'badWard',
} as const;

/** Typed address error. `message` is English; use `localized()` for ne. */
export class AddressError extends Error {
  constructor(public readonly code: AddressErrorCode) {
    super(getStrings('en').address[MESSAGE_KEY[code]]);
    this.name = 'AddressError';
  }

  localized(language: Language): string {
    return getStrings(language).address[MESSAGE_KEY[this.code]];
  }
}

// ── Lookups ──────────────────────────────────────────────────────────────────

interface Index {
  province: Map<number, AddressProvince>;
  district: Map<number, AddressDistrict>;
  localLevel: Map<number, AddressLocalLevel>;
  districtsByProvince: Map<number, AddressDistrict[]>;
  localLevelsByDistrict: Map<number, AddressLocalLevel[]>;
}

let index: Index | undefined;

function getIndex(): Index {
  if (index) return index;
  const districtsByProvince = new Map<number, AddressDistrict[]>();
  for (const d of addressDistricts) {
    const list = districtsByProvince.get(d.provinceId);
    if (list) list.push(d);
    else districtsByProvince.set(d.provinceId, [d]);
  }
  const localLevelsByDistrict = new Map<number, AddressLocalLevel[]>();
  for (const m of addressLocalLevels) {
    const list = localLevelsByDistrict.get(m.districtId);
    if (list) list.push(m);
    else localLevelsByDistrict.set(m.districtId, [m]);
  }
  index = {
    province: new Map(addressProvinces.map(p => [p.id, p])),
    district: new Map(addressDistricts.map(d => [d.id, d])),
    localLevel: new Map(addressLocalLevels.map(m => [m.id, m])),
    districtsByProvince,
    localLevelsByDistrict,
  };
  return index;
}

/** All 7 provinces. */
export function provinces(): readonly AddressProvince[] {
  return addressProvinces;
}

/** Districts of a province, in data order. Empty for an unknown id. */
export function districtsOf(provinceId: number): readonly AddressDistrict[] {
  return getIndex().districtsByProvince.get(provinceId) ?? [];
}

/** Local levels of a district, in data order. Empty for an unknown id. */
export function localLevelsOf(districtId: number): readonly AddressLocalLevel[] {
  return getIndex().localLevelsByDistrict.get(districtId) ?? [];
}

export function getProvince(id: number): AddressProvince | undefined {
  return getIndex().province.get(id);
}

export function getDistrict(id: number): AddressDistrict | undefined {
  return getIndex().district.get(id);
}

export function getLocalLevel(id: number): AddressLocalLevel | undefined {
  return getIndex().localLevel.get(id);
}

// ── Search ───────────────────────────────────────────────────────────────────

export type AddressKind = 'province' | 'district' | 'localLevel';
export type AddressMatchRank = 'exact' | 'prefix' | 'substring';
export type AddressSearchLanguage = 'en' | 'ne' | 'auto';

export interface AddressSearchOptions {
  /** Which name to search. `auto` searches both. Default `auto`. */
  language?: AddressSearchLanguage;
  /** Maximum results. Default 10. */
  limit?: number;
}

export interface AddressMatch {
  kind: AddressKind;
  id: number;
  en: string;
  ne: string;
  /** Which name matched. */
  matchedOn: 'en' | 'ne';
  rank: AddressMatchRank;
}

interface Entry {
  kind: AddressKind;
  id: number;
  en: string;
  ne: string;
  enLower: string;
}

const KIND_ORDER: Record<AddressKind, number> = { province: 0, district: 1, localLevel: 2 };
const RANK_ORDER: Record<AddressMatchRank, number> = { exact: 0, prefix: 1, substring: 2 };

let entries: Entry[] | undefined;

function getEntries(): Entry[] {
  if (entries) return entries;
  const mk = (kind: AddressKind, r: { id: number; en: string; ne: string }): Entry => ({
    kind, id: r.id, en: r.en, ne: r.ne, enLower: r.en.toLowerCase(),
  });
  entries = [
    ...addressProvinces.map(r => mk('province', r)),
    ...addressDistricts.map(r => mk('district', r)),
    ...addressLocalLevels.map(r => mk('localLevel', r)),
  ];
  return entries;
}

function rankOf(haystack: string, needle: string): AddressMatchRank | null {
  if (haystack === needle) return 'exact';
  if (haystack.startsWith(needle)) return 'prefix';
  if (haystack.includes(needle)) return 'substring';
  return null;
}

/**
 * Search provinces, districts and local levels by name.
 *
 * The query is trimmed; English is compared lower-case and Nepali after NFC.
 * Ranking: exact, then prefix, then substring; ties by matched-name length,
 * then province before district before local level, then id.
 */
export function searchAddress(query: string, options: AddressSearchOptions = {}): AddressMatch[] {
  const language = options.language ?? 'auto';
  const limit = options.limit ?? 10;
  const q = query.normalize('NFC').trim();
  if (!q || limit < 1) return [];
  const qEn = q.toLowerCase();

  const found: Array<{ m: AddressMatch; len: number }> = [];
  for (const e of getEntries()) {
    let best: { on: 'en' | 'ne'; rank: AddressMatchRank; len: number } | null = null;
    if (language !== 'ne') {
      const rank = rankOf(e.enLower, qEn);
      if (rank) best = { on: 'en', rank, len: e.en.length };
    }
    if (language !== 'en') {
      const rank = rankOf(e.ne, q);
      if (rank && (!best || RANK_ORDER[rank] < RANK_ORDER[best.rank])) {
        best = { on: 'ne', rank, len: e.ne.length };
      } else if (rank && best && rank === best.rank && e.ne.length < best.len) {
        best = { on: 'ne', rank, len: e.ne.length };
      }
    }
    if (best) {
      found.push({
        m: { kind: e.kind, id: e.id, en: e.en, ne: e.ne, matchedOn: best.on, rank: best.rank },
        len: best.len,
      });
    }
  }
  found.sort((a, b) =>
    RANK_ORDER[a.m.rank] - RANK_ORDER[b.m.rank] ||
    a.len - b.len ||
    KIND_ORDER[a.m.kind] - KIND_ORDER[b.m.kind] ||
    a.m.id - b.m.id,
  );
  return found.slice(0, limit).map(f => f.m);
}

// ── Format ───────────────────────────────────────────────────────────────────

export interface AddressParts {
  localLevelId: number;
  /** 1..wards of the local level. */
  ward: number;
  tole?: string;
  street?: string;
}

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const digits = (n: number, language: Language) =>
  language === 'ne' ? String(n).replace(/\d/g, d => NE_DIGITS[+d]) : String(n);

/**
 * Format an address as `Street, Tole, Ward N, Local Level, District, Province`
 * (empty street and tole are skipped). Nepali output uses Nepali names and
 * Devanagari ward digits. Throws AddressError for an unknown local level or a
 * ward outside 1..wards.
 */
export function formatAddress(parts: AddressParts, language: Language = 'en'): string {
  const ll = getLocalLevel(parts.localLevelId);
  if (!ll) throw new AddressError('UNKNOWN_LOCAL_LEVEL');
  if (!Number.isInteger(parts.ward) || parts.ward < 1 || parts.ward > ll.wards) {
    throw new AddressError('BAD_WARD');
  }
  const district = getDistrict(ll.districtId)!;
  const province = getProvince(district.provinceId)!;
  const ward = getStrings(language).address.ward.replace('{n}', digits(parts.ward, language));
  return [
    parts.street?.trim(),
    parts.tole?.trim(),
    ward,
    ll[language],
    district[language],
    province[language],
  ].filter((s): s is string => !!s).join(', ');
}
