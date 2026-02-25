import type { PanchangJson, PanchangDay, TithiSegment } from '../types.js';

/**
 * Loads a panchang_YYYY.json (e.g. 2081_tithi.json) and exposes
 * O(1) day lookup plus a tithi-at-minute query.
 *
 * Usage:
 *   const panchang = new PanchangDataSource();
 *   await panchang.load('./2081_tithi.json');
 *   const tithi = panchang.tithiAt(2081, 1, 3, currentMinute);
 */
export class PanchangDataSource {
  private _year: number | null = null;
  // key: "month-bsDay"  e.g. "1-3"
  private readonly _lookup = new Map<string, PanchangDay>();

  async load(jsonUrl: string): Promise<void> {
    const res = await fetch(jsonUrl);
    if (!res.ok) {
      throw new Error(`Failed to load panchang data from ${jsonUrl}: ${res.status} ${res.statusText}`);
    }
    const data: PanchangJson[] | PanchangJson = await res.json();

    // The file may be a single object OR an array wrapping one year object.
    const root: PanchangJson = Array.isArray(data) ? data[0] : data;
    this._year = root.year;

    for (const m of root.months) {
      for (const d of m.days) {
        this._lookup.set(`${m.month}-${d.bsDay}`, d);
      }
    }
  }

  get loadedYear(): number | null {
    return this._year;
  }

  /** Returns the PanchangDay for this BS month/day, or null if not loaded. */
  getDay(bsMonth: number, bsDay: number): PanchangDay | null {
    return this._lookup.get(`${bsMonth}-${bsDay}`) ?? null;
  }

  /**
   * The dominant (sunrise) tithi for a BS day.
   * Sunrise is approximated as minute 375 (06:15 Nepal time).
   * Falls back to the first segment if no segment covers sunrise.
   */
  sunriseTithi(bsMonth: number, bsDay: number): TithiSegment | null {
    const day = this.getDay(bsMonth, bsDay);
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
   */
  tithiAt(bsMonth: number, bsDay: number, minuteOfDay: number): TithiSegment | null {
    const day = this.getDay(bsMonth, bsDay);
    if (!day) return null;
    return (
      day.tithiSegments.find(s => minuteOfDay >= s.startMinute && minuteOfDay < s.endMinute) ??
      null
    );
  }
}
