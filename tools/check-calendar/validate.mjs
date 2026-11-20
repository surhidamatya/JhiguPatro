#!/usr/bin/env node
/**
 * Validates data/nepali_calendar_data.json (guide section 5.2).
 * Plain Node, zero dependencies. Exit code 1 on any failure.
 *
 * Usage: node tools/check-calendar/validate.mjs [path-to-json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const file = process.argv[2] ?? join(root, 'data/nepali_calendar_data.json');

export function validateCalendar(data) {
  const errors = [];
  const { start, end } = data.supportedRange ?? {};
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    return ['supportedRange: need integer start <= end'];
  }
  for (let y = start; y <= end; y++) {
    const months = data.years?.[String(y)];
    if (!months) { errors.push(`year ${y}: missing`); continue; }
    if (!Array.isArray(months) || months.length !== 12) {
      errors.push(`year ${y}: need exactly 12 months`);
      continue;
    }
    months.forEach((m, i) => {
      if (!Number.isInteger(m) || m < 29 || m > 32) {
        errors.push(`year ${y} month ${i + 1}: length ${m} outside 29..32`);
      }
    });
  }
  const extra = Object.keys(data.years ?? {}).filter(k => +k < start || +k > end);
  if (extra.length) errors.push(`years outside supportedRange: ${extra.join(', ')}`);

  if (data.verifiedThrough !== undefined &&
      !(Number.isInteger(data.verifiedThrough) && data.verifiedThrough >= start && data.verifiedThrough <= end)) {
    errors.push('verifiedThrough: must be an integer inside supportedRange');
  }

  const rp = data.referencePoint;
  if (!rp || rp.bsYear !== start || rp.bsMonth !== 1 || rp.bsDay !== 1) {
    errors.push('referencePoint: must be Baisakh 1 of supportedRange.start');
  } else if (Number.isNaN(Date.UTC(rp.adYear, rp.adMonth - 1, rp.adDay))) {
    errors.push('referencePoint: AD date is not a real date');
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateCalendar(JSON.parse(readFileSync(file, 'utf8')));
  if (errors.length) {
    console.error(`calendar invalid (${errors.length}):\n  ` + errors.join('\n  '));
    process.exit(1);
  }
  console.log('calendar ok');
}
