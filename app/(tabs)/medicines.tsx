// app/(tabs)/medicines.tsx — The "Medicines" tab: shows all medicines and lets
// the user navigate to add, view, or edit them.
//
// This screen is the hub for medicine management. It:
//   1. Fetches all active medicines from SQLite via useMedicines()
//   2. Fetches all inventory rows so each card can show a low-stock badge
//   3. Renders them as a scrollable list of MedicineCard components
//   4. Shows an empty state when no medicines have been added yet
//   5. Has a "+" button in the top-right that navigates to the add-medicine form
//
// Data flow:
//   SQLite DB → getMedicines() → useMedicines() → this screen → MedicineCard
//   SQLite DB → getAllInventories() → inventoryMap → MedicineCard (low-stock badge)

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { useMedicines } from "@/hooks/useMedicines";
import { MedicineCard } from "@/components/MedicineCard";
import { useAuth } from "@/auth/AuthContext";
import { getAllInventories } from "@/services/inventory.service";
import { db } from "@/db/client";
import { Ionicons } from "@expo/vector-icons";
import type { Medicine, Inventory } from "@/db/schema";

export default function MedicinesScreen() {
  const { user } = useAuth();
  const { medicines, isLoading, refetch } = useMedicines();

  // inventoryMap: a lookup table from medicine ID → inventory row.
  // Like a filing cabinet where each drawer (medicine ID) holds that
  // medicine's stock info. We use it so each card can find its inventory
  // instantly without doing its own database query.
  // e.g., { "med-abc": { quantity_on_hand: 5, ... }, "med-xyz": { ... } }
  const [inventoryMap, setInventoryMap] = useState<Record<string, Inventory>>({});

  // isRefreshing is a separate flag for the pull-to-refresh spinner.
  const [isRefreshing, setIsRefreshing] = useState(false);

  // fetchInventories: reads all inventory rows and builds the lookup map.
  // Defined with useCallback so useFocusEffect can depend on it stably.
  const fetchInventories = useCallback(() => {
    if (!user) return;
    const rows = getAllInventories(db, user.sub);
    // Convert the array into a map keyed by medicine_id for O(1) lookup.
    // Array → Object: [{ medicine_id: "abc", ... }] → { "abc": { ... } }
    const map: Record<string, Inventory> = {};
    for (const row of rows) {
      map[row.medicine_id] = row;
    }
    setInventoryMap(map);
  }, [user]);

  // useFocusEffect runs fetchInventories every time this screen comes into view.
  // This is important because the user might visit a detail screen, record a
  // refill, then come back — without this, the badge would show stale data.
  // Like checking the pantry every time you walk into the kitchen.
  useFocusEffect(fetchInventories);

  // handleRefresh: called when the user pulls down on the list to refresh.
  async function handleRefresh() {
    setIsRefreshing(true);
    refetch();
    fetchInventories();
    setIsRefreshing(false);
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">

      {/* ── Header bar ── */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4 bg-white border-b border-gray-100">
        <View>
          <Text className="text-2xl font-bold text-gray-900">My Medicines</Text>
          <Text className="text-sm text-gray-400 mt-0.5">
            {medicines.length === 0
              ? "No medicines added yet"
              : `${medicines.length} medicine${medicines.length === 1 ? "" : "s"} tracked`}
          </Text>
        </View>

        {/* "+" button — navigates to the add-medicine form */}
        <TouchableOpacity
          onPress={() => router.push("/medicine/new")}
          className="bg-blue-600 rounded-full w-10 h-10 items-center justify-center"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* ── Medicine list ── */}
      {medicines.length === 0 ? (
        // Empty state: shown when the user hasn't added any medicines yet.
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">💊</Text>
          <Text className="text-xl font-semibold text-gray-700 text-center">
            No medicines yet
          </Text>
          <Text className="text-sm text-gray-400 text-center mt-2 leading-5">
            Tap the + button above to add your first prescription.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/medicine/new")}
            className="mt-6 bg-blue-600 rounded-2xl px-8 py-3"
          >
            <Text className="text-white font-semibold">Add First Medicine</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // FlatList efficiently renders long lists by only rendering items
        // that are currently visible on screen.
        <FlatList
          data={medicines}
          keyExtractor={(item: Medicine) => item.id}
          renderItem={({ item }) => (
            <MedicineCard
              medicine={item}
              // Look up this medicine's inventory in the map.
              // If no inventory has been set up, inventory is undefined → no badge.
              inventory={inventoryMap[item.id] ?? null}
              onPress={() => router.push(`/medicine/${item.id}`)}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
            />
          }
        />
      )}
    </View>
  );
}
