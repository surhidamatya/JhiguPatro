#!/usr/bin/env python3
"""Makes testdata/tithi.json from data/<year>_tithi.json, with no code shared with the TS and Dart readers.

One line per day of every year file, in year, month, day order:
    `YYYY-M-D a b c d`
where a, b, c, d are the tithi at minute 0, 375 (sunrise), 720 and 1439 of that day, each written
`<number><S|K>` (S = शुक्ल, K = कृष्ण) or `-` when no segment covers the minute (a day with no
segments). A minute is covered by the first segment with start <= minute < end. Each line ends with a
newline (the last one too); the text is hashed with 64-bit FNV-1a over UTF-8.

Run from the repo root:  python3 tools/check-tithi/make_vectors.py
"""
import json, glob, re, os

MINUTES = (0, 375, 720, 1439)
PAKSHA = {'शुक्ल': 'S', 'कृष्ण': 'K'}


def fnv1a64(data: bytes) -> str:
    h = 0xcbf29ce484222325
    for b in data:
        h ^= b
        h = (h * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF
    return f'{h:016x}'


def at(segs, minute):
    for s in segs:
        if s['startMinute'] <= minute < s['endMinute']:
            return f"{s['tithiNumber']}{PAKSHA[s['paksha']]}"
    return '-'


files = sorted(glob.glob('data/*_tithi.json'), key=lambda p: int(re.search(r'(\d{4})_tithi', p).group(1)))
lines, years = [], []
for f in files:
    y = json.load(open(f, encoding='utf-8'))[0]
    years.append(y['year'])
    for m in y['months']:
        for d in m['days']:
            lines.append(f"{y['year']}-{m['month']}-{d['bsDay']} " + ' '.join(at(d['tithiSegments'], x) for x in MINUTES))

text = ''.join(l + '\n' for l in lines)
checkpoints = [{'index': i, 'line': lines[i]} for i in sorted({0, 1, 31, 59, 100, 200, 364, 365, len(lines) - 1})
               if i < len(lines)]
probes = []
for y, m, d, minute in [(2082, 1, 1, 0), (2082, 1, 1, 418), (2082, 1, 1, 419), (2082, 1, 1, 1439),
                        (2082, 8, 18, 468), (2082, 8, 18, 469), (2081, 4, 12, 1439), (2081, 2, 32, 375),
                        (2082, 3, 32, 0), (2080, 1, 1, 375), (2083, 1, 1, 375), (2082, 1, 33, 375)]:
    y_ = next((json.load(open(f, encoding='utf-8'))[0] for f in files if f'{y}_tithi' in f), None)
    day = None
    if y_:
        mo = next((x for x in y_['months'] if x['month'] == m), None)
        day = next((x for x in mo['days'] if x['bsDay'] == d), None) if mo else None
    probes.append({'year': y, 'month': m, 'day': d, 'minute': minute, 'tithi': at(day['tithiSegments'], minute) if day else None})

out = {
    '_note': 'Tithi lookups from data/*_tithi.json, computed by tools/check-tithi/make_vectors.py (plain Python, no code shared with the TS and Dart readers). `fnv1a64` hashes one line per day: `YYYY-M-D a b c d`, where a..d are the tithi at minutes 0, 375, 720, 1439, each `<number><S|K>` or `-`; each line ends with a newline. `probes` are single lookups: `tithi` is `<number><S|K>`, `-` for a covered day with no tithi at that minute, or null for a year or day that is not loaded. TS and Dart answer the same.',
    'years': years,
    'minutes': list(MINUTES),
    'count': len(lines),
    'first': lines[0],
    'last': lines[-1],
    'fnv1a64': fnv1a64(text.encode('utf-8')),
    'checkpoints': checkpoints,
    'probes': probes,
}
json.dump(out, open('testdata/tithi.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open('testdata/tithi.json', 'a').write('\n')
print(out['count'], out['fnv1a64'])
