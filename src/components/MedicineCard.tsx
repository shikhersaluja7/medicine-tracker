// src/components/MedicineCard.tsx — A single card in the medicine list.
//
// What is a component?
// A component is a reusable piece of UI. Instead of writing the same card
// layout in every screen that shows medicines, we define it once here and
// import it wherever we need it.
//
// This component is "dumb" — it doesn't fetch any data or know about the database.
// It receives everything it needs as props (inputs) and just renders them.
// The parent screen (medicines.tsx) is responsible for fetching and passing data.
//
// Usage:
//   <MedicineCard medicine={medicine} onPress={() => router.push(`/medicine/${medicine.id}`)} />

import { View, Text, TouchableOpacity } from "react-native";
import type { Medicine } from "@/db/schema";

interface MedicineCardProps {
  // The medicine object from the database to display
  medicine: Medicine;
  // Called when the user taps the card — usually navigates to the detail screen
  onPress: () => void;
}

export function MedicineCard({ medicine, onPress }: MedicineCardProps) {
  return (
    // TouchableOpacity makes the whole card tappable and gives a press animation.
    // active:opacity-70 dims the card slightly when pressed (NativeWind active state).
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100 active:opacity-70"
    >
      {/* ── Top row: name + dosage badge ── */}
      <View className="flex-row items-start justify-between">
        {/* flex-1 and mr-2 make the name take available space, leaving room for the badge */}
        <Text className="text-base font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
          {medicine.name}
        </Text>

        {/* Dosage badge — a small blue pill-shaped label */}
        <View className="bg-blue-100 rounded-full px-3 py-1">
          <Text className="text-xs font-medium text-blue-700">{medicine.dosage}</Text>
        </View>
      </View>

      {/* ── Instructions (shown only if they exist) ── */}
      {/* The && operator renders the View only when instructions is not null/empty */}
      {!!medicine.instructions && (
        <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
          {medicine.instructions}
        </Text>
      )}

      {/* ── Bottom row: doctor name + chevron arrow ── */}
      <View className="flex-row items-center justify-between mt-2">
        {medicine.doctor ? (
          <Text className="text-xs text-gray-400">Dr. {medicine.doctor}</Text>
        ) : (
          // Show an empty spacer so the chevron stays right-aligned even with no doctor
          <View />
        )}

        {/* Right-pointing arrow indicates this card is tappable */}
        <Text className="text-gray-300 text-lg">›</Text>
      </View>
    </TouchableOpacity>
  );
}
