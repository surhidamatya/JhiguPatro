import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

import 'theme.dart';

/// A Bikram Sambat date picker, drawn inline (put it in a dialog or a popup
/// yourself). It is a thin view over the headless [DatePicker] state machine from
/// `jhigu_patro_utils`, so it behaves exactly like the web component.
///
/// The calendar must be initialised first (`NepaliCalendar.initialize`).
///
/// ```dart
/// JhiguDatePicker(
///   value: _date,
///   language: 'ne',
///   min: NepaliDate.checked(2080, 1, 1),
///   onChanged: (d) => setState(() => _date = d),
/// )
/// ```
///
/// - Tap a day to select it. The title opens the month list, then the year
///   list. Days outside [min] and [max] are disabled.
/// - Keyboard (when focused): arrows move a day or a week, Home and End go to
///   the start and end of the week, Page Up and Page Down change the month
///   (with Shift, the year), Enter and Space select.
/// - Every day cell is a button with a full spoken label (weekday, date, and
///   the AD date when [showAd]).
/// - Style it with a [JhiguTheme] in `ThemeData.extensions`.
class JhiguDatePicker extends StatefulWidget {
  /// The selected date. When the parent passes a different value later, the
  /// picker follows it (and does not call [onChanged] for that).
  final NepaliDate? value;

  /// Called when the user selects or clears a date.
  final ValueChanged<NepaliDate?>? onChanged;

  final NepaliDate? min;
  final NepaliDate? max;

  /// `'en'` or `'ne'`.
  final String language;

  /// First column: 0 is Sunday, 6 is Saturday.
  final int weekStartsOn;

  /// Show the AD day under each BS day, and the AD date in the spoken label.
  final bool showAd;

  /// The day marked as today. Default: today in Nepal. Pass it in tests.
  final NepaliDate? today;

  /// Show the Today and Clear buttons.
  final bool showFooter;

  /// Take keyboard focus when first shown.
  final bool autofocus;

  const JhiguDatePicker({
    super.key,
    this.value,
    this.onChanged,
    this.min,
    this.max,
    this.language = 'en',
    this.weekStartsOn = 0,
    this.showAd = true,
    this.today,
    this.showFooter = true,
    this.autofocus = false,
  });

  @override
  State<JhiguDatePicker> createState() => _JhiguDatePickerState();
}

class _JhiguDatePickerState extends State<JhiguDatePicker> {
  late DatePicker _picker;
  void Function()? _unsubscribe;
  final FocusNode _focus = FocusNode(debugLabel: 'JhiguDatePicker');
  NepaliDate? _lastValue;

