// src/services/inventory.service.ts — All database operations for inventory tracking.
//
// Think of this like a pantry log on your fridge door. Every time you open a
// new bottle of medicine, you write down how many are inside. Every time you
// take one, the count drops. When the count gets low, a warning sticker goes up.
// This service is the person maintaining that log — reading it and updating it.
//
// Rule: Every function takes (db, ..., userId) as arguments to ensure that
// one user can never read or modify another user's inventory data.

import type { SQLiteDatabase } from "expo-sqlite";
import type { Inventory } from "@/db/schema";

// Generates a simple unique ID for new database rows.
// e.g., "k7x2mq-1709900400000"
function generateId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
}

// Returns the current date-time as an ISO string for the updated_at column.
// e.g., "2026-03-09T08:30:00.000Z"
function now(): string {
  return new Date().toISOString();
}

// Returns today's date as a YYYY-MM-DD string for last_refill_date.
// e.g., "2026-03-09"
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── getInventory ─────────────────────────────────────────────────────────────
// Returns the inventory row for one medicine, or null if none has been set up.
//
// Like opening the pantry log and looking for "Aspirin" — either there's a page
// for it, or there isn't yet.
//
// Usage example:
//   const inv = getInventory(db, "med-abc123", "auth0|xyz");
//   if (!inv) { /* show "Set Up Inventory" button */ }
export function getInventory(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string
): Inventory | null {
  return db.getFirstSync<Inventory>(
    `SELECT * FROM inventory WHERE medicine_id = ? AND user_id = ?`,
    medicineId,
    userId
  );
}

// ─── getAllInventories ────────────────────────────────────────────────────────
// Returns every inventory row for a user as an array.
// Used by the medicines list screen to pass inventory data to each card,
// so low-stock badges can be shown without a per-card database query.
//
// Analogy: Instead of checking each medicine one by one, you pull out the
// whole pantry log and flip through it in one go.
//
// Usage example:
//   const inventories = getAllInventories(db, "auth0|xyz");
//   // Returns all inventory rows for this user
export function getAllInventories(
  db: SQLiteDatabase,
  userId: string
): Inventory[] {
  return db.getAllSync<Inventory>(
    `SELECT * FROM inventory WHERE user_id = ?`,
    userId
  );
}

// ─── LowStockItem ─────────────────────────────────────────────────────────────
// A combined shape returned by getLowStockInventories.
// We join the medicine name in so the dashboard can display it without a
// second query — like a pantry log entry that already has the brand name written.
export interface LowStockItem {
  inventory: Inventory;
  medicineName: string;
}

// ─── getLowStockInventories ───────────────────────────────────────────────────
// Returns all medicines whose quantity_on_hand is at or below their
// low_stock_threshold, sorted by quantity ascending (most urgent first).
// Used by the dashboard's "Low Stock" section.
//
// Analogy: You scan the whole pantry log for any item with a red warning sticker
// and bring that list to the person who does the shopping.
//
// Usage example:
//   const lowItems = getLowStockInventories(db, "auth0|xyz");
//   // Returns: [{ inventory: {...}, medicineName: "Lisinopril" }, ...]
export function getLowStockInventories(
  db: SQLiteDatabase,
  userId: string
): LowStockItem[] {
  // JOIN with medicines so we can include the medicine name in the result.
  // m.is_active = 1 excludes archived medicines — no point warning about those.
  // quantity_on_hand <= low_stock_threshold catches both "at threshold" and "below".
  const rows = db.getAllSync<Inventory & { medicine_name: string }>(
    `SELECT i.*, m.name AS medicine_name
     FROM inventory i
     JOIN medicines m ON m.id = i.medicine_id
     WHERE i.user_id = ?
       AND m.is_active = 1
       AND i.quantity_on_hand <= i.low_stock_threshold
     ORDER BY i.quantity_on_hand ASC`,
    userId
  );

  // Separate the joined medicine_name field from the rest of the inventory data.
  // The Inventory interface doesn't have a medicine_name column, so we split it out.
  return rows.map(({ medicine_name, ...inventory }) => ({
    inventory,
    medicineName: medicine_name,
  }));
}

// ─── UpsertInventoryInput ─────────────────────────────────────────────────────
// The fields the user provides when setting up or editing inventory.
// All three are required because each has a meaningful default in the UI.
export interface UpsertInventoryInput {
  quantityOnHand: number;   // e.g., 28
  unit: string;             // e.g., "tablet"
  lowStockThreshold: number; // e.g., 7
}

// ─── upsertInventory ─────────────────────────────────────────────────────────
// Creates a new inventory row if none exists, or updates the existing one.
// "Upsert" = UPDATE + INSERT combined — insert if new, update if already there.
//
// Like a pantry log: if there's already a page for "Aspirin", update the count;
// if there's no page yet, add a fresh one.
//
// Usage example:
//   const inv = upsertInventory(db, "med-abc", "auth0|xyz", {
//     quantityOnHand: 28,
//     unit: "tablet",
//     lowStockThreshold: 7,
//   });
export function upsertInventory(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string,
  input: UpsertInventoryInput
): Inventory {
  const existing = getInventory(db, medicineId, userId);

  if (existing) {
    // Row already exists — update the three editable fields and the timestamp.
    db.runSync(
      `UPDATE inventory
       SET quantity_on_hand = ?, unit = ?, low_stock_threshold = ?, updated_at = ?
       WHERE medicine_id = ? AND user_id = ?`,
      input.quantityOnHand,
      input.unit,
      input.lowStockThreshold,
      now(),
      medicineId,
      userId
    );
  } else {
    // No row yet — insert a brand-new one.
    // last_refill_date starts as NULL because no refill has been recorded.
    db.runSync(
      `INSERT INTO inventory
         (id, medicine_id, user_id, quantity_on_hand, unit, low_stock_threshold,
          last_refill_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      generateId(),
      medicineId,
      userId,
      input.quantityOnHand,
      input.unit,
      input.lowStockThreshold,
      now()
    );
  }

  // Read the row back to return the complete, saved state.
  const saved = getInventory(db, medicineId, userId);
  if (!saved) {
    throw new Error(
      `Failed to retrieve inventory after upsert (medicine_id: ${medicineId})`
    );
  }
  return saved;
}

// ─── recordRefill ─────────────────────────────────────────────────────────────
// Updates quantity_on_hand to the new count and stamps today's date as
// the last refill date. Called when the user picks up more medicine.
//
// Like writing in the pantry log: "March 9 — bought 90 more tablets."
//
// Usage example:
//   recordRefill(db, "med-abc", "auth0|xyz", 90);
//   // quantity_on_hand → 90, last_refill_date → "2026-03-09"
export function recordRefill(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string,
  newQuantity: number
): void {
  db.runSync(
    `UPDATE inventory
     SET quantity_on_hand = ?, last_refill_date = ?, updated_at = ?
     WHERE medicine_id = ? AND user_id = ?`,
    newQuantity,
    today(),
    now(),
    medicineId,
    userId
  );
}
