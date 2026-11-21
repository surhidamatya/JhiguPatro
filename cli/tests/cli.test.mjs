// Tests for the CLI's tools commands. The vector sweeps run the command modules
// in-process against the shared vectors in testdata/ (the same ones the TS and Dart
// libraries use); the end-to-end tests spawn the built CLI for output, exit codes and
// time zones. Run after `npm run build`:  node --test tests/cli.test.mjs
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import { TOOLS, CliError } from '../dist/tools.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => JSON.parse(readFileSync(join(here, p), 'utf8'));
const cal = read('../../data/nepali_calendar_data.json');
const phoneV = read('../../testdata/phone.json');
const moneyV = read('../../testdata/money.json');
const datesV = read('../../testdata/dates.json');
const addrV = read('../../testdata/address.json');
const smsV = read('../../testdata/sms.json');
const cliPath = join(here, '../dist/index.js');

before(() => {
  initializeCalendar(new InlineCalendarDataSource(
    cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));
});

const iso = ([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Run a tools command and return its result, or the CliError it throws. */
function run(cmd, args) {
  try {
    return TOOLS[cmd](args);
  } catch (e) {
    if (e instanceof CliError) return e;
    throw e;
  }
}
const failed = (r, code, exit = 1) => {
  assert.ok(r instanceof CliError, `expected an error, got ${JSON.stringify(r)}`);
  assert.equal(r.code, code);
  assert.equal(r.exit, exit);
};

/** Run the real CLI. */
function cli(args, env = {}) {
  const r = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe('phone (shared vectors)', () => {
  for (const v of phoneV.valid) {
    test(`valid ${JSON.stringify(v.in)}`, () => {
      const r = run('phone', v.allowInactive ? [v.in, '--allow-inactive'] : [v.in]);
      assert.equal(r.data.e164, v.e164);
      assert.equal(r.data.national, v.national);
      assert.equal(r.data.type, v.type);
      assert.equal(r.data.carrier, v.carrier ?? null);
    });
  }
  for (const v of phoneV.invalid) {
    test(`invalid ${JSON.stringify(v.in)}`, () => failed(run('phone', [v.in]), v.code));
  }
  test('--allow-inactive and the language of the error', () => {
    const r = run('phone', ['98412', '--lang', 'ne']);
    failed(r, 'TOO_SHORT');
    assert.match(r.message, /[ऀ-ॿ]/); // Nepali text, not the English message
  });
});

describe('money (shared vectors)', () => {
  for (const v of moneyV.parse.valid) {
    test(`parse ${JSON.stringify(v.in)}`, () => assert.equal(run('money', [v.in]).data.paisa, v.paisa));
  }
  for (const v of moneyV.parse.invalid) {
    // Includes inputs like "-5.5" that start with a minus: an amount, not an option.
    test(`reject ${JSON.stringify(v.in)}`, () => failed(run('money', [v.in]), v.code));
  }
  const rate = bp => String(bp / 100);
  const amount = paisa => (paisa / 100).toFixed(2);
  for (const v of moneyV.vatExclusive) {
    test(`vat excl ${v.paisa} at ${v.bp}`, () => {
      const r = run('money', [amount(v.paisa), '--vat', 'excl', '--rate', rate(v.bp)]);
      assert.deepEqual([r.data.vat.subtotal, r.data.vat.vat, r.data.vat.total], [v.subtotal, v.vat, v.total]);
    });
  }
  for (const v of moneyV.vatInclusive) {
    test(`vat incl ${v.paisa} at ${v.bp}`, () => {
      const r = run('money', [amount(v.paisa), '--vat', 'incl', '--rate', rate(v.bp)]);
      assert.deepEqual([r.data.vat.subtotal, r.data.vat.vat, r.data.vat.total], [v.subtotal, v.vat, v.total]);
    });
  }
  test('lakh grouping, the symbol, Devanagari and the words (values worked out by hand)', () => {
    const r = run('money', ['1234567.5', '--words']);
    assert.equal(r.data.formatted, 'Rs. 12,34,567.50');
    assert.equal(r.data.plain, '12,34,567.50');
    assert.equal(r.data.devanagari, 'रु १२,३४,५६७.५०');
    assert.equal(r.data.words, 'Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paisa Only');
  });
  test('VAT 13% added to Rs. 1,234,567.50 (Python Decimal, half up)', () => {
    const r = run('money', ['1234567.50', '--vat', 'excl']);
    assert.deepEqual([r.data.vat.vat, r.data.vat.total], [16049378, 139506128]);
  });
  test('VAT 13% inside Rs. 1,130.00 gives 1,000.00 and 130.00', () => {
    const r = run('money', ['1130', '--vat', 'incl']);
    assert.deepEqual([r.data.vat.subtotal, r.data.vat.vat], [100000, 13000]);
  });
  test('--rate takes up to two decimals: 13.5 is 1350 basis points, 6.25 is 625, 0.5 is 50', () => {
    for (const [rate, bp] of [['13.5', 1350], ['6.25', 625], ['0.5', 50], ['13', 1300], ['100', 10000]]) {
      assert.equal(run('money', ['1000', '--vat', 'excl', '--rate', rate]).data.vat.rateBp, bp, rate);
    }
    // 1000.00 at 13.5% is 135.00 (hand check)
    assert.equal(run('money', ['1000', '--vat', 'excl', '--rate', '13.5']).data.vat.vat, 13500);
    for (const bad of ['13.555', '-1', '1000', '', 'abc', '13,5']) failed(run('money', ['5', '--vat', 'excl', '--rate', bad]), 'USAGE', 2);
  });
  test('a negative amount is an amount, not an option', () => {
    assert.equal(run('money', ['-1500.5']).data.paisa, -150050);
    assert.equal(run('money', ['-Rs. 5']).data.paisa, -500);
    assert.equal(run('money', ['-1000', '--vat', 'incl']).data.vat.total, -100000);
  });
  test('--lang ne shows Devanagari digits in the formatted amount', () => {
    assert.equal(run('money', ['1500', '--lang', 'ne']).data.formatted, 'Rs. १,५००.००');
  });
  test('usage errors are exit 2', () => {
    failed(run('money', []), 'USAGE', 2);
    failed(run('money', ['1', '2']), 'USAGE', 2);
    failed(run('money', ['5', '--vat', 'maybe']), 'USAGE', 2);
    failed(run('money', ['5', '--vat', 'excl', '--rate', 'x']), 'USAGE', 2);
    failed(run('money', ['5', '--bogus']), 'USAGE', 2);
    failed(run('money', ['5', '--lang', 'fr']), 'USAGE', 2);
  });
});

describe('dates: parse, fmt, fiscal (shared vectors)', () => {
  for (const v of datesV.parse) {
    test(`parse ${JSON.stringify(v.in)}`, () => assert.equal(run('parse', [v.in]).data.bs, iso(v.bs)));
  }
  for (const text of datesV.parseInvalid) {
    test(`parse rejects ${JSON.stringify(text)}`, () => {
      const r = run('parse', text === '' ? [''] : [text]);
      // An empty or blank argument is a usage error only when it is missing; "" is given.
      failed(r, 'PARSE_ERROR');
    });
  }
  for (const v of datesV.formatTokens) {
    test(`fmt ${v.pattern} ${v.lang} ${iso(v.bs)}`, () => {
      assert.equal(run('fmt', [iso(v.bs), v.pattern, '--lang', v.lang]).data.text, v.out);
    });
  }
  for (const v of datesV.formatPresets.filter(p => p.preset !== 'relative')) {
    test(`fmt preset ${v.preset} ${v.lang} ${iso(v.bs)}`, () => {
      assert.equal(run('fmt', [iso(v.bs), v.preset, '--lang', v.lang]).data.text, v.out);
    });
  }
  for (const v of datesV.fiscal) {
    test(`fiscal ${iso(v.bs)}`, () => {
      const d = run('fiscal', [iso(v.bs)]).data;
      assert.equal(d.code, v.code);
      assert.equal(d.first, iso(v.first));
      assert.equal(d.last, iso(v.last));
    });
  }
  for (const v of datesV.fiscalInvalid) {
    // A date that does not exist cannot even be read from text, so the CLI reports
    // PARSE_ERROR where the library, given fields, says INVALID_DATE.
    const code = v.code === 'INVALID_DATE' ? 'PARSE_ERROR' : v.code;
    test(`fiscal rejects ${iso(v.bs)}`, () => failed(run('fiscal', [iso(v.bs)]), code));
  }
  test('--digits ascii keeps ASCII digits in Nepali', () => {
    assert.equal(run('fmt', ['2082-05-10', 'D MMMM YYYY', '--lang', 'ne', '--digits', 'ascii']).data.text, '10 भदौ 2082');
  });
  test('usage errors are exit 2', () => {
    failed(run('fmt', ['2082-05-10']), 'USAGE', 2);
    failed(run('fmt', ['2082-05-10', 'YYYY', '--digits', 'x']), 'USAGE', 2);
    failed(run('parse', []), 'USAGE', 2);
    failed(run('fiscal', []), 'USAGE', 2);
  });
});

describe('address (shared vectors)', () => {
  for (const v of addrV.format.valid) {
    test(`format ${v.parts.localLevelId} ward ${v.parts.ward} ${v.language}`, () => {
      const args = [String(v.parts.localLevelId), String(v.parts.ward), '--lang', v.language];
      if (v.parts.tole) args.push('--tole', v.parts.tole);
      if (v.parts.street) args.push('--street', v.parts.street);
      assert.equal(run('address', args).data.formatted, v.out);
    });
  }
  for (const v of addrV.format.invalid) {
    test(`format rejects ${JSON.stringify(v.parts)}`, () => {
      failed(run('address', [String(v.parts.localLevelId), String(v.parts.ward)]), v.code);
    });
  }
  for (const v of addrV.search) {
    test(`search ${JSON.stringify(v.query)}`, () => {
      const args = ['search', v.query, '--limit', String(v.limit ?? 50)];
      if (v.language) args.push('--in', v.language);
      const got = run('address', args).data.map(m => [m.kind, m.id, m.rank]);
      assert.deepEqual(got, v.expect.map(([kind, id, , rank]) => [kind, id, rank]));
    });
  }
  test('a negative or fractional ward is the library error, not a usage error', () => {
    failed(run('address', ['274', '-1']), 'BAD_WARD');
    failed(run('address', ['274', '1.5']), 'BAD_WARD');
    failed(run('address', ['274', '0']), 'BAD_WARD');
    failed(run('address', ['999999', '1']), 'UNKNOWN_LOCAL_LEVEL');
  });
  test('the ward count is reported', () => {
    assert.equal(run('address', ['274', '3']).data.wards, 10);
  });
  test('usage errors are exit 2', () => {
    failed(run('address', []), 'USAGE', 2);
    failed(run('address', ['274']), 'USAGE', 2);
    failed(run('address', ['abc', '3']), 'USAGE', 2);
    failed(run('address', ['274', 'x']), 'USAGE', 2);
    failed(run('address', ['', '3']), 'USAGE', 2);
    failed(run('address', ['search']), 'USAGE', 2);
    failed(run('address', ['search', 'x', '--limit', '-1']), 'USAGE', 2);
    failed(run('address', ['search', 'x', '--limit', 'many']), 'USAGE', 2);
    failed(run('address', ['search', 'x', '--in', 'fr']), 'USAGE', 2);
  });
});

describe('sms (shared vectors)', () => {
  for (const t of smsV.templates) {
    test(`${t.key} ${t.language}`, () => {
      const pairs = Object.entries(t.values).filter(([k]) => t.placeholders.includes(k)).map(([k, v]) => `${k}=${v}`);
      const r = run('sms', [t.key, ...pairs, '--lang', t.language]);
      assert.equal(r.data.text, t.expect);
    });
  }
  test('segments: an English message is 1 segment of GSM text, a Nepali one is UCS-2', () => {
    const en = run('sms', ['appointment', 'name=Ram', 'date=2082-05-10', 'time=9:00', 'sender=Shop']).data;
    assert.deepEqual([en.encoding, en.units, en.segments], ['gsm7', 69, 1]); // 69 characters, counted in Python
    const ne = run('sms', ['appointment', 'name=राम', 'date=2082-05-10', 'time=9:00', 'sender=Shop', '--lang', 'ne']).data;
    assert.equal(ne.encoding, 'ucs2');
  });
  test('keys lists the templates and their placeholders', () => {
    const keys = run('sms', ['keys']).data;
    assert.deepEqual(keys.map(k => k.key), ['rentDue', 'udhaaro', 'appointment']);
    assert.deepEqual(keys[2].placeholders, ['name', 'date', 'time', 'sender']);
  });
  test('a missing value names the placeholder; an unknown template is rejected', () => {
    const r = run('sms', ['appointment', 'name=Ram']);
    failed(r, 'MISSING_VALUE');
    assert.match(r.message, /\(date\)/);
    failed(run('sms', ['nope']), 'UNKNOWN_TEMPLATE');
  });
  test('usage errors are exit 2', () => {
    failed(run('sms', []), 'USAGE', 2);
    failed(run('sms', ['appointment', 'novalue']), 'USAGE', 2);
    failed(run('sms', ['appointment', '=x']), 'USAGE', 2);
  });
});

describe('the built CLI', () => {
  test('money prints the human text', () => {
    const r = cli(['money', '1234567.5', '--vat', 'excl']);
    assert.equal(r.code, 0);
    assert.match(r.out, /Amount: +Rs\. 12,34,567\.50/);
    assert.match(r.out, /VAT: +Rs\. 1,60,493\.78/);
    assert.match(r.out, /Total: +Rs\. 13,95,061\.28/);
  });

  test('--json prints exactly the data, and works in any position', () => {
    for (const args of [['phone', '9841234567', '--json'], ['phone', '--json', '9841234567']]) {
      const r = cli(args);
      assert.equal(r.code, 0);
      assert.deepEqual(JSON.parse(r.out), { e164: '+9779841234567', national: '984-1234567', type: 'mobile', carrier: 'NTC', areaCode: null });
    }
  });

  test('a rejected input is exit 1 with the message on stderr and nothing on stdout', () => {
    const r = cli(['phone', '98412']);
    assert.equal(r.code, 1);
    assert.equal(r.out, '');
    assert.match(r.err, /Phone number is too short/);
  });

  test('with --json the error is JSON on stderr', () => {
    const r = cli(['phone', '98412', '--json']);
    assert.equal(r.code, 1);
    assert.deepEqual(JSON.parse(r.err), { error: { code: 'TOO_SHORT', message: 'Phone number is too short' } });
  });

  test('a usage error is exit 2', () => {
    const r = cli(['money']);
    assert.equal(r.code, 2);
    assert.match(r.err, /Usage: jhigu-patro money/);
    assert.equal(cli(['money', '5', '--nope']).code, 2);
  });

  test('errors follow --lang', () => {
    assert.match(cli(['phone', '98412', '--lang', 'ne']).err, /फोन नम्बर धेरै छोटो छ/);
  });

  test('no stack trace is ever printed for bad input', () => {
    for (const args of [['phone', 'abc'], ['money', 'x'], ['fmt', '2082-13-45', 'YYYY'], ['address', '1', '999'], ['sms', 'nope'], ['parse', 'not a date']]) {
      const r = cli(args);
      assert.ok(r.code === 1 || r.code === 2, args.join(' '));
      assert.doesNotMatch(r.err, /\n\s+at /);
    }
  });

  test('help lists the new commands and the old ones still work', () => {
    const help = cli(['help']).out;
    for (const c of ['money', 'phone', 'address', 'sms', 'fmt', 'parse', 'fiscal']) assert.match(help, new RegExp(`\\b${c}\\b`));
    const r = cli(['ad2bs', '2025-08-26']);
    assert.equal(r.code, 0);
    assert.match(r.out, /2082/);
  });

  test('an unknown command is still an error, including names that exist on every object', () => {
    for (const name of ['frobnicate', 'toString', 'constructor', 'hasOwnProperty', '__proto__']) {
      const r = cli([name]);
      assert.equal(r.code, 1, name);
      assert.match(r.err, /Unknown command/, name);
    }
  });

  // parse prints the AD date too; it must not move with the machine's time zone.
  for (const tz of ['Asia/Kathmandu', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    test(`parse gives the same AD date in ${tz}`, () => {
      const r = cli(['parse', '2082-05-10', '--json'], { TZ: tz });
      assert.deepEqual(JSON.parse(r.out), { bs: '2082-05-10', year: 2082, month: 5, day: 10, ad: '2025-08-26' });
    });
  }
});
