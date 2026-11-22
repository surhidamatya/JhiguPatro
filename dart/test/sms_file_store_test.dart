import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:jhigu_patro_utils/sms_file_store.dart';
import 'package:test/test.dart';

Map<String, dynamic> _read(String p) =>
    jsonDecode(File(p).readAsStringSync()) as Map<String, dynamic>;

final _cal = _read('../data/nepali_calendar_data.json');
final Map<int, List<int>> _years = (_cal['years'] as Map<String, dynamic>).map(
  (k, v) => MapEntry(int.parse(k), List<int>.from(v as List)),
);
final _v = _read('../testdata/sms_store.json');
final String _phone = _v['phone'] as String;
final String _canonical = (_v['valid'] as Map)['file'] as String;

/// A reminder from the shared vectors' JSON shape (valid ones only).
Reminder _fromVector(Map<String, dynamic> r) => Reminder(
      id: r['id'] as String,
      to: r['to'] as String,
      templateKey: r['templateKey'] as String,
      language: r['language'] as String,
      values: Map<String, Object?>.from(r['values'] as Map),
      sendDate: NepaliDate(
        year: (r['sendDate'] as Map)['year'] as int,
        month: (r['sendDate'] as Map)['month'] as int,
        day: (r['sendDate'] as Map)['day'] as int,
      ),
      hour: r['hour'] as int,
      minute: r['minute'] as int,
      status: ReminderStatus.values.firstWhere((s) => s.name == r['status']),
      attempts: r['attempts'] as int,
      retryAt: r['retryAt'] as int?,
      providerId: r['providerId'] as String?,
      lastError: r['lastError'] == null
          ? null
          : SmsErrorCode.values.firstWhere((c) => c.name_ == r['lastError']),
    );

Reminder _reminder({
  String id = 'r1',
  Map<String, Object?>? values,
  ReminderStatus status = ReminderStatus.pending,
  int attempts = 0,
  int? retryAt,
  SmsErrorCode? lastError,
  String? providerId,
  int hour = 9,
}) =>
    Reminder(
      id: id,
      to: _phone,
      templateKey: 'rentDue',
      language: 'en',
      values: values ?? {'name': 'Ram', 'amount': 5000},
      sendDate: NepaliDate(year: 2082, month: 5, day: 10),
      hour: hour,
      minute: 30,
      status: status,
      attempts: attempts,
      retryAt: retryAt,
      providerId: providerId,
      lastError: lastError,
    );

// The built-in rentDue template needs all five of these.
const _rent = {
  'name': 'Ram',
  'amount': 5000,
  'month': 'Bhadra',
  'dueDate': '2082-05-15',
  'sender': 'Himal Rentals',
};

Future<SmsStoreException> _storeError(Future<Object?> f, String code) async {
  try {
    await f;
  } on SmsStoreException catch (e) {
    expect(e.code.name_, code);
    expect(e.message, isNot(contains(_phone)));
    expect(e.toString(), isNot(contains(_phone)));
    return e;
  }
  throw TestFailure('expected SmsStoreException $code');
}

