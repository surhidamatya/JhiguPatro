import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

import 'picker_parts.dart';
import 'theme.dart';

/// A Bikram Sambat month calendar with marked days and an events list. It is a
/// display and navigation widget (not a form field) on the headless
/// [DatePicker], so it behaves like the web `<jhigu-calendar>`.
///
/// The calendar must be initialised first (`NepaliCalendar.initialize`).
///
/// ```dart
/// JhiguCalendar(
///   language: 'ne',
///   events: {
///     '2082-06-03': ['Laxmi Puja'],
///     '2082-06-05': ['Bhai Tika', 'Holiday'],
///   },
///   onSelect: (date, titles) => print('$date $titles'),
/// )
/// ```
///
/// Marked days show a dot, and their titles are added to the day's spoken
/// label. The selected day's titles are listed under the grid ("No events" when
/// there are none). Keyboard and theming are as for [JhiguDatePicker].
class JhiguCalendar extends StatefulWidget {
  /// Titles by BS date text (`YYYY-MM-DD`, as `NepaliDate.toIsoString()` gives).
  /// Empty titles are ignored, and so are keys that are not valid dates.
  final Map<String, List<String>> events;

  /// The month to show first. Both must be given. Default: the month of
  /// [value], or today's month. Later changes move the view.
  final int? year;
  final int? month;

  /// The selected day. Optional: without it the calendar keeps the user's pick
  /// itself. When the parent changes it later, the calendar follows without
  /// calling [onSelect].
  final NepaliDate? value;

  /// Called when the user selects a day, with the titles marked on it.
  final void Function(NepaliDate date, List<String> events)? onSelect;

  /// Called when the shown month changes (by the user or by [year] and [month]).
  final void Function(int year, int month)? onMonthChanged;

  /// `'en'` or `'ne'`.
  final String language;

  /// First column: 0 is Sunday, 6 is Saturday.
  final int weekStartsOn;

  /// Show the AD day under each BS day.
  final bool showAd;

  /// The day marked as today. Default: today in Nepal. Pass it in tests.
  final NepaliDate? today;

  /// Take keyboard focus when first shown.
  final bool autofocus;

  const JhiguCalendar({
    super.key,
    this.events = const {},
    this.year,
    this.month,
    this.value,
    this.onSelect,
    this.onMonthChanged,
    this.language = 'en',
    this.weekStartsOn = 0,
    this.showAd = true,
    this.today,
    this.autofocus = false,
  });

  @override
  State<JhiguCalendar> createState() => _JhiguCalendarState();
}

class _JhiguCalendarState extends State<JhiguCalendar> {
  late DatePicker _picker;
  void Function()? _unsubscribe;
  final FocusNode _focus = FocusNode(debugLabel: 'JhiguCalendar');
  NepaliDate? _lastValue;
  String _lastMonth = '';
  Map<String, List<String>> _marks = const {};

