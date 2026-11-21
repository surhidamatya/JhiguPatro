/// A file-backed [ReminderStore] (guide 12.x, SMS reminders). Keeps every
/// reminder in one JSON file so a restarted process picks up where it stopped.
/// Import it separately (it uses `dart:io`, so it is not for the web):
/// `import 'package:jhigu_patro_utils/sms_file_store.dart';`
///
/// ```dart
/// final store = FileReminderStore('/var/lib/myapp/reminders.json');
/// final scheduler = ReminderScheduler(gateway: gateway, store: store);
/// ```
///
/// The file format is shared with the TypeScript `FileReminderStore`, so either
/// library can read a file written by the other (see `testdata/sms_store.json`):
/// `{ "version": 1, "reminders": [ ... ] }`, two-space indent, reminders sorted by
/// `id`, a fixed key order, `values` keys sorted, a final newline.
///
/// Guarantees and limits:
///  - Every write goes to a temporary file in the same directory, is flushed, then
///    renamed over the real file, so a crash never leaves a half-written file.
///    Dart cannot flush the directory itself, so after a power cut the very last
///    write can still be lost.
///  - Calls on one store object run one at a time, in order, so [loadAll] sees
///    every [save] that finished before it.
///  - One process only. Two processes (or two store objects) on one file can
///    overwrite each other's changes; there is no locking.
///  - A missing file is an empty store. A file that is not valid, or whose
///    reminders are not valid, is a [SmsStoreException]; it is never silently
///    reset. Errors never contain phone numbers or message values.
///  - The file holds phone numbers. Dart has no way to set file permissions, so
///    this store does not (the TypeScript one creates the file as 0600): keep it in
///    a folder only your service can read. A leftover `.tmp` file after a crash is
///    harmless and is not cleaned up.
///  - Fields this version does not know are dropped when a reminder is rewritten.
library;

import 'dart:convert';
import 'dart:io';

import 'jhigu_patro_utils.dart';

/// Why the store could not read or write.
enum SmsStoreErrorCode {
  corruptFile('CORRUPT_FILE'),
  unsupportedVersion('UNSUPPORTED_VERSION'),
  invalidReminder('INVALID_REMINDER'),
  readFailed('READ_FAILED'),
  writeFailed('WRITE_FAILED');

  const SmsStoreErrorCode(this.name_);

  /// Stable code shared with the TypeScript library.
  final String name_;
}

/// A store error. [message] is English and holds no personal data.
class SmsStoreException implements Exception {
  final SmsStoreErrorCode code;
  final String message;
  const SmsStoreException(this.code, this.message);

  @override
  String toString() => 'SmsStoreException(${code.name_}): $message';
}

const int _formatVersion = 1;
const int _maxSafeInt = 9007199254740991;

bool _isInt(Object? x, int lo, int hi) =>
    x is num && x.isFinite && x == x.truncateToDouble() && x >= lo && x <= hi;

Never _bad(String where, String field) => throw SmsStoreException(
    SmsStoreErrorCode.invalidReminder,
    '$where: field "$field" is missing or not valid');

SmsErrorCode? _errorCodeFrom(String s) {
  for (final c in SmsErrorCode.values) {
    if (c.name_ == s) return c;
  }
  return null;
}

