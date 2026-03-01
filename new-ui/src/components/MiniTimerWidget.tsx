/**
 * MiniTimerWidget — Hyper-compact floating glassmorphism timer.
 * Intended for the mini.html overlay window.
 */
import React, { useState, useEffect, CSSProperties } from 'react';
import { Pause, X } from 'lucide-react';

function fmt(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, Math.round(seconds)) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Electron's -webkit-app-region isn't in React's CSSProperties
const drag: CSSProperties = { '--webkit-app-region': 'drag' } as any;
const noDrag: CSSProperties = { '--webkit-app-region': 'no-drag' } as any;

export default function MiniTimerWidget() {
  const [timer, setTimer] = useState({
    phase: 'focus' as 'focus' | 'break',
    remaining: 0,
    total: 0,
    active: false,
  });
  const [urlUnreadable, setUrlUnreadable] = useState(false);

  useEffect(() => {
    if (!(window as any).electronAPI) return;
    const unsubTimer = (window as any).electronAPI.on('timer:tick', (state: any) => setTimer(state));
    const unsubUrl = (window as any).electronAPI.on('tracker:url-warning', ({ canReadUrl }: { canReadUrl: boolean }) => {
      setUrlUnreadable(!canReadUrl);
    });
    return () => { unsubTimer(); unsubUrl(); };
  }, []);

  const handleClose = () => (window as any).electronAPI?.invoke('mini:close');
  const handleAbort = () => (window as any).electronAPI?.invoke('session:stop');

  const progress = timer.total > 0 ? timer.remaining / timer.total : 1;
  const isUrgent = timer.active && timer.remaining <= 60 && timer.remaining > 0;
  const isFocus = timer.phase === 'focus';

  const borderColor = isUrgent
    ? 'rgba(239, 68, 68, 0.6)'
    : isFocus
    ? 'rgba(56, 189, 248, 0.35)'
    : 'rgba(34, 197, 94, 0.35)';

  const barColor = isUrgent ? '#ef4444' : isFocus ? '#38bdf8' : '#22c55e';

  return (
    <div
      className={`mini-timer-root relative flex items-center gap-2.5 h-[52px] px-4 rounded-full overflow-hidden ${!timer.active ? 'opacity-50' : ''}`}
      style={{
        background: 'rgba(15, 23, 42, 0.92)',
        border: `1.5px solid ${borderColor}`,
        backdropFilter: 'blur(16px)',
        boxShadow: isUrgent
          ? '0 0 20px rgba(239,68,68,0.4), 0 8px 32px rgba(0,0,0,0.6)'
          : '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[3px] rounded-b-full transition-all duration-1000 ease-linear"
        style={{ width: `${progress * 100}%`, background: barColor }}
      />

      {/* Phase label */}
      <span className="text-[11px] font-bold tracking-wide text-muted-foreground whitespace-nowrap">
        {isFocus ? '🎯 FOCUS' : '☕ BREAK'}
      </span>

      {/* Time */}
      <span className="text-lg font-extrabold font-mono tracking-tight text-foreground flex-1 text-center tabular-nums">
        {fmt(timer.remaining)}
      </span>

      {urlUnreadable && (
        <span className="mini-timer-nodrag text-[9px] font-semibold text-warning whitespace-nowrap shrink-0 opacity-85 cursor-help" title="URL matching may not work">
          ⚠ URL
        </span>
      )}

      {/* Abort */}
      <button
        onClick={handleAbort}
        className="mini-timer-nodrag flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"
        title="Stop session"
      >
        <Pause className="w-3 h-3" />
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className="mini-timer-nodrag flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Close mini timer"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
