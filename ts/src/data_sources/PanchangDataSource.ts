import type { PanchangJson, PanchangDay, TithiSegment } from '../types.js';

/**
 * Holds panchang (tithi) data for one or more BS years and gives O(1) day lookup plus a
 * tithi-at-minute query. Load each year's file (`2081_tithi.json`, `2082_tithi.json`, ...); a year
 * that is not loaded answers `null`.
 *
 * Usage:
 *   const panchang = new PanchangDataSource();
 *   await panchang.load('./2081_tithi.json');
 *   await panchang.load('./2082_tithi.json');
 *   const tithi = panchang.tithiAt(2082, 1, 3, currentMinute);
 *
 * Without fetch (Node, tests, server rendering) hand it the parsed file: `panchang.addYear(json)`.
 */
export class PanchangDataSource {
  // year -> ("month-bsDay" e.g. "1-3" -> day)
  private readonly _years = new Map<number, Map<string, PanchangDay>>();
  private _last: number | null = null;

  async load(jsonUrl: string): Promise<void> {
    const res = await fetch(jsonUrl);
    if (!res.ok) {
      throw new Error(`Failed to load panchang data from ${jsonUrl}: ${res.status} ${res.statusText}`);
    }
    this.addYear(await res.json());
  }

  /**
   * Adds one year from the parsed file. The file may be a single object or an array wrapping one year
   * object. Loading a year again replaces it.
   */
  addYear(data: PanchangJson[] | PanchangJson): void {
    const root: PanchangJson = Array.isArray(data) ? data[0] : data;
    const lookup = new Map<string, PanchangDay>();
    for (const m of root.months) {
      for (const d of m.days) {
        lookup.set(`${m.month}-${d.bsDay}`, d);
      }
    }
    this._years.set(root.year, lookup);
    this._last = root.year;
  }

  /** The year loaded last, or null when nothing is loaded. */
  get loadedYear(): number | null {
    return this._last;
  }

  /** Every loaded year, ascending. */
  get loadedYears(): number[] {
    return [...this._years.keys()].sort((a, b) => a - b);
  }

  /** Returns the PanchangDay for this BS year/month/day, or null if that year is not loaded or the day is not in it. */
  getDay(bsYear: number, bsMonth: number, bsDay: number): PanchangDay | null {
    return this._years.get(bsYear)?.get(`${bsMonth}-${bsDay}`) ?? null;
  }

  /**
   * The dominant (sunrise) tithi for a BS day.
   * Sunrise is approximated as minute 375 (06:15 Nepal time).
   * Falls back to the first segment if no segment covers sunrise.
   * Returns null if data for the given year is not loaded.
   */
  sunriseTithi(bsYear: number, bsMonth: number, bsDay: number): TithiSegment | null {
    const day = this.getDay(bsYear, bsMonth, bsDay);
    if (!day) return null;
    return (
      day.tithiSegments.find(s => 375 >= s.startMinute && 375 < s.endMinute) ??
      day.tithiSegments[0] ??
      null
    );
  }

  /**
   * The tithi active at [minuteOfDay] (0–1439, Nepal time) for a BS day.
   * Use this for "current tithi right now" queries.
   * Returns null if data for the given year is not loaded.
   */
  tithiAt(bsYear: number, bsMonth: number, bsDay: number, minuteOfDay: number): TithiSegment | null {
    const day = this.getDay(bsYear, bsMonth, bsDay);
    if (!day) return null;
    return (
      day.tithiSegments.find(s => minuteOfDay >= s.startMinute && minuteOfDay < s.endMinute) ??
      null
    );
  }
}
