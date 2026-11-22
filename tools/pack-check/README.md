# Release-readiness check

`check.mjs` packs `ts/`, `cli/`, `react/` and `vue/` the way `npm publish` would (`npm pack`, nothing
is published), looks inside the tarballs, installs them into a scratch project like a consumer, and
imports and runs everything.

```bash
for d in ts cli react vue; do (cd $d && npm run build); done
node tools/pack-check/check.mjs
```

It needs network only for `npm install` of the peer dependencies in the scratch project (react, react-dom,
vue, typescript). Exit code 1 means something would break a consumer.

| | Level | What |
|---|---|---|
| Per package | FAIL | a `file:`, `link:` or relative-path dependency; `main`, `module`, `types`, `bin` or an `exports` target missing from the tarball; source, tests, examples, tsconfig, `.env`, `node_modules` or a lock file in the tarball |
| Per package | WARN | no LICENSE or README in the tarball, no `repository`, no `files` list, `private: true` |
| Consumer | FAIL | an export of `jhigu-patro-utils-ts` that cannot be imported (or has none); the React and Vue packages lacking their six components; the installed `jhigu-patro` command not running (`ad2bs`, `phone --json`); a TypeScript file that imports every subpath not type-checking under `moduleResolution` `node16` and `bundler` |

## What it found, and what was done

First run: 13 failures.

- `jhigu-patro-utils-ts` shipped 255 files (its source, 24 test files, the examples, `tsconfig.json`); now
  `files: [dist, the two data JSON files, README]` (180 files, 200 KB), the data files are exports so a
  consumer needs no path (`jhigu-patro-utils-ts/nepali_calendar_data.json`), `types` is listed first in each
  export entry, and there is a README and a `repository`.
- The installed `jhigu-patro` command **crashed**: it imported `../../ts/dist/...` and read `../../data/...`,
  paths that exist only in this repository. It now imports the package and reads the data file from it, and
  ships only `dist`.
- `jhigu-patro-react` and `jhigu-patro-vue` depended on `file:../ts`. They now have a **peer dependency**
  (`jhigu-patro-utils-ts >=1.0.0 <2`), which is also the right model: the app's `initializeCalendar` and the
  elements must share one copy of the calendar state, and two installed copies would not. `file:../ts` stays as
  a dev dependency for local work. The same peer dependency is used for the CLI.

Now: 0 failures. Still 4 warnings: **no LICENSE file in any package** (see below).

## Not done, needs a decision from the owner

- **A LICENSE file.** Every `package.json` says MIT but no license text exists anywhere in the repository, and pub.dev
  rejects a package without one. MIT needs a copyright holder and year; they were not guessed. Add `LICENSE` at the
  root and copy it into each package (npm and pub only pack files inside the package folder).
- **What to publish, under what names and versions.** The names (`jhigu-patro-utils-ts`, `jhigu-patro`,
  `jhigu-patro-react`, `jhigu-patro-vue`, `jhigu_patro_utils`) are the current ones, not reviewed for availability
  or scope; the Flutter package is `publish_to: none` and depends on `../dart` by path.
- Nothing was published and no registry was contacted other than for installing the peer dependencies.
