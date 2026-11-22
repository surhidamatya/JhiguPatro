#!/usr/bin/env node
/**
 * Validates data/<year>_tithi.json against data/nepali_calendar_data.json.
 * Plain Node, zero dependencies. Exit code 1 on any hard failure.
 *
 * Hard checks (a failure is a bug in the file or the calendar):
 *   - one year object; 12 months numbered 1..12; each month has as many days as the calendar says,
 *     numbered 1..n;
 *   - adDate is a real date, one day after the previous day, and starts at the AD date the calendar
 *     gives for 1 Baisakh;
 *   - a day with segments: the first starts at minute 0, each starts where the previous ended, the last
 *     ends at 1440, start < end, tithiNumber 1..15, and the name matches the number and paksha;
 *   - across the year the tithi only moves forward: same, next, or one skipped (a tithi that starts and
 *     ends inside one day is not listed twice, so one skip is normal), 15 of one paksha is followed by 1
 *     of the other. Never backward, never two skips.
 *
 * Known data problems (reported, not failed; listed in KNOWN_EMPTY and KNOWN_ISSUES). They are in the
 * source files and nothing here guesses a fix: [SOURCE NEEDED]. Anything else fails.
 *   - KNOWN_EMPTY: days with no segments (the 32nd day of a month).
 *   - KNOWN_ISSUES: days whose tithi name or order is wrong or doubtful.
 *   - Tail segments: some days end with an extra last segment that starts at or after minute 1440 and
 *     ends at 1440 (the day's last real tithi runs past midnight; the extra is a leftover). It is never
 *     reached by minute 0..1439, so the readers ignore it. Counted, not failed.
 *
 * Usage: node tools/check-tithi/validate.mjs [year ...]     (default: every data/*_tithi.json)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = join(root, 'data');

/** Days known to have no segments in the source data: `year-month-day`. [SOURCE NEEDED] to fill them. */
export const KNOWN_EMPTY = new Set(['2081-2-32', '2081-4-32', '2082-3-32']);

/**
 * Days with a doubtful tithi in the source: `year-month-day`.
 *   2081-5-17  15 कृष्ण is named पूर्णिमा (should be औंसी).
 *   2082-2-14  tithi 1 शुक्ल comes after 2 शुक्ल on the day before (goes backward).
 *   2082-8-18  14 शुक्ल is followed by 1 शुक्ल, then 1 कृष्ण on the 19th (15 शुक्ल is missing; the 1 शुक्ल is probably it).
 *   2082-8-19  the other end of the same jump.
 */
export const KNOWN_ISSUES = new Set(['2081-5-17', '2082-2-14', '2082-8-18', '2082-8-19']);

const NAMES = ['प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पञ्चमी', 'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी', 'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी'];
const SHUKLA = 'शुक्ल';
const KRISHNA = 'कृष्ण';
const expectedName = (n, paksha) => (n < 15 ? NAMES[n - 1] : paksha === SHUKLA ? 'पूर्णिमा' : 'औंसी');

function addDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** AD date (ISO) of 1 Baisakh of `year`, by walking the calendar from its reference point. */
function adOfNewYear(cal, year) {
  const r = cal.referencePoint;
  let iso = `${String(r.adYear).padStart(4, '0')}-${String(r.adMonth).padStart(2, '0')}-${String(r.adDay).padStart(2, '0')}`;
  for (let y = r.bsYear; y < year; y++) for (const len of cal.years[String(y)]) for (let i = 0; i < len; i++) iso = addDay(iso);
  return iso;
}

/** Tithi position 0..29 along the lunar month. */
const pos = s => (s.paksha === SHUKLA ? 0 : 15) + s.tithiNumber - 1;

