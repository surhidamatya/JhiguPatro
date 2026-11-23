# Example: web page with Vite

A Vite page (no framework) that uses the Jhigu Patro web components: a date picker, a money field, a phone field,
an address select and a calendar that shows the tithi under each day. The form posts BS values.

## Run

```bash
cd ../../ts && npm ci && npm run build     # once: the library's dist/ folder
cd ../examples/web-vite
npm install
npm run dev                                # http://localhost:5190
```

`npm run build` makes a production build in `dist/`; `npm run preview` serves it.

## What it does

- Pick a date, type an amount and a phone number, choose province, district, local level and ward, then press
  **Book**. The page prints what the form posts:

  ```json
  {
    "visit": "2083-08-10",
    "amount": "123450",
    "phone": "+9779841234567",
    "home": "274",
    "home_ward": "3",
    "home_district": "23",
    "home_province": "3"
  }
  ```

  The date is BS `YYYY-MM-DD`, the amount is **integer paisa** (`1,234.50` rupees is `123450`), and the phone is
  E.164. The values are examples; the date is whatever you pick.
- The calendar shows each day's sunrise tithi (BS 2082 only; that is the data there is).
- **नेपाली** switches every element to Nepali.

## How it is put together

[`src/main.js`](src/main.js) has five steps, each commented:

1. Load the calendar data with `initializeCalendar` **before** any date element is created.
2. Register the elements (`defineJhiguDatePicker()` and the others). The tags in `index.html` then come alive.
3. Give the calendar a `PanchangDataSource` through its `panchang` **property** (an object cannot be an
   attribute). The tithi file is imported with `?url`, so it is fetched only when used.
4. Read the form with `FormData`. Each element posts its value under its `name`.
5. Optional: listen for events (they bubble) and switch `language`.

Theming is plain CSS variables set on the element (`jhigu-calendar { --jhigu-color-primary: #b91c1c; }` in
[`src/style.css`](src/style.css)).

More: [web-components guide](../../docs/features/web-components/README.md),
[tithi guide](../../docs/features/tithi/README.md), [integration guide](../README.md#b-a-plain-web-page-vite).

Checked in Chromium only (a scripted run: the calendar shows 31 tithi cells, the form submits the values above,
the language switch works, no console errors). Firefox, Safari and touch devices were not tried.
