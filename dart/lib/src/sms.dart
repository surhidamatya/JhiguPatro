/// SMS reminders (guide section 13), gateway-agnostic.
///
/// This library does not talk to any SMS provider. You choose the gateway:
/// implement [SmsGateway] yourself, or wrap your own send function with
/// [CallbackSmsGateway]. No network code, no provider endpoints, no logging of
/// message text or phone numbers.
///
/// Parts: [SmsGateway] and typed [SmsErrorCode]s, [CallbackSmsGateway] and
/// [MockSmsGateway], templates with a `{placeholder}` renderer, [smsSegments],
/// and [ReminderScheduler] with retries and a pluggable [ReminderStore].
library;

import 'dart:async';

import 'generated/strings.dart';
import 'types.dart';

// ── Errors ───────────────────────────────────────────────────────────────────

enum SmsErrorCode {
  auth('AUTH'),
  balance('BALANCE'),
  badNumber('BAD_NUMBER'),
  rateLimit('RATE_LIMIT'),
  server('SERVER'),
  network('NETWORK'),
  unknown('UNKNOWN'),
  badTemplate('BAD_TEMPLATE');

  const SmsErrorCode(this.name_);

  /// Stable code shared with the TypeScript library.
  final String name_;
}

/// Why a message was not sent. Gateway adapters map their provider's errors to
/// one of these codes. [message] is English and never contains the number or text.
class SmsException implements Exception {
  final SmsErrorCode code;
  const SmsException(this.code);

  String get message => localized('en');

  String localized(String language) {
    final s = getStrings(language).sms;
    return switch (code) {
      SmsErrorCode.auth => s.auth,
      SmsErrorCode.balance => s.balance,
      SmsErrorCode.badNumber => s.badNumber,
      SmsErrorCode.rateLimit => s.rateLimit,
      SmsErrorCode.server => s.server,
      SmsErrorCode.network => s.network,
      SmsErrorCode.unknown => s.unknown,
      SmsErrorCode.badTemplate => s.badTemplate,
    };
  }

  @override
  String toString() => 'SmsException(${code.name_}): $message';
}

enum SmsTemplateErrorCode {
  missingValue('MISSING_VALUE'),
  unknownTemplate('UNKNOWN_TEMPLATE');

  const SmsTemplateErrorCode(this.name_);
  final String name_;
}

/// Typed template error. For missing values, [key] is the placeholder name.
class SmsTemplateException implements Exception {
  final SmsTemplateErrorCode code;
  final String? key;
  const SmsTemplateException(this.code, [this.key]);

  String get message => localized('en');

  String localized(String language) {
    final s = getStrings(language).sms;
    return code == SmsTemplateErrorCode.missingValue
        ? s.missingValue
        : s.unknownTemplate;
  }

  @override
  String toString() => 'SmsTemplateException(${code.name_}): $message';
}

// ── Gateway ──────────────────────────────────────────────────────────────────

class SmsMessage {
  /// Destination in E.164 form, for example `+9779841234567`.
  final String toE164;
  final String text;

  /// Your own id; the scheduler uses the reminder id.
  final String? reference;
  const SmsMessage({required this.toE164, required this.text, this.reference});
}

class SmsResult {
  final bool ok;

  /// The gateway's own message id, if it gives one.
  final String? providerId;
  final SmsException? error;

  const SmsResult.success({this.providerId})
      : ok = true,
        error = null;

  SmsResult.failure(SmsErrorCode code)
      : ok = false,
        providerId = null,
        error = SmsException(code);
}

abstract class SmsGateway {
  Future<SmsResult> send(SmsMessage message);

  /// Results are in the same order as [messages], one per message.
  Future<List<SmsResult>> sendBulk(List<SmsMessage> messages);
}

final RegExp _e164 = RegExp(r'^\+[1-9][0-9]{7,14}$');

/// True for `+` followed by 8 to 15 digits, the first not zero.
bool isE164(String text) => _e164.hasMatch(text);

SmsResult _fromThrown(Object e) => SmsResult.failure(
      e is SmsException ? e.code : SmsErrorCode.unknown,
    );

