import type { NepaliCalendarDataSource } from '../types.js';

/**
 * A data source backed by a plain JS object / Record.
 * Ideal for Node.js, server-side rendering, or test environments where
 * you already have the year data in memory.
 *
 * Usage:
 *   import data from '../../data/nepali_calendar_data.json' assert { type: 'json' };
 *   const source = new InlineCalendarDataSource(data.years, data.supportedRange.start, data.supportedRange.end);
 *
 * Or with a subset for tests:
 *   const source = new InlineCalendarDataSource({ 2082: [31,31,32,...] }, 2082, 2082);
 */
export class InlineCalendarDataSource implements NepaliCalendarDataSource {
  private readonly _yearData: Map<number, number[]>;
  private readonly _startYear: number;
  private readonly _endYear: number;

  constructor(years: Record<string, number[]>, startYear: number, endYear: number) {
    this._yearData = new Map(
      Object.entries(years).map(([k, v]) => [Number(k), v])
    );
    this._startYear = startYear;
    this._endYear = endYear;
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
