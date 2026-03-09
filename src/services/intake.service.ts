// src/services/intake.service.ts — All database operations for dose logging and adherence.
//
// Think of this like a daily medication diary. Every morning the diary opens a
// fresh page listing today's scheduled doses. As the day goes on, the user
// ticks each dose as "Taken" or marks it "Skipped". At the end of the week,
// the diary calculates: "You took 17 out of 20 doses — that's 85% adherence."
//
// This service handles:
//   1. Generating today's dose entries from the active schedules
//   2. Marking doses as taken or skipped
//   3. Calculating adherence stats (for the dashboard and detail screen)

import type { SQLiteDatabase } from "expo-sqlite";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
}

function now(): string {
  return new Date().toISOString();
}

// Returns today's date as "YYYY-MM-DD" in the device's LOCAL time zone.
// We use local time because schedules are defined in local time (e.g., "8:00 AM").
// Using UTC here would cause doses to appear a day early or late depending on timezone.
function getTodayLocalDateString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// Returns a date string N days ago in local time.
// e.g., daysAgoLocalDateString(7) on 2026-03-09 → "2026-03-02"
function daysAgoLocalDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// Combines a local date and an HH:MM time into a scheduled_at value.
// e.g., "2026-03-09" + "08:00" → "2026-03-09T08:00:00"
// No "Z" suffix — this is local time, not UTC.
function makeScheduledAt(date: string, time: string): string {
  return `${date}T${time}:00`;
}

// Maps JavaScript's getDay() index (0 = Sunday) to our day key strings.
// e.g., new Date().getDay() = 1 (Monday) → "mon"
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// Returns true if the schedule applies to the given date.
// daysOfWeek = null means every day. A string array means only those named days.
function isDayScheduled(daysOfWeek: string[] | null, date: Date): boolean {
  if (!daysOfWeek) return true; // null = every day, always valid
  const todayKey = DAY_KEYS[date.getDay()];
  return daysOfWeek.includes(todayKey);
}

// ─── generateTodaysDoses ─────────────────────────────────────────────────────
// Creates a pending intake_log row for each scheduled dose today that has not
// been logged yet. Safe to call multiple times — existing rows are never
// duplicated (we check before inserting).
//
// Like a teacher printing today's class schedule every morning: if the page is
// already printed, they don't print it again. Each subject gets one slot.
//
// Usage: call this on every dashboard focus to ensure today's doses exist.
export function generateTodaysDoses(db: SQLiteDatabase, userId: string): void {
  // Fetch all active schedules for this user.
  const schedules = db.getAllSync<{
    medicine_id: string;
    frequency: string;
    times_of_day: string;
    days_of_week: string | null;
  }>(
    `SELECT medicine_id, frequency, times_of_day, days_of_week
     FROM schedules
     WHERE user_id = ? AND is_active = 1`,
    userId
  );

  const today = new Date();
  const todayStr = getTodayLocalDateString();

  for (const schedule of schedules) {
    // "As needed" schedules have no fixed times — nothing to generate.
    if (schedule.frequency === "as_needed") continue;

    const timesOfDay = JSON.parse(schedule.times_of_day) as string[];
    const daysOfWeek = schedule.days_of_week
      ? (JSON.parse(schedule.days_of_week) as string[])
      : null;

    // Skip this schedule if today isn't one of its days.
    // e.g., a weekly schedule for Mon/Wed/Fri is skipped on Tuesday.
    if (!isDayScheduled(daysOfWeek, today)) continue;

    for (const time of timesOfDay) {
      const scheduledAt = makeScheduledAt(todayStr, time);

      // Check if a log row already exists for this exact medicine + time.
      // If it does, skip — we never create duplicate rows for the same dose.
      const existing = db.getFirstSync<{ id: string }>(
        `SELECT id FROM intake_logs
         WHERE medicine_id = ? AND user_id = ? AND scheduled_at = ?`,
        schedule.medicine_id,
        userId,
        scheduledAt
      );

      if (!existing) {
        db.runSync(
          `INSERT INTO intake_logs
             (id, medicine_id, user_id, scheduled_at, taken_at, status, notes, created_at)
           VALUES (?, ?, ?, ?, NULL, 'pending', NULL, ?)`,
          generateId(),
          schedule.medicine_id,
          userId,
          scheduledAt,
          now()
        );
      }
    }
  }
}

