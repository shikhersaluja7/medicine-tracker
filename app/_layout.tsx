// app/_layout.tsx — Root layout: the outermost wrapper of the entire app.
//
// expo-router loads this file first on every app launch.
// Think of it like a picture frame — every screen in the app is displayed
// inside this frame. We use it to:
//   1. Run database migrations (create tables if they don't exist)
//   2. Wrap the app in AuthProvider (makes login state available everywhere)
//   3. Set up the Stack navigator (the system that manages screen transitions)
//
// Order matters here:
//   - Migrations run first (synchronously) so tables exist before any screen loads
//   - AuthProvider wraps Stack so every screen can call useAuth()
//   - Stack renders the current screen inside the AuthProvider

import { Stack } from "expo-router";
import { useEffect } from "react";
import { db } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import { AuthProvider } from "@/auth/AuthContext";
import { requestPermission } from "@/services/notification.service";

// ─── Run database migrations at module load time ───────────────────────────
// This code runs ONCE per app launch, synchronously, before any component renders.
// "Module load time" means it executes when this file is first imported by expo-router.
//
// Why not inside useEffect?
// useEffect runs AFTER the first render. If we ran migrations there, screens could
// try to query the database before the tables exist — causing crashes.
// Running synchronously here guarantees tables exist before the first render.
runMigrations(db);

export default function RootLayout() {
  // ─── Request notification permission on launch ──────────────────────────
  // useEffect with [] runs ONCE after the first render — perfect for one-time setup.
  //
  // Why request here instead of on a specific screen?
  // Asking early gives the user context: they just opened a medicine reminder app,
  // so notifications make obvious sense. If they deny, everything still works —
  // the app just won't buzz them at dose times (graceful degradation).
  //
  // If permission was already granted (e.g., second launch), requestPermission()
  // is a safe no-op — it just checks and returns true without showing a dialog.
  useEffect(() => {
    requestPermission().catch(console.error);
  }, []);

  return (
    // AuthProvider wraps everything so any screen can call useAuth()
    // to check if the user is logged in, get their info, or log them out.
    //
    // Without this wrapper, useAuth() would throw an error.
    <AuthProvider>
      {/*
        Stack is expo-router's screen manager for the "stack" navigation pattern.
        In a stack, screens pile up like a deck of cards:
          - Push a screen: it slides in from the right
          - Go back: it slides off to the right, revealing the previous screen

        screenOptions={{ headerShown: false }}:
        Hides the default grey navigation bar at the top of every screen.
        We'll build our own custom headers with Tailwind instead.
      */}
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
