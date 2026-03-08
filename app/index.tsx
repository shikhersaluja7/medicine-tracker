// app/index.tsx — Entry screen of the app.
// This is the first screen shown when the app opens.
// In Phase 3 (Auth), this will redirect to /sign-in or /dashboard
// depending on whether the user is logged in.
// For now it shows a simple placeholder screen.
import { View, Text } from "react-native";

export default function Index() {
  return (
    // View = a container (like a <div> in web)
    // className uses Tailwind CSS via NativeWind — e.g., "flex-1" = { flex: 1 }
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-blue-600">Medicine Tracker</Text>
      <Text className="text-gray-500 mt-2">Phase 1 — Scaffolding complete ✓</Text>
    </View>
  );
}
