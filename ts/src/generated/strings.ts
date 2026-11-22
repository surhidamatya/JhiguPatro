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
    readonly required: string;
    readonly placeholder: string;
    readonly noEvents: string;
    readonly tithi: string;
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
    readonly province: string;
    readonly district: string;
    readonly localLevel: string;
    readonly wardLabel: string;
    readonly choose: string;
    readonly required: string;
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
    readonly emptyNumber: string;
    readonly noLines: string;
    readonly emptyDescription: string;
    readonly badQuantity: string;
    readonly badUnitPrice: string;
    readonly badDiscount: string;
    readonly badVatRate: string;
    readonly badPaid: string;
    readonly dueBeforeIssue: string;
    readonly pan: string;
    readonly vatNo: string;
    readonly phone: string;
    readonly billTo: string;
    readonly number: string;
    readonly date: string;
    readonly description: string;
    readonly quantity: string;
    readonly rate: string;
    readonly amount: string;
    readonly overpaid: string;
  };
  readonly sms: {
    readonly auth: string;
    readonly balance: string;
    readonly badNumber: string;
    readonly rateLimit: string;
    readonly server: string;
    readonly network: string;
    readonly unknown: string;
    readonly badTemplate: string;
    readonly missingValue: string;
    readonly unknownTemplate: string;
  };
  readonly smsTemplates: {
    readonly rentDue: string;
    readonly udhaaro: string;
    readonly appointment: string;
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
    required: "Select a date",
    placeholder: "Select a date",
    noEvents: "No events",
    tithi: "Tithi",
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
    province: "Province",
    district: "District",
    localLevel: "Local level",
    wardLabel: "Ward",
    choose: "Select",
    required: "Select an address",
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
    emptyNumber: "Document number is required.",
    noLines: "At least one line is required.",
    emptyDescription: "Line description is required.",
    badQuantity: "Quantity must be a positive whole number of thousandths.",
    badUnitPrice: "Unit price must not be negative.",
    badDiscount: "Discount is invalid or larger than the total.",
    badVatRate: "VAT rate must be 0 to 10000 basis points.",
    badPaid: "Paid amount must not be negative.",
    dueBeforeIssue: "Due date is before the issue date.",
    pan: "PAN",
    vatNo: "VAT No.",
    phone: "Phone",
    billTo: "Bill to",
    number: "No.",
    date: "Date",
    description: "Description",
    quantity: "Qty",
    rate: "Rate",
    amount: "Amount",
    overpaid: "Overpaid",
  },
  sms: {
    auth: "The SMS gateway rejected the credentials.",
    balance: "The SMS gateway account has insufficient balance.",
    badNumber: "The phone number was rejected.",
    rateLimit: "The SMS gateway rate limit was reached.",
    server: "The SMS gateway had a server error.",
    network: "The SMS gateway could not be reached.",
    unknown: "The SMS could not be sent.",
    badTemplate: "The message template could not be rendered.",
    missingValue: "A value for a template placeholder is missing.",
    unknownTemplate: "Unknown SMS template.",
  },
  smsTemplates: {
    rentDue: "Dear {name}, your rent of {amount} for {month} is due on {dueDate}. Please pay on time. - {sender}",
    udhaaro: "Dear {name}, you owe {amount}. Please clear the balance by {dueDate}. - {sender}",
    appointment: "Dear {name}, reminder: your appointment is on {date} at {time}. - {sender}",
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
    required: "मिति छान्नुहोस्",
    placeholder: "मिति छान्नुहोस्",
    noEvents: "कुनै कार्यक्रम छैन",
    tithi: "तिथि",
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
    province: "प्रदेश",
    district: "जिल्ला",
    localLevel: "स्थानीय तह",
    wardLabel: "वडा",
    choose: "छान्नुहोस्",
    required: "ठेगाना छान्नुहोस्",
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
    emptyNumber: "कागजात नम्बर आवश्यक छ।",
    noLines: "कम्तीमा एउटा लाइन आवश्यक छ।",
    emptyDescription: "लाइनको विवरण आवश्यक छ।",
    badQuantity: "परिमाण हजारौं भागमा धनात्मक पूर्णांक हुनुपर्छ।",
    badUnitPrice: "एकाइ मूल्य ऋणात्मक हुनु हुँदैन।",
    badDiscount: "छुट अमान्य छ वा जम्माभन्दा ठूलो छ।",
    badVatRate: "भ्याट दर ० देखि १०००० बेसिस प्वाइन्टबीच हुनुपर्छ।",
    badPaid: "तिरेको रकम ऋणात्मक हुनु हुँदैन।",
    dueBeforeIssue: "भुक्तानी मिति जारी मितिभन्दा अगाडि छ।",
    pan: "प्यान",
    vatNo: "भ्याट नं.",
    phone: "फोन",
    billTo: "ग्राहक",
    number: "नं.",
    date: "मिति",
    description: "विवरण",
    quantity: "परिमाण",
    rate: "दर",
    amount: "रकम",
    overpaid: "बढी भुक्तानी",
  },
  sms: {
    auth: "एसएमएस गेटवेले प्रमाणहरू अस्वीकार गर्‍यो।",
    balance: "एसएमएस गेटवे खातामा पर्याप्त ब्यालेन्स छैन।",
    badNumber: "फोन नम्बर अस्वीकृत भयो।",
    rateLimit: "एसएमएस गेटवेको दर सीमा पुग्यो।",
    server: "एसएमएस गेटवेमा सर्भर त्रुटि भयो।",
    network: "एसएमएस गेटवेमा पुग्न सकिएन।",
    unknown: "एसएमएस पठाउन सकिएन।",
    badTemplate: "सन्देश ढाँचा तयार गर्न सकिएन।",
    missingValue: "ढाँचाको एउटा प्लेसहोल्डरको मान छैन।",
    unknownTemplate: "अज्ञात एसएमएस ढाँचा।",
  },
  smsTemplates: {
    rentDue: "आदरणीय {name}, {month} को तपाईंको कोठा भाडा {amount} {dueDate} सम्म तिर्न बाँकी छ। कृपया समयमै तिर्नुहोला। - {sender}",
    udhaaro: "आदरणीय {name}, तपाईंले {amount} उधारो तिर्न बाँकी छ। कृपया {dueDate} सम्म चुक्ता गर्नुहोला। - {sender}",
    appointment: "आदरणीय {name}, सम्झना: तपाईंको अपोइन्टमेन्ट {date} मा {time} बजे छ। - {sender}",
  },
};

/** Label table for a language. */
export function getStrings(language: Language): Strings {
  return language === 'ne' ? stringsNe : stringsEn;
}
