/// Headless date picker (guide 15.1, U-4): a framework-free state machine for a
/// BS date picker. No Flutter.
///
/// Rules:
///  - `focused` is the day the keyboard is on; the visible month follows it.
///  - Previous/next month moves the focus to the same day (clamped to the
///    month).
///  - Days outside `min`/`max` or outside the calendar data are disabled: they
///    cannot be selected and focus stops at the edge.
///  - Every action that changes the state notifies listeners once, with the
///    full new state. An action that changes nothing does not notify.
///  - Invalid input throws a [JhiguException] and leaves the state unchanged.
///
/// Needs the calendar initialised.
library;

import 'date_format.dart';
import 'errors.dart';
import 'generated/strings.dart';
import 'month_grid.dart';
import 'nepali_calendar.dart';
import 'types.dart';

enum PickerView { days, months, years }

/// A keyboard focus move (guide U-15).
enum FocusMove {
  left,
  right,
  up,
  down,
  home,
  end,
  pageUp,
  pageDown,
  shiftPageUp,
  shiftPageDown,
}

/// What a key does in the picker.
enum KeyAction {
  left,
  right,
  up,
  down,
  home,
  end,
  pageUp,
  pageDown,
  shiftPageUp,
  shiftPageDown,
  select,
  close;

  /// The matching [FocusMove], or null for [select] and [close].
  FocusMove? get focusMove =>
      index <= KeyAction.shiftPageDown.index ? FocusMove.values[index] : null;
}

/// Keyboard map (guide U-15). [key] is a DOM `KeyboardEvent.key` name. Returns
/// null for keys the picker does not use. Shift only matters for Page Up and
/// Page Down.
KeyAction? keyAction(String key, {bool shift = false}) => switch (key) {
      'ArrowLeft' => KeyAction.left,
      'ArrowRight' => KeyAction.right,
      'ArrowUp' => KeyAction.up,
      'ArrowDown' => KeyAction.down,
      'Home' => KeyAction.home,
      'End' => KeyAction.end,
      'PageUp' => shift ? KeyAction.shiftPageUp : KeyAction.pageUp,
      'PageDown' => shift ? KeyAction.shiftPageDown : KeyAction.pageDown,
      'Enter' || ' ' || 'Spacebar' => KeyAction.select,
      'Escape' => KeyAction.close,
      _ => null,
    };

class MonthItem {
  final int month;
  final String label;
  final bool disabled;
  const MonthItem(this.month, this.label, {required this.disabled});
}

class YearItem {
  final int year;
  final String label;
  final bool disabled;
  const YearItem(this.year, this.label, {required this.disabled});
}

/// ARIA attributes for a grid cell.
class CellProps {
  final String role;
  final bool ariaSelected;
  final bool ariaDisabled;

  /// Weekday, day, month, year, and the AD date when `showAd`. Empty for blank
  /// cells.
  final String ariaLabel;

  /// 0 for the focused cell, -1 for the rest (roving tabindex).
  final int tabIndex;
  const CellProps({
    required this.role,
    required this.ariaSelected,
    required this.ariaDisabled,
    required this.ariaLabel,
    required this.tabIndex,
  });
}

/// Immutable picker state. A new instance is created on every change.
class DatePickerState {
  final String language;
  final int weekStartsOn;
  final bool showAd;
  final PickerView view;
  final int visibleYear;
  final int visibleMonth;

  /// `बैशाख २०८१` / `Baisakh 2081`.
  final String title;

  /// Seven short weekday names, starting at [weekStartsOn].
  final List<String> weekdays;
  final List<List<GridCell<Object?>>> grid;

  /// The 12 months of [visibleYear].
  final List<MonthItem> months;

  /// A page of 12 years that contains [visibleYear].
  final List<YearItem> years;
  final NepaliDate? value;
  final NepaliDate focused;
  final NepaliDate? min;
  final NepaliDate? max;
  final bool canGoPrev;
  final bool canGoNext;

  const DatePickerState._({
    required this.language,
    required this.weekStartsOn,
    required this.showAd,
    required this.view,
    required this.visibleYear,
    required this.visibleMonth,
    required this.title,
    required this.weekdays,
    required this.grid,
    required this.months,
    required this.years,
    required this.value,
    required this.focused,
    required this.min,
    required this.max,
    required this.canGoPrev,
    required this.canGoNext,
  });
}

typedef _Core = ({
  PickerView view,
  int visibleYear,
  int visibleMonth,
  NepaliDate? value,
  NepaliDate focused,
  String language,
});

const _neDigits = '०१२३४५६७८९';

String _digits(int n, String language) => language == 'ne'
    ? n.toString().split('').map((c) => _neDigits[int.parse(c)]).join()
    : n.toString();

int _monthKey(int y, int m) => y * 12 + (m - 1);

class DatePicker {
  final int weekStartsOn;
  final bool showAd;
  final NepaliDate _today;
  final NepaliDate? _min;
  final NepaliDate? _max;
  final ({int start, int end}) _range = NepaliCalendar.getSupportedBSRange();
  late _Core _core;
  late DatePickerState _state;
  final List<void Function(DatePickerState)> _listeners = [];

