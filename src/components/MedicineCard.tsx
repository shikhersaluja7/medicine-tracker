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
//   <MedicineCard
//     medicine={medicine}
//     inventory={inventory}  // optional — shows a low-stock badge if running low
//     onPress={() => router.push(`/medicine/${medicine.id}`)}
//   />

import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Medicine, Inventory } from "@/db/schema";

interface MedicineCardProps {
  // The medicine object from the database to display
  medicine: Medicine;
  // The inventory row for this medicine — optional because not all medicines
  // have inventory set up yet. If provided and running low, shows a warning badge.
  inventory?: Inventory | null;
  // Called when the user taps the card — usually navigates to the detail screen
  onPress: () => void;
}

export function MedicineCard({ medicine, inventory, onPress }: MedicineCardProps) {
  // isLowStock: true when quantity is at or below the warning threshold.
  // Like a fuel gauge warning light — it turns on before you actually run out.
  // e.g., quantity_on_hand = 5, low_stock_threshold = 7 → isLowStock = true
  const isLowStock =
    inventory != null &&
    inventory.quantity_on_hand <= inventory.low_stock_threshold;

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
      {/* The && operator renders the Text only when instructions is not null/empty */}
      {!!medicine.instructions && (
        <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
          {medicine.instructions}
        </Text>
      )}

      {/* ── Bottom row: doctor + low-stock badge + chevron ── */}
      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row items-center gap-2 flex-1">
          {medicine.doctor ? (
            <Text className="text-xs text-gray-400">Dr. {medicine.doctor}</Text>
          ) : (
            // Empty view keeps layout stable when there's no doctor name
            <View />
          )}

          {/* Low-stock badge — amber warning shown when running low.
              Like the fuel-light on a car dashboard: it catches your eye
              before the problem becomes urgent. */}
          {isLowStock && (
            <View className="flex-row items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <Ionicons name="warning-outline" size={11} color="#D97706" />
              <Text className="text-xs font-medium text-amber-700">
                Low stock
              </Text>
            </View>
          )}
        </View>

        {/* Right-pointing arrow indicates this card is tappable */}
        <Text className="text-gray-300 text-lg">›</Text>
      </View>
    </TouchableOpacity>
  );
}
