import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

/// The web key name (`ArrowLeft`, `PageUp`, ...) for a Flutter key, or null for
/// keys the pickers do not use. The headless `keyAction` takes these names.
String? pickerKeyName(LogicalKeyboardKey k) {
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

/// One entry in the month or year list.
class PickerChoice {
  final String label;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;
  const PickerChoice({
    required this.label,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });
}

/// The three-column month or year list.
class PickerChoices extends StatelessWidget {
  final ResolvedJhiguTheme theme;
  final List<PickerChoice> items;
  const PickerChoices({super.key, required this.theme, required this.items});

  @override
  Widget build(BuildContext context) {
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
                        backgroundColor: theme.primary,
                        foregroundColor: theme.onPrimary,
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
