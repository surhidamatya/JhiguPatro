// GENERATED FILE. DO NOT EDIT. Source: data/strings.*.json. Run: node tools/gen-data/gen.mjs

export type Language = 'en' | 'ne';

export interface Strings {
  readonly months: readonly string[];
  readonly monthsShort: readonly string[];
  readonly weekdays: readonly string[];
  readonly weekdaysShort: readonly string[];
  readonly adMonths: readonly string[];
  readonly adMonthsShort: readonly string[];
  readonly relative: {
    readonly justNow: string;
    readonly secondsAgo: string;
    readonly minutesAgo: string;
    readonly hoursAgo: string;
    readonly today: string;
    readonly yesterday: string;
    readonly tomorrow: string;
    readonly daysAgo: string;
    readonly daysLater: string;
    readonly monthAgo: string;
    readonly monthLater: string;
    readonly monthsAgo: string;
    readonly monthsLater: string;
    readonly yearAgo: string;
    readonly yearLater: string;
    readonly yearsAgo: string;
    readonly yearsLater: string;
  };
  readonly accuracy: {
    readonly unverifiedYear: string;
  };
  readonly picker: {
    readonly today: string;
    readonly clear: string;
    readonly selectYear: string;
    readonly selectMonth: string;
    readonly previousMonth: string;
    readonly nextMonth: string;
  };
  readonly phone: {
    readonly empty: string;
    readonly tooShort: string;
    readonly tooLong: string;
    readonly badPrefix: string;
    readonly inactivePrefix: string;
    readonly badCharacters: string;
  };
  readonly address: {
    readonly ward: string;
    readonly unknownProvince: string;
    readonly unknownDistrict: string;
    readonly unknownLocalLevel: string;
    readonly badWard: string;
  };
  readonly money: {
    readonly empty: string;
    readonly badFormat: string;
    readonly tooManyDecimals: string;
    readonly outOfRange: string;
    readonly invalidArgument: string;
  };
  readonly words: {
    readonly rupees: string;
    readonly paisa: string;
    readonly and: string;
    readonly only: string;
    readonly minus: string;
  };
  readonly date: {
    readonly parseError: string;
  };
  readonly format: {
    readonly gatePattern: string;
    readonly dualPattern: string;
  };
  readonly receipt: {
    readonly invoice: string;
    readonly receipt: string;
    readonly quotation: string;
    readonly creditNote: string;
    readonly subtotal: string;
    readonly discount: string;
    readonly taxable: string;
    readonly vat: string;
    readonly total: string;
    readonly paid: string;
    readonly balance: string;
    readonly dueDate: string;
    readonly amountInWords: string;
    readonly notes: string;
    readonly signature: string;
    readonly stampPaid: string;
    readonly stampCancelled: string;
  };
}

export const stringsEn: Strings = {
  months: ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"],
  monthsShort: ["Bai", "Jes", "Ash", "Shr", "Bha", "Asw", "Kar", "Man", "Pou", "Mag", "Fal", "Cha"],
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  adMonths: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  adMonthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  relative: {
    justNow: "just now",
    secondsAgo: "{n} seconds ago",
    minutesAgo: "{n} minutes ago",
    hoursAgo: "{n} hours ago",
    today: "today",
    yesterday: "yesterday",
    tomorrow: "tomorrow",
    daysAgo: "{n} days ago",
    daysLater: "in {n} days",
    monthAgo: "a month ago",
    monthLater: "in a month",
    monthsAgo: "{n} months ago",
    monthsLater: "in {n} months",
    yearAgo: "a year ago",
    yearLater: "in a year",
    yearsAgo: "{n} years ago",
    yearsLater: "in {n} years",
  },
  accuracy: {
    unverifiedYear: "BS {year} is not in the verified range ({through}). Confirm it against the Nepal Panchang Nirnayak Samiti calendar before relying on it.",
  },
  picker: {
    today: "Today",
    clear: "Clear",
    selectYear: "Select year",
    selectMonth: "Select month",
    previousMonth: "Previous month",
    nextMonth: "Next month",
  },
  phone: {
    empty: "Enter a phone number",
    tooShort: "Phone number is too short",
    tooLong: "Phone number is too long",
    badPrefix: "Phone number does not start with a valid prefix",
    inactivePrefix: "This phone number prefix is not in use",
    badCharacters: "Phone number contains invalid characters",
  },
  address: {
    ward: "Ward {n}",
    unknownProvince: "Unknown province",
    unknownDistrict: "Unknown district",
    unknownLocalLevel: "Unknown local level",
    badWard: "Ward number is not valid for this local level",
  },
  money: {
    empty: "Enter an amount",
    badFormat: "Amount is not a valid number",
    tooManyDecimals: "Amount can have at most two decimal places",
    outOfRange: "Amount is too large",
    invalidArgument: "Invalid amount",
  },
  words: {
    rupees: "Rupees",
    paisa: "Paisa",
    and: "and",
    only: "Only",
    minus: "Minus",
  },
  date: {
    parseError: "Could not read this date",
  },
  format: {
    gatePattern: "[BS] YYYY MMMM D",
    dualPattern: "{bs} (AD {ad})",
  },
  receipt: {
    invoice: "Invoice",
    receipt: "Receipt",
    quotation: "Quotation",
    creditNote: "Credit Note",
    subtotal: "Subtotal",
    discount: "Discount",
    taxable: "Taxable amount",
    vat: "VAT",
    total: "Total",
    paid: "Paid",
    balance: "Balance",
    dueDate: "Due date",
    amountInWords: "Amount in words",
    notes: "Notes",
    signature: "Signature",
    stampPaid: "PAID",
    stampCancelled: "CANCELLED",
  },
};

