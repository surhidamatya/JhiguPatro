import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

/// Runs every edit through a headless state machine: [reshape] gets the raw
/// text and caret and returns what the field must show.
class _ReshapeFormatter extends TextInputFormatter {
  final ({String text, int caret}) Function(String raw, int caret) reshape;
  const _ReshapeFormatter(this.reshape);

  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final raw = newValue.text;
    final sel = newValue.selection;
    final caret =
        sel.isValid ? sel.extentOffset.clamp(0, raw.length) : raw.length;
    final r = reshape(raw, caret);
    return TextEditingValue(
      text: r.text,
      selection:
          TextSelection.collapsed(offset: r.caret.clamp(0, r.text.length)),
    );
  }
}

/// A money amount field in Nepali rupees, over the headless [MoneyInput]. It
/// groups digits the Nepali way (12,34,567.50) as you type and keeps the caret
/// in place, accepts Devanagari digits, drops a leading `Rs.`, `NPR` or `रु`,
/// allows two decimals, and pads to two decimals when the field loses focus.
/// The amount is integer paisa ([Npr]), never a float.
///
/// ```dart
/// JhiguMoneyField(
///   value: _amount,
///   decoration: const InputDecoration(labelText: 'Amount', prefixText: 'Rs. '),
///   onChanged: (a) => setState(() => _amount = a),
/// )
/// ```
///
/// [onChanged] gets the amount, or null while the field is empty. [value] is
/// optional; when the parent changes it, the field follows without calling
/// [onChanged]. Set [digits] to [MoneyDigits.native] to show Devanagari digits.
class JhiguMoneyField extends StatefulWidget {
  final Npr? value;
  final ValueChanged<Npr?>? onChanged;
  final MoneyDigits digits;
  final bool allowNegative;
  final InputDecoration? decoration;
  final TextStyle? style;
  final TextAlign textAlign;
  final bool enabled;
  final bool autofocus;
  final FocusNode? focusNode;

  const JhiguMoneyField({
    super.key,
    this.value,
    this.onChanged,
    this.digits = MoneyDigits.ascii,
    this.allowNegative = false,
    this.decoration,
    this.style,
    this.textAlign = TextAlign.start,
    this.enabled = true,
    this.autofocus = false,
    this.focusNode,
  });

  @override
  State<JhiguMoneyField> createState() => _JhiguMoneyFieldState();
}

class _JhiguMoneyFieldState extends State<JhiguMoneyField> {
  late MoneyInput _input;
  late final TextEditingController _controller;
  FocusNode? _ownFocus;
  void Function()? _unsubscribe;
  Npr? _lastValue;
  bool _inEdit = false;

  FocusNode get _focus => widget.focusNode ?? (_ownFocus ??= FocusNode());

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _build();
    _focus.addListener(_onFocus);
  }

  void _build() {
    _unsubscribe?.call();
    _input = MoneyInput(
      value: widget.value,
      digits: widget.digits,
      allowNegative: widget.allowNegative,
    );
    _lastValue = _input.state.value;
    _unsubscribe = _input.subscribe(_onState);
    _show();
  }

  void _show() {
    final s = _input.state;
    if (_controller.text != s.text ||
        _controller.selection.baseOffset != s.caret) {
      _controller.value = TextEditingValue(
        text: s.text,
        selection: TextSelection.collapsed(offset: s.caret),
      );
    }
  }

  void _onState(MoneyInputState s) {
    if (!mounted) return;
    if (!_inEdit) _show();
    if (s.value != _lastValue) {
      _lastValue = s.value;
      widget.onChanged?.call(s.value);
    }
  }

  void _onFocus() {
    if (!_focus.hasFocus) _input.blur();
  }

  ({String text, int caret}) _reshape(String raw, int caret) {
    _inEdit = true;
    try {
      _input.input(raw, caret);
    } finally {
      _inEdit = false;
    }
    final s = _input.state;
    return (text: s.text, caret: s.caret);
  }

  @override
  void didUpdateWidget(JhiguMoneyField old) {
    super.didUpdateWidget(old);
    if (old.focusNode != widget.focusNode) {
      (old.focusNode ?? _ownFocus)?.removeListener(_onFocus);
      _focus.addListener(_onFocus);
    }
    if (old.digits != widget.digits ||
        old.allowNegative != widget.allowNegative) {
      _build();
      return;
    }
    // Follow the parent only when it changes the value, so a parent that does
    // not pass one does not clear the field on a rebuild.
    if (old.value != widget.value && widget.value != _input.state.value) {
      _lastValue = widget.value;
      try {
        _input.setValue(widget.value);
      } on MoneyException {
        // A negative amount while negatives are off: ignore.
      }
      _lastValue = _input.state.value;
    }
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    _focus.removeListener(_onFocus);
    _ownFocus?.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      focusNode: _focus,
      enabled: widget.enabled,
      autofocus: widget.autofocus,
      style: widget.style,
      textAlign: widget.textAlign,
      decoration: widget.decoration,
      keyboardType: TextInputType.numberWithOptions(
          decimal: true, signed: widget.allowNegative),
      inputFormatters: [_ReshapeFormatter(_reshape)],
    );
  }
}

