import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InlineCalendarDataSource, initializeCalendar } from '../src/index.js';
import type { CalendarJson } from '../src/index.js';
import {
  CallbackSmsGateway, MockSmsGateway, InMemoryReminderStore, ReminderScheduler,
  SmsError, SmsTemplateError, isE164, renderTemplate, renderSmsTemplate, templatePlaceholders, smsSegments,
  reminderSendAt, smsTemplateKeys, getSmsTemplate,
} from '../src/sms.js';
import type { Reminder, SmsMessage, SmsResult, SmsErrorCode } from '../src/sms.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const calendarJson: CalendarJson = read('../../data/nepali_calendar_data.json');
const v = read('../../testdata/sms.json');

beforeAll(() => {
  initializeCalendar(new InlineCalendarDataSource(
    calendarJson.years, calendarJson.supportedRange.start, calendarJson.supportedRange.end, calendarJson.verifiedThrough,
  ));
});

describe('renderer (shared vectors)', () => {
  for (const c of v.render) {
    it(c.name, () => {
      if (c.expect.error) {
        try { renderTemplate(c.text, c.values, { strict: c.strict }); expect.unreachable('should throw'); }
        catch (e) {
          expect(e).toBeInstanceOf(SmsTemplateError);
          expect((e as SmsTemplateError).code).toBe(c.expect.error);
          expect((e as SmsTemplateError).key).toBe(c.expect.key);
        }
      } else expect(renderTemplate(c.text, c.values, { strict: c.strict })).toBe(c.expect.text);
    });
  }
});

describe('built-in templates (shared vectors)', () => {
  for (const c of v.templates) {
    it(`${c.key} ${c.language}`, () => {
      expect(templatePlaceholders(getSmsTemplate(c.key, c.language))).toEqual(c.placeholders);
      expect(renderSmsTemplate(c.key, c.language, c.values)).toBe(c.expect);
    });
  }
  it('every key has en and ne text and the same placeholders', () => {
    for (const k of smsTemplateKeys) {
      expect([...templatePlaceholders(getSmsTemplate(k, 'en'))].sort()).toEqual([...templatePlaceholders(getSmsTemplate(k, 'ne'))].sort());
    }
  });
  it('unknown key throws UNKNOWN_TEMPLATE', () => {
    expect(() => renderSmsTemplate('nope', 'en', {})).toThrow(SmsTemplateError);
  });
});

describe('smsSegments (shared vectors)', () => {
  for (const c of v.segments) {
    it(`${JSON.stringify(c.text).slice(0, 30)} -> ${c.expect.encoding} ${c.expect.units}`, () => {
      const s = smsSegments(c.text);
      expect({ encoding: s.encoding, units: s.units, segments: s.segments }).toEqual(c.expect);
    });
  }
});

describe('scheduler (shared vectors)', () => {
  for (const sc of v.scheduler) {
    it(sc.name, async () => {
      const gateway = new MockSmsGateway();
      for (const [ref, codes] of Object.entries<SmsErrorCode[]>(sc.failures)) gateway.failFor(ref, codes);
      const store = new InMemoryReminderStore();
      for (const r of sc.reminders) {
        const [y, m, d] = r.sendDate;
        await store.save({ ...r, sendDate: { year: y, month: m, day: d }, status: 'pending', attempts: 0 } as Reminder);
      }
      let now = 0;
      const scheduler = new ReminderScheduler({ gateway, store, clock: () => now });
      for (const step of sc.steps) {
        now = v.baseUtcMs + step.at * 60_000;
        const summary = await scheduler.runOnce();
        expect(summary, `at ${step.at}`).toEqual(step.expect.summary);
        const all = new Map((await store.loadAll()).map(r => [r.id, r]));
        for (const [id, want] of Object.entries<any>(step.expect.reminders)) {
          const got = all.get(id)!;
          const ctx = `at ${step.at} ${id}`;
          expect(got.status, ctx).toBe(want.status);
          expect(got.attempts, ctx).toBe(want.attempts);
          expect(got.lastError, ctx).toBe(want.lastError);
          expect(got.retryAt === undefined ? undefined : (got.retryAt - v.baseUtcMs) / 60_000, ctx).toBe(want.retryAt);
        }
        if (step.expect.calls !== undefined) expect(gateway.attempts.length, `at ${step.at} calls`).toBe(step.expect.calls);
        if (step.expect.sentOrder) expect(gateway.sent.map(m => m.reference)).toEqual(step.expect.sentOrder);
      }
    });
  }
  it('send time of BS 2082-05-10 09:00 matches the Python value', () => {
    expect(reminderSendAt({ sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 0 })).toBe(v.baseUtcMs);
  });
});

