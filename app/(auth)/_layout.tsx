// app/(auth)/_layout.tsx — Layout wrapper for the login/sign-up screens.
//
// What does (auth) mean in the folder name?
// The parentheses create a "route group" in expo-router. A route group
// organises files into a folder WITHOUT adding the folder name to the URL.
// So "app/(auth)/sign-in.tsx" has the URL path "/sign-in", not "/auth/sign-in".
// This keeps the URLs clean while keeping files organised by feature.
//
// This layout wraps only the sign-in and sign-up screens.
// It uses a simple Stack navigator so screens slide in from the right.
// We hide the header because the sign-in screen has its own visual design.
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
