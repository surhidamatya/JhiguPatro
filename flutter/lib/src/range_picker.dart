import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

import 'picker_parts.dart';
import 'theme.dart';

/// A Bikram Sambat date range picker, drawn inline. It is a view over the
/// headless [RangePicker], so it follows the same rules as the web
/// `<jhigu-date-range-picker>`:
///
/// - The first tap sets the start. A second tap on or after it sets the end. A
///   second tap before the start restarts from that day. A tap on a complete
///   range starts a new one.
/// - While choosing the end, days up to the hovered day (or the keyboard-focused
///   day) are shown as a preview.
///
/// The calendar must be initialised first (`NepaliCalendar.initialize`).
///
/// ```dart
/// JhiguRangePicker(
///   start: _start,
///   end: _end,
///   onChanged: (s, e) => setState(() { _start = s; _end = e; }),
/// )
/// ```
///
/// [onChanged] is called whenever the start or the end changes: with a start and
/// no end after the first tap, with both after the second, and with two nulls
/// after Clear. Keyboard and theming are as for [JhiguDatePicker].
class JhiguRangePicker extends StatefulWidget {
  /// The chosen start and end. Optional: without them the picker keeps the
  /// user's choice itself. When the parent changes them later, the picker
  /// follows without calling [onChanged]. An end needs a start and must not be
  /// before it, or building the widget throws an [InvalidDataException].
  final NepaliDate? start;
  final NepaliDate? end;

  /// Called when the start or the end changes.
  final void Function(NepaliDate? start, NepaliDate? end)? onChanged;

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

  /// Show the Today and Clear buttons and the summary line.
  final bool showFooter;

  /// Take keyboard focus when first shown.
  final bool autofocus;

  const JhiguRangePicker({
    super.key,
    this.start,
    this.end,
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
  State<JhiguRangePicker> createState() => _JhiguRangePickerState();
}

class _JhiguRangePickerState extends State<JhiguRangePicker> {
  late RangePicker _picker;
  void Function()? _unsubscribe;
  final FocusNode _focus = FocusNode(debugLabel: 'JhiguRangePicker');
  NepaliDate? _lastStart;
  NepaliDate? _lastEnd;

  /// True while following the parent: its changes must not call [onChanged].
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    _build(null);
    _focus.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  void _build(({int year, int month})? month) {
    _unsubscribe?.call();
    _picker = RangePicker(
      start: widget.start,
      end: widget.end,
      min: widget.min,
      max: widget.max,
      language: widget.language,
      weekStartsOn: widget.weekStartsOn,
      showAd: widget.showAd,
      today: widget.today,
    );
    if (month != null) _guard(() => _picker.goTo(month.year, month.month));
    _lastStart = _picker.state.start;
    _lastEnd = _picker.state.end;
    _unsubscribe = _picker.subscribe(_onState);
  }

  void _onState(RangePickerState s) {
    if (!mounted) return;
    final changed = !_same(s.start, _lastStart) || !_same(s.end, _lastEnd);
    _lastStart = s.start;
    _lastEnd = s.end;
    setState(() {});
    if (changed && !_syncing) widget.onChanged?.call(s.start, s.end);
  }

  static bool _same(NepaliDate? a, NepaliDate? b) =>
      a == null || b == null ? a == b : a.isSame(b);

  @override
  void didUpdateWidget(JhiguRangePicker old) {
    super.didUpdateWidget(old);
    if (old.min != widget.min ||
        old.max != widget.max ||
        old.weekStartsOn != widget.weekStartsOn ||
        old.showAd != widget.showAd ||
        old.today != widget.today) {
      final s = _picker.state;
      _build((year: s.visibleYear, month: s.visibleMonth));
      return;
    }
    if (old.language != widget.language) _picker.setLanguage(widget.language);
    // Follow the parent only when it changes start or end, so a parent that does
    // not pass them does not clear the user's choice on a rebuild.
    final parentChanged =
        !_same(old.start, widget.start) || !_same(old.end, widget.end);
    final s = _picker.state;
    if (parentChanged &&
        (!_same(widget.start, s.start) || !_same(widget.end, s.end))) {
      final ws = widget.start;
      final we = widget.end;
      _syncing = true;
      try {
        if (ws == null) {
          _picker.clear();
        } else if (we == null) {
          _picker.clear();
          _guard(() => _picker.select(ws));
        } else {
          _guard(() => _picker.setRange(ws, we));
        }
      } finally {
        _syncing = false;
      }
      _lastStart = _picker.state.start;
      _lastEnd = _picker.state.end;
    }
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    _focus.removeListener(_refresh);
    _focus.dispose();
    super.dispose();
  }

  void _guard(void Function() f) {
    try {
      f();
    } on JhiguException {
      // A disabled day or a month outside the calendar data: ignore.
    }
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is KeyUpEvent) return KeyEventResult.ignored;
    if (_picker.state.view != PickerView.days) return KeyEventResult.ignored;
    final name = pickerKeyName(event.logicalKey);
    if (name == null) return KeyEventResult.ignored;
    final action =
        keyAction(name, shift: HardwareKeyboard.instance.isShiftPressed);
    if (action == null || action == KeyAction.close) {
      return KeyEventResult.ignored;
    }
    _guard(() {
      if (action == KeyAction.select) {
        _picker.selectFocused();
      } else {
        _picker.moveFocus(action.focusMove!);
      }
    });
    return KeyEventResult.handled;
  }

  void _cycleView() {
    _picker.setView(switch (_picker.state.view) {
      PickerView.days => PickerView.months,
      PickerView.months => PickerView.years,
      PickerView.years => PickerView.days,
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = _picker.state;
    final t = JhiguTheme.of(context);
    final strings = getStrings(s.language).picker;

    final Widget body;
    switch (s.view) {
      case PickerView.days:
        body = _days(s, t);
      case PickerView.months:
        body = PickerChoices(theme: t, items: [
          for (final m in s.months)
            PickerChoice(
              label: m.label,
              selected: m.month == s.visibleMonth,
              disabled: m.disabled,
              onTap: () => _guard(() {
                _picker.goTo(s.visibleYear, m.month);
                _picker.setView(PickerView.days);
              }),
            ),
        ]);
      case PickerView.years:
        body = PickerChoices(theme: t, items: [
          for (final y in s.years)
            PickerChoice(
              label: y.label,
              selected: y.year == s.visibleYear,
              disabled: y.disabled,
              onTap: () => _guard(() {
                _picker.goTo(y.year, s.visibleMonth);
                _picker.setView(PickerView.months);
              }),
            ),
        ]);
    }

    final header = PickerHeader(
      theme: t,
      title: s.title,
      paging: s.view == PickerView.days,
      canGoPrev: s.canGoPrev,
      canGoNext: s.canGoNext,
      previousLabel: strings.previousMonth,
      nextLabel: strings.nextMonth,
      onPrev: () => _guard(_picker.prevMonth),
      onNext: () => _guard(_picker.nextMonth),
      onTitle: _cycleView,
    );

    final Widget footer = widget.showFooter
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _summary(s, t),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
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

  /// "start – end", "start – …" while choosing the end, or nothing.
  Widget _summary(RangePickerState s, ResolvedJhiguTheme t) {
    final start = s.start;
    if (start == null) return const SizedBox(height: 8);
    final end = s.end;
    String f(NepaliDate d) =>
        formatPreset(d, DatePreset.dual, language: s.language);
    return Semantics(
      liveRegion: true,
      container: true,
      child: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(
          '${f(start)} – ${end == null ? '…' : f(end)}',
          style: TextStyle(color: t.muted, fontSize: 12),
        ),
      ),
    );
  }

  Widget _days(RangePickerState s, ResolvedJhiguTheme t) {
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
    // Leaving the grid clears the hover preview.
    return MouseRegion(
      onExit: (_) => _picker.hover(null),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: weekdays),
          for (final row in s.grid)
            Row(children: [
              for (final cell in row) Expanded(child: _cell(s, t, cell))
            ]),
        ],
      ),
    );
  }

