/**
 * Headless address picker (guide 11.5, 15.1): a framework-free state machine for
 * a province, district, local level and ward select. No DOM, no React.
 *
 *   const picker = createAddressPicker({ language: 'ne' });
 *   picker.subscribe(state => render(state));
 *   picker.actions.selectProvince(3);
 *
 * Rules:
 *  - Choosing a province clears district, local level and ward.
 *  - Choosing a district clears local level and ward.
 *  - Choosing a local level clears the ward (ward ranges differ per local level).
 *  - Choosing a child with no parent chosen fills the parents from the data,
 *    so a saved local level can be restored in one call.
 *  - Ward is 1..wards of the local level.
 *  - Every action that changes the state notifies subscribers once, with the
 *    full state. An action that changes nothing does not notify.
 *  - Invalid ids or wards throw AddressError and leave the state unchanged.
 *
 * Import from `jhigu-patro-utils-ts/address-picker`.
 */
import {
  AddressError,
  districtsOf,
  getDistrict,
  getLocalLevel,
  getProvince,
  localLevelsOf,
  provinces,
} from './address.js';
import type {
  AddressDistrict,
  AddressLocalLevel,
  AddressProvince,
  Language,
} from './address.js';

export interface AddressSelection {
  provinceId: number;
  districtId: number;
  localLevelId: number;
  /** Null when the picker was created with `showWard: false` and no ward is set. */
  ward: number | null;
}

export interface AddressPickerOptions {
  /** Restore a saved selection. Throws AddressError if it is not valid. */
  value?: { localLevelId: number; ward?: number | null } | null;
  /** Language the widget shows names in (`item[state.language]`). Default `en`. */
  language?: Language;
  /** Require a ward for the selection to be complete. Default true. */
  showWard?: boolean;
}

export interface AddressPickerState {
  language: Language;
  showWard: boolean;
  provinceId: number | null;
  districtId: number | null;
  localLevelId: number | null;
  ward: number | null;
  /** Always all provinces. */
  provinces: readonly AddressProvince[];
  /** Districts of the chosen province; empty until one is chosen. */
  districts: readonly AddressDistrict[];
  /** Local levels of the chosen district; empty until one is chosen. */
  localLevels: readonly AddressLocalLevel[];
  /** `[1..wards]` of the chosen local level; empty until one is chosen. */
  wards: readonly number[];
  /** True when a local level is chosen and, if `showWard`, a ward too. */
  complete: boolean;
  /** The full selection when complete, else null. */
  selection: AddressSelection | null;
}

export interface AddressPickerActions {
  /** Null clears the province and everything below it. */
  selectProvince(id: number | null): void;
  selectDistrict(id: number | null): void;
  selectLocalLevel(id: number | null): void;
  /** Null clears the ward. Throws BAD_WARD outside 1..wards or with no local level. */
  selectWard(ward: number | null): void;
  /** Clear everything. */
  clear(): void;
  setLanguage(language: Language): void;
}

export interface AddressPicker {
  getState(): AddressPickerState;
  /** Returns an unsubscribe function. */
  subscribe(listener: (state: AddressPickerState) => void): () => void;
  actions: AddressPickerActions;
}

interface Core {
  provinceId: number | null;
  districtId: number | null;
  localLevelId: number | null;
  ward: number | null;
}

const wardList = (n: number): readonly number[] => Array.from({ length: n }, (_, i) => i + 1);
const wardCache = new Map<number, readonly number[]>();
const wardsFor = (n: number) => {
  let list = wardCache.get(n);
  if (!list) wardCache.set(n, (list = wardList(n)));
  return list;
};

export function createAddressPicker(options: AddressPickerOptions = {}): AddressPicker {
  const showWard = options.showWard ?? true;
  let language: Language = options.language ?? 'en';
  let core: Core = { provinceId: null, districtId: null, localLevelId: null, ward: null };

  const resolve = (c: Core): AddressPickerState => {
    const ll = c.localLevelId === null ? undefined : getLocalLevel(c.localLevelId);
    const complete = c.localLevelId !== null && (!showWard || c.ward !== null);
    return {
      language,
      showWard,
      ...c,
      provinces: provinces(),
      districts: c.provinceId === null ? [] : districtsOf(c.provinceId),
      localLevels: c.districtId === null ? [] : localLevelsOf(c.districtId),
      wards: ll ? wardsFor(ll.wards) : [],
      complete,
      selection: complete
        ? { provinceId: c.provinceId!, districtId: c.districtId!, localLevelId: c.localLevelId!, ward: c.ward }
        : null,
    };
  };

  const fromLocalLevel = (id: number, ward: number | null): Core => {
    const ll = getLocalLevel(id);
    if (!ll) throw new AddressError('UNKNOWN_LOCAL_LEVEL');
    if (ward !== null && (!Number.isInteger(ward) || ward < 1 || ward > ll.wards)) {
      throw new AddressError('BAD_WARD');
    }
    const district = getDistrict(ll.districtId)!;
    return { provinceId: district.provinceId, districtId: ll.districtId, localLevelId: id, ward };
  };

  if (options.value) core = fromLocalLevel(options.value.localLevelId, options.value.ward ?? null);

  let state = resolve(core);
  const listeners = new Set<(s: AddressPickerState) => void>();

  /** Apply a new core or language; notify once if anything changed. */
  const commit = (next: Core, nextLanguage: Language = language) => {
    const same =
      next.provinceId === core.provinceId &&
      next.districtId === core.districtId &&
      next.localLevelId === core.localLevelId &&
      next.ward === core.ward &&
      nextLanguage === language;
    if (same) return;
    core = next;
    language = nextLanguage;
    state = resolve(core);
    for (const l of [...listeners]) l(state);
  };

  const actions: AddressPickerActions = {
    selectProvince(id) {
      if (id === null) return commit({ provinceId: null, districtId: null, localLevelId: null, ward: null });
      if (!getProvince(id)) throw new AddressError('UNKNOWN_PROVINCE');
      if (id === core.provinceId) return;
      commit({ provinceId: id, districtId: null, localLevelId: null, ward: null });
    },
    selectDistrict(id) {
      if (id === null) return commit({ ...core, districtId: null, localLevelId: null, ward: null });
      const d = getDistrict(id);
      if (!d) throw new AddressError('UNKNOWN_DISTRICT');
      if (id === core.districtId) return;
      commit({ provinceId: d.provinceId, districtId: id, localLevelId: null, ward: null });
    },
    selectLocalLevel(id) {
      if (id === null) return commit({ ...core, localLevelId: null, ward: null });
      const next = fromLocalLevel(id, null);
      if (id === core.localLevelId) return;
      commit(next);
    },
    selectWard(ward) {
      if (ward === null) return commit({ ...core, ward: null });
      const ll = core.localLevelId === null ? undefined : getLocalLevel(core.localLevelId);
      if (!ll || !Number.isInteger(ward) || ward < 1 || ward > ll.wards) throw new AddressError('BAD_WARD');
      commit({ ...core, ward });
    },
    clear() {
      commit({ provinceId: null, districtId: null, localLevelId: null, ward: null });
    },
    setLanguage(next) {
      commit(core, next);
    },
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    actions,
  };
}