void main() {
  late Directory dir;
  late String file;

  setUpAll(() {
    NepaliCalendar.initialize(InlineCalendarDataSource(
      years: _years,
      supportedStartYear: (_cal['supportedRange'] as Map)['start'] as int,
      supportedEndYear: (_cal['supportedRange'] as Map)['end'] as int,
      verifiedThrough: _cal['verifiedThrough'] as int,
    ));
  });

  setUp(() {
    dir = Directory.systemTemp.createTempSync('jhigu-store-');
    file = '${dir.path}/reminders.json';
  });
  tearDown(() {
    if (!Platform.isWindows) Process.runSync('chmod', ['700', dir.path]);
    dir.deleteSync(recursive: true);
  });

  group('file format (shared vectors)', () {
    final valid = ((_v['valid'] as Map)['reminders'] as List)
        .cast<Map<String, dynamic>>();

    test('saving the reminders in any order writes exactly the canonical file',
        () async {
      final store = FileReminderStore(file);
      for (final r in valid) {
        await store.save(_fromVector(r));
      }
      expect(File(file).readAsStringSync(), _canonical);
    });

    test('loads the canonical file, in id order', () async {
      File(file).writeAsStringSync(_canonical);
      final got = await FileReminderStore(file).loadAll();
      expect(got.map((r) => r.id), ['r-a', 'r-b', 'r-c', 'r-d']);
      expect(got[1].language, 'ne');
      expect(got[1].values['name'], 'राम श्रेष्ठ');
      expect(got[1].values['note'], isNull);
      expect(got[1].values.containsKey('note'), isTrue);
      expect(got[2].retryAt, 1789000000000);
      expect(got[2].lastError, SmsErrorCode.network);
      expect(got[1].sendDate.isSame(NepaliDate(year: 2082, month: 12, day: 30)),
          isTrue);
    });

    test('parse then serialize gives the same text back', () {
      expect(serializeReminders(parseReminders(_canonical)), _canonical);
    });

    test('keeps Devanagari text as it is (not \\u escapes)', () async {
      await FileReminderStore(file).save(_fromVector(valid[1]));
      final text = File(file).readAsStringSync();
      expect(text, contains('राम श्रेष्ठ'));
      expect(text, isNot(contains('\\u0930')));
    });

    for (final c in (_v['lenientFiles'] as List).cast<Map<String, dynamic>>()) {
      test('accepts: ${c['name']}', () async {
        File(file).writeAsStringSync(c['text'] as String);
        final got = await FileReminderStore(file).loadAll();
        expect(got, hasLength(1));
        final e = _fromVector(c['expect'] as Map<String, dynamic>);
        expect(serializeReminders(got), serializeReminders([e]));
      });
    }

    for (final c in (_v['invalidFiles'] as List).cast<Map<String, dynamic>>()) {
      test('rejects a bad file: ${c['name']}', () async {
        File(file).writeAsStringSync(c['text'] as String);
        await _storeError(
            FileReminderStore(file).loadAll(), c['code'] as String);
      });
    }

    // A bad reminder given to save() cannot be built as a Reminder with the
    // wrong types in Dart, so the vectors that are only about JSON types are
    // checked through the file path above. The ones that Dart can express are
    // checked here: out-of-range numbers, empty id, bad values.
    for (final c
        in (_v['invalidReminders'] as List).cast<Map<String, dynamic>>()) {
      final r = c['reminder'] as Map<String, dynamic>;
      final typed = r['id'] is String &&
          r['to'] is String &&
          r['templateKey'] is String &&
          r['language'] is String &&
          r['values'] is Map &&
          r['sendDate'] is Map &&
          (r['sendDate'] as Map).values.every((x) => x is int) &&
          r['hour'] is int &&
          r['minute'] is int &&
          r['status'] is String &&
          r['attempts'] is int &&
          (r['retryAt'] == null || r['retryAt'] is int) &&
          (r['providerId'] == null || r['providerId'] is String) &&
          (r['lastError'] == null || r['lastError'] is String);
      final status =
          ReminderStatus.values.where((s) => s.name == r['status']).toList();
      final errors =
          SmsErrorCode.values.where((e) => e.name_ == r['lastError']).toList();
      final expressible = typed &&
          status.isNotEmpty &&
          (r['lastError'] == null || errors.isNotEmpty) &&
          (r['values'] as Map)
              .values
              .every((x) => x == null || x is String || x is num);
      if (!expressible) continue;
      test('save rejects a bad reminder: ${c['name']}', () async {
        final store = FileReminderStore(file);
        final e =
            await _storeError(store.save(_fromVector(r)), 'INVALID_REMINDER');
        expect(e.message, contains('"${c['field']}"'));
        expect(File(file).existsSync(), isFalse);
      });
    }
  });

  group('behaviour', () {
    test('a missing file is an empty store, and reading does not create it',
        () async {
      expect(await FileReminderStore(file).loadAll(), isEmpty);
      expect(File(file).existsSync(), isFalse);
    });

    test('creates the folder on the first write', () async {
      final nested = '${dir.path}/a/b/reminders.json';
      await FileReminderStore(nested).save(_reminder());
      expect(
          (await FileReminderStore(nested).loadAll()).map((r) => r.id), ['r1']);
    });

    test('save replaces a reminder with the same id', () async {
      final store = FileReminderStore(file);
      await store.save(_reminder());
      await store.save(_reminder(
          status: ReminderStatus.sent, attempts: 1, providerId: 'p1'));
      final all = await store.loadAll();
      expect(all, hasLength(1));
      expect(all[0].status, ReminderStatus.sent);
      expect(all[0].attempts, 1);
      expect(all[0].providerId, 'p1');
    });

    test('clearing an optional field really clears it', () async {
      final store = FileReminderStore(file);
      await store.save(_reminder(retryAt: 5, lastError: SmsErrorCode.network));
      await store.save(_reminder());
      final r = (await store.loadAll()).single;
      expect(r.retryAt, isNull);
      expect(r.lastError, isNull);
      expect(File(file).readAsStringSync(), isNot(contains('retryAt')));
    });

    test(
        'delete removes one; deleting an unknown id changes nothing and writes nothing',
        () async {
      final store = FileReminderStore(file);
      await store.delete('nope');
      expect(File(file).existsSync(), isFalse);
      await store.save(_reminder(id: 'a'));
      await store.save(_reminder(id: 'b'));
      final before = File(file).readAsStringSync();
      await store.delete('zzz');
      expect(File(file).readAsStringSync(), before);
      await store.delete('a');
      expect((await store.loadAll()).map((r) => r.id), ['b']);
    });

    test('null values are kept', () async {
      final store = FileReminderStore(file);
      await store.save(_reminder(values: {'a': 'x', 'c': null}));
      expect((await store.loadAll()).single.values, {'a': 'x', 'c': null});
    });

    test('values that are not text, numbers or null are rejected', () async {
      final store = FileReminderStore(file);
      await _storeError(store.save(_reminder(values: {'a': DateTime(2020)})),
          'INVALID_REMINDER');
      await _storeError(
          store.save(_reminder(values: {'a': double.nan})), 'INVALID_REMINDER');
      expect(File(file).existsSync(), isFalse);
    });

    test(
        'the map you save is copied at the call: later changes do not reach the file',
        () async {
      final store = FileReminderStore(file);
      final first = store.save(_reminder(id: 'x'));
      final values = <String, Object?>{'name': 'Ram'};
      final queued =
          store.save(_reminder(values: values)); // waits behind `first`
      values['name'] = 'Changed';
      await Future.wait([first, queued]);
      final got = (await store.loadAll()).firstWhere((r) => r.id == 'r1');
      expect(got.values['name'], 'Ram');
    });

    test('a constructor needs a path', () {
      expect(() => FileReminderStore(''), throwsArgumentError);
    });

    test('leaves no temporary files behind', () async {
      final store = FileReminderStore(file);
      for (var i = 0; i < 5; i++) {
        await store.save(_reminder(id: 'r$i'));
      }
      await store.delete('r2');
      expect(dir.listSync().map((e) => e.uri.pathSegments.last).toList(),
          ['reminders.json']);
    });
  });

  group('concurrency inside one process', () {
    test('many parallel saves all land', () async {
      final store = FileReminderStore(file);
      await Future.wait([
        for (var i = 0; i < 60; i++)
          store.save(_reminder(id: 'r${i.toString().padLeft(2, '0')}')),
      ]);
      expect(await store.loadAll(), hasLength(60));
      jsonDecode(File(file).readAsStringSync()); // and the file is whole
    });

    test('parallel saves of one id end with the last one', () async {
      final store = FileReminderStore(file);
      await Future.wait([
        for (var n = 1; n <= 5; n++) store.save(_reminder(attempts: n)),
      ]);
      expect((await store.loadAll()).single.attempts, 5);
    });

    test(
        'a read started after a save sees it, even if the save was not awaited',
        () async {
      final store = FileReminderStore(file);
      // ignore: unawaited_futures
      store.save(_reminder());
      expect((await store.loadAll()).map((r) => r.id), ['r1']);
    });

    test('save then delete, in order, leaves nothing', () async {
      final store = FileReminderStore(file);
      // ignore: unawaited_futures
      store.save(_reminder());
      // ignore: unawaited_futures
      store.delete('r1');
      expect(await store.loadAll(), isEmpty);
    });
  });

  group('failures', () {
    test(
        'a corrupt file is an error and is left exactly as it was (never reset)',
        () async {
      File(file).writeAsStringSync('{"version":1,"reminders":[');
      final store = FileReminderStore(file);
      await _storeError(store.loadAll(), 'CORRUPT_FILE');
      await _storeError(store.save(_reminder()), 'CORRUPT_FILE');
      await _storeError(store.delete('r1'), 'CORRUPT_FILE');
      expect(File(file).readAsStringSync(), '{"version":1,"reminders":[');
    });

    test('bytes that are not UTF-8, and a byte order mark, are CORRUPT_FILE',
        () async {
      final store = FileReminderStore(file);
      // Invalid UTF-8 inside a string: a lenient decoder would turn it into U+FFFD
      // and the JSON would still parse, so only a strict one rejects it.
      File(file).writeAsBytesSync([
        ...utf8.encode('{"version":1,"reminders":[],"note":"'),
        0xff,
        ...utf8.encode('"}'),
      ]);
      await _storeError(store.loadAll(), 'CORRUPT_FILE');
      File(file)
          .writeAsBytesSync([0xef, 0xbb, 0xbf, ...utf8.encode(_canonical)]);
      await _storeError(store.loadAll(), 'CORRUPT_FILE');
    });

    test('a file that cannot be read is READ_FAILED', () async {
      Directory(file).createSync(); // a folder where the file should be
      await _storeError(FileReminderStore(file).loadAll(), 'READ_FAILED');
    });

    test('a failed call does not poison the queue: the next one works',
        () async {
      Directory(file).createSync();
      final store = FileReminderStore(file);
      await _storeError(store.save(_reminder()), 'READ_FAILED');
      await _storeError(store.loadAll(), 'READ_FAILED');
      Directory(file).deleteSync();
      await store.save(_reminder());
      expect((await store.loadAll()).map((r) => r.id), ['r1']);
    });

    test('a write that fails leaves the old file whole and no temporary file',
        () async {
      final store = FileReminderStore(file);
      await store.save(_reminder());
      final before = File(file).readAsStringSync();
      Process.runSync(
          'chmod', ['500', dir.path]); // enter and read, no creating
      await _storeError(store.save(_reminder(id: 'r2')), 'WRITE_FAILED');
      Process.runSync('chmod', ['700', dir.path]);
      expect(File(file).readAsStringSync(), before);
      expect(dir.listSync().map((e) => e.uri.pathSegments.last).toList(),
          ['reminders.json']);
    },
        skip: Platform.isWindows ||
                Process.runSync('id', ['-u']).stdout.toString().trim() == '0'
            ? 'needs a non-root Unix user'
            : null);
  });

  group('with the scheduler', () {
    test('a restart does not send a reminder that was already sent', () async {
      final r = _reminder(values: _rent);
      final at = reminderSendAt(r.sendDate, r.hour, r.minute);

      final first = FileReminderStore(file);
      await first.save(r);
      final gw1 = MockSmsGateway();
      final s1 = await ReminderScheduler(
          gateway: gw1, store: first, clock: () => at + 1000).runOnce();
      expect(s1.sent, 1);

      // "Restart": a new store object and scheduler on the same file.
      final gw2 = MockSmsGateway();
      final s2 = await ReminderScheduler(
          gateway: gw2,
          store: FileReminderStore(file),
          clock: () => at + 2000).runOnce();
      expect([s2.due, s2.sent, s2.retrying, s2.failed], [0, 0, 0, 0]);
      expect(gw2.sent, isEmpty);
      expect((await FileReminderStore(file).loadAll()).single.status,
          ReminderStatus.sent);
    });

    test('a retry that was scheduled survives a restart', () async {
      final r = _reminder(values: _rent);
      final at = reminderSendAt(r.sendDate, r.hour, r.minute);
      final store = FileReminderStore(file);
      await store.save(r);
      final gw = MockSmsGateway()..failNext(SmsErrorCode.network);
      final s1 =
          await ReminderScheduler(gateway: gw, store: store, clock: () => at)
              .runOnce();
      expect(s1.retrying, 1);

      final saved = (await FileReminderStore(file).loadAll()).single;
      expect(saved.attempts, 1);
      expect(saved.retryAt, at + 60000);
      expect(saved.lastError, SmsErrorCode.network);

      final gw2 = MockSmsGateway();
      ReminderScheduler mk(int now) => ReminderScheduler(
          gateway: gw2, store: FileReminderStore(file), clock: () => now);
      expect((await mk(at + 30000).runOnce()).due, 0);
      expect((await mk(at + 61000).runOnce()).sent, 1);
    });
  });
}
