// app/(tabs)/dashboard.tsx — The "Today" tab: daily dose overview.
//
// This screen will become the main hub in Phase 8, showing:
//   - Today's scheduled doses with Take/Skip buttons
//   - Weekly adherence percentage
//   - Low-stock warnings
//
// For now (Phase 4) it shows a summary of total medicines tracked
// and quick links to add medicines or view the list.

import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { useMedicines } from "@/hooks/useMedicines";
import { Ionicons } from "@expo/vector-icons";

export default function DashboardScreen() {
  const { user } = useAuth();
  // useMedicines() fetches the medicine list so we can show a count here.
  // The medicines tab also uses this hook — each call fetches independently.
  const { medicines } = useMedicines();

  // Friendly greeting based on time of day.
  // new Date().getHours() returns 0-23 (hour in local time).
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // First name only — "John Smith" → "John"
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <View className="flex-1 bg-gray-50">

      {/* ── Header ── */}
      <View className="px-5 pt-14 pb-5 bg-white border-b border-gray-100">
        <Text className="text-sm text-gray-400">{greeting},</Text>
        <Text className="text-2xl font-bold text-gray-900">{firstName} 👋</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* ── Summary card ── */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Your Medicines
          </Text>

          <View className="flex-row items-center gap-4">
            {/* Large number showing total medicine count */}
            <View className="w-16 h-16 rounded-2xl bg-blue-50 items-center justify-center">
              <Text className="text-3xl font-bold text-blue-600">{medicines.length}</Text>
            </View>

            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-800">
                {medicines.length === 1 ? "Medicine" : "Medicines"} tracked
              </Text>
              <Text className="text-sm text-gray-400 mt-0.5">
                {medicines.length === 0
                  ? "Add your first prescription to get started"
                  : "Schedules and reminders coming in Phase 7"}
              </Text>
            </View>
          </View>

          {/* Quick-add button if no medicines yet */}
          {medicines.length === 0 && (
            <TouchableOpacity
              onPress={() => router.push("/medicine/new")}
              className="mt-4 bg-blue-600 rounded-xl py-3 items-center"
            >
              <Text className="text-white font-semibold">Add First Medicine</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Coming soon cards ── */}
        {/* These placeholders give the user a preview of upcoming features */}
        <ComingSoonCard
          icon="alarm-outline"
          title="Today's Doses"
          description="Daily reminders and dose tracking — coming in Phase 8"
        />

        <ComingSoonCard
          icon="stats-chart-outline"
          title="Adherence Stats"
          description="See how consistently you're taking your medicines"
        />

        <ComingSoonCard
          icon="notifications-outline"
          title="Smart Reminders"
          description="Push notifications at your scheduled dose times — Phase 9"
        />

      </ScrollView>
    </View>
  );
}

// ─── ComingSoonCard ──────────────────────────────────────────────────────────
// A placeholder card for features not yet built.
// Helps the user understand what the app will look like when complete.
interface ComingSoonCardProps {
  icon: string;
  title: string;
  description: string;
}

function ComingSoonCard({ icon, title, description }: ComingSoonCardProps) {
  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 flex-row items-start gap-4 opacity-60">
      <View className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center">
        <Ionicons name={icon as any} size={20} color="#9CA3AF" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-600">{title}</Text>
        <Text className="text-xs text-gray-400 mt-0.5 leading-4">{description}</Text>
      </View>
    </View>
  );
}
