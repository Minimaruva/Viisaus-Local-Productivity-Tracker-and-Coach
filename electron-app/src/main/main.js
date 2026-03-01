/**
 * main.js — Electron Main Process
 *
 * Responsibilities:
 *  1. Create the BrowserWindow with strict security settings.
 *  2. Initialise the SQLite database.
 *  3. Run the active-window tracking loop every 2 seconds.
 *  4. Check tracked windows against the blocklist and push IPC events.
 *  5. Handle IPC requests from the renderer (session & blocklist CRUD).
 */

'use strict';

const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
} = require('electron');
const path = require('path');

const {
  initDatabase,
  startSession,
  stopSession,
  startBlock,
  endBlock,
  getBlocksForDate,
  addToBlocklist,
  removeFromBlocklist,
  getAllBlocklist,
  isBlocked,
  getProjects,
  upsertProject,
  deleteProject,
  getTodosForDate,
  addTodo,
  toggleTodo,
  deleteTodo,
  closeDatabase,
} = require('./database');

// ─── Constants ────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === 'development';
const RENDERER_DEV_URL = 'http://localhost:5173';
const RENDERER_PROD_PATH = path.join(__dirname, '../../dist/renderer/index.html');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const TRACKING_INTERVAL_MS = 2000;
const MINI_WIN_WIDTH        = 300;
const MINI_WIN_HEIGHT       = 60;

// ─── State ───────────────────────────────────────────────────────────────────

let mainWindow = null;
let trackingInterval = null;
let currentSessionId = null;
let currentBlockId   = null;  // id of the currently open focus_blocks row
let wasDistracted    = false; // tracks previous loop state to avoid event spam
let lastUrlWarning   = null;  // null | true | false — debounces tracker:url-warning

const BROWSER_NAMES = ['chrome', 'firefox', 'msedge', 'edge', 'brave', 'opera', 'vivaldi', 'arc'];

// ── Mini-timer window ──────────────────────────────────────────────────────
let miniWindow = null;

// ── Countdown timer (owned by the main process) ────────────────────────────
const timerState = {
  phase: 'focus',       // 'focus' | 'break'
  remaining: 0,         // seconds left in current phase
  total: 0,             // total seconds for current phase
  focusDuration: 1500,  // default 25 min
  breakDuration: 300,   // default 5 min
  active: false,
};
let timerInterval = null;

