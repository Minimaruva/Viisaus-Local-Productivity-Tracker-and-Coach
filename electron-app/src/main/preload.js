/**
 * preload.js — Context Bridge
 *
 * This script runs in a privileged context BEFORE the renderer page loads.
 * It uses contextBridge to expose a strict, typed API surface to the React
 * renderer. The renderer NEVER gets access to Node.js internals.
 *
 * Security guarantees:
 *  - nodeIntegration is FALSE  (enforced in main.js BrowserWindow options)
 *  - contextIsolation is TRUE  (enforced in main.js BrowserWindow options)
 *  - Only the channels listed here can be used by the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Allowed IPC channels the renderer may SEND to the main process.
const VALID_SEND_CHANNELS = [
  'session:start',
  'session:stop',
  'session:start-break',
  'session:startBreakOnly',
  'focusblocks:get',
  'blocklist:add',
  'blocklist:remove',
  'blocklist:get',
  'projects:get',
  'projects:add',
  'projects:update',
  'projects:remove',
  'todos:get',
  'todos:add',
  'todos:toggle',
  'todos:remove',
  'mini:close',
];

// Allowed IPC channels the renderer may LISTEN to from the main process.
const VALID_RECEIVE_CHANNELS = [
  'distraction-detected',
  'window-clear',
  'session:started',
  'session:stopped',
  'blocklist:updated',
  'timer:tick',
  'timer:phase-change',
  'tracker:url-warning',
];

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Invoke (request → response) ──────────────────────────────────────────
  /**
   * Send a message to the main process and await a response.
   * @param {string} channel  — must be in VALID_SEND_CHANNELS
   * @param {...any} args
   * @returns {Promise<any>}
   */
  invoke: (channel, ...args) => {
    if (!VALID_SEND_CHANNELS.includes(channel)) {
      console.warn(`[preload] Blocked attempted invoke on channel: "${channel}"`);
      return Promise.reject(new Error(`Channel "${channel}" is not permitted.`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // ── One-way listeners (main → renderer) ─────────────────────────────────
  /**
   * Register a callback for events pushed from the main process.
   * Returns an unsubscribe function to avoid listener leaks.
   *
   * @param {string} channel  — must be in VALID_RECEIVE_CHANNELS
   * @param {function} callback
   * @returns {function} unsubscribe
   */
  on: (channel, callback) => {
    if (!VALID_RECEIVE_CHANNELS.includes(channel)) {
      console.warn(`[preload] Blocked attempted listen on channel: "${channel}"`);
      return () => {};
    }
    // Wrap to prevent the raw Event object from leaking into the renderer.
    const handler = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);
    // Return a cleanup function so React effects can unsubscribe.
    return () => ipcRenderer.removeListener(channel, handler);
  },

  /**
   * Register a one-time listener.
   * @param {string} channel
   * @param {function} callback
   */
  once: (channel, callback) => {
    if (!VALID_RECEIVE_CHANNELS.includes(channel)) {
      console.warn(`[preload] Blocked attempted once on channel: "${channel}"`);
      return;
    }
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
});
