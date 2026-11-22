#!/usr/bin/env node
/**
 * Generates typed TypeScript and Dart files from data/*.json (guide 5.4).
 * Currently: strings.{en,ne}.json, phone-prefixes.json, address.json, nepali-numbers.json.
 *
 *   node tools/gen-data/gen.mjs           write generated files
 *   node tools/gen-data/gen.mjs --check   fail if committed files are stale
 *
 * Never edit the generated files by hand.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));

const HEADER = (src) => `GENERATED FILE. DO NOT EDIT. Source: ${src}. Run: node tools/gen-data/gen.mjs`;
const en = read('data/strings.en.json');
const ne = read('data/strings.ne.json');

const cap = s => s[0].toUpperCase() + s.slice(1);
const isObj = v => typeof v === 'object' && v !== null && !Array.isArray(v);

// ── TypeScript ───────────────────────────────────────────────────────────────
function ts() {
  const lit = (v, ind) => {
    const pad = '  '.repeat(ind + 1), end = '  '.repeat(ind);
    if (Array.isArray(v)) return `[${v.map(x => JSON.stringify(x)).join(', ')}]`;
    if (isObj(v)) {
      return `{\n${Object.entries(v).map(([k, x]) => `${pad}${k}: ${lit(x, ind + 1)},`).join('\n')}\n${end}}`;
    }
    return JSON.stringify(v);
  };
  const type = (v, ind) => {
    const pad = '  '.repeat(ind + 1), end = '  '.repeat(ind);
    if (Array.isArray(v)) return 'readonly string[]';
    if (isObj(v)) {
      return `{\n${Object.entries(v).map(([k, x]) => `${pad}readonly ${k}: ${type(x, ind + 1)};`).join('\n')}\n${end}}`;
    }
    return 'string';
  };
  return `// ${HEADER('data/strings.*.json')}

export type Language = 'en' | 'ne';

export interface Strings ${type(en, 0)}

export const stringsEn: Strings = ${lit(en, 0)};

export const stringsNe: Strings = ${lit(ne, 0)};

/** Label table for a language. */
export function getStrings(language: Language): Strings {
  return language === 'ne' ? stringsNe : stringsEn;
}
`;
}

// ── Dart ─────────────────────────────────────────────────────────────────────
const dq = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;

function dart() {
  const classes = [];
  // Returns the Dart type name for value v at path (class emitted for objects).
  const cls = (name, obj) => {
    const fields = Object.entries(obj).map(([k, v]) => {
      const t = Array.isArray(v) ? 'List<String>' : isObj(v) ? cls(name + cap(k), v) : 'String';
      return [k, t];
    });
    classes.push(`/// Strings group \`${name}\`.
class ${name} {
${fields.map(([k, t]) => `  final ${t} ${k};`).join('\n')}

  const ${name}({
${fields.map(([k]) => `    required this.${k},`).join('\n')}
  });
}`);
    return name;
  };
  cls('JhiguStrings', en);

  const val = (v, ind, name) => {
    const pad = '  '.repeat(ind + 1), end = '  '.repeat(ind);
    if (Array.isArray(v)) return `[${v.map(dq).join(', ')}]`;
    if (isObj(v)) {
      return `${name}(\n${Object.entries(v).map(([k, x]) => `${pad}${k}: ${val(x, ind + 1, name + cap(k))},`).join('\n')}\n${end})`;
    }
    return dq(v);
  };
  const inst = (id, data) => `const ${id} = ${val(data, 0, 'JhiguStrings')};`;

  return `// ${HEADER('data/strings.*.json')}
// ignore_for_file: lines_longer_than_80_chars

${classes.reverse().join('\n\n')}

${inst('jhiguStringsEn', en)}

${inst('jhiguStringsNe', ne)}

/// Label table for [language] (\`'ne'\` or \`'en'\`; anything else gives English).
JhiguStrings getStrings(String language) =>
    language == 'ne' ? jhiguStringsNe : jhiguStringsEn;
`;
}


// ── Phone data ───────────────────────────────────────────────────────────────
const phone = read('data/phone-prefixes.json');

function phoneTs() {
  const carrier = c => (c === null ? 'null' : JSON.stringify(c));
  return `// ${HEADER('data/phone-prefixes.json')}

