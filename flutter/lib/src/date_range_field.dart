import 'package:flutter/material.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

import 'dialogs.dart';

/// A read-only text field that shows a BS date range ("10 Bhadra 2082 –
/// 15 Bhadra 2082") and opens [showJhiguDateRangePicker] when tapped. The range
/// counterpart of `JhiguDateField`.
///
/// ```dart
/// JhiguDateRangeField(
///   start: _start,
///   end: _end,
///   decoration: const InputDecoration(labelText: 'Stay'),
///   onChanged: (s, e) => setState(() { _start = s; _end = e; }),
/// )
/// ```
///
/// [onChanged] gets a start and an end together when the user picks a range (the
/// dialog only returns complete ranges), or two nulls when they clear the field.
/// [start] and [end] are optional: without them the field keeps the user's pick.
/// When the parent changes them, the field follows without calling [onChanged].
/// An end without a start, or before it, is ignored by the dialog's rules and
/// throws an [InvalidDataException] when the dialog opens. An empty field shows
/// "Select a date" in [language] (the string tables have no range wording).
class JhiguDateRangeField extends StatefulWidget {
  final NepaliDate? start;
  final NepaliDate? end;
  final void Function(NepaliDate? start, NepaliDate? end)? onChanged;
  final NepaliDate? min;
  final NepaliDate? max;

  /// `'en'` or `'ne'`.
  final String language;
  final int weekStartsOn;
  final bool showAd;
  final NepaliDate? today;

  /// `formatDate` tokens for each date in the field.
  final String format;

  /// Text between the two dates.
  final String separator;
  final InputDecoration? decoration;
  final TextStyle? style;
  final bool enabled;

  /// Show the clear button when there is a range.
  final bool clearable;

  const JhiguDateRangeField({
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
    this.format = 'D MMMM YYYY',
    this.separator = ' – ',
    this.decoration,
    this.style,
    this.enabled = true,
    this.clearable = true,
  });

  @override
  State<JhiguDateRangeField> createState() => _JhiguDateRangeFieldState();
}

class _JhiguDateRangeFieldState extends State<JhiguDateRangeField> {
  late final TextEditingController _controller;
  NepaliDate? _start;
  NepaliDate? _end;

  @override
  void initState() {
    super.initState();
    _start = widget.start;
    _end = widget.end;
    _controller = TextEditingController(text: _text());
  }

  String _text() {
    final s = _start;
    if (s == null) return '';
    String f(NepaliDate d) =>
        formatDate(d, widget.format, language: widget.language);
    final e = _end;
    return e == null ? f(s) : '${f(s)}${widget.separator}${f(e)}';
  }

  void _show() {
    final t = _text();
    if (_controller.text != t) _controller.text = t;
  }

  static bool _same(NepaliDate? a, NepaliDate? b) =>
      a == null || b == null ? a == b : a.isSame(b);

  @override
  void didUpdateWidget(JhiguDateRangeField old) {
    super.didUpdateWidget(old);
    // Follow the parent only when it changes start or end.
    if (!_same(old.start, widget.start) || !_same(old.end, widget.end)) {
      _start = widget.start;
      _end = widget.end;
    }
    _show();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final picked = await showJhiguDateRangePicker(
      context: context,
      initialStart: _start,
      initialEnd: _end,
      min: widget.min,
      max: widget.max,
      language: widget.language,
      weekStartsOn: widget.weekStartsOn,
      showAd: widget.showAd,
      today: widget.today,
    );
    if (picked == null || !mounted) return;
    setState(() {
      _start = picked.start;
      _end = picked.end;
    });
    _show();
    widget.onChanged?.call(picked.start, picked.end);
  }

  void _clear() {
    setState(() {
      _start = null;
      _end = null;
    });
    _show();
    widget.onChanged?.call(null, null);
  }

  @override
  Widget build(BuildContext context) {
    final strings = getStrings(widget.language).picker;
    final base = widget.decoration ?? const InputDecoration();
    final decoration = base.copyWith(
      hintText: base.hintText ?? strings.placeholder,
      suffixIcon: base.suffixIcon ??
          (widget.clearable && _start != null && widget.enabled
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  tooltip: strings.clear,
                  onPressed: _clear,
                )
              : const Icon(Icons.date_range)),
    );
    return TextField(
      controller: _controller,
      readOnly: true,
      enableInteractiveSelection: false,
      enabled: widget.enabled,
      style: widget.style,
      decoration: decoration,
      onTap: _open,
    );
  }
}