/// Check one reminder read from a file (as decoded JSON). Throws
/// [SmsStoreErrorCode.invalidReminder] naming the position or field, never the value.
Reminder _fromJson(Object? input, String where) {
  if (input is! Map) {
    throw SmsStoreException(
        SmsStoreErrorCode.invalidReminder, '$where: not an object');
  }
  final id = input['id'];
  if (id is! String || id.isEmpty) _bad(where, 'id');
  final to = input['to'];
  if (to is! String) _bad(where, 'to');
  final templateKey = input['templateKey'];
  if (templateKey is! String) _bad(where, 'templateKey');
  final language = input['language'];
  if (language != 'ne' && language != 'en') _bad(where, 'language');
  final rawValues = input['values'];
  if (rawValues is! Map) _bad(where, 'values');
  final values = <String, Object?>{};
  for (final e in rawValues.entries) {
    final v = e.value;
    if (e.key is! String ||
        !(v == null || v is String || (v is num && v.isFinite))) {
      _bad(where, 'values');
    }
    values[e.key as String] = v;
  }
  final sd = input['sendDate'];
  if (sd is! Map ||
      !_isInt(sd['year'], 2000, 2100) ||
      !_isInt(sd['month'], 1, 12) ||
      !_isInt(sd['day'], 1, 32)) {
    _bad(where, 'sendDate');
  }
  final hour = input['hour'];
  if (!_isInt(hour, 0, 23)) _bad(where, 'hour');
  final minute = input['minute'];
  if (!_isInt(minute, 0, 59)) _bad(where, 'minute');
  ReminderStatus? status;
  for (final c in ReminderStatus.values) {
    if (c.name == input['status']) status = c;
  }
  if (status == null) _bad(where, 'status');
  final attempts = input['attempts'];
  if (!_isInt(attempts, 0, _maxSafeInt)) _bad(where, 'attempts');
  final retryAt = input['retryAt'];
  if (retryAt != null && !_isInt(retryAt, 0, _maxSafeInt)) {
    _bad(where, 'retryAt');
  }
  final providerId = input['providerId'];
  if (providerId != null && providerId is! String) _bad(where, 'providerId');
  final lastErrorText = input['lastError'];
  SmsErrorCode? lastError;
  if (lastErrorText != null) {
    lastError = lastErrorText is String ? _errorCodeFrom(lastErrorText) : null;
    if (lastError == null) _bad(where, 'lastError');
  }
  return Reminder(
    id: id,
    to: to,
    templateKey: templateKey,
    language: language as String,
    values: values,
    sendDate: NepaliDate(
      year: (sd['year'] as num).toInt(),
      month: (sd['month'] as num).toInt(),
      day: (sd['day'] as num).toInt(),
    ),
    hour: (hour as num).toInt(),
    minute: (minute as num).toInt(),
    status: status,
    attempts: (attempts as num).toInt(),
    retryAt: retryAt == null ? null : (retryAt as num).toInt(),
    providerId: providerId as String?,
    lastError: lastError,
  );
}

/// Check a reminder given to [FileReminderStore.save] and return a copy (values
/// copied, so later changes to the caller's map do not reach the file).
Reminder _checked(Reminder r, String where) {
  // Run the same checks as for a file by going through the JSON shape.
  return _fromJson(_toJson(r), where);
}

Map<String, Object?> _toJson(Reminder r) {
  final keys = r.values.keys.toList()..sort();
  return {
    'id': r.id,
    'to': r.to,
    'templateKey': r.templateKey,
    'language': r.language,
    'values': {for (final k in keys) k: r.values[k]},
    'sendDate': {
      'year': r.sendDate.year,
      'month': r.sendDate.month,
      'day': r.sendDate.day,
    },
    'hour': r.hour,
    'minute': r.minute,
    'status': r.status.name,
    'attempts': r.attempts,
    if (r.retryAt != null) 'retryAt': r.retryAt,
    if (r.providerId != null) 'providerId': r.providerId,
    if (r.lastError != null) 'lastError': r.lastError!.name_,
  };
}

/// The text of the file for these reminders (sorted by id, fixed key order).
String serializeReminders(Iterable<Reminder> reminders) {
  final sorted = reminders.toList()..sort((a, b) => a.id.compareTo(b.id));
  final doc = {
    'version': _formatVersion,
    'reminders': [for (final r in sorted) _toJson(r)],
  };
  return '${const JsonEncoder.withIndent('  ').convert(doc)}\n';
}

