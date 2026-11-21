/**
 * The non-calendar commands of the CLI: money, phone, address, sms, fmt, parse
 * and fiscal. Each command gets its arguments and returns `{ data, lines }`:
 * `data` is what `--json` prints, `lines` is the human text. Nothing here prints
 * or exits; `index.ts` does that. Errors are thrown as `CliError`.
 *
 * Exit codes: 0 ok, 1 the input was rejected by the library (bad amount, phone,
 * date, ...), 2 the command was used wrongly (missing or unknown argument).
 */
import { parseArgs } from 'node:util';
import {
  Npr, MoneyError, amountInWords, vatExclusive, vatInclusive,
  parsePhone, PhoneError,
  JhiguError, parseNepaliDate, formatDate, formatPreset, fiscalYear, NepaliDate,
} from 'jhigu-patro-utils-ts';
import type { DatePreset, Language } from 'jhigu-patro-utils-ts';
import {
  AddressError, formatAddress, searchAddress, getLocalLevel, getDistrict, getProvince,
} from 'jhigu-patro-utils-ts/address';
import {
  SmsTemplateError, smsTemplateKeys, getSmsTemplate, templatePlaceholders, renderSmsTemplate, smsSegments,
} from 'jhigu-patro-utils-ts/sms';

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exit: 1 | 2,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export interface ToolResult {
  data: unknown;
  lines: string[];
}

const usage = (text: string): never => {
  throw new CliError(`Usage: jhigu-patro ${text}`, 2, 'USAGE');
};

const PRESETS: readonly DatePreset[] = [
  'full', 'long', 'iso', 'slash', 'dmy', 'short', 'monthYear', 'gate', 'dual', 'relative', 'fiscal',
];

function language(value: unknown): Language {
  if (value === undefined) return 'en';
  if (value === 'en' || value === 'ne') return value;
  throw new CliError(`--lang must be "en" or "ne", not "${String(value)}"`, 2, 'USAGE');
}

/** Turn a library error into a CliError with the message in the chosen language. */
function rethrow(e: unknown, lang: Language): never {
  if (e instanceof CliError) throw e;
  if (e instanceof MoneyError || e instanceof PhoneError || e instanceof AddressError || e instanceof SmsTemplateError) {
    const detail = e instanceof SmsTemplateError && e.key ? ` (${e.key})` : '';
    throw new CliError(`${e.localized(lang)}${detail}`, 1, e.code);
  }
  if (e instanceof JhiguError) throw new CliError(e.localized(lang), 1, e.code);
  throw e;
}

/**
 * An argument such as `-5`, `-.5` or `-Rs. 5` is a negative amount, not an option.
 * Swap those for placeholders while the options are read, then swap them back.
 */
const NEGATIVE = /^-{1,2}\s*(?:\d|\.\d|rs\b|npr\b|रु|रू)/i;

function parse<T extends Record<string, { type: 'string' | 'boolean' }>>(args: string[], options: T) {
  const held: string[] = [];
  const safe = args.map(a => {
    if (!NEGATIVE.test(a)) return a;
    held.push(a);
    return `\u0000${held.length - 1}`;
  });
  try {
    const r = parseArgs({ args: safe, options: { lang: { type: 'string' }, ...options }, allowPositionals: true, strict: true });
    const back = (x: string) => (x.startsWith('\u0000') ? held[Number(x.slice(1))] : x);
    return { values: r.values, positionals: r.positionals.map(back) };
  } catch (e) {
    throw new CliError((e as Error).message.replace(/\. To specify.*$/, ''), 2, 'USAGE');
  }
}

/** Basis points from a percent like `13` or `13.5` (at most two decimals). */
function percentToBp(text: string): number {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) throw new CliError(`--rate must be a percent such as 13 or 13.5, not "${text}"`, 2, 'USAGE');
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}

// ── money ────────────────────────────────────────────────────────────────────

