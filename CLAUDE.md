# Jhigu Patro — agent guide

Bikram Sambat (BS) calendar toolkit. Layout today: `ts/` (TS library + demo),
`dart/` (Dart port), `cli/` (CLI), `data/` (shared JSON), `tools/`, `testdata/`.
Plan: `docs/PRD.md`, `docs/IMPLEMENTATION_GUIDE.md`.

## Rules
- `data/` is the source of truth. `ts/*.json` and `ts/src/data_sources/2081_tithi.json` are copies; CI checks they match.
- Same input, same output in TS and Dart. Share vectors via `testdata/`.
- Money is integer paisa, never floats. Dates ignore time zones (use calendar fields only).
- Errors are typed. No hard-coded user-facing labels.
- Never guess calendar lengths, phone prefixes or API details. Mark `[SOURCE NEEDED]`.

## Commands
- TS: `cd ts && npm ci && npm run build && npm run test:run`
- Dart: `cd dart && dart pub get && dart test`
- Data: `node tools/check-calendar/validate.mjs`
