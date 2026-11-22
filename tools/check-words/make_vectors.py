#!/usr/bin/env python3
"""
Makes testdata/money-words-ne.json: expected Nepali amount-in-words values.

An independent model of the walk in ts/src/money.ts and dart/lib/src/money.dart: it reads the
number as decimal digits and cuts them into groups from the right (2 digits, 1 digit for सय, then
pairs for हजार, लाख, करोड, अर्ब, and the rest is the खर्ब count), instead of dividing. The word table
is shared (data/nepali-numbers.json), so the vectors check the composition, not the words:
the words are single-source and not native-speaker reviewed (see that file).

The 'fromNepalKit' cases are copied by hand from lohanidamodar/nepal-kit's own tests
(packages/nepal_kit/test/amount_words_test.dart, read 2026-11-21), a second author's expectations.

  python3 -I tools/check-words/make_vectors.py          # writes the file
  python3 -I tools/check-words/make_vectors.py --check  # fails if the file is stale
"""
import json, random, sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
table = json.loads((root / 'data/nepali-numbers.json').read_text(encoding='utf8'))
W, S = table['words'], table['scales']
STR = json.loads((root / 'data/strings.ne.json').read_text(encoding='utf8'))['words']


def words(n: int) -> str:
    if n == 0:
        return W[0]
    digits = str(n)
    parts = []
    # groups from the right: ones+tens (2), hundreds (1), then pairs for thousand..arba
    groups = []
    rest = digits
    groups.append(('', rest[-2:])); rest = rest[:-2]
    groups.append((S['hundred'], rest[-1:])); rest = rest[:-1]
    for name in ('thousand', 'lakh', 'crore', 'arba'):
        groups.append((S[name], rest[-2:])); rest = rest[:-2]
    kharba = rest  # whatever digits are left
    out = []
    if kharba:
        out.append(words(int(kharba)) + ' ' + S['kharba'])
    for label, g in reversed(groups):
        v = int(g) if g else 0
        if v:
            out.append(W[v] + (' ' + label if label else ''))
    return ' '.join(out)


def amount(paisa: int) -> str:
    neg, a = paisa < 0, abs(paisa)
    rupees, paise = divmod(a, 100)
    parts = []
    if neg:
        parts.append(STR['minus'])
    if rupees > 0 or paise == 0:
        parts += [words(rupees), STR['rupees']]
    if paise > 0:
        parts += [words(paise), STR['paisa']]
    parts.append(STR['only'])
    return ' '.join(parts)


MAX = 2**53 - 1
ns = set(range(0, 200))
for p in range(2, 17):
    for d in (10**p - 1, 10**p, 10**p + 1):
        if d <= MAX: ns.add(d)
for k in (2, 3, 5, 7, 9, 11):   # scale boundaries with a leading digit
    for lead in (1, 2, 9, 10, 99):
        v = lead * 10**k
        if v <= MAX: ns.add(v)
ns |= {MAX, MAX - 1, 99 * 10**11, 100 * 10**11 - 1, 100 * 10**11, 123456789, 1234567890123}
rnd = random.Random(20261121)
ns |= {rnd.randrange(0, 10**rnd.randrange(3, 16)) for _ in range(300)}
ns = sorted(n for n in ns if n <= MAX)

paisas = [0, 1, 5, 50, 99, 100, 101, 150, 1000, 12345, 100050, 113050, 12000000, -1, -100, -150, -12345, MAX, -MAX]
paisas += [rnd.randrange(0, 10**rnd.randrange(3, 16)) for _ in range(60)]
paisas = sorted(set(p for p in paisas if abs(p) <= MAX))

nepal_kit_numbers = {0: 'शून्य', 1: 'एक', 21: 'एक्काइस', 45: 'पैँतालीस', 99: 'उनान्सय', 100: 'एक सय',
                     105: 'एक सय पाँच', 1790: 'एक हजार सात सय नब्बे', 250000: 'दुई लाख पचास हजार',
                     10000000: 'एक करोड', 1000000000: 'एक अर्ब', 1250000000: 'एक अर्ब पच्चीस करोड',
                     100000000000: 'एक खर्ब', 123456789: 'बाह्र करोड चौँतीस लाख छपन्न हजार सात सय उनान्नब्बे'}
nepal_kit_amounts = {12000000: 'एक लाख बीस हजार रुपैयाँ मात्र',
                     113050: 'एक हजार एक सय तीस रुपैयाँ पचास पैसा मात्र',
                     500: 'पाँच रुपैयाँ मात्र'}

out = {
    '_note': 'Nepali amount in words. Made by tools/check-words/make_vectors.py (an independent digit-group model) '
             'from data/nepali-numbers.json, so these check how the words are put together, not the words '
             '(single-source, not native-speaker reviewed). fromNepalKit is copied from nepal-kit\'s tests. '
             'Do not edit by hand.',
    'numbers': [{'in': n, 'out': words(n)} for n in ns],
    'amount': [{'paisa': p, 'out': amount(p)} for p in paisas],
    'fromNepalKit': {
        'numbers': [{'in': n, 'out': w} for n, w in nepal_kit_numbers.items()],
        'amount': [{'paisa': p, 'out': w} for p, w in nepal_kit_amounts.items()],
    },
}
for c in out['fromNepalKit']['numbers']:
    assert words(c['in']) == c['out'], (c, words(c['in']))
for c in out['fromNepalKit']['amount']:
    assert amount(c['paisa']) == c['out'], (c, amount(c['paisa']))

text = json.dumps(out, ensure_ascii=False, indent=1) + '\n'
target = root / 'testdata/money-words-ne.json'
if '--check' in sys.argv:
    if not target.exists() or target.read_text(encoding='utf8') != text:
        print('stale: testdata/money-words-ne.json'); sys.exit(1)
    print('money-words-ne.json up to date')
else:
    target.write_text(text, encoding='utf8')
    print('wrote', target, len(out['numbers']), 'numbers,', len(out['amount']), 'amounts')
