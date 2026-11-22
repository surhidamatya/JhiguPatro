#!/usr/bin/env node
/**
 * Validates data/address.json (guide 11.1): counts, links, wards, types, text hygiene,
 * and that ids agree with data/address-idmap.json.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const a = JSON.parse(readFileSync(join(root, 'data', 'address.json'), 'utf8'));
const idmap = JSON.parse(readFileSync(join(root, 'data', 'address-idmap.json'), 'utf8'));
const errors = [];
const err = m => errors.push(m);

const EXPECT = { provinces: 7, districts: 77, localLevels: 753 };
for (const [k, n] of Object.entries(EXPECT)) if (a[k].length !== n) err(`${k}: expected ${n}, got ${a[k].length}`);

const TYPES = new Set(['metropolitan', 'sub-metropolitan', 'municipality', 'rural-municipality']);
const TYPE_COUNTS = { metropolitan: 6, 'sub-metropolitan': 11, municipality: 276, 'rural-municipality': 460 };
const typeCount = {};

const ids = {};
for (const level of Object.keys(EXPECT)) {
  ids[level] = new Set();
  for (const r of a[level]) {
    if (!Number.isInteger(r.id) || r.id < 1) err(`${level} bad id ${r.id}`);
    if (ids[level].has(r.id)) err(`${level} duplicate id ${r.id}`);
    ids[level].add(r.id);
    for (const lang of ['en', 'ne']) {
      const s = r[lang];
      if (typeof s !== 'string' || !s) { err(`${level} ${r.id}: empty ${lang}`); continue; }
      if (s !== s.normalize('NFC')) err(`${level} ${r.id}: ${lang} not NFC`);
      if (s !== s.trim() || / {2,}/.test(s)) err(`${level} ${r.id}: ${lang} has stray spaces`);
      if (/[‌‍]/.test(s)) err(`${level} ${r.id}: ${lang} has ZWJ/ZWNJ`);
    }
    if (/[^ऀ-ॿ \-().,]/.test(r.ne)) err(`${level} ${r.id}: ne has non-Devanagari char: ${r.ne}`);
  }
}
for (const d of a.districts) if (!ids.provinces.has(d.provinceId)) err(`district ${d.id}: provinceId ${d.provinceId} missing`);
for (const m of a.localLevels) {
  if (!ids.districts.has(m.districtId)) err(`localLevel ${m.id}: districtId ${m.districtId} missing`);
  if (!TYPES.has(m.type)) err(`localLevel ${m.id}: bad type ${m.type}`);
  if (!Number.isInteger(m.wards) || m.wards < 1) err(`localLevel ${m.id}: wards must be a positive integer, got ${m.wards}`);
  typeCount[m.type] = (typeCount[m.type] ?? 0) + 1;
}
for (const [t, n] of Object.entries(TYPE_COUNTS)) if (typeCount[t] !== n) err(`type ${t}: expected ${n}, got ${typeCount[t] ?? 0}`);
for (const d of a.districts) if (!a.localLevels.some(m => m.districtId === d.id)) err(`district ${d.id} has no local levels`);

// id map: every id in the data is in the map, and the map has no id used twice
for (const level of Object.keys(EXPECT)) {
  const mapIds = Object.values(idmap[level]);
  if (new Set(mapIds).size !== mapIds.length) err(`idmap ${level}: duplicate ids`);
  for (const r of a[level]) if (!mapIds.includes(r.id)) err(`idmap ${level}: id ${r.id} missing`);
}
// ne suffix agrees with type
const SUFFIX = { metropolitan: 'महानगरपालिका', 'sub-metropolitan': 'उपमहानगरपालिका', municipality: 'नगरपालिका', 'rural-municipality': 'गाउँपालिका' };
for (const m of a.localLevels) if (!m.ne.endsWith(SUFFIX[m.type])) err(`localLevel ${m.id}: ne "${m.ne}" does not end with ${SUFFIX[m.type]}`);

if (errors.length) { console.error(errors.slice(0, 40).join('\n')); console.error(`${errors.length} error(s)`); process.exit(1); }
const wards = a.localLevels.reduce((s, m) => s + m.wards, 0);
console.log(`address OK: ${a.provinces.length} provinces, ${a.districts.length} districts, ${a.localLevels.length} local levels, ${wards} wards`);