export interface PhoneMobilePrefix {
  readonly prefix: string;
  readonly carrier: string | null;
  readonly active: boolean;
}

export interface PhoneAreaCode {
  readonly code: string;
  readonly places: readonly string[];
}

/** Best-effort data; see data/PHONE_NOTES.md. */
export const phoneBestEffort = ${phone.bestEffort};
export const phoneMobileLength = ${phone.mobileLength};
export const phoneLandlineLength = ${phone.landlineLength};
export const phoneFormats = ${JSON.stringify(phone.formats)} as const;

export const phoneMobilePrefixes: readonly PhoneMobilePrefix[] = [
${phone.mobile.map(m => `  { prefix: ${JSON.stringify(m.prefix)}, carrier: ${carrier(m.carrier)}, active: ${m.active} },`).join('\n')}
];

export const phoneAreaCodes: readonly PhoneAreaCode[] = [
${phone.landlineAreaCodes.map(a => `  { code: ${JSON.stringify(a.code)}, places: [${a.places.map(p => JSON.stringify(p)).join(', ')}] },`).join('\n')}
];
`;
}

function phoneDart() {
  const carrier = c => (c === null ? 'null' : dq(c));
  return `// ${HEADER('data/phone-prefixes.json')}
// ignore_for_file: lines_longer_than_80_chars

/// A mobile prefix and its carrier.
class PhoneMobilePrefix {
  final String prefix;
  final String? carrier;
  final bool active;
  const PhoneMobilePrefix(this.prefix, this.carrier, {required this.active});
}

/// A landline area code and known places (best effort).
class PhoneAreaCode {
  final String code;
  final List<String> places;
  const PhoneAreaCode(this.code, this.places);
}

/// Best-effort data; see data/PHONE_NOTES.md.
const bool phoneBestEffort = ${phone.bestEffort};
const int phoneMobileLength = ${phone.mobileLength};
const int phoneLandlineLength = ${phone.landlineLength};
const String phoneFormatMobile = ${dq(phone.formats.mobile)};
const String phoneFormatLandlineKathmandu = ${dq(phone.formats.landlineKathmandu)};
const String phoneFormatLandlineOther = ${dq(phone.formats.landlineOther)};

const List<PhoneMobilePrefix> phoneMobilePrefixes = [
${phone.mobile.map(m => `  PhoneMobilePrefix(${dq(m.prefix)}, ${carrier(m.carrier)}, active: ${m.active}),`).join('\n')}
];

const List<PhoneAreaCode> phoneAreaCodes = [
${phone.landlineAreaCodes.map(a => `  PhoneAreaCode(${dq(a.code)}, [${a.places.map(dq).join(', ')}]),`).join('\n')}
];
`;
}

// ── Address data ─────────────────────────────────────────────────────────────
const address = read('data/address.json');
const TYPE_DART = { metropolitan: 'metropolitan', 'sub-metropolitan': 'subMetropolitan', municipality: 'municipality', 'rural-municipality': 'ruralMunicipality' };
const jq = s => JSON.stringify(s);

function addressTs() {
  const rec = (o, keys) => `  { ${keys.map(k => `${k}: ${jq(o[k])}`).join(', ')} },`;
  return `// ${HEADER('data/address.json')}

export type AddressLocalLevelType =
  | 'metropolitan'
  | 'sub-metropolitan'
  | 'municipality'
  | 'rural-municipality';

export interface AddressProvince {
  readonly id: number;
  readonly en: string;
  readonly ne: string;
}

export interface AddressDistrict {
  readonly id: number;
  readonly provinceId: number;
  readonly en: string;
  readonly ne: string;
}

export interface AddressLocalLevel {
  readonly id: number;
  readonly districtId: number;
  readonly type: AddressLocalLevelType;
  readonly en: string;
  readonly ne: string;
  /** Number of wards; valid ward numbers are 1..wards. */
  readonly wards: number;
}

export const addressProvinces: readonly AddressProvince[] = [
${address.provinces.map(o => rec(o, ['id', 'en', 'ne'])).join('\n')}
];

