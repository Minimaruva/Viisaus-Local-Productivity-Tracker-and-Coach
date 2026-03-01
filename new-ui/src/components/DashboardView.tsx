import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Coffee, Droplets, Eye, AlertTriangle } from 'lucide-react';
import ProgressRing from './ProgressRing';

function fmtDuration(seconds: number): string {
  seconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function localDateStr(d = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

interface TimerState {
  phase: string;
  remaining: number;
  total: number;
  active: boolean;
}

interface Block {
  id: number;
  type: string;
  start_time: string;
  end_time?: string;
}

export default function DashboardView({ timerState }: { timerState: TimerState }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [waterCount, setWaterCount] = useState(0);
  const [eyeDropCount, setEyeDropCount] = useState(0);

  const load = useCallback(async () => {
    if (!(window as any).electronAPI) return;
    try {
      const result = await (window as any).electronAPI.invoke('focusblocks:get', localDateStr());
      setBlocks(result || []);
    } catch (e) {
      console.error('[Dashboard] fetch error:', e);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!(window as any).electronAPI) return;
    const unsub = (window as any).electronAPI.on('timer:tick', () => load());
    return unsub;
  }, [load]);

  const { focusSec, breakSec, breakCount } = useMemo(() => {
    const now = new Date();
    let focusSec = 0, breakSec = 0, breakCount = 0;
    blocks.forEach((b) => {
      const start = new Date(b.start_time);
      const end = b.end_time ? new Date(b.end_time) : now;
      const dur = Math.max(0, (end.getTime() - start.getTime()) / 1000);
      if (b.type === 'focus') focusSec += dur;
      else { breakSec += dur; breakCount++; }
    });
    return { focusSec, breakSec, breakCount };
  }, [blocks]);

  // Biometric calculations
  const focusHours = focusSec / 3600;
  const expectedBreaks = Math.max(0, Math.floor(focusHours * 2)); // 2 breaks per focus hour
  const breakDeficit = Math.max(0, expectedBreaks - breakCount);
  const waterGoal = 8;
  const eyeStrainIndex = Math.min(100, Math.round((focusSec / 3600) * 20)); // rough index

  const card = "glass-card p-5";
  const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="flex flex-col gap-5 p-6 h-full overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today's overview · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Focus/Break summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div className={card} {...fadeUp} transition={{ delay: 0 }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-focus/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-focus" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Focus Time</p>
              <p className="text-2xl font-bold text-foreground">{fmtDuration(focusSec)}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-focus transition-all duration-500"
              style={{ width: `${Math.min(100, (focusSec / (8 * 3600)) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">of 8h goal</p>
        </motion.div>

        <motion.div className={card} {...fadeUp} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-break-phase/10 flex items-center justify-center">
              <Coffee className="w-4 h-4 text-break-phase" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Break Time</p>
              <p className="text-2xl font-bold text-foreground">{fmtDuration(breakSec)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="pill-break text-xs font-semibold px-2.5 py-0.5 rounded-full">{breakCount} breaks</span>
          </div>
        </motion.div>

        <motion.div className={card} {...fadeUp} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChartIcon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ratio</p>
              <p className="text-2xl font-bold text-foreground">
                {focusSec + breakSec > 0 ? `${Math.round((focusSec / (focusSec + breakSec)) * 100)}%` : '—'}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Focus vs total active time</p>
        </motion.div>
      </div>

      {/* Live session ring */}
      {timerState.active && (
        <motion.div className={`${card} flex items-center gap-6`} {...fadeUp} transition={{ delay: 0.15 }}>
          <ProgressRing
            progress={timerState.total > 0 ? timerState.remaining / timerState.total : 1}
            size={100}
            strokeWidth={6}
            color={timerState.phase === 'focus' ? 'hsl(var(--focus-color))' : 'hsl(var(--break-color))'}
          >
            <span className="text-lg font-bold text-foreground font-mono">{fmt(timerState.remaining)}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {timerState.phase}
            </span>
          </ProgressRing>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {timerState.phase === 'focus' ? '🎯 Focus Session' : '☕ Break'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {timerState.phase === 'focus' ? 'Stay focused — a break is coming.' : 'Rest up — focus starts soon.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Biometrics & Health */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Biometrics & Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Water Balance */}
          <motion.div className={card} {...fadeUp} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Hydration</span>
              </div>
              <span className="text-xs text-muted-foreground">{waterCount}/{waterGoal}</span>
            </div>
            <ProgressRing
              progress={waterCount / waterGoal}
              size={72}
              strokeWidth={5}
              color="hsl(var(--primary))"
            >
              <span className="text-sm font-bold text-foreground">{waterCount}</span>
            </ProgressRing>
            <button
              onClick={() => setWaterCount(c => c + 1)}
              className="mt-3 w-full text-xs font-semibold py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              + Log Water
            </button>
          </motion.div>

          {/* Eye Strain Index */}
          <motion.div className={card} {...fadeUp} transition={{ delay: 0.25 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-secondary" />
                <span className="text-xs font-semibold text-foreground">Eye Strain</span>
              </div>
              <span className="text-xs text-muted-foreground">{eyeStrainIndex}%</span>
            </div>
            <ProgressRing
              progress={eyeStrainIndex / 100}
              size={72}
              strokeWidth={5}
              color={eyeStrainIndex > 70 ? 'hsl(var(--urgent-color))' : 'hsl(var(--secondary))'}
            >
              <span className="text-sm font-bold text-foreground">{eyeStrainIndex}</span>
            </ProgressRing>
            <button
              onClick={() => setEyeDropCount(c => c + 1)}
              className="mt-3 w-full text-xs font-semibold py-1.5 rounded-md bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
            >
              + Eye Drops ({eyeDropCount})
            </button>
          </motion.div>

          {/* Break Deficit */}
          <motion.div className={card} {...fadeUp} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-xs font-semibold text-foreground">Break Deficit</span>
              </div>
            </div>
            <ProgressRing
              progress={expectedBreaks > 0 ? Math.min(1, breakCount / expectedBreaks) : 1}
              size={72}
              strokeWidth={5}
              color={breakDeficit > 2 ? 'hsl(var(--urgent-color))' : 'hsl(var(--break-color))'}
            >
              <span className="text-sm font-bold text-foreground">{breakDeficit}</span>
            </ProgressRing>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              {breakDeficit === 0 ? 'On track!' : `${breakDeficit} breaks missed`}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function fmt(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, Math.round(seconds)) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}
