# SMS

This feature gives you the parts around sending an SMS, and none of the sending itself. You bring your own provider. The library defines a gateway interface, a callback gateway that wraps your own send function, a mock gateway for tests, message templates in English and Nepali, a segment counter, and a reminder scheduler with retries and a pluggable store. A file-backed store keeps reminders across restarts. The library has no network code, no provider endpoints and no built-in gateway for any provider.

## When to use it

- You send reminders (rent due, money owed, appointments) and want templates, retries and a record of what was sent.
- You want to know how many SMS parts a message will take before you send it.
- You already have an SMS provider or your own server, and want a small, typed seam to plug it into.

You do not need it if you only send one-off messages with your provider's own client.

## Setup

TypeScript entry points:

| Import | Holds |
| --- | --- |
| `jhigu-patro-utils-ts/sms` | gateways, templates, `smsSegments`, `ReminderScheduler`, `InMemoryReminderStore`, errors |
| `jhigu-patro-utils-ts/sms-file-store` | `FileReminderStore`, `serializeReminders`, `parseReminders`, `SmsStoreError` (Node only, it uses `node:fs`) |

Templates, `smsSegments` and the gateways do not need the calendar. Reminders do: a reminder has a BS send date, and the scheduler turns it into a moment in time. Load the calendar once at start-up, as in `docs/USAGE.md` ("Setup").

```js test
import { readFileSync } from 'node:fs';
import { InlineCalendarDataSource, initializeCalendar } from 'jhigu-patro-utils-ts';

const data = JSON.parse(readFileSync('../data/nepali_calendar_data.json', 'utf8'));
initializeCalendar(new InlineCalendarDataSource(
  data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough,
));
```

Dart: the SMS code is in the main library, `package:jhigu_patro_utils/jhigu_patro_utils.dart`. The file store is separate, `package:jhigu_patro_utils/sms_file_store.dart`, because it uses `dart:io` and so is not for the web. Initialise the calendar with `NepaliCalendar.initialize(InlineCalendarDataSource(...))`.

## Quick start (TypeScript)

Render a built-in template, count its parts, send it through your own function, and run one scheduler pass.

```js test
import {
  CallbackSmsGateway, MockSmsGateway, InMemoryReminderStore, ReminderScheduler,
  renderSmsTemplate, smsSegments,
} from 'jhigu-patro-utils-ts/sms';

const text = renderSmsTemplate('appointment', 'en', { name: 'Ram', date: '2082-05-10', time: '9:00', sender: 'Shop' });
text; // => 'Dear Ram, reminder: your appointment is on 2082-05-10 at 9:00. - Shop'
smsSegments(text); // => { encoding: 'gsm7', units: 69, segments: 1, perSegment: 160 }

// Your provider goes inside `send`. Return a result, or throw.
const gateway = new CallbackSmsGateway({
  send: async (message) => {
    // call your provider with message.toE164 and message.text
    return { ok: true, providerId: 'abc123' };
  },
});
const result = await gateway.send({ toE164: '+9779841234567', text });
result; // => { ok: true, providerId: 'abc123' }

// A reminder, due 09:00 Nepal time on 2082-05-10 (BS).
const mock = new MockSmsGateway();
const store = new InMemoryReminderStore();
await store.save({
  id: 'r1', to: '+9779841234567', templateKey: 'appointment', language: 'en',
  values: { name: 'Ram', date: '2082-05-10', time: '9:00', sender: 'Shop' },
  sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 0,
  status: 'pending', attempts: 0,
});
const nineAmNepal = Date.UTC(2025, 7, 26, 3, 15);   // 09:00 in Nepal is 03:15 UTC
const scheduler = new ReminderScheduler({ gateway: mock, store, clock: () => nineAmNepal });
await scheduler.runOnce(); // => { due: 1, sent: 1, retrying: 0, failed: 0 }
mock.sent.map(m => m.text); // => [text]
(await store.loadAll())[0].status; // => 'sent'
```

## Quick start (Dart)

```dart
final text = renderSmsTemplate('appointment', 'en',
    {'name': 'Ram', 'date': '2082-05-10', 'time': '9:00', 'sender': 'Shop'});
// Dear Ram, reminder: your appointment is on 2082-05-10 at 9:00. - Shop

final gateway = CallbackSmsGateway(
  sendOne: (message) async {
    // call your provider here
    return const SmsResult.success(providerId: 'abc123');
  },
);
final ok = (await gateway.send(SmsMessage(toE164: '+9779841234567', text: text))).ok; // true

final mock = MockSmsGateway();
final store = InMemoryReminderStore();
await store.save(Reminder(
  id: 'r1', to: '+9779841234567', templateKey: 'rentDue', language: 'en',
  values: {'name': 'Ram', 'amount': 'Rs. 15,000', 'month': 'Bhadra', 'dueDate': '2082-05-15', 'sender': 'Shop'},
  sendDate: NepaliDate.checked(2082, 5, 10), hour: 9, minute: 0,
));
final scheduler = ReminderScheduler(gateway: mock, store: store);
print(await scheduler.runOnce());   // RunSummary(due: 1, sent: 1, retrying: 0, failed: 0) once 09:00 Nepal time has passed
```

