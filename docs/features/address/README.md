# Addresses

Nepal's administrative levels as data and as functions: 7 provinces, 77 districts, 753 local levels (municipalities and rural municipalities) and the number of wards in each local level. You can list the children of a level, look a record up by id, search by name in English or Nepali, and format a complete address as one line in either language. A headless state machine and a web component build a province, district, local level and ward select on top of the same data. The names come from a third-party dataset and are not checked against an official list (see [Accuracy, limits and known gaps](#accuracy-limits-and-known-gaps)).

## When to use it

- You need a province, district, local level and ward select, with the lists linked to each other.
- You store an address as a local level id plus a ward number and want to print it as text.
- You want to search places by name, typed in English or in Devanagari.
- You need the ward count of a local level to validate a ward number.

Do not use it as an official gazetteer. Do not store names: store ids (`localLevelId`, `ward`) and format when you display. Ids never change for a place (see [Ids](#ids)).

## Setup

The address data is about 130 KB of source, so it is in its own entry point and is not in the main bundle.

```bash
npm install jhigu-patro-utils-ts
```

```js
import { provinces, districtsOf, searchAddress, formatAddress } from 'jhigu-patro-utils-ts/address';
import { createAddressPicker } from 'jhigu-patro-utils-ts/address-picker';
```

In Dart, everything is exported from `package:jhigu_patro_utils/jhigu_patro_utils.dart`.

## Quick start (TypeScript)

```js test
import { provinces, districtsOf, localLevelsOf, getLocalLevel, searchAddress, formatAddress } from 'jhigu-patro-utils-ts/address';

provinces().length; // => 7
districtsOf(1)[0].en; // => 'Bhojpur'
localLevelsOf(27).length; // => 11
getLocalLevel(307).en; // => 'Kathmandu Metropolitan City'
getLocalLevel(307).wards; // => 32
searchAddress('kathmandu')[0].kind; // => 'district'
formatAddress({ localLevelId: 1, ward: 2 }); // => 'Ward 2, Shadanand Municipality, Bhojpur, Koshi Province'
formatAddress({ localLevelId: 1, ward: 2 }, 'ne'); // => 'वडा नं. २, षडानन्द नगरपालिका, भोजपुर, प्रदेश न. १'
```

## Quick start (Dart)

```dart
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

void main() {
  print(provinces().length);        // 7
  print(districtsOf(1).first.en);   // Bhojpur
  print(localLevelsOf(27).length);  // 11

  final ll = getLocalLevel(307)!;
  print('${ll.en} ${ll.wards}');    // Kathmandu Metropolitan City 32

  final hits = searchAddress('kathmandu');
  print(hits.first.kind.name);      // district

  print(formatAddress(localLevelId: 1, ward: 2));
  // Ward 2, Shadanand Municipality, Bhojpur, Koshi Province
  print(formatAddress(localLevelId: 1, ward: 2, language: 'ne'));
  // वडा नं. २, षडानन्द नगरपालिका, भोजपुर, प्रदेश न. १
}
```

Dart differences: `formatAddress` takes named arguments (`localLevelId`, `ward`, `tole`, `street`, `language`), the error is `AddressException` with an `AddressErrorCode` enum (the shared string is `code.name_`), `kind`, `rank` and the search language are enums, and the local level type is an enum with a `wire` string (for example `metropolitan`).

## API reference

All of these are exported from `jhigu-patro-utils-ts/address`.

| Name | What it does | Throws |
|------|--------------|--------|
| `provinces()` | All 7 provinces, `{ id, en, ne }`. | Never |
| `districtsOf(provinceId)` | Districts of a province, in data order. Empty array for an unknown id. | Never |
| `localLevelsOf(districtId)` | Local levels of a district, in data order. Empty array for an unknown id. | Never |
| `getProvince(id)` | One province or `undefined`. | Never |
| `getDistrict(id)` | One district `{ id, provinceId, en, ne }` or `undefined`. | Never |
| `getLocalLevel(id)` | One local level `{ id, districtId, type, en, ne, wards }` or `undefined`. | Never |
| `searchAddress(query, { language?, limit? })` | Searches all three levels by name. `language` is `'en'`, `'ne'` or `'auto'` (default, both). `limit` defaults to 10. Returns `AddressMatch[]`. | Never |
| `formatAddress({ localLevelId, ward, tole?, street? }, language = 'en')` | One-line address text. | `AddressError` |
| `AddressError` | `code` is `UNKNOWN_PROVINCE`, `UNKNOWN_DISTRICT`, `UNKNOWN_LOCAL_LEVEL` or `BAD_WARD`. `message` is English, `localized('ne')` is Nepali. | - |

Records:

| Type | Fields |
|------|--------|
| `AddressProvince` | `id`, `en`, `ne` |
| `AddressDistrict` | `id`, `provinceId`, `en`, `ne` |
| `AddressLocalLevel` | `id`, `districtId`, `type` (`metropolitan`, `sub-metropolitan`, `municipality`, `rural-municipality`), `en`, `ne`, `wards` (valid ward numbers are 1 to `wards`) |
| `AddressMatch` | `kind` (`province`, `district`, `localLevel`), `id`, `en`, `ne`, `matchedOn` (`en` or `ne`), `rank` (`exact`, `prefix`, `substring`) |

Error messages (from `data/strings.en.json` and `data/strings.ne.json`):

| Code | English | Nepali |
|------|---------|--------|
| `UNKNOWN_LOCAL_LEVEL` | Unknown local level | अज्ञात स्थानीय तह |
| `BAD_WARD` | Ward number is not valid for this local level | यो स्थानीय तहका लागि वडा नम्बर मान्य छैन |

`UNKNOWN_PROVINCE` and `UNKNOWN_DISTRICT` are thrown by the picker (see below); `formatAddress` takes a local level and so throws `UNKNOWN_LOCAL_LEVEL` and `BAD_WARD` only.

## Data

- Files: `data/address.json` (provinces, districts, local levels), `data/address-idmap.json` (stable ids) and `data/address-fixes.json` (every text change made to the upstream data).
- Source: the dataset `sagautam5/local-states-nepal` (master, downloaded 2026-11-20), MIT licence, copyright 2020 Sagar Gautam. A copy of the upstream files and its LICENSE is in `testdata/address-upstream/`. The credit is in `THIRD_PARTY_NOTICES.md`. According to `data/ADDRESS_NOTES.md`, the upstream README says its data was collected from Wikipedia and government sites. No official government file is the source here.
- Counts the validator checks: 7 provinces, 77 districts, 753 local levels (6 metropolitan, 11 sub-metropolitan, 276 municipality, 460 rural). The total of 6,743 wards is not cross-checked, because upstream gives no total.
- English and Nepali names are paired by id. Province, district and local level order is the data order, not alphabetical.

### Ids

Ids are integers assigned by the English name path (province / district / local level) in `data/address-idmap.json` and are never renumbered. A renamed place gets a new id. Regenerating from changed upstream data keeps the old ids and appends new ones. So `localLevelId: 307` (Kathmandu Metropolitan City) stays valid for as long as the name path does not change.

### Fixes applied by rule

All are logged in `data/address-fixes.json`.

- 736 names had leading or trailing spaces; they were trimmed.
- 460 rural municipality names had `गाउपालिका` changed to `गाउँपालिका`, the spelling in upstream's own categories file.
- 3 names had a stray ZWJ or ZWNJ removed. This is not confirmed with a Nepali speaker.

## Generation and checks

```bash
node tools/gen-address/gen.mjs            # data/address*.json from testdata/address-upstream/
node tools/gen-address/gen.mjs --check    # fail if those files would change
node tools/check-address/validate.mjs     # counts, links, ward numbers, types, text hygiene, id map
node tools/gen-data/gen.mjs               # typed TS and Dart files from data/*.json
node tools/gen-data/gen.mjs --check       # fail if the generated files are stale
```

`gen-address` reads the upstream English and Nepali files, normalises the text to Unicode NFC, trims it, applies the fix rules, assigns ids through the id map and writes the JSON. It accepts both array and object-keyed upstream shapes and pairs English and Nepali records by id. `gen-data` writes `ts/src/generated/address.ts` and `dart/lib/src/generated/address.dart`. Do not edit generated files by hand. CI runs the checks (`.github/workflows/ci-data.yml`).

## Search

`searchAddress` looks at province, district and local level names together.

- The query is trimmed. An empty query or `limit < 1` returns `[]`.
- English is compared in lower case, so case does not matter. Nepali is compared as written (TypeScript normalises the query to NFC first; Dart does not. For keyboard input the results are the same).
- A match is `exact` (whole name equal), `prefix` (name starts with the query) or `substring` (name contains it). The word "prefix" means the start of the whole name, not of a word inside it, so `metropolitan` is a substring match.
- Results are sorted by rank, then by the length of the matched name (shorter first), then province before district before local level, then id.
- `language: 'auto'` tries both names and reports the better match in `matchedOn`.

```js test
import { searchAddress, getDistrict } from 'jhigu-patro-utils-ts/address';

searchAddress('kathmandu', { limit: 5 }).map(m => [m.kind, m.id, m.rank]); // => [['district', 27, 'exact'], ['localLevel', 307, 'prefix']]
searchAddress('BHOJPUR').map(m => [m.kind, m.id, m.rank]); // => [['district', 1, 'exact'], ['localLevel', 2, 'prefix']]
searchAddress('भोजपुर').map(m => [m.kind, m.id, m.matchedOn]); // => [['district', 1, 'ne'], ['localLevel', 2, 'ne']]
searchAddress('pokhara', { language: 'ne' }); // => []
searchAddress('   '); // => []
getDistrict(27).en; // => 'Kathmandu'
```

## Formatting an address

`formatAddress` builds `Street, Tole, Ward N, Local Level, District, Province`. Empty or missing street and tole are skipped, and both are trimmed. In Nepali, names are the Nepali names and the ward number is in Devanagari digits. The word "Ward" comes from the string tables (`address.ward`: "Ward {n}" and "वडा नं. {n}"), not from the formatter. The position of the street (before the tole) is an API decision, not from a specification (`data/ADDRESS_NOTES.md`).

```js test
import { formatAddress, AddressError } from 'jhigu-patro-utils-ts/address';

formatAddress({ localLevelId: 1, ward: 2, tole: 'Chowk', street: 'Main Rd' }); // => 'Main Rd, Chowk, Ward 2, Shadanand Municipality, Bhojpur, Koshi Province'
formatAddress({ localLevelId: 1, ward: 2, tole: '  ' }); // => 'Ward 2, Shadanand Municipality, Bhojpur, Koshi Province'

let err;
try { formatAddress({ localLevelId: 1, ward: 99 }); } catch (e) { err = e; }
err instanceof AddressError; // => true
err.code; // => 'BAD_WARD'
err.localized('ne'); // => 'यो स्थानीय तहका लागि वडा नम्बर मान्य छैन'
```

## The address picker

`createAddressPicker` (entry `jhigu-patro-utils-ts/address-picker`) is a framework-free state machine for four linked selects. It has no DOM. You call actions and render from the state. See [headless widgets](../headless-widgets/README.md) for how it fits with the other pickers.

The cascade:

- Choosing a province clears district, local level and ward.
- Choosing a district clears local level and ward.
- Choosing a local level clears the ward, because ward ranges differ per local level.
- Choosing a child when its parent is not chosen fills the parents from the data. A saved local level restores in one call.
- The ward is a number from 1 to the `wards` of the local level.
- Every action that changes the state notifies subscribers once, with the full new state. An action that changes nothing (the same id again) does not notify.
- An invalid id or ward throws `AddressError` (`UNKNOWN_PROVINCE`, `UNKNOWN_DISTRICT`, `UNKNOWN_LOCAL_LEVEL` or `BAD_WARD`) and leaves the state unchanged.
- `showWard: false` makes the selection complete at the local level.

State fields: `provinceId`, `districtId`, `localLevelId`, `ward`, `provinces` (always all), `districts` and `localLevels` (the children of the current choice, empty until the parent is chosen), `wards` (`[1..n]`), `complete`, `selection` (the full selection when complete, else `null`), `language` and `showWard`. Actions: `selectProvince`, `selectDistrict`, `selectLocalLevel`, `selectWard` (each accepts `null` to clear), `clear` and `setLanguage`. Options: `value` (`{ localLevelId, ward? }`), `language` and `showWard`.

```js test
import { createAddressPicker } from 'jhigu-patro-utils-ts/address-picker';

const picker = createAddressPicker({ language: 'en' });
const seen = [];
picker.subscribe(s => seen.push(s.complete));
picker.actions.selectLocalLevel(1);
picker.getState().provinceId; // => 1
picker.getState().districtId; // => 1
picker.getState().wards.length; // => 14
picker.getState().complete; // => false
picker.actions.selectWard(2);
picker.getState().selection; // => { provinceId: 1, districtId: 1, localLevelId: 1, ward: 2 }
picker.actions.selectWard(2);
seen; // => [false, true]
picker.actions.selectProvince(2);
picker.getState().selection; // => null

let code;
try { picker.actions.selectProvince(99); } catch (e) { code = e.code; }
code; // => 'UNKNOWN_PROVINCE'
```

Dart has the same machine as `AddressPicker` (a class, not a factory): `AddressPicker(value: (localLevelId: 307, ward: 5), language: 'ne')`, a `state` getter, `subscribe`, and methods with the same names. `AddressPickerState` has the same fields.

## `<jhigu-address-select>`

The web component (entry `jhigu-patro-utils-ts/address-element`) is four native `<select>` elements driven by `createAddressPicker`. Use `defineJhiguAddressSelect()` once, then:

```html
<jhigu-address-select name="addr" language="ne" required></jhigu-address-select>
```

In short: attributes are `value` (a local level id), `ward`, `language`, `show-ward`, `name`, `required`, `disabled` and `theme`. When `name` is set, the form gets the local level id under `name` and the ward, district and province under `name_ward`, `name_district` and `name_province`. The event `jhiguChange` fires on every change; its `detail` has the ids, `complete`, `selection` and `text` (the formatted address, empty until complete). Attribute and styling details are in [web components](../web-components/README.md).

## Recipes

### 1. A cascading select, without a framework

```js test
import { createAddressPicker } from 'jhigu-patro-utils-ts/address-picker';

const picker = createAddressPicker({ language: 'ne' });
picker.actions.selectProvince(3);
const names = picker.getState().districts.map(d => d[picker.getState().language]);
names.length; // => 13
names[0]; // => 'भक्तपुर'
```

Render `state.districts` into the second select, and call `selectDistrict` when it changes. Do the same for local levels and wards.

### 2. Restore a saved address into the form

Save only `localLevelId` and `ward`. Pass them back as `value`.

```js test
import { createAddressPicker } from 'jhigu-patro-utils-ts/address-picker';

const saved = { localLevelId: 307, ward: 5 };
const picker = createAddressPicker({ value: saved });
picker.getState().selection; // => { provinceId: 3, districtId: 27, localLevelId: 307, ward: 5 }
```

### 3. Print the saved address in both languages

```js test
import { formatAddress } from 'jhigu-patro-utils-ts/address';

formatAddress({ localLevelId: 307, ward: 5 }); // => 'Ward 5, Kathmandu Metropolitan City, Kathmandu, Bagmati'
formatAddress({ localLevelId: 307, ward: 5 }, 'ne'); // => 'वडा नं. ५, काठमाण्डौं महानगरपालिका, काठमाडौँ, बाग्मती'
```

### 4. Type-ahead search box

Call `searchAddress` on each keystroke with a small `limit`, and show `en` or `ne` by the user's language. Use `kind` and `id` to decide what to fill in. A local level result gives you the whole chain through `getDistrict` and `getProvince`.

```js test
import { searchAddress, getLocalLevel, getDistrict, getProvince } from 'jhigu-patro-utils-ts/address';

const hit = searchAddress('shadanand', { limit: 1 })[0];
hit.kind; // => 'localLevel'
const ll = getLocalLevel(hit.id);
const district = getDistrict(ll.districtId);
[ll.en, district.en, getProvince(district.provinceId).en]; // => ['Shadanand Municipality', 'Bhojpur', 'Koshi Province']
```

### 5. Validate a ward number before saving

```js test
import { getLocalLevel } from 'jhigu-patro-utils-ts/address';

const validWard = (localLevelId, ward) => {
  const ll = getLocalLevel(localLevelId);
  return ll !== undefined && Number.isInteger(ward) && ward >= 1 && ward <= ll.wards;
};
validWard(1, 14); // => true
validWard(1, 15); // => false
validWard(99999, 1); // => false
```

## The CLI

```
$ jhigu-patro address 1 2
Ward 2, Shadanand Municipality, Bhojpur, Koshi Province

$ jhigu-patro address 1 2 --tole Chowk --street "Main Rd" --lang ne
Main Rd, Chowk, वडा नं. २, षडानन्द नगरपालिका, भोजपुर, प्रदेश न. १

$ jhigu-patro address search kathmandu --limit 3
district     27  Kathmandu
localLevel  307  Kathmandu Metropolitan City

$ jhigu-patro address search काठमाडौँ --in ne
district     27  Kathmandu

$ jhigu-patro address 1 99
✖ Ward number is not valid for this local level

$ jhigu-patro address 1 99 --json
{"error":{"code":"BAD_WARD","message":"Ward number is not valid for this local level"}}

$ jhigu-patro address search zzzz
No match.
```

Usage: `address <localLevelId> <ward> [--tole T] [--street S] [--lang en|ne]` and `address search <text> [--limit 10] [--in auto|en|ne]`. `--lang` changes the language of the formatted address and of error messages; the search lines show English names unless `--lang ne` is given. `--json` prints JSON. Exit codes: 0 ok, 1 the library rejected the input, 2 wrong use (for example a local level id that is not a number).

## Errors and edge cases

- Unknown ids from `getProvince`, `getDistrict` and `getLocalLevel` give `undefined`. `districtsOf` and `localLevelsOf` give an empty array.
- `formatAddress` rejects a ward that is not an integer from 1 to `wards` (`BAD_WARD`), including `0`, negative numbers and `1.5`.
- Kathmandu is spelled differently by level. The district is `काठमाडौँ`, the local level is `काठमाण्डौं`. Both are kept as upstream has them. Searching one spelling does not find the other.
- English province, district and local level names are as upstream spells them, for example the district `Pachthar`.
- Search matches the start of the whole name. `municipality` finds names that contain it, with the shortest names first, so `Mai Municipality` comes before the long ones.
- Search results are limited to 10 unless you pass `limit`.

## Accuracy, limits and known gaps

- **[SOURCE NEEDED]** Province names are as upstream has them and look dated. The code has `Sudur Paschimanchal` as the English name of province 7. Provinces 1 and 2 have Nepali names `प्रदेश न. १` and `प्रदेश न. २` (numbered) while 3 to 7 have names, and the English names are `Koshi Province` and `Madhesh Province`. These need to be checked against official province names.
- **[SOURCE NEEDED]** Ward counts and the totals (753 local levels, 6,743 wards) have not been checked against the Ministry of Federal Affairs and General Administration list. Local levels have been merged and renamed in the past, so confirm the list is current before relying on it.
- Nepali spellings of municipality names are not reviewed beyond the rules above.
- The Nepali ward label "वडा नं. {n}" is unreviewed.
- The data has no postal codes, coordinates, tole lists or street data. Tole and street are free text.
- TypeScript and Dart give the same results for every shared vector. The only known divergence is NFC normalisation of the query (above).

## Data size and bundling

- `data/address.json` is about 127 KB. The generated TypeScript file is about 129 KB; compiled, `dist/generated/address.js` is about 130 KB, about 19 KB gzipped.
- The data is only in `jhigu-patro-utils-ts/address` and the entry points that import it (`address-picker`, `address-element`). The main `jhigu-patro-utils-ts` entry does not import it. Import from the subpath, not from the main entry, so that a bundler with tree shaking keeps it out of pages that do not need it.
- The lookup indexes and the search list are built on first use, not at import. The first call to `districtsOf`, `searchAddress` and friends pays that cost once.
- In a form page that already has the picker, load the address entry lazily (`import()` on first focus) if the first paint matters.

## How it is tested

- `testdata/address.json` (counts, unknown parents, format vectors, search vectors) and `testdata/address-picker.json` (15 scenarios and the init errors) are shared by TypeScript and Dart.
- TypeScript: `ts/tests/address.test.ts`, `addressPicker.test.ts` and `addressElement.test.ts`. Dart: `dart/test/address_test.dart` and `address_picker_test.dart`.
- Data checks: `tools/check-address/validate.mjs` and `node tools/gen-address/gen.mjs --check`.
- The `js test` blocks in this guide are run by `ts/tests/docs.test.ts`.

```bash
cd ts && npm run test:run
cd dart && dart test
node tools/check-address/validate.mjs
```

## Related guides

- [Headless widgets](../headless-widgets/README.md): `createAddressPicker` next to the other state machines.
- [Web components](../web-components/README.md): `<jhigu-address-select>`.
- [Receipts](../receipts/README.md): where a formatted address goes on a bill.
- [Usage guide](../../USAGE.md)