  @override
  void initState() {
    super.initState();
    _build(null);
    _focus.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  /// A fresh state machine from the widget's options, optionally on [month].
  void _build(({int year, int month})? month) {
    _unsubscribe?.call();
    _picker = DatePicker(
      value: widget.value,
      min: widget.min,
      max: widget.max,
      language: widget.language,
      weekStartsOn: widget.weekStartsOn,
      showAd: widget.showAd,
      today: widget.today,
    );
    if (month != null) _picker.goTo(month.year, month.month);
    _lastValue = _picker.state.value;
    _unsubscribe = _picker.subscribe(_onState);
  }

  void _onState(DatePickerState s) {
    if (!mounted) return;
    final changed = !_same(s.value, _lastValue);
    _lastValue = s.value;
    setState(() {});
    if (changed) widget.onChanged?.call(s.value);
  }

  static bool _same(NepaliDate? a, NepaliDate? b) =>
      a == null || b == null ? a == b : a.isSame(b);

  @override
  void didUpdateWidget(JhiguDatePicker old) {
    super.didUpdateWidget(old);
    final optionsChanged = old.min != widget.min ||
        old.max != widget.max ||
        old.weekStartsOn != widget.weekStartsOn ||
        old.showAd != widget.showAd ||
        old.today != widget.today;
    if (optionsChanged) {
      final s = _picker.state;
      _build((year: s.visibleYear, month: s.visibleMonth));
      return;
    }
    if (old.language != widget.language) _picker.setLanguage(widget.language);
    if (!_same(widget.value, _picker.state.value)) {
      // The parent changed the value: follow it without calling onChanged.
      _lastValue = widget.value;
      if (widget.value == null) {
        _picker.clear();
      } else {
        try {
          _picker.select(widget.value!);
        } on JhiguException {
          // A value outside min/max is ignored, as the picker would not allow it.
        }
      }
    }
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    _focus.removeListener(_refresh);
    _focus.dispose();
    super.dispose();
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  static String? _keyName(LogicalKeyboardKey k) {
    if (k == LogicalKeyboardKey.arrowLeft) return 'ArrowLeft';
    if (k == LogicalKeyboardKey.arrowRight) return 'ArrowRight';
    if (k == LogicalKeyboardKey.arrowUp) return 'ArrowUp';
    if (k == LogicalKeyboardKey.arrowDown) return 'ArrowDown';
    if (k == LogicalKeyboardKey.home) return 'Home';
    if (k == LogicalKeyboardKey.end) return 'End';
    if (k == LogicalKeyboardKey.pageUp) return 'PageUp';
    if (k == LogicalKeyboardKey.pageDown) return 'PageDown';
    if (k == LogicalKeyboardKey.enter || k == LogicalKeyboardKey.numpadEnter) {
      return 'Enter';
    }
    if (k == LogicalKeyboardKey.space) return ' ';
    return null;
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is KeyUpEvent) return KeyEventResult.ignored;
    if (_picker.state.view != PickerView.days) return KeyEventResult.ignored;
    final name = _keyName(event.logicalKey);
    if (name == null) return KeyEventResult.ignored;
    final action =
        keyAction(name, shift: HardwareKeyboard.instance.isShiftPressed);
    if (action == null || action == KeyAction.close) {
      return KeyEventResult.ignored;
    }
    try {
      if (action == KeyAction.select) {
        _picker.select(_picker.state.focused);
      } else {
        _picker.moveFocus(action.focusMove!);
      }
    } on JhiguException {
      // Disabled day or edge of the data: nothing to do.
    }
    return KeyEventResult.handled;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  void _guard(void Function() f) {
    try {
      f();
    } on JhiguException {
      // A disabled date or a month outside the calendar data: ignore.
    }
  }

  void _cycleView() {
    final v = _picker.state.view;
    _picker.setView(switch (v) {
      PickerView.days => PickerView.months,
      PickerView.months => PickerView.years,
      PickerView.years => PickerView.days,
    });
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final s = _picker.state;
    final t = JhiguTheme.of(context);
    final strings = getStrings(s.language).picker;
    final textStyle = Theme.of(context).textTheme.bodyMedium;

    Widget body;
    switch (s.view) {
      case PickerView.days:
        body = _days(s, t);
      case PickerView.months:
        body = _choices(
          t,
          [
            for (final m in s.months)
              _Choice(
                label: m.label,
                selected: m.month == s.visibleMonth,
                disabled: m.disabled,
                onTap: () => _guard(() {
                  _picker.goTo(s.visibleYear, m.month);
                  _picker.setView(PickerView.days);
                }),
              ),
          ],
        );
      case PickerView.years:
        body = _choices(
          t,
          [
            for (final y in s.years)
              _Choice(
                label: y.label,
                selected: y.year == s.visibleYear,
                disabled: y.disabled,
                onTap: () => _guard(() {
                  _picker.goTo(y.year, s.visibleMonth);
                  _picker.setView(PickerView.months);
                }),
              ),
          ],
        );
    }

    final paging = s.view == PickerView.days;
    final header = Row(
      children: [
        if (paging)
          IconButton(
            icon: const Icon(Icons.chevron_left),
            tooltip: strings.previousMonth,
            onPressed: s.canGoPrev ? () => _guard(_picker.prevMonth) : null,
          )
        else
          const SizedBox(width: 48),
        Expanded(
          child: Semantics(
            liveRegion: true,
            child: TextButton(
              onPressed: _cycleView,
              child: Text(
                s.title,
                style: textStyle?.copyWith(
                    fontWeight: FontWeight.w600, color: t.text),
              ),
            ),
          ),
        ),
        if (paging)
          IconButton(
            icon: const Icon(Icons.chevron_right),
            tooltip: strings.nextMonth,
            onPressed: s.canGoNext ? () => _guard(_picker.nextMonth) : null,
          )
        else
          const SizedBox(width: 48),
      ],
    );

    final footer = widget.showFooter
        ? Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () => _guard(_picker.selectToday),
                child: Text(strings.today),
              ),
              TextButton(
                onPressed: _picker.clear,
                child: Text(strings.clear),
              ),
            ],
          )
        : const SizedBox.shrink();