// ─── TodaysDose ───────────────────────────────────────────────────────────────
// A combined shape for displaying one dose entry on the dashboard.
// Includes medicine name (joined from medicines table) and inventory unit
// (joined from inventory) so the UI can show "1 tablet taken" without extra queries.
export interface TodaysDose {
  logId: string;
  medicineId: string;
  medicineName: string;
  unit: string | null;        // e.g., "tablet" — null if inventory not set up
  scheduledAt: string;        // "YYYY-MM-DDTHH:MM:00" — the full timestamp
  scheduledTime: string;      // "HH:MM" — extracted for grouping and display
  status: "pending" | "taken" | "skipped";
  takenAt: string | null;     // when it was actually taken
  notes: string | null;       // optional skip reason
  isOverdue: boolean;         // true if pending and scheduled time has already passed
}

// ─── getTodaysDoses ───────────────────────────────────────────────────────────
// Returns all intake log rows for today, enriched with medicine name and
// inventory unit, sorted by scheduled time.
//
// Like opening today's diary page and reading all the entries, newest skips
// or takes already filled in, blank slots still waiting.
export function getTodaysDoses(db: SQLiteDatabase, userId: string): TodaysDose[] {
  const todayStr = getTodayLocalDateString();
  const currentTime = new Date();

  const rows = db.getAllSync<{
    log_id: string;
    medicine_id: string;
    medicine_name: string;
    unit: string | null;
    scheduled_at: string;
    status: string;
    taken_at: string | null;
    notes: string | null;
  }>(
    // LEFT JOIN inventory so we still get the row even if no inventory is set up.
    `SELECT l.id           AS log_id,
            l.medicine_id,
            m.name         AS medicine_name,
            inv.unit,
            l.scheduled_at,
            l.status,
            l.taken_at,
            l.notes
     FROM intake_logs l
     JOIN medicines m ON m.id = l.medicine_id
     LEFT JOIN inventory inv ON inv.medicine_id = l.medicine_id
                             AND inv.user_id = l.user_id
     WHERE l.user_id = ?
       AND l.scheduled_at LIKE ?
     ORDER BY l.scheduled_at ASC`,
    userId,
    `${todayStr}%` // LIKE 'YYYY-MM-DD%' matches all times on that date
  );

  return rows.map((row) => {
    // Extract "HH:MM" from "YYYY-MM-DDTHH:MM:00"  (characters 11–15)
    const scheduledTime = row.scheduled_at.slice(11, 16);

    // A dose is overdue if it's still pending AND the scheduled time is in the past.
    // Like a meeting that was supposed to happen at 9 AM but it's now 10 AM and
    // the attendee hasn't checked in yet.
    const [h, m] = scheduledTime.split(":").map(Number);
    const scheduledDate = new Date();
    scheduledDate.setHours(h, m, 0, 0);
    const isOverdue = row.status === "pending" && scheduledDate < currentTime;

    return {
      logId: row.log_id,
      medicineId: row.medicine_id,
      medicineName: row.medicine_name,
      unit: row.unit,
      scheduledAt: row.scheduled_at,
      scheduledTime,
      status: row.status as "pending" | "taken" | "skipped",
      takenAt: row.taken_at,
      notes: row.notes,
      isOverdue,
    };
  });
}

