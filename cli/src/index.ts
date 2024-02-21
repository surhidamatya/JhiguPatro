#!/usr/bin/env node
/**
 * jhigu-patro — Bikram Sambat CLI
 *
 * Commands:
 *   today                     Show today's Nepali date
 *   ad2bs  <YYYY-MM-DD>       Convert AD date → BS date
 *   bs2ad  <YYYY-MM-DD>       Convert BS date → AD date
 *   month  [BS-YYYY] [1-12]   Print a monthly calendar grid
 *   info   <YYYY-MM-DD>       Full info about any date (both calendars)
 *   help                      Show this help
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import {
  initializeCalendar,
  convertADToBS,
  convertBSToAD,
  getCurrentNepaliDate,
  getCurrentNepaliDateFormatted,
  getDaysInBSMonth,
  isValidBSDate,
  toNepaliDigits,
  NEPALI_MONTHS_EN,
  NEPALI_MONTHS_NE,
  NEPALI_DAYS_EN,
  NEPALI_DAYS_NE,
  ENGLISH_MONTHS,
  getRelativeTimeInNepali,
  formatNepaliDate,
  formatEnglishDate,
  formatNepaliDateWithDay,
  toNepalTime,
} from '../../ts/dist/index.js';
import { InlineCalendarDataSource } from '../../ts/dist/index.js';
import type { CalendarJson } from '../../ts/dist/index.js';

// ============================================================================
// BOOTSTRAP
// ============================================================================

const __dir = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dir, '../../data/nepali_calendar_data.json');
const calData: CalendarJson = JSON.parse(readFileSync(dataPath, 'utf8'));

initializeCalendar(
  new InlineCalendarDataSource(calData.years, calData.supportedRange.start, calData.supportedRange.end)
);

// ============================================================================
// HELPERS
// ============================================================================

const NEPALI_DAYS_SHORT_NE = ['आइ', 'सोम', 'मंग', 'बुध', 'बिहि', 'शुक्र', 'शनि'];

function parseAD(raw: string): Date {
  const parts = raw.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    die(`Invalid AD date "${raw}". Expected YYYY-MM-DD`);
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function parseBS(raw: string): { year: number; month: number; day: number } {
  const parts = raw.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    die(`Invalid BS date "${raw}". Expected YYYY-MM-DD`);
  }
  const [year, month, day] = parts;
  if (!isValidBSDate(year, month, day)) {
    die(`BS date ${year}/${month}/${day} is out of range or invalid`);
  }
  return { year, month, day };
}

function die(msg: string): never {
  console.error(chalk.red(`✖ ${msg}`));
  process.exit(1);
}

function label(text: string): string {
  return chalk.dim(text.padEnd(22));
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function printDivider(): void {
  console.log(chalk.dim('─'.repeat(44)));
}

// ============================================================================
// COMMANDS
// ============================================================================

function cmdToday(): void {
  const nowNep = toNepalTime(new Date());
  const localAD = new Date(nowNep.getUTCFullYear(), nowNep.getUTCMonth(), nowNep.getUTCDate());
  const bs = convertADToBS(localAD);

  printDivider();
  console.log(chalk.bold.yellow('  आजको मिति (Today\'s Date)'));
  printDivider();
  console.log(label('  Nepali (BS):') + chalk.bold.green(formatNepaliDateWithDay(bs, localAD)));
  console.log(label('  English (AD):') + chalk.cyan(formatEnglishDate(localAD)));
  console.log(label('  BS (numeric):') + chalk.white(`${bs.year}-${String(bs.month).padStart(2,'0')}-${String(bs.day).padStart(2,'0')}`));
  console.log(label('  AD (numeric):') + chalk.white(fmtDate(localAD)));
  console.log(label('  Month (EN):') + chalk.white(NEPALI_MONTHS_EN[bs.month - 1]));
  console.log(label('  Month (NE):') + chalk.white(NEPALI_MONTHS_NE[bs.month - 1]));
  console.log(label('  Day (EN):') + chalk.white(NEPALI_DAYS_EN[localAD.getDay()]));
  console.log(label('  Day (NE):') + chalk.white(NEPALI_DAYS_NE[localAD.getDay()]));
  printDivider();
}

function cmdAD2BS(rawDate: string): void {
  const ad = parseAD(rawDate);
  const bs = convertADToBS(ad);

  printDivider();
  console.log(chalk.bold.yellow(`  AD → BS  (${rawDate})`));
  printDivider();
  console.log(label('  AD (input):') + chalk.cyan(formatEnglishDate(ad)));
  console.log(label('  BS (result):') + chalk.bold.green(formatNepaliDate(bs)));
  console.log(label('  BS (Nepali):') + chalk.green(formatNepaliDate(bs, 'ne')));
  console.log(label('  BS (numeric):') + chalk.white(`${bs.year}-${String(bs.month).padStart(2,'0')}-${String(bs.day).padStart(2,'0')}`));
  console.log(label('  Weekday (EN):') + chalk.white(NEPALI_DAYS_EN[ad.getDay()]));
  console.log(label('  Weekday (NE):') + chalk.white(NEPALI_DAYS_NE[ad.getDay()]));
  console.log(label('  Relative:') + chalk.dim(getRelativeTimeInNepali(ad)));
  printDivider();
}

function cmdBS2AD(rawDate: string): void {
  const { year, month, day } = parseBS(rawDate);
  const ad = convertBSToAD(year, month, day);
  const bs = { year, month, day };

  printDivider();
  console.log(chalk.bold.yellow(`  BS → AD  (${rawDate})`));
  printDivider();
  console.log(label('  BS (input):') + chalk.green(formatNepaliDate(bs)));
  console.log(label('  BS (Nepali):') + chalk.green(formatNepaliDate(bs, 'ne')));
  console.log(label('  AD (result):') + chalk.bold.cyan(formatEnglishDate(ad)));
  console.log(label('  AD (numeric):') + chalk.white(fmtDate(ad)));
  console.log(label('  Weekday (EN):') + chalk.white(NEPALI_DAYS_EN[ad.getDay()]));
  console.log(label('  Weekday (NE):') + chalk.white(NEPALI_DAYS_NE[ad.getDay()]));
  printDivider();
}

function cmdMonth(bsYearArg?: string, bsMonthArg?: string): void {
  const today = getCurrentNepaliDate();

  // Default: current month
  const year = bsYearArg ? parseInt(bsYearArg, 10) : today.year;
  const month = bsMonthArg ? parseInt(bsMonthArg, 10) : today.month;

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    die('Usage: jhigu-patro month [BS-YYYY] [1-12]');
  }
  if (!calData.years[String(year)]) {
    die(`No calendar data for BS year ${year}`);
  }

  const daysInMonth = getDaysInBSMonth(year, month);
  const firstAD = convertBSToAD(year, month, 1);
  const startDow = firstAD.getDay(); // 0=Sun

  const monthNameEn = NEPALI_MONTHS_EN[month - 1];
  const monthNameNe = NEPALI_MONTHS_NE[month - 1];

  printDivider();
  console.log(chalk.bold.yellow(`  ${monthNameNe} ${toNepaliDigits(year)}  (${monthNameEn} ${year})`));
  console.log(chalk.dim(`  ${firstAD.toISOString().slice(0,10)} onwards`));
  printDivider();

  // Header: day-of-week names
  const header = NEPALI_DAYS_SHORT_NE.map((d, i) =>
    i === 0 ? chalk.red(d.padStart(5)) : chalk.white(d.padStart(5))
  ).join(' ');
  console.log('  ' + header);
  console.log(chalk.dim('  ' + '─────'.repeat(7)));

  // Grid
  let row = '  ' + '     '.repeat(startDow);
  for (let day = 1; day <= daysInMonth; day++) {
    const adDay = new Date(firstAD);
    adDay.setDate(adDay.getDate() + day - 1);
    const dow = adDay.getDay();
    const isToday = year === today.year && month === today.month && day === today.day;
    const dayStr = String(day).padStart(5);

    let cell: string;
    if (isToday) {
      cell = chalk.bold.bgYellow.black(dayStr);
    } else if (dow === 0) {
      cell = chalk.red(dayStr);
    } else {
      cell = chalk.white(dayStr);
    }

    row += ' ' + cell;

    if (dow === 6 || day === daysInMonth) {
      console.log(row);
      row = '  ';
    }
  }

  printDivider();
  console.log(chalk.dim(`  Total days: ${daysInMonth}`));
  printDivider();
}

function cmdInfo(rawDate: string): void {
  // Auto-detect whether input is AD or BS by year range:
  // BS years are ~2000+, AD years would be ~1943–2044 range for same data
  // Heuristic: if year > 1943+57 = 2000 and looks like BS (>= 2000), treat as BS
  const parts = rawDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    die(`Invalid date "${rawDate}". Expected YYYY-MM-DD`);
  }
  const [y] = parts;

  let ad: Date;
  let bs: { year: number; month: number; day: number };
  let inputLabel: string;

  if (y >= calData.supportedRange.start) {
    // Treat as BS
    const parsed = parseBS(rawDate);
    bs = parsed;
    ad = convertBSToAD(bs.year, bs.month, bs.day);
    inputLabel = 'BS';
  } else {
    // Treat as AD
    ad = parseAD(rawDate);
    bs = convertADToBS(ad);
    inputLabel = 'AD';
  }

  printDivider();
  console.log(chalk.bold.yellow(`  Date Info  (input treated as ${inputLabel})`));
  printDivider();
  console.log(label('  BS:') + chalk.bold.green(formatNepaliDateWithDay(bs, ad)));
  console.log(label('  BS (Nepali):') + chalk.green(formatNepaliDate(bs, 'ne')));
  console.log(label('  BS (numeric):') + chalk.white(`${bs.year}-${String(bs.month).padStart(2,'0')}-${String(bs.day).padStart(2,'0')}`));
  console.log(label('  AD:') + chalk.bold.cyan(formatEnglishDate(ad)));
  console.log(label('  AD (numeric):') + chalk.white(fmtDate(ad)));
  console.log(label('  Weekday (EN):') + chalk.white(NEPALI_DAYS_EN[ad.getDay()]));
  console.log(label('  Weekday (NE):') + chalk.white(NEPALI_DAYS_NE[ad.getDay()]));
  console.log(label('  Relative (NE):') + chalk.dim(getRelativeTimeInNepali(ad)));
  printDivider();
}

function cmdHelp(): void {
  printDivider();
  console.log(chalk.bold.yellow('  jhigu-patro — Bikram Sambat CLI'));
  printDivider();
  console.log(chalk.white('  ' + chalk.bold('today')));
  console.log(chalk.dim('    Show today\'s Nepali (BS) date\n'));

  console.log(chalk.white('  ' + chalk.bold('ad2bs') + ' <YYYY-MM-DD>'));
  console.log(chalk.dim('    Convert an AD (Gregorian) date to BS\n'));

  console.log(chalk.white('  ' + chalk.bold('bs2ad') + ' <YYYY-MM-DD>'));
  console.log(chalk.dim('    Convert a BS (Bikram Sambat) date to AD\n'));

  console.log(chalk.white('  ' + chalk.bold('month') + ' [BS-YYYY] [1-12]'));
  console.log(chalk.dim('    Print a monthly calendar grid (defaults to current month)\n'));

  console.log(chalk.white('  ' + chalk.bold('info') + ' <YYYY-MM-DD>'));
  console.log(chalk.dim('    Show full info for a date (auto-detects AD vs BS by year range)\n'));

  console.log(chalk.white('  ' + chalk.bold('help')));
  console.log(chalk.dim('    Show this help\n'));

  console.log(chalk.dim('  Examples:'));
  console.log(chalk.dim('    jhigu-patro today'));
  console.log(chalk.dim('    jhigu-patro ad2bs 2025-02-20'));
  console.log(chalk.dim('    jhigu-patro bs2ad 2082-11-08'));
  console.log(chalk.dim('    jhigu-patro month 2082 11'));
  console.log(chalk.dim('    jhigu-patro month'));
  console.log(chalk.dim('    jhigu-patro info 2082-11-08'));
  printDivider();
}

// ============================================================================
// ROUTER
// ============================================================================

const [,, cmd, arg1, arg2] = process.argv;

switch (cmd) {
  case 'today':
  case undefined:
    cmdToday();
    break;

  case 'ad2bs':
    if (!arg1) die('Usage: jhigu-patro ad2bs <YYYY-MM-DD>');
    cmdAD2BS(arg1);
    break;

  case 'bs2ad':
    if (!arg1) die('Usage: jhigu-patro bs2ad <YYYY-MM-DD>');
    cmdBS2AD(arg1);
    break;

  case 'month':
    cmdMonth(arg1, arg2);
    break;

  case 'info':
    if (!arg1) die('Usage: jhigu-patro info <YYYY-MM-DD>');
    cmdInfo(arg1);
    break;

  case 'help':
  case '--help':
  case '-h':
    cmdHelp();
    break;

  default:
    console.error(chalk.red(`✖ Unknown command: "${cmd}"`));
    console.error(chalk.dim('  Run: jhigu-patro help'));
    process.exit(1);
}