## The gateway interface

```text
SmsGateway
  send(message)          -> result
  sendBulk(messages)     -> results, one per message, in the same order
SmsMessage  { toE164, text, reference? }
SmsResult   { ok, providerId?, error? }
```

`toE164` is the destination in E.164 form, for example `+9779841234567`. `isE164(text)` accepts `+`, then 8 to 15 digits, the first not zero. `reference` is your own id; the scheduler sets it to the reminder id.

There are three ways to get a gateway:

1. Implement `SmsGateway` yourself.
2. Wrap your own functions with `CallbackSmsGateway`. Give it `send`, and optionally `sendBatch` and `maxBatchSize`. Without `sendBatch`, `sendBulk` calls `send` one message at a time. With it, bulk sends are split into batches of at most `maxBatchSize` (default: one batch). In Dart the names are `sendOne`, `sendBatch` and `maxBatchSize`.
3. `MockSmsGateway` for tests and demos. It records accepted messages in `sent` and every attempt in `attempts`, and can be told to fail.

Rules the callback gateway follows:

- A function that throws gives an `UNKNOWN` error result. If it throws an `SmsError`, that code is used. The thrown message is dropped, so a number or text cannot leak through an error.
- A batch that returns the wrong number of results gives `UNKNOWN` for that whole batch. A batch that throws gives the same for that batch.
- Bulk results keep the input order.
- A bad `maxBatchSize` (not a whole number of at least 1) is refused when the gateway is built.

Your adapter maps the provider's errors to the library's codes: `AUTH`, `BALANCE`, `BAD_NUMBER`, `RATE_LIMIT`, `SERVER`, `NETWORK`, `UNKNOWN`. `BAD_TEMPLATE` is set by the scheduler, not by an adapter.

```js test
import { CallbackSmsGateway, MockSmsGateway, SmsError, isE164 } from 'jhigu-patro-utils-ts/sms';

const flaky = new CallbackSmsGateway({
  send: async (m) => {
    if (m.text === 'broke') throw new Error('provider says: 500 for +9779800000000');
    if (m.text === 'poor') throw new SmsError('BALANCE');
    return { ok: true, providerId: `id-${m.text}` };
  },
});
const broke = await flaky.send({ toE164: '+9779841234567', text: 'broke' });
broke.ok; // => false
broke.error.code; // => 'UNKNOWN'
broke.error.message; // => 'The SMS could not be sent.'
(await flaky.send({ toE164: '+9779841234567', text: 'poor' })).error.code; // => 'BALANCE'
const bulk = await flaky.sendBulk([{ toE164: '+9779841234567', text: 'a' }, { toE164: '+9779841234567', text: 'poor' }]);
bulk.map(r => r.ok); // => [true, false]

const fake = new MockSmsGateway();
fake.failNext('RATE_LIMIT');
(await fake.send({ toE164: '+9779841234567', text: 'x' })).error.code; // => 'RATE_LIMIT'
(await fake.send({ toE164: '+9779841234567', text: 'y' })).providerId; // => 'mock-1'
(await fake.send({ toE164: 'not-a-number', text: 'z' })).error.code; // => 'BAD_NUMBER'
fake.attempts.length; // => 3
fake.sent.length; // => 1
isE164('+9779841234567'); // => true
isE164('9779841234567'); // => false
```

`MockSmsGateway.failNext(code, count)` fails the next sends. `failFor(reference, codes)` fails successive sends of messages with that reference, one code per attempt. The mock also answers `BAD_NUMBER` for a destination that is not E.164.

## Templates

Three templates are built in, each in English and Nepali: `rentDue`, `udhaaro` (money owed) and `appointment`. Their text is in the shared strings tables (`data/strings.*.json`, group `smsTemplates`). The English text is:

| Key | Placeholders | English text |
| --- | --- | --- |
| `rentDue` | `name`, `amount`, `month`, `dueDate`, `sender` | Dear {name}, your rent of {amount} for {month} is due on {dueDate}. Please pay on time. - {sender} |
| `udhaaro` | `name`, `amount`, `dueDate`, `sender` | Dear {name}, you owe {amount}. Please clear the balance by {dueDate}. - {sender} |
| `appointment` | `name`, `date`, `time`, `sender` | Dear {name}, reminder: your appointment is on {date} at {time}. - {sender} |