/// Parse and check the text of a store file. Throws [SmsStoreException].
List<Reminder> parseReminders(String text) {
  final Object? data;
  try {
    data = jsonDecode(text);
  } on FormatException {
    throw const SmsStoreException(
        SmsStoreErrorCode.corruptFile, 'the reminder file is not valid JSON');
  }
  if (data is! Map || data['reminders'] is! List) {
    throw const SmsStoreException(SmsStoreErrorCode.corruptFile,
        'the reminder file does not have a "reminders" list');
  }
  if (data['version'] != _formatVersion) {
    throw const SmsStoreException(SmsStoreErrorCode.unsupportedVersion,
        'the reminder file has an unsupported version');
  }
  final seen = <String>{};
  final out = <Reminder>[];
  final list = data['reminders'] as List;
  for (var i = 0; i < list.length; i++) {
    final r = _fromJson(list[i], 'reminder #${i + 1}');
    if (!seen.add(r.id)) {
      throw SmsStoreException(SmsStoreErrorCode.invalidReminder,
          'reminder #${i + 1}: duplicate id');
    }
    out.add(r);
  }
  return out;
}

int _tmpCounter = 0;

class FileReminderStore implements ReminderStore {
  final String path;
  Future<void> _chain = Future<void>.value();

  /// [path] is the JSON file. Its folder is created on the first write.
  FileReminderStore(this.path) {
    if (path.isEmpty) throw ArgumentError('path must not be empty');
  }

  @override
  Future<List<Reminder>> loadAll() => _enqueue(_read);

  @override
  Future<void> save(Reminder reminder) async {
    // `async` so a bad reminder is a failed future, not an exception thrown at
    // the call site.
    final clean = _checked(reminder, 'reminder');
    await _enqueue(() async {
      final all = (await _read()).where((r) => r.id != clean.id).toList()
        ..add(clean);
      await _write(all);
    });
  }

  @override
  Future<void> delete(String id) => _enqueue(() async {
        final all = await _read();
        final rest = all.where((r) => r.id != id).toList();
        if (rest.length != all.length) await _write(rest);
      });

  /// Run [job] after every earlier call has finished, whether it worked or not.
  Future<T> _enqueue<T>(Future<T> Function() job) {
    final run = _chain.then((_) => job(), onError: (_) => job());
    _chain = run.then<void>((_) {}, onError: (_) {});
    return run;
  }

  Future<List<Reminder>> _read() async {
    final file = File(path);
    final List<int> bytes;
    try {
      final type = await FileSystemEntity.type(path);
      if (type == FileSystemEntityType.notFound) return [];
      // A folder (or anything else that is not a file) is not an empty store.
      if (type != FileSystemEntityType.file) {
        throw const SmsStoreException(SmsStoreErrorCode.readFailed,
            'the reminder file could not be read');
      }
      bytes = await file.readAsBytes();
    } on FileSystemException {
      throw const SmsStoreException(
          SmsStoreErrorCode.readFailed, 'the reminder file could not be read');
    }
    final String text;
    try {
      // Strict: bytes that are not UTF-8 are an error, and so is a byte order
      // mark (Dart's decoder would strip it silently; the TypeScript store and
      // the JSON parser reject it).
      if (bytes.length >= 3 &&
          bytes[0] == 0xef &&
          bytes[1] == 0xbb &&
          bytes[2] == 0xbf) {
        throw const FormatException('byte order mark');
      }
      text = const Utf8Decoder(allowMalformed: false).convert(bytes);
    } on FormatException {
      throw const SmsStoreException(SmsStoreErrorCode.corruptFile,
          'the reminder file is not valid UTF-8');
    }
    return parseReminders(text);
  }

  Future<void> _write(List<Reminder> reminders) async {
    final target = File(path);
    final dir = target.parent;
    final name = target.uri.pathSegments.last;
    final tmp = File(
        '${dir.path}${Platform.pathSeparator}.$name.$pid.${_tmpCounter++}.tmp');
    try {
      await dir.create(recursive: true);
      await tmp.writeAsString(serializeReminders(reminders), flush: true);
      await tmp.rename(path);
    } on FileSystemException {
      try {
        if (await tmp.exists()) await tmp.delete();
      } on FileSystemException {
        // Nothing more to do; the real file is untouched.
      }
      throw const SmsStoreException(SmsStoreErrorCode.writeFailed,
          'the reminder file could not be written');
    }
  }
}
