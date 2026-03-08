// app/_layout.tsx — Root layout for the entire app.
// This is the first file expo-router loads. Everything in the app
// is wrapped inside this component (like a global wrapper).
// Later we'll add AuthProvider here to handle login state.
import { Stack } from "expo-router";
import { db } from "@/db/client";
import { runMigrations } from "@/db/migrations";

// Run migrations synchronously at module load time — BEFORE any screen renders.
// This guarantees that all tables exist when the first screen tries to query them.
// Since expo-sqlite's execSync is synchronous, there is no delay.
//
// This runs once per app launch. "CREATE TABLE IF NOT EXISTS" makes it safe
// to run every time — it simply does nothing if tables already exist.
runMigrations(db);

export default function RootLayout() {
  // Stack = a navigator where screens slide in from the right (like iPhone pages).
  // screenOptions={{ headerShown: false }} hides the default top navigation bar
  // on every screen — we'll build our own headers later.
  return <Stack screenOptions={{ headerShown: false }} />;
}