The Nepali template text and error messages have not been reviewed by a native speaker.

Placeholder rules:

- A placeholder is `{name}` where name is letters, digits and underscore.
- All placeholders are replaced in one pass. A value that itself contains `{x}` is not expanded.
- A value counts as missing when it is absent, `undefined` or `null`. An empty string is a value. `0` is a value.
- In strict mode (the default) a missing value throws `SmsTemplateError` `MISSING_VALUE`, and its `key` is the placeholder name. With `{ strict: false }` it becomes empty text.
- Extra values are ignored.
- There is no escape syntax. Text outside placeholders, including a lone `{` or `{{`, is kept as it is. To put a literal `{name}` in a message, pass it as a value.
- Nothing is escaped or limited in the values. You are responsible for their content and length.

`getSmsTemplate(key, language)` returns the raw text and throws `UNKNOWN_TEMPLATE` for another key. `renderSmsTemplate(key, language, values, options)` renders a built-in template. `renderTemplate(text, values, options)` renders any text of your own. `templatePlaceholders(text)` lists the names, each once, in order of first appearance.

```js test
import {
  renderTemplate, renderSmsTemplate, getSmsTemplate, templatePlaceholders, smsTemplateKeys, SmsTemplateError,
} from 'jhigu-patro-utils-ts/sms';

smsTemplateKeys; // => ['rentDue', 'udhaaro', 'appointment']
templatePlaceholders(getSmsTemplate('udhaaro', 'en')); // => ['name', 'amount', 'dueDate', 'sender']
templatePlaceholders('Hi {name}, {name} owes {amount} {x'); // => ['name', 'amount']
renderTemplate('A {a} B {b}', { a: '{b}', b: 'x' }); // => 'A {b} B x'
renderTemplate('A {a}', {}, { strict: false }); // => 'A '
renderTemplate('A {a} {{', { a: 0 }); // => 'A 0 {{'

let missing;
try { renderSmsTemplate('appointment', 'en', { name: 'Ram' }); } catch (e) { missing = e; }
missing instanceof SmsTemplateError; // => true
missing.code; // => 'MISSING_VALUE'
missing.key; // => 'date'

let unknown;
try { getSmsTemplate('nope', 'en'); } catch (e) { unknown = e; }
unknown.code; // => 'UNKNOWN_TEMPLATE'

renderSmsTemplate('appointment', 'ne', { name: 'राम', date: '2082-05-10', time: '9:00', sender: 'Shop' });
// => 'आदरणीय राम, सम्झना: तपाईंको अपोइन्टमेन्ट 2082-05-10 मा 9:00 बजे छ। - Shop'
```

## The segment counter

`smsSegments(text)` estimates how many SMS parts a message needs. It returns `{ encoding, units, segments, perSegment }`.

How it is implemented:

- If every character is in the GSM 03.38 default alphabet (the table is written from 3GPP TS 23.038), the encoding is `gsm7`. Each character is one unit, except the extension characters `` ^ { } \ [ ~ ] | `` and the euro sign, which count as two (the form feed is also in the extension table).
- Otherwise the encoding is `ucs2` and a unit is one UTF-16 code unit. All Nepali text is `ucs2`. A character outside the basic plane, such as an emoji, is two units.
- A `gsm7` message of up to 160 units is one part. A longer one is `ceil(units / 153)` parts. A `ucs2` message of up to 70 units is one part. A longer one is `ceil(units / 67)` parts. `perSegment` is the size that applies: 160 or 153, 70 or 67.
- Empty text is `gsm7` with 0 units and 0 segments.
- The text is not normalised. A composed `é` is in the GSM table (one unit). The decomposed form `e` plus a combining accent is not, so the message becomes `ucs2`.
- An escape control character (U+001B) in the text is not accepted as GSM, so the message becomes `ucs2`.
- National language shift tables are not modelled.

It is an estimate. The GSM table was typed from the standard and has not been checked against a carrier, and a carrier may split differently (for example around an extension character or a surrogate pair). The library has no information about what a provider charges per part: [SOURCE NEEDED] for any pricing claim.

```js test
import { smsSegments } from 'jhigu-patro-utils-ts/sms';

smsSegments('a'.repeat(160)); // => { encoding: 'gsm7', units: 160, segments: 1, perSegment: 160 }
smsSegments('a'.repeat(161)); // => { encoding: 'gsm7', units: 161, segments: 2, perSegment: 153 }
smsSegments('€'.repeat(81)); // => { encoding: 'gsm7', units: 162, segments: 2, perSegment: 153 }
smsSegments('नमस्ते'); // => { encoding: 'ucs2', units: 6, segments: 1, perSegment: 70 }
smsSegments('न'.repeat(71)); // => { encoding: 'ucs2', units: 71, segments: 2, perSegment: 67 }
smsSegments('😀').units; // => 2
smsSegments('é').encoding; // => 'gsm7'
smsSegments('é').encoding; // => 'ucs2'
smsSegments(''); // => { encoding: 'gsm7', units: 0, segments: 0, perSegment: 160 }
```