export function validateTithi(cal, file, { knownEmpty = KNOWN_EMPTY, knownIssues = KNOWN_ISSUES } = {}) {
  const hard = [];
  const known = [];
  const empty = [];
  const tails = [];
  let errors = hard;
  const out = () => ({ errors: hard, known, empty, tails });
  if (!Array.isArray(file) || file.length !== 1) return { errors: ['file: need an array with exactly one year object'], known, empty, tails };
  const t = file[0];
  const year = t.year;
  const lens = cal.years?.[String(year)];
  if (!lens) return { errors: [`year ${year}: not in the calendar data`], known, empty, tails };
  if (!Array.isArray(t.months) || t.months.length !== 12) return { errors: [`year ${year}: need 12 months`], known, empty, tails };

  let prevAd = null;
  let prev = null; // last segment seen
  t.months.forEach((m, mi) => {
    if (m.month !== mi + 1) errors.push(`${year} month index ${mi}: numbered ${m.month}`);
    if (m.days.length !== lens[mi]) errors.push(`${year}-${m.month}: ${m.days.length} days, calendar says ${lens[mi]}`);
    m.days.forEach((d, di) => {
      const at = `${year}-${m.month}-${d.bsDay}`;
      errors = knownIssues.has(at) ? known : hard;
      if (d.bsDay !== di + 1) errors.push(`${year}-${m.month} day index ${di}: numbered ${d.bsDay}`);
      const want = prevAd === null ? adOfNewYear(cal, year) : addDay(prevAd);
      if (d.adDate !== want) errors.push(`${at}: adDate ${d.adDate}, expected ${want}`);
      prevAd = d.adDate;

      const segs = d.tithiSegments;
      if (!segs.length) {
        empty.push(at);
        if (!knownEmpty.has(at)) errors.push(`${at}: no tithi segments`);
        return;
      }
      if (segs[0].startMinute !== 0) errors.push(`${at}: first segment starts at ${segs[0].startMinute}, not 0`);
      let live = segs;
      const last = segs[segs.length - 1];
      if (segs.length > 1 && last.startMinute >= 1440 && last.endMinute === 1440) { tails.push(at); live = segs.slice(0, -1); }
      const lastLive = live[live.length - 1];
      if (live === segs ? lastLive.endMinute !== 1440 : lastLive.endMinute < 1440) errors.push(`${at}: last segment ends at ${lastLive.endMinute}, not 1440`);
      live.forEach((s, i) => {
        if (i && s.startMinute !== segs[i - 1].endMinute) errors.push(`${at}: segment ${i} starts at ${s.startMinute}, previous ended at ${segs[i - 1].endMinute}`);
        if (!(s.startMinute < s.endMinute)) errors.push(`${at}: segment ${i} is empty or backward (${s.startMinute}..${s.endMinute})`);
        if (!Number.isInteger(s.tithiNumber) || s.tithiNumber < 1 || s.tithiNumber > 15) { errors.push(`${at}: tithiNumber ${s.tithiNumber}`); return; }
        if (s.paksha !== SHUKLA && s.paksha !== KRISHNA) { errors.push(`${at}: paksha ${s.paksha}`); return; }
        if (s.tithiName !== expectedName(s.tithiNumber, s.paksha)) errors.push(`${at}: ${s.tithiNumber} ${s.paksha} is named ${s.tithiName}, expected ${expectedName(s.tithiNumber, s.paksha)}`);
        if (prev) {
          const step = (pos(s) - pos(prev) + 30) % 30;
          if (step > 2) errors.push(`${at}: tithi goes from ${pos(prev) + 1} to ${pos(s) + 1} of 30 (step ${step})`);
        }
        prev = s;
      });
    });
  });
  return out();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cal = JSON.parse(readFileSync(join(dataDir, 'nepali_calendar_data.json'), 'utf8'));
  const args = process.argv.slice(2);
  const files = args.length ? args.map(y => `${y}_tithi.json`) : readdirSync(dataDir).filter(f => /^\d{4}_tithi\.json$/.test(f)).sort();
  let failed = 0;
  for (const f of files) {
    const { errors, known, empty, tails } = validateTithi(cal, JSON.parse(readFileSync(join(dataDir, f), 'utf8')));
    console.log(`${f}: ${errors.length ? `${errors.length} problem(s)` : 'ok'}`);
    if (empty.length) console.log(`  known: no tithi on ${empty.join(', ')}`);
    if (known.length) console.log(`  known: ${known.length} doubtful tithi line(s) on ${[...new Set(known.map(k => k.split(':')[0]))].join(', ')}`);
    if (tails.length) console.log(`  known: ${tails.length} day(s) with a leftover tail segment (ignored by readers)`);
    for (const e of errors.slice(0, 20)) console.log(`  ${e}`);
    if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
    failed += errors.length;
  }
  process.exit(failed ? 1 : 0);
}
