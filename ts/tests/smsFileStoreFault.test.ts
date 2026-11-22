import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Reminder } from '../src/sms.js';

// Wrap rename so a test can make it fail, or look at the folder when it is called.
const hooks = vi.hoisted(() => ({
  onRename: undefined as undefined | ((from: string, to: string) => Promise<void>),
}));
vi.mock('node:fs/promises', async importOriginal => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    rename: async (from: string, to: string) => {
      if (hooks.onRename) await hooks.onRename(from, to);
      return real.rename(from, to);
    },
  };
});

import { FileReminderStore, SmsStoreError } from '../src/smsFileStore.js';

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'jhigu-fault-'));
  file = join(dir, 'reminders.json');
  hooks.onRename = undefined;
});
afterEach(async () => {
  hooks.onRename = undefined;
  await rm(dir, { recursive: true, force: true });
});

const reminder = (id: string): Reminder => ({
  id, to: '+9779800000000', templateKey: 'rentDue', language: 'en', values: {},
  sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 30, status: 'pending', attempts: 0,
});

describe('atomic write', () => {
  it('the new text is complete in a temporary file while the real file is still the old one', async () => {
    const store = new FileReminderStore(file);
    await store.save(reminder('a'));
    const old = await readFile(file, 'utf8');
    let seen: { realFile: string; tmpFiles: string[]; tmpText: string } | undefined;
    hooks.onRename = async (from) => {
      const names = await readdir(dir);
      seen = {
        realFile: await readFile(file, 'utf8'),
        tmpFiles: names.filter(n => n !== 'reminders.json'),
        tmpText: await readFile(from, 'utf8'),
      };
    };
    await store.save(reminder('b'));
    expect(seen!.realFile).toBe(old); // a crash here would lose nothing
    expect(seen!.tmpFiles).toHaveLength(1);
    expect(JSON.parse(seen!.tmpText).reminders.map((r: Reminder) => r.id)).toEqual(['a', 'b']); // whole
    expect(await readdir(dir)).toEqual(['reminders.json']);
  });

  it('a failed rename leaves the old file untouched, removes the temporary file and reports WRITE_FAILED', async () => {
    const store = new FileReminderStore(file);
    await store.save(reminder('a'));
    const old = await readFile(file, 'utf8');
    hooks.onRename = async () => { throw new Error('disk on fire'); };
    await expect(store.save(reminder('b'))).rejects.toMatchObject({ name: 'SmsStoreError', code: 'WRITE_FAILED' });
    expect(await readFile(file, 'utf8')).toBe(old);
    expect(await readdir(dir)).toEqual(['reminders.json']);
    // The message does not carry the underlying error text (it could hold a path).
    await store.save(reminder('c')).catch(e => expect((e as SmsStoreError).message).not.toContain('fire'));
    hooks.onRename = undefined;
    await store.save(reminder('b'));
    expect((await store.loadAll()).map(r => r.id)).toEqual(['a', 'b']);
  });

  it('the first write also goes through a temporary file', async () => {
    const store = new FileReminderStore(file);
    let tmpCount = -1;
    hooks.onRename = async () => { tmpCount = (await readdir(dir)).length; };
    await store.save(reminder('a'));
    expect(tmpCount).toBe(1); // only the temporary file existed
    expect(await readdir(dir)).toEqual(['reminders.json']);
  });

  it('an empty file is CORRUPT_FILE on save too, not silently replaced', async () => {
    await writeFile(file, '');
    await expect(new FileReminderStore(file).save(reminder('a'))).rejects.toMatchObject({ code: 'CORRUPT_FILE' });
  });
});