## Reminders and the scheduler

A `Reminder` holds everything needed to send later:

| Field | Meaning |
| --- | --- |
| `id` | Your unique id. Also used as the message `reference`. |
| `to` | E.164 destination. |
| `templateKey` | A built-in key: `rentDue`, `udhaaro` or `appointment`. |
| `language` | `ne` or `en`. |
| `values` | Placeholder values: text, finite numbers or null. |
| `sendDate`, `hour`, `minute` | BS date and time of day in Nepal time. Hour is 0 to 23, minute 0 to 59. |
| `status` | `pending`, `sent` or `failed`. |
| `attempts` | Send attempts so far. |
| `retryAt` | Epoch milliseconds before which a retry must not run. Set after a failed attempt. |
| `providerId` | Set when sent, from the gateway result. |
| `lastError` | Code of the last failure. |

The send moment is `reminderSendAt(reminder)`. Nepal is UTC+05:45 all year, and the maths uses integer day numbers, never the machine's local time zone. For 2082-05-10 at 09:00 it is 03:15 UTC on 26 August 2025.

`ReminderScheduler` options:

| Option | Default | Meaning |
| --- | --- | --- |
| `gateway` | required | Your `SmsGateway`. |
| `store` | required | A `ReminderStore`. |
| `clock` | `Date.now` | Returns epoch ms. Inject one in tests. |
| `backoffMinutes` | `[1, 5, 30]` | Wait before retry n (1-based). The last value repeats. |
| `maxAttempts` | `4` | Attempts before a reminder is marked failed (the first try and three retries). |
| `permanentErrors` | `['BAD_NUMBER']` | Codes that fail a reminder at once, with no retry. |
| `intervalMs` | `60000` | Timer period for `start()`. Dart calls it `interval` (a `Duration`). |

`runOnce()` does one pass:

1. Load all reminders and keep the `pending` ones whose send moment has passed and whose `retryAt`, if any, has passed.
2. Order them oldest first (by the later of send moment and `retryAt`), ties by id.
3. A reminder whose `to` is not E.164 fails at once with `BAD_NUMBER`. One whose template cannot be rendered (missing value, unknown key) fails at once with `BAD_TEMPLATE`. The gateway is not called for either.
4. All the others go to the gateway in one `sendBulk` call. The results must be one per message, in order.
5. On success, the reminder is saved as `sent` with its `providerId`. On failure, `attempts` goes up. If the code is permanent or `attempts` has reached `maxAttempts`, it is saved as `failed`. Otherwise `retryAt` is set to now plus the back-off and it stays `pending`.
6. A gateway that throws, or returns the wrong number of results, counts as a failed attempt with `UNKNOWN`.

It returns `{ due, sent, retrying, failed }`. A pass that starts while another is still running returns at once with all zeros.

`start()` runs `runOnce` on a timer and `stop()` stops it. Do not rely on it for real use: it only runs while your process runs. Call `runOnce()` from a server job or cron.

Delivery is at-least-once. If the process stops after the gateway accepts a message and before the store saves, that reminder can be sent again. A sent reminder is not sent again after a restart, because `sent` is saved.

```js test
import { MockSmsGateway, InMemoryReminderStore, ReminderScheduler, reminderSendAt } from 'jhigu-patro-utils-ts/sms';

const sendAt = reminderSendAt({ sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 0 });
sendAt; // => 1756178100000
new Date(sendAt).toISOString(); // => '2025-08-26T03:15:00.000Z'

const gateway = new MockSmsGateway();
const store = new InMemoryReminderStore();
await store.save({
  id: 'r1', to: '+9779841234567', templateKey: 'rentDue', language: 'en',
  values: { name: 'Ram', amount: 'Rs. 15,000', month: 'Bhadra', dueDate: '2082-05-15', sender: 'Shop' },
  sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 0, status: 'pending', attempts: 0,
});
gateway.failFor('r1', ['NETWORK', 'SERVER']);   // the first two attempts fail

let now = sendAt - 60_000;
const scheduler = new ReminderScheduler({ gateway, store, clock: () => now });
await scheduler.runOnce(); // => { due: 0, sent: 0, retrying: 0, failed: 0 }

now = sendAt;
await scheduler.runOnce(); // => { due: 1, sent: 0, retrying: 1, failed: 0 }
const first = (await store.loadAll())[0];
first.attempts; // => 1
first.lastError; // => 'NETWORK'
first.retryAt; // => sendAt + 60_000

await scheduler.runOnce(); // => { due: 0, sent: 0, retrying: 0, failed: 0 }

now = sendAt + 60_000;
await scheduler.runOnce(); // => { due: 1, sent: 0, retrying: 1, failed: 0 }
(await store.loadAll())[0].retryAt; // => sendAt + 60_000 + 5 * 60_000

now = sendAt + 6 * 60_000;
await scheduler.runOnce(); // => { due: 1, sent: 1, retrying: 0, failed: 0 }
const done = (await store.loadAll())[0];
done.status; // => 'sent'
done.attempts; // => 3
done.providerId; // => 'mock-1'
gateway.attempts.length; // => 3
```

