/**
 * SessionControls.jsx
 *
 * Shows duration pickers before a session, a live countdown during a session,
 * and Start / Stop / Start Break buttons.
 *
 * Props:
 *  sessionId    {number|null}  — null when no session is active
 *  timerState   {object}       — { phase, remaining, total, active } from main process
 *  onStart      {function}     — async ({ focusDuration, breakDuration }) => void
 *  onStop       {function}     — async () => void
 *  onStartBreak {function}     — async () => void — force-switch to break phase
 */

import React, { useState } from 'react';

const FOCUS_OPTIONS = [15, 25, 45, 60];
const BREAK_OPTIONS = [5, 10, 15, 20];

function fmt(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function SessionControls({ sessionId, timerState = {}, onStart, onStop, onStartBreak }) {
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [loading, setLoading]             = useState(false);

  const isActive  = sessionId !== null;
  const isFocus   = (timerState.phase || 'focus') === 'focus';
  const progress  = timerState.total > 0 ? timerState.remaining / timerState.total : 1;
  const isUrgent  = timerState.active && timerState.remaining <= 60 && timerState.remaining > 0;
  const canBreak  = isActive && isFocus && timerState.active;

  const handleStart = async () => {
    setLoading(true);
    try { await onStart({ focusDuration, breakDuration }); }
    finally { setLoading(false); }
  };

  const handleStop = async () => {
    setLoading(true);
    try { await onStop(); }
    finally { setLoading(false); }
  };

  const handleStartBreak = async () => {
    setLoading(true);
    try { if (onStartBreak) await onStartBreak(); }
    finally { setLoading(false); }
  };

  return (
    <section className="session-controls" aria-label="Session controls">

      {/* ── Status bar ── */}
      <div className="session-controls__status">
        <span
          className={`session-controls__indicator ${
            isActive ? 'session-controls__indicator--active' : ''
          }`}
          aria-hidden="true"
        />
        {isActive ? (
          <span className="session-controls__label">
            <strong className={`sc-phase sc-phase--${timerState.phase || 'focus'}`}>
              {isFocus ? '\uD83C\uDFAF FOCUS' : '\u2615 BREAK'}
            </strong>
          </span>
        ) : (
          <span className="session-controls__label session-controls__label--idle">
            No active session
          </span>
        )}
      </div>

      {/* ── Live countdown ring (only while active) ── */}
      {isActive && (
        <div className="sc-timer">
          <div
            className={`sc-timer__arc sc-timer__arc--${timerState.phase || 'focus'}${
              isUrgent ? ' sc-timer__arc--urgent' : ''
            }`}
            style={{ '--p': progress }}
          >
            <span className="sc-timer__time">{fmt(timerState.remaining || 0)}</span>
            <span className="sc-timer__phase-label">
              {isFocus ? 'focus' : 'break'}
            </span>
          </div>
          <p className="sc-timer__hint">
            {isFocus
              ? 'Stay focused — a break is coming.'
              : 'Rest up — focus starts soon.'}
          </p>
        </div>
      )}

      {/* ── Duration pickers (only while idle) ── */}
      {!isActive && (
        <div className="sc-pickers">
          <div className="sc-picker">
            <label className="sc-picker__label">🎯 Focus duration</label>
            <div className="sc-picker__options">
              {FOCUS_OPTIONS.map((m) => (
                <button
                  key={m}
                  className={`sc-pill ${focusDuration === m ? 'sc-pill--active' : ''}`}
                  onClick={() => setFocusDuration(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          <div className="sc-picker">
            <label className="sc-picker__label">☕ Break duration</label>
            <div className="sc-picker__options">
              {BREAK_OPTIONS.map((m) => (
                <button
                  key={m}
                  className={`sc-pill ${breakDuration === m ? 'sc-pill--active' : ''}`}
                  onClick={() => setBreakDuration(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="session-controls__buttons">
        <button
          className="btn btn--primary"
          onClick={handleStart}
          disabled={isActive || loading}
          aria-label="Start a new focus session"
        >
          {loading && !isActive ? '…' : `▶ Start ${focusDuration}m Focus`}
        </button>

        <button
          className="btn btn--break"
          onClick={handleStartBreak}
          disabled={!canBreak || loading}
          aria-label="Start a break now"
          title={!canBreak ? 'Available during a focus phase' : 'Skip to break now'}
        >
          ☕ Take Break
        </button>

        <button
          className="btn btn--danger"
          onClick={handleStop}
          disabled={!isActive || loading}
          aria-label="Stop the current focus session"
        >
          {loading && isActive ? '…' : '■ Stop Session'}
        </button>
      </div>
    </section>
  );
}
