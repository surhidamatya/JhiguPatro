import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile, chmod } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InlineCalendarDataSource, initializeCalendar } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import { MockSmsGateway, ReminderScheduler, reminderSendAt } from '../src/sms.js';
import type { Reminder } from '../src/sms.js';
import { FileReminderStore, SmsStoreError, parseReminders, serializeReminders } from '../src/smsFileStore.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const calendarJson: CalendarJson = read('../../data/nepali_calendar_data.json');
const v = read('../../testdata/sms_store.json');
const PHONE: string = v.phone;

beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(
    calendarJson.years, calendarJson.supportedRange.start, calendarJson.supportedRange.end, calendarJson.verifiedThrough,
  ));
});

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'jhigu-store-'));
  file = join(dir, 'reminders.json');
});
afterEach(async () => {
  await chmod(dir, 0o700).catch(() => undefined);
  await rm(dir, { recursive: true, force: true });
});

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'r1', to: PHONE, templateKey: 'rentDue', language: 'en', values: { name: 'Ram', amount: 5000 },
  sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 30, status: 'pending', attempts: 0, ...over,
});

async function expectStoreError(p: Promise<unknown>, code: string): Promise<SmsStoreError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(SmsStoreError);
    expect((e as SmsStoreError).code).toBe(code);
    expect((e as SmsStoreError).message).not.toContain(PHONE);
    return e as SmsStoreError;
  }
  throw new Error(`expected SmsStoreError ${code}`);
}

describe('file format (shared vectors)', () => {
  const expected: unknown[] = JSON.parse(v.valid.file).reminders;

  it('saving the reminders in any order writes exactly the canonical file', async () => {
    const store = new FileReminderStore(file);
    for (const r of v.valid.reminders) await store.save(r);
    expect(await readFile(file, 'utf8')).toBe(v.valid.file);
  });

  it('loads the canonical file, in id order, without the unknown field', async () => {
    await writeFile(file, v.valid.file);
    const got = await new FileReminderStore(file).loadAll();
    expect(got).toEqual(expected);
    expect(got.map(r => r.id)).toEqual(['r-a', 'r-b', 'r-c', 'r-d']);
  });

  it('parse then serialize gives the same text back', () => {
    expect(serializeReminders(parseReminders(v.valid.file))).toBe(v.valid.file);
  });

  it('keeps Devanagari text as it is (not \\u escapes)', async () => {
    await new FileReminderStore(file).save(v.valid.reminders[1]);
    const text = await readFile(file, 'utf8');
    expect(text).toContain('राम श्रेष्ठ');
    expect(text).not.toContain('\\u0930');
  });

  for (const c of v.lenientFiles) {
    it(`accepts: ${c.name}`, async () => {
      await writeFile(file, c.text);
      const got = await new FileReminderStore(file).loadAll();
      expect(got).toEqual([c.expect]);
    });
  }

  for (const c of v.invalidFiles) {
    it(`rejects a bad file: ${c.name}`, async () => {
      await writeFile(file, c.text);
      await expectStoreError(new FileReminderStore(file).loadAll(), c.code);
    });
  }

  for (const c of v.invalidReminders) {
    it(`save rejects a bad reminder: ${c.name}`, async () => {
      const store = new FileReminderStore(file);
      const e = await expectStoreError(store.save(c.reminder), 'INVALID_REMINDER');
      expect(e.message).toContain(`"${c.field}"`);
      await expect(stat(file)).rejects.toThrow(); // nothing was written
    });
  }
});