## Stores

A store implements three methods: `loadAll()`, `save(reminder)` and `delete(id)`. `save` replaces a reminder with the same id.

- `InMemoryReminderStore` keeps copies in memory. Use it for tests, demos and short-lived processes.
- `FileReminderStore(path)` keeps all reminders in one JSON file. In TypeScript it is in `jhigu-patro-utils-ts/sms-file-store` and needs Node. In Dart it is in `package:jhigu_patro_utils/sms_file_store.dart` and needs `dart:io`. The sources are `ts/src/smsFileStore.ts` and `dart/lib/sms_file_store.dart`.
- For a database, implement `ReminderStore` yourself. A database-backed store is not built.

### The file store

The file has the same format in both languages, so either library can read a file the other wrote. The shared example is `testdata/sms_store.json`.

- Shape: `{ "version": 1, "reminders": [ ... ] }`, two-space indent, reminders sorted by `id`, a fixed key order inside each reminder, `values` keys sorted, optional fields left out when unset, a final newline. Devanagari is written as it is, not as `\u` escapes.
- Writes are atomic: the new text goes to a temporary file in the same folder, is flushed, and is renamed over the real file. A failure removes the temporary file and leaves the old file. The error is `WRITE_FAILED`. TypeScript also flushes the folder where the platform allows it. Dart cannot, so after a power cut the very last write can still be lost.
- Calls on one store object run one at a time in order, so a read sees every save that finished before it, and a failed call does not block the next.
- One process only. There is no lock. Two store objects, or two processes, on one file can overwrite each other.
- A missing file is an empty store. The folder is created on the first write.
- Reading is strict. A file that is not UTF-8, has a byte order mark, is not valid JSON, or has no `reminders` list is `CORRUPT_FILE`. A version other than 1 is `UNSUPPORTED_VERSION`. A bad field, a repeated id, or a value that is not text, a finite number or null is `INVALID_REMINDER`, naming the position and the field, never the value. A folder or unreadable path is `READ_FAILED`. A damaged file is never reset or overwritten, and `save` and `delete` fail on it too.
- Checks are structural: year 2000 to 2100, month 1 to 12, day 1 to 32, hour 0 to 23, minute 0 to 59. Whether the day exists in that month is not checked by the store.
- Fields this version does not know are dropped when a reminder is rewritten.
- The file holds phone numbers. TypeScript creates it with mode 0600 (owner only). Dart has no permission API, so the file gets the process default: keep it in a folder only your service can read.
- The whole file is rewritten on every save. With thousands of reminders saves get slow; use a database store then.

