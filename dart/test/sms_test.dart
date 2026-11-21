import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _cal = _read('../data/nepali_calendar_data.json');
final Map<int, List<int>> _years = (_cal['years'] as Map<String, dynamic>).map(
  (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
);
final _v = _read('../testdata/sms.json');
final int _base = _v['baseUtcMs'] as int;

SmsErrorCode _code(String s) =>
    SmsErrorCode.values.firstWhere((c) => c.name_ == s);

Reminder _fromJson(Map<String, dynamic> r) {
  final d = r['sendDate'] as List;
  return Reminder(
    id: r['id'] as String,
    to: r['to'] as String,
    templateKey: r['templateKey'] as String,
    language: r['language'] as String,
    values: Map<String, Object?>.from(r['values'] as Map),
    sendDate: NepaliDate.checked(d[0] as int, d[1] as int, d[2] as int),
    hour: r['hour'] as int,
    minute: r['minute'] as int,
  );
}

Reminder _reminder({String to = '+9779841234567'}) => Reminder(
      id: 'r1',
      to: to,
      templateKey: 'appointment',
      language: 'en',
      values: const {'name': 'Ram', 'date': 'd', 'time': 't', 'sender': 's'},
      sendDate: NepaliDate.checked(2082, 5, 10),
      hour: 9,
      minute: 0,
    );

List<SmsMessage> _msgs(int n) => [
      for (var i = 0; i < n; i++)
        SmsMessage(toE164: '+9779841234567', text: 'm$i', reference: 'r$i'),
    ];

void main() {
  setUpAll(() {
    NepaliCalendar.initialize(
      InlineCalendarDataSource(
        years: _years,
        supportedStartYear: _cal['supportedRange']['start'] as int,
        supportedEndYear: _cal['supportedRange']['end'] as int,
        verifiedThrough: _cal['verifiedThrough'] as int,
      ),
    );
  });

  group('renderer (shared vectors)', () {
    for (final c in _v['render'] as List) {
      final m = c as Map<String, dynamic>;
      test(m['name'] as String, () {
        final values = Map<String, Object?>.from(m['values'] as Map);
        final expect_ = m['expect'] as Map<String, dynamic>;
        final strict = m['strict'] as bool;
        if (expect_['error'] != null) {
          expect(
            () => renderTemplate(m['text'] as String, values, strict: strict),
            throwsA(isA<SmsTemplateException>()
                .having((e) => e.code.name_, 'code', expect_['error'])
                .having((e) => e.key, 'key', expect_['key'])),
          );
        } else {
          expect(renderTemplate(m['text'] as String, values, strict: strict),
              expect_['text']);
        }
      });
    }
  });

  group('built-in templates (shared vectors)', () {
    for (final c in _v['templates'] as List) {
      final m = c as Map<String, dynamic>;
      test('${m['key']} ${m['language']}', () {
        final key = m['key'] as String;
        final lang = m['language'] as String;
        expect(
            templatePlaceholders(getSmsTemplate(key, lang)), m['placeholders']);
        expect(
          renderSmsTemplate(
              key, lang, Map<String, Object?>.from(m['values'] as Map)),
          m['expect'],
        );
      });
    }
    test('every key has en and ne text and the same placeholders', () {
      for (final k in smsTemplateKeys) {
        expect(templatePlaceholders(getSmsTemplate(k, 'en'))..sort(),
            templatePlaceholders(getSmsTemplate(k, 'ne'))..sort());
      }
    });
    test('unknown key throws', () {
      expect(() => renderSmsTemplate('nope', 'en', {}),
          throwsA(isA<SmsTemplateException>()));
    });
  });

  group('smsSegments (shared vectors)', () {
    var i = 0;
    for (final c in _v['segments'] as List) {
      final m = c as Map<String, dynamic>;
      test('#${i++} ${m['expect']['encoding']} ${m['expect']['units']}', () {
        final s = smsSegments(m['text'] as String);
        final e = m['expect'] as Map<String, dynamic>;
        expect(s.encoding.name, e['encoding']);
        expect(s.units, e['units']);
        expect(s.segments, e['segments']);
      });
    }
  });

  group('scheduler (shared vectors)', () {
    for (final c in _v['scheduler'] as List) {
      final sc = c as Map<String, dynamic>;
      test(sc['name'] as String, () async {
        final gateway = MockSmsGateway();
        (sc['failures'] as Map<String, dynamic>).forEach((ref, codes) {
          gateway.failFor(
              ref, [for (final s in codes as List) _code(s as String)]);
        });
        final store = InMemoryReminderStore();
        for (final r in sc['reminders'] as List) {
          await store.save(_fromJson(r as Map<String, dynamic>));
        }
        var now = 0;
        final scheduler =
            ReminderScheduler(gateway: gateway, store: store, clock: () => now);
        for (final s in sc['steps'] as List) {
          final step = s as Map<String, dynamic>;
          final at = step['at'] as int;
          now = _base + at * 60000;
          final summary = await scheduler.runOnce();
          final e = step['expect'] as Map<String, dynamic>;
          final want = e['summary'] as Map<String, dynamic>;
          expect(
            summary,
            RunSummary(want['due'] as int, want['sent'] as int,
                want['retrying'] as int, want['failed'] as int),
            reason: 'at $at',
          );
          final all = {for (final r in await store.loadAll()) r.id: r};
          (e['reminders'] as Map<String, dynamic>).forEach((id, w) {
            final want = w as Map<String, dynamic>;
            final got = all[id]!;
            final ctx = 'at $at $id';
            expect(got.status.name, want['status'], reason: ctx);
            expect(got.attempts, want['attempts'], reason: ctx);
            expect(got.lastError?.name_, want['lastError'], reason: ctx);
            expect(got.retryAt == null ? null : (got.retryAt! - _base) ~/ 60000,
                want['retryAt'],
                reason: ctx);
          });
          if (e['calls'] != null) {
            expect(gateway.attempts.length, e['calls'], reason: 'at $at calls');
          }
          if (e['sentOrder'] != null) {
            expect(
                gateway.sent.map((m) => m.reference).toList(), e['sentOrder']);
          }
        }
      });
    }
    test('send time of BS 2082-05-10 09:00 matches the Python value', () {
      expect(reminderSendAt(NepaliDate.checked(2082, 5, 10), 9, 0), _base);
    });
  });

  group('gateways', () {
    test('isE164', () {
      expect(isE164('+9779841234567'), isTrue);
      for (final bad in [
        '9779841234567',
        '+0123456789',
        '+1234567',
        '+1234567890123456',
        '+97798 41234567',
        '',
        '+',
      ]) {
        expect(isE164(bad), isFalse, reason: bad);
      }
    });

    test('mock records sent, ids increase, failNext and bad numbers', () async {
      final g = MockSmsGateway();
      expect((await g.send(_msgs(1).first)).providerId, 'mock-1');
      g.failNext(SmsErrorCode.balance);
      final r = await g.send(_msgs(1).first);
      expect(r.ok, isFalse);
      expect(r.error!.code, SmsErrorCode.balance);
      expect(
        (await g.send(const SmsMessage(toE164: '123', text: 'x'))).error!.code,
        SmsErrorCode.badNumber,
      );
      expect(g.sent.length, 1);
      expect(g.attempts.length, 3);
    });

    test('callback gateway: send, throw, SmsException, no provider text kept',
        () async {
      final g = CallbackSmsGateway(sendOne: (m) async {
        if (m.text == 'boom') throw Exception('secret +9779841234567');
        if (m.text == 'rate') throw const SmsException(SmsErrorCode.rateLimit);
        return const SmsResult.success(providerId: 'p1');
      });
      const to = '+9779841234567';
      expect(
          (await g.send(const SmsMessage(toE164: to, text: 'ok'))).providerId,
          'p1');
      final boom = await g.send(const SmsMessage(toE164: to, text: 'boom'));
      expect(boom.error!.code, SmsErrorCode.unknown);
      expect(boom.error!.message, isNot(contains('secret')));
      expect(
          (await g.send(const SmsMessage(toE164: to, text: 'rate')))
              .error!
              .code,
          SmsErrorCode.rateLimit);
    });

    test('callback gateway bulk without sendBatch is sequential and ordered',
        () async {
      final order = <String>[];
      final g = CallbackSmsGateway(sendOne: (m) async {
        order.add(m.text);
        return SmsResult.success(providerId: m.text);
      });
      final res = await g.sendBulk(_msgs(3));
      expect(order, ['m0', 'm1', 'm2']);
      expect(res.map((r) => r.providerId).toList(), ['m0', 'm1', 'm2']);
    });

    test('callback gateway splits batches at maxBatchSize and keeps order',
        () async {
      final sizes = <int>[];
      final g = CallbackSmsGateway(
        sendOne: (_) async => const SmsResult.success(),
        sendBatch: (ms) async {
          sizes.add(ms.length);
          return [for (final m in ms) SmsResult.success(providerId: m.text)];
        },
        maxBatchSize: 2,
      );
      final res = await g.sendBulk(_msgs(5));
      expect(sizes, [2, 2, 1]);
      expect(res.map((r) => r.providerId).toList(),
          ['m0', 'm1', 'm2', 'm3', 'm4']);
      expect(await g.sendBulk([]), isEmpty);
    });

    test('wrong result count or a throwing batch gives unknown for that batch',
        () async {
      var call = 0;
      final g = CallbackSmsGateway(
        sendOne: (_) async => const SmsResult.success(),
        sendBatch: (ms) async {
          call++;
          if (call == 1) return [const SmsResult.success()];
          if (call == 2) throw Exception('down');
          return [for (final _ in ms) const SmsResult.success()];
        },
        maxBatchSize: 2,
      );
      final res = await g.sendBulk(_msgs(6));
      expect(res.map((r) => r.ok).toList(),
          [false, false, false, false, true, true]);
      expect(res[0].error!.code, SmsErrorCode.unknown);
    });

    test('rejects a bad maxBatchSize', () {
      expect(
        () => CallbackSmsGateway(
            sendOne: (_) async => const SmsResult.success(), maxBatchSize: 0),
        throwsArgumentError,
      );
    });

    test('error messages localise', () {
      const e = SmsException(SmsErrorCode.auth);
      expect(e.message, 'The SMS gateway rejected the credentials.');
      expect(e.localized('ne'), contains('एसएमएस'));
    });
  });

  group('scheduler extras', () {
    int at(int min) => _base + min * 60000;

    test('gateway that throws, or returns the wrong count, is a failed attempt',
        () async {
      for (final bad in <SmsGateway>[
        CallbackSmsGateway(
          sendOne: (_) async => const SmsResult.success(),
          sendBatch: (_) async => throw Exception('x'),
        ),
        CallbackSmsGateway(
          sendOne: (_) async => const SmsResult.success(),
          sendBatch: (_) async => [],
        ),
      ]) {
        final store = InMemoryReminderStore();
        await store.save(_reminder());
        final s =
            ReminderScheduler(gateway: bad, store: store, clock: () => at(0));
        expect(await s.runOnce(), const RunSummary(1, 0, 1, 0));
        expect((await store.loadAll()).first.lastError, SmsErrorCode.unknown);
      }
    });

    test('a gateway whose sendBulk itself throws is a failed attempt',
        () async {
      final store = InMemoryReminderStore();
      await store.save(_reminder());
      final s = ReminderScheduler(
          gateway: _ThrowingGateway(), store: store, clock: () => at(0));
      expect(await s.runOnce(), const RunSummary(1, 0, 1, 0));
    });

    test('options: custom permanent codes', () async {
      final gateway = MockSmsGateway()
        ..failFor('r1', [SmsErrorCode.auth, SmsErrorCode.server]);
      final store = InMemoryReminderStore();
      await store.save(_reminder());
      final s = ReminderScheduler(
        gateway: gateway,
        store: store,
        clock: () => at(0),
        backoffMinutes: const [2],
        maxAttempts: 5,
        permanentErrors: {SmsErrorCode.auth},
      );
      await s.runOnce();
      final r = (await store.loadAll()).first;
      expect(r.status, ReminderStatus.failed);
      expect(r.lastError, SmsErrorCode.auth);
    });

    test('a second run that overlaps the first does nothing', () async {
      final gate = Completer<void>();
      final gateway = CallbackSmsGateway(
        sendOne: (_) async {
          await gate.future;
          return const SmsResult.success();
        },
        sendBatch: (ms) async {
          await gate.future;
          return [for (final _ in ms) const SmsResult.success()];
        },
      );
      final store = InMemoryReminderStore();
      await store.save(_reminder());
      final s =
          ReminderScheduler(gateway: gateway, store: store, clock: () => at(0));
      final first = s.runOnce();
      await Future<void>.delayed(Duration.zero);
      expect(await s.runOnce(), const RunSummary(0, 0, 0, 0));
      gate.complete();
      expect((await first).sent, 1);
    });

    test('delete removes a reminder', () async {
      final store = InMemoryReminderStore();
      await store.save(_reminder());
      await store.delete('r1');
      expect(await store.loadAll(), isEmpty);
    });

    test('start and stop drive runOnce on a timer', () async {
      final gateway = MockSmsGateway();
      final store = InMemoryReminderStore();
      await store.save(_reminder());
      final s = ReminderScheduler(
        gateway: gateway,
        store: store,
        clock: () => at(0),
        interval: const Duration(milliseconds: 10),
      );
      s.start();
      s.start();
      await Future<void>.delayed(const Duration(milliseconds: 60));
      s.stop();
      expect(gateway.sent.length, 1);
    });

    test('rejects bad options', () {
      final g = MockSmsGateway();
      final st = InMemoryReminderStore();
      expect(() => ReminderScheduler(gateway: g, store: st, maxAttempts: 0),
          throwsArgumentError);
      expect(() => ReminderScheduler(gateway: g, store: st, backoffMinutes: []),
          throwsArgumentError);
    });
  });
}

class _ThrowingGateway implements SmsGateway {
  @override
  Future<SmsResult> send(SmsMessage message) async => throw Exception('x');
  @override
  Future<List<SmsResult>> sendBulk(List<SmsMessage> messages) async =>
      throw Exception('x');
}
