// app/(auth)/sign-in.tsx — The login screen.
//
// This is what the user sees when they first open the app (before logging in).
// Tapping "Sign In" opens Auth0's Universal Login in a browser —
// the user enters their email/password or chooses Google/Apple there,
// then gets redirected back to this app automatically.
//
// Why open a browser instead of building a login form?
// Building a secure login form is extremely hard. Auth0's Universal Login
// handles password hashing, brute-force protection, MFA, and OAuth flows.
// You get all of that for free by delegating to Auth0.

import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { Redirect } from "expo-router";
import { useState } from "react";

export default function SignIn() {
  const { user, login, isLoading } = useAuth();

  // isSigningIn tracks whether the Auth0 browser window is currently open.
  // We show a spinner during this time so the user knows something is happening.
  const [isSigningIn, setIsSigningIn] = useState(false);

  // If the user is already logged in (e.g., they opened the app after a previous session),
  // redirect them directly to the dashboard — they don't need to see this screen.
  if (!isLoading && user) {
    // <Redirect> is expo-router's way of navigating programmatically.
    // Using it as a JSX element (rather than router.push) is better here
    // because it runs during render, before any flicker can happen.
    return <Redirect href="/(tabs)/dashboard" />;
  }

  // While restoring a session from SecureStore on app startup, show a spinner.
  // This prevents a flash of the login screen for users who are already logged in.
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-500 mt-3 text-sm">Loading...</Text>
      </View>
    );
  }

  // handleLogin: called when the user taps the sign-in button.
  async function handleLogin() {
    setIsSigningIn(true);
    try {
      // login() opens the Auth0 browser. It returns when the user
      // finishes login or cancels. The AuthContext handles everything after that.
      await login();
    } finally {
      // Always reset the spinner, even if login was cancelled or failed.
      setIsSigningIn(false);
    }
  }

  return (
    // flex-1 makes the View take up the full screen height
    // bg-white sets the background to white
    <View className="flex-1 bg-white">

      {/* ── Top section: branding ── */}
      {/* flex-1 here takes up the upper portion of the screen */}
      <View className="flex-1 items-center justify-center px-8">

        {/* App icon placeholder — a blue circle with a pill emoji */}
        <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-6">
          <Text className="text-5xl">💊</Text>
        </View>

        <Text className="text-3xl font-bold text-gray-900 text-center">
          Medicine Tracker
        </Text>

        <Text className="text-base text-gray-500 text-center mt-3 leading-6">
          Keep your family's medicines organised.{"\n"}
          Never miss a dose or run out of stock.
        </Text>
      </View>

      {/* ── Bottom section: sign-in button ── */}
      {/* pb-12 adds padding at the bottom so the button isn't against the screen edge */}
      <View className="px-8 pb-12">

        {/* Sign-In button — disabled while signing in to prevent double-taps */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={isSigningIn}
          // opacity-50 makes the button look faded when disabled
          className={`bg-blue-600 rounded-2xl py-4 items-center ${isSigningIn ? "opacity-50" : ""}`}
        >
          {isSigningIn ? (
            // Show a spinner inside the button while Auth0 is loading
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white font-semibold text-base">Opening Sign In...</Text>
            </View>
          ) : (
            <Text className="text-white font-semibold text-base">
              Sign In / Create Account
            </Text>
          )}
        </TouchableOpacity>

        {/* Small note explaining what "sign in" does */}
        <Text className="text-gray-400 text-xs text-center mt-4">
          Sign in with email, Google, or Apple.{"\n"}
          Your data stays private on your device.
        </Text>
      </View>
    </View>
  );
}
