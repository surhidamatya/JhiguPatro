/// Nepali rupee amounts (guide section 9). Integer paisa only, never floats.
///
/// An amount is an integer number of paisa with magnitude at most 2^53 - 1
/// (about 90 trillion rupees), the same limit as the TypeScript port, so both
/// behave alike including on Dart web. Multiplication and division run on
/// [BigInt] so intermediate values cannot overflow. All rounding is half away
/// from zero.
library;

import 'generated/nepali_numbers.dart';
import 'generated/strings.dart';

/// Why a money operation or parse failed.
enum MoneyErrorCode {
  empty('EMPTY'),
  badFormat('BAD_FORMAT'),
  tooManyDecimals('TOO_MANY_DECIMALS'),
  outOfRange('OUT_OF_RANGE'),
  invalidArgument('INVALID_ARGUMENT');

  const MoneyErrorCode(this.name_);

  /// Stable code shared with the TypeScript library.
  final String name_;
}

/// Typed money error. [message] is English; use [localized] for `ne`.
class MoneyException implements Exception {
  final MoneyErrorCode code;
  const MoneyException(this.code);

  String get message => localized('en');

  String localized(String language) {
    final m = getStrings(language).money;
    return switch (code) {
      MoneyErrorCode.empty => m.empty,
      MoneyErrorCode.badFormat => m.badFormat,
      MoneyErrorCode.tooManyDecimals => m.tooManyDecimals,
      MoneyErrorCode.outOfRange => m.outOfRange,
      MoneyErrorCode.invalidArgument => m.invalidArgument,
    };
  }

  @override
  String toString() => 'MoneyException(${code.name_}): $message';
}

/// Largest allowed magnitude in paisa: 2^53 - 1.
const int maxPaisa = 9007199254740991;
final BigInt _maxBig = BigInt.from(maxPaisa);

/// n / d rounded half away from zero. d must be positive.
BigInt _roundDiv(BigInt n, BigInt d) {
  final q = n ~/ d;
  final r = n.remainder(d);
  if (r.abs() * BigInt.two < d) return q;
  return n.isNegative ? q - BigInt.one : q + BigInt.one;
}

Npr _fromBig(BigInt b) {
  if (b > _maxBig || b < -_maxBig) {
    throw const MoneyException(MoneyErrorCode.outOfRange);
  }
  return Npr.fromPaisa(b.toInt());
}

const MoneyException _invalid = MoneyException(MoneyErrorCode.invalidArgument);

const _neDigits = '०१२३४५६७८९';

String _toAscii(String s) => s.split('').map((c) {
      final i = _neDigits.indexOf(c);
      return i < 0 ? c : i.toString();
    }).join();

String _toDevanagari(String s) => s.split('').map((c) {
      final d = int.tryParse(c);
      return d == null ? c : _neDigits[d];
    }).join();

