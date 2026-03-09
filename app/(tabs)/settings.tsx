// app/(tabs)/settings.tsx — User settings and account management screen.
//
// This screen shows:
//   - The logged-in user's name, email, and Auth0 user ID
//   - Notification permission status with a link to device settings if denied
//   - A sign-out button that clears the session and returns to login

import { View, Text, TouchableOpacity, Alert, Linking } from "react-native";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { getPermissionStatus } from "@/services/notification.service";
import { Ionicons } from "@expo/vector-icons";

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  // notifStatus: the current notification permission ("granted", "denied", "undetermined").
  // We check this each time the screen loads so it stays accurate after the user
  // changes it in device Settings and returns to the app.
  const [notifStatus, setNotifStatus] = useState<string>("undetermined");

  // useEffect with [] runs once when the screen mounts — like checking the mailbox
  // when you walk into the room, not on every step you take inside.
  useEffect(() => {
    getPermissionStatus()
      .then(setNotifStatus)
      .catch(console.error);
  }, []);

  // handleOpenSettings: takes the user to the device's system Settings app.
  // On iOS this opens "Settings > Medicine Tracker > Notifications".
  // On Android it opens the app notification settings page.
  // Used when notifications are denied — we can't re-ask, only direct them to Settings.
  function handleOpenSettings() {
    Linking.openSettings().catch(console.error);
  }

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

        {/* ── Notifications card ── */}
        {/* Shows whether dose reminders are enabled on this device.
            If denied, a button guides the user to the system Settings app. */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Notifications
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              {/* Icon changes colour to signal permission state at a glance */}
              <Ionicons
                name="notifications-outline"
                size={18}
                color={notifStatus === "granted" ? "#22C55E" : "#EF4444"}
              />
              <Text className="text-sm text-gray-700">Dose reminders</Text>
            </View>

            {/* Status badge — green tick if granted, amber/red label if not */}
            {notifStatus === "granted" ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text className="text-sm text-green-600 font-medium">On</Text>
              </View>
            ) : (
              // Tapping "Enable" opens the device Settings app so the user can grant permission.
              // We can't show the permission dialog again after it's been denied —
              // sending them to Settings is the only option.
              <TouchableOpacity
                onPress={handleOpenSettings}
                className="bg-blue-600 rounded-lg px-3 py-1"
              >
                <Text className="text-white text-xs font-semibold">Enable</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Explanatory note when notifications are off */}
          {notifStatus !== "granted" && (
            <Text className="text-xs text-gray-400 mt-3 leading-4">
              Turn on notifications in device Settings to receive dose reminders at your scheduled times.
            </Text>
          )}
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
