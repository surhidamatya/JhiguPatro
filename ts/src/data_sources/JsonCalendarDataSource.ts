import type { NepaliCalendarDataSource, CalendarJson } from '../types.js';

/**
 * Loads Nepali calendar data from a JSON file URL.
 * Suitable for browser environments, React/Vue/Svelte apps, or any runtime
 * that supports fetch().
 *
 * The JSON is fetched once and cached for the lifetime of the instance.
 *
 * Usage (browser / Vite / Next.js):
 *   const source = new JsonCalendarDataSource();
 *   await source.initialize('/nepali_calendar_data.json');
 *   initializeCalendar(source);
 *
 * Phase 3 note: Swap with RemoteCalendarDataSource (API + offline fallback)
 * without touching any conversion logic.
 */
export class JsonCalendarDataSource implements NepaliCalendarDataSource {
  private readonly _yearData: Map<number, number[]> = new Map();
  private _startYear = 0;
  private _endYear = 0;
  private _initialized = false;

  async initialize(jsonUrl: string): Promise<void> {
    if (this._initialized) return;

    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to load Nepali calendar data from ${jsonUrl}: ${response.status} ${response.statusText}`
      );
    }

    const data: CalendarJson = await response.json();

    this._startYear = data.supportedRange.start;
    this._endYear = data.supportedRange.end;

    for (const [key, months] of Object.entries(data.years)) {
      this._yearData.set(Number(key), months);
    }

    this._initialized = true;
  }

  getYearData(year: number): number[] | null {
    return this._yearData.get(year) ?? null;
  }

  get supportedStartYear(): number {
    return this._startYear;
  }

  get supportedEndYear(): number {
    return this._endYear;
  }
}