export const addressDistricts: readonly AddressDistrict[] = [
${address.districts.map(o => rec(o, ['id', 'provinceId', 'en', 'ne'])).join('\n')}
];

export const addressLocalLevels: readonly AddressLocalLevel[] = [
${address.localLevels.map(o => rec(o, ['id', 'districtId', 'type', 'en', 'ne', 'wards'])).join('\n')}
];
`;
}

function addressDart() {
  return `// ${HEADER('data/address.json')}
// ignore_for_file: lines_longer_than_80_chars

/// Kind of local level.
enum AddressLocalLevelType {
  metropolitan('metropolitan'),
  subMetropolitan('sub-metropolitan'),
  municipality('municipality'),
  ruralMunicipality('rural-municipality');

  const AddressLocalLevelType(this.wire);

  /// Stable name shared with the TypeScript library.
  final String wire;
}

/// A province.
class AddressProvince {
  final int id;
  final String en;
  final String ne;
  const AddressProvince(this.id, this.en, this.ne);
}

/// A district.
class AddressDistrict {
  final int id;
  final int provinceId;
  final String en;
  final String ne;
  const AddressDistrict(this.id, this.provinceId, this.en, this.ne);
}

/// A local level (municipality or rural municipality).
class AddressLocalLevel {
  final int id;
  final int districtId;
  final AddressLocalLevelType type;
  final String en;
  final String ne;

  /// Number of wards; valid ward numbers are 1..wards.
  final int wards;
  const AddressLocalLevel(
    this.id,
    this.districtId,
    this.type,
    this.en,
    this.ne,
    this.wards,
  );
}

const List<AddressProvince> addressProvinces = [
${address.provinces.map(o => `  AddressProvince(${o.id}, ${dq(o.en)}, ${dq(o.ne)}),`).join('\n')}
];

const List<AddressDistrict> addressDistricts = [
${address.districts.map(o => `  AddressDistrict(${o.id}, ${o.provinceId}, ${dq(o.en)}, ${dq(o.ne)}),`).join('\n')}
];

const List<AddressLocalLevel> addressLocalLevels = [
${address.localLevels.map(o => `  AddressLocalLevel(${o.id}, ${o.districtId}, AddressLocalLevelType.${TYPE_DART[o.type]}, ${dq(o.en)}, ${dq(o.ne)}, ${o.wards}),`).join('\n')}
];
`;
}

// ── Month names for the date parser ──────────────────────────────────────────
// Canonical names (en months and short names, ne months) plus data/month-aliases.json.
// A spelling that maps to two different months is an error. Short Nepali names are
// left out: they are one letter and ambiguous (see data/STRINGS_NOTES.md).
const aliasFile = read('data/month-aliases.json');
const normName = s => s.normalize('NFC').toLowerCase().replace(/[‌‍]/g, '');
const monthNames = new Map();
function addName(name, month, from) {
  const key = normName(name);
  const prev = monthNames.get(key);
  if (prev !== undefined && prev !== month) {
    throw new Error(`month name "${key}" maps to ${prev} and ${month} (${from})`);
  }
  monthNames.set(key, month);
}
en.months.forEach((n, i) => addName(n, i + 1, 'strings.en months'));
en.monthsShort.forEach((n, i) => addName(n, i + 1, 'strings.en monthsShort'));
ne.months.forEach((n, i) => addName(n, i + 1, 'strings.ne months'));
for (let m = 1; m <= 12; m++) {
  if (!Array.isArray(aliasFile[String(m)])) throw new Error(`month-aliases.json: missing month ${m}`);
  for (const n of aliasFile[String(m)]) {
    if (n !== normName(n)) throw new Error(`month-aliases.json: "${n}" is not lower case NFC`);
    addName(n, m, 'month-aliases.json');
  }
}
const monthNameList = [...monthNames.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));

function monthNamesTs() {
  return `// ${HEADER('data/strings.*.json, data/month-aliases.json')}

/** Lower-case NFC month spellings and their BS month number (1-12). */
export const monthNameTable: ReadonlyArray<readonly [string, number]> = [
${monthNameList.map(([k, m]) => `  [${JSON.stringify(k)}, ${m}],`).join('\n')}
];
`;
}

function monthNamesDart() {
  return `// ${HEADER('data/strings.*.json, data/month-aliases.json')}