const msg = (n = 1): SmsMessage[] => Array.from({ length: n }, (_, i) => ({ toE164: '+9779841234567', text: `m${i}`, reference: `r${i}` }));

describe('gateways', () => {
  it('isE164', () => {
    expect(isE164('+9779841234567')).toBe(true);
    for (const bad of ['9779841234567', '+0123456789', '+1234567', '+1234567890123456', '+97798 41234567', '', '+']) expect(isE164(bad), bad).toBe(false);
  });

  it('mock records sent, ids increase, failNext and bad numbers', async () => {
    const g = new MockSmsGateway();
    expect((await g.send(msg()[0])).providerId).toBe('mock-1');
    g.failNext('BALANCE');
    const r = await g.send(msg()[0]);
    expect(r.ok).toBe(false);
    expect(r.error).toBeInstanceOf(SmsError);
    expect(r.error!.code).toBe('BALANCE');
    expect((await g.send({ toE164: '123', text: 'x' })).error!.code).toBe('BAD_NUMBER');
    expect(g.sent.length).toBe(1);
    expect(g.attempts.length).toBe(3);
  });

  it('callback gateway: send, throw, SmsError, no provider text kept', async () => {
    const g = new CallbackSmsGateway({
      send: async m => {
        if (m.text === 'boom') throw new Error('secret +9779841234567');
        if (m.text === 'rate') throw new SmsError('RATE_LIMIT');
        return { ok: true, providerId: 'p1' };
      },
    });
    expect(await g.send({ toE164: '+9779841234567', text: 'ok' })).toEqual({ ok: true, providerId: 'p1' });
    const boom = await g.send({ toE164: '+9779841234567', text: 'boom' });
    expect(boom.error!.code).toBe('UNKNOWN');
    expect(boom.error!.message).not.toContain('secret');
    expect((await g.send({ toE164: '+9779841234567', text: 'rate' })).error!.code).toBe('RATE_LIMIT');
  });

  it('callback gateway bulk without sendBatch is sequential and ordered', async () => {
    const order: string[] = [];
    const g = new CallbackSmsGateway({ send: async m => { order.push(m.text); return { ok: true, providerId: m.text }; } });
    const res = await g.sendBulk(msg(3));
    expect(order).toEqual(['m0', 'm1', 'm2']);
    expect(res.map(r => r.providerId)).toEqual(['m0', 'm1', 'm2']);
  });

  it('callback gateway splits batches at maxBatchSize and keeps order', async () => {
    const sizes: number[] = [];
    const g = new CallbackSmsGateway({
      send: async () => ({ ok: true }),
      sendBatch: async ms => { sizes.push(ms.length); return ms.map(m => ({ ok: true, providerId: m.text })); },
      maxBatchSize: 2,
    });
    const res = await g.sendBulk(msg(5));
    expect(sizes).toEqual([2, 2, 1]);
    expect(res.map(r => r.providerId)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect(await g.sendBulk([])).toEqual([]);
  });

  it('callback gateway: wrong result count or a throwing batch gives UNKNOWN for that batch only', async () => {
    let call = 0;
    const g = new CallbackSmsGateway({
      send: async () => ({ ok: true }),
      sendBatch: async ms => {
        call += 1;
        if (call === 1) return [{ ok: true }];             // wrong length for a batch of 2
        if (call === 2) throw new Error('down');
        return ms.map(() => ({ ok: true }));
      },
      maxBatchSize: 2,
    });
    const res = await g.sendBulk(msg(6));
    expect(res.map(r => r.ok)).toEqual([false, false, false, false, true, true]);
    expect(res[0].error!.code).toBe('UNKNOWN');
  });

  it('rejects a bad maxBatchSize', () => {
    expect(() => new CallbackSmsGateway({ send: async () => ({ ok: true }), maxBatchSize: 0 })).toThrow(RangeError);
  });

  it('error messages localise', () => {
    expect(new SmsError('AUTH').message).toBe('The SMS gateway rejected the credentials.');
    expect(new SmsError('AUTH').localized('ne')).toContain('एसएमएस');
  });
});

describe('scheduler extras', () => {
  const reminder = (over: Partial<Reminder> = {}): Reminder => ({
    id: 'r1', to: '+9779841234567', templateKey: 'appointment', language: 'en',
    values: { name: 'Ram', date: 'd', time: 't', sender: 's' },
    sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 0, status: 'pending', attempts: 0, ...over,
  });
  const at = (min: number) => () => v.baseUtcMs + min * 60_000;

  it('gateway that throws, or returns the wrong count, counts as a failed attempt (UNKNOWN)', async () => {
    for (const bad of [
      { sendBulk: async () => { throw new Error('x'); }, send: async () => ({ ok: true }) },
      { sendBulk: async (): Promise<SmsResult[]> => [], send: async () => ({ ok: true }) },
    ]) {
      const store = new InMemoryReminderStore();
      await store.save(reminder());
      const s = new ReminderScheduler({ gateway: bad, store, clock: at(0) });
      expect(await s.runOnce()).toEqual({ due: 1, sent: 0, retrying: 1, failed: 0 });
      expect((await store.loadAll())[0].lastError).toBe('UNKNOWN');
    }
  });

  it('options: custom back-off, maxAttempts and permanent codes', async () => {
    const gateway = new MockSmsGateway();
    gateway.failFor('r1', ['AUTH', 'SERVER']);
    const store = new InMemoryReminderStore();
    await store.save(reminder());
    let now = 0;
    const s = new ReminderScheduler({ gateway, store, clock: () => v.baseUtcMs + now * 60_000, backoffMinutes: [2], maxAttempts: 5, permanentErrors: ['AUTH'] });
    await s.runOnce();
    const r = (await store.loadAll())[0];
    expect(r.status).toBe('failed');
    expect(r.lastError).toBe('AUTH');
  });

  it('a second run that overlaps the first does nothing', async () => {
    let release!: () => void;
    const gate = new Promise<void>(res => { release = res; });
    const gateway = new CallbackSmsGateway({ send: async () => { await gate; return { ok: true }; }, sendBatch: async ms => { await gate; return ms.map(() => ({ ok: true })); } });
    const store = new InMemoryReminderStore();
    await store.save(reminder());
    const s = new ReminderScheduler({ gateway, store, clock: at(0) });
    const first = s.runOnce();
    await Promise.resolve();
    expect(await s.runOnce()).toEqual({ due: 0, sent: 0, retrying: 0, failed: 0 });
    release();
    expect((await first).sent).toBe(1);
  });

  it('store returns copies', async () => {
    const store = new InMemoryReminderStore();
    await store.save(reminder());
    (await store.loadAll())[0].status = 'sent';
    expect((await store.loadAll())[0].status).toBe('pending');
    await store.delete('r1');
    expect(await store.loadAll()).toEqual([]);
  });

  it('start and stop drive runOnce on a timer', async () => {
    const gateway = new MockSmsGateway();
    const store = new InMemoryReminderStore();
    await store.save(reminder());
    const s = new ReminderScheduler({ gateway, store, clock: at(0), intervalMs: 10 });
    s.start();
    s.start();
    await new Promise(r => setTimeout(r, 60));
    s.stop();
    expect(gateway.sent.length).toBe(1);
  });

  it('rejects bad options', () => {
    const base = { gateway: new MockSmsGateway(), store: new InMemoryReminderStore() };
    expect(() => new ReminderScheduler({ ...base, maxAttempts: 0 })).toThrow(RangeError);
    expect(() => new ReminderScheduler({ ...base, backoffMinutes: [] })).toThrow(RangeError);
  });

  it('never puts the number or text in error messages', async () => {
    const e = new SmsError('NETWORK');
    expect(e.message).not.toMatch(/\d{6}/);
  });
});