function broadcastToWindows(channel, payload) {
  [mainWindow, miniWindow].forEach((win) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

function sendTimerTick() {
  broadcastToWindows('timer:tick', {
    phase:     timerState.phase,
    remaining: timerState.remaining,
    total:     timerState.total,
    active:    timerState.active,
  });
}

/**
 * @param {number} focusMins
 * @param {number} breakMins
 * @param {function(string):void} [onPhaseChange]  called with new phase name on each auto-flip
 */
function startTimer(focusMins, breakMins, onPhaseChange) {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerState.focusDuration = focusMins * 60;
  timerState.breakDuration = breakMins * 60;
  timerState.phase         = 'focus';
  timerState.total         = timerState.focusDuration;
  timerState.remaining     = timerState.focusDuration;
  timerState.active        = true;
  sendTimerTick();
  timerInterval = setInterval(() => {
    timerState.remaining = Math.max(0, timerState.remaining - 1);
    if (timerState.remaining === 0) {
      timerState.phase     = timerState.phase === 'focus' ? 'break' : 'focus';
      timerState.total     = timerState.phase === 'focus'
        ? timerState.focusDuration
        : timerState.breakDuration;
      timerState.remaining = timerState.total;
      broadcastToWindows('timer:phase-change', { phase: timerState.phase });
      if (onPhaseChange) onPhaseChange(timerState.phase);
    }
    sendTimerTick();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerState.active    = false;
  timerState.remaining = 0;
  sendTimerTick();
}

// ─── Window Creation ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'MyTracker',
    backgroundColor: '#0f172a',
    webPreferences: {
      // ✅ SECURITY: preload runs in a privileged context to bridge IPC
      preload: PRELOAD_PATH,

      // ✅ SECURITY: context isolation keeps Node globals out of the renderer
      contextIsolation: true,

      // ✅ SECURITY: nodeIntegration is explicitly false — the renderer is an
      //             untrusted web page and must NEVER have Node.js access.
      nodeIntegration: false,

      // ✅ SECURITY: disable access to remote content from the renderer
      sandbox: false, // needed so preload can use require('electron')

      // ✅ SECURITY: prevent the renderer from spawning new windows
      disableDialogs: false,
    },
  });

  // ── Load the renderer ─────────────────────────────────────────────────────
  if (isDev) {
    mainWindow.loadURL(RENDERER_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(RENDERER_PROD_PATH);
  }

  // Prevent the renderer from navigating to arbitrary URLs.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(isDev ? RENDERER_DEV_URL : `file://`)) {
      event.preventDefault();
      shell.openExternal(url); // open in system browser instead
    }
  });

  // Prevent new windows/popups from opening inside the app.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Mini Timer Window ────────────────────────────────────────────────────────

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) return;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  miniWindow = new BrowserWindow({
    width: MINI_WIN_WIDTH,
    height: MINI_WIN_HEIGHT,
    x: width - MINI_WIN_WIDTH - 24,
    y: 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false, // keep ticking even when not focused
    },
  });

  if (isDev) {
    miniWindow.loadURL(`${RENDERER_DEV_URL}/mini.html`);
  } else {
    miniWindow.loadFile(path.join(__dirname, '../../dist/renderer/mini.html'));
  }

  // Push current timer state as soon as the page is interactive.
  miniWindow.webContents.on('dom-ready', () => sendTimerTick());
  miniWindow.on('closed', () => { miniWindow = null; });
}

function closeMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close();
    miniWindow = null;
  }
}

// ─── Active-Window Tracking Loop ────────────────────────────────────────────

/**
 * active-win v8+ is an ESM-only package, so we import it dynamically.
 * We resolve the import once at startup and keep the reference.
 */
let _activeWin = null;

async function loadActiveWin() {
  const { default: activeWin } = await import('active-win');
  _activeWin = activeWin;
  console.log('[Tracker] active-win loaded successfully.');
}

/**
 * Starts the 2-second polling loop.
 * The loop is paused when there is no active session (currentSessionId is null).
 */
function startTrackingLoop() {
  if (trackingInterval) return; // already running

  trackingInterval = setInterval(async () => {
    // Do nothing if no session is active.
    if (!currentSessionId) return;
    // Do nothing if the window has been closed.
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Do nothing if active-win is not yet loaded.
    if (!_activeWin) return;

    try {
      const activeWindow = await _activeWin();

      if (!activeWindow) return;

      const appName = activeWindow?.owner?.name ?? null;
      const url = activeWindow?.url ?? null;
      const title = activeWindow?.title ?? null;

      // Detect whether we're looking at a browser window with no readable URL.
      // On Windows, active-win never exposes browser URLs — only titles.
      const appNameLower = (appName || '').toLowerCase();
      const isBrowserWindow = BROWSER_NAMES.some((b) => appNameLower.includes(b));
      const canReadUrl = !isBrowserWindow || !!url;
      if (canReadUrl !== lastUrlWarning) {
        lastUrlWarning = canReadUrl;
        broadcastToWindows('tracker:url-warning', { canReadUrl, appName: canReadUrl ? null : appName });
      }

      // Pass title too — on Windows active-win returns no URL, only titles.
      const blocked = isBlocked(appName, url, title);

      if (blocked && !wasDistracted) {
        wasDistracted = true;
        mainWindow.webContents.send('distraction-detected', { appName, url, title });
        console.log(`[Tracker] 🚫 Distraction detected: ${appName} | ${url}`);
      } else if (!blocked && wasDistracted) {
        wasDistracted = false;
        mainWindow.webContents.send('window-clear');
        console.log('[Tracker] ✅ Window cleared.');
      }
    } catch (err) {
      // active-win can throw on systems without window-tracking permissions.
      // Log but do not crash the loop.
      console.error('[Tracker] Error reading active window:', err.message);
    }
  }, TRACKING_INTERVAL_MS);

  console.log('[Tracker] Loop started.');
}