export const stringsNe: Strings = {
  months: ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कार्तिक", "मंसिर", "पौष", "माघ", "फागुन", "चैत्र"],
  monthsShort: ["बै", "जे", "अ", "सा", "भ", "अ", "का", "मं", "पौ", "मा", "फा", "चै"],
  weekdays: ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"],
  weekdaysShort: ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"],
  adMonths: ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"],
  adMonthsShort: ["जन", "फेब्रु", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अग", "सेप्टे", "अक्टो", "नोभे", "डिसे"],
  relative: {
    justNow: "हालै",
    secondsAgo: "{n} सेकेण्ड अगाडि",
    minutesAgo: "{n} मिनेट अगाडि",
    hoursAgo: "{n} घण्टा अगाडि",
    today: "आज",
    yesterday: "हिजो",
    tomorrow: "भोलि",
    daysAgo: "{n} दिन अघि",
    daysLater: "{n} दिनपछि",
    monthAgo: "१ महिना अघि",
    monthLater: "१ महिनापछि",
    monthsAgo: "{n} महिना अघि",
    monthsLater: "{n} महिनापछि",
    yearAgo: "१ वर्ष अघि",
    yearLater: "१ वर्षपछि",
    yearsAgo: "{n} वर्ष अघि",
    yearsLater: "{n} वर्षपछि",
  },
  accuracy: {
    unverifiedYear: "वि.सं. {year} प्रमाणित अवधि ({through}) भित्र पर्दैन। भरोसा गर्नुअघि नेपाल पञ्चाङ्ग निर्णायक समितिको पात्रोसँग मिलाउनुहोस्।",
  },
  picker: {
    today: "आज",
    clear: "हटाउनुहोस्",
    selectYear: "साल छान्नुहोस्",
    selectMonth: "महिना छान्नुहोस्",
    previousMonth: "अघिल्लो महिना",
    nextMonth: "अर्को महिना",
  },
  phone: {
    empty: "फोन नम्बर लेख्नुहोस्",
    tooShort: "फोन नम्बर धेरै छोटो छ",
    tooLong: "फोन नम्बर धेरै लामो छ",
    badPrefix: "फोन नम्बर मान्य प्रिफिक्सबाट सुरु भएको छैन",
    inactivePrefix: "यो फोन नम्बरको प्रिफिक्स प्रयोगमा छैन",
    badCharacters: "फोन नम्बरमा अमान्य अक्षर छन्",
  },
  address: {
    ward: "वडा नं. {n}",
    unknownProvince: "अज्ञात प्रदेश",
    unknownDistrict: "अज्ञात जिल्ला",
    unknownLocalLevel: "अज्ञात स्थानीय तह",
    badWard: "यो स्थानीय तहका लागि वडा नम्बर मान्य छैन",
  },
  money: {
    empty: "रकम राख्नुहोस्",
    badFormat: "रकम मान्य संख्या होइन",
    tooManyDecimals: "रकममा बढीमा दुई दशमलव स्थान हुन सक्छ",
    outOfRange: "रकम धेरै ठूलो छ",
    invalidArgument: "रकम मान्य छैन",
  },
  words: {
    rupees: "रुपैयाँ",
    paisa: "पैसा",
    and: "र",
    only: "मात्र",
    minus: "ऋण",
  },
  date: {
    parseError: "यो मिति पढ्न सकिएन",
  },
  format: {
    gatePattern: "YYYY [साल] MMMM D [गते]",
    dualPattern: "{bs} (ई.सं. {ad})",
  },
  receipt: {
    invoice: "बिजक",
    receipt: "रसिद",
    quotation: "कोटेशन",
    creditNote: "क्रेडिट नोट",
    subtotal: "उप-जम्मा",
    discount: "छुट",
    taxable: "करयोग्य रकम",
    vat: "मूल्य अभिवृद्धि कर",
    total: "जम्मा",
    paid: "तिरेको",
    balance: "बाँकी",
    dueDate: "भुक्तानी मिति",
    amountInWords: "अक्षरमा रकम",
    notes: "टिप्पणी",
    signature: "हस्ताक्षर",
    stampPaid: "भुक्तानी भयो",
    stampCancelled: "रद्द",
  },
};

/** Label table for a language. */
export function getStrings(language: Language): Strings {
  return language === 'ne' ? stringsNe : stringsEn;
}
