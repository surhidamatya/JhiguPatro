import 'dart:convert';
import 'dart:io';

import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';
import 'package:test/test.dart';

final Map<String, dynamic> _vectors =
    jsonDecode(File('../testdata/address-picker.json').readAsStringSync())
        as Map<String, dynamic>;

AddressPicker _make(Map<String, dynamic>? init, void Function() onEvent) {
  final v = init?['value'] as Map<String, dynamic>?;
  final picker = AddressPicker(
    value: v == null
        ? null
        : (localLevelId: v['localLevelId'] as int, ward: v['ward'] as int?),
    language: (init?['language'] as String?) ?? 'en',
    showWard: (init?['showWard'] as bool?) ?? true,
  );
  picker.subscribe((_) => onEvent());
  return picker;
}

void _check(
  AddressPickerState s,
  int events,
  Map<String, dynamic> expected,
  String ctx,
) {
  expected.forEach((k, want) {
    final Object? got = switch (k) {
      'events' => events,
      'districts' => s.districts.length,
      'localLevels' => s.localLevels.length,
      'wards' => s.wards.length,
      'provinceId' => s.provinceId,
      'districtId' => s.districtId,
      'localLevelId' => s.localLevelId,
      'ward' => s.ward,
      'complete' => s.complete,
      'language' => s.language,
      'selection' => s.selection == null
          ? null
          : {
              'provinceId': s.selection!.provinceId,
              'districtId': s.selection!.districtId,
              'localLevelId': s.selection!.localLevelId,
              'ward': s.selection!.ward,
            },
      _ => throw StateError('unknown expectation key $k'),
    };
    expect(got, want, reason: '$ctx: $k');
  });
}

void _run(AddressPicker p, String action, Object? arg) {
  switch (action) {
    case 'selectProvince':
      p.selectProvince(arg as int?);
    case 'selectDistrict':
      p.selectDistrict(arg as int?);
    case 'selectLocalLevel':
      p.selectLocalLevel(arg as int?);
    case 'selectWard':
      p.selectWard(arg as int?);
    case 'clear':
      p.clear();
    case 'setLanguage':
      p.setLanguage(arg as String);
    default:
      throw StateError('unknown action $action');
  }
}

void main() {
  group('address picker shared scenarios', () {
    for (final sc
        in (_vectors['scenarios'] as List).cast<Map<String, dynamic>>()) {
      test(sc['name'] as String, () {
        var events = 0;
        final picker =
            _make(sc['init'] as Map<String, dynamic>?, () => events++);
        if (sc['initExpect'] != null) {
          _check(
            picker.state,
            events,
            sc['initExpect'] as Map<String, dynamic>,
            'init',
          );
        }
        final steps = (sc['steps'] as List).cast<Map<String, dynamic>>();
        for (var i = 0; i < steps.length; i++) {
          final step = steps[i];
          final ctx = 'step ${i + 1} ${step['action']}(${step['arg']})';
          if (step['error'] != null) {
            expect(
              () => _run(picker, step['action'] as String, step['arg']),
              throwsA(
                isA<AddressException>().having(
                  (e) => e.code.name_,
                  'code',
                  step['error'],
                ),
              ),
              reason: ctx,
            );
          } else {
            _run(picker, step['action'] as String, step['arg']);
          }
          if (step['expect'] != null) {
            _check(
              picker.state,
              events,
              step['expect'] as Map<String, dynamic>,
              ctx,
            );
          }
        }
      });
    }

    for (final v
        in (_vectors['initErrors'] as List).cast<Map<String, dynamic>>()) {
      test('create with ${jsonEncode(v['value'])} throws ${v['code']}', () {
        final val = v['value'] as Map<String, dynamic>;
        expect(
          () => AddressPicker(
            value: (
              localLevelId: val['localLevelId'] as int,
              ward: val['ward'] as int?,
            ),
          ),
          throwsA(
            isA<AddressException>().having(
              (e) => e.code.name_,
              'code',
              v['code'],
            ),
          ),
        );
      });
    }
  });

  group('address picker behaviour', () {
    test('notifies with the full new state, once per action', () {
      final picker = AddressPicker();
      final seen = <AddressPickerState>[];
      picker.subscribe(seen.add);
      picker.selectProvince(3);
      expect(seen, hasLength(1));
      expect(identical(seen.first, picker.state), isTrue);
      expect(seen.first.provinceId, 3);
    });

    test('unsubscribe stops notifications', () {
      final picker = AddressPicker();
      var n = 0;
      final off = picker.subscribe((_) => n++);
      picker.selectProvince(3);
      off();
      picker.selectProvince(4);
      expect(n, 1);
    });

    test('exposes all provinces and ward numbers 1..wards', () {
      final picker = AddressPicker(language: 'ne');
      expect(picker.state.provinces, hasLength(7));
      expect(picker.state.language, 'ne');
      picker.selectLocalLevel(307);
      final wards = picker.state.wards;
      expect(wards.first, 1);
      expect(wards.last, 32);
    });

    test('state is replaced, not mutated', () {
      final picker = AddressPicker();
      final before = picker.state;
      picker.selectProvince(3);
      expect(before.provinceId, isNull);
    });
  });
}