/// A Nepal phone number field, over the headless [PhoneInput]. It formats as you
/// type (`984-1234567` for mobiles, `01-4123456` for landlines), accepts
/// Devanagari digits and a `+977` or `00977` prefix, shows the carrier once the
/// prefix is known, and reports why a number is not valid in [language] (an
/// unfinished number only after the field loses focus).
///
/// ```dart
/// JhiguPhoneField(
///   language: 'ne',
///   decoration: const InputDecoration(labelText: 'Mobile'),
///   onChanged: (e164) => setState(() => _phone = e164), // '+9779841234567' or null
/// )
/// ```
///
/// [onChanged] gets the E.164 number when it is valid, else null, and is called
/// when that changes. [onStateChanged] gets every new [PhoneInputState] (text,
/// carrier, error). The carrier is shown as the helper text and the error as the
/// error text, unless your [decoration] already sets them. Carrier prefixes are
/// not an official list; see `data/PHONE_NOTES.md`. [value] is the initial text;
/// when the parent changes it, the field follows without calling the callbacks.
class JhiguPhoneField extends StatefulWidget {
  final String? value;
  final ValueChanged<String?>? onChanged;
  final ValueChanged<PhoneInputState>? onStateChanged;

  /// `'en'` or `'ne'`.
  final String language;

  /// Accept prefixes the data marks as inactive.
  final bool allowInactive;

  /// Show the carrier as helper text.
  final bool showCarrier;
  final InputDecoration? decoration;
  final TextStyle? style;
  final bool enabled;
  final bool autofocus;
  final FocusNode? focusNode;

  const JhiguPhoneField({
    super.key,
    this.value,
    this.onChanged,
    this.onStateChanged,
    this.language = 'en',
    this.allowInactive = false,
    this.showCarrier = true,
    this.decoration,
    this.style,
    this.enabled = true,
    this.autofocus = false,
    this.focusNode,
  });

  @override
  State<JhiguPhoneField> createState() => _JhiguPhoneFieldState();
}

class _JhiguPhoneFieldState extends State<JhiguPhoneField> {
  late PhoneInput _input;
  late final TextEditingController _controller;
  FocusNode? _ownFocus;
  void Function()? _unsubscribe;
  String? _lastE164;
  bool _inEdit = false;
  bool _syncing = false;

  FocusNode get _focus => widget.focusNode ?? (_ownFocus ??= FocusNode());

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _build();
    _focus.addListener(_onFocus);
  }

  void _build() {
    _unsubscribe?.call();
    _input = PhoneInput(
      language: widget.language,
      allowInactive: widget.allowInactive,
      value: widget.value,
    );
    _lastE164 = _input.state.e164;
    _unsubscribe = _input.subscribe(_onState);
    _show();
  }

  void _show() {
    final s = _input.state;
    if (_controller.text != s.text ||
        _controller.selection.baseOffset != s.caret) {
      _controller.value = TextEditingValue(
        text: s.text,
        selection: TextSelection.collapsed(offset: s.caret),
      );
    }
  }

  void _onState(PhoneInputState s) {
    if (!mounted) return;
    if (!_inEdit) _show();
    setState(() {});
    if (_syncing) return;
    widget.onStateChanged?.call(s);
    if (s.e164 != _lastE164) {
      _lastE164 = s.e164;
      widget.onChanged?.call(s.e164);
    }
  }

  void _onFocus() {
    if (!_focus.hasFocus) _input.blur();
  }

  ({String text, int caret}) _reshape(String raw, int caret) {
    _inEdit = true;
    try {
      _input.input(raw, caret);
    } finally {
      _inEdit = false;
    }
    final s = _input.state;
    return (text: s.text, caret: s.caret);
  }

  @override
  void didUpdateWidget(JhiguPhoneField old) {
    super.didUpdateWidget(old);
    if (old.focusNode != widget.focusNode) {
      (old.focusNode ?? _ownFocus)?.removeListener(_onFocus);
      _focus.addListener(_onFocus);
    }
    if (old.allowInactive != widget.allowInactive) {
      final keep = _input.state.text;
      _unsubscribe?.call();
      _input = PhoneInput(
        language: widget.language,
        allowInactive: widget.allowInactive,
        value: keep,
      );
      _unsubscribe = _input.subscribe(_onState);
      _lastE164 = _input.state.e164;
      _show();
      return;
    }
    if (old.language != widget.language) _input.setLanguage(widget.language);
    if (old.value != widget.value && widget.value != _input.state.text) {
      _syncing = true;
      try {
        _input.setValue(widget.value ?? '');
      } finally {
        _syncing = false;
      }
      _lastE164 = _input.state.e164;
    }
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    _focus.removeListener(_onFocus);
    _ownFocus?.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = _input.state;
    final base = widget.decoration ?? const InputDecoration();
    final decoration = base.copyWith(
      helperText: base.helperText ?? (widget.showCarrier ? s.carrier : null),
      errorText: base.errorText ?? s.message,
    );
    return TextField(
      controller: _controller,
      focusNode: _focus,
      enabled: widget.enabled,
      autofocus: widget.autofocus,
      style: widget.style,
      decoration: decoration,
      keyboardType: TextInputType.phone,
      inputFormatters: [_ReshapeFormatter(_reshape)],
    );
  }
}
