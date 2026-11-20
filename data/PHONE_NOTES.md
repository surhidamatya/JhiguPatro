# Phone data notes

`data/phone-prefixes.json` is **best effort**, not an official NTA publication.

## Sources

| Data | Source | Strength |
|------|--------|----------|
| Valid mobile prefixes (900, 960–963, 970–972, 974–976, 980–982, 984–986, 988) and valid landline area-code structure | Google libphonenumber metadata for NP, as shipped in `libphonenumber-js` 4.x (MIT/Apache) | Structural. Checked by `tools/check-phone/validate.mjs` |
| Carrier per prefix and active flag | `nepal_kit` 0.1.0 `lib/src/phone/nepali_phone.dart` (MIT). It cites NTA allocations "as reported by operators and the trade press" | Secondary. Not independently verified |
| Place names per area code | Wikipedia "Telephone numbers in Nepal" (itself cites only ITU, retrieved 2019) | Weak. Names only, no authority |

## Unresolved

- **[SOURCE NEEDED]** Official Nepal Telecommunications Authority numbering allocation to confirm carriers and active status.
- Prefixes **900** and **960** are valid in libphonenumber but have no known carrier here (`carrier: null`, `active: false`).
- Smart Telecom (961, 962, 988), UTL (972) and Hello Mobile (963) are marked inactive per nepal_kit. Unconfirmed.
- Ncell 970 and 971 are in libphonenumber; the Ncell attribution of 971 (opened 2025) comes from nepal_kit only.
- Place names are incomplete: valid area codes with no wiki entry have `places: []`. The wiki page had conflicts: Khotang listed as both 36 and 13, `056`/`021` written with a leading 0, and `Bandipur 100`. Rejected rows: Khotang 13, Bandipur 100 (invalid under libphonenumber); `056` and `021` normalised to 56 and 21.
- Area codes 10 and 11 (Bidur/Dhading, Banepa) format as `dd-dddddd`; the Kathmandu valley code `1` as `d-ddddddd`.