// ignore_for_file: lines_longer_than_80_chars

/// Lower-case NFC month spellings and their BS month number (1-12).
const Map<String, int> monthNameTable = {
${monthNameList.map(([k, m]) => `  ${dq(k)}: ${m},`).join('\n')}
};
`;
}

// ── Nepali number words ──────────────────────────────────────────────────────
const nepaliNumbers = read('data/nepali-numbers.json');
if (nepaliNumbers.words.length !== 100 || new Set(nepaliNumbers.words).size !== 100) {
  throw new Error('data/nepali-numbers.json: words must be 100 distinct entries (0-99)');
}
const NN_SCALES = ['hundred', 'thousand', 'lakh', 'crore', 'arba', 'kharba'];
for (const k of NN_SCALES) if (typeof nepaliNumbers.scales[k] !== 'string') throw new Error(`data/nepali-numbers.json: missing scale ${k}`);

function nepaliNumbersTs() {
  return `// ${HEADER('data/nepali-numbers.json')}

/**
 * Nepali words for 0 to 99. Not native-speaker reviewed; see \`data/nepali-numbers.json\`
 * (\`review\` and \`variants\`) for how far each word is backed.
 */
export const nepaliNumberWords: readonly string[] = [
${nepaliNumbers.words.map(w => `  ${JSON.stringify(w)},`).join('\n')}
];

/** How far each word of \`nepaliNumberWords\` is backed: \`two-sources\`, \`single-source\` or \`disputed\`. */
export const nepaliNumberReview: readonly string[] = [
${nepaliNumbers.review.map(w => `  ${JSON.stringify(w)},`).join('\n')}
];

/** Scale words: 100, 10^3, 10^5, 10^7, 10^9, 10^11. */
export const nepaliScales = {
${NN_SCALES.map(k => `  ${k}: ${JSON.stringify(nepaliNumbers.scales[k])},`).join('\n')}
} as const;
`;
}

function nepaliNumbersDart() {
  return `// ${HEADER('data/nepali-numbers.json')}
// ignore_for_file: lines_longer_than_80_chars

/// Nepali words for 0 to 99. Not native-speaker reviewed; see data/nepali-numbers.json
/// (review and variants) for how far each word is backed.
const List<String> nepaliNumberWords = [
${nepaliNumbers.words.map(w => `  ${dq(w)},`).join('\n')}
];

/// How far each word of [nepaliNumberWords] is backed: two-sources, single-source or disputed.
const List<String> nepaliNumberReview = [
${nepaliNumbers.review.map(w => `  ${dq(w)},`).join('\n')}
];

/// Scale words: 100, 10^3, 10^5, 10^7, 10^9, 10^11.
${NN_SCALES.map(k => `const String nepaliScale${cap(k)} = ${dq(nepaliNumbers.scales[k])};`).join('\n')}
`;
}

const outputs = {
  'ts/src/generated/strings.ts': ts(),
  'dart/lib/src/generated/strings.dart': dart(),
  'ts/src/generated/phone.ts': phoneTs(),
  'dart/lib/src/generated/phone.dart': phoneDart(),
  'ts/src/generated/monthNames.ts': monthNamesTs(),
  'dart/lib/src/generated/month_names.dart': monthNamesDart(),
  'ts/src/generated/address.ts': addressTs(),
  'dart/lib/src/generated/address.dart': addressDart(),
  'ts/src/generated/nepaliNumbers.ts': nepaliNumbersTs(),
  'dart/lib/src/generated/nepali_numbers.dart': nepaliNumbersDart(),
};

let stale = false;
for (const [p, content] of Object.entries(outputs)) {
  const abs = join(root, p);
  if (check) {
    if (!existsSync(abs) || readFileSync(abs, 'utf8') !== content) {
      console.error(`stale: ${p}`);
      stale = true;
    }
  } else {
    writeFileSync(abs, content);
    console.log('wrote', p);
  }
}
if (check) {
  if (stale) { console.error('Run: node tools/gen-data/gen.mjs'); process.exit(1); }
  console.log('generated files up to date');
}
