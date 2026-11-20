// GENERATED FILE. DO NOT EDIT. Source: data/strings.*.json. Run: node tools/gen-data/gen.mjs
// ignore_for_file: lines_longer_than_80_chars

/// Strings group `JhiguStrings`.
class JhiguStrings {
  final List<String> months;
  final List<String> monthsShort;
  final List<String> weekdays;
  final List<String> weekdaysShort;
  final List<String> adMonths;
  final List<String> adMonthsShort;
  final JhiguStringsRelative relative;
  final JhiguStringsAccuracy accuracy;
  final JhiguStringsPicker picker;
  final JhiguStringsPhone phone;
  final JhiguStringsAddress address;
  final JhiguStringsMoney money;
  final JhiguStringsWords words;
  final JhiguStringsDate date;
  final JhiguStringsFormat format;
  final JhiguStringsReceipt receipt;

  const JhiguStrings({
    required this.months,
    required this.monthsShort,
    required this.weekdays,
    required this.weekdaysShort,
    required this.adMonths,
    required this.adMonthsShort,
    required this.relative,
    required this.accuracy,
    required this.picker,
    required this.phone,
    required this.address,
    required this.money,
    required this.words,
    required this.date,
    required this.format,
    required this.receipt,
  });
}

/// Strings group `JhiguStringsReceipt`.
class JhiguStringsReceipt {
  final String invoice;
  final String receipt;
  final String quotation;
  final String creditNote;
  final String subtotal;
  final String discount;
  final String taxable;
  final String vat;
  final String total;
  final String paid;
  final String balance;
  final String dueDate;
  final String amountInWords;
  final String notes;
  final String signature;
  final String stampPaid;
  final String stampCancelled;

  const JhiguStringsReceipt({
    required this.invoice,
    required this.receipt,
    required this.quotation,
    required this.creditNote,
    required this.subtotal,
    required this.discount,
    required this.taxable,
    required this.vat,
    required this.total,
    required this.paid,
    required this.balance,
    required this.dueDate,
    required this.amountInWords,
    required this.notes,
    required this.signature,
    required this.stampPaid,
    required this.stampCancelled,
  });
}

/// Strings group `JhiguStringsFormat`.
class JhiguStringsFormat {
  final String gatePattern;
  final String dualPattern;

  const JhiguStringsFormat({
    required this.gatePattern,
    required this.dualPattern,
  });
}

/// Strings group `JhiguStringsDate`.
class JhiguStringsDate {
  final String parseError;

  const JhiguStringsDate({
    required this.parseError,
  });
}

/// Strings group `JhiguStringsWords`.
class JhiguStringsWords {
  final String rupees;
  final String paisa;
  final String and;
  final String only;
  final String minus;

  const JhiguStringsWords({
    required this.rupees,
    required this.paisa,
    required this.and,
    required this.only,
    required this.minus,
  });
}

/// Strings group `JhiguStringsMoney`.
class JhiguStringsMoney {
  final String empty;
  final String badFormat;
  final String tooManyDecimals;
  final String outOfRange;
  final String invalidArgument;

  const JhiguStringsMoney({
    required this.empty,
    required this.badFormat,
    required this.tooManyDecimals,
    required this.outOfRange,
    required this.invalidArgument,
  });
}

/// Strings group `JhiguStringsAddress`.
class JhiguStringsAddress {
  final String ward;
  final String unknownProvince;
  final String unknownDistrict;
  final String unknownLocalLevel;
  final String badWard;

  const JhiguStringsAddress({
    required this.ward,
    required this.unknownProvince,
    required this.unknownDistrict,
    required this.unknownLocalLevel,
    required this.badWard,
  });
}

/// Strings group `JhiguStringsPhone`.
class JhiguStringsPhone {
  final String empty;
  final String tooShort;
  final String tooLong;
  final String badPrefix;
  final String inactivePrefix;
  final String badCharacters;

  const JhiguStringsPhone({
    required this.empty,
    required this.tooShort,
    required this.tooLong,
    required this.badPrefix,
    required this.inactivePrefix,
    required this.badCharacters,
  });
}

/// Strings group `JhiguStringsPicker`.
class JhiguStringsPicker {
  final String today;
  final String clear;
  final String selectYear;
  final String selectMonth;
  final String previousMonth;
  final String nextMonth;

  const JhiguStringsPicker({
    required this.today,
    required this.clear,
    required this.selectYear,
    required this.selectMonth,
    required this.previousMonth,
    required this.nextMonth,
  });
}

/// Strings group `JhiguStringsAccuracy`.
class JhiguStringsAccuracy {
  final String unverifiedYear;

