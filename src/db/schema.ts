// src/db/schema.ts — TypeScript type definitions for every database table.
// These interfaces describe exactly what a row from each table looks like
// after being read from SQLite. Having these types means TypeScript will
// warn you if you try to access a field that doesn't exist.

// Represents one row from the `medicines` table.
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

// Input type for adding a new medicine — only the fields the user provides.
// `id`, `created_at`, `updated_at`, `is_active` are set automatically.
export interface AddMedicineInput {
  name: string;
  dosage: string;
  instructions?: string;
  doctor?: string;
}

// Input type for updating an existing medicine — all fields are optional
// because you might only update one field at a time.
export interface UpdateMedicineInput {
  name?: string;
  dosage?: string;
  instructions?: string;
  doctor?: string;
}

// Represents one row from the `schedules` table.
// Stores when a medicine should be taken (times, frequency, days).
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
// Every dose taken OR skipped creates a log entry.
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
// Tracks how many pills/doses are remaining for a medicine.
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
// We store expo-notifications IDs so we can cancel them later
// (e.g., when a dose is marked as taken).
export interface NotificationLog {
  id: string;
  user_id: string;
  medicine_id: string;
  notification_id: string; // The ID returned by expo-notifications when scheduled
  type: "dose_reminder" | "low_stock";
  scheduled_for: string;   // ISO timestamp of when the notification will fire
  created_at: string;
}
