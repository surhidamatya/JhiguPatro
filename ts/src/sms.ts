/**
 * SMS reminders (guide section 13), gateway-agnostic.
 *
 * This library does not talk to any SMS provider. You choose the gateway: either
 * implement `SmsGateway` yourself, or wrap your own send function with
 * `CallbackSmsGateway`. No network code, no provider endpoints, no logging of
 * message text or phone numbers.
 *
 * Parts:
 *  - `SmsGateway`, `SmsMessage`, `SmsResult`, typed `SmsError` codes
 *  - `CallbackSmsGateway` (wrap your function) and `MockSmsGateway` (tests, demos)
 *  - templates (`rentDue`, `udhaaro`, `appointment`) with a `{placeholder}` renderer
 *  - `smsSegments` to estimate the number of SMS parts
 *  - `ReminderScheduler` with retries, and a pluggable `ReminderStore`
 *
 * Import from `jhigu-patro-utils-ts/sms`.
 */
import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';
import { NepaliDate } from './nepaliDate.js';
import type { NepaliDateFields } from './types.js';

// ── Errors ───────────────────────────────────────────────────────────────────

export type SmsErrorCode =
  | 'AUTH'
  | 'BALANCE'
  | 'BAD_NUMBER'
  | 'RATE_LIMIT'
  | 'SERVER'
  | 'NETWORK'
  | 'UNKNOWN'
  | 'BAD_TEMPLATE';

const ERROR_KEY = {
  AUTH: 'auth',
  BALANCE: 'balance',
  BAD_NUMBER: 'badNumber',
  RATE_LIMIT: 'rateLimit',
  SERVER: 'server',
  NETWORK: 'network',
  UNKNOWN: 'unknown',
  BAD_TEMPLATE: 'badTemplate',
} as const;

/**
 * Why a message was not sent. Gateway adapters map their provider's errors to
 * one of these codes. `message` is English and never contains the number or text.
 */
export class SmsError extends Error {
  constructor(public readonly code: SmsErrorCode) {
    super(getStrings('en').sms[ERROR_KEY[code]]);
    this.name = 'SmsError';
  }

  localized(language: Language): string {
    return getStrings(language).sms[ERROR_KEY[this.code]];
  }
}

export type SmsTemplateErrorCode = 'MISSING_VALUE' | 'UNKNOWN_TEMPLATE';

/** Typed template error. For MISSING_VALUE, `key` is the placeholder name. */
export class SmsTemplateError extends Error {
  constructor(
    public readonly code: SmsTemplateErrorCode,
    public readonly key?: string,
  ) {
    const s = getStrings('en').sms;
    super(code === 'MISSING_VALUE' ? s.missingValue : s.unknownTemplate);
    this.name = 'SmsTemplateError';
  }

  localized(language: Language): string {
    const s = getStrings(language).sms;
    return this.code === 'MISSING_VALUE' ? s.missingValue : s.unknownTemplate;
  }
}

// ── Gateway ──────────────────────────────────────────────────────────────────

export interface SmsMessage {
  /** Destination in E.164 form, for example `+9779841234567`. */
  toE164: string;
  text: string;
  /** Your own id, echoed nowhere by this library; the scheduler uses the reminder id. */
  reference?: string;
}

export interface SmsResult {
  ok: boolean;
  /** The gateway's own message id, if it gives one. */
  providerId?: string;
  error?: SmsError;
}

export interface SmsGateway {
  send(message: SmsMessage): Promise<SmsResult>;
  /** Results are in the same order as `messages`, one per message. */
  sendBulk(messages: readonly SmsMessage[]): Promise<SmsResult[]>;
}

/** True for `+` followed by 8 to 15 digits, the first not zero. */
export function isE164(text: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(text);
}

const fail = (code: SmsErrorCode): SmsResult => ({ ok: false, error: new SmsError(code) });

/** Turn whatever a user function throws into a result. The thrown message is dropped. */
const fromThrown = (e: unknown): SmsResult => fail(e instanceof SmsError ? e.code : 'UNKNOWN');

export interface CallbackSmsGatewayOptions {
  /** Send one message with your provider. Return a result, or throw. */
  send: (message: SmsMessage) => Promise<SmsResult>;
  /**
   * Optional: send several messages in one provider call. Must return one
   * result per message, in order. Without it, `sendBulk` calls `send` one by one.
   */
  sendBatch?: (messages: readonly SmsMessage[]) => Promise<SmsResult[]>;
  /** With `sendBatch`: split bulk sends into batches of at most this size. Default: no split. */
  maxBatchSize?: number;
}

