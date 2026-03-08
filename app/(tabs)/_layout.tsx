// app/(tabs)/_layout.tsx — Bottom tab bar layout.
// This is a placeholder for Phase 4. The real tab bar (Dashboard, Medicines,
// Settings) will be built here in the next phase.
// For now it just wraps tab screens in a simple Stack navigator.
import { Stack } from "expo-router";

export default function TabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
