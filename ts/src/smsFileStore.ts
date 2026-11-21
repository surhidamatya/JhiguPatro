/// <reference types="node" />
/**
 * A file-backed `ReminderStore` for Node (guide 12.x, SMS reminders). Keeps every
 * reminder in one JSON file so a restarted process picks up where it stopped.
 * Import it separately (it uses `node:fs`, so it is not for the browser):
 *
 *   import { FileReminderStore } from 'jhigu-patro-utils-ts/sms-file-store';
 *   const store = new FileReminderStore('/var/lib/myapp/reminders.json');
 *   const scheduler = new ReminderScheduler({ gateway, store });
 *
 * The file format is shared with the Dart `FileReminderStore`, so either library
 * can read a file written by the other (see `testdata/sms_store.json`):
 * `{ "version": 1, "reminders": [ ... ] }`, two-space indent, reminders sorted by
 * `id`, a fixed key order, `values` keys sorted, a final newline.
 *
 * Guarantees and limits:
 *  - Every write goes to a temporary file in the same directory, is flushed, then
 *    renamed over the real file, so a crash never leaves a half-written file.
 *    (The directory itself is flushed on a best-effort basis; after a power cut
 *    the very last write can still be lost.)
 *  - Calls on one store object run one at a time, in order, so `loadAll` sees
 *    every `save` that finished before it.
 *  - One process only. Two processes (or two store objects) on one file can
 *    overwrite each other's changes; there is no locking.
 *  - A missing file is an empty store. A file that is not valid, or whose reminders
 *    are not valid, is a `SmsStoreError`; it is never silently reset. Errors never
 *    contain phone numbers or message values.
 *  - The file holds phone numbers: it is created with mode 0600 (owner only).
 *    A leftover `.tmp` file after a crash is harmless and is not cleaned up.
 *  - Fields this version does not know are dropped when a reminder is rewritten.
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Reminder, ReminderStatus, ReminderStore, SmsErrorCode } from './sms.js';

export type SmsStoreErrorCode =
  | 'CORRUPT_FILE'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_REMINDER'
  | 'READ_FAILED'
  | 'WRITE_FAILED';

/** Why the store could not read or write. `message` is English and holds no personal data. */
export class SmsStoreError extends Error {
  constructor(public readonly code: SmsStoreErrorCode, message: string) {
    super(message);
    this.name = 'SmsStoreError';
  }
}

const FORMAT_VERSION = 1;
const STATUSES: readonly ReminderStatus[] = ['pending', 'sent', 'failed'];
const ERROR_CODES: readonly SmsErrorCode[] = [
  'AUTH', 'BALANCE', 'BAD_NUMBER', 'RATE_LIMIT', 'SERVER', 'NETWORK', 'UNKNOWN', 'BAD_TEMPLATE',
];

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown, lo: number, hi: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;

/**
 * Check one reminder read from a file or given to `save`, and return a clean copy
 * (known fields only, `undefined` values dropped). Throws `INVALID_REMINDER` with
 * the position or field name, never the value.
 */
function validate(input: unknown, where: string): Reminder {
  const bad = (field: string): never => {
    throw new SmsStoreError('INVALID_REMINDER', `${where}: field "${field}" is missing or not valid`);
  };
  if (!isObject(input)) throw new SmsStoreError('INVALID_REMINDER', `${where}: not an object`);
  if (typeof input.id !== 'string' || input.id === '') bad('id');
  if (typeof input.to !== 'string') bad('to');
  if (typeof input.templateKey !== 'string') bad('templateKey');
  if (input.language !== 'ne' && input.language !== 'en') bad('language');
  if (!isObject(input.values)) bad('values');
  const values: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(input.values as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (v !== null && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v))) bad('values');
    values[k] = v as string | number | null;
  }
  const sd = input.sendDate;
  if (!isObject(sd) || !isInt(sd.year, 2000, 2100) || !isInt(sd.month, 1, 12) || !isInt(sd.day, 1, 32)) bad('sendDate');
  if (!isInt(input.hour, 0, 23)) bad('hour');
  if (!isInt(input.minute, 0, 59)) bad('minute');
  if (!STATUSES.includes(input.status as ReminderStatus)) bad('status');
  if (!isInt(input.attempts, 0, Number.MAX_SAFE_INTEGER)) bad('attempts');
  if (input.retryAt !== undefined && input.retryAt !== null && !isInt(input.retryAt, 0, Number.MAX_SAFE_INTEGER)) bad('retryAt');
  if (input.providerId !== undefined && input.providerId !== null && typeof input.providerId !== 'string') bad('providerId');
  if (input.lastError !== undefined && input.lastError !== null && !ERROR_CODES.includes(input.lastError as SmsErrorCode)) bad('lastError');

  const s = sd as Record<string, number>;
  const r: Reminder = {
    id: input.id as string,
    to: input.to as string,
    templateKey: input.templateKey as string,
    language: input.language as 'ne' | 'en',
    values,
    sendDate: { year: s.year, month: s.month, day: s.day },
    hour: input.hour as number,
    minute: input.minute as number,
    status: input.status as ReminderStatus,
    attempts: input.attempts as number,
  };
  if (typeof input.retryAt === 'number') r.retryAt = input.retryAt;
  if (typeof input.providerId === 'string') r.providerId = input.providerId;
  if (typeof input.lastError === 'string') r.lastError = input.lastError as SmsErrorCode;
  return r;
}

