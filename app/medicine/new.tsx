// app/medicine/new.tsx — The "Add Medicine" form screen.
//
// This screen lets the user manually type in the details of a new medicine.
// Phase 5 will add a "Scan Label" button here that uses the camera + AI OCR
// to pre-fill these fields from a photo of the prescription label.
//
// When the user taps "Save":
//   1. We validate that required fields are filled in
//   2. We call addMedicine() from the service layer to INSERT into SQLite
//   3. We navigate back to the medicines list with router.back()
//
// Why router.back() instead of router.push('/medicines')?
// router.back() pops the current screen off the stack and returns to the previous
// one — it's the correct way to "finish" a form screen.
// router.push() would ADD a new medicines screen on top, creating duplicates.

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { db } from "@/db/client";
import { addMedicine } from "@/services/medicine.service";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function NewMedicineScreen() {
  const { user } = useAuth();

  // Form field state — one useState per field so each can be updated independently.
  // These start as empty strings and are filled as the user types.
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [doctor, setDoctor] = useState("");

  // isSaving: prevents double-saves if the user taps Save twice quickly.
  const [isSaving, setIsSaving] = useState(false);

  // handleSave: validates the form and writes to the database.
  function handleSave() {
    // Trim removes spaces from the start and end.
    // e.g., "  Lisinopril  " → "Lisinopril"
    const trimmedName = name.trim();
    const trimmedDosage = dosage.trim();

    // Simple validation — name and dosage are required.
    // We don't need a complex validation library for two required fields.
    if (!trimmedName) {
      Alert.alert("Missing Field", "Please enter the medicine name.");
      return;
    }
    if (!trimmedDosage) {
      Alert.alert("Missing Field", "Please enter the dosage (e.g., 10mg).");
      return;
    }

    // Guard against double-saves
    if (isSaving || !user) return;
    setIsSaving(true);

    try {
      // addMedicine writes a new row to the medicines table in SQLite.
      // user.sub is the Auth0 user ID — scopes this medicine to the logged-in user.
      addMedicine(db, user.sub, {
        name: trimmedName,
        dosage: trimmedDosage,
        // Use undefined (not empty string) for optional fields that were left blank.
        // The service converts undefined → null for SQLite storage.
        instructions: instructions.trim() || undefined,
        doctor: doctor.trim() || undefined,
      });

      // Navigate back to the medicines list after a successful save.
      // The list will show the new medicine on its next render / refetch.
      router.back();
    } catch (error) {
      Alert.alert("Save Failed", "Something went wrong. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    // KeyboardAvoidingView slides the form up when the keyboard appears,
    // preventing the keyboard from covering the input fields.
    // behavior="padding" adds padding at the bottom equal to the keyboard height.
    // On Android the OS handles this automatically; on iOS we need this component.
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >

      {/* ── Header ── */}
      <View className="flex-row items-center px-5 pt-14 pb-4 bg-white border-b border-gray-100">
        {/* Back button — same effect as a swipe-back gesture */}
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1">Add Medicine</Text>
        {/* Save button in the header — common iOS pattern for forms */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`bg-blue-600 rounded-xl px-4 py-2 ${isSaving ? "opacity-50" : ""}`}
        >
          <Text className="text-white font-semibold">Save</Text>
        </TouchableOpacity>
      </View>

      {/* ── Form fields ── */}
      {/* ScrollView lets the form scroll if it's taller than the screen */}
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-5 pt-6 pb-8 gap-5">

          {/* Phase 5 preview: camera scan button (disabled for now) */}
          <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex-row items-center gap-3">
            <Ionicons name="camera-outline" size={22} color="#3B82F6" />
            <View className="flex-1">
              <Text className="text-sm font-medium text-blue-700">Scan Prescription Label</Text>
              <Text className="text-xs text-blue-500 mt-0.5">Coming in Phase 5 — AI will fill this form from a photo</Text>
            </View>
          </View>

          {/* ── Medicine Name (required) ── */}
          <FormField
            label="Medicine Name"
            required
            placeholder="e.g., Lisinopril, Aspirin, Metformin"
            value={name}
            onChangeText={setName}
          />

          {/* ── Dosage (required) ── */}
          <FormField
            label="Dosage"
            required
            placeholder="e.g., 10mg, 500mg, 2 puffs"
            value={dosage}
            onChangeText={setDosage}
          />

          {/* ── Instructions (optional) ── */}
          <FormField
            label="Instructions"
            placeholder="e.g., Take with food, before bedtime"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            hint="Optional — any notes about how to take this medicine"
          />

          {/* ── Doctor (optional) ── */}
          <FormField
            label="Prescribing Doctor"
            placeholder="e.g., Dr. Smith"
            value={doctor}
            onChangeText={setDoctor}
            hint="Optional"
          />

          {/* Large save button at the bottom of the form */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className={`bg-blue-600 rounded-2xl py-4 items-center mt-2 ${isSaving ? "opacity-50" : ""}`}
          >
            <Text className="text-white font-semibold text-base">
              {isSaving ? "Saving..." : "Save Medicine"}
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── FormField component ────────────────────────────────────────────────────
// A reusable form field with a label, text input, and optional hint text.
// Defined here (not in a separate file) because it's only used on this screen.
interface FormFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  required?: boolean;  // Shows a red * next to the label
  multiline?: boolean; // Allows multiple lines of text (for instructions)
  hint?: string;       // Small grey text below the input
}

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  required,
  multiline,
  hint,
}: FormFieldProps) {
  return (
    <View>
      {/* Label row: "Medicine Name *" */}
      <View className="flex-row items-center mb-2">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        {/* Red asterisk marks required fields — a universal form convention */}
        {required && <Text className="text-red-500 ml-1">*</Text>}
      </View>

      {/* TextInput is React Native's text input component (like <input> on the web) */}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#D1D5DB" // Tailwind gray-300 — subtle placeholder colour
        multiline={multiline}
        // numberOfLines only applies to Android for multiline inputs
        numberOfLines={multiline ? 3 : 1}
        className={`bg-white rounded-xl border border-gray-200 px-4 py-3 text-gray-900 text-base ${
          multiline ? "min-h-[80px]" : ""
        }`}
        // textAlignVertical="top" keeps the cursor at the top of multiline inputs on Android.
        // Without this, Android centres the cursor vertically, which looks odd.
        textAlignVertical={multiline ? "top" : "center"}
      />

      {/* Optional hint text below the input */}
      {hint && <Text className="text-xs text-gray-400 mt-1">{hint}</Text>}
    </View>
  );
}
