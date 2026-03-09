// app/medicine/[id].tsx — The detail screen for a single medicine.
//
// What is [id] in the filename?
// The square brackets make this a "dynamic route" in expo-router.
// Any value can go in that position of the URL.
// Examples:
//   URL /medicine/k7x2mq-abc  →  this screen with id = "k7x2mq-abc"
//   URL /medicine/xyz-987     →  this screen with id = "xyz-987"
//
// This screen shows all details of one medicine and provides:
//   - An "Edit" button → navigates to [id]-edit.tsx
//   - An "Archive" button → soft-deletes the medicine (sets is_active = 0)
//   - An "Inventory" section → set up, edit, and record refills for stock tracking

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { db } from "@/db/client";
import { getMedicineById, archiveMedicine } from "@/services/medicine.service";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import type { Medicine, Inventory } from "@/db/schema";

// The four unit options the user can choose from.
// Ordered from most common to least.
const UNITS = ["tablet", "capsule", "ml", "patch"] as const;

export default function MedicineDetailScreen() {
  const { user } = useAuth();

  // useLocalSearchParams reads the URL parameters for this screen.
  // For the URL /medicine/k7x2mq-abc, this returns { id: "k7x2mq-abc" }
  const { id } = useLocalSearchParams<{ id: string }>();

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // useInventory provides the current inventory state and mutation functions
  // for this specific medicine.
  const {
    inventory,
    isLoading: isInventoryLoading,
    upsert,
    recordRefill,
  } = useInventory(id ?? "");

  // Fetch this specific medicine from the database when the screen loads.
  useEffect(() => {
    if (!user || !id) return;
    const found = getMedicineById(db, id, user.sub);
    setMedicine(found);
    setIsLoading(false);
  }, [id, user]);

  // handleArchive: confirms then removes the medicine from active lists.
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
            archiveMedicine(db, id, user.sub);
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
            <DetailRow
              icon="information-circle-outline"
              label="Instructions"
              value={medicine.instructions}
            />
          )}

          {medicine.doctor && (
            <DetailRow
              icon="person-outline"
              label="Doctor"
              value={`Dr. ${medicine.doctor}`}
            />
          )}

          {/* Added date — converted from ISO string to a readable format */}
          <DetailRow
            icon="calendar-outline"
            label="Added on"
            // toLocaleDateString() formats "2026-03-09T12:00:00.000Z" → "3/9/2026"
            value={new Date(medicine.created_at).toLocaleDateString()}
          />
        </View>

        {/* ── Inventory section ── */}
        {/* Shows a spinner while inventory loads (it's fast — just a quick
            SQLite read — but we guard against a flash of wrong content). */}
        {isInventoryLoading ? (
          <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 items-center">
            <ActivityIndicator size="small" color="#9CA3AF" />
          </View>
        ) : (
          <InventorySection
            inventory={inventory}
            onUpsert={upsert}
            onRecordRefill={recordRefill}
          />
        )}

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

// ─── InventorySection ────────────────────────────────────────────────────────
// Renders the inventory card in one of four states:
//   "setup"   — no inventory row yet; shows a "Set Up Inventory" button
//   "view"    — shows quantity, unit, threshold, last refill date
//   "editing" — inline form to change quantity / unit / threshold
//   "refilling" — inline form to record a new refill quantity
//
// Like a fuel gauge panel on a car dashboard — it shows the current level and
// lets you update it when you fill up.

interface InventorySectionProps {
  inventory: Inventory | null;
  onUpsert: (input: { quantityOnHand: number; unit: string; lowStockThreshold: number }) => void;
  onRecordRefill: (newQuantity: number) => void;
}

type InventoryMode = "view" | "editing" | "refilling";

