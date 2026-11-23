# Example: Node script

A plain Node (ES module) script that uses `jhigu-patro-utils-ts`: dates, money, phone, address, an SMS
template, a receipt and tithi. Each section of [`index.mjs`](index.mjs) stands alone; copy the ones you need.

## Run

```bash
cd ../../ts && npm ci && npm run build     # once: the library's dist/ folder
cd ../examples/node-script
npm install                                # links ../../ts (a "file:" dependency)
npm start
```

## What you should see

```
== Dates
AD 2025-08-26 is BS 2082-5-10
dual format:       10 Bhadra 2082 (AD 26 August 2025)
...
== Money
paisa:    123456750
format:   Rs. 12,34,567.50
VAT 13%:  Rs. 1,60,493.78 -> total Rs. 13,95,061.28
...
== Phone
+9779841234567 mobile NTC
rejected: TOO_SHORT - Phone number is too short
...
== Tithi
1 Baisakh 2082 at sunrise: प्रतिपदा (कृष्ण)
```

## How it is put together

1. **Install:** `package.json` has `"jhigu-patro-utils-ts": "file:../../ts"`. In your own project you would use a
   path to the repository or a tarball (see [step 1 of the guide](../README.md#step-1-get-the-packages)).
2. **Calendar data:** the JSON ships with the package. The script finds it through the package name
   (`createRequire(import.meta.url)('jhigu-patro-utils-ts/nepali_calendar_data.json')`), so there is no path to
   adjust, then calls `initializeCalendar` once.
3. **Imports:** the root import holds dates, money and phone. Address, SMS and receipts are separate entry
   points (`/address`, `/sms`, `/receipt`, `/receipt-html`) so a bundler only includes what you use.
4. **Money** is integer paisa (`Npr.fromRupees(...)`, `.paisa`). **Errors** are typed (`PhoneError` with a
   `code`).
5. **SMS** is rendered and counted but not sent: sending needs your own gateway
   ([SMS guide](../../docs/features/sms/README.md)).

Related guides: [dates](../../docs/features/dates/README.md), [money](../../docs/features/money/README.md),
[phone](../../docs/features/phone/README.md), [address](../../docs/features/address/README.md),
[receipts](../../docs/features/receipts/README.md), [tithi](../../docs/features/tithi/README.md).