```js test
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockSmsGateway, ReminderScheduler } from 'jhigu-patro-utils-ts/sms';
import { FileReminderStore, SmsStoreError } from 'jhigu-patro-utils-ts/sms-file-store';

const dir = await mkdtemp(join(tmpdir(), 'jhigu-sms-'));
try {
  const file = join(dir, 'data', 'reminders.json');
  const store = new FileReminderStore(file);
  await store.loadAll(); // => []

  await store.save({
    id: 'b', to: '+9779841234567', templateKey: 'appointment', language: 'ne',
    values: { name: 'राम', date: '2082-05-10', time: '9:00', sender: 'Shop' },
    sendDate: { year: 2082, month: 5, day: 10 }, hour: 9, minute: 0, status: 'pending', attempts: 0,
  });
  await store.save({
    id: 'a', to: '+9779841234567', templateKey: 'udhaaro', language: 'en',
    values: { name: 'Sita', amount: 'Rs. 500', dueDate: '2082-05-20', sender: 'Shop' },
    sendDate: { year: 2082, month: 5, day: 11 }, hour: 9, minute: 0, status: 'pending', attempts: 0,
  });
  const text = await readFile(file, 'utf8');
  text.startsWith('{\n  "version": 1,\n  "reminders": [\n    {\n      "id": "a",'); // => true
  text.includes('"name": "राम"'); // => true
  (await store.loadAll()).map(r => r.id); // => ['a', 'b']

  // A new store object on the same file (a restart) sees the same reminders.
  const afterRestart = new FileReminderStore(file);
  const gateway = new MockSmsGateway();
  const at = Date.UTC(2025, 7, 26, 3, 15);
  const scheduler = new ReminderScheduler({ gateway, store: afterRestart, clock: () => at });
  await scheduler.runOnce(); // => { due: 1, sent: 1, retrying: 0, failed: 0 }
  (await new FileReminderStore(file).loadAll()).map(r => r.status); // => ['pending', 'sent']

  // A second process start does not send the same reminder again.
  const again = new ReminderScheduler({ gateway: new MockSmsGateway(), store: new FileReminderStore(file), clock: () => at });
  await again.runOnce(); // => { due: 0, sent: 0, retrying: 0, failed: 0 }

  // A damaged file is an error, and is left as it was.
  const badFile = join(dir, 'bad.json');
  await writeFile(badFile, '{oops');
  let corrupt;
  try { await new FileReminderStore(badFile).loadAll(); } catch (e) { corrupt = e; }
  corrupt instanceof SmsStoreError; // => true
  corrupt.code; // => 'CORRUPT_FILE'
  (await readFile(badFile, 'utf8')); // => '{oops'

  let invalid;
  try { await store.save({ id: '', to: 'x' }); } catch (e) { invalid = e; }
  invalid.code; // => 'INVALID_REMINDER'
} finally {
  await rm(dir, { recursive: true, force: true });
}
```

In Dart:

```dart
import 'package:jhigu_patro_utils/sms_file_store.dart';

final store = FileReminderStore('/var/lib/myapp/reminders.json');
await store.save(reminder);
final scheduler = ReminderScheduler(gateway: gateway, store: store);
await scheduler.runOnce();
```

A damaged file throws `SmsStoreException` (for example `SmsStoreException(CORRUPT_FILE): the reminder file is not valid JSON`).

## API reference

TypeScript names. Dart uses `Exception` instead of `Error` in class names (`SmsException`, `SmsTemplateException`, `SmsStoreException`), `sendOne` for the callback, and `Duration interval`. The error codes are the same strings (`name_` in Dart enums).

| Name | What it does | Throws |
| --- | --- | --- |
| `SmsGateway` | Interface: `send`, `sendBulk`. | |
| `CallbackSmsGateway` | Gateway built from your functions. | `RangeError` for a bad `maxBatchSize` (Dart: `ArgumentError`). Sends never throw; they return a failed result. |
| `MockSmsGateway` | Records `sent` and `attempts`. `failNext`, `failFor`. | Nothing |
| `SmsError` | Why a message was not sent: `code`, English `message`, `localized(language)`. | |
| `isE164(text)` | True for `+` and 8 to 15 digits, first not zero. | Nothing |
| `smsTemplateKeys` | The built-in keys. | |
| `getSmsTemplate(key, language)` | Raw template text. | `SmsTemplateError` `UNKNOWN_TEMPLATE` |
| `renderSmsTemplate(key, language, values, options?)` | Render a built-in template. | `SmsTemplateError` `MISSING_VALUE` (strict) or `UNKNOWN_TEMPLATE` |
| `renderTemplate(text, values, options?)` | Render your own text. | `SmsTemplateError` `MISSING_VALUE` (strict) |
| `templatePlaceholders(text)` | Placeholder names, once each. | Nothing |
| `smsSegments(text)` | Encoding, units, parts, part size. | Nothing |
| `reminderSendAt(reminder)` | Epoch ms of the Nepal-time send moment. In Dart the arguments are `(sendDate, hour, minute)`. | The calendar must be loaded |
| `InMemoryReminderStore` | Reminders in memory. | Nothing |
| `ReminderScheduler` | `runOnce`, `start`, `stop`. | `RangeError` for bad options (empty or negative `backoffMinutes`, `maxAttempts` below 1). Errors from your store propagate. |
| `FileReminderStore(path)` | File-backed store. | `RangeError` for an empty path; `SmsStoreError` on use |
| `serializeReminders`, `parseReminders` | The file text for reminders, and back. | `SmsStoreError` on parse |

`SmsError` codes: `AUTH`, `BALANCE`, `BAD_NUMBER`, `RATE_LIMIT`, `SERVER`, `NETWORK`, `UNKNOWN`, `BAD_TEMPLATE`. `SmsStoreError` codes: `CORRUPT_FILE`, `UNSUPPORTED_VERSION`, `INVALID_REMINDER`, `READ_FAILED`, `WRITE_FAILED`. Error messages never contain the phone number or the message text.

