// app/_layout.tsx — Root layout for the entire app.
// This is the first file expo-router loads. Everything in the app
// is wrapped inside this component (like a global wrapper).
// Later we'll add AuthProvider here to handle login state.
import { Stack } from "expo-router";

export default function RootLayout() {
  // Stack = a navigator where screens slide in from the right (like iPhone pages).
  // screenOptions={{ headerShown: false }} hides the default top navigation bar
  // on every screen — we'll build our own headers later.
  return <Stack screenOptions={{ headerShown: false }} />;
}
