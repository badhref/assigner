const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'tracker.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS team_members (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name     TEXT    NOT NULL,
    last_name      TEXT    NOT NULL,
    pick_count     INTEGER NOT NULL DEFAULT 0,
    is_checked_in  INTEGER NOT NULL DEFAULT 0,
    checked_in_at  TEXT,
    checkout_until TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pick_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id    INTEGER NOT NULL,
    picked_at    TEXT DEFAULT (datetime('now')),
    confirmed    INTEGER NOT NULL DEFAULT 0,
    confirmed_at TEXT,
    FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS cycle_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations — safely add new columns if upgrading from an older schema
const migrations = [
  'ALTER TABLE team_members ADD COLUMN is_checked_in          INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE team_members ADD COLUMN checked_in_at          TEXT',
  'ALTER TABLE team_members ADD COLUMN checkout_until         TEXT',
  'ALTER TABLE team_members ADD COLUMN current_cycle_assigned INTEGER NOT NULL DEFAULT 0',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch {}
}

module.exports = db;
