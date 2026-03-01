import React, { useState, useEffect, useCallback } from 'react';
import AppSidebar, { PanelId } from '@/components/AppSidebar';
import DashboardView from '@/components/DashboardView';
import CalendarView from '@/components/CalendarView';
import ProjectsView from '@/components/ProjectsView';
import SessionControlsView from '@/components/SessionControlsView';
import SettingsView from '@/components/SettingsView';
import BlockedOverlay from '@/components/BlockedOverlay';
import { useProjects } from '@/hooks/useProjects';
import { Project } from '@/types/project';

interface BlocklistItem {
  id: number;
  app_or_url_name: string;
}

interface TimerState {
  phase: string;
  remaining: number;
  total: number;
  active: boolean;
}

const Index = () => {
  const [panel, setPanel] = useState<PanelId>('dashboard');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [blocklist, setBlocklist] = useState<BlocklistItem[]>([]);
  const [isDistracting, setIsDistracting] = useState(false);
  const [windowInfo, setWindowInfo] = useState<any>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [timerState, setTimerState] = useState<TimerState>({
    phase: 'focus', remaining: 0, total: 0, active: false,
  });
  const [pendingStart, setPendingStart] = useState<{ focusDuration: number; breakDuration: number; projectId?: string } | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const { projects, addProject, updateProject, removeProject } = useProjects();

  // Bootstrap
  useEffect(() => {
    if (!(window as any).electronAPI) return;
    (window as any).electronAPI
      .invoke('blocklist:get')
      .then((list: BlocklistItem[]) => setBlocklist(list))
      .catch((err: any) => console.error('[App] blocklist load:', err));
  }, []);

  // IPC listeners
  useEffect(() => {
    if (!(window as any).electronAPI) return;
    const u1 = (window as any).electronAPI.on('distraction-detected', (info: any) => {
      setIsDistracting(true);
      setWindowInfo(info);
    });
    const u2 = (window as any).electronAPI.on('window-clear', () => {
      setIsDistracting(false);
      setWindowInfo(null);
    });
    const u3 = (window as any).electronAPI.on('timer:tick', (state: TimerState) => setTimerState(state));
    return () => { u1(); u2(); u3(); };
  }, []);

  // Session handlers
  const handleStartSession = useCallback(async (opts: { focusDuration: number; breakDuration: number; projectId?: string }) => {
    if (!(window as any).electronAPI) return;
    const result = await (window as any).electronAPI.invoke('session:start', opts);
    if (result.error) { console.warn('[App] session:start:', result.error); return; }
    setSessionId(result.sessionId);
    if (opts.projectId) {
      const proj = projects.find(p => p.id === opts.projectId);
      if (proj) setActiveProject(proj);
    }
  }, [projects]);

  const handleStopSession = useCallback(async () => {
    if (!(window as any).electronAPI) return;
    const result = await (window as any).electronAPI.invoke('session:stop');
    if (result?.error) { console.warn('[App] session:stop:', result.error); return; }
    setSessionId(null);
    setIsDistracting(false);
    setWindowInfo(null);
    setActiveProject(null);
    setTimerState({ phase: 'focus', remaining: 0, total: 0, active: false });
  }, []);

  const handleStartBreak = useCallback(async () => {
    if (!(window as any).electronAPI) return;
    const result = await (window as any).electronAPI.invoke('session:start-break');
    if (result?.error) console.warn('[App] session:start-break:', result.error);
  }, []);

  // Blocklist handlers
  const handleAddToBlocklist = useCallback(async (name: string) => {
    if (!(window as any).electronAPI) return;
    const result = await (window as any).electronAPI.invoke('blocklist:add', name);
    if (result?.error) throw new Error(result.error);
    const updated = await (window as any).electronAPI.invoke('blocklist:get');
    setBlocklist(updated);
  }, []);

  const handleRemoveFromBlocklist = useCallback(async (id: number) => {
    if (!(window as any).electronAPI) return;
    await (window as any).electronAPI.invoke('blocklist:remove', id);
    setBlocklist((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Calendar → Focus panel bridge
  const handleStartFromCalendar = useCallback((opts: { focusDuration: number; breakDuration: number }) => {
    setPendingStart(opts);
    setPanel('focus');
  }, []);

  // Project → Focus panel bridge
  const handleProjectFocus = useCallback((project: Project) => {
    setPendingStart({
      focusDuration: project.defaultFocusDuration,
      breakDuration: project.defaultBreakDuration,
      projectId: project.id,
    });
    setPanel('focus');
  }, []);

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center text-destructive">
        <h2 className="text-lg font-bold">Initialisation Error</h2>
        <pre className="font-mono text-sm text-muted-foreground whitespace-pre-wrap break-all">{initError}</pre>
      </div>
    );
  }

  return (
    <>
      <BlockedOverlay isVisible={isDistracting} windowInfo={windowInfo} />
      <div className="flex h-screen bg-background">
        <AppSidebar activePanel={panel} onPanelChange={setPanel} isSessionActive={sessionId !== null} />
        <main className="flex-1 overflow-hidden">
          {panel === 'dashboard' && <DashboardView timerState={timerState} />}
          {panel === 'calendar' && <CalendarView projects={projects} onStartWithSettings={handleStartFromCalendar} />}
          {panel === 'projects' && (
            <ProjectsView
              projects={projects}
              onAdd={addProject}
              onUpdate={updateProject}
              onRemove={removeProject}
              onSelectForFocus={handleProjectFocus}
            />
          )}
          {panel === 'focus' && (
            <SessionControlsView
              sessionId={sessionId}
              timerState={timerState}
              onStart={handleStartSession}
              onStop={handleStopSession}
              onStartBreak={handleStartBreak}
              initialFocus={pendingStart?.focusDuration}
              initialBreak={pendingStart?.breakDuration}
              projects={projects}
              activeProject={activeProject}
              initialProjectId={pendingStart?.projectId}
            />
          )}
          {panel === 'settings' && (
            <SettingsView
              blocklist={blocklist}
              onAdd={handleAddToBlocklist}
              onRemove={handleRemoveFromBlocklist}
            />
          )}
        </main>
      </div>
    </>
  );
};

export default Index;
