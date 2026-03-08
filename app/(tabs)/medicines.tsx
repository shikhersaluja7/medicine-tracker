// app/(tabs)/medicines.tsx — The "Medicines" tab: shows all medicines and lets
// the user navigate to add, view, or edit them.
//
// This screen is the hub for medicine management. It:
//   1. Fetches all active medicines from SQLite via useMedicines()
//   2. Renders them as a scrollable list of MedicineCard components
//   3. Shows an empty state when no medicines have been added yet
//   4. Has a "+" button in the top-right that navigates to the add-medicine form
//
// Data flow:
//   SQLite DB → getMedicines() → useMedicines() → this screen → MedicineCard

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useMedicines } from "@/hooks/useMedicines";
import { MedicineCard } from "@/components/MedicineCard";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import type { Medicine } from "@/db/schema";

export default function MedicinesScreen() {
  const { user } = useAuth();
  const { medicines, isLoading, refetch } = useMedicines();

  // isRefreshing is a separate flag for the pull-to-refresh spinner.
  // When the user pulls down, we set this to true, refetch, then set it back.
  const [isRefreshing, setIsRefreshing] = useState(false);

  // handleRefresh: called when the user pulls down on the list to refresh.
  // This is a standard mobile UX pattern — pull down → new data loads.
  async function handleRefresh() {
    setIsRefreshing(true);
    refetch();
    setIsRefreshing(false);
  }

  // Show a spinner on the first load (before we have any data to show).
  // isLoading is only true briefly on the first render.
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    // flex-1: takes up the full screen height (minus the tab bar)
    // bg-gray-50: a very light grey background so cards stand out as white
    <View className="flex-1 bg-gray-50">

      {/* ── Header bar ── */}
      {/* pt-14: top padding to clear the iPhone status bar (time, battery, etc.) */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4 bg-white border-b border-gray-100">
        <View>
          <Text className="text-2xl font-bold text-gray-900">My Medicines</Text>
          {/* Show a count so the user knows how many medicines are tracked */}
          <Text className="text-sm text-gray-400 mt-0.5">
            {medicines.length === 0
              ? "No medicines added yet"
              : `${medicines.length} medicine${medicines.length === 1 ? "" : "s"} tracked`}
          </Text>
        </View>

        {/* "+" button — navigates to the add-medicine form */}
        {/* router.push() navigates forward (like clicking a link). The user can go back with the back gesture. */}
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
        // Good UX practice — never show a blank screen; always guide the user.
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">💊</Text>
          <Text className="text-xl font-semibold text-gray-700 text-center">
            No medicines yet
          </Text>
          <Text className="text-sm text-gray-400 text-center mt-2 leading-5">
            Tap the + button above to add your first prescription.
          </Text>
          {/* Shortcut button to add a medicine from the empty state */}
          <TouchableOpacity
            onPress={() => router.push("/medicine/new")}
            className="mt-6 bg-blue-600 rounded-2xl px-8 py-3"
          >
            <Text className="text-white font-semibold">Add First Medicine</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // FlatList efficiently renders long lists by only rendering items
        // that are currently visible on screen (like a virtual scroll window).
        // It's much more performant than wrapping everything in a ScrollView.
        <FlatList
          data={medicines}
          // keyExtractor tells FlatList which field uniquely identifies each item.
          // It uses this to efficiently update only the items that changed.
          keyExtractor={(item: Medicine) => item.id}
          renderItem={({ item }) => (
            <MedicineCard
              medicine={item}
              // Navigate to the detail screen for this specific medicine.
              // [id] in the filename becomes the dynamic part of the URL:
              //   /medicine/k7x2mq-abc → app/medicine/[id].tsx with id="k7x2mq-abc"
              onPress={() => router.push(`/medicine/${item.id}`)}
            />
          )}
          // Padding around the list so cards don't touch the screen edges
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          // Pull-to-refresh behaviour
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