describe('behaviour', () => {
  it('a missing file is an empty store, and reading does not create it', async () => {
    const store = new FileReminderStore(file);
    expect(await store.loadAll()).toEqual([]);
    await expect(stat(file)).rejects.toThrow();
  });

  it('creates the folder on the first write', async () => {
    const nested = join(dir, 'a', 'b', 'reminders.json');
    await new FileReminderStore(nested).save(reminder());
    expect((await new FileReminderStore(nested).loadAll()).map(r => r.id)).toEqual(['r1']);
  });

  it('save replaces a reminder with the same id', async () => {
    const store = new FileReminderStore(file);
    await store.save(reminder());
    await store.save(reminder({ status: 'sent', attempts: 1, providerId: 'p1' }));
    const all = await store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: 'sent', attempts: 1, providerId: 'p1' });
  });

  it('clearing an optional field really clears it', async () => {
    const store = new FileReminderStore(file);
    await store.save(reminder({ retryAt: 5, lastError: 'NETWORK' }));
    await store.save(reminder({ retryAt: undefined, lastError: undefined }));
    const [r] = await store.loadAll();
    expect('retryAt' in r).toBe(false);
    expect('lastError' in r).toBe(false);
  });

  it('delete removes one; deleting an unknown id changes nothing and writes nothing', async () => {
    const store = new FileReminderStore(file);
    await store.delete('nope');
    await expect(stat(file)).rejects.toThrow();
    await store.save(reminder({ id: 'a' }));
    await store.save(reminder({ id: 'b' }));
    const before = await readFile(file, 'utf8');
    await store.delete('zzz');
    expect(await readFile(file, 'utf8')).toBe(before);
    await store.delete('a');
    expect((await store.loadAll()).map(r => r.id)).toEqual(['b']);
  });

  it('undefined values are dropped, null values are kept', async () => {
    const store = new FileReminderStore(file);
    await store.save(reminder({ values: { a: 'x', b: undefined, c: null } }));
    const [r] = await store.loadAll();
    expect(r.values).toEqual({ a: 'x', c: null });
  });

  it('the object you save is copied at the call: later changes do not reach the file', async () => {
    const store = new FileReminderStore(file);
    const first = store.save(reminder({ id: 'x' })); // runs after this line, not before it
    const r = reminder();
    const queued = store.save(r); // waits behind `first`
    (r.values as Record<string, unknown>).name = 'Changed';
    r.hour = 1;
    await Promise.all([first, queued]);
    const got = (await store.loadAll()).find(x => x.id === 'r1')!;
    expect(got.values.name).toBe('Ram');
    expect(got.hour).toBe(9);
  });

  it('a constructor needs a path', () => {
    expect(() => new FileReminderStore('')).toThrow(RangeError);
  });

  it.skipIf(process.platform === 'win32')('the file is private to the owner (0600)', async () => {
    await new FileReminderStore(file).save(reminder());
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('leaves no temporary files behind', async () => {
    const store = new FileReminderStore(file);
    for (let i = 0; i < 5; i++) await store.save(reminder({ id: `r${i}` }));
    await store.delete('r2');
    expect(await readdir(dir)).toEqual(['reminders.json']);
  });
});

describe('concurrency inside one process', () => {
  it('many parallel saves all land', async () => {
    const store = new FileReminderStore(file);
    await Promise.all(Array.from({ length: 60 }, (_, i) => store.save(reminder({ id: `r${String(i).padStart(2, '0')}` }))));
    expect(await store.loadAll()).toHaveLength(60);
    JSON.parse(await readFile(file, 'utf8')); // and the file is whole
  });

  it('parallel saves of one id end with the last one', async () => {
    const store = new FileReminderStore(file);
    await Promise.all([1, 2, 3, 4, 5].map(n => store.save(reminder({ attempts: n }))));
    expect((await store.loadAll())[0].attempts).toBe(5);
  });

  it('a read started after a save sees it, even if the save was not awaited', async () => {
    const store = new FileReminderStore(file);
    void store.save(reminder());
    expect((await store.loadAll()).map(r => r.id)).toEqual(['r1']);
  });

  it('save then delete, in order, leaves nothing', async () => {
    const store = new FileReminderStore(file);
    void store.save(reminder());
    void store.delete('r1');
    expect(await store.loadAll()).toEqual([]);
  });
});

