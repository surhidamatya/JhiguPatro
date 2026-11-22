import 'package:flutter/material.dart';

/// Colours and shape for the Jhigu widgets. Add it to `ThemeData.extensions` to
/// restyle them; any field left null falls back to the app's [ColorScheme]
/// (primary, onPrimary, surface, onSurface, onSurfaceVariant, error, tertiary).
@immutable
class JhiguTheme extends ThemeExtension<JhiguTheme> {
  /// Selected day, focus ring and links.
  final Color? primary;

  /// Text on the selected day.
  final Color? onPrimary;

  /// Background of the widget.
  final Color? surface;

  /// Main text.
  final Color? text;

  /// Weekday names, AD numbers and borders.
  final Color? muted;

  /// Weekend days (Saturday by default).
  final Color? holiday;

  /// Outline of today.
  final Color? today;

  /// Corner radius of the widget and of day cells.
  final double? radius;

  const JhiguTheme({
    this.primary,
    this.onPrimary,
    this.surface,
    this.text,
    this.muted,
    this.holiday,
    this.today,
    this.radius,
  });

  /// Fully resolved values for [context]: this extension over the app's colours.
  static ResolvedJhiguTheme of(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final x = theme.extension<JhiguTheme>();
    return ResolvedJhiguTheme(
      primary: x?.primary ?? cs.primary,
      onPrimary: x?.onPrimary ?? cs.onPrimary,
      surface: x?.surface ?? cs.surface,
      text: x?.text ?? cs.onSurface,
      muted: x?.muted ?? cs.onSurfaceVariant,
      holiday: x?.holiday ?? cs.error,
      today: x?.today ?? cs.tertiary,
      radius: x?.radius ?? 8,
    );
  }

  @override
  JhiguTheme copyWith({
    Color? primary,
    Color? onPrimary,
    Color? surface,
    Color? text,
    Color? muted,
    Color? holiday,
    Color? today,
    double? radius,
  }) =>
      JhiguTheme(
        primary: primary ?? this.primary,
        onPrimary: onPrimary ?? this.onPrimary,
        surface: surface ?? this.surface,
        text: text ?? this.text,
        muted: muted ?? this.muted,
        holiday: holiday ?? this.holiday,
        today: today ?? this.today,
        radius: radius ?? this.radius,
      );

  @override
  JhiguTheme lerp(ThemeExtension<JhiguTheme>? other, double t) {
    if (other is! JhiguTheme) return this;
    return JhiguTheme(
      primary: Color.lerp(primary, other.primary, t),
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t),
      surface: Color.lerp(surface, other.surface, t),
      text: Color.lerp(text, other.text, t),
      muted: Color.lerp(muted, other.muted, t),
      holiday: Color.lerp(holiday, other.holiday, t),
      today: Color.lerp(today, other.today, t),
      radius: radius == null || other.radius == null
          ? (t < 0.5 ? radius : other.radius)
          : radius! + (other.radius! - radius!) * t,
    );
  }
}

/// A [JhiguTheme] with every field filled in.
class ResolvedJhiguTheme {
  final Color primary;
  final Color onPrimary;
  final Color surface;
  final Color text;
  final Color muted;
  final Color holiday;
  final Color today;
  final double radius;
  const ResolvedJhiguTheme({
    required this.primary,
    required this.onPrimary,
    required this.surface,
    required this.text,
    required this.muted,
    required this.holiday,
    required this.today,
    required this.radius,
  });
}
