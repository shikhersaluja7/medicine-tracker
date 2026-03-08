// app/medicine/[id].tsx — The detail screen for a single medicine.
//
// What is [id] in the filename?
// The square brackets make this a "dynamic route" in expo-router.
// The filename [id] means any value can go in that position of the URL.
// Examples:
//   URL /medicine/k7x2mq-abc  →  this screen with id = "k7x2mq-abc"
//   URL /medicine/xyz-987     →  this screen with id = "xyz-987"
//
// We read the actual id value using expo-router's useLocalSearchParams() hook.
//
// This screen shows all details of one medicine and provides:
//   - An "Edit" button → navigates to [id]-edit.tsx
//   - An "Archive" button → soft-deletes the medicine (sets is_active = 0)

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { db } from "@/db/client";
import { getMedicineById, archiveMedicine } from "@/services/medicine.service";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import type { Medicine } from "@/db/schema";

export default function MedicineDetailScreen() {
  const { user } = useAuth();

  // useLocalSearchParams reads the URL parameters for this screen.
  // For the URL /medicine/k7x2mq-abc, this returns { id: "k7x2mq-abc" }
  const { id } = useLocalSearchParams<{ id: string }>();

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch this specific medicine from the database when the screen loads.
  // We use useEffect so it runs once after the first render.
  useEffect(() => {
    if (!user || !id) return;

    // getMedicineById returns the medicine or null if not found / not owned by this user.
    const found = getMedicineById(db, id, user.sub);
    setMedicine(found);
    setIsLoading(false);
  }, [id, user]);

  // handleArchive: confirms then removes the medicine from active lists.
  // We use Alert.alert() for a native confirmation dialog.
  function handleArchive() {
    Alert.alert(
      "Archive Medicine",
      `Archive "${medicine?.name}"?\n\nIt will be hidden from your list but your dose history will be kept.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => {
            if (!user || !id) return;
            // archiveMedicine sets is_active = 0 — the medicine is hidden, not deleted.
            // Dose history in intake_logs is preserved for adherence statistics.
            archiveMedicine(db, id, user.sub);
            // Go back to the medicines list after archiving.
            // router.back() removes this screen from the navigation stack.
            router.back();
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // If the medicine wasn't found (wrong ID or belongs to another user), show an error.
  if (!medicine) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-lg font-semibold text-gray-600 mt-4">Medicine not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-6">
          <Text className="text-blue-600 font-medium">← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">

      {/* ── Header ── */}
      <View className="flex-row items-center px-5 pt-14 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>
          {medicine.name}
        </Text>
        {/* Edit button — navigates to the edit form pre-filled with this medicine's data */}
        <TouchableOpacity
          onPress={() => router.push(`/medicine/${id}-edit`)}
          className="p-2"
        >
          <Ionicons name="create-outline" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* ── Main info card ── */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">

          {/* Name + dosage badge */}
          <View className="flex-row items-start justify-between mb-4">
            <Text className="text-2xl font-bold text-gray-900 flex-1 mr-3">
              {medicine.name}
            </Text>
            <View className="bg-blue-100 rounded-full px-4 py-1.5">
              <Text className="text-sm font-semibold text-blue-700">{medicine.dosage}</Text>
            </View>
          </View>

          {/* Detail rows — shown only when the field has a value */}
          {medicine.instructions && (
            <DetailRow icon="information-circle-outline" label="Instructions" value={medicine.instructions} />
          )}

          {medicine.doctor && (
            <DetailRow icon="person-outline" label="Doctor" value={`Dr. ${medicine.doctor}`} />
          )}

          {/* Added date — converted from ISO string to a readable format */}
          <DetailRow
            icon="calendar-outline"
            label="Added on"
            // toLocaleDateString() formats "2026-03-08T12:00:00.000Z" → "3/8/2026"
            value={new Date(medicine.created_at).toLocaleDateString()}
          />
        </View>

        {/* ── Inventory placeholder ── */}
        {/* Phase 6 will replace this with real inventory data */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Inventory
          </Text>
          <Text className="text-sm text-gray-400 text-center py-2">
            Inventory tracking coming in Phase 6
          </Text>
        </View>

        {/* ── Schedule placeholder ── */}
        {/* Phase 7 will replace this with the real dosage schedule */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Schedule
          </Text>
          <Text className="text-sm text-gray-400 text-center py-2">
            Dosage schedule coming in Phase 7
          </Text>
        </View>

        {/* ── Archive button ── */}
        {/* Separated from the main content and styled as a destructive action */}
        <TouchableOpacity
          onPress={handleArchive}
          className="border border-red-200 rounded-2xl py-4 items-center flex-row justify-center gap-2"
        >
          <Ionicons name="archive-outline" size={18} color="#EF4444" />
          <Text className="text-red-500 font-medium">Archive Medicine</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ─── DetailRow ──────────────────────────────────────────────────────────────
// A reusable row for displaying a label-value pair with an icon.
// Used for instructions, doctor, added date, etc.
interface DetailRowProps {
  icon: string;   // Ionicons icon name, e.g., "person-outline"
  label: string;  // e.g., "Doctor"
  value: string;  // e.g., "Dr. Smith"
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View className="flex-row items-start gap-3 py-3 border-t border-gray-50">
      <Ionicons name={icon as any} size={18} color="#9CA3AF" style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-xs text-gray-400 mb-0.5">{label}</Text>
        <Text className="text-sm text-gray-700">{value}</Text>
      </View>
    </View>
  );
}