/**
 * Gateway built from your own functions, so any provider (or your own server)
 * can be used. A function that throws gives an `UNKNOWN` error result (or the
 * code of a thrown `SmsError`); a batch that returns the wrong number of
 * results gives `UNKNOWN` for the whole batch. Bulk results keep input order.
 */
export class CallbackSmsGateway implements SmsGateway {
  constructor(private readonly options: CallbackSmsGatewayOptions) {
    const m = options.maxBatchSize;
    if (m !== undefined && (!Number.isInteger(m) || m < 1)) throw new RangeError('maxBatchSize must be a positive integer');
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    try {
      return await this.options.send(message);
    } catch (e) {
      return fromThrown(e);
    }
  }

  async sendBulk(messages: readonly SmsMessage[]): Promise<SmsResult[]> {
    const { sendBatch, maxBatchSize } = this.options;
    if (!sendBatch) {
      const out: SmsResult[] = [];
      for (const m of messages) out.push(await this.send(m));
      return out;
    }
    const size = maxBatchSize ?? Math.max(messages.length, 1);
    const out: SmsResult[] = [];
    for (let i = 0; i < messages.length; i += size) {
      const chunk = messages.slice(i, i + size);
      let results: SmsResult[];
      try {
        results = await sendBatch(chunk);
        if (!Array.isArray(results) || results.length !== chunk.length) results = chunk.map(() => fail('UNKNOWN'));
      } catch (e) {
        results = chunk.map(() => fromThrown(e));
      }
      out.push(...results);
    }
    return out;
  }
}

/**
 * Gateway for tests and demos. Sent messages are stored in `sent`; every call
 * is stored in `attempts`. Make sends fail with `failNext` (any message) or
 * `failFor` (a message with a given `reference`, one code per attempt).
 */
export class MockSmsGateway implements SmsGateway {
  /** Messages accepted, in order. */
  readonly sent: SmsMessage[] = [];
  /** Every message passed to `send` or `sendBulk`, in order, including failures. */
  readonly attempts: SmsMessage[] = [];
  private counter = 0;
  private readonly next: SmsErrorCode[] = [];
  private readonly byReference = new Map<string, SmsErrorCode[]>();

  /** The next `count` sends fail with `code`. */
  failNext(code: SmsErrorCode, count = 1): void {
    for (let i = 0; i < count; i++) this.next.push(code);
  }

  /** Successive sends of messages with this reference fail with these codes, in order. */
  failFor(reference: string, codes: readonly SmsErrorCode[]): void {
    this.byReference.set(reference, [...codes]);
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    this.attempts.push(message);
    const queued = message.reference === undefined ? undefined : this.byReference.get(message.reference);
    const code = queued?.length ? queued.shift() : this.next.shift();
    if (code) return fail(code);
    if (!isE164(message.toE164)) return fail('BAD_NUMBER');
    this.sent.push(message);
    this.counter += 1;
    return { ok: true, providerId: `mock-${this.counter}` };
  }

