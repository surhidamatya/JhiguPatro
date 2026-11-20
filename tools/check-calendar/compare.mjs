#!/usr/bin/env node
/**
 * Compares our table (data/nepali_calendar_data.json) with every source in
 * testdata/calendar-sources/*.json. Writes testdata/calendar-golden.json
 * (one row per BS year, one column per source) and prints every year where
 * any two sources differ. Exit code 0 always; this is a report, not a gate.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const load = p => JSON.parse(readFileSync(join(root, p), 'utf8'));

const sources = { 'jhigu-patro (data/)': load('data/nepali_calendar_data.json').years };
for (const f of readdirSync(join(root, 'testdata/calendar-sources')).sort()) {
  if (f.endsWith('.json')) sources[f.replace('.json', '')] = load(`testdata/calendar-sources/${f}`);
}
const names = Object.keys(sources);
const years = [...new Set(names.flatMap(n => Object.keys(sources[n])))].map(Number).sort((a, b) => a - b);

const golden = { sources: names, years: {} };
const diffs = [];
for (const y of years) {
  const row = {};
  for (const n of names) if (sources[n][y]) row[n] = sources[n][y];
  golden.years[y] = row;
  const distinct = new Set(Object.values(row).map(r => r.join(',')));
  if (distinct.size > 1) diffs.push(y);
}
writeFileSync(join(root, 'testdata/calendar-golden.json'), JSON.stringify(golden));

console.log(`sources: ${names.join(' | ')}`);
console.log(`years compared: ${years[0]}..${years.at(-1)}  disagreeing: ${diffs.length}`);
for (const y of diffs) {
  const groups = new Map();
  for (const [n, r] of Object.entries(golden.years[y])) {
    const k = r.join(',');
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  console.log(`\n${y}`);
  for (const [k, ns] of groups) console.log(`  [${k}]  ${ns.join(', ')}`);
}
