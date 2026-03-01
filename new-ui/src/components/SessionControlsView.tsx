import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Coffee, Target, Plus, Trash2, ChevronDown, ChevronUp, GripVertical, FolderKanban } from 'lucide-react';
import ProgressRing from './ProgressRing';
import { Project } from '@/types/project';

const FOCUS_OPTIONS = [15, 25, 45, 60, 90];
const BREAK_OPTIONS = [5, 10, 15, 20];

function fmt(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, Math.round(seconds)) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TimerState {
  phase: string;
  remaining: number;
  total: number;
  active: boolean;
}

interface QueueItem {
  id: string;
  type: 'focus' | 'break';
  duration: number;
}

interface SessionControlsViewProps {
  sessionId: number | null;
  timerState: TimerState;
  onStart: (opts: { focusDuration: number; breakDuration: number; projectId?: string }) => Promise<void>;
  onStop: () => Promise<void>;
  onStartBreak: () => Promise<void>;
  initialFocus?: number;
  initialBreak?: number;
  projects?: Project[];
  activeProject?: Project | null;
  initialProjectId?: string;
}

export default function SessionControlsView({
  sessionId,
  timerState,
  onStart,
  onStop,
  onStartBreak,
  initialFocus,
  initialBreak,
  projects = [],
  activeProject,
  initialProjectId,
}: SessionControlsViewProps) {
  const [mode, setMode] = useState<'simple' | 'queue'>('simple');
  const [selectedType, setSelectedType] = useState<'focus' | 'break'>('focus');
  const [selectedDuration, setSelectedDuration] = useState(initialFocus || 25);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(initialProjectId);
  const [loading, setLoading] = useState(false);

  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: 'q1', type: 'focus', duration: 25 },
    { id: 'q2', type: 'break', duration: 5 },
    { id: 'q3', type: 'focus', duration: 25 },
    { id: 'q4', type: 'break', duration: 5 },
  ]);
  const [queueAddType, setQueueAddType] = useState<'focus' | 'break'>('focus');
  const [queueAddDuration, setQueueAddDuration] = useState(25);

  const isActive = sessionId !== null;
  const isFocus = (timerState.phase || 'focus') === 'focus';
  const progress = timerState.total > 0 ? timerState.remaining / timerState.total : 1;
  const isUrgent = timerState.active && timerState.remaining <= 60 && timerState.remaining > 0;

  const durationOptions = selectedType === 'focus' ? FOCUS_OPTIONS : BREAK_OPTIONS;

  // When switching type, pick a sensible default duration
  const handleTypeSwitch = (type: 'focus' | 'break') => {
    setSelectedType(type);
    setSelectedDuration(type === 'focus' ? 25 : 5);
  };

  const handleQuickStart = async () => {
    setLoading(true);
    try {
      if (selectedType === 'focus') {
        await onStart({ focusDuration: selectedDuration, breakDuration: 5, projectId: selectedProjectId });
      } else {
        if ((window as any).electronAPI) {
          await (window as any).electronAPI.invoke('session:startBreakOnly', { breakDuration: selectedDuration });
        }
      }
    } finally { setLoading(false); }
  };

  const handleStartQueue = async () => {
    if (queue.length === 0) return;
    setLoading(true);
    try {
      // Start the first item; the queue concept maps to focus+break pairs
      const firstFocus = queue.find(q => q.type === 'focus');
      const firstBreak = queue.find(q => q.type === 'break');
      await onStart({
        focusDuration: firstFocus?.duration || 25,
        breakDuration: firstBreak?.duration || 5,
      });
    } finally { setLoading(false); }
  };

  const handleStop = async () => {
    setLoading(true);
    try { await onStop(); }
    finally { setLoading(false); }
  };

  const addToQueue = () => {
    setQueue(prev => [...prev, { id: `q-${Date.now()}`, type: queueAddType, duration: queueAddDuration }]);
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const totalQueueMins = queue.reduce((sum, q) => sum + q.duration, 0);

  const phaseColor = isFocus ? 'hsl(var(--focus-color))' : 'hsl(var(--break-color))';
  const urgentColor = 'hsl(var(--urgent-color))';

  return (
    <div className="flex flex-col items-center gap-5 p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">Session</h1>
      </div>

      {/* Active session display */}
      {isActive && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          {/* Active project badge */}
          {activeProject && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `hsl(${activeProject.color} / 0.15)`,
                color: `hsl(${activeProject.color})`,
                borderWidth: 1,
                borderColor: `hsl(${activeProject.color} / 0.3)`,
              }}
            >
              {activeProject.icon} {activeProject.name}
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
            <span className={`text-sm font-semibold ${isFocus ? 'text-focus' : 'text-break-phase'}`}>
              {isFocus ? '🎯 FOCUS' : '☕ BREAK'}
            </span>
          </div>

          <div className={isUrgent ? 'animate-[urgent-pulse_0.8s_ease-in-out_infinite_alternate]' : ''}>
            <ProgressRing
              progress={progress}
              size={160}
              strokeWidth={8}
              color={isUrgent ? urgentColor : phaseColor}
            >
              <span className="text-3xl font-bold text-foreground font-mono">{fmt(timerState.remaining || 0)}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{timerState.phase}</span>
            </ProgressRing>
          </div>

          <p className="text-xs text-muted-foreground">
            {isFocus ? 'Stay focused — a break is coming.' : 'Rest up — focus starts soon.'}
          </p>

          {/* Active controls */}
          <div className="flex gap-2">
            {isFocus && (
              <button
                onClick={async () => { setLoading(true); try { await onStartBreak(); } finally { setLoading(false); } }}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-break-phase/15 text-break-phase font-semibold text-sm border border-break-phase/30 hover:bg-break-phase/25 transition-colors disabled:opacity-40"
              >
                <Coffee className="w-4 h-4" /> Take Break
              </button>
            )}
            <button
              onClick={handleStop}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/15 text-destructive font-semibold text-sm border border-destructive/30 hover:bg-destructive/25 transition-colors disabled:opacity-40"
            >
              <Square className="w-4 h-4" /> Stop
            </button>
          </div>
        </motion.div>
      )}

      {/* Idle state */}
      {!isActive && (
        <>
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setMode('simple')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                mode === 'simple' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Quick Start
            </button>
            <button
              onClick={() => setMode('queue')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                mode === 'queue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Plan Queue
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'simple' ? (
              <motion.div
                key="simple"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-5 w-full max-w-sm"
              >
                {/* Type selector — two big cards */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => handleTypeSwitch('focus')}
                    className={`glass-card p-4 text-center transition-all ${
                      selectedType === 'focus'
                        ? 'border-focus glow-focus'
                        : 'hover:border-border'
                    }`}
                  >
                    <Target className={`w-6 h-6 mx-auto mb-1.5 ${selectedType === 'focus' ? 'text-focus' : 'text-muted-foreground'}`} />
                    <div className={`text-sm font-bold ${selectedType === 'focus' ? 'text-focus' : 'text-muted-foreground'}`}>Focus</div>
                    <div className="text-[10px] text-muted-foreground">Deep work time</div>
                  </button>
                  <button
                    onClick={() => handleTypeSwitch('break')}
                    className={`glass-card p-4 text-center transition-all ${
                      selectedType === 'break'
                        ? 'border-break-phase glow-break'
                        : 'hover:border-border'
                    }`}
                  >
                    <Coffee className={`w-6 h-6 mx-auto mb-1.5 ${selectedType === 'break' ? 'text-break-phase' : 'text-muted-foreground'}`} />
                    <div className={`text-sm font-bold ${selectedType === 'break' ? 'text-break-phase' : 'text-muted-foreground'}`}>Break</div>
                    <div className="text-[10px] text-muted-foreground">Rest & recharge</div>
                  </button>
                </div>

                {/* Project picker */}
                {selectedType === 'focus' && projects.length > 0 && (
                  <div className="w-full">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" /> Project
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setSelectedProjectId(undefined)}
                        className={`duration-pill text-xs ${!selectedProjectId ? 'active' : ''}`}
                      >None</button>
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setSelectedDuration(p.defaultFocusDuration);
                          }}
                          className={`duration-pill text-xs ${selectedProjectId === p.id ? 'active' : ''}`}
                        >{p.icon} {p.name.split(' ')[0]}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duration picker */}
                <div className="w-full">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Duration</label>
                  <div className="flex gap-2 flex-wrap">
                    {durationOptions.map((m) => (
                      <button key={m} onClick={() => setSelectedDuration(m)} className={`duration-pill ${selectedDuration === m ? 'active' : ''}`}>{m}m</button>
                    ))}
                  </div>
                </div>

                {/* Start button */}
                <button
                  onClick={handleQuickStart}
                  disabled={loading}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110 disabled:opacity-40 ${
                    selectedType === 'focus'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-break-phase/20 text-break-phase border border-break-phase/30'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {loading ? '…' : `Start ${selectedDuration}m ${selectedType === 'focus' ? 'Focus' : 'Break'}`}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-4 w-full max-w-sm"
              >
                {/* Queue list */}
                <div className="glass-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Session Queue</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{totalQueueMins}m total</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {queue.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-2 text-center">Add items to build your session</p>
                    )}
                    {queue.map((item, i) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                          item.type === 'focus'
                            ? 'bg-focus/10 border border-focus/20 text-focus'
                            : 'bg-break-phase/10 border border-break-phase/20 text-break-phase'
                        }`}
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                        <span className="flex-1">
                          {item.type === 'focus' ? '🎯' : '☕'} {item.duration}m {item.type}
                        </span>
                        <button onClick={() => removeFromQueue(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add to queue */}
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border border-border overflow-hidden text-xs">
                    <button
                      onClick={() => { setQueueAddType('focus'); setQueueAddDuration(25); }}
                      className={`px-2 py-1 font-semibold ${queueAddType === 'focus' ? 'bg-focus/20 text-focus' : 'text-muted-foreground'}`}
                    >🎯</button>
                    <button
                      onClick={() => { setQueueAddType('break'); setQueueAddDuration(5); }}
                      className={`px-2 py-1 font-semibold ${queueAddType === 'break' ? 'bg-break-phase/20 text-break-phase' : 'text-muted-foreground'}`}
                    >☕</button>
                  </div>
                  <select
                    value={queueAddDuration}
                    onChange={(e) => setQueueAddDuration(Number(e.target.value))}
                    className="bg-muted border border-border rounded-md px-2 py-1 text-xs text-foreground outline-none"
                  >
                    {(queueAddType === 'focus' ? FOCUS_OPTIONS : BREAK_OPTIONS).map(m => (
                      <option key={m} value={m}>{m}m</option>
                    ))}
                  </select>
                  <button
                    onClick={addToQueue}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                {/* Start queue */}
                <button
                  onClick={handleStartQueue}
                  disabled={loading || queue.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <Play className="w-4 h-4" />
                  {loading ? '…' : `Start Queue (${totalQueueMins}m)`}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