/// Indian grouping: last three digits, then groups of two.
/// `groupLakh('12345678')` is `1,23,45,678`. Input is digits only.
String groupLakh(String intPart) {
  if (intPart.length <= 3) return intPart;
  final last3 = intPart.substring(intPart.length - 3);
  var rest = intPart.substring(0, intPart.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '${parts.join(',')},$last3';
}

/// Currency symbol for [Npr.format].
enum MoneySymbol {
  none('none'),
  rs('Rs.'),
  ru('रु');

  const MoneySymbol(this.text);
  final String text;
}

/// How [Npr.format] shows paisa.
enum MoneyDecimals {
  /// Drops `.00` (default).
  auto,

  /// Always two paisa digits.
  always,

  /// Rounds to whole rupees, half away from zero.
  never,
}

/// VAT split of an amount.
class VatResult {
  final Npr subtotal;
  final Npr vat;
  final Npr total;
  const VatResult({
    required this.subtotal,
    required this.vat,
    required this.total,
  });
}

/// An amount in Nepali rupees, stored as integer paisa.
class Npr {
  /// Integer paisa.
  final int paisa;

  const Npr._(this.paisa);

  static const Npr zero = Npr._(0);

  /// Throws [MoneyException] if [paisa] is out of range.
  factory Npr.fromPaisa(int paisa) {
    if (paisa > maxPaisa || paisa < -maxPaisa) {
      throw const MoneyException(MoneyErrorCode.outOfRange);
    }
    return Npr._(paisa);
  }

  /// Rounds once to paisa, half away from zero. Uses the shortest decimal text
  /// of the double (so 1.005 is 100.5 paisa, not 100.49999). Throws for
  /// NaN/Infinity.
  factory Npr.fromRupees(double rupees) {
    if (!rupees.isFinite) throw _invalid;
    final m = RegExp(
      r'^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$',
    ).firstMatch(rupees.toString());
    if (m == null) throw _invalid;
    final frac = m.group(3) ?? '';
    var digits = BigInt.parse('${m.group(2)}$frac');
    if (m.group(1) == '-') digits = -digits;
    final exp = int.parse(m.group(4) ?? '0') - frac.length;
    if (exp > 400) throw const MoneyException(MoneyErrorCode.outOfRange);
    if (exp >= 0) {
      return _fromBig(
        digits * BigInt.from(10).pow(exp) * BigInt.from(100),
      );
    }
    return _fromBig(
      _roundDiv(digits * BigInt.from(100), BigInt.from(10).pow(-exp)),
    );
  }

  /// Parse user text such as `Rs. 1,250.50`, `रु १,२५०`, `NPR 99`, `-5`.
  /// Throws [MoneyException] (empty, badFormat, tooManyDecimals, outOfRange).
  factory Npr.parse(String text) {
    var s = _toAscii(text).trim().toLowerCase();
    final symbolStart = RegExp(r'^(?:rs\.?|npr|रु|रू)');
    final symbolEnd = RegExp(r'(?:rs\.?|npr|रु|रू)$');
    var negative = false;
    if (s.startsWith('-')) {
      negative = true;
      s = s.substring(1).trimLeft();
    }
    s = s.replaceFirst(symbolStart, '').trimLeft();
    if (s.startsWith('-')) {
      if (negative) throw const MoneyException(MoneyErrorCode.badFormat);
      negative = true;
      s = s.substring(1).trimLeft();
    }
    s = s.trimRight().replaceFirst(symbolEnd, '');
    s = s.replaceAll(RegExp(r'[,\s]'), '');
    if (s.isEmpty) throw const MoneyException(MoneyErrorCode.empty);
    final m = RegExp(r'^(\d+)(?:\.(\d*))?$').firstMatch(s);
    if (m == null || (m.group(2) != null && m.group(2)!.isEmpty)) {
      throw const MoneyException(MoneyErrorCode.badFormat);
    }
    final frac = m.group(2) ?? '';
    if (frac.length > 2) {
      throw const MoneyException(MoneyErrorCode.tooManyDecimals);
    }
    var paisa = BigInt.parse('${m.group(1)}${frac.padRight(2, '0')}');
    if (negative) paisa = -paisa;
    return _fromBig(paisa);
  }

  // ── Comparison ─────────────────────────────────────────────────────────────

  bool get isZero => paisa == 0;
  bool get isNegative => paisa < 0;
  bool equals(Npr other) => paisa == other.paisa;

  /// Negative, zero or positive like `List.sort` expects.
  int compareTo(Npr other) => paisa.compareTo(other.paisa);

  @override
  bool operator ==(Object other) => other is Npr && other.paisa == paisa;

  @override
  int get hashCode => paisa.hashCode;

  // ── Arithmetic ─────────────────────────────────────────────────────────────

  Npr plus(Npr other) => Npr.fromPaisa(paisa + other.paisa);
  Npr minus(Npr other) => Npr.fromPaisa(paisa - other.paisa);
  Npr negate() => Npr.fromPaisa(-paisa);
  Npr abs() => Npr.fromPaisa(paisa.abs());

  /// Exact multiple by an integer.
  Npr times(int n) => _fromBig(BigInt.from(paisa) * BigInt.from(n));

  /// Multiply by a decimal given as text (`"1.5"`, `"-0.125"`), rounded half
  /// away from zero. Floating-point numbers are not accepted.
  Npr timesDecimal(String decimal) {
    final m = RegExp(r'^(-?)(\d+)(?:\.(\d+))?$').firstMatch(decimal);
    if (m == null) throw _invalid;
    final frac = m.group(3) ?? '';
    var num = BigInt.parse('${m.group(2)}$frac');
    if (m.group(1) == '-') num = -num;
    return _fromBig(
      _roundDiv(BigInt.from(paisa) * num, BigInt.from(10).pow(frac.length)),
    );
  }

  /// [bp] basis points of this amount (13% is 1300), rounded half away from
  /// zero.
  Npr percent(int bp) => _fromBig(
      _roundDiv(BigInt.from(paisa) * BigInt.from(bp), BigInt.from(10000)));

  /// `this * times / divisor`, rounded half away from zero. [divisor] must be
  /// a positive integer.
  Npr dividedBy(int divisor, {int times = 1}) {
    if (divisor < 1) throw _invalid;
    return _fromBig(
      _roundDiv(BigInt.from(paisa) * BigInt.from(times), BigInt.from(divisor)),
    );
  }

  /// Split by ratios with the largest remainder method. Ratios are
  /// non-negative integers with a positive sum. The shares always add up to
  /// this amount; leftover paisa go to the largest remainders, ties to the
  /// lower index.
  List<Npr> allocate(List<int> ratios) {
    if (ratios.isEmpty) throw _invalid;
    var sum = BigInt.zero;
    for (final r in ratios) {
      if (r < 0) throw _invalid;
      sum += BigInt.from(r);
    }
    if (sum == BigInt.zero) throw _invalid;
    final negative = paisa < 0;
    final total = BigInt.from(paisa.abs());
    final shares = <BigInt>[];
    final remainders = <BigInt>[];
    var given = BigInt.zero;
    for (final r in ratios) {
      final prod = total * BigInt.from(r);
      final share = prod ~/ sum;
      shares.add(share);
      remainders.add(prod.remainder(sum));
      given += share;
    }
    final leftover = (total - given).toInt();
    final order = List<int>.generate(ratios.length, (i) => i)
      ..sort((a, b) {
        final c = remainders[b].compareTo(remainders[a]);
        return c != 0 ? c : a.compareTo(b);
      });
    for (var k = 0; k < leftover; k++) {
      shares[order[k]] += BigInt.one;
    }
    return [
      for (final s in shares) Npr.fromPaisa((negative ? -s : s).toInt()),
    ];
  }

  /// [allocate] into [n] equal parts.
  List<Npr> split(int n) {
    if (n < 1) throw _invalid;
    return allocate(List<int>.filled(n, 1));
  }

  // ── Format ─────────────────────────────────────────────────────────────────

  /// `Rs. 1,23,456.50`. The minus sign goes before the symbol.
  String format({
    MoneySymbol symbol = MoneySymbol.none,
    bool devanagari = false,
    MoneyDecimals decimals = MoneyDecimals.auto,
  }) {
    final negative = paisa < 0;
    final abs = BigInt.from(paisa.abs());
    var rupees = abs ~/ BigInt.from(100);
    var paise = (abs % BigInt.from(100)).toInt();
    if (decimals == MoneyDecimals.never) {
      if (paise >= 50) rupees += BigInt.one;
      paise = 0;
    }
    final showPaise = decimals == MoneyDecimals.always ||
        (decimals == MoneyDecimals.auto && paise != 0);
    var body = groupLakh(rupees.toString());
    if (showPaise) body += '.${paise.toString().padLeft(2, '0')}';
    if (devanagari) body = _toDevanagari(body);
    final isZero = rupees == BigInt.zero && paise == 0;
    final sign = negative && !isZero ? '-' : '';
    return sign + (symbol == MoneySymbol.none ? body : '${symbol.text} $body');
  }

  /// Amount in words, e.g. `Rupees One Hundred Twenty-Three and Forty-Five
  /// Paisa Only`.
  String inWords({
    String language = 'en',
    String letterCase = 'title',
    String? prefix,
    String? rupeesLabel,
    String? suffix,
    String? paisaLabel,
    String? joiner,
    String? minus,
  }) =>
      amountInWords(
        this,
        language: language,
        letterCase: letterCase,
        prefix: prefix,
        rupeesLabel: rupeesLabel,
        suffix: suffix,
        paisaLabel: paisaLabel,
        joiner: joiner,
        minus: minus,
      );

  @override
  String toString() => format(decimals: MoneyDecimals.always);
}

/// Price does not include VAT. Default rate 13% (1300 basis points).
VatResult vatExclusive(Npr base, {int bp = 1300}) {
  final vat = base.percent(bp);
  return VatResult(subtotal: base, vat: vat, total: base.plus(vat));
}

/// Price already includes VAT. VAT is `total - base` so the parts always add up.
VatResult vatInclusive(Npr total, {int bp = 1300}) {
  final base = total.dividedBy(10000 + bp, times: 10000);
  return VatResult(subtotal: base, vat: total.minus(base), total: total);
}

// ── Amount in words (guide 9.5) ──────────────────────────────────────────────────────────────────────────

const _ones = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const _tens = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

String _below100(int n) {
  if (n < 20) return _ones[n];
  final t = _tens[n ~/ 10];
  return n % 10 == 0 ? t : '$t-${_ones[n % 10]}';
}

String _below1000(int n) {
  final h = n ~/ 100;
  final r = n % 100;
  return [
    if (h > 0) '${_ones[h]} hundred',
    if (r > 0) _below100(r),
  ].join(' ');
}

String _belowCrore(int n) {
  final lakh = n ~/ 100000;
  final thousand = (n % 100000) ~/ 1000;
  final rest = n % 1000;
  return [
    if (lakh > 0) '${_below100(lakh)} lakh',
    if (thousand > 0) '${_below100(thousand)} thousand',
    if (rest > 0) _below1000(rest),
  ].join(' ');
}

/// A non-negative integer in English words with Indian scales (thousand,
/// lakh, crore), lower case, hyphenated tens: `1234567` is
/// `twelve lakh thirty-four thousand five hundred sixty-seven`. Above 99 crore
/// the crore count is spoken as its own number (`one hundred crore`). No "and"
/// inside the number.
///
/// With `language: 'ne'` it is in Nepali (Devanagari) with the scales सय, हजार,
/// लाख, करोड, अर्ब and खर्ब: `123456` is `एक लाख तेइस हजार चार सय छपन्न`. Above 99
/// खर्ब the खर्ब count is spoken as its own number. The Nepali word table is
/// **not native-speaker reviewed** (see `data/nepali-numbers.json`).
String numberToWords(int n, {String language = 'en'}) {
  if (n < 0 || n > maxPaisa) throw _invalid;
  if (language == 'ne') return _nepaliWords(n);
  if (language != 'en') throw _invalid;
  if (n == 0) return 'zero';
  final crore = n ~/ 10000000;
  final rest = n % 10000000;
  return [
    if (crore > 0) '${_belowCrore(crore)} crore',
    if (rest > 0) _belowCrore(rest),
  ].join(' ');
}

/// [n] divided by [d] (whole part) and the remainder, for a safe integer [n].
(int, int) _divmod(int n, int d) {
  final r = n % d;
  return ((n - r) ~/ d, r);
}

/// Nepali words for a non-negative safe integer. Every number below 100 is
/// its own word.
String _nepaliWords(int n) {
  if (n == 0) return nepaliNumberWords[0];
  final parts = <String>[];
  var (count, rest) = _divmod(n, 100000000000);
  if (count > 0) parts.add('${_nepaliWords(count)} $nepaliScaleKharba');
  (count, rest) = _divmod(rest, 1000000000);
  if (count > 0) parts.add('${nepaliNumberWords[count]} $nepaliScaleArba');
  (count, rest) = _divmod(rest, 10000000);
  if (count > 0) parts.add('${nepaliNumberWords[count]} $nepaliScaleCrore');
  (count, rest) = _divmod(rest, 100000);
  if (count > 0) parts.add('${nepaliNumberWords[count]} $nepaliScaleLakh');
  (count, rest) = _divmod(rest, 1000);
  if (count > 0) parts.add('${nepaliNumberWords[count]} $nepaliScaleThousand');
  (count, rest) = _divmod(rest, 100);
  if (count > 0) parts.add('${nepaliNumberWords[count]} $nepaliScaleHundred');
  if (rest > 0) parts.add(nepaliNumberWords[rest]);
  return parts.join(' ');
}

String _titleCase(String s) => s.replaceAllMapped(
      RegExp(r'(^|[\s-])([a-z])'),
      (m) => '${m[1]}${m[2]!.toUpperCase()}',
    );

/// `Rupees <words> [and <paisa words> Paisa] Only`. With zero rupees and some
/// paisa the rupee part is left out (`Fifty Paisa Only`); with nothing at all
/// it is `Rupees Zero Only`. A negative amount starts with `Minus`.
///
/// [language] is `'en'` (default) or `'ne'`. The Nepali words are not
/// native-speaker reviewed. In Nepali the order is
/// `<rupee words> रुपैयाँ [<paisa words> पैसा] मात्र`, `ऋण` comes first for a
/// negative amount, and [letterCase] has no effect. [letterCase] is `'title'`
/// (default) or `'lower'`. Labels default to the strings table: [prefix]
/// (before the rupee words) and [joiner] (between rupees and paisa) are empty
/// in Nepali, and [rupeesLabel] (after the rupee words, default `रुपैयाँ`) is
/// used in Nepali only.
String amountInWords(
  Npr amount, {
  String language = 'en',
  String letterCase = 'title',
  String? prefix,
  String? rupeesLabel,
  String? suffix,
  String? paisaLabel,
  String? joiner,
  String? minus,
}) {
  if (language != 'en' && language != 'ne') throw _invalid;
  final ne = language == 'ne';
  final w = getStrings(language).words;
  String spell(int n) =>
      ne ? numberToWords(n, language: 'ne') : _titleCase(numberToWords(n));
  final abs = amount.paisa.abs();
  final rupees = abs ~/ 100;
  final paise = abs % 100;
  final parts = <String>[];
  if (amount.paisa < 0) parts.add(minus ?? w.minus);
  if (rupees > 0 || paise == 0) {
    parts
      ..add(prefix ?? (ne ? '' : w.rupees))
      ..add(spell(rupees))
      ..add(ne ? (rupeesLabel ?? w.rupees) : '');
    if (paise > 0) parts.add(joiner ?? (ne ? '' : w.and));
  }
  if (paise > 0) {
    parts
      ..add(spell(paise))
      ..add(paisaLabel ?? w.paisa);
  }
  parts.add(suffix ?? w.only);
  final out = parts.where((x) => x.isNotEmpty).join(' ');
  return !ne && letterCase == 'lower' ? out.toLowerCase() : out;
}
