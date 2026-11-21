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
- Only `InMemoryReminderStore` is provided. Implement `ReminderStore` for files or a database.
- Inputs are not validated beyond E.164 and the template (hour/minute ranges are the caller's job).
