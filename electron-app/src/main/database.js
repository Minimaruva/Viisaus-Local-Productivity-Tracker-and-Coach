/**
 * database.js — SQLite helper using sql.js (pure-JS/WASM, no native compilation).
 *
 * sql.js loads a WebAssembly SQLite build — no Visual Studio or node-gyp needed.
 * Because sql.js keeps the database in memory, we persist it to disk manually
 * after every write operation via _saveDatabase().
 */

const path = require('path');
const fs   = require('fs');
const { app } = require('electron');

// Store the DB in the OS user-data directory so it survives app rebuilds.
const DB_PATH = path.join(app.getPath('userData'), 'mytracker.db');

let db   = null;  // sql.js Database instance
let SQL  = null;  // sql.js constructor set after async init

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Persist the in-memory database to disk.
 * Call after every INSERT / UPDATE / DELETE.
 */
function _saveDatabase() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Execute a SELECT and return an array of plain objects.
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Array<object>}
 */
function _query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Execute a SELECT and return the first row as a plain object, or null.
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {object|null}
 */
function _queryOne(sql, params = []) {
  const rows = _query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Execute an INSERT / UPDATE / DELETE statement.
 * @param {string} sql
 * @param {any[]} [params]
 */
function _run(sql, params = []) {
  db.run(sql, params);
}

/**
 * Opens (or creates) the database and applies the schema.
 * MUST be awaited before any other database function is called.
 * @returns {Promise<void>}
 */
async function initDatabase() {
  const initSqlJs = require('sql.js');
  // require.resolve('sql.js') -> .../node_modules/sql.js/dist/sql-wasm.js
  // path.dirname() gives us the dist/ folder where sql-wasm.wasm lives.
  const sqlJsDist = path.dirname(require.resolve('sql.js'));

  SQL = await initSqlJs({
    // Tell the wasm loader exactly where to find sql-wasm.wasm
    locateFile: (filename) => path.join(sqlJsDist, filename),
  });

  if (fs.existsSync(DB_PATH)) {
    // Load the existing database from disk into memory.
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database from', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database at', DB_PATH);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT    NOT NULL,
      end_time   TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocklist (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      app_or_url_name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS focus_blocks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('focus','break')),
      start_time  TEXT    NOT NULL,
      end_time    TEXT
    );
  `);

  _saveDatabase(); // Persist schema changes immediately.
  console.log('[DB] Schema ready.');
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/**
 * Inserts a new session row with the current timestamp as start_time.
 * @returns {{ id: number, start_time: string }}
 */
function startSession() {
  const startTime = new Date().toISOString();
  _run('INSERT INTO sessions (start_time) VALUES (?)', [startTime]);
  const row = _queryOne('SELECT last_insert_rowid() AS id');
  _saveDatabase();
  return { id: row.id, start_time: startTime };
}

/**
 * Sets the end_time on an open session.
 * @param {number} sessionId
 * @returns {{ id: number, start_time: string, end_time: string } | null}
 */
function stopSession(sessionId) {
  const endTime = new Date().toISOString();
  _run(
    'UPDATE sessions SET end_time = ? WHERE id = ? AND end_time IS NULL',
    [endTime, sessionId]
  );
  _saveDatabase();
  return _queryOne('SELECT * FROM sessions WHERE id = ?', [sessionId]);
}

// ─── Focus Blocks ────────────────────────────────────────────────────────────

/**
 * Inserts a new focus or break block row.
 * @param {number} sessionId
 * @param {'focus'|'break'} type
 * @returns {{ id: number, session_id: number, type: string, start_time: string }}
 */
function startBlock(sessionId, type) {
  const startTime = new Date().toISOString();
  _run(
    'INSERT INTO focus_blocks (session_id, type, start_time) VALUES (?, ?, ?)',
    [sessionId, type, startTime]
  );
  const row = _queryOne('SELECT last_insert_rowid() AS id');
  _saveDatabase();
  return { id: row.id, session_id: sessionId, type, start_time: startTime };
}

/**
 * Closes an open block by setting its end_time.
 * @param {number} blockId
 */
function endBlock(blockId) {
  const endTime = new Date().toISOString();
  _run(
    'UPDATE focus_blocks SET end_time = ? WHERE id = ? AND end_time IS NULL',
    [endTime, blockId]
  );
  _saveDatabase();
}

/**
 * Returns all blocks whose start_time falls within the given UTC range.
 * @param {string} startISO — inclusive UTC ISO string (local midnight in UTC)
 * @param {string} endISO   — exclusive UTC ISO string (next local midnight in UTC)
 * @returns {Array<{ id, session_id, type, start_time, end_time }>}
 */
function getBlocksForDate(startISO, endISO) {
  return _query(
    `SELECT * FROM focus_blocks
     WHERE start_time >= ? AND start_time < ?
     ORDER BY start_time`,
    [startISO, endISO]
  );
}

// ─── Blocklist ────────────────────────────────────────────────────────────────

/**
 * Adds an app name or URL/domain to the blocklist.
 * @param {string} name — e.g. "Twitter", "reddit.com", "Slack"
 * @returns {{ id: number, app_or_url_name: string }}
 */
function addToBlocklist(name) {
  const trimmed = name.trim().toLowerCase();
  _run('INSERT OR IGNORE INTO blocklist (app_or_url_name) VALUES (?)', [trimmed]);
  _saveDatabase();
  // Return the row (whether newly inserted or already present).
  return _queryOne('SELECT * FROM blocklist WHERE app_or_url_name = ?', [trimmed]);
}

/**
 * Removes an entry from the blocklist by its id.
 * @param {number} id
 */
function removeFromBlocklist(id) {
  _run('DELETE FROM blocklist WHERE id = ?', [id]);
  _saveDatabase();
}

/**
 * Returns every row in the blocklist.
 * @returns {Array<{ id: number, app_or_url_name: string }>}
 */
function getAllBlocklist() {
  return _query('SELECT * FROM blocklist ORDER BY app_or_url_name');
}

/**
 * Checks whether a given app name, URL, or window title contains a blocklisted term.
 * Comparison is case-insensitive and uses substring matching.
 *
 * On Windows, active-win does NOT return URLs — only window titles. So we
 * check all three fields to catch browser tabs via their title, e.g. adding
 * "reddit" matches a Chrome title "Reddit - Dive into anything".
 *
 * @param {string|null} appName  — owner.name from active-win
 * @param {string|null} url      — url from active-win (macOS/Linux browsers only)
 * @param {string|null} title    — window title from active-win (all platforms)
 * @returns {boolean}
 */
function isBlocked(appName, url, title) {
  const entries = getAllBlocklist();
  const haystack = [
    (appName || '').toLowerCase(),
    (url    || '').toLowerCase(),
    (title  || '').toLowerCase(),
  ].join(' ');

  return entries.some(({ app_or_url_name }) =>
    haystack.includes(app_or_url_name.toLowerCase())
  );
}

/**
 * Flushes the in-memory database to disk and closes the sql.js instance.
 * Call in the 'before-quit' Electron lifecycle hook.
 */
function closeDatabase() {
  if (db) {
    _saveDatabase(); // final flush
    db.close();
    db = null;
    console.log('[DB] Connection closed.');
  }
}

module.exports = {
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
  closeDatabase,
};
