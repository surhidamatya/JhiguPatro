export const STYLES = `
.jp-calendar {
  font-family: 'Noto Sans Devanagari', 'Mukta', system-ui, sans-serif;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  max-width: 680px;
  width: 100%;
  box-shadow: 0 2px 12px rgba(0,0,0,.08);
  user-select: none;
}

/* ── Header ── */
.jp-header {
  padding: 10px 14px 8px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

/* Row 1: ← [selects] → */
.jp-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.jp-nav-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  transition: background .15s;
  flex-shrink: 0;
}
.jp-nav-btn:hover { background: #f0f0f0; }

.jp-aaj-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0 12px;
  height: 34px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #1565c0;
  transition: background .15s;
  flex-shrink: 0;
}
.jp-aaj-btn:hover { background: #e8f0fe; }

.jp-dropdowns {
  display: flex;
  gap: 8px;
}
.jp-select {
  appearance: none;
  background: #f5f5f5 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 8px center;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 5px 28px 5px 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  cursor: pointer;
  font-family: inherit;
}
.jp-select:focus { outline: none; border-color: #1565c0; }

/* Row 2: big BS month + year label */
.jp-bs-label {
  text-align: center;
  font-size: 40px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
  letter-spacing: .3px;
}

/* Row 3: AD range — smaller, muted */
.jp-ad-label {
  text-align: center;
  font-size: 15px;
  color: #888;
  margin-top: 2px;
  letter-spacing: .2px;
}

/* ── Weekday row ── */
.jp-weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #fafafa;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
  padding: 4px 0;
}
.jp-weekday-cell {
  text-align: center;
  padding: 2px 0;
}
.jp-wday-ne {
  font-size: 16px;
  font-weight: 700;
  color: #444;
}
.jp-wday-en {
  font-size: 11px;
  color: #888;
}
.jp-weekday-cell.saturday .jp-wday-ne,
.jp-weekday-cell.saturday .jp-wday-en {
  color: #d32f2f;
}

/* ── Grid ── */
.jp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.jp-day-cell {
  border: 0.5px solid #e8e8e8;
  padding: 4px 5px 5px;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  cursor: default;
  transition: background .1s;
}
.jp-day-cell:hover:not(.empty):not(.today) {
  background: #f5f8ff;
}
.jp-day-cell.empty { background: #fafafa; cursor: default; }
.jp-day-cell.today {
  background: #1565c0;
  border-color: #1565c0;
}
.jp-day-num-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 3px;
}
.jp-day-num {
  font-size: 18px;
  font-weight: 300;
  line-height: 1.1;
  color: #1a1a1a;
}
.jp-ad-day {
  font-size: 11px;
  font-weight: 300;
  color: #aaa;
  line-height: 1;
}
.jp-day-cell.today .jp-day-num { color: #fff; }
.jp-day-cell.today .jp-ad-day  { color: rgba(255,255,255,.6); }
.jp-day-cell.saturday .jp-day-num { color: #d32f2f; }
.jp-day-cell.today.saturday .jp-day-num { color: #fff; }

.jp-events-wrap {
  margin-top: auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.jp-tithi {
  font-size: 10px;
  color: #888;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  width: 100%;
}
.jp-day-cell.today .jp-tithi { color: rgba(255,255,255,.75); }

.jp-event {
  font-size: 10px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  width: 100%;
  color: #555;
}
.jp-event.special { color: #d32f2f; }
.jp-day-cell.today .jp-event { color: #fff; }
.jp-day-cell.today .jp-event.special { color: #ffcdd2; }
.jp-day-cell.selected:not(.today) {
  background: #e8f0fe;
  border-color: #90aee6;
}
.jp-day-cell.selected:not(.today) .jp-day-num { color: #1565c0; }

/* ── Selected-day detail bar (below the grid) ── */
.jp-detail-bar {
  margin-top: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 0;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,.08);
}
.jp-detail-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
}
.jp-detail-item + .jp-detail-item {
  border-left: 1px solid #e0e0e0;
}
.jp-detail-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .6px;
  color: #aaa;
  text-transform: uppercase;
}
.jp-detail-value {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
  line-height: 1.3;
}
.jp-detail-value.tithi  { color: #5c6bc0; }
.jp-detail-value.event  { font-size: 11px; font-weight: 400; color: #d32f2f; }

/* ── Day list panel ── */
.jp-list {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,.08);
  width: 100%;
}
.jp-list-header {
  padding: 12px 16px;
  background: #1565c0;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: .3px;
}
.jp-list-body {
  overflow-y: auto;
  max-height: calc(100vh - 140px);
}
.jp-list-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: default;
  transition: background .1s;
}
.jp-list-row:last-child { border-bottom: none; }
.jp-list-row:hover { background: #f5f8ff; }
.jp-list-row.today {
  background: #e8f0fe;
  border-left: 3px solid #1565c0;
  padding-left: 13px;
}
.jp-list-row.saturday .jp-list-bs { color: #d32f2f; }

/* Left: big BS day number */
.jp-list-daynum {
  flex-shrink: 0;
  width: 36px;
  text-align: center;
}
.jp-list-bs {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1;
}
.jp-list-wday {
  font-size: 9px;
  color: #aaa;
  margin-top: 2px;
  text-align: center;
}

/* Right: detail block */
.jp-list-detail {
  flex: 1;
  min-width: 0;
}
.jp-list-bs-full {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.3;
}
.jp-list-ad-full {
  font-size: 11px;
  color: #888;
  margin-top: 1px;
}
.jp-list-tithi {
  font-size: 11px;
  color: #5c6bc0;
  margin-top: 3px;
  font-weight: 600;
}
.jp-list-events {
  margin-top: 3px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.jp-list-event {
  font-size: 11px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.jp-list-event.special { color: #d32f2f; }
`;