## Command line

The CLI has an `sms` command. It renders a template and counts its parts. It does not send anything and does not touch reminders.

```text
$ jhigu-patro sms keys
rentDue      name, amount, month, dueDate, sender
udhaaro      name, amount, dueDate, sender
appointment  name, date, time, sender

$ jhigu-patro sms appointment name=Ram date=2082-05-10 time=9:00 sender=Shop
Dear Ram, reminder: your appointment is on 2082-05-10 at 9:00. - Shop

gsm7, 69 units, 1 segment

$ jhigu-patro sms appointment --lang ne name=राम date=2082-05-10 time=9:00 sender=Shop
आदरणीय राम, सम्झना: तपाईंको अपोइन्टमेन्ट 2082-05-10 मा 9:00 बजे छ। - Shop

ucs2, 73 units, 2 segments

$ jhigu-patro sms appointment name=Ram
✖ A value for a template placeholder is missing. (date)
```

The last command exits with code 1. An unknown template prints `Unknown SMS template.` and also exits with 1. Add `--json` for machine-readable output: `{ "text", "encoding", "units", "segments" }`.

## Recipes

### 1. Plug in your own provider

Wrap your provider's client in `CallbackSmsGateway` and translate its errors to `SmsError` codes. The thrown message is dropped, so map what you need to a code before you throw.

```js
const gateway = new CallbackSmsGateway({
  send: async ({ toE164, text }) => {
    const res = await myProvider.send(toE164, text);       // your client
    if (res.status === 401) throw new SmsError('AUTH');
    if (res.status === 402) throw new SmsError('BALANCE');
    if (res.status === 429) throw new SmsError('RATE_LIMIT');
    if (res.status >= 500) throw new SmsError('SERVER');
    return { ok: true, providerId: res.id };
  },
});
```

The status codes here belong to an imaginary provider. Use your provider's real documentation for the mapping.

### 2. Warn before a long message

```js test
import { renderSmsTemplate, smsSegments } from 'jhigu-patro-utils-ts/sms';

const msg = renderSmsTemplate('rentDue', 'ne', {
  name: 'राम', amount: 'रु 15,000', month: 'भदौ', dueDate: '2082-05-15', sender: 'Shop',
});
const seg = smsSegments(msg);
seg.encoding; // => 'ucs2'
seg.segments > 1; // => true
```

### 3. Send reminders from a nightly job

Keep reminders in a `FileReminderStore` (or your own store). On a server, run a script from cron that builds the scheduler and calls `runOnce()` once. Do not rely on `start()` unless your process is long-lived. Make sure only one such job runs at a time, because the file store has no lock.

### 4. Retry on your own schedule

Pass `backoffMinutes`, `maxAttempts` and `permanentErrors`. For example, fail at once on `AUTH` as well as `BAD_NUMBER`:

```js test
import { MockSmsGateway, InMemoryReminderStore, ReminderScheduler, reminderSendAt } from 'jhigu-patro-utils-ts/sms';

const gateway = new MockSmsGateway();
const store = new InMemoryReminderStore();
const date = { year: 2082, month: 5, day: 10 };
await store.save({
  id: 'x', to: '+9779841234567', templateKey: 'appointment', language: 'en',
  values: { name: 'Ram', date: '2082-05-10', time: '9:00', sender: 'Shop' },
  sendDate: date, hour: 9, minute: 0, status: 'pending', attempts: 0,
});
gateway.failNext('AUTH');
const at = reminderSendAt({ sendDate: date, hour: 9, minute: 0 });
const scheduler = new ReminderScheduler({
  gateway, store, clock: () => at, permanentErrors: ['BAD_NUMBER', 'AUTH'],
});
await scheduler.runOnce(); // => { due: 1, sent: 0, retrying: 0, failed: 1 }
(await store.loadAll())[0].status; // => 'failed'
(await store.loadAll())[0].lastError; // => 'AUTH'
```

### 5. A reminder with a bad number never reaches the gateway

```js test
import { MockSmsGateway, InMemoryReminderStore, ReminderScheduler, reminderSendAt } from 'jhigu-patro-utils-ts/sms';

const gateway = new MockSmsGateway();
const store = new InMemoryReminderStore();
const date = { year: 2082, month: 5, day: 10 };
await store.save({
  id: 'bad', to: '12345', templateKey: 'appointment', language: 'en',
  values: { name: 'Ram', date: '2082-05-10', time: '9:00', sender: 'Shop' },
  sendDate: date, hour: 9, minute: 0, status: 'pending', attempts: 0,
});
const at = reminderSendAt({ sendDate: date, hour: 9, minute: 0 });
await new ReminderScheduler({ gateway, store, clock: () => at }).runOnce(); // => { due: 1, sent: 0, retrying: 0, failed: 1 }
gateway.attempts.length; // => 0
(await store.loadAll())[0].lastError; // => 'BAD_NUMBER'
```

