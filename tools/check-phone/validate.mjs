#!/usr/bin/env node
/**
 * Validates data/phone-prefixes.json. Cross-checks every prefix / area code
 * against the Nepal ranges in Google libphonenumber metadata (as shipped in
 * libphonenumber-js 4.x), copied below as regexes. Zero dependencies.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const data = JSON.parse(readFileSync(join(root, 'data/phone-prefixes.json'), 'utf8'));

// libphonenumber NP: mobile `9(?:00|6[0-3]|7[0-24-6]|8[0-24-68])\d{7}`,
// fixed `(?:1[0-6]\d|99[02-6])\d{5}` | `(?:2[13-79]|3[135-8]|4[146-9]|5[135-7]|6[13-9]|7[15-9]|8[1-46-9]|9[1-7])[2-6]\d{5}`
const MOBILE = /^9(?:00|6[0-3]|7[0-24-6]|8[0-24-68])$/;
const AREA2 = /^(?:2[13-79]|3[135-8]|4[146-9]|5[135-7]|6[13-9]|7[15-9]|8[1-46-9]|9[1-7])$/;
const AREA_KTM = /^1[0-6]?$/;
const AREA99 = /^99$/; // fixed range `99[02-6]\d{5}`

const errors = [];
const seen = new Set();
for (const m of data.mobile) {
  if (!/^9\d\d$/.test(m.prefix)) errors.push(`mobile ${m.prefix}: not 3 digits starting 9`);
  else if (!MOBILE.test(m.prefix)) errors.push(`mobile ${m.prefix}: not a Nepal mobile range in libphonenumber`);
  if (seen.has(m.prefix)) errors.push(`mobile ${m.prefix}: duplicate`);
  seen.add(m.prefix);
  if (typeof m.active !== 'boolean') errors.push(`mobile ${m.prefix}: active must be boolean`);
}
// Every libphonenumber mobile range must be present.
for (let n = 900; n <= 999; n++) {
  if (MOBILE.test(String(n)) && !seen.has(String(n))) errors.push(`mobile ${n}: in libphonenumber but missing here`);
}
const areas = new Set();
for (const a of data.landlineAreaCodes) {
  if (!AREA2.test(a.code) && !AREA_KTM.test(a.code) && !AREA99.test(a.code)) errors.push(`area ${a.code}: not valid per libphonenumber`);
  if (areas.has(a.code)) errors.push(`area ${a.code}: duplicate`);
  areas.add(a.code);
  if (!Array.isArray(a.places)) errors.push(`area ${a.code}: places must be an array`);
}
for (let n = 20; n <= 99; n++) {
  if ((AREA2.test(String(n)) || n === 99) && !areas.has(String(n))) errors.push(`area ${n}: valid but missing`);
}
if (!areas.has('1')) errors.push('area 1 (Kathmandu valley) missing');
if (data.mobileLength !== 10 || data.landlineLength !== 8) errors.push('lengths must be 10 / 8');

if (errors.length) { console.error(`phone data invalid (${errors.length}):\n  ` + errors.join('\n  ')); process.exit(1); }
console.log(`phone data ok (${data.mobile.length} mobile prefixes, ${data.landlineAreaCodes.length} area codes)`);
