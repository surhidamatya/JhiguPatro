/// Typed errors for dates and calendar data (guide 7.9).
library;

import 'generated/strings.dart';

/// Base of the four calendar error kinds. Match on the subclass or on [code].
sealed class JhiguException implements Exception {
  /// Stable code shared with the TypeScript library.
  final String code;

  /// English message.
  final String message;

  /// The offending input (for [ParseException], the original text).
  final Object? details;

  const JhiguException(this.code, this.message, [this.details]);

  /// User-facing message for [ParseException] in [language] (`'ne'` or
  /// `'en'`); other kinds return [message].
  String localized(String language) =>
      this is ParseException ? getStrings(language).date.parseError : message;

  @override
  String toString() => 'JhiguException($code): $message';
}

final class OutOfRangeException extends JhiguException {
  const OutOfRangeException(String message, [Object? details])
      : super('OUT_OF_RANGE', message, details);
}

final class InvalidDateException extends JhiguException {
  const InvalidDateException(String message, [Object? details])
      : super('INVALID_DATE', message, details);
}

final class InvalidDataException extends JhiguException {
  const InvalidDataException(String message, [Object? details])
      : super('INVALID_DATA', message, details);
}

final class ParseException extends JhiguException {
  const ParseException(String message, [Object? details])
      : super('PARSE_ERROR', message, details);
}