    return Focus(
      focusNode: _focus,
      autofocus: widget.autofocus,
      onKeyEvent: _onKey,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(t.radius),
          border: Border.all(color: t.muted.withValues(alpha: 0.35)),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: t.text),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [header, body, footer],
          ),
        ),
      ),
    );
  }

  Widget _days(DatePickerState s, ResolvedJhiguTheme t) {
    final weekdays = Row(
      children: [
        for (final w in s.weekdays)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                w,
                textAlign: TextAlign.center,
                style: TextStyle(color: t.muted, fontSize: 12),
              ),
            ),
          ),
      ],
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(child: weekdays),
        for (final row in s.grid)
          Row(children: [
            for (final cell in row) Expanded(child: _cell(s, t, cell))
          ]),
      ],
    );
  }

  Widget _cell(
      DatePickerState s, ResolvedJhiguTheme t, GridCell<Object?> cell) {
    final d = cell.bs;
    if (d == null || !cell.inMonth) return const SizedBox(height: 46);
    final p = _picker.getCellProps(cell);
    final selected = p.ariaSelected;
    final disabled = p.ariaDisabled;
    final focusedDay = _focus.hasFocus && d.isSame(s.focused);
    final dayText = formatDate(d, 'D', language: s.language);

    final fg = selected ? t.onPrimary : (cell.isWeekend ? t.holiday : t.text);
    final content = Container(
      height: 46,
      alignment: Alignment.center,
      margin: const EdgeInsets.all(1),
      decoration: BoxDecoration(
        color: selected ? t.primary : null,
        borderRadius: BorderRadius.circular(t.radius),
        border: focusedDay
            ? Border.all(color: t.primary, width: 2)
            : cell.isToday
                ? Border.all(color: t.today, width: 2)
                : null,
      ),
      // Scale the numbers down rather than overflow on narrow screens or with
      // large text sizes.
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(dayText, style: TextStyle(color: fg, fontSize: 15)),
              if (s.showAd && cell.ad != null)
                Text(
                  '${cell.ad!.day}',
                  style: TextStyle(
                    color: selected ? t.onPrimary : t.muted,
                    fontSize: 9,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
    return Semantics(
      button: true,
      selected: selected,
      enabled: !disabled,
      label: p.ariaLabel,
      excludeSemantics: true,
      onTap: disabled ? null : () => _tapDay(d),
      child: Opacity(
        opacity: disabled ? 0.35 : 1,
        child: InkWell(
          borderRadius: BorderRadius.circular(t.radius),
          onTap: disabled ? null : () => _tapDay(d),
          child: content,
        ),
      ),
    );
  }

  void _tapDay(NepaliDate d) {
    _focus.requestFocus();
    _guard(() => _picker.select(d));
  }

  Widget _choices(ResolvedJhiguTheme t, List<_Choice> items) {
    return Wrap(
      children: [
        for (final c in items)
          SizedBox(
            width: 340 / 3 - 8,
            child: Padding(
              padding: const EdgeInsets.all(2),
              child: c.selected
                  ? FilledButton(
                      onPressed: c.disabled ? null : c.onTap,
                      style: FilledButton.styleFrom(
                        backgroundColor: t.primary,
                        foregroundColor: t.onPrimary,
                      ),
                      child: Text(c.label),
                    )
                  : TextButton(
                      onPressed: c.disabled ? null : c.onTap,
                      child: Text(c.label),
                    ),
            ),
          ),
      ],
    );
  }
}

class _Choice {
  final String label;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;
  const _Choice({
    required this.label,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });
}
