#!/usr/bin/env node
/**
 * Key-parity check for data/strings.en.json and data/strings.ne.json
 * (guide section 5.5). Fails if the two files do not have identical key
 * sets, if array lengths differ, if a value is empty, or if the {placeholders}
 * in a string differ between languages. Zero dependencies.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const load = lang => JSON.parse(readFileSync(join(root, `data/strings.${lang}.json`), 'utf8'));
const en = load('en');
const ne = load('ne');

const errors = [];
const placeholders = s => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

function walk(a, b, path) {
  const here = path || '(root)';
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return errors.push(`${here}: array in one file, not the other`);
    if (a.length !== b.length) errors.push(`${here}: length en=${a.length} ne=${b.length}`);
    a.forEach((v, i) => walk(v, b[i], `${path}[${i}]`));
    return;
  }
  if (typeof a === 'object' && a !== null) {
    if (typeof b !== 'object' || b === null) return errors.push(`${here}: object in en, not in ne`);
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in a)) errors.push(`${p}: missing in en`);
      else if (!(k in b)) errors.push(`${p}: missing in ne`);
      else walk(a[k], b[k], p);
    }
    return;
  }
  if (typeof a !== 'string' || typeof b !== 'string') return errors.push(`${here}: values must be strings`);
  if (!a.trim()) errors.push(`${here}: empty in en`);
  if (!b.trim()) errors.push(`${here}: empty in ne`);
  if (placeholders(a) !== placeholders(b)) errors.push(`${here}: placeholders differ (en ${placeholders(a)} / ne ${placeholders(b)})`);
}

walk(en, ne, '');

// Fixed-size tables.
const sizes = { months: 12, monthsShort: 12, adMonths: 12, weekdays: 7, weekdaysShort: 7 };
for (const [k, n] of Object.entries(sizes)) {
  for (const [lang, t] of [['en', en], ['ne', ne]]) {
    if (t[k]?.length !== n) errors.push(`${k}: ${lang} must have ${n} entries`);
  }
}

if (errors.length) {
  console.error(`strings invalid (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('strings ok');