  Widget _cell(
      RangePickerState s, ResolvedJhiguTheme t, GridCell<Object?> cell) {
    final d = cell.bs;
    if (d == null || !cell.inMonth) return const SizedBox(height: 46);
    final p = _picker.getCellProps(cell);
    final pos = p.rangePosition;
    final disabled = p.ariaDisabled;
    final isEnd = pos == RangePosition.start ||
        pos == RangePosition.end ||
        pos == RangePosition.single;
    final middle = pos == RangePosition.middle;
    final focusedDay = _focus.hasFocus && d.isSame(s.focused);
    final dayText = formatDate(d, 'D', language: s.language);

    final fg = isEnd ? t.onPrimary : (cell.isWeekend ? t.holiday : t.text);
    // The band behind the days between the ends, and a lighter one for the
    // preview, run edge to edge so they read as one stripe.
    final band = middle
        ? t.primary.withValues(alpha: 0.22)
        : (p.inPreview && !isEnd ? t.primary.withValues(alpha: 0.10) : null);

    final content = Container(
      key: pos != null
          ? ValueKey('range-${pos.name}')
          : (p.inPreview ? const ValueKey('range-preview') : null),
      height: 46,
      alignment: Alignment.center,
      margin: const EdgeInsets.symmetric(vertical: 1),
      decoration: BoxDecoration(
        color: isEnd ? t.primary : band,
        // Square only where a band runs edge to edge.
        borderRadius:
            BorderRadius.circular(band == null || isEnd ? t.radius : 0),
        border: focusedDay
            ? Border.all(color: t.primary, width: 2)
            : cell.isToday
                ? Border.all(color: t.today, width: 2)
                : null,
      ),
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
                    color: isEnd ? t.onPrimary : t.muted,
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
      selected: p.ariaSelected,
      enabled: !disabled,
      label: p.ariaLabel,
      excludeSemantics: true,
      onTap: disabled ? null : () => _tapDay(d),
      child: Opacity(
        opacity: disabled ? 0.35 : 1,
        child: MouseRegion(
          onEnter: (_) {
            if (!disabled) _picker.hover(d);
          },
          child: InkWell(
            borderRadius: BorderRadius.circular(t.radius),
            onTap: disabled ? null : () => _tapDay(d),
            child: content,
          ),
        ),
      ),
    );
  }

  void _tapDay(NepaliDate d) {
    _focus.requestFocus();
    _guard(() => _picker.select(d));
  }
}
