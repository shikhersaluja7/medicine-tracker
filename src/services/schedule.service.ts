// src/services/schedule.service.ts — All database operations for dosage schedules.
//
// Think of this like setting alarm clocks for each medicine.
// "Take Aspirin every day at 8 AM and 8 PM" — that's a schedule.
// This service is the person who programs those alarms: creating them,
// updating them when the routine changes, and switching them off when needed.
//
// Each medicine has at most ONE active schedule at a time.
// Changing the schedule deactivates the old one and creates a fresh one,
// so the history of previous schedules is preserved in the database.

import type { SQLiteDatabase } from "expo-sqlite";
import type { Schedule } from "@/db/schema";

// Frequency options — the five ways a user can describe how often they take a medicine.
//   daily       = once a day at a fixed time (e.g., 8:00 AM)
//   twice_daily = twice a day at two fixed times (e.g., 8:00 AM and 8:00 PM)
//   weekly      = specific days of the week at a fixed time (e.g., Mon, Wed, Fri)
//   as_needed   = no fixed time — the user takes it whenever required
//   custom      = any number of times a day, any combination of days
export type Frequency =
  | "daily"
  | "twice_daily"
  | "weekly"
  | "as_needed"
  | "custom";

// The input the user provides when creating or updating a schedule.
export interface UpsertScheduleInput {
  frequency: Frequency;
  // Array of HH:MM strings — one entry per dose time per day.
  // e.g., ["08:00"] for daily, ["08:00", "20:00"] for twice daily,
  //        ["08:00", "12:00", "18:00"] for a custom 3× daily schedule.
  // Empty array for as_needed.
  timesOfDay: string[];
  // Array of lowercase day names, or null if the schedule applies every day.
  // e.g., ["mon", "wed", "fri"] for a Mon/Wed/Fri weekly schedule.
  // null means "every day" — used for daily, twice_daily, and custom (all-days).
  daysOfWeek: string[] | null;
}

// Generates a simple unique ID for new database rows.
function generateId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
}

// Returns the current date-time as an ISO string for timestamps.
function now(): string {
  return new Date().toISOString();
}

// ─── getSchedule ──────────────────────────────────────────────────────────────
// Returns the active schedule for a medicine, or null if none has been set up.
//
// Like asking "is there an alarm set for this medicine right now?"
// We only return active schedules (is_active = 1) — deactivated ones are ignored.
//
// Usage example:
//   const schedule = getSchedule(db, "med-abc", "auth0|xyz");
//   if (!schedule) { /* show "Set Up Schedule" button */ }
export function getSchedule(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string
): Schedule | null {
  return db.getFirstSync<Schedule>(
    `SELECT * FROM schedules
     WHERE medicine_id = ? AND user_id = ? AND is_active = 1
     ORDER BY created_at DESC
     LIMIT 1`,
    medicineId,
    userId
  );
}

// ─── upsertSchedule ───────────────────────────────────────────────────────────
// Creates a new schedule for a medicine, deactivating any existing one first.
//
// Why deactivate instead of update?
// Updating the existing row would overwrite history. Deactivating the old one
// and inserting a new one preserves the record of what the previous schedule was.
// Like replacing an alarm clock: you turn off the old one before setting the new one.
//
// Usage example:
//   const sched = upsertSchedule(db, "med-abc", "auth0|xyz", {
//     frequency: "custom",
//     timesOfDay: ["08:00", "13:00", "20:00"],
//     daysOfWeek: null, // every day
//   });
export function upsertSchedule(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string,
  input: UpsertScheduleInput
): Schedule {
  // Turn off any existing active schedule for this medicine.
  // We do this before inserting so there's always at most one active schedule.
  db.runSync(
    `UPDATE schedules
     SET is_active = 0, updated_at = ?
     WHERE medicine_id = ? AND user_id = ? AND is_active = 1`,
    now(),
    medicineId,
    userId
  );

  const id = generateId();
  const timestamp = now();

  // Store times and days as JSON strings — SQLite stores them as TEXT.
  // JSON.stringify(["08:00", "20:00"]) → '["08:00","20:00"]'
  // JSON.stringify(null) → "null", but we store SQL NULL instead.
  const timesJson = JSON.stringify(input.timesOfDay);
  const daysJson = input.daysOfWeek ? JSON.stringify(input.daysOfWeek) : null;

  db.runSync(
    `INSERT INTO schedules
       (id, medicine_id, user_id, frequency, times_of_day, days_of_week,
        is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    medicineId,
    userId,
    input.frequency,
    timesJson,
    daysJson,
    timestamp,
    timestamp
  );

  // Read the freshly inserted row back to return the complete saved record.
  const saved = db.getFirstSync<Schedule>(
    `SELECT * FROM schedules WHERE id = ? AND user_id = ?`,
    id,
    userId
  );

  if (!saved) {
    throw new Error(
      `Failed to retrieve schedule after insert (medicine_id: ${medicineId})`
    );
  }
  return saved;
}

// ─── deactivateSchedule ───────────────────────────────────────────────────────
// Soft-deactivates the active schedule for a medicine (sets is_active = 0).
// The row is kept in the database for history — it's just hidden from the UI.
//
// Like switching an alarm off without throwing the clock away.
//
// Usage example:
//   deactivateSchedule(db, "med-abc", "auth0|xyz");
//   // Schedule is now off — getSchedule() will return null for this medicine
export function deactivateSchedule(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string
): void {
  db.runSync(
    `UPDATE schedules
     SET is_active = 0, updated_at = ?
     WHERE medicine_id = ? AND user_id = ? AND is_active = 1`,
    now(),
    medicineId,
    userId
  );
}
