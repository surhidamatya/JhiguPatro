/**
 * Caret helper shared by the input state machines (guide 15.1): after reformatting,
 * put the caret after the same number of significant characters that were to its
 * left before. Pure; no DOM.
 */

/** Index just after the `count`-th significant character of `text` (0 for count <= 0). */
export function placeCaret(text: string, count: number, isSignificant: (ch: string) => boolean): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (isSignificant(text[i])) {
      seen++;
      if (seen === count) return i + 1;
    }
  }
  return text.length;
}