/// Gateway built from your own functions, so any provider (or your own server)
/// can be used. A function that throws gives an `unknown` error result (or the
/// code of a thrown [SmsException]); a batch that returns the wrong number of
/// results gives `unknown` for the whole batch. Bulk results keep input order.
class CallbackSmsGateway implements SmsGateway {
  /// Send one message with your provider. Return a result, or throw.
  final Future<SmsResult> Function(SmsMessage message) sendOne;

  /// Optional: send several messages in one provider call. Must return one
  /// result per message, in order. Without it, [sendBulk] calls [sendOne] one
  /// by one.
  final Future<List<SmsResult>> Function(List<SmsMessage> messages)? sendBatch;

  /// With [sendBatch]: split bulk sends into batches of at most this size.
  final int? maxBatchSize;

  CallbackSmsGateway({
    required this.sendOne,
    this.sendBatch,
    this.maxBatchSize,
  }) {
    final m = maxBatchSize;
    if (m != null && m < 1) {
      throw ArgumentError('maxBatchSize must be a positive integer');
    }
  }

  @override
  Future<SmsResult> send(SmsMessage message) async {
    try {
      return await sendOne(message);
    } catch (e) {
      return _fromThrown(e);
    }
  }

  @override
  Future<List<SmsResult>> sendBulk(List<SmsMessage> messages) async {
    final batch = sendBatch;
    if (batch == null) {
      final out = <SmsResult>[];
      for (final m in messages) {
        out.add(await send(m));
      }
      return out;
    }
    final size = maxBatchSize ?? (messages.isEmpty ? 1 : messages.length);
    final out = <SmsResult>[];
    for (var i = 0; i < messages.length; i += size) {
      final end = i + size < messages.length ? i + size : messages.length;
      final chunk = messages.sublist(i, end);
      List<SmsResult> results;
      try {
        results = await batch(chunk);
        if (results.length != chunk.length) {
          results = [
            for (final _ in chunk) SmsResult.failure(SmsErrorCode.unknown),
          ];
        }
      } catch (e) {
        results = [for (final _ in chunk) _fromThrown(e)];
      }
      out.addAll(results);
    }
    return out;
  }
}

/// Gateway for tests and demos. Sent messages are stored in [sent]; every call
/// is stored in [attempts]. Make sends fail with [failNext] (any message) or
/// [failFor] (a message with a given `reference`, one code per attempt).
class MockSmsGateway implements SmsGateway {
  /// Messages accepted, in order.
  final List<SmsMessage> sent = [];

  /// Every message passed to [send] or [sendBulk], in order, including failures.
  final List<SmsMessage> attempts = [];
  int _counter = 0;
  final List<SmsErrorCode> _next = [];
  final Map<String, List<SmsErrorCode>> _byReference = {};

  /// The next [count] sends fail with [code].
  void failNext(SmsErrorCode code, {int count = 1}) {
    for (var i = 0; i < count; i++) {
      _next.add(code);
    }
  }

  /// Successive sends of messages with this reference fail with these codes, in order.
  void failFor(String reference, List<SmsErrorCode> codes) {
    _byReference[reference] = [...codes];
  }

  @override
  Future<SmsResult> send(SmsMessage message) async {
    attempts.add(message);
    final ref = message.reference;
    final queued = ref == null ? null : _byReference[ref];
    final SmsErrorCode? code = (queued != null && queued.isNotEmpty)
        ? queued.removeAt(0)
        : (_next.isNotEmpty ? _next.removeAt(0) : null);
    if (code != null) return SmsResult.failure(code);
    if (!isE164(message.toE164))
      return SmsResult.failure(SmsErrorCode.badNumber);
    sent.add(message);
    _counter += 1;
    return SmsResult.success(providerId: 'mock-$_counter');
  }