  @override
  void initState() {
    super.initState();
    _marks = _clean(widget.events);
    _build(null, initial: true);
    _focus.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  static Map<String, List<String>> _clean(Map<String, List<String>> input) {
    final out = <String, List<String>>{};
    input.forEach((k, v) {
      final titles = [
        for (final t in v)
          if (t.trim().isNotEmpty) t
      ];
      if (titles.isNotEmpty && RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(k)) {
        out[k] = titles;
      }
    });
    return out;
  }

  /// A fresh state machine, optionally on [month]. On the first build, the
  /// `year` and `month` props pick the month.
  void _build(({int year, int month})? month, {bool initial = false}) {
    _unsubscribe?.call();
    _picker = DatePicker(
      value: widget.value,
      language: widget.language,
      weekStartsOn: widget.weekStartsOn,
      showAd: widget.showAd,
      today: widget.today,
    );
    final target = month ??
        (initial && widget.year != null && widget.month != null
            ? (year: widget.year!, month: widget.month!)
            : null);
    if (target != null) _guard(() => _picker.goTo(target.year, target.month));
    _lastValue = _picker.state.value;
    _lastMonth = '${_picker.state.visibleYear}-${_picker.state.visibleMonth}';
    _unsubscribe = _picker.subscribe(_onState);
  }

  void _onState(DatePickerState s) {
    if (!mounted) return;
    final valueChanged = !_same(s.value, _lastValue);
    final monthKey = '${s.visibleYear}-${s.visibleMonth}';
    final monthChanged = monthKey != _lastMonth;
    _lastValue = s.value;
    _lastMonth = monthKey;
    setState(() {});
    if (monthChanged) {
      widget.onMonthChanged?.call(s.visibleYear, s.visibleMonth);
    }
    if (valueChanged && s.value != null) {
      widget.onSelect?.call(s.value!, _titles(s.value!));
    }
  }

  List<String> _titles(NepaliDate d) => _marks[d.toIsoString()] ?? const [];

  static bool _same(NepaliDate? a, NepaliDate? b) =>
      a == null || b == null ? a == b : a.isSame(b);

  @override
  void didUpdateWidget(JhiguCalendar old) {
    super.didUpdateWidget(old);
    _marks = _clean(widget.events);
    if (old.weekStartsOn != widget.weekStartsOn ||
        old.showAd != widget.showAd ||
        old.today != widget.today) {
      final s = _picker.state;
      _build((year: s.visibleYear, month: s.visibleMonth));
      return;
    }
    if (old.language != widget.language) _picker.setLanguage(widget.language);
    if (widget.year != null &&
        widget.month != null &&
        (old.year != widget.year || old.month != widget.month)) {
      _guard(() => _picker.goTo(widget.year!, widget.month!));
    }
    // Follow the parent only when it changes `value`. A calendar is often used
    // without one, and a rebuild must not clear what the user picked.
    if (!_same(old.value, widget.value) &&
        !_same(widget.value, _picker.state.value)) {
      _lastValue = widget.value;
      if (widget.value == null) {
        _picker.clear();
      } else {
        _guard(() => _picker.select(widget.value!));
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

  void _guard(void Function() f) {
    try {
      f();
    } on JhiguException {
      // A month outside the calendar data: ignore.
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
        _picker.select(_picker.state.focused);
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
    final textStyle = Theme.of(context).textTheme.bodyMedium;

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

    final selected = s.value;
    final Widget events = selected == null
        ? const SizedBox.shrink()
        : _eventsList(s, t, selected, strings.noEvents);

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
            children: [header, body, events],
          ),
        ),
      ),
    );
  }

  Widget _eventsList(
      DatePickerState s, ResolvedJhiguTheme t, NepaliDate d, String none) {
    final titles = _titles(d);
    final heading = formatPreset(d, DatePreset.dual, language: s.language);
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.only(top: 8),
        decoration: BoxDecoration(
          border:
              Border(top: BorderSide(color: t.muted.withValues(alpha: 0.3))),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(heading, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            if (titles.isEmpty)
              Text(none, style: TextStyle(color: t.muted))
            else
              for (final title in titles) Text('• $title'),
          ],
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
    final titles = _titles(d);
    final marked = titles.isNotEmpty;
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
      child: Stack(
        // Fill the cell, so the dot sits in its corner and not at the digits.
        fit: StackFit.expand,
        alignment: Alignment.center,
        children: [
          FittedBox(
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
          if (marked)
            Positioned(
              top: 4,
              right: 4,
              child: Container(
                key: const ValueKey('jhigu-mark'),
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? t.onPrimary : t.holiday,
                ),
              ),
            ),
        ],
      ),
    );

    return Semantics(
      button: true,
      selected: selected,
      label: marked ? '${p.ariaLabel}. ${titles.join(', ')}' : p.ariaLabel,
      excludeSemantics: true,
      onTap: () => _tapDay(d),
      child: InkWell(
        borderRadius: BorderRadius.circular(t.radius),
        onTap: () => _tapDay(d),
        child: content,
      ),
    );
  }

  void _tapDay(NepaliDate d) {
    _focus.requestFocus();
    _guard(() => _picker.select(d));
  }
}