function InventorySection({ inventory, onUpsert, onRecordRefill }: InventorySectionProps) {
  // mode controls which UI is shown inside this card.
  const [mode, setMode] = useState<InventoryMode>("view");

  // Edit form state — pre-filled from existing inventory when entering edit mode.
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("tablet");
  const [editThreshold, setEditThreshold] = useState("7");

  // Refill form state — just the new quantity.
  const [refillQty, setRefillQty] = useState("");

  // isLowStock: true when quantity is at or below the threshold.
  const isLowStock =
    inventory != null &&
    inventory.quantity_on_hand <= inventory.low_stock_threshold;

  // enterEditMode: populates the edit form with current values before showing it.
  function enterEditMode() {
    setEditQty(String(inventory?.quantity_on_hand ?? ""));
    setEditUnit(inventory?.unit ?? "tablet");
    setEditThreshold(String(inventory?.low_stock_threshold ?? "7"));
    setMode("editing");
  }

  // enterRefillMode: clears the refill qty field before showing it.
  function enterRefillMode() {
    setRefillQty("");
    setMode("refilling");
  }

  // handleSaveEdit: validates and saves the edit form.
  function handleSaveEdit() {
    const qty = parseFloat(editQty);
    const threshold = parseFloat(editThreshold);

    // isNaN checks if the value couldn't be converted to a number.
    // e.g., the user typed "abc" instead of "28" → isNaN("abc") = true
    if (isNaN(qty) || qty < 0) {
      Alert.alert("Invalid Quantity", "Please enter a number of 0 or more.");
      return;
    }
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert("Invalid Threshold", "Please enter a number of 0 or more.");
      return;
    }

    onUpsert({ quantityOnHand: qty, unit: editUnit, lowStockThreshold: threshold });
    setMode("view");
  }

  // handleSaveRefill: validates and saves the refill quantity.
  function handleSaveRefill() {
    const qty = parseFloat(refillQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a number greater than 0.");
      return;
    }
    onRecordRefill(qty);
    setMode("view");
  }

  // showUnitPicker: opens an Alert with the four unit options as buttons.
  // Alert.alert is cross-platform (iOS + Android) unlike native Picker components.
  function showUnitPicker() {
    Alert.alert(
      "Choose Unit",
      "What unit does this medicine use?",
      UNITS.map((unit) => ({
        text: unit.charAt(0).toUpperCase() + unit.slice(1), // "tablet" → "Tablet"
        onPress: () => setEditUnit(unit),
      })).concat([{ text: "Cancel", onPress: () => {} }])
    );
  }

  // ── No inventory set up yet ──────────────────────────────────────────────
  if (!inventory && mode === "view") {
    return (
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Inventory
        </Text>
        <Text className="text-sm text-gray-500 mb-4">
          Track how many you have left so you never run out unexpectedly.
        </Text>
        <TouchableOpacity
          onPress={enterEditMode}
          className="bg-blue-600 rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold text-sm">Set Up Inventory</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Edit form ────────────────────────────────────────────────────────────
  if (mode === "editing") {
    return (
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Inventory
          </Text>
          <TouchableOpacity onPress={() => setMode("view")}>
            <Text className="text-sm text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Quantity input */}
        <View className="mb-4">
          <Text className="text-xs font-medium text-gray-500 mb-1">Quantity on hand</Text>
          <TextInput
            value={editQty}
            onChangeText={setEditQty}
            placeholder="e.g., 28"
            placeholderTextColor="#D1D5DB"
            // decimal-pad shows a number keyboard with a decimal point.
            keyboardType="decimal-pad"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
        </View>

        {/* Unit selector — tapping opens the Alert picker */}
        <View className="mb-4">
          <Text className="text-xs font-medium text-gray-500 mb-1">Unit</Text>
          <TouchableOpacity
            onPress={showUnitPicker}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
          >
            <Text className="text-gray-900">
              {editUnit.charAt(0).toUpperCase() + editUnit.slice(1)}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Low-stock threshold input */}
        <View className="mb-5">
          <Text className="text-xs font-medium text-gray-500 mb-1">
            Warn me when below
          </Text>
          <TextInput
            value={editThreshold}
            onChangeText={setEditThreshold}
            placeholder="e.g., 7"
            placeholderTextColor="#D1D5DB"
            keyboardType="decimal-pad"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
          <Text className="text-xs text-gray-400 mt-1">
            Default is 7 — roughly one week's supply
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSaveEdit}
          className="bg-blue-600 rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold">Save</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Refill form ──────────────────────────────────────────────────────────
  if (mode === "refilling") {
    return (
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Record Refill
          </Text>
          <TouchableOpacity onPress={() => setMode("view")}>
            <Text className="text-sm text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-sm text-gray-500 mb-3">
          How many {inventory?.unit ?? "units"} did you get?
        </Text>

        <TextInput
          value={refillQty}
          onChangeText={setRefillQty}
          placeholder="e.g., 90"
          placeholderTextColor="#D1D5DB"
          keyboardType="decimal-pad"
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-5"
          // autoFocus opens the keyboard immediately so the user can type right away.
          autoFocus
        />

        <TouchableOpacity
          onPress={handleSaveRefill}
          className="bg-blue-600 rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold">Save Refill</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── View mode ────────────────────────────────────────────────────────────
  // Shows the current inventory status with Edit and Record Refill buttons.
  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Inventory
        </Text>
        <TouchableOpacity onPress={enterEditMode}>
          <Text className="text-sm text-blue-600">Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Current stock — large number for quick reading */}
      <View className="flex-row items-end gap-2 mb-3">
        <Text className="text-3xl font-bold text-gray-900">
          {inventory!.quantity_on_hand % 1 === 0
            ? inventory!.quantity_on_hand.toString()
            : inventory!.quantity_on_hand.toFixed(1)}
        </Text>
        <Text className="text-base text-gray-500 mb-1">
          {inventory!.unit}s remaining
        </Text>
      </View>

      {/* Low-stock warning banner */}
      {isLowStock && (
        <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          <Ionicons name="warning-outline" size={16} color="#D97706" />
          <Text className="text-sm text-amber-700 font-medium">
            Running low — refill soon
          </Text>
        </View>
      )}

      {/* Threshold and last refill info */}
      <View className="gap-1 mb-4">
        <Text className="text-xs text-gray-400">
          Alert when below {inventory!.low_stock_threshold} {inventory!.unit}s
        </Text>
        {inventory!.last_refill_date ? (
          <Text className="text-xs text-gray-400">
            Last refill:{" "}
            {new Date(inventory!.last_refill_date).toLocaleDateString()}
          </Text>
        ) : (
          <Text className="text-xs text-gray-400">No refill recorded yet</Text>
        )}
      </View>

      {/* Record Refill button */}
      <TouchableOpacity
        onPress={enterRefillMode}
        className="border border-blue-200 rounded-xl py-3 items-center"
      >
        <Text className="text-blue-600 font-semibold text-sm">Record Refill</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── DetailRow ──────────────────────────────────────────────────────────────
// A reusable row for displaying a label-value pair with an icon.
interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View className="flex-row items-start gap-3 py-3 border-t border-gray-50">
      <Ionicons name={icon as never} size={18} color="#9CA3AF" style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-xs text-gray-400 mb-0.5">{label}</Text>
        <Text className="text-sm text-gray-700">{value}</Text>
      </View>
    </View>
  );
}
