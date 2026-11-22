# SMS reminders (guide section 13)

Code: `ts/src/sms.ts` (`jhigu-patro-utils-ts/sms`), `dart/lib/src/sms.dart`.
Vectors: `testdata/sms.json` (16 render, 6 template, 28 segment, 10 scheduler scenarios).
Strings: groups `sms` (error messages) and `smsTemplates` (rent due, udhaaro, appointment) in `data/strings.*.json`.

## Decision: no built-in provider (replaces S-2)
The user chose to pick their own gateway. This library ships no provider client:
no Sandesh gateway, no endpoints, no HTTP code, no certificate pinning. Plug in any
provider by either:
- implementing `SmsGateway` (`send`, `sendBulk`), or
- wrapping your own function with `CallbackSmsGateway` (`send`, optional `sendBatch`, `maxBatchSize`).
Your adapter maps the provider's errors to `SmsErrorCode`
(AUTH, BALANCE, BAD_NUMBER, RATE_LIMIT, SERVER, NETWORK, UNKNOWN). A function that throws
becomes an UNKNOWN result; the thrown message is dropped so a number or text cannot leak.
The guide's "match the Sandesh preview" (S-5) is not applicable.

## Templates and renderer
`{name}` placeholders, `[A-Za-z0-9_]+`. One pass, so a value containing `{x}` is not
expanded. Missing = absent or null; empty string is a value. Strict (default) throws
`SmsTemplateError MISSING_VALUE` with the key; lenient writes empty text.
Nepali template text and error messages are unreviewed.

## smsSegments
GSM-7 (3GPP TS 23.038 default table, extension characters count 2): 160 per part, 153 in
multi-part. Anything else is UCS-2: 70 per part, 67 in multi-part. The GSM table was typed
from the standard, not checked against a carrier; national language shift tables are not
modelled. An estimate: carriers may split differently at extension characters or surrogate pairs.
Text is not normalised (a decomposed accent is UCS-2).

## Scheduler
- Due when Nepal send time (BS date + hour:minute, UTC+05:45) has passed and any retry time has passed. Time maths uses integer day numbers, no local `Date`.
- Oldest first, ties by id. All due messages go to the gateway in one `sendBulk`; results must be one per message in order.
- Retry back-off 1, 5, 30 minutes (last repeats), 4 attempts in all, then failed. BAD_NUMBER fails at once. All of these are options.
- A number that is not E.164 or an unrenderable template fails without calling the gateway (BAD_NUMBER, BAD_TEMPLATE).
- A gateway that throws, or returns the wrong number of results, counts as a failed attempt (UNKNOWN).
- At-least-once: a crash between the gateway accepting and the store saving can send again.
- Runs only while your process runs. For real use call `runOnce()` from a server job. `start()` is a plain timer.
- `InMemoryReminderStore` and a file-backed `FileReminderStore` (TS: `jhigu-patro-utils-ts/sms-file-store`, Node only; Dart: `package:jhigu_patro_utils/sms_file_store.dart`, `dart:io`) are provided. Implement `ReminderStore` for a database.

## File store
- One JSON file, the same in both libraries (`testdata/sms_store.json`): `{"version":1,"reminders":[...]}`, 2-space indent, reminders sorted by id, fixed key order (id, to, templateKey, language, values, sendDate, hour, minute, status, attempts, retryAt, providerId, lastError), `values` keys sorted, optional fields omitted when unset, final newline, Devanagari written as is. The canonical text in the vectors comes from an independent Python model (`json.dumps(indent=2, ensure_ascii=False)`).
- Atomic write: temp file in the same folder, flushed, renamed over the file; the TS store also flushes the folder (best effort). Failure removes the temp file and leaves the old file; errors are `WRITE_FAILED`. Calls on one store object are queued, so a read sees earlier saves and a failed call does not block the next.
- One process only; no lock file. Two store objects (or processes) on one file can overwrite each other.
- Strict reading: not UTF-8, a byte order mark, bad JSON, no `reminders` list is `CORRUPT_FILE`; a version other than 1 is `UNSUPPORTED_VERSION`; a bad field, an id repeated, or a value that is not text, a finite number or null is `INVALID_REMINDER` naming the position and field, never the value; a folder or unreadable path is `READ_FAILED`. A damaged file is never reset or overwritten (save and delete also fail). Whole numbers written as `9.0` are accepted as integers in both libraries. Fields this version does not know are dropped on rewrite.
- Structural checks only: year 2000..2100, month 1..12, day 1..32, hour 0..23, minute 0..59. Whether the day exists in that month is not checked (it needs the calendar data); the scheduler's date maths is where that would show.
- Privacy: error messages never contain the number or message values (tested with the number in every case). TS creates the file 0600; Dart has no permission API, so the Dart file gets the process default (documented).
- Tested: shared vectors (valid file text byte for byte, 28 bad reminders given to save, 41 bad files of which 28 hold one bad reminder each, whole numbers written as 9.0; in Dart only the bad reminders that a typed `Reminder` can express go through save, the rest are covered by the file cases), concurrency (60 parallel saves, same id, read-after-unawaited-save, save then delete), a failed call not poisoning the queue, a restart with the scheduler (no resend of a sent reminder; a scheduled retry survives). TS also has a fault-injection test (rename mocked: the old file is whole and the new text is complete in the temp file at the moment of rename; a failed rename removes the temp file). In Dart the temp-file cleanup after a failed rename and the flush are NOT tested (no way to inject a failure after the temp file exists without a mocking layer); a permission-denied write (non-root Unix) is tested in both.
- Not tested: a real power cut or crash mid-write, network file systems, Windows, two processes at once, very large files (the whole file is rewritten on every save, so thousands of reminders mean slow saves: use a database then).
- Inputs are not validated beyond E.164 and the template (hour/minute ranges are the caller's job).
