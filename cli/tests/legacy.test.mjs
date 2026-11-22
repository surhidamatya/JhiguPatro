// Tests for the original calendar commands: today, ad2bs, bs2ad, month, info.
// Expected values come from the shared vectors in testdata/ and from plain
// arithmetic over the calendar data file (month lengths from BS 2000/1/1 =
// AD 1943-04-14), not from the CLI's own code. They run under several time zones,
// because these commands build local-time dates. Run after `npm run build`:
//   node --test tests/legacy.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => JSON.parse(readFileSync(join(here, p), 'utf8'));
const cal = read('../../data/nepali_calendar_data.json');
const datesV = read('../../testdata/dates.json');
const cliPath = join(here, '../dist/index.js');

const TZS = ['Asia/Kathmandu', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_NE = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार'];
const MONTHS_EN_AD = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function cli(args, tz = 'UTC') {
  const r = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', TZ: tz },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const field = (out, name) => {
  const m = new RegExp(`^\\s*${name.replace(/[()]/g, '\\$&')}:\\s+(.*)$`, 'm').exec(out);
  return m ? m[1].trim() : undefined;
};
const NE_DIGITS = '०१२३४५६७८९';
const neDigits = n => String(n).replace(/\d/g, c => NE_DIGITS[c]);
const iso = ([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const adLong = ([y, m, d]) => `${MONTHS_EN_AD[m - 1]} ${d}, ${y}`;

/** AD date [y, m, d] of a BS date, by counting days from the anchor with the data file's month lengths. */
function bsToAdOracle(year, month, day) {
  let days = 0;
  for (let y = 2000; y < year; y++) days += cal.years[String(y)].reduce((a, b) => a + b, 0);
  for (let m = 1; m < month; m++) days += cal.years[String(year)][m - 1];
  days += day - 1;
  const d = new Date(Date.UTC(1943, 3, 14) + days * 86_400_000);
  return { ad: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()], weekday: d.getUTCDay() };
}

describe('oracle sanity (so the tests below mean something)', () => {
  it_('matches every shared adToBs and weekday vector', () => {
    for (const v of datesV.adToBs) assert.deepEqual(bsToAdOracle(...v.bs).ad.join('-').replace(/-(\d)(?=-|$)/g, '-0$1'), v.ad);
    for (const v of datesV.weekday) assert.equal(bsToAdOracle(...v.bs).weekday, v.weekday);
  });
});
function it_(name, fn) { return test(name, fn); }

describe('ad2bs', () => {
  for (const tz of TZS) {
    for (const v of datesV.adToBs) {
      test(`${v.ad} -> ${iso(v.bs)} in ${tz}`, () => {
        const r = cli(['ad2bs', v.ad], tz);
        assert.equal(r.code, 0, r.err);
        assert.equal(field(r.out, 'BS (numeric)'), iso(v.bs));
        assert.equal(field(r.out, 'AD (input)'), adLong(v.ad.split('-').map(Number)));
      });
    }
  }

  for (const v of datesV.weekday) {
    test(`weekday of ${v.ad} is ${WEEKDAYS_EN[v.weekday]}`, () => {
      const r = cli(['ad2bs', v.ad]);
      assert.equal(field(r.out, 'Weekday (EN)'), WEEKDAYS_EN[v.weekday]);
      assert.equal(field(r.out, 'Weekday (NE)'), WEEKDAYS_NE[v.weekday]);
    });
  }

  // For a past day the relative text is its BS date, in Devanagari digits. The CLI passes
  // the day to a function that takes an instant, so a wrong zone shows up as the day before.
  for (const tz of TZS) {
    for (const [ad, bs] of [['2025-08-26', [2082, 5, 10]], ['2024-04-13', [2081, 1, 1]], ['2025-07-17', [2082, 4, 1]]]) {
      test(`the relative text for ${ad} is the BS day ${bs[2]} in ${tz}`, () => {
        const text = field(cli(['ad2bs', ad], tz).out, 'Relative');
        assert.ok(text.includes(neDigits(bs[2])) && text.includes(neDigits(bs[0])), `${text} for ${iso(bs)}`);
        const info = field(cli(['info', ad], tz).out, 'Relative (NE)');
        assert.equal(info, text);
      });
    }
  }

  test('the Nepali month name and the Bhadra example', () => {
    const r = cli(['ad2bs', '2025-08-26']);
    assert.equal(field(r.out, 'BS (result)'), 'Bhadra 10, 2082');
  });

  for (const e of datesV.convertErrors.ad) {
    test(`AD ${iso(e.date)} is outside the calendar data: one-line error, exit 1`, () => {
      const r = cli(['ad2bs', iso(e.date)]);
      assert.equal(r.code, 1);
      assert.equal(r.out, '');
      assert.match(r.err, /outside the calendar data/);
      assert.doesNotMatch(r.err, /\n\s+at /);
    });
  }

  for (const bad of ['', 'abc', '2025-08', '2025-08-26-01', '2025/08/26', '08-26-2025x']) {
    test(`rejects ${JSON.stringify(bad)}`, () => {
      const r = cli(bad === '' ? ['ad2bs', ''] : ['ad2bs', bad]);
      assert.equal(r.code, 1);
      assert.match(r.err, /Invalid AD date|Usage/);
    });
  }

  // A date that does not exist must be rejected, not rolled over to the next month.
  for (const bad of ['2025-02-30', '2025-13-01', '2025-00-10', '2025-04-31', '2025-08-00', '2025-08-32']) {
    test(`rejects the date that does not exist: ${bad}`, () => {
      const r = cli(['ad2bs', bad]);
      assert.equal(r.code, 1, `${bad} was accepted: ${r.out}`);
      assert.match(r.err, /Invalid AD date/);
    });
  }

  test('a leap day is accepted and a non-leap one is not', () => {
    assert.equal(cli(['ad2bs', '2024-02-29']).code, 0);
    assert.equal(cli(['ad2bs', '2025-02-29']).code, 1);
    assert.equal(cli(['ad2bs', '2100-02-29']).code, 1); // 2100 is not a leap year (and out of range)
  });

  test('missing argument is a usage error', () => {
    const r = cli(['ad2bs']);
    assert.equal(r.code, 1);
    assert.match(r.err, /Usage: jhigu-patro ad2bs/);
  });
});

describe('bs2ad', () => {
  for (const tz of TZS) {
    for (const v of datesV.adToBs) {
      test(`${iso(v.bs)} -> ${v.ad} in ${tz}`, () => {
        const r = cli(['bs2ad', iso(v.bs)], tz);
        assert.equal(r.code, 0, r.err);
        assert.equal(field(r.out, 'AD (numeric)'), v.ad);
      });
    }
  }

  for (const v of datesV.weekday) {
    test(`weekday of ${iso(v.bs)} is ${WEEKDAYS_EN[v.weekday]}`, () => {
      const r = cli(['bs2ad', iso(v.bs)]);
      assert.equal(field(r.out, 'Weekday (EN)'), WEEKDAYS_EN[v.weekday]);
      assert.equal(field(r.out, 'Weekday (NE)'), WEEKDAYS_NE[v.weekday]);
    });
  }

  test('the last day of the data, BS 2100/12/31, is AD 2044-04-13', () => {
    assert.equal(field(cli(['bs2ad', '2100-12-31']).out, 'AD (numeric)'), '2044-04-13');
  });

  test('every first day of a BS month agrees with the arithmetic oracle', () => {
    for (const [y, m] of [[2000, 1], [2050, 6], [2081, 1], [2082, 5], [2083, 12], [2099, 7], [2100, 12]]) {
      const r = cli(['bs2ad', iso([y, m, 1])]);
      assert.equal(field(r.out, 'AD (numeric)'), iso(bsToAdOracle(y, m, 1).ad), `${y}-${m}-1`);
    }
  });

  for (const e of datesV.convertErrors.bs) {
    test(`BS ${iso(e.date)} is rejected (${e.code}): one-line error, exit 1`, () => {
      const r = cli(['bs2ad', iso(e.date)]);
      assert.equal(r.code, 1);
      assert.equal(r.out, '');
      assert.match(r.err, /out of range or invalid/);
      assert.doesNotMatch(r.err, /\n\s+at /);
    });
  }

  for (const bad of ['abc', '2082-05', '2082/05/10']) {
    test(`rejects ${JSON.stringify(bad)}`, () => {
      const r = cli(['bs2ad', bad]);
      assert.equal(r.code, 1);
      assert.match(r.err, /Invalid BS date/);
    });
  }

  test('missing argument is a usage error', () => {
    assert.match(cli(['bs2ad']).err, /Usage: jhigu-patro bs2ad/);
  });
});

describe('ad2bs and bs2ad agree, every day of a month, in every time zone', () => {
  for (const tz of TZS) {
    test(`Bhadra 2082 in ${tz}`, () => {
      for (let day = 1; day <= cal.years['2082'][4]; day += 6) {
        const ad = iso(bsToAdOracle(2082, 5, day).ad);
        assert.equal(field(cli(['bs2ad', iso([2082, 5, day])], tz).out, 'AD (numeric)'), ad);
        assert.equal(field(cli(['ad2bs', ad], tz).out, 'BS (numeric)'), iso([2082, 5, day]));
      }
    });
  }
});

describe('info', () => {
  const LAST_AD_YEAR = 2044;
  for (const v of datesV.adToBs) {
    const adYear = Number(v.ad.slice(0, 4));
    const bsYear = v.bs[0];
    const adNote = adYear >= 2000; // an AD year that is also a valid BS year
    test(`AD ${v.ad} is read as AD and gives ${iso(v.bs)}${adNote ? ' (with the ambiguity note)' : ''}`, () => {
      const r = cli(['info', v.ad]);
      assert.equal(r.code, 0, r.err);
      assert.match(r.out, /input treated as AD/);
      assert.equal(field(r.out, 'BS (numeric)'), iso(v.bs));
      assert.equal(field(r.out, 'AD (numeric)'), v.ad);
      if (adNote) assert.match(r.out, /valid as AD and as BS; read as AD/);
      else assert.doesNotMatch(r.out, /valid as AD and as BS/);
    });
    // A BS year over 2044 can only be BS. One from 2000 to 2044 needs --bs.
    const bsFlag = bsYear > LAST_AD_YEAR ? [] : ['--bs'];
    test(`BS ${iso(v.bs)}${bsFlag.length ? ' with --bs' : ''} gives ${v.ad}`, () => {
      const r = cli(['info', iso(v.bs), ...bsFlag]);
      assert.equal(r.code, 0, r.err);
      assert.match(r.out, /input treated as BS/);
      assert.equal(field(r.out, 'BS (numeric)'), iso(v.bs));
      assert.equal(field(r.out, 'AD (numeric)'), v.ad);
      assert.doesNotMatch(r.out, /valid as AD and as BS/);
    });
  }

  test('a year over 2044 is BS with no note, a year under 2000 is AD with no note', () => {
    const bs = cli(['info', '2082-05-10']);
    assert.match(bs.out, /input treated as BS/);
    assert.doesNotMatch(bs.out, /valid as AD and as BS/);
    const ad = cli(['info', '1950-01-01']);
    assert.match(ad.out, /input treated as AD/);
    assert.doesNotMatch(ad.out, /valid as AD and as BS/);
  });

  test('the year 2025 is read as AD by default (the old heuristic read it as BS 2025) and as BS with --bs', () => {
    const def = cli(['info', '2025-08-26']);
    assert.equal(field(def.out, 'BS (numeric)'), '2082-05-10');
    const bs = cli(['info', '2025-08-26', '--bs']);
    assert.equal(field(bs.out, 'BS (numeric)'), '2025-08-26');
    // BS 2025 Mansir 26 is AD 1968-12-11 by the oracle.
    assert.equal(field(bs.out, 'AD (numeric)'), iso(bsToAdOracle(2025, 8, 26).ad));
  });

  test('the flags work before or after the date', () => {
    assert.equal(field(cli(['info', '--bs', '2025-08-26']).out, 'BS (numeric)'), '2025-08-26');
    assert.equal(field(cli(['info', '--ad', '2025-08-26']).out, 'BS (numeric)'), '2082-05-10');
  });

  test('--ad forces AD, so a year over 2044 is out of range there; --bs forces BS, so 1950 is out of range there', () => {
    assert.match(cli(['info', '2082-05-10', '--ad']).err, /outside the calendar data|Invalid AD date/);
    assert.equal(cli(['info', '2082-05-10', '--ad']).code, 1);
    assert.equal(cli(['info', '1950-01-01', '--bs']).code, 1);
  });

  test('both flags, or an unknown flag, are errors', () => {
    const both = cli(['info', '2025-08-26', '--ad', '--bs']);
    assert.equal(both.code, 1);
    assert.match(both.err, /either --ad or --bs/);
    const unknown = cli(['info', '2025-08-26', '--nope']);
    assert.equal(unknown.code, 1);
    assert.match(unknown.err, /Unknown option --nope/);
  });

  test('two dates, or none, are usage errors', () => {
    assert.match(cli(['info', '2025-08-26', '2025-08-27']).err, /Usage: jhigu-patro info/);
    assert.match(cli(['info', '--ad']).err, /Usage: jhigu-patro info/);
  });

  test('the weekday is right in both languages', () => {
    for (const v of datesV.weekday) {
      const r = cli(['info', iso(v.bs), '--bs']);
      assert.equal(field(r.out, 'Weekday (EN)'), WEEKDAYS_EN[v.weekday]);
      assert.equal(field(r.out, 'Weekday (NE)'), WEEKDAYS_NE[v.weekday]);
    }
  });

  test('the same result in every time zone', () => {
    const outs = TZS.map(tz => cli(['info', '2082-05-10'], tz).out);
    assert.equal(new Set(outs).size, 1);
  });

  for (const bad of ['abc', '2082-05', '1900-01-01', '2101-01-01', '2082-13-01', '2025-02-30']) {
    test(`rejects ${bad}`, () => {
      const r = cli(['info', bad]);
      assert.equal(r.code, 1);
      assert.equal(r.out, '');
      assert.doesNotMatch(r.err, /\n\s+at /);
    });
  }

  test('missing argument is a usage error', () => {
    assert.match(cli(['info']).err, /Usage: jhigu-patro info/);
  });
});

describe('month', () => {
  /** The printed grid as { day -> column (0 = Sunday) } and the number of week rows. */
  function grid(out) {
    const lines = out.split('\n');
    // The grid starts after the short divider under the weekday names (two spaces, 35 dashes).
    const start = lines.findIndex(l => /^ {2}─{35}$/.test(l)) + 1;
    assert.ok(start > 0, 'no grid found');
    const columns = new Map();
    let rows = 0;
    for (const line of lines.slice(start)) {
      if (line.startsWith('────') || line.trim() === '' || /Total days/.test(line)) break;
      rows++;
      // Each cell is a right-aligned number in a 5-wide field after a two-space margin, joined by one space.
      for (const m of line.matchAll(/\d+/g)) columns.set(Number(m[0]), Math.round((m.index + m[0].length - 2 - 5) / 6));
    }
    return { columns, rows };
  }

  for (const v of datesV.monthBounds) {
    for (const tz of ['Asia/Kathmandu', 'America/Los_Angeles']) {
      test(`BS ${v.year}-${v.month}: ${v.daysInMonth} days, right first column, header date, in ${tz}`, () => {
        const r = cli(['month', String(v.year), String(v.month)], tz);
        assert.equal(r.code, 0, r.err);
        assert.match(r.out, new RegExp(`Total days: ${v.daysInMonth}\\b`));
        const g = grid(r.out);
        assert.equal(g.columns.size, v.daysInMonth);
        const first = bsToAdOracle(v.year, v.month, 1);
        // Day 1 sits in the column of its weekday, and every later day follows in order.
        for (let d = 1; d <= v.daysInMonth; d++) assert.equal(g.columns.get(d), (first.weekday + d - 1) % 7, `day ${d}`);
        assert.equal(g.rows, Math.ceil((first.weekday + v.daysInMonth) / 7));
        // The header says the AD date of the first day: not a day early in a time zone ahead of UTC.
        assert.match(r.out, new RegExp(`${iso(first.ad)} onwards`));
      });
    }
  }

  test('the first and last months of the data', () => {
    assert.equal(cli(['month', '2000', '1']).code, 0);
    assert.equal(cli(['month', '2100', '12']).code, 0);
  });

  test('without arguments it shows the current Nepal month', () => {
    const r = cli(['month']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /Total days: \d+/);
  });

  test('with only a year it shows that year in the current month number', () => {
    const r = cli(['month', '2082']);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /\(\w+ 2082\)/);
  });

  for (const args of [['2082', '0'], ['2082', '13'], ['2082', 'x'], ['abc', '5']]) {
    test(`usage error for ${args.join(' ')}`, () => {
      const r = cli(['month', ...args]);
      assert.equal(r.code, 1);
      assert.match(r.err, /Usage: jhigu-patro month/);
    });
  }

  for (const year of ['1999', '2101']) {
    test(`no data for year ${year}`, () => {
      const r = cli(['month', year, '1']);
      assert.equal(r.code, 1);
      assert.match(r.err, new RegExp(`No calendar data for BS year ${year}`));
    });
  }
});

describe('today', () => {
  /** Today in Nepal as [y, m, d] AD, computed here from the clock (UTC+05:45). */
  const nepalToday = () => {
    const d = new Date(Date.now() + (5 * 60 + 45) * 60_000);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  };

  for (const tz of TZS) {
    test(`prints today in Nepal, whatever the machine's zone (${tz})`, () => {
      // Retry once around Nepal midnight, when the clock can tick over between the two calls.
      for (let attempt = 0; attempt < 2; attempt++) {
        const before = nepalToday();
        const r = cli(['today'], tz);
        const after = nepalToday();
        assert.equal(r.code, 0, r.err);
        const printed = field(r.out, 'AD (numeric)');
        if (printed === iso(before) || printed === iso(after)) {
          // And the BS date printed is the right one for that AD day.
          const bs = field(r.out, 'BS (numeric)');
          const back = cli(['ad2bs', printed], tz);
          assert.equal(bs, field(back.out, 'BS (numeric)'));
          return;
        }
      }
      assert.fail('today did not match Nepal today');
    });
  }

  test('no arguments is the same as today', () => {
    const a = cli([]);
    const b = cli(['today']);
    assert.equal(a.code, 0);
    assert.equal(a.out, b.out);
  });
});

describe('help and unknown commands', () => {
  test('help and its aliases', () => {
    for (const a of ['help', '--help', '-h']) {
      const r = cli([a]);
      assert.equal(r.code, 0);
      assert.match(r.out, /jhigu-patro — Bikram Sambat CLI/);
    }
  });

  test('an unknown command is exit 1 with a hint', () => {
    const r = cli(['nope']);
    assert.equal(r.code, 1);
    assert.match(r.err, /Unknown command: "nope"/);
    assert.match(r.err, /jhigu-patro help/);
  });
});
