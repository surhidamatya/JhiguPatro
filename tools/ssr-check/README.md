# Server rendering and hydration check

`check.mjs` builds and runs the two framework examples and checks them in Chromium:

- `react/example-next`: Next.js 16 (App Router, Turbopack) with `jhigu-patro-react`.
- `vue/example-nuxt`: Nuxt 4 with `jhigu-patro-vue`.

For each: the app builds; the server HTML has five empty `display:contents` wrappers and no
`<jhigu-*>` element; after hydration each of the five elements exists once, the date picker
draws its 31 days, typing in the money field gives `1,234.50`, and submitting the form gives
`{"dob":"2082-05-12","amount":"123450"}` (integer paisa); and the page logs no console error or
warning and no page error.

```bash
# once: build the packages and install the examples and Playwright
(cd ts && npm ci && npm run build)
(cd react && npm ci && npm run build)
(cd vue && npm ci && npm run build)
(cd react/example-next && npm ci)
(cd vue/example-nuxt && npm ci)
(cd tools/browser-check && npm ci && npx playwright-core install chromium)

node tools/ssr-check/check.mjs              # both
node tools/ssr-check/check.mjs --only next  # or nuxt
```

It runs in CI as the `examples` job of `ci-js.yml`. The `vue-versions` job of the same file runs
the Vue package's tests and type check on Vue 3.3.13 and 3.4.38 (the package declares `vue >=3.3`).

Checked by mutation on the Next example: a `console.error` during render, no calendar
initialisation, and a renamed form field are each caught. The server-HTML check was not mutated.

Only Chromium. The Pages Router, webpack builds and other frameworks are not covered.
