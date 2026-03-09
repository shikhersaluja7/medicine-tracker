// src/hooks/useSchedule.ts — React hook for reading and updating one medicine's schedule.
//
// Like a personal assistant who manages one alarm clock for you.
// You tell them which medicine (medicineId), and they tell you what the current
// schedule is, let you change it, or turn it off — all without you touching
// the database directly.
//
// Usage in a screen:
//   const { schedule, isLoading, upsert, deactivate } = useSchedule(medicineId);
//   // schedule: the active Schedule row, or null if none set up
//   // isLoading: true briefly on first load
//   // upsert(input): save a new or updated schedule
//   // deactivate(): turn the schedule off (sets is_active = 0)

import { useState, useEffect, useCallback } from "react";
import { db } from "@/db/client";
import {
  getSchedule,
  upsertSchedule,
  deactivateSchedule,
  type UpsertScheduleInput,
} from "@/services/schedule.service";
import { useAuth } from "@/auth/AuthContext";
import type { Schedule } from "@/db/schema";

export interface UseScheduleResult {
  schedule: Schedule | null;
  isLoading: boolean;
  refetch: () => void;
  upsert: (input: UpsertScheduleInput) => Schedule;
  deactivate: () => void;
}

export function useSchedule(medicineId: string): UseScheduleResult {
  const { user } = useAuth();

  // schedule: the currently active schedule for this medicine, or null.
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  // isLoading: true while the first database read is happening.
  const [isLoading, setIsLoading] = useState(true);

  // fetch: reads the schedule from SQLite and stores it in state.
  // useCallback keeps the reference stable so useEffect doesn't loop.
  const fetch = useCallback(() => {
    if (!user || !medicineId) {
      setSchedule(null);
      setIsLoading(false);
      return;
    }
    const result = getSchedule(db, medicineId, user.sub);
    setSchedule(result);
    setIsLoading(false);
  }, [medicineId, user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // upsert: saves a new schedule (deactivates the old one first if it exists).
  // Automatically updates local state so the screen re-renders immediately.
  function upsert(input: UpsertScheduleInput): Schedule {
    if (!user) throw new Error("Not authenticated");
    const saved = upsertSchedule(db, medicineId, user.sub, input);
    setSchedule(saved);
    return saved;
  }

  // deactivate: turns the active schedule off and clears it from local state.
  function deactivate(): void {
    if (!user) throw new Error("Not authenticated");
    deactivateSchedule(db, medicineId, user.sub);
    setSchedule(null);
  }

  return { schedule, isLoading, refetch: fetch, upsert, deactivate };
}