function stopTrackingLoop() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
    wasDistracted = false;
    console.log('[Tracker] Loop stopped.');
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // ── Sessions ──────────────────────────────────────────────────────────────

  ipcMain.handle('session:start', (_event, opts = {}) => {
    if (currentSessionId !== null) {
      return { error: 'A session is already active.', sessionId: currentSessionId };
    }
    const session    = startSession();
    currentSessionId = session.id;
    const focusMins  = (opts && typeof opts.focusDuration === 'number') ? opts.focusDuration : 25;
    const breakMins  = (opts && typeof opts.breakDuration  === 'number') ? opts.breakDuration  : 5;

    // Open the first focus block and wire the timer's auto-flip into block tracking.
    const firstBlock = startBlock(currentSessionId, 'focus');
    currentBlockId = firstBlock.id;

    startTimer(focusMins, breakMins, (newPhase) => {
      // Auto phase-flip: close old block, open new one.
      if (currentBlockId !== null) { endBlock(currentBlockId); currentBlockId = null; }
      if (currentSessionId !== null) {
        const b = startBlock(currentSessionId, newPhase);
        currentBlockId = b.id;
      }
    });

    createMiniWindow();
    console.log(`[Session] Started #${currentSessionId} | Focus: ${focusMins}m | Break: ${breakMins}m`);
    return { sessionId: currentSessionId, start_time: session.start_time };
  });

  ipcMain.handle('session:stop', () => {
    if (currentSessionId === null) {
      return { error: 'No active session to stop.' };
    }
    // Close any open block.
    if (currentBlockId !== null) { endBlock(currentBlockId); currentBlockId = null; }
    const session = stopSession(currentSessionId);
    console.log(`[Session] Stopped #${currentSessionId}`);
    wasDistracted    = false;
    currentSessionId = null;
    lastUrlWarning   = null;
    stopTimer();
    closeMiniWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-clear');
    }
    return session;
  });

  // Force an immediate switch to break phase (user-initiated).
  ipcMain.handle('session:start-break', () => {
    if (currentSessionId === null) return { error: 'No active session.' };
    if (timerState.phase === 'break')  return { error: 'Already in break.' };
    // Close the current focus block.
    if (currentBlockId !== null) { endBlock(currentBlockId); currentBlockId = null; }
    // Flip the timer to break.
    timerState.phase     = 'break';
    timerState.total     = timerState.breakDuration;
    timerState.remaining = timerState.breakDuration;
    // Open a new break block.
    const b = startBlock(currentSessionId, 'break');
    currentBlockId = b.id;
    broadcastToWindows('timer:phase-change', { phase: 'break' });
    sendTimerTick();
    console.log(`[Session] Manual break started for #${currentSessionId}`);
    return { success: true };
  });

  // ── Blocklist ─────────────────────────────────────────────────────────────

  ipcMain.handle('blocklist:get', () => {
    return getAllBlocklist();
  });

  ipcMain.handle('blocklist:add', (_event, name) => {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { error: 'Invalid name.' };
    }
    const entry = addToBlocklist(name);
    console.log(`[Blocklist] Added: "${entry.app_or_url_name}"`);
    return entry;
  });

  ipcMain.handle('blocklist:remove', (_event, id) => {
    if (typeof id !== 'number') {
      return { error: 'Invalid id.' };
    }
    removeFromBlocklist(id);
    console.log(`[Blocklist] Removed id: ${id}`);
    return { success: true };
  });
  // ── Focus blocks (daily view) ──────────────────────────────────────────
  ipcMain.handle('focusblocks:get', (_event, dateStr) => {
    // Build a UTC time range covering local midnight → next local midnight.
    // dateStr is "YYYY-MM-DD" from the renderer's local timezone.
    const parts = dateStr ? dateStr.split('-').map(Number) : null;
    const localMidnight = parts
      ? new Date(parts[0], parts[1] - 1, parts[2])    // local midnight
      : (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
    const nextMidnight = new Date(localMidnight.getTime() + 86_400_000);
    return getBlocksForDate(localMidnight.toISOString(), nextMidnight.toISOString());
  });
  // ── Mini window ───────────────────────────────────────────────────────────
  ipcMain.handle('mini:close', () => {
    closeMiniWindow();
    return { success: true };
  });

  // ── Projects ──────────────────────────────────────────────────────────────
  ipcMain.handle('projects:get', () => getProjects());

  ipcMain.handle('projects:add', (_event, project) => {
    if (!project || !project.id) return { error: 'Invalid project.' };
    return upsertProject(project);
  });

  ipcMain.handle('projects:update', (_event, project) => {
    if (!project || !project.id) return { error: 'Invalid project.' };
    return upsertProject(project);
  });

  ipcMain.handle('projects:remove', (_event, id) => {
    if (!id) return { error: 'Invalid id.' };
    deleteProject(id);
    return { success: true };
  });

  // ── Todos ─────────────────────────────────────────────────────────────────
  ipcMain.handle('todos:get', (_event, date) => {
    if (!date) return [];
    return getTodosForDate(date).map((t) => ({ ...t, done: t.done === 1 }));
  });

  ipcMain.handle('todos:add', (_event, { date, text }) => {
    if (!date || !text) return { error: 'Missing date or text.' };
    return addTodo(date, text.trim());
  });

  ipcMain.handle('todos:toggle', (_event, id) => {
    toggleTodo(id);
    return { success: true };
  });

  ipcMain.handle('todos:remove', (_event, id) => {
    deleteTodo(id);
    return { success: true };
  });

  // ── Break-only start ──────────────────────────────────────────────────────
  // Starts a session immediately in break phase (no initial focus block).
  ipcMain.handle('session:startBreakOnly', (_event, opts = {}) => {
    if (currentSessionId !== null) {
      return { error: 'A session is already active.', sessionId: currentSessionId };
    }
    const breakMins = (opts && typeof opts.breakDuration === 'number') ? opts.breakDuration : 5;
    const session   = startSession();
    currentSessionId = session.id;

    // Open a break block directly.
    const block  = startBlock(currentSessionId, 'break');
    currentBlockId = block.id;

    // Start the timer (focusDuration=25 so auto-flip to focus is sensible)
    // then immediately override to break phase before the first tick.
    startTimer(25, breakMins, (newPhase) => {
      if (currentBlockId !== null) { endBlock(currentBlockId); currentBlockId = null; }
      if (currentSessionId !== null) {
        const b = startBlock(currentSessionId, newPhase);
        currentBlockId = b.id;
      }
    });
    // Override phase to break.
    timerState.phase     = 'break';
    timerState.total     = breakMins * 60;
    timerState.remaining = breakMins * 60;
    sendTimerTick();

    createMiniWindow();
    console.log(`[Session] Break-only started #${currentSessionId} | Break: ${breakMins}m`);
    return { sessionId: currentSessionId, start_time: session.start_time };
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // 1. Load the ESM active-win module.
  await loadActiveWin();

  // 2. Initialise the database (creates tables if needed).
  // initDatabase is async because sql.js must load its WASM binary first.
  await initDatabase();

  // 3. Register all IPC handlers before creating the window.
  registerIpcHandlers();

  // 4. Create the main browser window.
  createWindow();

  // 5. Kick off the tracking loop (it only polls when a session is active).
  startTrackingLoop();

  // macOS: re-create on dock icon click if all windows closed.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Graceful shutdown: stop the loop and close the DB.
app.on('before-quit', () => {
  stopTrackingLoop();
  stopTimer();
  closeMiniWindow();
  closeDatabase();
});
