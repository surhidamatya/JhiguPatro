// GENERATED FILE. DO NOT EDIT. Source: data/phone-prefixes.json. Run: node tools/gen-data/gen.mjs
// ignore_for_file: lines_longer_than_80_chars

/// A mobile prefix and its carrier.
class PhoneMobilePrefix {
  final String prefix;
  final String? carrier;
  final bool active;
  const PhoneMobilePrefix(this.prefix, this.carrier, {required this.active});
}

/// A landline area code and known places (best effort).
class PhoneAreaCode {
  final String code;
  final List<String> places;
  const PhoneAreaCode(this.code, this.places);
}

/// Best-effort data; see data/PHONE_NOTES.md.
const bool phoneBestEffort = true;
const int phoneMobileLength = 10;
const int phoneLandlineLength = 8;
const String phoneFormatMobile = 'ddd-ddddddd';
const String phoneFormatLandlineKathmandu = 'd-ddddddd';
const String phoneFormatLandlineOther = 'dd-dddddd';

const List<PhoneMobilePrefix> phoneMobilePrefixes = [
  PhoneMobilePrefix('970', 'Ncell', active: true),
  PhoneMobilePrefix('971', 'Ncell', active: true),
  PhoneMobilePrefix('980', 'Ncell', active: true),
  PhoneMobilePrefix('981', 'Ncell', active: true),
  PhoneMobilePrefix('982', 'Ncell', active: true),
  PhoneMobilePrefix('974', 'NTC', active: true),
  PhoneMobilePrefix('975', 'NTC', active: true),
  PhoneMobilePrefix('976', 'NTC', active: true),
  PhoneMobilePrefix('984', 'NTC', active: true),
  PhoneMobilePrefix('985', 'NTC', active: true),
  PhoneMobilePrefix('986', 'NTC', active: true),
  PhoneMobilePrefix('961', 'Smart Telecom', active: false),
  PhoneMobilePrefix('962', 'Smart Telecom', active: false),
  PhoneMobilePrefix('988', 'Smart Telecom', active: false),
  PhoneMobilePrefix('972', 'UTL', active: false),
  PhoneMobilePrefix('963', 'Hello Mobile', active: false),
  PhoneMobilePrefix('900', null, active: false),
  PhoneMobilePrefix('960', null, active: false),
];

const List<PhoneAreaCode> phoneAreaCodes = [
  PhoneAreaCode('1', ['Bhaktapur', 'Kathmandu', 'Lalitpur', 'Patan']),
  PhoneAreaCode('10', ['Bidur', 'Dhading', 'Rasuwa', 'Trishuli']),
  PhoneAreaCode('11', ['Banepa']),
  PhoneAreaCode('21', ['Biratnagar', 'Itahari', 'Morang', 'Rangeli']),
  PhoneAreaCode('23', ['Bhadrapur', 'Birtamod', 'Damak']),
  PhoneAreaCode('24', ['Panchthar', 'Phidim', 'Taplejung']),
  PhoneAreaCode('25', ['Dharan', 'Duhabi', 'Inaruwa']),
  PhoneAreaCode('26', ['Dhankuta', 'Terathum']),
  PhoneAreaCode('27', ['Ilam']),
  PhoneAreaCode('29', ['Bhojpur', 'Khadbari', 'Sankhuwasava']),
  PhoneAreaCode('31', ['Rajbiraj']),
  PhoneAreaCode('33', ['Lahan', 'Siraha']),
  PhoneAreaCode('35', ['Gaighat', 'Katari', 'Udaipur']),
  PhoneAreaCode('36', ['Khotang']),
  PhoneAreaCode('37', ['Okhaldhunga']),
  PhoneAreaCode('38', []),
  PhoneAreaCode('41', ['Janakpur']),
  PhoneAreaCode('44', ['Jaleshwar']),
  PhoneAreaCode('46', ['Malangawa']),
  PhoneAreaCode('47', ['Sindhuli']),
  PhoneAreaCode('48', ['Ramechap']),
  PhoneAreaCode('49', ['Charikot']),
  PhoneAreaCode('51', ['Birgung']),
  PhoneAreaCode('53', ['Kalaiya', 'Simra']),
  PhoneAreaCode('55', ['Gaur']),
  PhoneAreaCode('56', ['Bharatpur', 'Chitwan', 'Tandi']),
  PhoneAreaCode('57', ['Bhimphedi', 'Hetauda']),
  PhoneAreaCode('61', ['Pokhara']),
  PhoneAreaCode('63', ['Syanja']),
  PhoneAreaCode('64', ['Gorkha']),
  PhoneAreaCode('65', ['Damauli']),
  PhoneAreaCode('66', ['Besisahar', 'Lumjung']),
  PhoneAreaCode('67', ['Khusma']),
  PhoneAreaCode('68', ['Baglung']),
  PhoneAreaCode('69', ['Beni', 'Myagdi']),
  PhoneAreaCode('71', ['Bhairawaha', 'Bhairahawa', 'Butwal', 'Chhotkram Nager', 'Lumbini']),
  PhoneAreaCode('75', ['Palpa', 'Tansen']),
  PhoneAreaCode('76', ['Krishnanagar', 'Taulihawa']),
  PhoneAreaCode('77', ['Arghakhanchi', 'Sandikharka']),
  PhoneAreaCode('78', ['Bairghat', 'Nawalparasi', 'Parasi', 'Tribeni']),
  PhoneAreaCode('79', ['Gulmi']),
  PhoneAreaCode('81', ['Nepalgunj']),
  PhoneAreaCode('82', ['Dang', 'Ghorahi', 'Tulsipur']),
  PhoneAreaCode('83', ['Surkhet']),
  PhoneAreaCode('84', ['Bardiya', 'Guleria', 'Rajpur']),
  PhoneAreaCode('86', []),
  PhoneAreaCode('87', []),
  PhoneAreaCode('88', []),
  PhoneAreaCode('89', []),
  PhoneAreaCode('91', ['Bhajani', 'Dhangadi', 'Tikapur']),
  PhoneAreaCode('92', []),
  PhoneAreaCode('93', ['Darchula']),
  PhoneAreaCode('94', ['Dipayal', 'Doti']),
  PhoneAreaCode('95', []),
  PhoneAreaCode('96', ['Dadheldhura']),
  PhoneAreaCode('97', ['Achham']),
  PhoneAreaCode('99', ['Dodharachadani', 'Mahendranagar']),
];
