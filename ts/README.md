# jhigu-patro-utils-ts

Bikram Sambat (Nepali) calendar utilities for TypeScript and JavaScript: date conversion,
formatting and parsing, money in integer paisa, Nepal phone numbers, addresses, SMS templates and
reminders, receipts, headless pickers and inputs, and web components for them.

```ts
import { initializeCalendar, InlineCalendarDataSource, convertADToBS } from 'jhigu-patro-utils-ts';
import data from 'jhigu-patro-utils-ts/nepali_calendar_data.json' with { type: 'json' };

initializeCalendar(new InlineCalendarDataSource(data.years, data.supportedRange.start, data.supportedRange.end, data.verifiedThrough));
convertADToBS(new Date(2025, 7, 26)); // { year: 2082, month: 5, day: 10 }
```

Subpath entry points (`/address`, `/sms`, `/money-input`, `/date-picker-element`, ...) and the full
guide are in the [repository](https://github.com/surhidamatya/JhiguPatro/blob/dev/docs/USAGE.md).
Calendar data covers BS 2000 to 2100; years after the verified range are not checked against the
official calendar (see the repository notes).
