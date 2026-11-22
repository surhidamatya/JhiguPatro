/// Caret helper shared by the input state machines (guide 15.1): after
/// reformatting, put the caret after the same number of significant characters
/// that were to its left before. Pure.
library;

/// Index just after the [count]-th significant character of [text] (0 for
/// `count <= 0`).
int placeCaret(String text, int count, bool Function(String ch) isSignificant) {
  if (count <= 0) return 0;
  var seen = 0;
  for (var i = 0; i < text.length; i++) {
    if (isSignificant(text[i])) {
      seen++;
      if (seen == count) return i + 1;
    }
  }
  return text.length;
}
