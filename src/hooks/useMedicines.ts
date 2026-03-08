// src/hooks/useMedicines.ts — React hook for fetching and refreshing the medicine list.
//
// What is a custom hook?
// A hook is a function that starts with "use" and connects a component to
// some external data or behaviour. This hook connects any screen to the
// medicines table in SQLite, handling loading states and re-fetching for you.
//
// Analogy: Imagine a librarian at a school library.
// You (the screen) walk up and say "I need all my books." The librarian
// (this hook) goes to the shelves (SQLite), finds your books, and hands
// them to you. You never go into the back room yourself.
// If the library reorganises its shelves, the librarian adjusts — you still
// just say "I need my books" and everything works.
//
// Why a hook instead of calling the service directly in the screen?
// Screens shouldn't know about SQLite details — they should just ask for data.
// The hook acts as a middleman: it fetches from SQLite, tracks loading state,
// and gives screens a simple { medicines, isLoading, refetch } interface.
// If we ever change the database, we only update the hook — not every screen.
//
// Usage in a screen:
//   const { medicines, isLoading, refetch } = useMedicines();
//   // medicines: array of Medicine objects (empty if none added yet)
//   // isLoading: true for the brief moment before the first fetch completes
//   // refetch(): call this after adding/editing/archiving to refresh the list

import { useState, useEffect, useCallback } from "react";
import { db } from "@/db/client";
import { getMedicines } from "@/services/medicine.service";
import { useAuth } from "@/auth/AuthContext";
import type { Medicine } from "@/db/schema";

export interface UseMedicinesResult {
  medicines: Medicine[];
  isLoading: boolean;
  refetch: () => void;
}

export function useMedicines(): UseMedicinesResult {
  const { user } = useAuth();

  // medicines: the list returned from the database.
  // Starts empty and is filled once the first fetch completes.
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  // isLoading: true while the first fetch is in progress.
  // Used to show a spinner instead of an empty list on first render.
  const [isLoading, setIsLoading] = useState(true);

  // fetch: wrapped in useCallback so its reference stays stable.
  //
  // Analogy: Imagine you write your friend's phone number on a sticky note.
  // useCallback is like keeping that SAME sticky note instead of copying it
  // onto a new piece of paper every single second. React checks "is the note
  // different?" — if you keep rewriting it, React thinks it changed and
  // re-runs things unnecessarily, causing an infinite loop.
  //
  // Without useCallback, a new function reference is created on every render,
  // which would cause the useEffect below to run in an infinite loop.
  const fetch = useCallback(() => {
    // If the user isn't logged in yet, return an empty list.
    // This shouldn't normally happen (index.tsx redirects before this screen loads),
    // but it's a safe guard.
    if (!user) {
      setMedicines([]);
      setIsLoading(false);
      return;
    }

    // getMedicines is synchronous (expo-sqlite's getAllSync returns immediately).
    // No async/await needed — the result is available on the same line.
    // user.sub is the Auth0 user ID, e.g., "auth0|abc123"
    // Every query is scoped to this userId so users only see their own medicines.
    const result = getMedicines(db, user.sub);
    setMedicines(result);
    setIsLoading(false);
  }, [user]); // re-create fetch only when the logged-in user changes

  // useEffect = "do this thing when something changes."
  // Run fetch once when the hook is first used, and again whenever fetch changes
  // (i.e., when the user changes — e.g., after logout + login as a different account).
  // It's like a doorbell — it rings (runs) when someone new arrives (fetch changes).
  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    medicines,
    isLoading,
    // Expose fetch as "refetch" so screens can trigger a refresh.
    // Example: after adding a new medicine, call refetch() to update the list.
    refetch: fetch,
  };
}
