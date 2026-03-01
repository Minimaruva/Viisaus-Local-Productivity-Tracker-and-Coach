import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Project } from '@/types/project';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Calendar as CalIcon, LayoutGrid, LayoutList } from 'lucide-react';

const HOUR_PX = 56;

function localDateStr(d = new Date()): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function minsFromMidnight(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function fmtDuration(seconds: number): string {
  seconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function fmtHour(h: number): string {
  const ampm = h < 12 ? 'am' : 'pm';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${ampm}`;
}

function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return localDateStr(date);
  });
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en', { weekday: 'short' });
}

function dayNum(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').getDate().toString();
}

interface Block {
  id: number;
  type: string;
  start_time: string;
  end_time?: string;
}

interface ScheduledBlock {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  label: string;
}

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

interface CalendarViewProps {
  projects?: Project[];
  onStartWithSettings?: (opts: { focusDuration: number; breakDuration: number }) => void;
}

type ViewMode = 'day' | 'week';

export default function CalendarView({ projects, onStartWithSettings }: CalendarViewProps) {
  const [blocksByDate, setBlocksByDate] = useState<Record<string, Block[]>>({});
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>([]);
  const [selectedDate, setSelectedDate] = useState(localDateStr());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<{ date: string; startMin: number; currentMin: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Todos
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const todayStr = localDateStr();
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // Load blocks for visible dates
  const visibleDates = viewMode === 'week' ? weekDates : [selectedDate];

  const loadBlocks = useCallback(async (dates: string[]) => {
    if (!(window as any).electronAPI) { setLoading(false); return; }
    setLoading(true);
    try {
      const results: Record<string, Block[]> = {};
      for (const date of dates) {
        const result = await (window as any).electronAPI.invoke('focusblocks:get', date);
        results[date] = result || [];
      }
      setBlocksByDate(prev => ({ ...prev, ...results }));
    } catch (e) {
      console.error('[Calendar] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBlocks(visibleDates); }, [selectedDate, viewMode]);

  // Load todos
  useEffect(() => {
    if (!(window as any).electronAPI) return;
    (window as any).electronAPI.invoke('todos:get', selectedDate)
      .then((items: TodoItem[]) => setTodos(items || []))
      .catch(() => {});
  }, [selectedDate]);

  // Live updates
  useEffect(() => {
    if (!(window as any).electronAPI) return;
    const unsub = (window as any).electronAPI.on('timer:tick', () => {
      if (visibleDates.includes(todayStr)) loadBlocks([todayStr]);
    });
    return unsub;
  }, [visibleDates, todayStr, loadBlocks]);

  // Summary for selected date
  const { focusSec, breakSec } = useMemo(() => {
    const blocks = blocksByDate[selectedDate] || [];
    let focusSec = 0, breakSec = 0;
    blocks.forEach((b) => {
      const start = new Date(b.start_time);
      const end = b.end_time ? new Date(b.end_time) : now;
      const dur = Math.max(0, (end.getTime() - start.getTime()) / 1000);
      if (b.type === 'focus') focusSec += dur; else breakSec += dur;
    });
    return { focusSec, breakSec };
  }, [blocksByDate, selectedDate]);

  // Date navigation
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(localDateStr(d));
  };

  // Drag to create
  const getMinFromY = (clientY: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = clientY - rect.top + timelineRef.current.scrollTop;
    return Math.round((y / HOUR_PX) * 60 / 5) * 5;
  };

  const getDateFromX = (clientX: number): string => {
    if (viewMode === 'day') return selectedDate;
    if (!timelineRef.current) return selectedDate;
    const rect = timelineRef.current.getBoundingClientRect();
    const timeGutterWidth = 40;
    const colWidth = (rect.width - timeGutterWidth) / 7;
    const col = Math.floor((clientX - rect.left - timeGutterWidth) / colWidth);
    return weekDates[Math.max(0, Math.min(6, col))] || selectedDate;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const min = getMinFromY(e.clientY);
    const date = getDateFromX(e.clientX);
    setDragging({ date, startMin: min, currentMin: min });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setDragging({ ...dragging, currentMin: getMinFromY(e.clientY) });
  };

  const handleMouseUp = () => {
    if (!dragging) return;
    const start = Math.min(dragging.startMin, dragging.currentMin);
    const end = Math.max(dragging.startMin, dragging.currentMin);
    if (end - start >= 10) {
      setScheduledBlocks(prev => [...prev, {
        id: `sched-${Date.now()}`,
        date: dragging.date,
        startMin: start,
        endMin: end,
        label: `${Math.round(end - start)}m Focus`,
      }]);
    }
    setDragging(null);
  };

  const handleBlockClick = (block: ScheduledBlock) => {
    const duration = Math.round(block.endMin - block.startMin);
    onStartWithSettings?.({ focusDuration: duration, breakDuration: Math.round(duration / 5) });
  };

  const removeScheduledBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScheduledBlocks(prev => prev.filter(b => b.id !== id));
  };

  // Todo handlers
  const addTodo = async () => {
    if (!newTodo.trim()) return;
    if ((window as any).electronAPI) {
      try {
        const result = await (window as any).electronAPI.invoke('todos:add', { date: selectedDate, text: newTodo.trim() });
        if (result?.id) setTodos(prev => [...prev, { id: result.id, text: newTodo.trim(), done: false }]);
      } catch { setTodos(prev => [...prev, { id: Date.now(), text: newTodo.trim(), done: false }]); }
    } else {
      setTodos(prev => [...prev, { id: Date.now(), text: newTodo.trim(), done: false }]);
    }
    setNewTodo('');
  };

  const toggleTodo = async (id: number) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    if ((window as any).electronAPI) {
      (window as any).electronAPI.invoke('todos:toggle', id).catch(() => {});
    }
  };

  const removeTodo = async (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    if ((window as any).electronAPI) {
      (window as any).electronAPI.invoke('todos:remove', id).catch(() => {});
    }
  };

  // Render blocks for a given date in a column
  const renderDateBlocks = (date: string, blocks: Block[]) => {
    const isToday = date === todayStr;
    return blocks.map((b) => {
      const startMin = minsFromMidnight(b.start_time);
      const endMin = b.end_time ? minsFromMidnight(b.end_time) : (isToday ? currentMins : startMin);
      const top = (startMin / 60) * HOUR_PX;
      const height = Math.max(6, ((endMin - startMin) / 60) * HOUR_PX);
      const isLive = !b.end_time && isToday;
      return (
        <div
          key={b.id}
          className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 ${
            b.type === 'focus'
              ? 'bg-focus/20 border-l-[3px] border-l-focus'
              : 'bg-break-phase/20 border-l-[3px] border-l-break-phase'
          } ${isLive ? 'animate-[block-pulse_2s_ease-in-out_infinite_alternate]' : ''}`}
          style={{ top: `${top}px`, height: `${height}px` }}
        >
          {height >= 18 && (
            <span className="text-[10px] font-semibold text-foreground">
              {b.type === 'focus' ? '🎯' : '☕'} {fmtDuration(Math.max(0, (endMin - startMin) * 60))}
              {isLive && ' •'}
            </span>
          )}
        </div>
      );
    });
  };

  const renderScheduledBlocks = (date: string) => {
    return scheduledBlocks.filter(sb => sb.date === date).map((sb) => (
      <div
        key={sb.id}
        className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 bg-secondary/15 border-l-[3px] border-l-secondary border border-secondary/20 cursor-pointer hover:bg-secondary/25 transition-colors group"
        style={{ top: `${(sb.startMin / 60) * HOUR_PX}px`, height: `${((sb.endMin - sb.startMin) / 60) * HOUR_PX}px` }}
        onClick={() => handleBlockClick(sb)}
        title="Click to start this focus session"
      >
        <span className="text-[10px] font-semibold text-secondary">{sb.label}</span>
        <button
          onClick={(e) => removeScheduledBlock(sb.id, e)}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    ));
  };

  const renderDragPreview = (date: string) => {
    if (!dragging || dragging.date !== date || Math.abs(dragging.currentMin - dragging.startMin) < 5) return null;
    return (
      <div
        className="absolute left-0.5 right-0.5 rounded bg-primary/10 border border-primary/30 border-dashed"
        style={{
          top: `${(Math.min(dragging.startMin, dragging.currentMin) / 60) * HOUR_PX}px`,
          height: `${(Math.abs(dragging.currentMin - dragging.startMin) / 60) * HOUR_PX}px`,
        }}
      />
    );
  };

  const renderCurrentTimeLine = (date: string) => {
    if (date !== todayStr) return null;
    return (
      <div className="absolute pointer-events-none z-10" style={{ top: `${(currentMins / 60) * HOUR_PX}px`, left: 0, right: 0 }}>
        <div className="h-0.5 bg-destructive rounded-full shadow-[0_0_6px_hsl(var(--destructive)/0.5)]" />
        <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-destructive" />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Calendar</h1>
          <p className="text-xs text-muted-foreground">Drag to schedule • Click blocks to start</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Week
            </button>
          </div>
          <button onClick={() => shiftDate(viewMode === 'week' ? -7 : -1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setSelectedDate(localDateStr())} className="text-xs font-semibold text-primary hover:underline">Today</button>
          <button onClick={() => shiftDate(viewMode === 'week' ? 7 : 1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary + Todos row */}
      <div className="flex gap-3 px-5 pb-3">
        {/* Summary pills */}
        <div className="flex gap-2 items-center">
          <span className="pill-focus text-[11px] font-semibold px-2.5 py-0.5 rounded-full">🎯 {fmtDuration(focusSec)}</span>
          <span className="pill-break text-[11px] font-semibold px-2.5 py-0.5 rounded-full">☕ {fmtDuration(breakSec)}</span>
        </div>

        {/* Inline todo input */}
        <div className="flex-1 flex items-center gap-2 ml-auto max-w-xs">
          <input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add todo…"
            className="flex-1 bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <button onClick={addTodo} className="w-6 h-6 rounded bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Todo list (compact) */}
      <AnimatePresence>
        {todos.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-3 overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              {todos.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border transition-colors group ${
                    t.done
                      ? 'bg-success/10 border-success/20 text-success line-through'
                      : 'bg-muted border-border text-foreground'
                  }`}
                >
                  <button onClick={() => toggleTodo(t.id)} className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center flex-shrink-0">
                    {t.done && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <span className="truncate max-w-[120px]">{t.text}</span>
                  <button onClick={() => removeTodo(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      {loading ? (
        <p className="text-sm text-muted-foreground italic p-5">Loading…</p>
      ) : (
        <div
          ref={timelineRef}
          className="flex-1 overflow-y-auto relative select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => dragging && setDragging(null)}
        >
          {viewMode === 'week' ? (
            /* ═══ WEEK VIEW ═══ */
            <div className="flex" style={{ height: `${24 * HOUR_PX}px` }}>
              {/* Time gutter */}
              <div className="w-10 flex-shrink-0 relative">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute left-0" style={{ top: `${h * HOUR_PX}px` }}>
                    <span className="text-[10px] font-semibold text-muted-foreground select-none">{fmtHour(h)}</span>
                  </div>
                ))}
              </div>
              {/* Day columns */}
              {weekDates.map((date) => {
                const isToday = date === todayStr;
                const isSelected = date === selectedDate;
                return (
                  <div key={date} className="flex-1 relative border-l border-border/30" onClick={() => setSelectedDate(date)}>
                    {/* Day header */}
                    <div className={`sticky top-0 z-20 text-center py-1 text-[10px] font-bold border-b border-border/30 backdrop-blur-sm ${
                      isToday ? 'bg-primary/10 text-primary' : isSelected ? 'bg-accent text-foreground' : 'bg-background/80 text-muted-foreground'
                    }`}>
                      <div>{shortDay(date)}</div>
                      <div className={`text-sm ${isToday ? 'text-primary' : ''}`}>{dayNum(date)}</div>
                    </div>
                    {/* Hour lines */}
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="absolute left-0 right-0" style={{ top: `${h * HOUR_PX}px` }}>
                        <div className="h-px bg-border/20" />
                      </div>
                    ))}
                    {/* Blocks */}
                    {renderDateBlocks(date, blocksByDate[date] || [])}
                    {renderScheduledBlocks(date)}
                    {renderDragPreview(date)}
                    {renderCurrentTimeLine(date)}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ═══ DAY VIEW ═══ */
            <div className="relative" style={{ height: `${24 * HOUR_PX}px` }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: `${h * HOUR_PX}px`, height: `${HOUR_PX}px` }}>
                  <span className="w-10 text-[10px] font-semibold text-muted-foreground shrink-0 pt-0.5 select-none">{fmtHour(h)}</span>
                  <div className="flex-1 h-px bg-border/40 mt-2" />
                </div>
              ))}
              <div className="absolute top-0 bottom-0" style={{ left: 48, right: 8 }}>
                {renderDateBlocks(selectedDate, blocksByDate[selectedDate] || [])}
                {renderScheduledBlocks(selectedDate)}
                {renderDragPreview(selectedDate)}
                {renderCurrentTimeLine(selectedDate)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
