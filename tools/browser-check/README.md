# Cross-browser check of the web components

`check.mjs` opens the example pages in `ts/examples` in Chromium, Firefox and WebKit
(through Playwright) and drives the six web components with real clicks, key presses
and typing. 23 checks per browser:

- **Date picker:** three pickers render a month grid; a click selects and reports BS and
  AD; arrows and Enter move and select; the month arrows and month list; the popup opens,
  closes on Escape and when a day is chosen; days outside min and max cannot be chosen;
  the form posts the dates; a required empty picker makes the form invalid; Reset clears
  it; Nepali digits in the popup.
- **Range picker:** two clicks choose a range and the event says how many days; hover
  preview; the form posts `name_start` and `name_end`; a half-chosen required range is invalid.
- **Calendar:** marked days show a dot and selecting one lists its titles; month changes
  are reported; events set from script work (Nepali, Monday start).
- **Address:** the province to ward cascade and its form data; changing the province clears
  what is below; `show-ward="false"` and Nepali labels.
- **Money and phone:** grouping as you type, padding on blur, integer paisa in the form;
  preset Devanagari digits; phone formatting, carrier chip and E.164 in the form; required
  fields invalid while empty; the message for a bad number.

It also fails a check if the page logs a console error or throws.

```bash
cd ts && npm install && npm run build         # the examples import ts/dist
cd ../tools/browser-check && npm install
npx playwright-core install chromium firefox webkit   # several hundred MB in the Playwright cache
node check.mjs                                 # every browser that is installed
node check.mjs --browsers firefox,webkit       # or choose
PLAYWRIGHT_CORE=/path/to/playwright-core node check.mjs   # use another copy of the library
```

Exit code 0 means every check passed in every browser that ran; a browser that is not
installed is skipped and reported. It is not in CI because the browsers are large.

## Last run

| Browser | Result |
|---|---|
| Chromium 151 (Playwright 1.62.1) | 23 of 23 |
| WebKit 26.5 (Playwright build 2327, the engine of Safari) | 23 of 23 |
| Firefox 152 | **not run**: it would not start inside the tool sandbox the checks were run from (its content process was refused, then its software compositor could not map a framebuffer). Run `node check.mjs --browsers firefox` in a normal terminal. |

WebKit here is Playwright's build of the engine, not Safari itself, and it runs headless on
a desktop: iOS Safari, touch input, on-screen keyboards and screen readers are not covered.
The checks are the ones listed above, not every behaviour of every component.