  @override
  Future<List<SmsResult>> sendBulk(List<SmsMessage> messages) async {
    final out = <SmsResult>[];
    for (final m in messages) {
      out.add(await send(m));
    }
    return out;
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

/// Built-in template keys. Their text is in the strings tables (`smsTemplates`).
const List<String> smsTemplateKeys = ['rentDue', 'udhaaro', 'appointment'];

final RegExp _placeholder = RegExp(r'\{([A-Za-z0-9_]+)\}');

/// Placeholder names in a template, each once, in order of first appearance.
List<String> templatePlaceholders(String text) {
  final seen = <String>{};
  for (final m in _placeholder.allMatches(text)) {
    seen.add(m.group(1)!);
  }
  return seen.toList();
}

/// Replace every `{key}` with its value in one pass: a value that itself
/// contains `{x}` is not expanded. A key counts as missing when its value is
/// absent or null; an empty string is a value. Extra values are ignored. With
/// [strict] (the default) a missing value throws [SmsTemplateException];
/// otherwise it becomes empty text. Text outside placeholders is kept as is.
String renderTemplate(
  String text,
  Map<String, Object?> values, {
  bool strict = true,
}) {
  return text.replaceAllMapped(_placeholder, (m) {
    final key = m.group(1)!;
    final v = values[key];
    if (v == null) {
      if (strict) {
        throw SmsTemplateException(SmsTemplateErrorCode.missingValue, key);
      }
      return '';
    }
    return v.toString();
  });
}

/// The raw template text, or throws [SmsTemplateException] (unknown template).
String getSmsTemplate(String key, String language) {
  final t = getStrings(language).smsTemplates;
  return switch (key) {
    'rentDue' => t.rentDue,
    'udhaaro' => t.udhaaro,
    'appointment' => t.appointment,
    _ => throw const SmsTemplateException(SmsTemplateErrorCode.unknownTemplate),
  };
}

/// Render a built-in template in a language (`'ne'` or `'en'`).
String renderSmsTemplate(
  String key,
  String language,
  Map<String, Object?> values, {
  bool strict = true,
}) =>
    renderTemplate(getSmsTemplate(key, language), values, strict: strict);

// ── Segments ─────────────────────────────────────────────────────────────────

// GSM 03.38 (3GPP TS 23.038) default alphabet, and the extension table whose
// characters take two units. Written from the standard's tables; not checked
// against a carrier. National language shift tables are not used.
const String _gsmBasic =
    '@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const String _gsmExtension = '\f^{}\\[~]|€';

final Set<int> _gsmBasicSet = _gsmBasic.runes.where((r) => r != 0x1b).toSet();
final Set<int> _gsmExtSet = _gsmExtension.runes.toSet();

enum SmsEncoding { gsm7, ucs2 }

class SmsSegments {
  /// `gsm7` if every character is in the GSM alphabet, else `ucs2` (all Nepali text).
  final SmsEncoding encoding;

  /// Length in encoding units: GSM characters (extension characters count 2) or UTF-16 units.
  final int units;

  /// Number of SMS parts; 0 for empty text.
  final int segments;

  /// Units one part holds in this message: 160/153 (gsm7) or 70/67 (ucs2).
  final int perSegment;
  const SmsSegments(this.encoding, this.units, this.segments, this.perSegment);
}

int _ceilDiv(int a, int b) => (a + b - 1) ~/ b;

/// Estimate the parts a message needs. One part holds 160 GSM characters or 70
/// UCS-2 characters; in a multi-part message each part holds 153 or 67 because
/// of the concatenation header. An estimate only: carriers may split
/// differently (for example around an extension character or a surrogate pair).
SmsSegments smsSegments(String text) {
  var gsm = 0;
  var isGsm = true;
  for (final r in text.runes) {
    if (_gsmBasicSet.contains(r)) {
      gsm += 1;
    } else if (_gsmExtSet.contains(r)) {
      gsm += 2;
    } else {
      isGsm = false;
      break;
    }
  }
  if (isGsm) {
    final segments = gsm == 0 ? 0 : (gsm <= 160 ? 1 : _ceilDiv(gsm, 153));
    return SmsSegments(SmsEncoding.gsm7, gsm, segments, gsm <= 160 ? 160 : 153);
  }
  final units = text.length; // UTF-16 code units
  return SmsSegments(
    SmsEncoding.ucs2,
    units,
    units <= 70 ? 1 : _ceilDiv(units, 67),
    units <= 70 ? 70 : 67,
  );
}

// ── Reminders ────────────────────────────────────────────────────────────────

enum ReminderStatus { pending, sent, failed }

class Reminder {
  final String id;

  /// E.164 destination.
  final String to;

  /// A built-in template key (`rentDue`, `udhaaro`, `appointment`).
  final String templateKey;

  /// `'ne'` or `'en'`.
  final String language;
  final Map<String, Object?> values;

  /// BS send date, Nepal time.
  final NepaliDate sendDate;

  /// 0..23, Nepal time.
  final int hour;

  /// 0..59.
  final int minute;
  final ReminderStatus status;

  /// Number of send attempts so far.
  final int attempts;

  /// Epoch ms before which a retry must not run; set after a failed attempt.
  final int? retryAt;

  /// Set when sent.
  final String? providerId;

  /// Code of the last failure.
  final SmsErrorCode? lastError;

  const Reminder({
    required this.id,
    required this.to,
    required this.templateKey,
    required this.language,
    required this.values,
    required this.sendDate,
    required this.hour,
    required this.minute,
    this.status = ReminderStatus.pending,
    this.attempts = 0,
    this.retryAt,
    this.providerId,
    this.lastError,
  });

  /// A copy with new status fields. [retryAt], [providerId] and [lastError]
  /// are replaced as given, so `null` clears them.
  Reminder withState({
    required ReminderStatus status,
    required int attempts,
    int? retryAt,
    String? providerId,
    SmsErrorCode? lastError,
  }) =>
      Reminder(
        id: id,
        to: to,
        templateKey: templateKey,
        language: language,
        values: values,
        sendDate: sendDate,
        hour: hour,
        minute: minute,
        status: status,
        attempts: attempts,
        retryAt: retryAt,
        providerId: providerId,
        lastError: lastError,
      );
}

abstract class ReminderStore {
  Future<List<Reminder>> loadAll();
  Future<void> save(Reminder reminder);
  Future<void> delete(String id);
}

/// Keeps reminders in memory. For tests, demos and short-lived processes.
class InMemoryReminderStore implements ReminderStore {
  final Map<String, Reminder> _items = {};

  @override
  Future<List<Reminder>> loadAll() async => _items.values.toList();

  @override
  Future<void> save(Reminder reminder) async {
    _items[reminder.id] = reminder;
  }

  @override
  Future<void> delete(String id) async {
    _items.remove(id);
  }
}

// Nepal is UTC+05:45 all year.
const int _nepalOffsetMin = 345;

/// Epoch milliseconds at which a reminder is first due (its Nepal-time send moment).
int reminderSendAt(NepaliDate sendDate, int hour, int minute) =>
    (sendDate.dayNumber * 1440 + hour * 60 + minute - _nepalOffsetMin) * 60000;

/// Result of one [ReminderScheduler.runOnce] pass.
class RunSummary {
  /// Reminders that were due.
  final int due;
  final int sent;

  /// Failed now and scheduled for another attempt.
  final int retrying;

  /// Marked failed now.
  final int failed;
  const RunSummary(this.due, this.sent, this.retrying, this.failed);

  @override
  bool operator ==(Object other) =>
      other is RunSummary &&
      other.due == due &&
      other.sent == sent &&
      other.retrying == retrying &&
      other.failed == failed;

  @override
  int get hashCode => Object.hash(due, sent, retrying, failed);

  @override
  String toString() =>
      'RunSummary(due: $due, sent: $sent, retrying: $retrying, failed: $failed)';
}

/// Sends due reminders through your gateway. Only runs while your process
/// runs: for real use call [runOnce] from a server job or cron. Delivery is
/// at-least-once: if the process stops after the gateway accepts a message and
/// before the store saves, that reminder can be sent again.
class ReminderScheduler {
  final SmsGateway gateway;
  final ReminderStore store;

  /// Current time in epoch ms.
  final int Function() clock;

  /// Wait before retry n (1-based); the last value repeats.
  final List<num> backoffMinutes;

  /// Attempts before a reminder is marked failed (first try plus retries).
  final int maxAttempts;

  /// Error codes that fail a reminder at once without retry.
  final Set<SmsErrorCode> permanentErrors;

  /// Timer period for [start].
  final Duration interval;

  bool _running = false;
  Timer? _timer;

  ReminderScheduler({
    required this.gateway,
    required this.store,
    int Function()? clock,
    this.backoffMinutes = const [1, 5, 30],
    this.maxAttempts = 4,
    Set<SmsErrorCode>? permanentErrors,
    this.interval = const Duration(minutes: 1),
  })  : clock = clock ?? (() => DateTime.now().millisecondsSinceEpoch),
        permanentErrors = permanentErrors ?? {SmsErrorCode.badNumber} {
    if (backoffMinutes.isEmpty || backoffMinutes.any((m) => !(m >= 0))) {
      throw ArgumentError('backoffMinutes must be non-negative numbers');
    }
    if (maxAttempts < 1) {
      throw ArgumentError('maxAttempts must be a positive integer');
    }
  }

  /// Run [runOnce] every [interval]. Does nothing if already started.
  void start() {
    if (_timer != null) return;
    _timer = Timer.periodic(interval, (_) {
      runOnce().catchError((_) => const RunSummary(0, 0, 0, 0));
    });
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  /// One pass: send every pending reminder that is due (send moment reached and
  /// any retry time passed), oldest first. A pass that starts while another is
  /// running returns at once with zero counts.
  Future<RunSummary> runOnce() async {
    if (_running) return const RunSummary(0, 0, 0, 0);
    _running = true;
    try {
      final now = clock();
      final candidates = <({Reminder r, int at})>[];
      for (final r in await store.loadAll()) {
        if (r.status != ReminderStatus.pending) continue;
        final sendAt = reminderSendAt(r.sendDate, r.hour, r.minute);
        final retry = r.retryAt ?? 0;
        final at = sendAt > retry ? sendAt : retry;
        if (at <= now) candidates.add((r: r, at: at));
      }
      candidates.sort((a, b) {
        final c = a.at.compareTo(b.at);
        return c != 0 ? c : a.r.id.compareTo(b.r.id);
      });

      var sent = 0, retrying = 0, failed = 0;
      final toSend = <({Reminder r, SmsMessage message})>[];
      for (final c in candidates) {
        final r = c.r;
        if (!isE164(r.to)) {
          await _finishFailed(r, SmsErrorCode.badNumber);
          failed++;
          continue;
        }
        final String text;
        try {
          text = renderSmsTemplate(r.templateKey, r.language, r.values);
        } on SmsTemplateException {
          await _finishFailed(r, SmsErrorCode.badTemplate);
          failed++;
          continue;
        }
        toSend.add((
          r: r,
          message: SmsMessage(toE164: r.to, text: text, reference: r.id),
        ));
      }

      if (toSend.isNotEmpty) {
        List<SmsResult> results;
        try {
          results = await gateway.sendBulk([for (final x in toSend) x.message]);
        } catch (_) {
          results = const [];
        }
        if (results.length != toSend.length) {
          results = [
            for (final _ in toSend) SmsResult.failure(SmsErrorCode.unknown),
          ];
        }
        for (var i = 0; i < toSend.length; i++) {
          final r = toSend[i].r;
          final res = results[i];
          if (res.ok) {
            await store.save(r.withState(
              status: ReminderStatus.sent,
              attempts: r.attempts + 1,
              providerId: res.providerId,
            ));
            sent++;
          } else {
            final code = res.error?.code ?? SmsErrorCode.unknown;
            final attempts = r.attempts + 1;
            if (permanentErrors.contains(code) || attempts >= maxAttempts) {
              await store.save(r.withState(
                status: ReminderStatus.failed,
                attempts: attempts,
                lastError: code,
              ));
              failed++;
            } else {
              final wait = backoffMinutes[attempts - 1 < backoffMinutes.length
                  ? attempts - 1
                  : backoffMinutes.length - 1];
              await store.save(r.withState(
                status: ReminderStatus.pending,
                attempts: attempts,
                retryAt: now + (wait * 60000).round(),
                lastError: code,
              ));
              retrying++;
            }
          }
        }
      }
      return RunSummary(candidates.length, sent, retrying, failed);
    } finally {
      _running = false;
    }
  }

  Future<void> _finishFailed(Reminder r, SmsErrorCode code) => store.save(
        r.withState(
          status: ReminderStatus.failed,
          attempts: r.attempts + 1,
          lastError: code,
        ),
      );
}