## Errors and edge cases

- A reminder with a template value missing fails with `BAD_TEMPLATE` and is not retried.
- A failed reminder stays in the store as `failed`. Nothing deletes it. Use `delete(id)` when you are done with it.
- The scheduler does not check `hour` and `minute` ranges. The file store does (0 to 23, 0 to 59).
- The file store does not check that the day exists in the month (that needs the calendar data). `data/SMS_NOTES.md` says the scheduler's date maths is where a bad date would show; this guide does not test that case.
- The scheduler's backoff list is in minutes and may hold fractions. Negative or `NaN` values are refused when the scheduler is built.
- Two `runOnce` passes that overlap do not double-send: the second returns zeros.
- The library never logs message text or phone numbers.

## Accuracy, limits and known gaps

- **There is no Sandesh gateway, or any other provider gateway.** The requirement list (S-2) asked for a Sandesh gateway with certificate pinning. The implementation guide (section 13.2) marks the Sandesh API details as [SOURCE NEEDED]: endpoints, headers, error format and the preview rules were never obtained, and the guide says not to guess them. `data/SMS_NOTES.md` records the decision that replaced S-2: no provider client is shipped (no Sandesh gateway, no endpoints, no HTTP code, no certificate pinning), and the caller supplies the gateway. The guide's goal of matching the Sandesh preview (S-5) is not applicable. If you want Sandesh, write an adapter from their official documentation.
- **What is built:** the gateway interface, `CallbackSmsGateway`, `MockSmsGateway`, three templates in two languages, the renderer, `smsSegments`, the scheduler, the in-memory store and the file store, in both TypeScript and Dart.
- **What is not built:** any real gateway, a database store, locking across processes or machines, a background service (the scheduler only runs while your process runs), delivery receipts, and any cost estimate.
- **Segment counts are estimates.** The GSM table was typed from the standard and not checked against a carrier. National language shift tables are not used. Carriers may split differently.
- **Nepali text is unreviewed.** The Nepali template text and the Nepali error messages have not been checked by a native speaker.
- **At-least-once delivery.** A crash between the gateway accepting and the store saving can send a message twice.
- **File store.** Not tested: a real power cut or crash mid-write, network file systems, Windows, two processes at once, and very large files. In Dart, the cleanup of the temporary file after a failed rename and the flush are not tested, because there is no way to inject that failure without a mocking layer. TypeScript has a fault-injection test for it.
- **Dart file permissions.** Dart cannot set file permissions, so the Dart file store does not.
- **Inputs are not validated** beyond E.164 and the template. Value content and length are your job.

## How it is tested

- `testdata/sms.json` holds the shared vectors: 16 render cases, 6 built-in template cases, 28 segment cases and 10 scheduler scenarios, with a fixed base time. `ts/tests/sms.test.ts` and `dart/test/sms_test.dart` both read it, so the two libraries must agree. The send moment for BS 2082-05-10 09:00 is checked against a value from an independent Python model.
- Both suites also test the gateways (`isE164`, the mock, the callback gateway with a throwing function, a thrown `SmsError`, batching and order, wrong result counts, a bad `maxBatchSize`), the scheduler options, overlapping runs, `start` and `stop`, and that error messages never hold the number or text.
- `testdata/sms_store.json` is the canonical file text. `ts/tests/smsFileStore.test.ts` and `dart/test/sms_file_store_test.dart` check that saving in any order writes exactly that text, that loading it works, that parse then serialise round-trips, and that Devanagari is kept as it is. They also feed 28 bad reminders to `save` and 41 bad files to `loadAll` (in Dart only the bad reminders a typed `Reminder` can express go through `save`; the rest are covered by the file cases), and test 60 parallel saves, a failed call not blocking the queue, and a restart with the scheduler (no resend of a sent reminder; a scheduled retry survives).
- `ts/tests/smsFileStoreFault.test.ts` mocks the rename to prove the old file stays whole and the new text is complete in the temporary file at that moment.
- The `js test` samples in this guide run in `ts/tests/docs.test.ts`. Dart samples are not run by that suite.

Run them:

```text
cd ts && npm run test:run
cd dart && dart test
```

## Related guides

- [Phone](../phone/README.md): parse a Nepali number into the E.164 form `to` needs.
- [Dates](../dates/README.md): BS dates for `sendDate`.
- [Money](../money/README.md): format amounts for a template value.
- [Receipts](../receipts/README.md): invoices to remind people about.
- [Usage guide](../../USAGE.md): setup and a short SMS section.