// ─── markTaken ────────────────────────────────────────────────────────────────
// Marks a dose as taken and decrements inventory by 1.
//
// Two things happen at once — like ticking a to-do list item AND removing one
// item from the pantry shelf. Both happen together so the records stay in sync.
export function markTaken(
  db: SQLiteDatabase,
  logId: string,
  userId: string,
  medicineId: string
): void {
  // Record the dose as taken with the exact moment it was marked.
  db.runSync(
    `UPDATE intake_logs
     SET status = 'taken', taken_at = ?
     WHERE id = ? AND user_id = ?`,
    now(),
    logId,
    userId
  );

  // Decrement inventory by 1 unit if it exists.
  // MAX(0, ...) prevents the count from going below zero —
  // like a tally counter that stops at 0 rather than going negative.
  db.runSync(
    `UPDATE inventory
     SET quantity_on_hand = MAX(0, quantity_on_hand - 1), updated_at = ?
     WHERE medicine_id = ? AND user_id = ?`,
    now(),
    medicineId,
    userId
  );
}

// ─── markSkipped ──────────────────────────────────────────────────────────────
// Marks a dose as skipped. An optional note explains why (e.g., "felt nauseous").
// Skipped doses count in the adherence total but not in the "taken" count.
export function markSkipped(
  db: SQLiteDatabase,
  logId: string,
  userId: string,
  notes?: string
): void {
  db.runSync(
    `UPDATE intake_logs
     SET status = 'skipped', notes = ?
     WHERE id = ? AND user_id = ?`,
    notes ?? null,
    logId,
    userId
  );
}

// ─── AdherenceStats ───────────────────────────────────────────────────────────
// The result of an adherence calculation.
// Adherence = how consistently the user takes their scheduled medicines.
// Like a school attendance report: "Present 18 of 20 days = 90% attendance."
export interface AdherenceStats {
  taken: number;      // number of doses marked as taken
  total: number;      // taken + skipped (excludes still-pending doses)
  percentage: number; // 0–100, rounded to the nearest whole number
}

// ─── getAdherenceStats ────────────────────────────────────────────────────────
// Returns adherence stats for ONE medicine over the last N days.
// Used on the medicine detail screen.
export function getAdherenceStats(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string,
  days: number = 7
): AdherenceStats {
  const cutoff = daysAgoLocalDateString(days);

  // Count how many doses were taken vs. how many were resolved (taken + skipped).
  // Pending doses are excluded — they haven't been decided yet.
  const row = db.getFirstSync<{ taken: number; total: number }>(
    `SELECT
       COUNT(CASE WHEN status = 'taken'    THEN 1 END) AS taken,
       COUNT(CASE WHEN status != 'pending' THEN 1 END) AS total
     FROM intake_logs
     WHERE medicine_id = ?
       AND user_id = ?
       AND scheduled_at >= ?`,
    medicineId,
    userId,
    cutoff
  );

  const taken = row?.taken ?? 0;
  const total = row?.total ?? 0;
  return {
    taken,
    total,
    percentage: total > 0 ? Math.round((taken / total) * 100) : 0,
  };
}

// ─── getOverallAdherence ─────────────────────────────────────────────────────
// Returns adherence stats across ALL of a user's medicines over the last N days.
// Used on the dashboard's "This Week" summary card.
export function getOverallAdherence(
  db: SQLiteDatabase,
  userId: string,
  days: number = 7
): AdherenceStats {
  const cutoff = daysAgoLocalDateString(days);

  const row = db.getFirstSync<{ taken: number; total: number }>(
    `SELECT
       COUNT(CASE WHEN status = 'taken'    THEN 1 END) AS taken,
       COUNT(CASE WHEN status != 'pending' THEN 1 END) AS total
     FROM intake_logs
     WHERE user_id = ?
       AND scheduled_at >= ?`,
    userId,
    cutoff
  );

  const taken = row?.taken ?? 0;
  const total = row?.total ?? 0;
  return {
    taken,
    total,
    percentage: total > 0 ? Math.round((taken / total) * 100) : 0,
  };
}
