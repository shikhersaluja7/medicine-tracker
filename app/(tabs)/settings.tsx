// app/(tabs)/settings.tsx — User settings and account management screen.
//
// This screen shows:
//   - The logged-in user's name, email, and Auth0 user ID
//   - A sign-out button that clears the session and returns to login

import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  // handleSignOut: asks for confirmation before logging out.
  // Alert.alert() shows a native dialog — looks like a system alert on iOS/Android.
  // We confirm because logout deletes the session and navigates away, which is hard to undo.
  function handleSignOut() {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        // "Cancel" button — does nothing, closes the dialog
        { text: "Cancel", style: "cancel" },
        // "Sign Out" button — calls logout() from AuthContext
        // "destructive" style makes this button red on iOS (signals a significant action)
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            // logout() clears the stored token from SecureStore and sets user to null.
            // The index.tsx redirect logic will then send the user to /sign-in.
            await logout();
          },
        },
      ]
    );
  }

  return (
    <View className="flex-1 bg-gray-50">

      {/* ── Header ── */}
      <View className="px-5 pt-14 pb-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Settings</Text>
      </View>

      <View className="px-5 pt-6 gap-4">

        {/* ── Account card ── */}
        {/* Shows who is currently logged in */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Account
          </Text>

          {/* Avatar circle with first initial */}
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 rounded-full bg-blue-100 items-center justify-center">
              {/* Show first letter of the user's name as an avatar */}
              <Text className="text-2xl font-bold text-blue-600">
                {user?.name?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>

            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">{user?.name}</Text>
              <Text className="text-sm text-gray-400">{user?.email}</Text>
            </View>
          </View>

          {/* Auth0 user ID — shown for transparency and debugging */}
          <View className="mt-4 pt-4 border-t border-gray-100">
            <Text className="text-xs text-gray-400">User ID</Text>
            {/* font-mono makes the ID easier to read (fixed-width font) */}
            <Text className="text-xs text-gray-500 font-mono mt-0.5" numberOfLines={1}>
              {user?.sub}
            </Text>
          </View>
        </View>

        {/* ── App info card ── */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            About
          </Text>

          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-gray-600">Version</Text>
            <Text className="text-sm text-gray-400">1.0.0</Text>
          </View>

          <View className="flex-row justify-between items-center mt-3">
            <Text className="text-sm text-gray-600">Data storage</Text>
            <Text className="text-sm text-gray-400">On this device</Text>
          </View>
        </View>

        {/* ── Sign-out button ── */}
        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-white rounded-2xl p-4 border border-red-100 flex-row items-center justify-between active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text className="text-base font-medium text-red-500">Sign Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
        </TouchableOpacity>

      </View>
    </View>
  );
}
