// app/(tabs)/_layout.tsx — The bottom tab bar that appears on every main screen.
//
// What are tabs?
// Tabs are the row of icons at the very bottom of most apps (like Instagram's
// home/search/profile icons). expo-router's <Tabs> component creates this
// bar automatically — one tab per file in the (tabs) folder.
//
// How does expo-router know which files to make tabs?
// Every .tsx file directly inside app/(tabs)/ becomes a tab automatically.
// The file name becomes the route path:
//   app/(tabs)/dashboard.tsx  → tab at route "/(tabs)/dashboard"
//   app/(tabs)/medicines.tsx  → tab at route "/(tabs)/medicines"
//   app/(tabs)/settings.tsx   → tab at route "/(tabs)/settings"
//
// Tab options (tabBarLabel, tabBarIcon, etc.) are set per-screen using
// the <Tabs.Screen> component inside this layout file.

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Ionicons is a free icon set that ships with @expo/vector-icons.
// Full icon list: https://icons.expo.fyi
// Usage: <Ionicons name="home" size={24} color="blue" />

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // Hide the default screen title bar — we build our own headers per screen
        headerShown: false,

        // Active tab: filled blue icon + blue label
        tabBarActiveTintColor: "#3B82F6",  // Tailwind blue-500

        // Inactive tab: muted grey icon + grey label
        tabBarInactiveTintColor: "#9CA3AF", // Tailwind gray-400

        // White tab bar background with a subtle top border
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F3F4F6", // Tailwind gray-100
          borderTopWidth: 1,
          // Extra bottom padding on iOS for the "home indicator" area (the bar
          // at the very bottom of newer iPhones — without this, tabs overlap it)
          paddingBottom: 4,
        },
      }}
    >
      {/* ── Tab 1: Dashboard ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarLabel: "Today",
          // tabBarIcon renders the icon for this tab.
          // `focused` is true when this tab is currently selected.
          // We show a filled icon when active and an outline when inactive.
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 2: Medicines ── */}
      <Tabs.Screen
        name="medicines"
        options={{
          tabBarLabel: "Medicines",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "medical" : "medical-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* ── Tab 3: Settings ── */}
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
