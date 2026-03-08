// app/index.tsx — The app's entry point and smart redirect.
//
// This screen doesn't show any UI of its own — it just decides where to send
// the user based on whether they're logged in.
//
// Think of it as a receptionist: they check your credentials and point you
// to the right room (dashboard for logged-in users, sign-in for everyone else).
//
// Why not put this logic in _layout.tsx?
// Keeping redirect logic here (in a screen file) makes it easier to test
// and change in isolation. _layout.tsx stays focused on wrapping providers.

import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/auth/AuthContext";

export default function Index() {
  const { user, isLoading } = useAuth();

  // isLoading is true while the app checks SecureStore for a saved session.
  // This takes a fraction of a second on first launch.
  // Showing a spinner here prevents the login screen from flashing for
  // users who are already logged in.
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        {/* ActivityIndicator is React Native's built-in loading spinner */}
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // If a user object exists, they're logged in — send them to the dashboard.
  // <Redirect> immediately navigates without the user seeing this screen.
  // The `href` here uses the route path — (tabs) is a route group (no URL effect),
  // so /(tabs)/dashboard → the file at app/(tabs)/dashboard.tsx
  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  // No user = not logged in → send to the sign-in screen.
  return <Redirect href="/(auth)/sign-in" />;
}
