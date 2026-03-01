/**
 * App.jsx — Root React component
 *
 * Layout: sidebar (5 panels) + main content area.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BlockedOverlay from './components/BlockedOverlay.jsx';
import AppSidebar from './components/AppSidebar.jsx';
import DashboardView from './components/DashboardView.jsx';
import CalendarView from './components/CalendarView.jsx';
import ProjectsView from './components/ProjectsView.jsx';
import SessionControlsView from './components/SessionControlsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { useProjects } from './hooks/useProjects.js';

const PANELS = ['dashboard', 'calendar', 'projects', 'focus', 'settings'];

export default function App() {
  const [panel, setPanel]                   = useState('dashboard');
  const [sessionId, setSessionId]           = useState(null);
  const [blocklist, setBlocklist]           = useState([]);
  const [isDistracting, setIsDistracting]   = useState(false);
  const [windowInfo, setWindowInfo]         = useState(null);
  const [timerState, setTimerState]         = useState({
    phase: 'focus', remaining: 0, total: 0, active: false,
  });
  const [pendingStart, setPendingStart]     = useState(null);
  const [activeProject, setActiveProject]  = useState(null);

  const { projects, addProject, updateProject, removeProject } = useProjects();

  // ── Bootstrap ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI
      .invoke('blocklist:get')
      .then(setBlocklist)
      .catch((err) => console.error('[App] Failed to load blocklist:', err));
  }, []);

  // ── IPC listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI) return;
    const u1 = window.electronAPI.on('distraction-detected', (info) => {
      setIsDistracting(true);
      setWindowInfo(info);
    });
    const u2 = window.electronAPI.on('window-clear', () => {
      setIsDistracting(false);
      setWindowInfo(null);
    });
    const u3 = window.electronAPI.on('timer:tick', (state) => setTimerState(state));
    return () => { u1(); u2(); u3(); };
  }, []);

  // ── Session handlers ───────────────────────────────────────────────────
  const handleStartSession = useCallback(async (opts = {}) => {
    if (!window.electronAPI) return;
    if (opts.projectId) {
      const proj = projects.find((p) => p.id === opts.projectId);
      if (proj) setActiveProject(proj);
    }
    const result = await window.electronAPI.invoke('session:start', opts);
    if (result?.error) { console.warn('[App] session:start:', result.error); return; }
    setSessionId(result.sessionId);
  }, [projects]);

  const handleStopSession = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.invoke('session:stop');
    if (result?.error) { console.warn('[App] session:stop:', result.error); return; }
    setSessionId(null);
    setActiveProject(null);
    setIsDistracting(false);
    setWindowInfo(null);
    setTimerState({ phase: 'focus', remaining: 0, total: 0, active: false });
  }, []);

  const handleStartBreak = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.invoke('session:start-break');
    if (result?.error) console.warn('[App] session:start-break:', result.error);
  }, []);

  const handleStartBreakOnly = useCallback(async (opts = {}) => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.invoke('session:startBreakOnly', opts);
    if (result?.error) console.warn('[App] session:startBreakOnly:', result.error);
    else if (result?.sessionId) setSessionId(result.sessionId);
  }, []);

  // ── Blocklist handlers ─────────────────────────────────────────────────
  const handleAddToBlocklist = useCallback(async (name) => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.invoke('blocklist:add', name);
    if (result?.error) throw new Error(result.error);
    const updated = await window.electronAPI.invoke('blocklist:get');
    setBlocklist(updated);
  }, []);

  const handleRemoveFromBlocklist = useCallback(async (id) => {
    if (!window.electronAPI) return;
    await window.electronAPI.invoke('blocklist:remove', id);
    setBlocklist((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // ── Navigation bridges ─────────────────────────────────────────────────
  const handleStartFromCalendar = useCallback((opts) => {
    setPendingStart(opts);
    setPanel('focus');
  }, []);

  const handleSelectProjectForFocus = useCallback((project) => {
    setActiveProject(project);
    setPendingStart({ projectId: project.id });
    setPanel('focus');
  }, []);

  // Clear pending start once consumed by SessionControlsView
  const handlePendingConsumed = useCallback(() => setPendingStart(null), []);

  return (
    <>
      <BlockedOverlay isVisible={isDistracting} windowInfo={windowInfo} />

      <div className="flex h-screen bg-background text-foreground overflow-hidden">

        {/* ── Sidebar ── */}
        <AppSidebar
          activePanel={panel}
          onPanelChange={setPanel}
          isSessionActive={!!sessionId}
          timerPhase={timerState.phase}
        />

        {/* ── Content area ── */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={panel}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full overflow-hidden"
            >
              {panel === 'dashboard' && (
                <DashboardView
                  timerState={timerState}
                  sessionId={sessionId}
                  activeProject={activeProject}
                  onNavigate={setPanel}
                />
              )}

              {panel === 'calendar' && (
                <CalendarView
                  projects={projects}
                  onStartWithSettings={handleStartFromCalendar}
                />
              )}

              {panel === 'projects' && (
                <ProjectsView
                  projects={projects}
                  onAdd={addProject}
                  onUpdate={updateProject}
                  onRemove={removeProject}
                  onSelectForFocus={handleSelectProjectForFocus}
                />
              )}

              {panel === 'focus' && (
                <SessionControlsView
                  sessionId={sessionId}
                  timerState={timerState}
                  projects={projects}
                  activeProject={activeProject}
                  pendingStart={pendingStart}
                  onPendingConsumed={handlePendingConsumed}
                  onStart={handleStartSession}
                  onStop={handleStopSession}
                  onStartBreak={handleStartBreak}
                  onStartBreakOnly={handleStartBreakOnly}
                />
              )}

              {panel === 'settings' && (
                <SettingsView
                  blocklist={blocklist}
                  onAdd={handleAddToBlocklist}
                  onRemove={handleRemoveFromBlocklist}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}
