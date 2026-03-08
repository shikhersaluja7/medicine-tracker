// src/services/medicine.service.ts — All database operations for medicines.
//
// Rule: Never query SQLite directly from a component or screen.
//       Always go through a service function. This keeps the UI code clean
//       and makes it easy to test the database logic in isolation.
//
// Every function takes `(db, userId, ...)` as its first two arguments:
// - db: the SQLite database connection (from src/db/client.ts)
// - userId: the Auth0 sub of the logged-in user (e.g., "auth0|abc123")
//   This ensures one user can never read or modify another user's data.

import type { SQLiteDatabase } from "expo-sqlite";
import type { AddMedicineInput, Medicine, UpdateMedicineInput } from "@/db/schema";

// Generates a simple unique ID for new database rows.
// Uses random characters + timestamp to avoid collisions.
// e.g., "k7x2mq-1709900400000"
function generateId(): string {
  const random = Math.random().toString(36).slice(2, 8); // e.g., "k7x2mq"
  const timestamp = Date.now().toString(36);             // e.g., "lk9f4s0"
  return `${random}-${timestamp}`;
}

// Returns the current date and time in ISO 8601 format.
// SQLite stores dates as text; ISO 8601 sorts correctly as a string.
// e.g., "2026-03-08T12:00:00.000Z"
function now(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────
// addMedicine
// ─────────────────────────────────────────────
// Inserts a new medicine row and returns the complete saved row.
//
// Usage example:
//   const medicine = addMedicine(db, "auth0|abc123", {
//     name: "Lisinopril",
//     dosage: "10mg",
//     instructions: "Take with food",
//     doctor: "Dr. Smith",
//   });
//   console.log(medicine.id); // "k7x2mq-lk9f4s0"
export function addMedicine(
  db: SQLiteDatabase,
  userId: string,
  input: AddMedicineInput
): Medicine {
  const id = generateId();
  const timestamp = now();

  // runSync executes an INSERT/UPDATE/DELETE statement.
  // The ? placeholders are replaced by the values in order — this prevents
  // SQL injection attacks (never put user input directly into SQL strings).
  db.runSync(
    `INSERT INTO medicines
       (id, user_id, name, dosage, instructions, doctor, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    userId,
    input.name,
    input.dosage,
    input.instructions ?? null, // ?? null converts undefined to null for SQLite
    input.doctor ?? null,
    timestamp,
    timestamp
  );

  // Read the row back to return the complete saved record.
  // getFirstSync returns the first matching row, or null if nothing found.
  const saved = db.getFirstSync<Medicine>(
    `SELECT * FROM medicines WHERE id = ? AND user_id = ?`,
    id,
    userId
  );

  if (!saved) {
    // This should never happen right after a successful INSERT,
    // but we handle it to satisfy TypeScript's null checks.
    throw new Error(`Failed to retrieve medicine after insert (id: ${id})`);
  }

  return saved;
}

// ─────────────────────────────────────────────
// getMedicines
// ─────────────────────────────────────────────
// Returns all active medicines for a user, sorted alphabetically by name.
// Archived medicines (is_active = 0) are excluded — they still exist in the
// database for history purposes but won't appear in the UI.
//
// Usage example:
//   const medicines = getMedicines(db, "auth0|abc123");
//   // Returns: [{ id: "...", name: "Aspirin", ... }, { id: "...", name: "Lisinopril", ... }]
export function getMedicines(db: SQLiteDatabase, userId: string): Medicine[] {
  // getAllSync returns an array of all matching rows.
  // WHERE user_id = ? ensures we only return this user's medicines.
  return db.getAllSync<Medicine>(
    `SELECT * FROM medicines
     WHERE user_id = ? AND is_active = 1
     ORDER BY name ASC`,
    userId
  );
}

// ─────────────────────────────────────────────
// getMedicineById
// ─────────────────────────────────────────────
// Returns a single medicine by its ID, or null if not found.
// The userId check prevents one user from viewing another user's medicine
// even if they somehow obtained the ID.
//
// Usage example:
//   const med = getMedicineById(db, "k7x2mq-lk9f4s0", "auth0|abc123");
//   if (!med) { /* show 404 screen */ }
export function getMedicineById(
  db: SQLiteDatabase,
  id: string,
  userId: string
): Medicine | null {
  return db.getFirstSync<Medicine>(
    `SELECT * FROM medicines WHERE id = ? AND user_id = ?`,
    id,
    userId
  );
}

// ─────────────────────────────────────────────
// updateMedicine
// ─────────────────────────────────────────────
// Updates one or more fields of an existing medicine.
// Only the fields included in `updates` are changed.
//
// Usage example:
//   updateMedicine(db, "k7x2mq-lk9f4s0", "auth0|abc123", { dosage: "20mg" });
export function updateMedicine(
  db: SQLiteDatabase,
  id: string,
  userId: string,
  updates: UpdateMedicineInput
): void {
  // Build the SET clause dynamically based on which fields were provided.
  // e.g., if only dosage and instructions are passed, generates:
  //   SET dosage = ?, instructions = ?, updated_at = ?
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.dosage !== undefined) {
    fields.push("dosage = ?");
    values.push(updates.dosage);
  }
  if (updates.instructions !== undefined) {
    fields.push("instructions = ?");
    values.push(updates.instructions);
  }
  if (updates.doctor !== undefined) {
    fields.push("doctor = ?");
    values.push(updates.doctor);
  }

  // Always update the timestamp so we know when the record was last changed
  fields.push("updated_at = ?");
  values.push(now());

  if (fields.length === 1) {
    // Only updated_at was added — no actual fields to update, so do nothing.
    return;
  }

  // Add the WHERE clause values at the end (id and userId)
  values.push(id, userId);

  db.runSync(
    `UPDATE medicines SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    ...values
  );
}

// ─────────────────────────────────────────────
// archiveMedicine
// ─────────────────────────────────────────────
// "Soft deletes" a medicine by setting is_active = 0.
// The row is kept in the database so dose history and stats are preserved.
// The medicine will no longer appear in getMedicines() results.
//
// Usage example:
//   archiveMedicine(db, "k7x2mq-lk9f4s0", "auth0|abc123");
//   // Medicine is now hidden from lists but history is preserved
export function archiveMedicine(
  db: SQLiteDatabase,
  id: string,
  userId: string
): void {
  db.runSync(
    `UPDATE medicines SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`,
    now(),
    id,
    userId
  );
}