  async sendBulk(messages: readonly SmsMessage[]): Promise<SmsResult[]> {
    const out: SmsResult[] = [];
    for (const m of messages) out.push(await this.send(m));
    return out;
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

export type SmsTemplateKey = 'rentDue' | 'udhaaro' | 'appointment';

/** Built-in template keys. Their text is in the strings tables (`smsTemplates`). */
export const smsTemplateKeys: readonly SmsTemplateKey[] = ['rentDue', 'udhaaro', 'appointment'];

export type SmsValues = Readonly<Record<string, string | number | undefined | null>>;

const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

/** Placeholder names in a template, each once, in order of first appearance. */
export function templatePlaceholders(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) seen.add(m[1]);
  return [...seen];
}

export interface RenderOptions {
  /** Throw SmsTemplateError MISSING_VALUE for a placeholder with no value (default). When false, it becomes empty text. */
  strict?: boolean;
}

/**
 * Replace every `{key}` with its value in one pass: a value that itself
 * contains `{x}` is not expanded. A key counts as missing when its value is
 * undefined or null; an empty string is a value. Extra values are ignored.
 * Text outside placeholders, including lone braces, is kept as is.
 */
export function renderTemplate(text: string, values: SmsValues, options: RenderOptions = {}): string {
  const strict = options.strict ?? true;
  return text.replace(PLACEHOLDER, (_all, key: string) => {
    const v = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
    if (v === undefined || v === null) {
      if (strict) throw new SmsTemplateError('MISSING_VALUE', key);
      return '';
    }
    return String(v);
  });
}

/** The raw template text, or throws SmsTemplateError UNKNOWN_TEMPLATE. */
export function getSmsTemplate(key: string, language: Language): string {
  if (!(smsTemplateKeys as readonly string[]).includes(key)) throw new SmsTemplateError('UNKNOWN_TEMPLATE');
  return getStrings(language).smsTemplates[key as SmsTemplateKey];
}

/** Render a built-in template in a language. */
export function renderSmsTemplate(
  key: string,
  language: Language,
  values: SmsValues,
  options: RenderOptions = {},
): string {
  return renderTemplate(getSmsTemplate(key, language), values, options);
}

// ── Segments ─────────────────────────────────────────────────────────────────

// GSM 03.38 (3GPP TS 23.038) default alphabet, and the extension table whose
// characters take two units. Written from the standard's tables; not checked
// against a carrier. National language shift tables are not used.
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENSION = '\f^{}\\[~]|€';

const GSM_BASIC_SET = new Set(GSM_BASIC);
const GSM_EXT_SET = new Set(GSM_EXTENSION);

export interface SmsSegments {
  /** `gsm7` if every character is in the GSM alphabet, else `ucs2` (all Nepali text). */
  encoding: 'gsm7' | 'ucs2';
  /** Length in encoding units: GSM characters (extension characters count 2) or UTF-16 units. */
  units: number;
  /** Number of SMS parts; 0 for empty text. */
  segments: number;
  /** Units one part holds in this message: 160/153 (gsm7) or 70/67 (ucs2). */
  perSegment: number;
}

/**
 * Estimate the parts a message needs. One part holds 160 GSM characters or 70
 * UCS-2 characters; in a multi-part message each part holds 153 or 67 because of
 * the concatenation header. An estimate only: carriers may split differently
 * (for example around an extension character or a surrogate pair).
 */
export function smsSegments(text: string): SmsSegments {
  let gsm = 0;
  let isGsm = true;
  for (const ch of text) {
    if (GSM_BASIC_SET.has(ch) && ch !== '\u001b') gsm += 1;
    else if (GSM_EXT_SET.has(ch)) gsm += 2;
    else { isGsm = false; break; }
  }
  if (isGsm) {
    const segments = gsm === 0 ? 0 : gsm <= 160 ? 1 : Math.ceil(gsm / 153);
    return { encoding: 'gsm7', units: gsm, segments, perSegment: gsm <= 160 ? 160 : 153 };
  }
  const units = text.length;
  return { encoding: 'ucs2', units, segments: units <= 70 ? 1 : Math.ceil(units / 67), perSegment: units <= 70 ? 70 : 67 };
}

// ── Reminders ────────────────────────────────────────────────────────────────

export type ReminderStatus = 'pending' | 'sent' | 'failed';

export interface Reminder {
  id: string;
  /** E.164 destination. */
  to: string;
  /** A built-in template key (`rentDue`, `udhaaro`, `appointment`). */
  templateKey: string;
  language: Language;
  values: SmsValues;
  /** BS send date, Nepal time. */
  sendDate: NepaliDateFields;
  /** 0..23, Nepal time. */
  hour: number;
  /** 0..59. */
  minute: number;
  status: ReminderStatus;
  /** Number of send attempts so far. */
  attempts: number;
  /** Epoch ms before which a retry must not run; set after a failed attempt. */
  retryAt?: number;
  /** Set when sent. */
  providerId?: string;
  /** Code of the last failure. */
  lastError?: SmsErrorCode;
}

export interface ReminderStore {
  loadAll(): Promise<Reminder[]>;
  save(reminder: Reminder): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Keeps reminders in memory (copies in and out). For tests, demos and short-lived processes. */
export class InMemoryReminderStore implements ReminderStore {
  private readonly items = new Map<string, Reminder>();

  async loadAll(): Promise<Reminder[]> {
    return [...this.items.values()].map(r => ({ ...r }));
  }

