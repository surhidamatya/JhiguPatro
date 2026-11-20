/// Headless date range picker (guide 15.1, `<jhigu-date-range-picker>`): a
/// framework-free state machine for choosing a start and an end BS date. It
/// reuses [DatePicker] for the month view, focus, keyboard moves, `min`/`max`
/// and ARIA labels, and adds the two-click range logic.
///
/// Selection rules:
///  - First click sets the start ([RangePhase.end] is next).
///  - A second click on or after the start sets the end (complete).
///  - A second click before the start restarts the range from that day.
///  - A click when the range is complete starts a new range.
///  - While choosing the end, [RangePickerState.previewEnd] is the hovered
///    day, or the focused day for keyboard users; days after the start up to
///    it are `inPreview`.
///  - Every action that changes the state notifies listeners once, with the
///    full new state. Invalid input throws a [JhiguException] and leaves the
///    state unchanged.
///
/// Needs the calendar initialised.
library;

import 'date_picker.dart';
import 'errors.dart';
import 'month_grid.dart';
import 'types.dart';

/// `start` when the next click chooses a start, `end` when it chooses the end.
enum RangePhase { start, end }

/// Where a cell sits in the chosen range.
enum RangePosition { start, middle, end, single }

/// ARIA attributes plus range position for a grid cell.
class RangeCellProps {
  final CellProps base;
  final RangePosition? rangePosition;

  /// True for days after the start up to `previewEnd` while choosing the end.
  final bool inPreview;
  const RangeCellProps({
    required this.base,
    required this.rangePosition,
    required this.inPreview,
  });

  String get role => base.role;
  bool get ariaSelected => base.ariaSelected;
  bool get ariaDisabled => base.ariaDisabled;
  String get ariaLabel => base.ariaLabel;
  int get tabIndex => base.tabIndex;
}

/// Immutable range picker state. The month view fields come from [base].
class RangePickerState {
  final DatePickerState base;
  final NepaliDate? start;
  final NepaliDate? end;
  final RangePhase phase;

  /// True when both start and end are set.
  final bool complete;

  /// The day the pointer is over, or null.
  final NepaliDate? hovered;

  /// While choosing the end: the hovered day, else the focused day.
  /// Otherwise null.
  final NepaliDate? previewEnd;

  const RangePickerState._({
    required this.base,
    required this.start,
    required this.end,
    required this.phase,
    required this.complete,
    required this.hovered,
    required this.previewEnd,
  });

  String get language => base.language;
  int get weekStartsOn => base.weekStartsOn;
  bool get showAd => base.showAd;
  PickerView get view => base.view;
  int get visibleYear => base.visibleYear;
  int get visibleMonth => base.visibleMonth;
  String get title => base.title;
  List<String> get weekdays => base.weekdays;
  List<List<GridCell<Object?>>> get grid => base.grid;
  List<MonthItem> get months => base.months;
  List<YearItem> get years => base.years;
  NepaliDate get focused => base.focused;
  NepaliDate? get min => base.min;
  NepaliDate? get max => base.max;
  bool get canGoPrev => base.canGoPrev;
  bool get canGoNext => base.canGoNext;
}

class RangePicker {
  final DatePicker _inner;
  NepaliDate? _start;
  NepaliDate? _end;
  NepaliDate? _hovered;
  late RangePickerState _state;
  late String _lastSig;
  final List<void Function(RangePickerState)> _listeners = [];

  /// [initialStart]/[initialEnd] restore a range (an end needs a start and must
  /// not be before it). Other arguments are as for [DatePicker].
  factory RangePicker({
    NepaliDate? start,
    NepaliDate? end,
    NepaliDate? min,
    NepaliDate? max,
    String language = 'en',
    int weekStartsOn = 0,
    bool showAd = true,
    NepaliDate? today,
  }) {
    final inner = DatePicker(
      min: min,
      max: max,
      language: language,
      weekStartsOn: weekStartsOn,
      showAd: showAd,
      today: today,
    );
    return RangePicker._(inner, start, end);
  }

  RangePicker._(this._inner, NepaliDate? start, NepaliDate? end) {
    if (end != null && start == null) {
      throw InvalidDataException('end needs a start', end.toIsoString());
    }
    if (start != null && end != null && end.isBefore(start)) {
      throw InvalidDataException(
        'end is before start',
        '${start.toIsoString()} ${end.toIsoString()}',
      );
    }
    // Initial focus and the min/max check on the ends go through the inner picker.
    for (final d in [start, end]) {
      if (d != null) _inner.select(d);
    }
    _inner.clear();
    _start = start;
    _end = end;
    _state = _resolve();
    _lastSig = _sig();
  }

  RangePickerState get state => _state;

