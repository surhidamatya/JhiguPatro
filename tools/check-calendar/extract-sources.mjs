#!/usr/bin/env node
/**
 * One-off helper: extracts month-length tables from downloaded npm packages by
 * TEXT parsing (never executes the package code) and writes them to
 * testdata/calendar-sources/<name>.json  as { "<year>": [12 ints] }.
 *
 * Usage: node extract-sources.mjs <dir-with-unpacked-packages> <out-dir>
 *   expects: nepal-date-kit/package, nepali-date-converter/package,
 *            _remotemerge_nepali-date-converter/package
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
const read = p => readFileSync(join(src, p), 'utf8');
const save = (name, table) => {
  writeFileSync(join(out, `${name}.json`), JSON.stringify(table, null, 1).replace(/\n\s+(\d|\])/g, '$1').replace(/\[\n\s*/g, '['));
  console.log(name, Object.keys(table).length, 'years');
};

// nepal-date-kit: "2000": { months: [..], adStartOfYear: ".." }
{
  const t = read('nepal-date-kit/package/dist/index.js');
  const table = {};
  for (const m of t.matchAll(/"(\d{4})":\s*\{\s*months:\s*\[([^\]]*)\]/g)) {
    table[m[1]] = m[2].split(',').map(s => +s.trim());
  }
  save('nepal-date-kit', table);
}

// nepali-date-converter (subeshb1): '2000': { Baisakh: 30, ... }
{
  const t = read('nepali-date-converter/package/dist/nepali-date-converter.mjs');
  const table = {};
  for (const m of t.matchAll(/'(\d{4})':\s*\{([^}]*)\}/g)) {
    const nums = [...m[2].matchAll(/:\s*(\d+)/g)].map(x => +x[1]);
    if (nums.length === 12) table[m[1]] = nums;
  }
  save('nepali-date-converter', table);
}

// @remotemerge/nepali-date-converter: n[2000]=[12 months, total]
{
  const t = read('_remotemerge_nepali-date-converter/package/ndc-node.cjs');
  const table = {};
  // Entries are either literals  x[2000]=[...]  or aliases  x[1979]=x[1975].
  const re = /(?:^|[^\w$])[A-Za-z_$]\[(\d{4})\]=(?:\[([\d,]+)\]|[A-Za-z_$]\[(\d{4})\])/g;
  for (const m of t.matchAll(re)) {
    if (m[2]) table[m[1]] = m[2].split(',').map(Number).slice(0, 12);
    else if (table[m[3]]) table[m[1]] = table[m[3]];
  }
  save('remotemerge-nepali-date-converter', table);
}
