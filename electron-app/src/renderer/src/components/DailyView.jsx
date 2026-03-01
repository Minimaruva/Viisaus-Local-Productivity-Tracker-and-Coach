/**
 * DailyView.jsx
 *
 * Vertical hour-by-hour timeline of focus and break blocks for a selected day.
 * Also shows a summary of total focus vs total break time.
 *
 * Data is fetched via the focusblocks:get IPC channel and refreshed every
 * minute (or on every timer:tick while today is selected).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr(d = new Date()) {
  // Returns "YYYY-MM-DD" in the machine's local timezone.
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Minutes since local midnight for an ISO timestamp string. */
function minsFromMidnight(isoStr) {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function fmtDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function fmtHour(h) {
  const ampm = h < 12 ? 'am' : 'pm';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${ampm}`;
}

// ── Component ────────────────────────────────────────────────────────────────

const HOUR_PX = 50; // height of one hour slot in px

export default function DailyView() {
  const [blocks, setBlocks]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedDate, setSelectedDate] = useState(localDateStr());

  // ── Data loading ───────────────────────────────────────────────────────────
  const load = useCallback(async (date) => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke('focusblocks:get', date);
      setBlocks(result || []);
    } catch (e) {
      console.error('[DailyView] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedDate);
    // Auto-refresh every 60 s when today is selected.
    const interval = setInterval(() => {
      if (selectedDate === localDateStr()) load(selectedDate);
    }, 60_000);
    return () => clearInterval(interval);
  }, [selectedDate, load]);

  // Refresh live on timer ticks so in-progress blocks update immediately.
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsub = window.electronAPI.on('timer:tick', () => {
      if (selectedDate === localDateStr()) load(selectedDate);
    });
    return unsub;
  }, [selectedDate, load]);

  // ── Summary ────────────────────────────────────────────────────────────────
  const { focusSec, breakSec } = useMemo(() => {
    const now = new Date();
    let focusSec = 0, breakSec = 0;
    blocks.forEach((b) => {
      const start = new Date(b.start_time);
      const end   = b.end_time ? new Date(b.end_time) : now;
      const dur   = Math.max(0, (end - start) / 1000);
      if (b.type === 'focus') focusSec += dur;
      else                    breakSec += dur;
    });
    return { focusSec, breakSec };
  }, [blocks]);

  // ── Timeline layout ────────────────────────────────────────────────────────
  const now             = new Date();
  const todayStr        = localDateStr();
  const currentMins     = now.getHours() * 60 + now.getMinutes();
  const currentTop      = (currentMins / 60) * HOUR_PX;
  const totalPx         = 24 * HOUR_PX;

  // Decide which hour range to show. Default: show hours covering all blocks
  // plus 1-hour padding each side, or at minimum 7 am–8 pm.
  const { firstHour, lastHour } = useMemo(() => {
    if (blocks.length === 0) return { firstHour: 7, lastHour: 20 };
    const allMins = blocks.flatMap((b) => {
      const arr = [minsFromMidnight(b.start_time)];
      if (b.end_time) arr.push(minsFromMidnight(b.end_time));
      return arr;
    });
    const minH = Math.max(0,  Math.floor(Math.min(...allMins) / 60) - 1);
    const maxH = Math.min(24, Math.ceil(Math.max(...allMins)  / 60) + 1);
    return { firstHour: minH, lastHour: maxH };
  }, [blocks]);

  return (
    <section className="daily-view" aria-label="Daily view">

      {/* ── Header ── */}
      <div className="dv-header">
        <h2 className="dv-title">Daily View</h2>
        <input
          className="dv-date-input"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          aria-label="Select date"
        />
      </div>

      {/* ── Summary pills ── */}
      <div className="dv-summary">
        <span className="dv-pill dv-pill--focus">
          🎯 Focus&nbsp;&nbsp;<strong>{fmtDuration(focusSec)}</strong>
        </span>
        <span className="dv-pill dv-pill--break">
          ☕ Break&nbsp;&nbsp;<strong>{fmtDuration(breakSec)}</strong>
        </span>
        {blocks.length === 0 && !loading && (
          <span className="dv-pill dv-pill--empty">No sessions recorded</span>
        )}
      </div>

      {/* ── Timeline ── */}
      {loading ? (
        <p className="dv-loading">Loading…</p>
      ) : (
        <div className="dv-scroll-area">
          <div className="dv-timeline" style={{ height: `${totalPx}px` }}>

            {/* Hour rows — clipped to the visible range */}
            {Array.from({ length: 24 }, (_, h) => {
              if (h < firstHour || h > lastHour) return null;
              return (
                <div
                  key={h}
                  className="dv-hour-row"
                  style={{ top: `${h * HOUR_PX}px`, height: `${HOUR_PX}px` }}
                >
                  <span className="dv-hour-label">{fmtHour(h)}</span>
                  <div className="dv-hour-track" />
                </div>
              );
            })}

            {/* Blocks */}
            <div className="dv-blocks-layer">
              {blocks.map((b) => {
                const startMin = minsFromMidnight(b.start_time);
                const endMin   = b.end_time
                  ? minsFromMidnight(b.end_time)
                  : (selectedDate === todayStr ? currentMins : startMin);
                const top    = (startMin / 60) * HOUR_PX;
                const height = Math.max(6, ((endMin - startMin) / 60) * HOUR_PX);
                const dur    = fmtDuration(Math.max(0, (endMin - startMin) * 60));
                const isLive = !b.end_time && selectedDate === todayStr;
                return (
                  <div
                    key={b.id}
                    className={`dv-block dv-block--${b.type}${isLive ? ' dv-block--live' : ''}`}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    title={`${b.type}: ${dur}${isLive ? ' (in progress)' : ''}`}
                  >
                    {height >= 18 && (
                      <span className="dv-block__label">
                        {b.type === 'focus' ? '🎯' : '☕'} {dur}
                        {isLive && ' •'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current-time red line */}
            {selectedDate === todayStr && (
              <div className="dv-now-line" style={{ top: `${currentTop}px` }} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