  /// Returns a function that unsubscribes.
  void Function() subscribe(void Function(RangePickerState) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  String _sig() {
    final s = _inner.state;
    return [
      s.view.name,
      s.visibleYear,
      s.visibleMonth,
      s.focused.toIsoString(),
      s.language,
      _start?.toIsoString() ?? '',
      _end?.toIsoString() ?? '',
      _hovered?.toIsoString() ?? '',
    ].join('|');
  }

  RangePickerState _resolve() {
    final base = _inner.state;
    final phase =
        _start != null && _end == null ? RangePhase.end : RangePhase.start;
    return RangePickerState._(
      base: base,
      start: _start,
      end: _end,
      phase: phase,
      complete: _start != null && _end != null,
      hovered: _hovered,
      previewEnd: phase == RangePhase.end ? (_hovered ?? base.focused) : null,
    );
  }

  /// Run an action; notify once if anything visible changed, even if it threw.
  void _run(void Function() fn) {
    try {
      fn();
    } finally {
      final now = _sig();
      if (now != _lastSig) {
        _lastSig = now;
        _state = _resolve();
        for (final l in List.of(_listeners)) {
          l(_state);
        }
      }
    }
  }

  /// Throws [OutOfRangeException] if [d] is outside min/max, before anything is
  /// changed.
  void _assertEnabled(NepaliDate d) {
    final s = _inner.state;
    final lo = s.min;
    final hi = s.max;
    if ((lo != null && d.isBefore(lo)) || (hi != null && d.isAfter(hi))) {
      throw OutOfRangeException('Date is outside min/max', d.toIsoString());
    }
  }

  void _select(NepaliDate date) {
    final d = NepaliDate.checked(date.year, date.month, date.day);
    _inner.select(d); // checks min/max, moves focus and the visible month
    _inner.clear(); // the range is ours; the inner single value stays empty
    final s = _start;
    if (s != null && _end == null && !d.isBefore(s)) {
      _end = d;
    } else {
      _start = d;
      _end = null;
    }
    _hovered = null;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  void prevMonth() => _run(_inner.prevMonth);
  void nextMonth() => _run(_inner.nextMonth);
  void goTo(int year, int month) => _run(() => _inner.goTo(year, month));
  void setView(PickerView view) => _run(() => _inner.setView(view));
  void moveFocus(FocusMove kind) => _run(() => _inner.moveFocus(kind));
  void setLanguage(String language) => _run(() => _inner.setLanguage(language));

  /// Click a day: see the selection rules. Throws [OutOfRangeException] for a
  /// disabled day.
  void select(NepaliDate date) => _run(() => _select(date));

  /// Select the focused day (Enter and Space).
  void selectFocused() => _run(() => _select(_inner.state.focused));

  void selectToday() => _run(() {
        _inner.selectToday();
        final t = _inner.state.focused;
        _inner.clear();
        _select(t);
      });

  /// Set both ends at once. Throws [InvalidDataException] if [start] is after
  /// [end].
  void setRange(NepaliDate start, NepaliDate end) => _run(() {
        final s = NepaliDate.checked(start.year, start.month, start.day);
        final e = NepaliDate.checked(end.year, end.month, end.day);
        if (e.isBefore(s)) {
          throw InvalidDataException(
            'end is before start',
            '${s.toIsoString()} ${e.toIsoString()}',
          );
        }
        _assertEnabled(s);
        _assertEnabled(e);
        _inner.select(s);
        _inner.select(e); // focus and the visible month end up on the end
        _inner.clear();
        _start = s;
        _end = e;
        _hovered = null;
      });

  /// The pointer is over a day (null: left the grid).
  void hover(NepaliDate? date) => _run(() {
        _hovered = date == null
            ? null
            : NepaliDate.checked(date.year, date.month, date.day);
      });

  /// Clear the range.
  void clear() => _run(() {
        _start = null;
        _end = null;
        _hovered = null;
      });

  // ── Cell props ─────────────────────────────────────────────────────────────

  RangePosition? _positionOf(NepaliDate d) {
    final s = _start;
    final e = _end;
    if (s == null) return null;
    if (e == null) return d.isSame(s) ? RangePosition.start : null;
    if (d.isSame(s) && d.isSame(e)) return RangePosition.single;
    if (d.isSame(s)) return RangePosition.start;
    if (d.isSame(e)) return RangePosition.end;
    return d.isAfter(s) && d.isBefore(e) ? RangePosition.middle : null;
  }

  /// ARIA attributes plus range position for a cell of `state.grid`.
  RangeCellProps getCellProps(GridCell<Object?> cell) {
    final base = _inner.getCellProps(cell);
    final d = cell.bs;
    if (d == null) {
      return RangeCellProps(base: base, rangePosition: null, inPreview: false);
    }
    final position = _positionOf(d);
    final s = _start;
    final preview = _state.previewEnd;
    final inPreview = _state.phase == RangePhase.end &&
        s != null &&
        preview != null &&
        d.isAfter(s) &&
        !d.isAfter(preview);
    return RangeCellProps(
      base: CellProps(
        role: base.role,
        ariaSelected: position != null,
        ariaDisabled: base.ariaDisabled,
        ariaLabel: base.ariaLabel,
        tabIndex: base.tabIndex,
      ),
      rangePosition: position,
      inPreview: inPreview,
    );
  }
}
