// app/(tabs)/dashboard.tsx — Main dashboard screen (placeholder).
// Phase 4 will replace this with the real dashboard showing today's doses,
// adherence stats, and low-stock warnings.
// For now it confirms that login worked and shows the logged-in user's info.
import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "@/auth/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      {/* Success confirmation that auth is working */}
      <Text className="text-4xl mb-4">✅</Text>
      <Text className="text-2xl font-bold text-gray-900 text-center">
        You're logged in!
      </Text>

      {/* Show the user's name and email from their Auth0 profile */}
      <Text className="text-gray-500 mt-2 text-center">{user?.name}</Text>
      <Text className="text-gray-400 text-sm mt-1">{user?.email}</Text>

      {/* Show the Auth0 sub (user ID) — this is what's stored in the database */}
      <View className="bg-gray-100 rounded-xl p-4 mt-6 w-full">
        <Text className="text-xs text-gray-500 font-medium">Your User ID (stored in DB):</Text>
        <Text className="text-xs text-blue-600 mt-1 font-mono">{user?.sub}</Text>
      </View>

      <Text className="text-gray-400 text-sm text-center mt-6">
        Phase 3 complete ✓{"\n"}Dashboard UI coming in Phase 4
      </Text>

      {/* Logout button — calls logout() from AuthContext, clears SecureStore */}
      <TouchableOpacity
        onPress={logout}
        className="mt-8 border border-gray-300 rounded-xl py-3 px-8"
      >
        <Text className="text-gray-600 font-medium">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
