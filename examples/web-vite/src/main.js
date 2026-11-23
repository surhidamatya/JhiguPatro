import {
  initializeCalendar, InlineCalendarDataSource, PanchangDataSource,
} from 'jhigu-patro-utils-ts';
import { defineJhiguDatePicker } from 'jhigu-patro-utils-ts/date-picker-element';
import { defineJhiguCalendar } from 'jhigu-patro-utils-ts/calendar-element';
import { defineJhiguAddressSelect } from 'jhigu-patro-utils-ts/address-element';
import { defineJhiguMoneyInput, defineJhiguPhoneInput } from 'jhigu-patro-utils-ts/field-elements';
// Vite bundles the JSON. `?url` gives a URL instead, so the larger tithi file is fetched only when used.
import calendar from 'jhigu-patro-utils-ts/nepali_calendar_data.json';
import tithiUrl from 'jhigu-patro-utils-ts/2082_tithi.json?url';

// Step 1: load the calendar data BEFORE the date picker or calendar are created.
initializeCalendar(new InlineCalendarDataSource(
  calendar.years, calendar.supportedRange.start, calendar.supportedRange.end, calendar.verifiedThrough,
));

// Step 2: register the elements. After this the tags in index.html come alive.
defineJhiguDatePicker();
defineJhiguCalendar();
defineJhiguAddressSelect();
defineJhiguMoneyInput();
defineJhiguPhoneInput();

// Step 3: give the calendar a tithi source (a property, not an attribute).
const panchang = new PanchangDataSource();
await panchang.load(tithiUrl);
document.getElementById('cal').panchang = panchang;

// Step 4: read the form. Each element posts its value under its `name`:
// date as YYYY-MM-DD, money as integer paisa, phone as E.164, address as a local-level id
// (plus `home_ward`, `home_district` and `home_province`).
document.getElementById('booking').addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  document.getElementById('out').textContent = JSON.stringify(data, null, 2);
});
document.getElementById('booking').addEventListener('reset', () => {
  document.getElementById('out').textContent = '(not submitted)';
});

// Step 5 (optional): events and language. Events bubble, so listen anywhere above the element.
document.addEventListener('jhiguSelect', e => console.log('calendar day:', e.detail));
const langButton = document.getElementById('lang');
langButton.addEventListener('click', () => {
  const next = document.documentElement.lang === 'ne' ? 'en' : 'ne';
  document.documentElement.lang = next;
  for (const el of document.querySelectorAll('jhigu-date-picker, jhigu-calendar, jhigu-address-select, jhigu-money-input, jhigu-phone-input')) {
    el.setAttribute('language', next);
  }
  langButton.textContent = next === 'ne' ? 'English' : 'नेपाली';
});
