#!/usr/bin/env node
/**
 * jhigu-patro — Bikram Sambat CLI
 *
 * Commands:
 *   today                     Show today's Nepali date
 *   ad2bs  <YYYY-MM-DD>       Convert AD date → BS date
 *   bs2ad  <YYYY-MM-DD>       Convert BS date → AD date
 *   month  [BS-YYYY] [1-12]   Print a monthly calendar grid
 *   info   <YYYY-MM-DD>       Full info about any date (both calendars); --ad or --bs to force
 *   money  <amount>           Format an amount (lakh grouping), VAT, words
 *   phone  <number>           Validate and format a Nepal phone number
 *   address <id> <ward>       Format an address; `address search <text>` finds places
 *   sms    <template> ...     Render an SMS template and count its segments
 *   fmt    <date> <format>    Format a BS date (preset or token pattern)
 *   parse  <date text>        Read a date written in many ways (BS and AD out)
 *   fiscal <date>             Fiscal year of a BS date
 *   help                      Show this help
 *
 * The money, phone, address, sms, fmt, parse and fiscal commands take --lang en|ne
 * and --json (machine-readable output). See tools.ts.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
} from 'jhigu-patro-utils-ts';
import { InlineCalendarDataSource, JhiguError } from 'jhigu-patro-utils-ts';
import type { CalendarJson } from 'jhigu-patro-utils-ts';
import { CliError, TOOLS } from './tools.js';

// ============================================================================
// BOOTSTRAP
// ============================================================================

// The calendar data ships inside the utils package, next to its code.
const dataPath = createRequire(import.meta.url).resolve('jhigu-patro-utils-ts/nepali_calendar_data.json');
const calData: CalendarJson = JSON.parse(readFileSync(dataPath, 'utf8'));

initializeCalendar(
  new InlineCalendarDataSource(calData.years, calData.supportedRange.start, calData.supportedRange.end, calData.verifiedThrough)
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
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  // `new Date` rolls an impossible date over to the next month (2025-02-30 becomes
  // March 2) and reads a year under 100 as 19xx: reject both.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    die(`Invalid AD date "${raw}". That day does not exist`);
  }
  return date;
}

/**
 * The relative text for the calendar day of [ad] (a local-midnight `Date`). The
 * library function takes an instant, and local midnight is a different day in Nepal
 * in many zones, so give it Nepal noon of that calendar day instead.
 */
function relativeNepali(ad: Date): string {
  const nepalNoon = Date.UTC(ad.getFullYear(), ad.getMonth(), ad.getDate(), 12) - 345 * 60_000;
  return getRelativeTimeInNepali(new Date(nepalNoon));
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
  console.log(label('  Relative:') + chalk.dim(relativeNepali(ad)));
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
  // Local fields, like every other date here: toISOString() is UTC, a day early in Nepal.
  console.log(chalk.dim(`  ${fmtDate(firstAD)} onwards`));
  printDivider();

  // Header: day-of-week names
  const header = NEPALI_DAYS_SHORT_NE.map((d, i) =>
    i === 0 ? chalk.red(d.padStart(5)) : chalk.white(d.padStart(5))
  ).join(' ');
  console.log('  ' + header);
  console.log(chalk.dim('  ' + '─────'.repeat(7)));

  // Grid: each week is a row of 5-wide cells joined by one space, like the header,
  // with blank cells before the first day so it falls under its own weekday.
  let cells: string[] = Array<string>(startDow).fill('     ');
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

    cells.push(cell);

    if (dow === 6 || day === daysInMonth) {
      console.log('  ' + cells.join(' '));
      cells = [];
    }
  }

  printDivider();
  console.log(chalk.dim(`  Total days: ${daysInMonth}`));
  printDivider();
}

/** The last year with AD data (BS 2100/12/31 is AD 2044-04-13). */
const LAST_AD_YEAR = 2044;

/**
 * `info`: a date in either calendar. The year decides, with `--ad` or `--bs` to force it:
 * under 2000 can only be AD; over 2044 can only be BS; 2000 to 2044 is valid in both, and
 * is read as AD, because BS 2000 to 2044 are historical dates (AD 1943 to 1988) and a date
 * typed in that range is far more likely to be a recent AD date. A note says so.
 */