/** The text of the file for these reminders (sorted by id, fixed key order). */
export function serializeReminders(reminders: readonly Reminder[]): string {
  const sorted = [...reminders].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out = sorted.map(r => {
    const values: Record<string, string | number | null> = {};
    for (const k of Object.keys(r.values).sort()) {
      const v = r.values[k];
      if (v !== undefined) values[k] = v;
    }
    const o: Record<string, unknown> = {
      id: r.id,
      to: r.to,
      templateKey: r.templateKey,
      language: r.language,
      values,
      sendDate: { year: r.sendDate.year, month: r.sendDate.month, day: r.sendDate.day },
      hour: r.hour,
      minute: r.minute,
      status: r.status,
      attempts: r.attempts,
    };
    if (r.retryAt !== undefined) o.retryAt = r.retryAt;
    if (r.providerId !== undefined) o.providerId = r.providerId;
    if (r.lastError !== undefined) o.lastError = r.lastError;
    return o;
  });
  return `${JSON.stringify({ version: FORMAT_VERSION, reminders: out }, null, 2)}\n`;
}

/** Parse and check the text of a store file. Throws `SmsStoreError`. */
export function parseReminders(text: string): Reminder[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SmsStoreError('CORRUPT_FILE', 'the reminder file is not valid JSON');
  }
  if (!isObject(data) || !Array.isArray(data.reminders)) {
    throw new SmsStoreError('CORRUPT_FILE', 'the reminder file does not have a "reminders" list');
  }
  if (data.version !== FORMAT_VERSION) {
    throw new SmsStoreError('UNSUPPORTED_VERSION', `the reminder file has an unsupported version`);
  }
  const seen = new Set<string>();
  return data.reminders.map((item, i) => {
    const r = validate(item, `reminder #${i + 1}`);
    if (seen.has(r.id)) throw new SmsStoreError('INVALID_REMINDER', `reminder #${i + 1}: duplicate id`);
    seen.add(r.id);
    return r;
  });
}

let tmpCounter = 0;

export class FileReminderStore implements ReminderStore {
  private chain: Promise<unknown> = Promise.resolve();

  /** [path] is the JSON file. Its folder is created on the first write. */
  constructor(private readonly path: string) {
    if (typeof path !== 'string' || path === '') throw new RangeError('path must be a non-empty string');
  }

  async loadAll(): Promise<Reminder[]> {
    return this.enqueue(() => this.read());
  }

  async save(reminder: Reminder): Promise<void> {
    const clean = validate(reminder, 'reminder');
    await this.enqueue(async () => {
      const all = (await this.read()).filter(r => r.id !== clean.id);
      all.push(clean);
      await this.write(all);
    });
  }

  async delete(id: string): Promise<void> {
    await this.enqueue(async () => {
      const all = await this.read();
      const rest = all.filter(r => r.id !== id);
      if (rest.length !== all.length) await this.write(rest);
    });
  }

  /** Run [job] after every earlier call has finished, whether it worked or not. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async read(): Promise<Reminder[]> {
    let bytes: Uint8Array;
    try {
      bytes = await readFile(this.path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new SmsStoreError('READ_FAILED', 'the reminder file could not be read');
    }
    let text: string;
    try {
      // Strict: bytes that are not UTF-8 are an error, and a byte order mark is
      // kept (so JSON.parse rejects it) rather than silently stripped.
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw new SmsStoreError('CORRUPT_FILE', 'the reminder file is not valid UTF-8');
    }
    return parseReminders(text);
  }

  private async write(reminders: readonly Reminder[]): Promise<void> {
    const dir = dirname(this.path);
    const tmp = join(dir, `.${basename(this.path)}.${process.pid}.${tmpCounter++}.tmp`);
    try {
      await mkdir(dir, { recursive: true });
      const fh = await open(tmp, 'w', 0o600);
      try {
        await fh.writeFile(serializeReminders(reminders), 'utf8');
        await fh.sync();
      } finally {
        await fh.close();
      }
      await rename(tmp, this.path);
    } catch {
      await unlink(tmp).catch(() => undefined);
      throw new SmsStoreError('WRITE_FAILED', 'the reminder file could not be written');
    }
    // Make the rename itself durable where the platform allows it.
    try {
      const d = await open(dir, 'r');
      try { await d.sync(); } finally { await d.close(); }
    } catch { /* not supported here (Windows): the file is still whole */ }
  }
}
