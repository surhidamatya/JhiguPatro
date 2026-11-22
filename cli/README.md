# jhigu-patro (CLI)

Command-line tool for the Bikram Sambat (Nepali) calendar and the rest of the Jhigu Patro
toolkit: dates, money, phone numbers, addresses, SMS templates.

```bash
npm install -g jhigu-patro jhigu-patro-utils-ts   # the utils package is a peer dependency
jhigu-patro today
jhigu-patro ad2bs 2025-08-26
jhigu-patro money 1234567.5 --vat excl
jhigu-patro phone 9841234567 --json
jhigu-patro help
```

The commands, their options, exit codes and what `info` does with a year that is valid in both
calendars are in the [repository README](https://github.com/surhidamatya/JhiguPatro#cli--jhigu-patro).
