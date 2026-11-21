import 'package:flutter/material.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

import 'dialogs.dart';

/// A read-only text field that shows a BS date and opens [showJhiguDatePicker]
/// when tapped. Use it as a form field for a date of birth, a due date and so on.
///
/// ```dart
/// JhiguDateField(
///   value: _date,
///   language: 'ne',
///   decoration: const InputDecoration(labelText: 'Date of birth'),
///   onChanged: (d) => setState(() => _date = d),
/// )
/// ```
///
/// [onChanged] gets the chosen day, or null when the user clears the field with
/// the clear button. The text uses [format] (the `formatDate` tokens, default
/// `D MMMM YYYY`) in [language]; an empty field shows "Select a date" in that
/// language. [value] is optional: without it the field keeps the user's pick.
/// When the parent changes it, the field follows without calling [onChanged].
class JhiguDateField extends StatefulWidget {
  final NepaliDate? value;
  final ValueChanged<NepaliDate?>? onChanged;
  final NepaliDate? min;
  final NepaliDate? max;

  /// `'en'` or `'ne'`.
  final String language;
  final int weekStartsOn;
  final bool showAd;
  final NepaliDate? today;

  /// `formatDate` tokens for the text in the field.
  final String format;
  final InputDecoration? decoration;
  final TextStyle? style;
  final bool enabled;

  /// Show the clear button when there is a value.
  final bool clearable;

  const JhiguDateField({
    super.key,
    this.value,
    this.onChanged,
    this.min,
    this.max,
    this.language = 'en',
    this.weekStartsOn = 0,
    this.showAd = true,
    this.today,
    this.format = 'D MMMM YYYY',
    this.decoration,
    this.style,
    this.enabled = true,
    this.clearable = true,
  });

  @override
  State<JhiguDateField> createState() => _JhiguDateFieldState();
}

class _JhiguDateFieldState extends State<JhiguDateField> {
  late final TextEditingController _controller;
  NepaliDate? _value;

  @override
  void initState() {
    super.initState();
    _value = widget.value;
    _controller = TextEditingController(text: _text());
  }

  String _text() => _value == null
      ? ''
      : formatDate(_value!, widget.format, language: widget.language);

  void _show() {
    final t = _text();
    if (_controller.text != t) _controller.text = t;
  }

  @override
  void didUpdateWidget(JhiguDateField old) {
    super.didUpdateWidget(old);
    final a = old.value;
    final b = widget.value;
    final parentChanged = a == null || b == null ? a != b : !a.isSame(b);
    if (parentChanged) _value = b;
    _show();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final picked = await showJhiguDatePicker(
      context: context,
      initial: _value,
      min: widget.min,
      max: widget.max,
      language: widget.language,
      weekStartsOn: widget.weekStartsOn,
      showAd: widget.showAd,
      today: widget.today,
    );
    if (picked == null || !mounted) return;
    setState(() => _value = picked);
    _show();
    widget.onChanged?.call(picked);
  }

  void _clear() {
    setState(() => _value = null);
    _show();
    widget.onChanged?.call(null);
  }

  @override
  Widget build(BuildContext context) {
    final strings = getStrings(widget.language).picker;
    final base = widget.decoration ?? const InputDecoration();
    final decoration = base.copyWith(
      hintText: base.hintText ?? strings.placeholder,
      suffixIcon: base.suffixIcon ??
          (widget.clearable && _value != null && widget.enabled
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  tooltip: strings.clear,
                  onPressed: _clear,
                )
              : const Icon(Icons.calendar_today)),
    );
    return TextField(
      controller: _controller,
      readOnly: true,
      // Nothing to select or paste: the text is only a display of the value.
      enableInteractiveSelection: false,
      enabled: widget.enabled,
      style: widget.style,
      decoration: decoration,
      onTap: _open,
    );
  }
}
