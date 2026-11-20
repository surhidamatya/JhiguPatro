# Address data notes

Source: sagautam5/local-states-nepal @ master, downloaded 2026-11-20 (MIT, see
THIRD_PARTY_NOTICES.md). The upstream README says its data was collected from Wikipedia
and government sites; no official government file is the source here.

## Checked
- 7 provinces, 77 districts, 753 local levels (6 metropolitan, 11 sub-metropolitan, 276
  municipality, 460 rural). English and Nepali files agree on ids, order and ward counts.
- 6,743 wards in total. Upstream gives no ward total, so this figure is not cross-checked.
- Category ids 1-4 confirmed from upstream `dataset/categories`.

## Fixes made by rule (all logged in address-fixes.json)
- 736 names with trailing spaces trimmed.
- 460 rural municipality names: "गाउपालिका" changed to "गाउँपालिका" (upstream's own
  categories file spells it with the chandrabindu).
- 3 names with a stray ZWJ/ZWNJ had it removed. Not confirmed with a Nepali speaker.
- No split vowel signs found (tested े+ा, ा+े, ा+ै, ै+ा, ा+ॅ, doubled matras, nukta).

## Unresolved
- [SOURCE NEEDED] Province names are as upstream has them and look dated: "Sudur
  Paschimanchal"; provinces 1 and 2 have Nepali "प्रदेश न. १/२" while 3-7 have names.
  Needs checking against official province names.
- [SOURCE NEEDED] Ward counts and the 753 total have not been checked against the
  Ministry of Federal Affairs and General Administration list. Local levels have been
  merged/renamed in the past; confirm the list is current.
- Nepali spellings of municipality names are unreviewed beyond the rules above.
- Upstream shape is inconsistent (arrays vs objects keyed by numbers). The generator
  accepts both and re-pairs en/np by id.

## Ids
Ids are assigned by English name path (province/district/local level) in
`address-idmap.json` and are never renumbered. A renamed place gets a new id.
Regenerating from a changed upstream keeps old ids and appends new ones.

## API decisions (not from the guide, review)
- `formatAddress` puts street before tole: `Street, Tole, Ward N, Local Level, District, Province`.
  The guide only specifies `Tole, Ward N, ...`. Street position is my choice.
- Ward label comes from the strings tables (`address.ward`: "Ward {n}" / "वडा नं. {n}"); the
  Nepali wording is unreviewed.
- Search matches whole-name prefix, not word prefix ("Metropolitan" is a substring match).
- Upstream spells Kathmandu differently by level (district "काठमाडौँ", local level
  "काठमाण्डौं"). Both are kept; searching one spelling does not find the other.
- TS normalises the search query to NFC; Dart does not (no normaliser in core). Same results
  for NFC input, which is what keyboards produce.

## Picker decisions (guide 11.5 gives only the cascade, ward range and one-event rules)
- Choosing a local level clears the ward (ward ranges differ per level). Guide silent.
- Choosing a child with no parent filled in sets the parents from the data, so a saved
  local level restores in one call. Guide silent.
- No-op selections (same id again) emit no event. Invalid ids throw typed errors and leave
  state unchanged. Added codes: `UNKNOWN_PROVINCE`, `UNKNOWN_DISTRICT`.
- `showWard: false` makes the selection complete at the local level.
- Headless state machine lives in `ts/src/addressPicker.ts` (entry `./address-picker`) and
  `dart/lib/src/address_picker.dart`. It is not yet in a separate `@jhigu-patro/headless` package.
