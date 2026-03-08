// app/medicine/[id]-edit.tsx — Edit form for an existing medicine.
//
// This screen is almost identical to new.tsx but:
//   1. It loads the existing medicine data first and pre-fills the form fields
//   2. It calls updateMedicine() instead of addMedicine() on save
//   3. Changes take effect in the database immediately on Save
//
// Navigation flow:
//   Medicines list → tap card → detail screen → tap edit icon → this screen
//   This screen → tap Save → back to detail screen (which reloads with new data)
//
// Why pre-fill? Good UX: users should only need to change what's different.
// If someone wants to update just the dosage from "10mg" to "20mg", they
// shouldn't have to re-type all the other fields.

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { db } from "@/db/client";
import { getMedicineById, updateMedicine } from "@/services/medicine.service";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import type { Medicine } from "@/db/schema";

export default function EditMedicineScreen() {
  const { user } = useAuth();

  // The URL for the edit screen looks like: /medicine/k7x2mq-abc-edit
  // useLocalSearchParams gives us { id: "k7x2mq-abc-edit" }
  // We strip "-edit" from the end to get the real medicine ID.
  const params = useLocalSearchParams<{ id: string }>();
  // e.g., "k7x2mq-abc-edit" → "k7x2mq-abc"
  const id = params.id?.replace(/-edit$/, "") ?? "";

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state — starts empty, filled once medicine is loaded from DB
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [doctor, setDoctor] = useState("");

  // Load the existing medicine on first render and pre-fill the form.
  useEffect(() => {
    if (!user || !id) return;

    const found = getMedicineById(db, id, user.sub);
    if (found) {
      setMedicine(found);
      // Pre-fill form fields with the current medicine data.
      // null ?? "" converts null database values to empty strings for the TextInput.
      setName(found.name);
      setDosage(found.dosage);
      setInstructions(found.instructions ?? "");
      setDoctor(found.doctor ?? "");
    }
    setIsLoading(false);
  }, [id, user]);

  function handleSave() {
    const trimmedName = name.trim();
    const trimmedDosage = dosage.trim();

    if (!trimmedName) {
      Alert.alert("Missing Field", "Please enter the medicine name.");
      return;
    }
    if (!trimmedDosage) {
      Alert.alert("Missing Field", "Please enter the dosage.");
      return;
    }

    if (isSaving || !user || !id) return;
    setIsSaving(true);

    try {
      // updateMedicine only updates fields that are passed in.
      // We always pass all fields here since the user may have changed any of them.
      // The service builds a dynamic SQL SET clause from whatever is provided.
      updateMedicine(db, id, user.sub, {
        name: trimmedName,
        dosage: trimmedDosage,
        // Empty string → undefined so the service stores null in SQLite (not "")
        instructions: instructions.trim() || undefined,
        doctor: doctor.trim() || undefined,
      });

      // Go back to the detail screen which will reload the updated medicine.
      router.back();
    } catch {
      Alert.alert("Save Failed", "Something went wrong. Please try again.");
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!medicine) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Text className="text-lg text-gray-500">Medicine not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-600">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >

      {/* ── Header ── */}
      <View className="flex-row items-center px-5 pt-14 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>
          Edit {medicine.name}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`bg-blue-600 rounded-xl px-4 py-2 ${isSaving ? "opacity-50" : ""}`}
        >
          <Text className="text-white font-semibold">{isSaving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-5 pt-6 pb-8 gap-5">

          {/* ── Form fields (pre-filled from database) ── */}
          <EditFormField
            label="Medicine Name"
            required
            placeholder="e.g., Lisinopril"
            value={name}
            onChangeText={setName}
          />

          <EditFormField
            label="Dosage"
            required
            placeholder="e.g., 10mg"
            value={dosage}
            onChangeText={setDosage}
          />

          <EditFormField
            label="Instructions"
            placeholder="e.g., Take with food"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            hint="Optional"
          />

          <EditFormField
            label="Prescribing Doctor"
            placeholder="e.g., Dr. Smith"
            value={doctor}
            onChangeText={setDoctor}
            hint="Optional"
          />

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className={`bg-blue-600 rounded-2xl py-4 items-center mt-2 ${isSaving ? "opacity-50" : ""}`}
          >
            <Text className="text-white font-semibold text-base">
              {isSaving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── EditFormField ────────────────────────────────────────────────────────────
// Same as FormField in new.tsx — a labelled text input.
// Duplicated here to keep each screen self-contained (avoids coupling screens together).
interface EditFormFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
}

function EditFormField({ label, placeholder, value, onChangeText, required, multiline, hint }: EditFormFieldProps) {
  return (
    <View>
      <View className="flex-row items-center mb-2">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        {required && <Text className="text-red-500 ml-1">*</Text>}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#D1D5DB"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        className={`bg-white rounded-xl border border-gray-200 px-4 py-3 text-gray-900 text-base ${multiline ? "min-h-[80px]" : ""}`}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {hint && <Text className="text-xs text-gray-400 mt-1">{hint}</Text>}
    </View>
  );
}