  /// [language] is `'en'` or `'ne'`. [today] defaults to today in Nepal; pass
  /// it in tests. Throws [JhiguException] for an invalid date, `min` after
  /// `max`, a `value` outside `min`/`max`, or a bad [weekStartsOn].
  DatePicker({
    NepaliDate? value,
    NepaliDate? min,
    NepaliDate? max,
    String language = 'en',
    this.weekStartsOn = 0,
    this.showAd = true,
    NepaliDate? today,
  })  : _today = _check(today ?? NepaliDate.today()),
        _min = min == null ? null : _check(min),
        _max = max == null ? null : _check(max) {
    if (weekStartsOn < 0 || weekStartsOn > 6) {
      throw InvalidDataException(
        'weekStartsOn must be an integer from 0 to 6',
        weekStartsOn,
      );
    }
    final lo = _min;
    final hi = _max;
    if (lo != null && hi != null && lo.isAfter(hi)) {
      throw InvalidDataException('min is after max', '$lo $hi');
    }
    final v = value == null ? null : _check(value);
    if (v != null && _disabled(v)) {
      throw OutOfRangeException('value is outside min/max', v.toIsoString());
    }
    final f = _clamp(v ?? _today);
    _core = (
      view: PickerView.days,
      visibleYear: f.year,
      visibleMonth: f.month,
      value: v,
      focused: f,
      language: language,
    );
    _state = _resolve(_core);
  }

  static NepaliDate _check(NepaliDate d) =>
      NepaliDate.checked(d.year, d.month, d.day);

  DatePickerState get state => _state;

