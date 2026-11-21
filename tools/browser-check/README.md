# Cross-browser check of the web components

`check.mjs` opens the example pages in `ts/examples` in Chromium, Firefox and WebKit
(through Playwright) and drives the six web components with real clicks, key presses
and typing. 25 checks per browser:

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
  fields invalid while empty; the message for a bad number; a host `aria-label` names the
  inner input and changing it keeps what was typed.
- **Accessible names:** a day cell's name contains its visible day, the AD number is hidden
  from it, and the title button's name starts with its visible title.

It also fails a check if the page logs a console error or throws.

## Accessibility audit (`a11y.mjs`)

`a11y.mjs` runs axe-core (WCAG 2.0 to 2.2 A/AA and best practices) on the same example pages
in 17 states each, in the light and the dark colour scheme: first render, a day chosen, a popup
open, the month and year lists, a range chosen, a marked day selected, the address cascade
complete, values typed, a validation message showing, and the date pickers with AD numbers off.
It looks into the open shadow roots. In dark mode the page is made dark too, because the field
elements (unlike the pickers) take the page's background.

```bash
node a11y.mjs                         # Chromium; add --browsers chromium,webkit
node a11y.mjs --known                 # also list the documented finding below
node a11y.mjs --json
```

Rules about the example page itself (landmarks, a main region) are skipped; `--all` includes them.

What it found and what was done:

| Finding | Action |
|---|---|
| Money and phone inputs with no `label` had no accessible name (critical: `label`). A `aria-label` on the element, which the React and Vue components pass through, never reached the inner input. | Fixed: a host `aria-label` names the input when there is no `label`; `label` wins. |
| The title button's name ("Select month") did not contain its visible text ("Ashwin 2082") (WCAG 2.5.3). | Fixed: the name is now "Ashwin 2082, Select month". |
| The small AD number on days inside a range was 3.4:1 (light) and 3.9:1 (dark) on the tinted band. | Fixed: it uses the text colour there. |
| The AD number and the marked-day dot were read as part of the cell's name. | Hidden from the name (`aria-hidden`); both are already in the cell's label. |
| Date cells: axe still reports label-in-name for 1 178 cell states, because the cell's visible text is its BS day plus the small AD number ("1 17"), which it compares with the name. | **Known, left as is.** It is gone with `show-ad="false"` (checked in its own state: zero findings). Making the AD number CSS-generated content would satisfy axe but remove the documented `::part(ad)` styling hook. A voice-control user can still say the BS day. |
| Address labels and the phone message had low contrast with dark colours on a white page. | Not a component fault: the elements take the page background, so a dark scheme needs a dark page (the example's dark-themed address now sits on a dark panel; the audit makes the page dark in dark mode). |

Last run: no violations other than the known one, in Chromium 151 and WebKit 26.5. axe finds many
accessibility problems but not all of them: it does not replace testing with a screen reader and
the keyboard, which was not done.

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
| Chromium 151 (Playwright 1.62.1) | 25 of 25 |
| WebKit 26.5 (Playwright build 2327, the engine of Safari) | 25 of 25 |
| Firefox 152 | **not run**: it would not start inside the tool sandbox the checks were run from (its content process was refused, then its software compositor could not map a framebuffer). Run `node check.mjs --browsers firefox` in a normal terminal. |

WebKit here is Playwright's build of the engine, not Safari itself, and it runs headless on
a desktop: iOS Safari, touch input, on-screen keyboards and screen readers are not covered.
The checks are the ones listed above, not every behaviour of every component.