export function money(args: string[]): ToolResult {
  const { values, positionals } = parse(args, {
    vat: { type: 'string' }, rate: { type: 'string' }, words: { type: 'boolean' },
  });
  const lang = language(values.lang);
  if (positionals.length !== 1) usage('money <amount> [--vat excl|incl] [--rate 13] [--words] [--lang en|ne]');
  if (values.vat !== undefined && values.vat !== 'excl' && values.vat !== 'incl') {
    throw new CliError('--vat must be "excl" (price without VAT) or "incl" (price with VAT)', 2, 'USAGE');
  }
  try {
    const amount = Npr.parse(positionals[0]);
    const data: Record<string, unknown> = {
      paisa: amount.paisa,
      formatted: amount.format({ symbol: 'Rs.', decimals: 'always', devanagari: lang === 'ne' }),
      plain: amount.format({ decimals: 'always' }),
      devanagari: amount.format({ symbol: 'रु', decimals: 'always', devanagari: true }),
    };
    const lines = [
      `Amount:       ${data.formatted}`,
      `Paisa:        ${amount.paisa}`,
      `Devanagari:   ${data.devanagari}`,
    ];
    if (values.words) {
      data.words = amountInWords(amount, { language: lang });
      lines.push(`In words:     ${data.words}${lang === 'ne' ? ' (Nepali words: not native-speaker reviewed)' : ''}`);
    }
    if (values.vat) {
      const bp = values.rate === undefined ? 1300 : percentToBp(values.rate);
      const r = values.vat === 'excl' ? vatExclusive(amount, bp) : vatInclusive(amount, bp);
      const f = (n: Npr) => n.format({ symbol: 'Rs.', decimals: 'always', devanagari: lang === 'ne' });
      data.vat = {
        mode: values.vat, rateBp: bp,
        subtotal: r.subtotal.paisa, vat: r.vat.paisa, total: r.total.paisa,
      };
      lines.push(
        '',
        `VAT ${bp / 100}% (${values.vat === 'excl' ? 'added to the price' : 'inside the price'}):`,
        `  Subtotal:   ${f(r.subtotal)}`,
        `  VAT:        ${f(r.vat)}`,
        `  Total:      ${f(r.total)}`,
      );
    }
    return { data, lines };
  } catch (e) {
    return rethrow(e, lang);
  }
}

// ── phone ────────────────────────────────────────────────────────────────────

export function phone(args: string[]): ToolResult {
  const { values, positionals } = parse(args, { 'allow-inactive': { type: 'boolean' } });
  const lang = language(values.lang);
  if (positionals.length !== 1) usage('phone <number> [--allow-inactive] [--lang en|ne]');
  try {
    const p = parsePhone(positionals[0], { allowInactive: values['allow-inactive'] === true });
    const data = { e164: p.e164, national: p.national, type: p.type, carrier: p.carrier, areaCode: p.areaCode ?? null };
    const lines = [
      `E.164:        ${p.e164}`,
      `National:     ${p.national}`,
      `Type:         ${p.type}`,
    ];
    if (p.carrier) lines.push(`Carrier:      ${p.carrier}`);
    if (p.areaCode) lines.push(`Area code:    ${p.areaCode}`);
    return { data, lines };
  } catch (e) {
    return rethrow(e, lang);
  }
}

// ── address ──────────────────────────────────────────────────────────────────

export function address(args: string[]): ToolResult {
  const { values, positionals } = parse(args, {
    tole: { type: 'string' }, street: { type: 'string' }, limit: { type: 'string' }, in: { type: 'string' },
  });
  const lang = language(values.lang);
  const text = 'address <localLevelId> <ward> [--tole T] [--street S] [--lang en|ne]\n       jhigu-patro address search <text> [--limit 10] [--in auto|en|ne]';
  try {
    if (positionals[0] === 'search') {
      if (positionals.length < 2) usage(text);
      const limit = values.limit === undefined ? 10 : Number(values.limit);
      if (!Number.isInteger(limit) || limit < 0) throw new CliError('--limit must be a whole number, 0 or more', 2, 'USAGE');
      const within = values.in ?? 'auto';
      if (within !== 'auto' && within !== 'en' && within !== 'ne') {
        throw new CliError('--in must be "auto", "en" or "ne" (the language of the names to search)', 2, 'USAGE');
      }
      const found = searchAddress(positionals.slice(1).join(' '), { limit, language: within });
      const data = found.map(m => ({ kind: m.kind, id: m.id, en: m.en, ne: m.ne, rank: m.rank }));
      const lines = found.length
        ? found.map(m => `${m.kind.padEnd(10)} ${String(m.id).padStart(4)}  ${lang === 'ne' ? m.ne : m.en}`)
        : ['No match.'];
      return { data, lines };
    }
    if (positionals.length !== 2) usage(text);
    const id = Number(positionals[0]);
    const ward = Number(positionals[1]);
    // Not a number at all is a usage error; a number the library does not accept
    // (a ward of 0, -1 or 1.5, an unknown id) is the library's typed error.
    if (Number.isNaN(id) || Number.isNaN(ward) || positionals[0].trim() === '' || positionals[1].trim() === '') {
      throw new CliError('The local level id and the ward must be numbers', 2, 'USAGE');
    }
    const formatted = formatAddress({ localLevelId: id, ward, tole: values.tole, street: values.street }, lang);
    const ll = getLocalLevel(id)!;
    const district = getDistrict(ll.districtId)!;
    const province = getProvince(district.provinceId)!;
    return {
      data: { formatted, localLevelId: id, ward, wards: ll.wards, districtId: district.id, provinceId: province.id },
      lines: [formatted],
    };
  } catch (e) {
    return rethrow(e, lang);
  }
}