  /// Returns a function that unsubscribes.
  void Function() subscribe(void Function(DatePickerState) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  bool _disabled(NepaliDate d) {
    final lo = _min;
    final hi = _max;
    return (lo != null && d.isBefore(lo)) || (hi != null && d.isAfter(hi));
  }

  NepaliDate _clamp(NepaliDate d) {
    final lo = _min;
    final hi = _max;
    if (lo != null && d.isBefore(lo)) return lo;
    if (hi != null && d.isAfter(hi)) return hi;
    return d;
  }

  /// A month is disabled when every day of it is outside min/max.
  bool _monthDisabled(int y, int m) {
    final lo = _min;
    final hi = _max;
    final first = NepaliDate.checked(y, m, 1);
    return (lo != null && first.endOfMonth().isBefore(lo)) ||
        (hi != null && first.isAfter(hi));
  }

  DatePickerState _resolve(_Core c) {
    final s = getStrings(c.language);
    final rows = getMonthGrid<Object?>(
      c.visibleYear,
      c.visibleMonth,
      weekStartsOn: weekStartsOn,
      today: _today,
    );
    final lo = _min;
    final hi = _max;
    final prevKey = _monthKey(c.visibleYear, c.visibleMonth) - 1;
    final nextKey = _monthKey(c.visibleYear, c.visibleMonth) + 1;
    bool inData(int key) =>
        key ~/ 12 >= _range.start && key ~/ 12 <= _range.end;
    final canGoPrev = inData(prevKey) &&
        !(lo != null && _monthKey(lo.year, lo.month) > prevKey);
    final canGoNext = inData(nextKey) &&
        !(hi != null && _monthKey(hi.year, hi.month) < nextKey);
    final pageStart = c.visibleYear - ((c.visibleYear - _range.start) % 12);
    return DatePickerState._(
      language: c.language,
      weekStartsOn: weekStartsOn,
      showAd: showAd,
      view: c.view,
      visibleYear: c.visibleYear,
      visibleMonth: c.visibleMonth,
      title:
          '${s.months[c.visibleMonth - 1]} ${_digits(c.visibleYear, c.language)}',
      weekdays: [
        for (var i = 0; i < 7; i++) s.weekdaysShort[(weekStartsOn + i) % 7],
      ],
      grid: rows,
      months: [
        for (var i = 0; i < 12; i++)
          MonthItem(
            i + 1,
            s.months[i],
            disabled: _monthDisabled(c.visibleYear, i + 1),
          ),
      ],
      years: [
        for (var i = 0; i < 12; i++)
          YearItem(
            pageStart + i,
            _digits(pageStart + i, c.language),
            disabled: pageStart + i < _range.start ||
                pageStart + i > _range.end ||
                (lo != null && pageStart + i < lo.year) ||
                (hi != null && pageStart + i > hi.year),
          ),
      ],
      value: c.value,
      focused: c.focused,
      min: _min,
      max: _max,
      canGoPrev: canGoPrev,
      canGoNext: canGoNext,
    );
  }

  String _sig(_Core c) =>
      '${c.view.name}|${c.visibleYear}-${c.visibleMonth}|${c.value?.toIsoString() ?? ''}|${c.focused.toIsoString()}|${c.language}';

  void _commit(_Core next) {
    if (_sig(next) == _sig(_core)) return;
    _core = next;
    _state = _resolve(_core);
    for (final l in List.of(_listeners)) {
      l(_state);
    }
  }

  /// Move focus to [d] (clamped to min/max); the visible month follows.
  void _focusOn(NepaliDate d,
      {PickerView? view, NepaliDate? value, bool setValue = false}) {
    final f = _clamp(d);
    _commit((
      view: view ?? _core.view,
      visibleYear: f.year,
      visibleMonth: f.month,
      value: setValue ? value : _core.value,
      focused: f,
      language: _core.language,
    ));
  }

  void _shiftMonths(int n) {
    try {
      _focusOn(_core.focused.addMonths(n));
    } on OutOfRangeException {
      // Moving past the calendar data: stay where we are.
    }
  }

  /// No-op at the earliest month allowed by `min` and the calendar data.
  void prevMonth() {
    if (_state.canGoPrev) _shiftMonths(-1);
  }

  void nextMonth() {
    if (_state.canGoNext) _shiftMonths(1);
  }

  /// Show a month. Throws [InvalidDateException] / [OutOfRangeException]
  /// outside the calendar data.
  void goTo(int year, int month) {
    final lo = _min;
    final hi = _max;
    var target = NepaliDate.checked(year, month, 1);
    if (lo != null && _monthKey(year, month) < _monthKey(lo.year, lo.month)) {
      target = lo;
    } else if (hi != null &&
        _monthKey(year, month) > _monthKey(hi.year, hi.month)) {
      target = hi;
    }
    final dim = NepaliDate.checked(target.year, target.month, 1).daysInMonth;
    final day = _core.focused.day < dim ? _core.focused.day : dim;
    _focusOn(NepaliDate.checked(target.year, target.month, day));
  }

  void setView(PickerView view) {
    _commit((
      view: view,
      visibleYear: _core.visibleYear,
      visibleMonth: _core.visibleMonth,
      value: _core.value,
      focused: _core.focused,
      language: _core.language,
    ));
  }

  /// Throws [OutOfRangeException] for a disabled date.
  void select(NepaliDate date) {
    final d = _check(date);
    if (_disabled(d)) {
      throw OutOfRangeException('Date is outside min/max', d.toIsoString());
    }
    _focusOn(d, view: PickerView.days, value: d, setValue: true);
  }

  void clear() {
    _commit((
      view: _core.view,
      visibleYear: _core.visibleYear,
      visibleMonth: _core.visibleMonth,
      value: null,
      focused: _core.focused,
      language: _core.language,
    ));
  }

  void selectToday() => select(_today);

  void moveFocus(FocusMove kind) {
    final f = _core.focused;
    final col = (f.weekday - weekStartsOn + 7) % 7;
    try {
      switch (kind) {
        case FocusMove.left:
          _focusOn(f.addDays(-1));
        case FocusMove.right:
          _focusOn(f.addDays(1));
        case FocusMove.up:
          _focusOn(f.addDays(-7));
        case FocusMove.down:
          _focusOn(f.addDays(7));
        case FocusMove.home:
          _focusOn(f.addDays(-col));
        case FocusMove.end:
          _focusOn(f.addDays(6 - col));
        case FocusMove.pageUp:
          _focusOn(f.addMonths(-1));
        case FocusMove.pageDown:
          _focusOn(f.addMonths(1));
        case FocusMove.shiftPageUp:
          _focusOn(f.addYears(-1));
        case FocusMove.shiftPageDown:
          _focusOn(f.addYears(1));
      }
    } on OutOfRangeException {
      // Moving past the calendar data: stay where we are.
    }
  }

  void setLanguage(String language) {
    _commit((
      view: _core.view,
      visibleYear: _core.visibleYear,
      visibleMonth: _core.visibleMonth,
      value: _core.value,
      focused: _core.focused,
      language: language,
    ));
  }

  /// ARIA attributes for a cell of `state.grid`.
  CellProps getCellProps(GridCell<Object?> cell) {
    final d = cell.bs;
    if (d == null) {
      return const CellProps(
        role: 'gridcell',
        ariaSelected: false,
        ariaDisabled: true,
        ariaLabel: '',
        tabIndex: -1,
      );
    }
    final language = _state.language;
    var label = formatDate(d, 'dddd, D MMMM YYYY', language: language);
    if (showAd) {
      final ad = d.toAD();
      final adText = formatAd(
        DateTime.utc(ad.year, ad.month, ad.day),
        'D MMMM YYYY',
        language: language,
        asciiDigits: true,
      );
      label = getStrings(language)
          .format
          .dualPattern
          .replaceAll('{bs}', label)
          .replaceAll('{ad}', adText);
    }
    final v = _state.value;
    return CellProps(
      role: 'gridcell',
      ariaSelected: v != null && d.isSame(v),
      ariaDisabled: _disabled(d),
      ariaLabel: label,
      tabIndex: d.isSame(_state.focused) ? 0 : -1,
    );
  }
}
