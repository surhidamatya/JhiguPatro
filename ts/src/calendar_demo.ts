/**
 * calendar_demo.ts — wires up the calendar and mounts it to the page.
 *
 * Build:  npm run build   (from ts/)
 * Serve:  open ts/index.html in a local server (e.g. `npx serve ts/`)
 */

import { JsonCalendarDataSource, initializeCalendar } from './index.js';
import { CalendarController, StaticCalendarEventSource } from './calendar_controller.js';
import { CalendarSection } from './calendar_section.js';
import { PanchangDataSource } from './data_sources/PanchangDataSource.js';

async function boot(): Promise<void> {
  // Load BS civil calendar data
  const source = new JsonCalendarDataSource();
  await source.initialize('./nepali_calendar_data.json');
  initializeCalendar(source);

  // Load panchang (tithi) data — optional; calendar works without it
  const panchang = new PanchangDataSource();
  await panchang.load('./2081_tithi.json');

  const calContainer  = document.getElementById('calendar-root');
  const listContainer = document.getElementById('day-list-root');
  if (!calContainer)  throw new Error('#calendar-root element not found');
  if (!listContainer) throw new Error('#day-list-root element not found');

  const ctrl = new CalendarController(new StaticCalendarEventSource(), panchang);
  new CalendarSection(calContainer, listContainer, ctrl);
}

boot().catch(console.error);