// ── sms ──────────────────────────────────────────────────────────────────────

export function sms(args: string[]): ToolResult {
  const { values, positionals } = parse(args, {});
  const lang = language(values.lang);
  const text = 'sms keys\n       jhigu-patro sms <template> [name=value ...] [--lang en|ne]';
  try {
    if (positionals.length === 0) usage(text);
    if (positionals[0] === 'keys') {
      const data = smsTemplateKeys.map(key => ({
        key, placeholders: templatePlaceholders(getSmsTemplate(key, lang)),
      }));
      return { data, lines: data.map(d => `${d.key.padEnd(12)} ${d.placeholders.join(', ')}`) };
    }
    const [key, ...pairs] = positionals;
    const vals: Record<string, string> = {};
    for (const p of pairs) {
      const i = p.indexOf('=');
      if (i < 1) throw new CliError(`"${p}" is not name=value`, 2, 'USAGE');
      vals[p.slice(0, i)] = p.slice(i + 1);
    }
    const message = renderSmsTemplate(key, lang, vals);
    const seg = smsSegments(message);
    return {
      data: { text: message, encoding: seg.encoding, units: seg.units, segments: seg.segments },
      lines: [message, '', `${seg.encoding}, ${seg.units} units, ${seg.segments} segment${seg.segments === 1 ? '' : 's'}`],
    };
  } catch (e) {
    return rethrow(e, lang);
  }
}

// ── fmt, parse, fiscal ───────────────────────────────────────────────────────

const iso = (d: { year: number; month: number; day: number }) =>
  `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;

export function fmt(args: string[]): ToolResult {
  const { values, positionals } = parse(args, { digits: { type: 'string' } });
  const lang = language(values.lang);
  if (positionals.length !== 2) {
    usage(`fmt <BS date> <preset|pattern> [--digits native|ascii] [--lang en|ne]\n       presets: ${PRESETS.join(', ')}\n       pattern tokens: YYYY YY MMMM MMM MM M DD D dddd ddd`);
  }
  if (values.digits !== undefined && values.digits !== 'native' && values.digits !== 'ascii') {
    throw new CliError('--digits must be "native" or "ascii"', 2, 'USAGE');
  }
  try {
    const date = parseNepaliDate(positionals[0]);
    const what = positionals[1];
    const text = (PRESETS as readonly string[]).includes(what)
      ? formatPreset(date, what as DatePreset, lang)
      : formatDate(date, what, lang, { digits: values.digits as 'native' | 'ascii' | undefined });
    return { data: { date: iso(date), format: what, text }, lines: [text] };
  } catch (e) {
    return rethrow(e, lang);
  }
}

export function parseDate(args: string[]): ToolResult {
  const { values, positionals } = parse(args, {});
  const lang = language(values.lang);
  if (positionals.length < 1) usage('parse <date text> [--lang en|ne]');
  try {
    const d = parseNepaliDate(positionals.join(' '));
    const ad = NepaliDate.from(d).toAD();
    const adIso = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, '0')}-${String(ad.getDate()).padStart(2, '0')}`;
    return {
      data: { bs: iso(d), year: d.year, month: d.month, day: d.day, ad: adIso },
      lines: [`BS:  ${iso(d)}`, `AD:  ${adIso}`],
    };
  } catch (e) {
    return rethrow(e, lang);
  }
}

export function fiscal(args: string[]): ToolResult {
  const { values, positionals } = parse(args, {});
  const lang = language(values.lang);
  if (positionals.length < 1) usage('fiscal <BS date> [--lang en|ne]');
  try {
    const d = parseNepaliDate(positionals.join(' '));
    const f = fiscalYear(d);
    return {
      data: { code: f.code, start: f.start, end: f.end, first: iso(f.first), last: iso(f.last) },
      lines: [`Fiscal year: ${f.code}`, `From:        ${iso(f.first)}`, `To:          ${iso(f.last)}`],
    };
  } catch (e) {
    return rethrow(e, lang);
  }
}

export const TOOLS: Record<string, (args: string[]) => ToolResult> = {
  money, phone, address, sms, fmt, parse: parseDate, fiscal,
};
