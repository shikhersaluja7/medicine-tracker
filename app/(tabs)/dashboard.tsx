// app/(tabs)/dashboard.tsx — The "Today" tab: daily overview and alerts.
//
// This screen is the first thing the user sees when they open the app.
// Right now it shows:
//   - A greeting with their name
//   - How many medicines they're tracking
//   - A "Low Stock" alert section for any medicines running low
//
// Phase 8 will add today's scheduled doses with Take/Skip buttons.
// Phase 9 will add push notification management.

import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useMedicines } from "@/hooks/useMedicines";
import { getLowStockInventories, type LowStockItem } from "@/services/inventory.service";
import { db } from "@/db/client";
import { Ionicons } from "@expo/vector-icons";

export default function DashboardScreen() {
  const { user } = useAuth();
  const { medicines } = useMedicines();

  // lowStockItems: medicines whose quantity is at or below their threshold.
  // Fetched fresh every time this screen comes into focus so the list is
  // always up to date after the user records a refill on the detail screen.
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  // useFocusEffect: runs the callback every time this tab becomes visible.
  // Like a shop assistant who checks the shelves every time they walk in —
  // not just once when they start their shift.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLowStockItems(getLowStockInventories(db, user.sub));
    }, [user])
  );

  // Friendly greeting based on time of day.
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

        {/* ── Low Stock section ── */}
        {/* Only shown when at least one medicine is running low.
            Like a "Shopping needed" sticky note on the fridge — it's only
            there when there's actually something you need to buy. */}
        {lowStockItems.length > 0 && (
          <View className="bg-white rounded-2xl border border-amber-200 mb-4 overflow-hidden">
            {/* Section header with amber accent */}
            <View className="flex-row items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-100">
              <Ionicons name="warning-outline" size={16} color="#D97706" />
              <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Low Stock
              </Text>
            </View>

            {/* One row per low-stock medicine */}
            {lowStockItems.map(({ inventory, medicineName }, index) => (
              <TouchableOpacity
                key={inventory.medicine_id}
                // Navigate to the detail screen so the user can record a refill.
                onPress={() => router.push(`/medicine/${inventory.medicine_id}`)}
                className={`flex-row items-center justify-between px-5 py-4 ${
                  index < lowStockItems.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">
                    {medicineName}
                  </Text>
                  {/* Show the remaining count in amber to signal urgency */}
                  <Text className="text-xs text-amber-600 mt-0.5">
                    {inventory.quantity_on_hand % 1 === 0
                      ? inventory.quantity_on_hand
                      : inventory.quantity_on_hand.toFixed(1)}{" "}
                    {inventory.unit}s remaining
                  </Text>
                </View>
                {/* Chevron tells the user this row is tappable */}
                <Ionicons name="chevron-forward" size={16} color="#D97706" />
              </TouchableOpacity>
            ))}
          </View>
        )}

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
interface ComingSoonCardProps {
  icon: string;
  title: string;
  description: string;
}

function ComingSoonCard({ icon, title, description }: ComingSoonCardProps) {
  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 flex-row items-start gap-4 opacity-60">
      <View className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center">
        <Ionicons name={icon as never} size={20} color="#9CA3AF" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-600">{title}</Text>
        <Text className="text-xs text-gray-400 mt-0.5 leading-4">{description}</Text>
      </View>
    </View>
  );
}
