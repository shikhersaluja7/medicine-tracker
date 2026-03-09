// src/hooks/useInventory.ts — React hook for reading and updating one medicine's inventory.
//
// Like a shop assistant who keeps track of stock for a single item on the shelf.
// You tell them which item (medicineId), and they hand you the current count,
// let you change it, and record new deliveries — all without you touching the
// stockroom (database) directly.
//
// Usage in a screen:
//   const { inventory, isLoading, upsert, recordRefill } = useInventory(medicineId);
//   // inventory: the Inventory row, or null if not set up yet
//   // isLoading: true briefly on first load
//   // upsert(input): save quantity / unit / threshold
//   // recordRefill(newQty): record a new bottle pickup

import { useState, useEffect, useCallback } from "react";
import { db } from "@/db/client";
import {
  getInventory,
  upsertInventory,
  recordRefill as recordRefillService,
  type UpsertInventoryInput,
} from "@/services/inventory.service";
import { useAuth } from "@/auth/AuthContext";
import type { Inventory } from "@/db/schema";

export interface UseInventoryResult {
  inventory: Inventory | null;
  isLoading: boolean;
  refetch: () => void;
  upsert: (input: UpsertInventoryInput) => Inventory;
  recordRefill: (newQuantity: number) => void;
}

export function useInventory(medicineId: string): UseInventoryResult {
  const { user } = useAuth();

  // inventory: the current inventory row for this medicine (null if not set up).
  const [inventory, setInventory] = useState<Inventory | null>(null);

  // isLoading: true while the first database read is in progress.
  const [isLoading, setIsLoading] = useState(true);

  // fetch: reads the inventory row from SQLite and stores it in state.
  // Wrapped in useCallback so its reference stays stable across re-renders.
  // Without this, the useEffect below would re-run infinitely.
  const fetch = useCallback(() => {
    if (!user || !medicineId) {
      setInventory(null);
      setIsLoading(false);
      return;
    }

    // getInventory is synchronous — result is available immediately.
    const result = getInventory(db, medicineId, user.sub);
    setInventory(result);
    setIsLoading(false);
  }, [medicineId, user]);

  // Run fetch once when the hook is first used, and again if the medicine or
  // logged-in user changes.
  useEffect(() => {
    fetch();
  }, [fetch]);

  // upsert: saves quantity / unit / threshold and returns the updated row.
  // Calling this automatically updates the local `inventory` state so the
  // screen re-renders without needing a separate refetch call.
  function upsert(input: UpsertInventoryInput): Inventory {
    if (!user) throw new Error("Not authenticated");
    const saved = upsertInventory(db, medicineId, user.sub, input);
    setInventory(saved);
    return saved;
  }

  // recordRefill: updates quantity and last_refill_date, then re-reads the row.
  // We re-read (fetch) instead of computing locally so the date is always
  // exactly what the database stored — no risk of timestamp drift.
  function recordRefill(newQuantity: number): void {
    if (!user) throw new Error("Not authenticated");
    recordRefillService(db, medicineId, user.sub, newQuantity);
    fetch();
  }

  return { inventory, isLoading, refetch: fetch, upsert, recordRefill };
}
