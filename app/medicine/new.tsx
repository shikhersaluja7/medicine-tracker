// app/medicine/new.tsx — The "Add Medicine" form screen.
//
// This screen lets the user add a new medicine two ways:
//   1. Manual entry — type in the name, dosage, and other details by hand.
//   2. Scan a label — take a photo or pick one from the library, and the AI
//      (Claude) reads the prescription label and fills in the form for you.
//
// Either way, the user always reviews the fields before tapping Save.
// The scan feature NEVER auto-saves — it only pre-fills the form.
//
// When the user taps "Save":
//   1. We validate that required fields are filled in.
//   2. We call addMedicine() from the service layer to INSERT into SQLite.
//   3. We navigate back to the medicines list with router.back().

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
import { router } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { db } from "@/db/client";
import { addMedicine } from "@/services/medicine.service";
import {
  scanPrescription,
  NetworkError,
  APIError,
  ParseError,
} from "@/services/ocr.service";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function NewMedicineScreen() {
  const { user } = useAuth();

  // Form field state — one useState per field so each can be updated independently.
  // These start empty and are filled as the user types, or pre-filled by OCR.
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [doctor, setDoctor] = useState("");

  // isSaving: prevents double-saves if the user taps Save twice quickly.
  const [isSaving, setIsSaving] = useState(false);

  // isScanning: true while we are waiting for the Claude API to respond.
  // A full-screen overlay is shown so the user knows the app is working.
  const [isScanning, setIsScanning] = useState(false);

  // handleSave: validates the form and writes to the database.
  function handleSave() {
    // Trim removes spaces from the start and end.
    // e.g., "  Lisinopril  " → "Lisinopril"
    const trimmedName = name.trim();
    const trimmedDosage = dosage.trim();

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
        instructions: instructions.trim() || undefined,
        doctor: doctor.trim() || undefined,
      });

      router.back();
    } catch (error) {
      Alert.alert("Save Failed", "Something went wrong. Please try again.");
      setIsSaving(false);
    }
  }

  // handleScan: asks the user whether to use the camera or photo library,
  // then kicks off the OCR pipeline.
  //
  // Think of this like handing a prescription to a pharmacist who types it
  // into the computer for you — you still review and confirm before anything is saved.
  async function handleScan() {
    Alert.alert(
      "Scan Prescription Label",
      "Choose how to get the photo",
      [
        {
          text: "Take Photo",
          onPress: () => pickAndScan("camera"),
        },
        {
          text: "Choose from Library",
          onPress: () => pickAndScan("library"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }

  // pickAndScan: requests the necessary permission, opens the picker, converts
  // the image to base64, and sends it to the Claude API for OCR extraction.
  async function pickAndScan(source: "camera" | "library") {
    // Request permission before accessing the camera or photo library.
    // iOS requires this; Android requires it for the photo library.
    // We explain WHY we need access so the user understands and accepts.
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission Needed",
          "Please allow camera access in your device settings so you can photograph the prescription label."
        );
        return;
      }
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photo Library Permission Needed",
          "Please allow photo library access in your device settings so you can select a prescription photo."
        );
        return;
      }
    }

    // Open the camera or photo library.
    // base64: true — we need the image as a base64 string to send to the API.
    //   Base64 is like translating a photo into a very long string of letters
    //   and numbers so it can travel over the internet as plain text.
    // quality: 0.7 — slightly compressed to reduce data size without losing readability.
    // allowsEditing: true — lets the user crop the image to the label area.
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            base64: true,
            quality: 0.7,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            base64: true,
            quality: 0.7,
            allowsEditing: true,
            mediaTypes: "images",
          });

    // The user tapped Cancel in the picker — nothing to do.
    if (result.canceled) return;

    const asset = result.assets[0];

    if (!asset.base64) {
      Alert.alert("Image Error", "Could not read the image. Please try again.");
      return;
    }

    // Detect whether the image is PNG or JPEG from the file URI extension.
    // Claude needs to know the format to decode the base64 correctly.
    // e.g., "file:///var/mobile/photo.png" → "image/png"
    const mimeType = asset.uri.toLowerCase().endsWith(".png")
      ? ("image/png" as const)
      : ("image/jpeg" as const);

    // Show the scanning overlay and send the image to Claude.
    setIsScanning(true);
    try {
      const extracted = await scanPrescription(asset.base64, mimeType);

      // Pre-fill form fields with whatever Claude extracted.
      // Only overwrite a field if Claude found something — we don't want to
      // blank out text the user may have already typed in manually.
      if (extracted.name) setName(extracted.name);
      if (extracted.dosage) setDosage(extracted.dosage);
      if (extracted.instructions) setInstructions(extracted.instructions);
      if (extracted.doctor) setDoctor(extracted.doctor);
    } catch (error) {
      // Each error type gets a different, spec-defined user-facing message.
      if (error instanceof NetworkError) {
        Alert.alert(
          "No Connection",
          "Could not connect. Check your internet and try again."
        );
      } else if (error instanceof APIError) {
        Alert.alert(
          "Scan Failed",
          "Could not read the label. Try a clearer photo or enter details manually."
        );
      } else if (error instanceof ParseError) {
        Alert.alert(
          "Label Not Found",
          "Could not find medicine details in this image. Try a clearer photo or enter details manually."
        );
      } else {
        Alert.alert(
          "Scan Failed",
          "Something went wrong. Please try again or enter details manually."
        );
      }
    } finally {
      // Always hide the scanning overlay, even if an error occurred.
      setIsScanning(false);
    }
  }

  return (
    // KeyboardAvoidingView slides the form up when the keyboard appears,
    // preventing it from covering the input fields the user is typing in.
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >

      {/* ── Header ── */}
      <View className="flex-row items-center px-5 pt-14 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 flex-1">Add Medicine</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`bg-blue-600 rounded-xl px-4 py-2 ${isSaving ? "opacity-50" : ""}`}
        >
          <Text className="text-white font-semibold">Save</Text>
        </TouchableOpacity>
      </View>

      {/* ── Form ── */}
      {/* ScrollView lets the form scroll if it's taller than the screen */}
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-5 pt-6 pb-8 gap-5">

          {/* ── Scan Prescription Label button ── */}
          {/* Tapping this starts the camera/library picker and OCR pipeline. */}
          <TouchableOpacity
            onPress={handleScan}
            disabled={isScanning}
            className={`bg-blue-50 border border-blue-200 rounded-2xl p-4 flex-row items-center gap-3 ${
              isScanning ? "opacity-50" : ""
            }`}
          >
            <Ionicons name="camera-outline" size={22} color="#3B82F6" />
            <View className="flex-1">
              <Text className="text-sm font-medium text-blue-700">
                Scan Prescription Label
              </Text>
              <Text className="text-xs text-blue-500 mt-0.5">
                AI reads the label and fills in the form for you
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#93C5FD" />
          </TouchableOpacity>

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

      {/* ── Scanning overlay ── */}
      {/* A semi-transparent dark sheet covers the whole screen while Claude is
          processing the image. This prevents the user from tapping other buttons
          mid-scan and makes it clear the app is busy working.
          Like a "Please wait" sign on a door — don't come in just yet! */}
      {isScanning && (
        <View className="absolute inset-0 bg-black/60 items-center justify-center">
          <View className="bg-white rounded-2xl px-8 py-6 items-center gap-3 mx-8">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-900 font-semibold text-base">
              Scanning prescription...
            </Text>
            <Text className="text-gray-500 text-sm text-center">
              AI is reading the label. This takes a few seconds.
            </Text>
          </View>
        </View>
      )}

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
        placeholderTextColor="#D1D5DB"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        className={`bg-white rounded-xl border border-gray-200 px-4 py-3 text-gray-900 text-base ${
          multiline ? "min-h-[80px]" : ""
        }`}
        // textAlignVertical="top" keeps the cursor at the top of multiline inputs on Android.
        textAlignVertical={multiline ? "top" : "center"}
      />

      {hint && <Text className="text-xs text-gray-400 mt-1">{hint}</Text>}
    </View>
  );
}
