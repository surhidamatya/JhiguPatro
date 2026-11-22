# Phone numbers

`parsePhone` reads a Nepali mobile or landline number written in any common way and returns one normalised result: the E.164 form to store, the national form to show, the type, the carrier (mobile only) and the area code (landline only). If the number is not valid it throws a `PhoneError` with a stable code and a message in English or Nepali. `isValidPhone` is the same check as a boolean that never throws. The carrier names and the active/inactive flags come from a best-effort table, not from an official source (see [Accuracy, limits and known gaps](#accuracy-limits-and-known-gaps)).

## When to use it

- You validate a phone field in a form and want a message in English or Nepali.
- You need one stored form for numbers typed as `984-1234567`, `+977 9841234567`, `०९८४...` or `00977...`.
- You want to show a carrier name next to a mobile number.
- You need to tell mobile numbers from landlines, for example to decide who gets an SMS.

Do not use it for numbers outside Nepal. A `+` number with any other country code is rejected with `BAD_PREFIX`. Do not use the carrier as a fact that must be right (billing, routing, number portability). The table is not official, and it does not know about numbers moved between carriers.

## Setup

The functions are in the main entry point. The prefix table is small (about 4 KB generated) and is part of the main bundle.

```bash
npm install jhigu-patro-utils-ts
```

```js
import { parsePhone, isValidPhone, PhoneError } from 'jhigu-patro-utils-ts';
```

The live input state machine is a separate entry point, `jhigu-patro-utils-ts/phone-input`. In Dart everything is exported from `package:jhigu_patro_utils/jhigu_patro_utils.dart`.

## Quick start (TypeScript)

```js test
import { parsePhone, isValidPhone, PhoneError } from 'jhigu-patro-utils-ts';

const p = parsePhone('+977 984-1234567');
p.e164; // => '+9779841234567'
p.national; // => '984-1234567'
p.type; // => 'mobile'
p.carrier; // => 'NTC'
parsePhone('061-520123'); // => { e164: '+97761520123', national: '061-520123', type: 'landline', carrier: null, areaCode: '61' }
isValidPhone('९८४१२३४५६७'); // => true
isValidPhone('123'); // => false

let err;
try { parsePhone('98412'); } catch (e) { err = e; }
err instanceof PhoneError; // => true
err.code; // => 'TOO_SHORT'
err.message; // => 'Phone number is too short'
err.localized('ne'); // => 'फोन नम्बर धेरै छोटो छ'
```

## Quick start (Dart)

```dart
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

void main() {
  final p = parsePhone('+977 984-1234567');
  print(p.e164);     // +9779841234567
  print(p.national); // 984-1234567
  print(p.type);     // mobile
  print(p.carrier);  // NTC

  final l = parsePhone('061-520123');
  print(l.areaCode); // 61
  print(isValidPhone('९८४१२३४५६७')); // true

  try {
    parsePhone('98412');
  } on PhoneException catch (e) {
    print(e.code.name_);       // TOO_SHORT
    print(e.message);          // Phone number is too short
    print(e.localized('ne'));  // फोन नम्बर धेरै छोटो छ
  }
}
```

Dart names differ in four places: the error is `PhoneException` (not `PhoneError`), the code is an enum `PhoneErrorCode` (the shared string such as `TOO_SHORT` is `code.name_`), `allowInactive` is a named parameter, and `type` is a `String` (`'mobile'` or `'landline'`), as in TypeScript.

## API reference

| Name | What it does | Throws |
|------|--------------|--------|
| `parsePhone(text, { allowInactive? })` | Parses and validates a number. Returns a `ParsedPhone`. | `PhoneError` |
| `isValidPhone(text, { allowInactive? })` | True if `parsePhone` would succeed. Also false for `undefined` or `null`. | Never |
| `PhoneError` | Error class. `code` is a `PhoneErrorCode`, `message` is English, `localized('en' \| 'ne')` reads the string tables. `name` is `'PhoneError'`. | - |
| `createPhoneInput(options)` (entry `phone-input`) | Headless state machine for a text field: formats while typing, shows carrier, reports errors. | `PhoneInput` actions do not throw |

`ParsedPhone` fields:

| Field | Meaning |
|-------|---------|
| `e164` | `+977` followed by the national number, for example `+9779841234567`. Store this form. |
| `national` | Display form. Mobile: `984-1234567`. Landline: a leading `0` plus the area code, a dash and the line number, for example `01-4123456` (Kathmandu valley) or `061-520123`. |
| `type` | `'mobile'` or `'landline'`. |
| `carrier` | Carrier name from the prefix table. `null` for landlines and for a mobile prefix with no known carrier. |
| `areaCode` | Landline only: the area code without the leading 0 (`'1'`, `'61'`). The property is absent on mobile numbers. In Dart it is `null`. |

`PhoneErrorCode` values and their messages (from `data/strings.en.json` and `data/strings.ne.json`):

| Code | English | Nepali |
|------|---------|--------|
| `EMPTY` | Enter a phone number | फोन नम्बर लेख्नुहोस् |
| `TOO_SHORT` | Phone number is too short | फोन नम्बर धेरै छोटो छ |
| `TOO_LONG` | Phone number is too long | फोन नम्बर धेरै लामो छ |
| `BAD_PREFIX` | Phone number does not start with a valid prefix | फोन नम्बर मान्य प्रिफिक्सबाट सुरु भएको छैन |
| `INACTIVE_PREFIX` | This phone number prefix is not in use | यो फोन नम्बरको प्रिफिक्स प्रयोगमा छैन |
| `BAD_CHARACTERS` | Phone number contains invalid characters | फोन नम्बरमा अमान्य अक्षर छन् |

The messages are not hard-coded in the parser. They come from the generated string tables, so a change to the label text is a change to `data/strings.*.json`.

## Accepted input forms

`parsePhone` removes spaces, dashes, dots and round brackets, converts Devanagari digits to ASCII, and then reads the number as one of these:

| Written as | Example |
|------------|---------|
| National, no prefix | `9841234567` |
| With separators | `984-123 4567`, `(01) 412 3456` |
| Leading trunk 0 | `09841234567` |
| `+977` | `+977 9841234567`, `+977-984-1234567` |
| `00977` | `009779841234567` |
| `977` without a plus | `9779841234567` (read as country code only when the whole text is 13 or 11 digits long) |
| Devanagari digits | `९८४१२३४५६७`, `+९७७ ९८४-१२३४५६७` |

A trunk 0 is also dropped after `+977`: `+977 01 4123456` is accepted. Any other character, such as a letter, gives `BAD_CHARACTERS`. A `+` followed by a country code that is not 977 gives `BAD_PREFIX`.

After the prefix is removed, the length decides the type:

- 10 digits: a mobile. It must start with `9` and its first three digits must be in the prefix table.
- 8 digits: a landline. See [Landline area codes](#landline-area-codes).
- 9 digits starting with 9, or fewer than 8 digits: `TOO_SHORT`.
- Anything else longer: `TOO_LONG`.

## Carrier detection and the prefix table

The table is `data/phone-prefixes.json`. It has 18 mobile prefixes. `tools/gen-data/gen.mjs` turns it into `ts/src/generated/phone.ts` and `dart/lib/src/generated/phone.dart`. Never edit the generated files. CI runs `node tools/gen-data/gen.mjs --check` and fails if they are stale.

| Carrier | Prefixes | Active |
|---------|----------|--------|
| Ncell | 970, 971, 980, 981, 982 | yes |
| NTC | 974, 975, 976, 984, 985, 986 | yes |
| Smart Telecom | 961, 962, 988 | no |
| UTL | 972 | no |
| Hello Mobile | 963 | no |
| no known carrier | 900, 960 | no (`carrier` is `null`) |

The data's status, taken from `data/PHONE_NOTES.md`:

- It is best effort. It is not an official Nepal Telecommunications Authority (NTA) publication. The JSON file says so in its `bestEffort` and `note` fields.
- Which prefixes are valid mobile prefixes, and the landline area-code structure, come from Google libphonenumber metadata for NP (as shipped in `libphonenumber-js` 4.x). This part is structural and is checked by `tools/check-phone/validate.mjs`.
- The carrier for each prefix and the active flag come from the `nepal_kit` 0.1.0 package, which cites NTA allocations as reported by operators and the trade press. This part is secondary and not independently verified.
- Prefixes 900 and 960 are valid in libphonenumber but have no known carrier here.
- The Ncell attribution of 971 comes from `nepal_kit` only.
- **[SOURCE NEEDED]** An official NTA numbering allocation to confirm carriers and active status.

## Inactive prefixes

A prefix whose carrier no longer operates (flag `active: false`) is rejected with `INACTIVE_PREFIX`. The flag is unconfirmed (see above). If you must accept old numbers, for example when you import a customer list, pass `allowInactive: true`.

```js test
import { parsePhone } from 'jhigu-patro-utils-ts';

let code;
try { parsePhone('9611234567'); } catch (e) { code = e.code; }
code; // => 'INACTIVE_PREFIX'
parsePhone('9611234567', { allowInactive: true }).carrier; // => 'Smart Telecom'
parsePhone('9001234567', { allowInactive: true }).carrier; // => null
```

## Landline area codes

The table has 57 entries in `landlineAreaCodes`: the Kathmandu valley code `1`, the two codes `10` and `11`, and the two-digit codes. Each entry has `places`, a list of English place names. The names are weak (taken from Wikipedia, which cites only ITU, retrieved 2019). Some valid codes have an empty `places` list. The parser does not use the place names, only the codes.

A landline has 8 digits after the prefix and trunk 0. The rules in the code are:

- If the first digit is `1`, the second digit must be `0` to `6`. `10` and `11` are their own area codes. Anything else starting with `1` is the Kathmandu code `1` and the number is shown as `01-4123456` (`d-ddddddd` after the 0).
- Otherwise the first two digits must be a code in the table, and the third digit must be `2` to `6`. For code `99` the third digit may also be `0`.
- Other areas are shown as `0` plus `dd-dddddd`, for example `061-520123`. Codes `10` and `11` use `dd-dddddd` too, for example `010-520123`.

So `12345678` (no leading 0) is also accepted, as a Kathmandu number. Keep this in mind if you parse text that may not be a phone number at all.

## The CLI

The `phone` command is in the `jhigu-patro` CLI (package `cli/`). It takes one number. Options: `--allow-inactive`, `--lang en|ne` (language of error messages), `--json`. Exit codes: 0 ok, 1 the number was rejected, 2 wrong use of the command.

```
$ jhigu-patro phone 9841234567
E.164:        +9779841234567
National:     984-1234567
Type:         mobile
Carrier:      NTC

$ jhigu-patro phone 061-520123
E.164:        +97761520123
National:     061-520123
Type:         landline
Area code:    61

$ jhigu-patro phone +977-9801234567 --json
{
  "e164": "+9779801234567",
  "national": "980-1234567",
  "type": "mobile",
  "carrier": "Ncell",
  "areaCode": null
}

$ jhigu-patro phone 9611234567
✖ This phone number prefix is not in use

$ jhigu-patro phone 9611234567 --allow-inactive
E.164:        +9779611234567
National:     961-1234567
Type:         mobile
Carrier:      Smart Telecom

$ jhigu-patro phone 98412 --lang ne
✖ फोन नम्बर धेरै छोटो छ

$ jhigu-patro phone 98412 --json
{"error":{"code":"TOO_SHORT","message":"Phone number is too short"}}
```

With `--json` an error is printed as JSON on stderr. Note that the CLI prints `"areaCode": null` for a mobile number, while the library leaves the property out.

## Phone input widgets

`jhigu-patro-utils-ts/phone-input` exports `createPhoneInput`, a framework-free state machine for a text field. It uses the same parser, so a number is valid in the input exactly when `parsePhone` accepts it. It adds what a form needs while the user is still typing:

- It converts Devanagari digits and drops every character except digits and a leading `+`.
- It formats as you type (`984-1234`, `01-4123456`) and keeps the caret in the right place.
- It shows the carrier as soon as the three-digit prefix is known.
- It reports `BAD_PREFIX` and `INACTIVE_PREFIX` as early as they can be known. It reports `TOO_SHORT` only after `blur()`.
- It never cuts extra digits silently: they stay and give `TOO_LONG`.
- Every change notifies subscribers once with the full state.

```js test
import { createPhoneInput } from 'jhigu-patro-utils-ts/phone-input';

const input = createPhoneInput({ language: 'ne' });
input.actions.input('9841234', 7);
input.getState().text; // => '984-1234'
input.getState().carrier; // => 'NTC'
input.getState().valid; // => false
input.actions.input('98412', 5);
input.actions.blur();
input.getState().error; // => 'TOO_SHORT'
input.getState().message; // => 'फोन नम्बर धेरै छोटो छ'
input.actions.input('9841234567');
input.getState().valid; // => true
input.getState().e164; // => '+9779841234567'
```

For the framework-free API, see [headless widgets](../headless-widgets/README.md). For the ready-made `<jhigu-phone-input>` element (a form-associated web component), see [web components](../web-components/README.md). In Dart the same machine is `PhoneInput` (exported from the package) with a `state` getter, `subscribe`, and methods `input`, `blur`, `setValue`, `clear` and `setLanguage`.

## Recipes

### 1. Validate a form field and show a message in the user's language

```js test
import { parsePhone, PhoneError } from 'jhigu-patro-utils-ts';

function check(text, lang) {
  try {
    parsePhone(text);
    return null;
  } catch (e) {
    if (e instanceof PhoneError) return e.localized(lang);
    throw e;
  }
}
check('', 'en'); // => 'Enter a phone number'
check('984abc4567', 'ne'); // => 'फोन नम्बरमा अमान्य अक्षर छन्'
check('9841234567', 'en'); // => null
```

### 2. Store one form, show another

Store `e164`. Show `national`. Two different inputs for the same person give the same stored value.

```js test
import { parsePhone } from 'jhigu-patro-utils-ts';

const a = parsePhone('984-123 4567');
const b = parsePhone('+९७७ ९८४-१२३४५६७');
a.e164 === b.e164; // => true
a.national; // => '984-1234567'
```

### 3. Tell mobile from landline

```js test
import { parsePhone } from 'jhigu-patro-utils-ts';

const kinds = ['9801234567', '01-4123456', '+977 61 520123'].map(n => parsePhone(n).type);
kinds; // => ['mobile', 'landline', 'landline']
```

### 4. Import an old list that has numbers on retired prefixes

Parse with `allowInactive: true` and keep the result, so the number is not lost, then decide what to do with `carrier`.

```js test
import { parsePhone } from 'jhigu-patro-utils-ts';

const rows = ['9841234567', '9721234567', '12'];
const kept = rows.flatMap(r => {
  try { return [parsePhone(r, { allowInactive: true }).e164]; } catch { return []; }
});
kept; // => ['+9779841234567', '+9779721234567']
```

### 5. Check a number from a CSV without an exception

`isValidPhone` is for a quick yes or no. Use `parsePhone` when you need the reason.

```js test
import { isValidPhone } from 'jhigu-patro-utils-ts';

['9841234567', '9831234567', ''].map(n => isValidPhone(n)); // => [true, false, false]
```

## Errors and edge cases

- `parsePhone('')` and text with only spaces give `EMPTY`. `isValidPhone(undefined)` is `false` and does not throw.
- A mobile with a wrong prefix, such as `9831234567`, gives `BAD_PREFIX`. So does a 10-digit number that does not start with 9, and a 8-digit number whose area code or third digit is not valid (`01-7123456`, `061-123456`).
- `+14155550123` (another country) gives `BAD_PREFIX`.
- 9 digits that start with 9 (`984123456`) give `TOO_SHORT`. `98412345678` gives `TOO_LONG`.
- The checks run in this order: empty, characters, country code, length, prefix. For a 10-digit number the prefix is checked before the active flag, so an unknown prefix is `BAD_PREFIX` and a known inactive one is `INACTIVE_PREFIX`.
- `parsePhone` does not check that the number is in service. It only checks the structure and the prefix.

## Accuracy, limits and known gaps

- The prefix table is best effort. Carrier names and active flags are not verified against an official source. **[SOURCE NEEDED]**: NTA numbering allocation.
- Smart Telecom (961, 962, 988), UTL (972) and Hello Mobile (963) are marked inactive according to `nepal_kit`. This is unconfirmed.
- The carrier is looked up from the prefix only. The code does not model number portability, so do not rely on it where a wrong carrier matters.
- Landline place names are incomplete and weak. Seven area codes have no place name. The Wikipedia page had conflicts, and two rows were rejected (Khotang 13 and Bandipur 100, invalid under libphonenumber).
- Only 10-digit mobile and 8-digit landline numbers are accepted. Short codes, toll-free numbers and extensions are rejected, because the data has no rules for them. [SOURCE NEEDED] for any other number type.
- TypeScript and Dart give the same result for every shared vector (`testdata/phone.json`).

## How it is tested

- `testdata/phone.json` holds 17 valid and 15 invalid vectors, shared by TypeScript and Dart. They are hand-derived from the data and the rules in the implementation guide, not from an official source. `ts/tests/phone.test.ts` and `dart/test/phone_test.dart` run them.
- `testdata/phone-input.json` holds scenarios for the input state machine, run by `ts/tests/phoneInput.test.ts` and `dart/test/phone_input_test.dart`. A test also checks that the input agrees with `parsePhone` on every valid vector.
- `tools/check-phone/validate.mjs` checks every prefix and area code in the JSON against the libphonenumber ranges. It also checks that every libphonenumber mobile range is present.
- The `js test` blocks in this guide are run by `ts/tests/docs.test.ts`.

Commands:

```bash
cd ts && npm run test:run
cd dart && dart test
node tools/check-phone/validate.mjs
node tools/gen-data/gen.mjs --check
```

## Related guides

- [Headless widgets](../headless-widgets/README.md): `createPhoneInput` and the other state machines.
- [Web components](../web-components/README.md): the `<jhigu-phone-input>` element.
- [SMS](../sms/README.md): templates and segments for the numbers you validate here.
- [Usage guide](../../USAGE.md)