  async save(reminder: Reminder): Promise<void> {
    this.items.set(reminder.id, { ...reminder });
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

// Nepal is UTC+05:45 all year.
const NEPAL_OFFSET_MIN = 345;

/** Epoch milliseconds at which a reminder is first due (its Nepal-time send moment). */
export function reminderSendAt(r: Pick<Reminder, 'sendDate' | 'hour' | 'minute'>): number {
  const day = new NepaliDate(r.sendDate.year, r.sendDate.month, r.sendDate.day).dayNumber();
  return (day * 1440 + r.hour * 60 + r.minute - NEPAL_OFFSET_MIN) * 60_000;
}

export interface ReminderSchedulerOptions {
  gateway: SmsGateway;
  store: ReminderStore;
  /** Current time in epoch ms. Default `Date.now`. */
  clock?: () => number;
  /** Wait before retry n (1-based); the last value repeats. Default `[1, 5, 30]`. */
  backoffMinutes?: readonly number[];
  /** Attempts before a reminder is marked failed. Default 4 (the first try and three retries). */
  maxAttempts?: number;
  /** Error codes that fail a reminder at once without retry. Default `['BAD_NUMBER']`. */
  permanentErrors?: readonly SmsErrorCode[];
  /** Timer period for `start`. Default 60000. */
  intervalMs?: number;
}

export interface RunSummary {
  /** Reminders that were due. */
  due: number;
  sent: number;
  /** Failed now and scheduled for another attempt. */
  retrying: number;
  /** Marked failed now. */
  failed: number;
}

/**
 * Sends due reminders through your gateway. Only runs while your process runs:
 * for real use call `runOnce` from a server job or cron. Delivery is
 * at-least-once: if the process stops after the gateway accepts a message and
 * before the store saves, that reminder can be sent again.
 */
export class ReminderScheduler {
  private readonly gateway: SmsGateway;
  private readonly store: ReminderStore;
  private readonly clock: () => number;
  private readonly backoff: readonly number[];
  private readonly maxAttempts: number;
  private readonly permanent: ReadonlySet<SmsErrorCode>;
  private readonly intervalMs: number;
  private running = false;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: ReminderSchedulerOptions) {
    this.gateway = options.gateway;
    this.store = options.store;
    this.clock = options.clock ?? Date.now;
    this.backoff = options.backoffMinutes ?? [1, 5, 30];
    this.maxAttempts = options.maxAttempts ?? 4;
    this.permanent = new Set(options.permanentErrors ?? ['BAD_NUMBER']);
    this.intervalMs = options.intervalMs ?? 60_000;
    if (this.backoff.length === 0 || this.backoff.some(m => !(m >= 0))) throw new RangeError('backoffMinutes must be non-negative numbers');
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1) throw new RangeError('maxAttempts must be a positive integer');
  }

  /** Run `runOnce` every `intervalMs`. Does nothing if already started. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.runOnce().catch(() => {}); }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * One pass: send every pending reminder that is due (send moment reached and
   * any retry time passed), oldest first. A pass that starts while another is
   * running returns at once with zero counts.
   */
  async runOnce(): Promise<RunSummary> {
    const summary: RunSummary = { due: 0, sent: 0, retrying: 0, failed: 0 };
    if (this.running) return summary;
    this.running = true;
    try {
      const now = this.clock();
      const due = (await this.store.loadAll())
        .filter(r => r.status === 'pending')
        .map(r => ({ r, at: Math.max(reminderSendAt(r), r.retryAt ?? 0) }))
        .filter(x => x.at <= now)
        .sort((a, b) => a.at - b.at || (a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0))
        .map(x => x.r);
      summary.due = due.length;

      const toSend: Array<{ r: Reminder; message: SmsMessage }> = [];
      for (const r of due) {
        if (!isE164(r.to)) { await this.finishFailed(r, 'BAD_NUMBER', summary); continue; }
        let text: string;
        try {
          text = renderSmsTemplate(r.templateKey, r.language, r.values);
        } catch {
          await this.finishFailed(r, 'BAD_TEMPLATE', summary);
          continue;
        }
        toSend.push({ r, message: { toE164: r.to, text, reference: r.id } });
      }

      if (toSend.length) {
        let results: SmsResult[];
        try {
          results = await this.gateway.sendBulk(toSend.map(x => x.message));
        } catch {
          results = [];
        }
        if (!Array.isArray(results) || results.length !== toSend.length) results = toSend.map(() => fail('UNKNOWN'));
        for (let i = 0; i < toSend.length; i++) {
          const { r } = toSend[i];
          const res = results[i];
          if (res?.ok) {
            await this.store.save({ ...r, status: 'sent', attempts: r.attempts + 1, providerId: res.providerId, retryAt: undefined, lastError: undefined });
            summary.sent += 1;
          } else {
            await this.recordFailure(r, res?.error?.code ?? 'UNKNOWN', now, summary);
          }
        }
      }
      return summary;
    } finally {
      this.running = false;
    }
  }

  private async finishFailed(r: Reminder, code: SmsErrorCode, summary: RunSummary): Promise<void> {
    await this.store.save({ ...r, status: 'failed', attempts: r.attempts + 1, retryAt: undefined, lastError: code });
    summary.failed += 1;
  }

  private async recordFailure(r: Reminder, code: SmsErrorCode, now: number, summary: RunSummary): Promise<void> {
    const attempts = r.attempts + 1;
    if (this.permanent.has(code) || attempts >= this.maxAttempts) {
      await this.store.save({ ...r, status: 'failed', attempts, retryAt: undefined, lastError: code });
      summary.failed += 1;
      return;
    }
    const wait = this.backoff[Math.min(attempts - 1, this.backoff.length - 1)];
    await this.store.save({ ...r, attempts, retryAt: now + wait * 60_000, lastError: code });
    summary.retrying += 1;
  }
}
