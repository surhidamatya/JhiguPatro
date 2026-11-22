# jhigu-patro (CLI)

Command-line tool for the Bikram Sambat (Nepali) calendar and the rest of the Jhigu Patro toolkit:
dates, money, phone numbers, addresses and SMS templates. It is a thin layer over
`jhigu-patro-utils-ts`, so it gives the same answers as the library.

Not published yet. Install it from this repository (below).

- [Install](#install)
- [Commands](#commands)
- [Output, exit codes and errors](#output-exit-codes-and-errors)
- [Date commands](#date-commands)
- [Money](#money)
- [Phone](#phone)
- [Address](#address)
- [SMS](#sms)
- [Format, parse and fiscal year](#format-parse-and-fiscal-year)
- [Scripting](#scripting)
- [Tests](#tests)

## Install

`jhigu-patro-utils-ts` is a peer of this package (in this repository it is linked from `../ts`).

```bash
cd ts && npm ci && npm run build      # the library the CLI uses
cd ../cli && npm ci && npm run build
npm install -g .                      # puts `jhigu-patro` on your PATH
```

Without installing it globally, run it from `cli/`:

```bash
node dist/index.js help
```

The examples below use `jhigu-patro`; replace it with `node dist/index.js` if you did not install it.

## Commands

```
jhigu-patro today
jhigu-patro ad2bs  <YYYY-MM-DD>
jhigu-patro bs2ad  <YYYY-MM-DD>
jhigu-patro month  [BS-YYYY] [1-12]
jhigu-patro info   <YYYY-MM-DD> [--ad|--bs]
jhigu-patro money  <amount> [--vat excl|incl] [--rate 13] [--words] [--lang en|ne]
jhigu-patro phone  <number> [--allow-inactive]
jhigu-patro address <localLevelId> <ward> [--tole T] [--street S]
jhigu-patro address search <text> [--limit 10] [--in auto|en|ne]
jhigu-patro sms keys
jhigu-patro sms <template> [name=value ...]
jhigu-patro fmt    <BS date> <preset|pattern> [--digits native|ascii]
jhigu-patro parse  <date text>
jhigu-patro fiscal <BS date>
jhigu-patro help
```

| Command | What it does | Library function |
|---|---|---|
| `today` | Today's BS date in Nepal, in both languages | `getCurrentNepaliDate` and the formatters |
| `ad2bs` | Converts an AD date to BS | `convertADToBS` |
| `bs2ad` | Converts a BS date to AD | `convertBSToAD` |
| `month` | Prints a month as a weekly grid | `getMonthGrid` |
| `info` | Everything about one date, in either calendar | conversion and formatters |
| `money` | Lakh grouping, paisa, VAT, amount in words | `Npr`, `vatExclusive`, `vatInclusive`, `amountInWords` |
| `phone` | Validates a number; E.164, national form, carrier | `parsePhone` |
| `address` | Formats an address, or searches the address data | `formatAddress`, `searchAddress` |
| `sms` | Lists templates, or renders one and counts segments | SMS templates and counter |
| `fmt` | Formats a BS date with a preset or a token pattern | `formatPreset`, `formatDate` |
| `parse` | Reads a date written many ways | `parseNepaliDate` |
| `fiscal` | The fiscal year of a BS date | `fiscalYear` |

## Output, exit codes and errors

- The commands from `money` on take `--lang en|ne` (the language of labels and error messages) and `--json`
  (the result as JSON; an error is JSON on stderr). The date commands print a boxed text report.
- Exit codes: `0` ok, `1` the input was rejected (a bad amount, phone number or date), `2` the command was
  used wrongly (a missing argument or an unknown option).
- Errors are one line and never a stack trace:

```
$ jhigu-patro phone 123
✖ Phone number is too short            (exit 1)

$ jhigu-patro money abc --json
{"error":{"code":"BAD_FORMAT","message":"Amount is not a valid number"}}     (exit 1)

$ jhigu-patro money
✖ Usage: jhigu-patro money <amount> [--vat excl|incl] [--rate 13] [--words] [--lang en|ne]     (exit 2)
```

## Date commands

The calendar data covers BS 2000 to 2100. Dates are plain calendar dates: no time zone is involved,
except that `today` uses the date in Nepal (GMT+5:45).

### `today`

Prints today's date in Nepal as BS and AD, with month and weekday names in both languages. The output
changes every day, so it is not shown here.

### `ad2bs` and `bs2ad`

```
$ jhigu-patro ad2bs 2025-02-20
────────────────────────────────────────────
  AD → BS  (2025-02-20)
────────────────────────────────────────────
  AD (input):         February 20, 2025
  BS (result):        Falgun 8, 2081
  BS (Nepali):        फागुन 8, 2081
  BS (numeric):       2081-11-08
  Weekday (EN):       Thursday
  Weekday (NE):       बिहिबार
  Relative:           ८ फागुन २०८१
────────────────────────────────────────────

$ jhigu-patro bs2ad 2082-11-08
  ...
  AD (result):        February 20, 2026
  AD (numeric):       2026-02-20
```

A day that does not exist is rejected, not rolled over to the next month:

```
$ jhigu-patro ad2bs 2025-02-30
✖ Invalid AD date "2025-02-30". That day does not exist     (exit 1)
```

### `month [BS-YYYY] [1-12]`

Prints the month as a grid with the weekday header in Nepali. Without arguments it prints the current month.

```
$ jhigu-patro month 2082 11
────────────────────────────────────────────
  फागुन २०८२  (Falgun 2082)
  2026-02-13 onwards
────────────────────────────────────────────
     आइ   सोम   मंग   बुध  बिहि शुक्र   शनि
  ───────────────────────────────────
                                    1     2
      3     4     5     6     7     8     9
     10    11    12    13    14    15    16
     17    18    19    20    21    22    23
     24    25    26    27    28    29    30
────────────────────────────────────────────
  Total days: 30
────────────────────────────────────────────
```

### `info <date> [--ad|--bs]`

Shows one date in both calendars. The input can be in either calendar, and the command decides which:
a year under 2000 can only be AD and a year over 2044 can only be BS. **2000 to 2044 is valid in both
calendars and is read as AD** (BS 2000 to 2044 are historical dates, AD 1943 to 1988), with a note saying
so. Pass `--bs` to read it as BS, or `--ad` to force AD.

```
$ jhigu-patro info 2025-08-26
────────────────────────────────────────────
  Date Info  (input treated as AD)
────────────────────────────────────────────
  Year 2025 is valid as AD and as BS; read as AD. Use --bs for BS.
  BS:                 १० भदौ २०८२, मंगलबार
  BS (Nepali):        भदौ 10, 2082
  BS (numeric):       2082-05-10
  AD:                 August 26, 2025
  AD (numeric):       2025-08-26
  Weekday (EN):       Tuesday
  Weekday (NE):       मंगलबार
  Relative (NE):      १० भदौ २०८२
────────────────────────────────────────────

$ jhigu-patro info 2082-11-08         # 2082 is over 2044: read as BS, no note
  Date Info  (input treated as BS)
```

An invalid date is rejected: `info 2082-13-40` prints `✖ BS date 2082/13/40 is out of range or invalid` (exit 1).

## Money

`money <amount>` takes an amount in rupees (decimals allowed, a negative amount is fine: `money -1500`). It
prints lakh grouping, the integer paisa, and the Devanagari form. Money is integer paisa inside; the amount
you type is converted to paisa exactly, with no floating point.

```
$ jhigu-patro money 1234567.5 --vat excl --words
Amount:       Rs. 12,34,567.50
Paisa:        123456750
Devanagari:   रु १२,३४,५६७.५०
In words:     Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paisa Only

VAT 13% (added to the price):
  Subtotal:   Rs. 12,34,567.50
  VAT:        Rs. 1,60,493.78
  Total:      Rs. 13,95,061.28
```

| Option | Meaning |
|---|---|
| `--vat excl` | The amount is the price before VAT; VAT is added. |
| `--vat incl` | The amount already includes VAT; it is split into subtotal and VAT. |
| `--rate N` | The VAT rate in percent. The default is 13. |
| `--words` | Also print the amount in words. |
| `--lang en\|ne` | The language of the words and the labels. |
| `--json` | Print the result as JSON. |

With `--lang ne` the words are Nepali. The Nepali word list has not been checked by a native speaker, and the
output says so:

```
$ jhigu-patro money 1234567.5 --words --lang ne
Amount:       Rs. १२,३४,५६७.५०
Paisa:        123456750
Devanagari:   रु १२,३४,५६७.५०
In words:     बाह्र लाख चौँतीस हजार पाँच सय सतसट्ठी रुपैयाँ पचास पैसा मात्र (Nepali words: not native-speaker reviewed)
```

Details: [Money guide](../docs/features/money/README.md).

## Phone

Accepts mobile and landline numbers with or without `+977`, with spaces or dashes, and in Devanagari digits.

```
$ jhigu-patro phone 9841234567 --json
{
  "e164": "+9779841234567",
  "national": "984-1234567",
  "type": "mobile",
  "carrier": "NTC",
  "areaCode": null
}
```

A number whose prefix is not in use is rejected unless you pass `--allow-inactive`. Carrier names are not an
official list; see [`data/PHONE_NOTES.md`](../data/PHONE_NOTES.md) and the
[Phone guide](../docs/features/phone/README.md).

## Address

```
$ jhigu-patro address 274 3 --lang ne
वडा नं. ३, भक्तपुर नगरपालिका, भक्तपुर, बाग्मती

$ jhigu-patro address search Bhaktapur --limit 3
district     23  Bhaktapur
localLevel  274  Bhaktapur Municipality
```

`address <localLevelId> <ward>` formats an address from a local level id and a ward; `--tole` and `--street`
add those lines. `address search` looks up provinces, districts and local levels by name; `--in en|ne|auto`
picks the language to search in. Details: [Address guide](../docs/features/address/README.md).

## SMS

```
$ jhigu-patro sms keys
rentDue      name, amount, month, dueDate, sender
udhaaro      name, amount, dueDate, sender
appointment  name, date, time, sender

$ jhigu-patro sms appointment name=Ram date=2082-05-10 time=9:00 sender=Shop
Dear Ram, reminder: your appointment is on 2082-05-10 at 9:00. - Shop

gsm7, 69 units, 1 segment
```

`sms keys` lists the built-in templates and the values each needs. `sms <template> name=value ...` renders one
and prints the encoding, the length in units and the number of segments. The CLI does not send anything.
Details: [SMS guide](../docs/features/sms/README.md).

## Format, parse and fiscal year

```
$ jhigu-patro fmt 2082-05-10 dual --json
{
  "date": "2082-05-10",
  "format": "dual",
  "text": "10 Bhadra 2082 (AD 26 August 2025)"
}

$ jhigu-patro fmt 2082-05-10 "D MMMM YYYY" --lang ne --digits native
१० भदौ २०८२

$ jhigu-patro parse "10 Bhadra 2082"
BS:  2082-05-10
AD:  2025-08-26

$ jhigu-patro fiscal 2082-05-10
Fiscal year: 2082/83
From:        2082-04-01
To:          2083-03-32
```

- `fmt` takes a preset (`full long iso slash dmy short monthYear gate dual fiscal`) or a token pattern such as
  `"D MMMM YYYY"`. `--digits native` writes Devanagari digits, `--digits ascii` Latin ones.
- `parse` reads a date written many ways (month names in English or Nepali, Devanagari digits) and prints BS and AD.
  A date that does not exist (like Poush 30, 2081) is a `PARSE_ERROR`, since it cannot be read from text.
- `fiscal` gives the fiscal year that contains a BS date. Nepal's fiscal year starts on 1 Shrawan.

See the [Dates guide](../docs/features/dates/README.md).

## Scripting

Use `--json` for machine-readable output and the exit code for control flow:

```bash
if out=$(jhigu-patro phone "$number" --json); then
  echo "$out" | jq -r .e164
else
  echo "rejected" >&2
fi
```

An error under `--json` is a JSON object on stderr: `{"error":{"code":"...","message":"..."}}`.

## Tests

```bash
cd cli && npm test      # node --test tests/cli.test.mjs tests/legacy.test.mjs
```

The tests run the built CLI as a child process and check output and exit codes.
