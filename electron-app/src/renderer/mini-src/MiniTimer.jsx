/**
 * MiniTimer.jsx — Floating always-on-top timer widget.
 *
 * Draggable via CSS -webkit-app-region: drag.
 * Receives timer state from the main process via the timer:tick IPC channel.
 */
import React, { useState, useEffect } from 'react';
import './MiniTimer.css';

function fmt(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MiniTimer() {
  const [timer, setTimer] = useState({
    phase: 'focus',
    remaining: 0,
    total: 0,
    active: false,
  });
  const [urlUnreadable, setUrlUnreadable] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubTimer = window.electronAPI.on('timer:tick', (state) => setTimer(state));
    const unsubUrl   = window.electronAPI.on('tracker:url-warning', ({ canReadUrl }) => {
      setUrlUnreadable(!canReadUrl);
    });
    return () => { unsubTimer(); unsubUrl(); };
  }, []);

  const handleClose = () => {
    window.electronAPI?.invoke('mini:close');
  };

  const progress   = timer.total > 0 ? timer.remaining / timer.total : 1;
  const isUrgent   = timer.active && timer.remaining <= 60 && timer.remaining > 0;
  const isFocus    = timer.phase === 'focus';
  const label      = isFocus ? '🎯 FOCUS' : '☕ BREAK';
  const phaseClass = isFocus ? 'focus' : 'break';

  return (
    <div
      className={`mt ${phaseClass} ${isUrgent ? 'urgent' : ''} ${!timer.active ? 'idle' : ''}`}
      style={{ '--progress': progress }}
    >
      <span className="mt__label">{label}</span>
      <span className="mt__time">{fmt(timer.remaining)}</span>
      {urlUnreadable && (
        <span
          className="mt__url-warn"
          title="active-win cannot read browser URLs on Windows — blocklist URL matching may not work"
        >
          ⚠ URL unreadable
        </span>
      )}
      <button
        className="mt__close"
        onClick={handleClose}
        title="Close timer"
        aria-label="Close mini timer"
      >
        ✕
      </button>
    </div>
  );
}
