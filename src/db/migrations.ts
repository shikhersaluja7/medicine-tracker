// src/db/migrations.ts — Creates all database tables on first launch.
//
// What is a migration?
// A migration is a script that modifies the database structure.
// "CREATE TABLE IF NOT EXISTS" means: create the table only if it
// doesn't already exist — so running this on every app launch is safe.
//
// Table creation order matters because of FOREIGN KEY constraints:
// - `medicines` must exist before `schedules` (schedules reference medicines)
// - `medicines` must exist before `inventory` (inventory references medicines)
// etc.

import type { SQLiteDatabase } from "expo-sqlite";

export function runMigrations(db: SQLiteDatabase): void {
  // execSync runs multiple SQL statements at once.
  // All tables are created in a single transaction for speed.
  db.execSync(`
    -- Enable foreign key enforcement (SQLite disables it by default)
    -- This ensures that if you delete a medicine, its schedules/logs are also deleted.
    PRAGMA foreign_keys = ON;

    -- medicines: one row per prescription
    -- Every other table references this one via medicine_id
    CREATE TABLE IF NOT EXISTS medicines (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      dosage       TEXT NOT NULL,
      instructions TEXT,
      doctor       TEXT,
      -- 1 = the user is actively taking this medicine
      -- 0 = archived (hidden from lists but kept for history)
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    -- Index speeds up the most common query: "get all active medicines for this user"
    -- Without an index, SQLite scans every row; with it, it jumps directly to matches.
    CREATE INDEX IF NOT EXISTS idx_medicines_user
      ON medicines(user_id, is_active);

    -- schedules: when to take each medicine
    -- times_of_day and days_of_week are stored as JSON strings
    -- e.g., times_of_day = '["08:00","20:00"]'
    CREATE TABLE IF NOT EXISTS schedules (
      id           TEXT PRIMARY KEY,
      medicine_id  TEXT NOT NULL
        REFERENCES medicines(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL,
      -- "daily" | "twice_daily" | "weekly" | "as_needed"
      frequency    TEXT NOT NULL,
      -- JSON array of HH:MM strings, e.g., '["08:00"]'
      times_of_day TEXT NOT NULL,
      -- JSON array of day names, e.g., '["mon","wed","fri"]'
      -- NULL means every day
      days_of_week TEXT,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_medicine
      ON schedules(medicine_id, is_active);

    -- intake_logs: records every dose taken or skipped
    -- Used to calculate adherence ("you took 90% of doses this week")
    CREATE TABLE IF NOT EXISTS intake_logs (
      id           TEXT PRIMARY KEY,
      medicine_id  TEXT NOT NULL
        REFERENCES medicines(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL,
      -- When the dose was scheduled (e.g., "2026-03-08T08:00:00.000Z")
      scheduled_at TEXT NOT NULL,
      -- When it was actually taken; NULL means not yet taken
      taken_at     TEXT,
      -- "taken" | "skipped" | "pending"
      status       TEXT NOT NULL DEFAULT 'pending',
      notes        TEXT,
      created_at   TEXT NOT NULL
    );

    -- Index for the daily dashboard query: "all pending doses for today for this user"
    CREATE INDEX IF NOT EXISTS idx_intake_user_date
      ON intake_logs(user_id, scheduled_at, status);

    -- inventory: tracks how many pills/doses remain for each medicine
    -- One row per medicine (UNIQUE constraint enforces this)
    CREATE TABLE IF NOT EXISTS inventory (
      id                  TEXT PRIMARY KEY,
      medicine_id         TEXT NOT NULL UNIQUE
        REFERENCES medicines(id) ON DELETE CASCADE,
      user_id             TEXT NOT NULL,
      -- e.g., 28.0 (floating point to handle half-tablets or liquid ml)
      quantity_on_hand    REAL NOT NULL DEFAULT 0,
      -- e.g., "tablet", "capsule", "ml", "patch"
      unit                TEXT NOT NULL DEFAULT 'tablet',
      -- Send a low-stock alert when quantity_on_hand drops to this level
      -- Default of 7 = warn when less than one week's supply remains
      low_stock_threshold REAL NOT NULL DEFAULT 7,
      last_refill_date    TEXT,
      updated_at          TEXT NOT NULL
    );

    -- notification_log: stores the ID of every scheduled notification
    -- so we can cancel specific notifications later
    -- (e.g., cancel the 8 AM reminder when the user marks the dose as taken)
    CREATE TABLE IF NOT EXISTS notification_log (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      medicine_id     TEXT NOT NULL,
      -- The identifier returned by expo-notifications after scheduling
      notification_id TEXT NOT NULL,
      -- "dose_reminder" | "low_stock"
      type            TEXT NOT NULL,
      -- ISO timestamp of when the notification is scheduled to fire
      scheduled_for   TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notif_user
      ON notification_log(user_id, medicine_id);
  `);
}
