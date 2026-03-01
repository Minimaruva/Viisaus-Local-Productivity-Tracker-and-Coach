/**
 * App.jsx — Root React component
 *
 * Layout: vertical sidebar (Focus / Daily / Settings) + main content area.
 */

import React, { useState, useEffect, useCallback } from 'react';
import BlockedOverlay from './components/BlockedOverlay.jsx';
import SessionControls from './components/SessionControls.jsx';
import BlocklistManager from './components/BlocklistManager.jsx';
import DailyView from './components/DailyView.jsx';

const NAV_ITEMS = [
  { id: 'focus',    icon: '🎯', label: 'Focus'    },
  { id: 'daily',    icon: '📅', label: 'Daily'    },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function App() {
  const [panel, setPanel]                 = useState('focus');
  const [sessionId, setSessionId]         = useState(null);
  const [sessionStart, setSessionStart]   = useState(null);
  const [blocklist, setBlocklist]         = useState([]);
  const [isDistracting, setIsDistracting] = useState(false);
  const [windowInfo, setWindowInfo]       = useState(null);
  const [initError, setInitError]         = useState(null);
  const [timerState, setTimerState]       = useState({
    phase: 'focus', remaining: 0, total: 0, active: false,
  });

  // ── Bootstrap ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI) {
      setInitError('electronAPI not available — run inside Electron.');
      return;
    }
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
    const result = await window.electronAPI.invoke('session:start', opts);
    if (result.error) { console.warn('[App] session:start:', result.error); return; }
    setSessionId(result.sessionId);
    setSessionStart(result.start_time);
  }, []);

  const handleStopSession = useCallback(async () => {
    const result = await window.electronAPI.invoke('session:stop');
    if (result?.error) { console.warn('[App] session:stop:', result.error); return; }
    setSessionId(null);
    setSessionStart(null);
    setIsDistracting(false);
    setWindowInfo(null);
    setTimerState({ phase: 'focus', remaining: 0, total: 0, active: false });
  }, []);

  const handleStartBreak = useCallback(async () => {
    const result = await window.electronAPI.invoke('session:start-break');
    if (result?.error) console.warn('[App] session:start-break:', result.error);
  }, []);

  // ── Blocklist handlers ─────────────────────────────────────────────────
  const handleAddToBlocklist = useCallback(async (name) => {
    const result = await window.electronAPI.invoke('blocklist:add', name);
    if (result?.error) throw new Error(result.error);
    const updated = await window.electronAPI.invoke('blocklist:get');
    setBlocklist(updated);
  }, []);

  const handleRemoveFromBlocklist = useCallback(async (id) => {
    await window.electronAPI.invoke('blocklist:remove', id);
    setBlocklist((prev) => prev.filter((item) => item.id !== id));
  }, []);

  if (initError) {
    return (
      <div className="init-error">
        <h2>Initialisation Error</h2>
        <pre>{initError}</pre>
      </div>
    );
  }

  return (
    <>
      <BlockedOverlay isVisible={isDistracting} windowInfo={windowInfo} />

      <div className="app-layout">

        {/* ── Sidebar ── */}
        <nav className="sidebar" aria-label="Main navigation">
          <div className="sidebar__brand" aria-hidden="true">🎯</div>
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`sidebar__item${panel === id ? ' sidebar__item--active' : ''}`}
              onClick={() => setPanel(id)}
              aria-current={panel === id ? 'page' : undefined}
              title={label}
            >
              <span className="sidebar__icon">{icon}</span>
              <span className="sidebar__label">{label}</span>
            </button>
          ))}
          <div className="sidebar__spacer" />
          <p className="sidebar__footer-hint">local only</p>
        </nav>

        {/* ── Content area ── */}
        <main className="content-area">
          {/* ── Focus panel ── */}
          {panel === 'focus' && (
            <div className="panel">
              <div className="app-card">
                <SessionControls
                  sessionId={sessionId}
                  timerState={timerState}
                  onStart={handleStartSession}
                  onStop={handleStopSession}
                  onStartBreak={handleStartBreak}
                />
              </div>
            </div>
          )}

          {/* ── Daily panel ── */}
          {panel === 'daily' && (
            <div className="panel">
              <div className="app-card app-card--full">
                <DailyView />
              </div>
            </div>
          )}

          {/* ── Settings panel ── */}
          {panel === 'settings' && (
            <div className="panel">
              <div className="app-card">
                <BlocklistManager
                  items={blocklist}
                  onAdd={handleAddToBlocklist}
                  onRemove={handleRemoveFromBlocklist}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
