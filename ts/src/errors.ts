import { getStrings } from './generated/strings.js';
import type { Language } from './generated/strings.js';

export type JhiguErrorCode = 'OUT_OF_RANGE' | 'INVALID_DATE' | 'INVALID_DATA' | 'PARSE_ERROR';

/**
 * Typed error for dates and calendar data (guide 7.9). `details` carries the
 * offending input (for PARSE_ERROR, the original text).
 */
export class JhiguError extends Error {
  constructor(
    public readonly code: JhiguErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'JhiguError';
  }

  /** User-facing message for PARSE_ERROR in the given language; other codes return `message`. */
  localized(language: Language): string {
    return this.code === 'PARSE_ERROR' ? getStrings(language).date.parseError : this.message;
  }
}
