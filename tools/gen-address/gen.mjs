#!/usr/bin/env node
/**
 * Builds data/address.json from the upstream dataset (sagautam5/local-states-nepal, MIT)
 * kept under testdata/address-upstream/. Plain Node, no dependencies. Upstream files are
 * parsed as JSON only; nothing from them is executed.
 *
 *   node tools/gen-address/gen.mjs            write data/address.json, data/address-idmap.json, data/address-fixes.json
 *   node tools/gen-address/gen.mjs --check    fail if any of those would change
 *
 * Steps (guide section 11.2):
 *  1. read upstream en + np
 *  2. normalise all text to Unicode NFC, trim
 *  3. fix defects by rule and log each fix (data/address-fixes.json)
 *  4. assign stable ids through data/address-idmap.json (never renumbers)
 *  5. write data/address.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const up = join(root, 'testdata', 'address-upstream');
const check = process.argv.includes('--check');

const vals = x => (Array.isArray(x) ? x : Object.values(x));
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const TYPES = { 1: 'metropolitan', 2: 'sub-metropolitan', 3: 'municipality', 4: 'rural-municipality' };

// ---- fix rules (applied to Nepali and English names) ----
const fixes = []; // { rule, kind, upstreamId, before, after }
const RULES = {
  trim: 'Leading or trailing whitespace removed; inner runs of spaces collapsed.',
  nfc: 'Text was not NFC; normalised.',
  stray_joiner: 'Stray ZWJ/ZWNJ removed (U+200D/U+200C). Upstream has them inside 3 names; names render and search correctly without them.',
  rural_suffix: 'Rural municipality suffix "गाउपालिका" (missing chandrabindu) corrected to "गाउँपालिका", the spelling upstream uses in its own categories file.',
};
function clean(text, kind, id) {
  let s = text;
  const log = (rule, after) => { if (after !== s) { fixes.push({ rule, kind, upstreamId: id, before: s, after }); s = after; } };
  log('nfc', s.normalize('NFC'));
  log('stray_joiner', s.replace(/[‌‍]/g, ''));
  log('trim', s.replace(/\s+/g, ' ').trim());
  return s;
}

const enRaw = vals(readJson(join(up, 'dataset_alldataset_en.json')));
const neRaw = vals(readJson(join(up, 'dataset_alldataset_np.json')));
const cats = readJson(join(up, 'dataset_categories_np.json'));
const ruralNe = cats.find(c => c.id === 4).name; // गाउँपालिका

// ---- flatten, pairing en and ne by position and verifying ids ----
function pair(a, b, what) {
  if (a.length !== b.length) throw new Error(`${what}: en has ${a.length}, ne has ${b.length}`);
  return a.map((x, i) => {
    if (x.id !== b[i].id) throw new Error(`${what}: id mismatch at ${i}: en ${x.id} vs ne ${b[i].id}`);
    return [x, b[i]];
  });
}
const rows = { provinces: [], districts: [], localLevels: [] };
for (const [pe, pn] of pair(enRaw, neRaw, 'provinces')) {
  rows.provinces.push({ up: pe.id, en: clean(pe.name, 'province', pe.id), ne: clean(pn.name, 'province', pe.id) });
  for (const [de, dn] of pair(vals(pe.districts), vals(pn.districts), `districts of ${pe.id}`)) {
    rows.districts.push({ up: de.id, parentUp: pe.id, en: clean(de.name, 'district', de.id), ne: clean(dn.name, 'district', de.id) });
    for (const [me, mn] of pair(vals(de.municipalities), vals(dn.municipalities), `local levels of ${de.id}`)) {
      let ne = clean(mn.name, 'localLevel', me.id);
      if (me.category_id === 4 && ne.endsWith('गाउपालिका')) {
        const after = ne.slice(0, -'गाउपालिका'.length) + ruralNe;
        fixes.push({ rule: 'rural_suffix', kind: 'localLevel', upstreamId: me.id, before: ne, after });
        ne = after;
      }
      if (!TYPES[me.category_id]) throw new Error(`unknown category_id ${me.category_id} for local level ${me.id}`);
      if (me.wards.length !== mn.wards.length) throw new Error(`ward count mismatch for local level ${me.id}`);
      rows.localLevels.push({
        up: me.id, parentUp: de.id, type: TYPES[me.category_id],
        en: clean(me.name, 'localLevel', me.id), ne, wards: me.wards.length,
      });
    }
  }
}

// ---- stable ids ----
const idmapPath = join(root, 'data', 'address-idmap.json');
const idmap = existsSync(idmapPath) ? readJson(idmapPath) : { provinces: {}, districts: {}, localLevels: {} };
const keyOf = {
  provinces: r => r.en.toLowerCase(),
};
const provKey = new Map(rows.provinces.map(p => [p.up, keyOf.provinces(p)]));
const distKey = new Map(rows.districts.map(d => [d.up, `${provKey.get(d.parentUp)}/${d.en.toLowerCase()}`]));
const keys = {
  provinces: rows.provinces.map(p => provKey.get(p.up)),
  districts: rows.districts.map(d => distKey.get(d.up)),
  localLevels: rows.localLevels.map(m => `${distKey.get(m.parentUp)}/${m.en.toLowerCase()}`),
};
for (const level of Object.keys(keys)) {
  const seen = new Set();
  keys[level].forEach(k => { if (seen.has(k)) throw new Error(`${level}: duplicate key "${k}"`); seen.add(k); });
  let next = Math.max(0, ...Object.values(idmap[level])) + 1;
  for (const k of keys[level]) if (!(k in idmap[level])) idmap[level][k] = next++;
}
const idOf = (level, i) => idmap[level][keys[level][i]];
const provId = new Map(rows.provinces.map((p, i) => [p.up, idOf('provinces', i)]));
const distId = new Map(rows.districts.map((d, i) => [d.up, idOf('districts', i)]));

const out = {
  _generated: 'Generated by tools/gen-address/gen.mjs from sagautam5/local-states-nepal (MIT). Do not edit.',
  provinces: rows.provinces.map((p, i) => ({ id: idOf('provinces', i), en: p.en, ne: p.ne })),
  districts: rows.districts.map((d, i) => ({ id: idOf('districts', i), provinceId: provId.get(d.parentUp), en: d.en, ne: d.ne })),
  localLevels: rows.localLevels.map((m, i) => ({
    id: idOf('localLevels', i), districtId: distId.get(m.parentUp), type: m.type, en: m.en, ne: m.ne, wards: m.wards,
  })),
};
const byRule = {};
for (const f of fixes) (byRule[f.rule] ??= []).push(f);
const fixLog = {
  _generated: 'Generated by tools/gen-address/gen.mjs. Every change made to upstream text.',
  rules: Object.fromEntries(Object.entries(RULES).map(([k, v]) => [k, { description: v, count: (byRule[k] ?? []).length }])),
  fixes,
};

// ---- write / check ----
const ser = o => JSON.stringify(o, null, 1) + '\n';
const targets = [
  [join(root, 'data', 'address.json'), compact(out)],
  [idmapPath, ser(sortKeys(idmap))],
  [join(root, 'data', 'address-fixes.json'), ser(fixLog)],
];
// one record per line keeps diffs readable
function compact(o) {
  const lines = ['{', ` "_generated": ${JSON.stringify(o._generated)},`];
  const lv = Object.keys(o).filter(k => k !== '_generated');
  lv.forEach((k, li) => {
    lines.push(` "${k}": [`);
    o[k].forEach((r, i) => lines.push(`  ${JSON.stringify(r)}${i < o[k].length - 1 ? ',' : ''}`));
    lines.push(` ]${li < lv.length - 1 ? ',' : ''}`);
  });
  lines.push('}', '');
  return lines.join('\n');
}
function sortKeys(m) {
  const r = {};
  for (const lvl of Object.keys(m)) r[lvl] = Object.fromEntries(Object.entries(m[lvl]).sort((a, b) => a[1] - b[1]));
  return r;
}

let stale = 0;
for (const [path, text] of targets) {
  const cur = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (check) { if (cur !== text) { console.error(`STALE ${path}`); stale++; } }
  else { writeFileSync(path, text); console.log('wrote', path.replace(root + '/', '')); }
}
if (check) { if (stale) process.exit(1); console.log('address data up to date'); }
else console.log(`fixes logged: ${fixes.length}`, Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, v.length])));