function cmdInfo(args: string[]): void {
  const flags = args.filter(a => a.startsWith('--'));
  const positional = args.filter(a => !a.startsWith('--'));
  const unknown = flags.filter(f => f !== '--ad' && f !== '--bs');
  if (unknown.length) die(`Unknown option ${unknown[0]}. Usage: jhigu-patro info <YYYY-MM-DD> [--ad|--bs]`);
  if (flags.includes('--ad') && flags.includes('--bs')) die('Use either --ad or --bs, not both');
  if (positional.length !== 1) die('Usage: jhigu-patro info <YYYY-MM-DD> [--ad|--bs]');
  const rawDate = positional[0];

  const parts = rawDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    die(`Invalid date "${rawDate}". Expected YYYY-MM-DD`);
  }
  const [y] = parts;

  let asBS: boolean;
  let note: string | null = null;
  if (flags.includes('--bs')) asBS = true;
  else if (flags.includes('--ad')) asBS = false;
  else if (y > LAST_AD_YEAR) asBS = true;
  else if (y < calData.supportedRange.start) asBS = false;
  else {
    asBS = false;
    note = `Year ${y} is valid as AD and as BS; read as AD. Use --bs for BS.`;
  }

  let ad: Date;
  let bs: { year: number; month: number; day: number };
  if (asBS) {
    bs = parseBS(rawDate);
    ad = convertBSToAD(bs.year, bs.month, bs.day);
  } else {
    ad = parseAD(rawDate);
    bs = convertADToBS(ad);
  }
  const inputLabel = asBS ? 'BS' : 'AD';

  printDivider();
  console.log(chalk.bold.yellow(`  Date Info  (input treated as ${inputLabel})`));
  printDivider();
  if (note) console.log(chalk.dim(`  ${note}`));
  console.log(label('  BS:') + chalk.bold.green(formatNepaliDateWithDay(bs, ad)));
  console.log(label('  BS (Nepali):') + chalk.green(formatNepaliDate(bs, 'ne')));
  console.log(label('  BS (numeric):') + chalk.white(`${bs.year}-${String(bs.month).padStart(2,'0')}-${String(bs.day).padStart(2,'0')}`));
  console.log(label('  AD:') + chalk.bold.cyan(formatEnglishDate(ad)));
  console.log(label('  AD (numeric):') + chalk.white(fmtDate(ad)));
  console.log(label('  Weekday (EN):') + chalk.white(NEPALI_DAYS_EN[ad.getDay()]));
  console.log(label('  Weekday (NE):') + chalk.white(NEPALI_DAYS_NE[ad.getDay()]));
  console.log(label('  Relative (NE):') + chalk.dim(relativeNepali(ad)));
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

  console.log(chalk.white('  ' + chalk.bold('info') + ' <YYYY-MM-DD> [--ad|--bs]'));
  console.log(chalk.dim('    Show full info for a date. Years under 2000 are AD, over 2044 are BS; 2000 to 2044 are read as AD (--bs for BS)\n'));

  console.log(chalk.white('  ' + chalk.bold('money') + ' <amount> [--vat excl|incl] [--rate 13] [--words]'));
  console.log(chalk.dim('    Format an amount with lakh grouping; add or split VAT; English words\n'));

  console.log(chalk.white('  ' + chalk.bold('phone') + ' <number>'));
  console.log(chalk.dim('    Validate a Nepal phone number; show E.164, national form and carrier\n'));

  console.log(chalk.white('  ' + chalk.bold('address') + ' <localLevelId> <ward>  |  ' + chalk.bold('address search') + ' <text>'));
  console.log(chalk.dim('    Format an address, or look up provinces, districts and local levels\n'));

  console.log(chalk.white('  ' + chalk.bold('sms') + ' keys  |  ' + chalk.bold('sms') + ' <template> [name=value ...]'));
  console.log(chalk.dim('    List the built-in SMS templates, or render one and count its segments\n'));

  console.log(chalk.white('  ' + chalk.bold('fmt') + ' <BS date> <preset|pattern>'));
  console.log(chalk.dim('    Format a BS date, e.g. fmt 2082-05-10 "D MMMM YYYY" --lang ne\n'));

  console.log(chalk.white('  ' + chalk.bold('parse') + ' <date text>   ' + chalk.bold('fiscal') + ' <BS date>'));
  console.log(chalk.dim('    Read a date written many ways; find its fiscal year\n'));

  console.log(chalk.dim('  The commands from money on take --lang en|ne and --json.\n'));

  console.log(chalk.white('  ' + chalk.bold('help')));
  console.log(chalk.dim('    Show this help\n'));

  console.log(chalk.dim('  Examples:'));
  console.log(chalk.dim('    jhigu-patro today'));
  console.log(chalk.dim('    jhigu-patro ad2bs 2025-02-20'));
  console.log(chalk.dim('    jhigu-patro bs2ad 2082-11-08'));
  console.log(chalk.dim('    jhigu-patro month 2082 11'));
  console.log(chalk.dim('    jhigu-patro month'));
  console.log(chalk.dim('    jhigu-patro info 2082-11-08'));
  console.log(chalk.dim('    jhigu-patro money 1234567.5 --vat excl --words'));
  console.log(chalk.dim('    jhigu-patro phone 9841234567'));
  console.log(chalk.dim('    jhigu-patro address search Bhaktapur'));
  console.log(chalk.dim('    jhigu-patro sms appointment name=Ram date=2082-05-10 time=9:00 sender=Shop'));
  console.log(chalk.dim('    jhigu-patro fmt 2082-05-10 dual --json'));
  printDivider();
}

// ============================================================================
// ROUTER
// ============================================================================

const [,, cmd, arg1, arg2] = process.argv;

/** Run one of the tools commands: print its result, or its error, and exit. */
function runTool(name: string, rawArgs: string[]): void {
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter(a => a !== '--json');
  try {
    const out = TOOLS[name](args);
    if (json) console.log(JSON.stringify(out.data, null, 2));
    else for (const line of out.lines) console.log(line);
  } catch (e) {
    if (!(e instanceof CliError)) throw e;
    if (json) console.error(JSON.stringify({ error: { code: e.code, message: e.message } }));
    else console.error(chalk.red(`✖ ${e.message}`));
    process.exit(e.exit);
  }
}

if (cmd !== undefined && Object.prototype.hasOwnProperty.call(TOOLS, cmd)) {
  runTool(cmd, process.argv.slice(3));
  process.exit(0);
}

try {
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
      cmdInfo(process.argv.slice(3));
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
} catch (e) {
  // A date outside the calendar data or an invalid date: say so, no stack trace.
  if (e instanceof JhiguError) die(e.message);
  throw e;
}