describe('failures', () => {
  it('a corrupt file is an error and is left exactly as it was (never reset)', async () => {
    await writeFile(file, '{"version":1,"reminders":[');
    const store = new FileReminderStore(file);
    await expectStoreError(store.loadAll(), 'CORRUPT_FILE');
    await expectStoreError(store.save(reminder()), 'CORRUPT_FILE');
    await expectStoreError(store.delete('r1'), 'CORRUPT_FILE');
    expect(await readFile(file, 'utf8')).toBe('{"version":1,"reminders":[');
  });

  it('bytes that are not UTF-8, and a byte order mark, are CORRUPT_FILE', async () => {
    const store = new FileReminderStore(file);
    // Invalid UTF-8 inside a string: a lenient decoder would turn it into U+FFFD and
    // the JSON would still parse, so only a strict one rejects it.
    await writeFile(file, Buffer.concat([
      Buffer.from('{"version":1,"reminders":[],"note":"'), Buffer.from([0xff]), Buffer.from('"}'),
    ]));
    await expectStoreError(store.loadAll(), 'CORRUPT_FILE');
    await writeFile(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(v.valid.file)]));
    await expectStoreError(store.loadAll(), 'CORRUPT_FILE');
  });

  it('a file that cannot be read is READ_FAILED', async () => {
    await mkdir(file); // a folder where the file should be
    await expectStoreError(new FileReminderStore(file).loadAll(), 'READ_FAILED');
  });

  it('a failed call does not poison the queue: the next one works', async () => {
    await mkdir(file); // a folder where the file should be: reads fail
    const store = new FileReminderStore(file);
    await expectStoreError(store.save(reminder()), 'READ_FAILED');
    await expectStoreError(store.loadAll(), 'READ_FAILED');
    await rm(file, { recursive: true });
    await store.save(reminder());
    expect((await store.loadAll()).map(r => r.id)).toEqual(['r1']);
  });

  it.skipIf(process.platform === 'win32' || (process.getuid?.() ?? 1) === 0)(
    'a write that fails leaves the old file whole and no temporary file',
    async () => {
      const store = new FileReminderStore(file);
      await store.save(reminder());
      const before = await readFile(file, 'utf8');
      await chmod(dir, 0o500); // read and enter, no creating files
      await expectStoreError(store.save(reminder({ id: 'r2' })), 'WRITE_FAILED');
      await chmod(dir, 0o700);
      expect(await readFile(file, 'utf8')).toBe(before);
      expect(await readdir(dir)).toEqual(['reminders.json']);
    },
  );
});

describe('with the scheduler', () => {
  // The built-in rentDue template needs all five of these.
  const rent = { name: 'Ram', amount: 5000, month: 'Bhadra', dueDate: '2082-05-15', sender: 'Himal Rentals' };
  it('a restart does not send a reminder that was already sent', async () => {
    const r = reminder({ values: rent });
    const at = reminderSendAt(r);

    const first = new FileReminderStore(file);
    await first.save(r);
    const gw1 = new MockSmsGateway();
    const s1 = await new ReminderScheduler({ gateway: gw1, store: first, clock: () => at + 1000 }).runOnce();
    expect(s1.sent).toBe(1);

    // "Restart": a new store object and scheduler on the same file.
    const gw2 = new MockSmsGateway();
    const s2 = await new ReminderScheduler({ gateway: gw2, store: new FileReminderStore(file), clock: () => at + 2000 }).runOnce();
    expect(s2).toEqual({ due: 0, sent: 0, retrying: 0, failed: 0 });
    expect(gw2.sent).toHaveLength(0);
    expect((await new FileReminderStore(file).loadAll())[0].status).toBe('sent');
  });

  it('a retry that was scheduled survives a restart', async () => {
    const r = reminder({ values: rent });
    const at = reminderSendAt(r);
    const store = new FileReminderStore(file);
    await store.save(r);
    const gw = new MockSmsGateway();
    gw.failNext('NETWORK');
    const s1 = await new ReminderScheduler({ gateway: gw, store, clock: () => at }).runOnce();
    expect(s1.retrying).toBe(1);

    const [saved] = await new FileReminderStore(file).loadAll();
    expect(saved.attempts).toBe(1);
    expect(saved.retryAt).toBe(at + 60_000);
    expect(saved.lastError).toBe('NETWORK');

    // Too early after the restart: nothing. After the back-off: it is sent.
    const gw2 = new MockSmsGateway();
    const mk = (now: number) => new ReminderScheduler({ gateway: gw2, store: new FileReminderStore(file), clock: () => now });
    expect((await mk(at + 30_000).runOnce()).due).toBe(0);
    expect((await mk(at + 61_000).runOnce()).sent).toBe(1);
  });
});
