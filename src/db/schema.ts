// src/db/schema.ts — TypeScript type definitions for every database table.
//
// Think of an "interface" like a label on a jar in the kitchen.
// The label says "Cookies — chocolate chip, round, qty: 12". You haven't
// opened the jar yet, but the label tells you exactly what's inside.
//
// Each interface below is a label for one table in our database.
// It describes every field (column) a row can have, what type it is
// (text, number, etc.), and whether it can be empty (null).
// TypeScript reads these labels and warns you if your code tries to use
// a field that doesn't exist — like reaching into the cookie jar and
// expecting to find pizza. That would be a bug!

// Represents one row from the `medicines` table.
// Imagine a medicine bottle with a label — this interface is what's on that label.
// Example: { id: "abc-123", userId: "auth0|xyz", name: "Lisinopril", dosage: "10mg", ... }
export interface Medicine {
  id: string;
  user_id: string;      // Auth0 sub — identifies which user this belongs to
  name: string;         // e.g., "Lisinopril"
  dosage: string;       // e.g., "10mg"
  instructions: string | null; // e.g., "Take with food" — null if not specified
  doctor: string | null;       // e.g., "Dr. Smith" — null if not specified
  is_active: number;    // SQLite stores booleans as integers: 1 = active, 0 = archived
  created_at: string;   // ISO 8601 timestamp, e.g., "2026-03-08T12:00:00.000Z"
  updated_at: string;
}

// Input type for adding a new medicine — only the fields the user types in.
// It's like a form at the doctor's office: you fill in the medicine name and
// dosage, but the receptionist adds the date and file number automatically.
// `id`, `created_at`, `updated_at`, `is_active` are set automatically by the app.
export interface AddMedicineInput {
  name: string;
  dosage: string;
  instructions?: string;
  doctor?: string;
}

// Input type for updating an existing medicine — all fields are optional
// because you might only change one thing at a time.
// Like erasing one line on your homework and rewriting it — you don't
// redo the whole page, just the part that changed.
export interface UpdateMedicineInput {
  name?: string;
  dosage?: string;
  instructions?: string;
  doctor?: string;
}

// Represents one row from the `schedules` table.
// Think of this like an alarm clock setting — it says WHEN to take a medicine.
// "Take Aspirin every day at 8:00 AM and 8:00 PM" would be one schedule row.
export interface Schedule {
  id: string;
  medicine_id: string;
  user_id: string;
  // How often: "daily" | "twice_daily" | "weekly" | "as_needed"
  frequency: string;
  // JSON-encoded array of times, e.g., '["08:00","20:00"]'
  // Stored as text in SQLite; parse with JSON.parse() when reading
  times_of_day: string;
  // JSON-encoded array of weekdays, e.g., '["mon","wed","fri"]'
  // null means every day (for daily/twice_daily frequency)
  days_of_week: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// Represents one row from the `intake_logs` table.
// This is like a diary entry: "Monday 8 AM — took my Aspirin" or
// "Monday 8 PM — skipped". Every single dose creates one diary entry,
// whether you took it or not.
export interface IntakeLog {
  id: string;
  medicine_id: string;
  user_id: string;
  scheduled_at: string;   // ISO timestamp of when the dose was due
  taken_at: string | null; // ISO timestamp of when it was actually taken; null = not taken yet
  status: "taken" | "skipped" | "pending";
  notes: string | null;
  created_at: string;
}

// Represents one row from the `inventory` table.
// Imagine counting how many gummy vitamins are left in the bottle.
// This table keeps that count and warns you when you're running low
// (like when there are only 5 left and you need to buy more).
export interface Inventory {
  id: string;
  medicine_id: string;
  user_id: string;
  quantity_on_hand: number;   // e.g., 28.0 (tablets remaining)
  unit: string;               // e.g., "tablet", "ml", "patch", "capsule"
  low_stock_threshold: number; // Trigger a warning when quantity drops to this level
  last_refill_date: string | null;
  updated_at: string;
}

// Represents one row from the `notification_log` table.
// When the app sets a phone reminder (like "Take Aspirin at 8 PM!"),
// it gets a ticket number back. We save that ticket number here so
// we can cancel the reminder later — like telling the alarm "never mind,
// I already took it!" without that ticket number we couldn't turn it off.
export interface NotificationLog {
  id: string;
  user_id: string;
  medicine_id: string;
  notification_id: string; // The ID returned by expo-notifications when scheduled
  type: "dose_reminder" | "low_stock";
  scheduled_for: string;   // ISO timestamp of when the notification will fire
  created_at: string;
}