  const JhiguStringsAccuracy({
    required this.unverifiedYear,
  });
}

/// Strings group `JhiguStringsRelative`.
class JhiguStringsRelative {
  final String justNow;
  final String secondsAgo;
  final String minutesAgo;
  final String hoursAgo;
  final String today;
  final String yesterday;
  final String tomorrow;
  final String daysAgo;
  final String daysLater;
  final String monthAgo;
  final String monthLater;
  final String monthsAgo;
  final String monthsLater;
  final String yearAgo;
  final String yearLater;
  final String yearsAgo;
  final String yearsLater;

  const JhiguStringsRelative({
    required this.justNow,
    required this.secondsAgo,
    required this.minutesAgo,
    required this.hoursAgo,
    required this.today,
    required this.yesterday,
    required this.tomorrow,
    required this.daysAgo,
    required this.daysLater,
    required this.monthAgo,
    required this.monthLater,
    required this.monthsAgo,
    required this.monthsLater,
    required this.yearAgo,
    required this.yearLater,
    required this.yearsAgo,
    required this.yearsLater,
  });
}

const jhiguStringsEn = JhiguStrings(
  months: ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'],
  monthsShort: ['Bai', 'Jes', 'Ash', 'Shr', 'Bha', 'Asw', 'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha'],
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  adMonths: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  adMonthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  relative: JhiguStringsRelative(
    justNow: 'just now',
    secondsAgo: '{n} seconds ago',
    minutesAgo: '{n} minutes ago',
    hoursAgo: '{n} hours ago',
    today: 'today',
    yesterday: 'yesterday',
    tomorrow: 'tomorrow',
    daysAgo: '{n} days ago',
    daysLater: 'in {n} days',
    monthAgo: 'a month ago',
    monthLater: 'in a month',
    monthsAgo: '{n} months ago',
    monthsLater: 'in {n} months',
    yearAgo: 'a year ago',
    yearLater: 'in a year',
    yearsAgo: '{n} years ago',
    yearsLater: 'in {n} years',
  ),
  accuracy: JhiguStringsAccuracy(
    unverifiedYear: 'BS {year} is not in the verified range ({through}). Confirm it against the Nepal Panchang Nirnayak Samiti calendar before relying on it.',
  ),
  picker: JhiguStringsPicker(
    today: 'Today',
    clear: 'Clear',
    selectYear: 'Select year',
    selectMonth: 'Select month',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
  ),
  phone: JhiguStringsPhone(
    empty: 'Enter a phone number',
    tooShort: 'Phone number is too short',
    tooLong: 'Phone number is too long',
    badPrefix: 'Phone number does not start with a valid prefix',
    inactivePrefix: 'This phone number prefix is not in use',
    badCharacters: 'Phone number contains invalid characters',
  ),
  address: JhiguStringsAddress(
    ward: 'Ward {n}',
    unknownProvince: 'Unknown province',
    unknownDistrict: 'Unknown district',
    unknownLocalLevel: 'Unknown local level',
    badWard: 'Ward number is not valid for this local level',
  ),
  money: JhiguStringsMoney(
    empty: 'Enter an amount',
    badFormat: 'Amount is not a valid number',
    tooManyDecimals: 'Amount can have at most two decimal places',
    outOfRange: 'Amount is too large',
    invalidArgument: 'Invalid amount',
  ),
  words: JhiguStringsWords(
    rupees: 'Rupees',
    paisa: 'Paisa',
    and: 'and',
    only: 'Only',
    minus: 'Minus',
  ),
  date: JhiguStringsDate(
    parseError: 'Could not read this date',
  ),
  format: JhiguStringsFormat(
    gatePattern: '[BS] YYYY MMMM D',
    dualPattern: '{bs} (AD {ad})',
  ),
  receipt: JhiguStringsReceipt(
    invoice: 'Invoice',
    receipt: 'Receipt',
    quotation: 'Quotation',
    creditNote: 'Credit Note',
    subtotal: 'Subtotal',
    discount: 'Discount',
    taxable: 'Taxable amount',
    vat: 'VAT',
    total: 'Total',
    paid: 'Paid',
    balance: 'Balance',
    dueDate: 'Due date',
    amountInWords: 'Amount in words',
    notes: 'Notes',
    signature: 'Signature',
    stampPaid: 'PAID',
    stampCancelled: 'CANCELLED',
  ),
);

