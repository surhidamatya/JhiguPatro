# testdata

Shared test vectors read by both the TypeScript and Dart test suites.
Both languages must produce identical results for every vector.

Planned files: `dates.json`, `money.json`, `phone.json`, `address.json`,
`receipt.json`, `calendar-golden.json`.

Rule: fill vectors from the reconciled calendar (see
`docs/IMPLEMENTATION_GUIDE.md` section 6), never from memory.
