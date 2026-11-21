import 'package:flutter/material.dart';
import 'package:jhigu_patro_utils/jhigu_patro_utils.dart';

import 'date_picker.dart';
import 'range_picker.dart';

/// A chosen start and end, both inclusive.
typedef JhiguDateRange = ({NepaliDate start, NepaliDate end});

/// Shows a [JhiguDatePicker] in a dialog and returns the day the user picks, or
/// null if they dismiss it (tap outside, Escape or the back button). Picking a
/// day, including the day that was already [initial], closes the dialog at once.
/// There are no OK and Cancel buttons because the string tables have no words
/// for them.
///
/// ```dart
/// final d = await showJhiguDatePicker(
///   context: context,
///   initial: _date,
///   language: 'ne',
///   min: NepaliDate.checked(2080, 1, 1),
/// );
/// if (d != null) setState(() => _date = d);
/// ```
///
/// The calendar must be initialised first (`NepaliCalendar.initialize`). The
/// dialog is styled by your [JhiguTheme], like the picker.
Future<NepaliDate?> showJhiguDatePicker({
  required BuildContext context,
  NepaliDate? initial,
  NepaliDate? min,
  NepaliDate? max,
  String language = 'en',
  int weekStartsOn = 0,
  bool showAd = true,
  NepaliDate? today,
  bool useRootNavigator = true,
  bool barrierDismissible = true,
}) {
  return showDialog<NepaliDate>(
    context: context,
    useRootNavigator: useRootNavigator,
    barrierDismissible: barrierDismissible,
    builder: (dialogContext) => Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: JhiguDatePicker(
        value: initial,
        min: min,
        max: max,
        language: language,
        weekStartsOn: weekStartsOn,
        showAd: showAd,
        today: today,
        showClear: false,
        autofocus: true,
        onSelected: (d) => Navigator.of(dialogContext).pop(d),
      ),
    ),
  );
}

/// Shows a [JhiguRangePicker] in a dialog and returns the range, or null if the
/// user dismisses it before choosing an end. The dialog closes when the second
/// day is chosen. [initialStart] and [initialEnd] follow the rules of
/// [JhiguRangePicker] (an end needs a start and must not be before it).
Future<JhiguDateRange?> showJhiguDateRangePicker({
  required BuildContext context,
  NepaliDate? initialStart,
  NepaliDate? initialEnd,
  NepaliDate? min,
  NepaliDate? max,
  String language = 'en',
  int weekStartsOn = 0,
  bool showAd = true,
  NepaliDate? today,
  bool useRootNavigator = true,
  bool barrierDismissible = true,
}) {
  return showDialog<JhiguDateRange>(
    context: context,
    useRootNavigator: useRootNavigator,
    barrierDismissible: barrierDismissible,
    builder: (dialogContext) => Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: JhiguRangePicker(
        start: initialStart,
        end: initialEnd,
        min: min,
        max: max,
        language: language,
        weekStartsOn: weekStartsOn,
        showAd: showAd,
        today: today,
        autofocus: true,
        onChanged: (start, end) {
          if (start != null && end != null) {
            Navigator.of(dialogContext).pop((start: start, end: end));
          }
        },
      ),
    ),
  );
}