const jhiguStringsNe = JhiguStrings(
  months: ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फागुन', 'चैत्र'],
  monthsShort: ['बै', 'जे', 'अ', 'सा', 'भ', 'अ', 'का', 'मं', 'पौ', 'मा', 'फा', 'चै'],
  weekdays: ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार'],
  weekdaysShort: ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'],
  adMonths: ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'],
  adMonthsShort: ['जन', 'फेब्रु', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अग', 'सेप्टे', 'अक्टो', 'नोभे', 'डिसे'],
  relative: JhiguStringsRelative(
    justNow: 'हालै',
    secondsAgo: '{n} सेकेण्ड अगाडि',
    minutesAgo: '{n} मिनेट अगाडि',
    hoursAgo: '{n} घण्टा अगाडि',
    today: 'आज',
    yesterday: 'हिजो',
    tomorrow: 'भोलि',
    daysAgo: '{n} दिन अघि',
    daysLater: '{n} दिनपछि',
    monthAgo: '१ महिना अघि',
    monthLater: '१ महिनापछि',
    monthsAgo: '{n} महिना अघि',
    monthsLater: '{n} महिनापछि',
    yearAgo: '१ वर्ष अघि',
    yearLater: '१ वर्षपछि',
    yearsAgo: '{n} वर्ष अघि',
    yearsLater: '{n} वर्षपछि',
  ),
  accuracy: JhiguStringsAccuracy(
    unverifiedYear: 'वि.सं. {year} प्रमाणित अवधि ({through}) भित्र पर्दैन। भरोसा गर्नुअघि नेपाल पञ्चाङ्ग निर्णायक समितिको पात्रोसँग मिलाउनुहोस्।',
  ),
  picker: JhiguStringsPicker(
    today: 'आज',
    clear: 'हटाउनुहोस्',
    selectYear: 'साल छान्नुहोस्',
    selectMonth: 'महिना छान्नुहोस्',
    previousMonth: 'अघिल्लो महिना',
    nextMonth: 'अर्को महिना',
  ),
  phone: JhiguStringsPhone(
    empty: 'फोन नम्बर लेख्नुहोस्',
    tooShort: 'फोन नम्बर धेरै छोटो छ',
    tooLong: 'फोन नम्बर धेरै लामो छ',
    badPrefix: 'फोन नम्बर मान्य प्रिफिक्सबाट सुरु भएको छैन',
    inactivePrefix: 'यो फोन नम्बरको प्रिफिक्स प्रयोगमा छैन',
    badCharacters: 'फोन नम्बरमा अमान्य अक्षर छन्',
  ),
  address: JhiguStringsAddress(
    ward: 'वडा नं. {n}',
    unknownProvince: 'अज्ञात प्रदेश',
    unknownDistrict: 'अज्ञात जिल्ला',
    unknownLocalLevel: 'अज्ञात स्थानीय तह',
    badWard: 'यो स्थानीय तहका लागि वडा नम्बर मान्य छैन',
  ),
  money: JhiguStringsMoney(
    empty: 'रकम राख्नुहोस्',
    badFormat: 'रकम मान्य संख्या होइन',
    tooManyDecimals: 'रकममा बढीमा दुई दशमलव स्थान हुन सक्छ',
    outOfRange: 'रकम धेरै ठूलो छ',
    invalidArgument: 'रकम मान्य छैन',
  ),
  words: JhiguStringsWords(
    rupees: 'रुपैयाँ',
    paisa: 'पैसा',
    and: 'र',
    only: 'मात्र',
    minus: 'ऋण',
  ),
  date: JhiguStringsDate(
    parseError: 'यो मिति पढ्न सकिएन',
  ),
  format: JhiguStringsFormat(
    gatePattern: 'YYYY [साल] MMMM D [गते]',
    dualPattern: '{bs} (ई.सं. {ad})',
  ),
  receipt: JhiguStringsReceipt(
    invoice: 'बिजक',
    receipt: 'रसिद',
    quotation: 'कोटेशन',
    creditNote: 'क्रेडिट नोट',
    subtotal: 'उप-जम्मा',
    discount: 'छुट',
    taxable: 'करयोग्य रकम',
    vat: 'मूल्य अभिवृद्धि कर',
    total: 'जम्मा',
    paid: 'तिरेको',
    balance: 'बाँकी',
    dueDate: 'भुक्तानी मिति',
    amountInWords: 'अक्षरमा रकम',
    notes: 'टिप्पणी',
    signature: 'हस्ताक्षर',
    stampPaid: 'भुक्तानी भयो',
    stampCancelled: 'रद्द',
  ),
);

/// Label table for [language] (`'ne'` or `'en'`; anything else gives English).
JhiguStrings getStrings(String language) =>
    language == 'ne' ? jhiguStringsNe : jhiguStringsEn;
