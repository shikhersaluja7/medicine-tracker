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
//   - A "Schedule" section → define how often and when to take the medicine

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
import { useSchedule } from "@/hooks/useSchedule";
import { useAuth } from "@/auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import type { Medicine, Inventory, Schedule } from "@/db/schema";
import type { Frequency, UpsertScheduleInput } from "@/services/schedule.service";

// The four unit options for inventory tracking, ordered most → least common.
const UNITS = ["tablet", "capsule", "ml", "patch"] as const;

// The seven days of the week used in weekly and custom schedules.
const DAYS = [
  { key: "mon", label: "Mo" },
  { key: "tue", label: "Tu" },
  { key: "wed", label: "We" },
  { key: "thu", label: "Th" },
  { key: "fri", label: "Fr" },
  { key: "sat", label: "Sa" },
  { key: "sun", label: "Su" },
] as const;

// Regex to validate that a time string is in HH:MM format (24-hour clock).
// Valid:   "08:00", "14:30", "23:59"
// Invalid: "8:00" (missing leading zero), "24:00", "abc"
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Converts a 24-hour HH:MM string to a 12-hour readable format.
// e.g., "08:00" → "8:00 AM",  "20:00" → "8:00 PM",  "13:30" → "1:30 PM"
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12; // 0 becomes 12 (midnight), 12 stays 12 (noon)
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

// Converts an array of day keys to a readable string, sorted in week order.
// e.g., ["fri", "mon", "wed"] → "Mon, Wed, Fri"
function formatDays(days: string[]): string {
  const labels: Record<string, string> = {
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
    fri: "Fri", sat: "Sat", sun: "Sun",
  };
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return [...days]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((d) => labels[d] ?? d)
    .join(", ");
}

// Returns a plain-English summary of a schedule for the view mode card.
// e.g., "Twice daily at 8:00 AM and 8:00 PM"
//       "Custom — 3× daily at 8:00 AM, 1:00 PM, 8:00 PM"
//       "Weekly — Mon, Wed, Fri at 8:00 AM"
function formatScheduleSummary(
  frequency: string,
  times: string[],
  days: string[] | null
): string {
  const timesStr = times.map(formatTime).join(", ");
  const daysStr = days ? formatDays(days) : "every day";

  switch (frequency) {
    case "daily":
      return `Once daily at ${timesStr}`;
    case "twice_daily":
      return `Twice daily at ${timesStr}`;
    case "weekly":
      return `Weekly — ${daysStr} at ${timesStr}`;
    case "as_needed":
      return "As needed — no fixed schedule";
    case "custom": {
      const count = times.length;
      const daysPart = days ? ` — ${daysStr}` : "";
      return `${count}× daily${daysPart} at ${timesStr}`;
    }
    default:
      return "Custom schedule";
  }
}

// Parses the JSON times_of_day field from a Schedule row.
// The database stores '["08:00","20:00"]'; this returns ["08:00", "20:00"].
function parseTimes(schedule: Schedule): string[] {
  try {
    const parsed = JSON.parse(schedule.times_of_day) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

// Parses the JSON days_of_week field from a Schedule row.
// Returns null if the schedule applies every day.
function parseDays(schedule: Schedule): string[] | null {
  if (!schedule.days_of_week) return null;
  try {
    const parsed = JSON.parse(schedule.days_of_week) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MedicineDetailScreen() {
  const { user } = useAuth();

  // useLocalSearchParams reads the URL parameters for this screen.
  // For the URL /medicine/k7x2mq-abc, this returns { id: "k7x2mq-abc" }
  const { id } = useLocalSearchParams<{ id: string }>();

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // useInventory provides inventory state and mutation functions.
  const {
    inventory,
    isLoading: isInventoryLoading,
    upsert: upsertInventory,
    recordRefill,
  } = useInventory(id ?? "");

  // useSchedule provides schedule state and mutation functions.
  const {
    schedule,
    isLoading: isScheduleLoading,
    upsert: upsertSchedule,
    deactivate: deactivateSchedule,
  } = useSchedule(id ?? "");

  // Fetch the medicine details from the database when the screen loads.
  useEffect(() => {
    if (!user || !id) return;
    const found = getMedicineById(db, id, user.sub);
    setMedicine(found);
    setIsLoading(false);
  }, [id, user]);

  // handleArchive: confirms then soft-deletes the medicine.
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
          <View className="flex-row items-start justify-between mb-4">
            <Text className="text-2xl font-bold text-gray-900 flex-1 mr-3">
              {medicine.name}
            </Text>
            <View className="bg-blue-100 rounded-full px-4 py-1.5">
              <Text className="text-sm font-semibold text-blue-700">{medicine.dosage}</Text>
            </View>
          </View>

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
          <DetailRow
            icon="calendar-outline"
            label="Added on"
            value={new Date(medicine.created_at).toLocaleDateString()}
          />
        </View>

        {/* ── Inventory section ── */}
        {isInventoryLoading ? (
          <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 items-center">
            <ActivityIndicator size="small" color="#9CA3AF" />
          </View>
        ) : (
          <InventorySection
            inventory={inventory}
            onUpsert={upsertInventory}
            onRecordRefill={recordRefill}
          />
        )}

        {/* ── Schedule section ── */}
        {isScheduleLoading ? (
          <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 items-center">
            <ActivityIndicator size="small" color="#9CA3AF" />
          </View>
        ) : (
          <ScheduleSection
            schedule={schedule}
            onUpsert={upsertSchedule}
            onDeactivate={deactivateSchedule}
          />
        )}

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

// ─── ScheduleSection ──────────────────────────────────────────────────────────
// Renders the schedule card in one of two modes:
//   "view"    — shows a plain-English summary of the current schedule,
//               or a "Set Up Schedule" prompt if none exists
//   "editing" — inline form to choose frequency, times, and days

interface ScheduleSectionProps {
  schedule: Schedule | null;
  onUpsert: (input: UpsertScheduleInput) => void;
  onDeactivate: () => void;
}

function ScheduleSection({ schedule, onUpsert, onDeactivate }: ScheduleSectionProps) {
  const [mode, setMode] = useState<"view" | "editing">("view");

  // ── Edit form state ──
  const [freq, setFreq] = useState<Frequency>("daily");
  // times: array of HH:MM strings, one per dose per day.
  const [times, setTimes] = useState<string[]>(["08:00"]);
  // selectedDays: null = every day; string[] = specific days of the week.
  const [selectedDays, setSelectedDays] = useState<string[] | null>(null);
  // useSpecificDays: toggle for custom frequency — off = every day, on = pick days.
  const [useSpecificDays, setUseSpecificDays] = useState(false);

  // enterEditMode: pre-fills the form from the existing schedule before showing it.
  function enterEditMode() {
    const currentFreq = (schedule?.frequency ?? "daily") as Frequency;
    const currentTimes = schedule ? parseTimes(schedule) : ["08:00"];
    const currentDays = schedule ? parseDays(schedule) : null;

    setFreq(currentFreq);
    setTimes(currentTimes.length > 0 ? currentTimes : ["08:00"]);
    setSelectedDays(currentDays);
    setUseSpecificDays(currentDays !== null);
    setMode("editing");
  }

  // handleFreqChange: called when the user picks a different frequency option.
  // Pre-sets sensible defaults for each frequency so the form is ready to save
  // with minimal editing — like choosing a preset on an alarm clock.
  function handleFreqChange(newFreq: Frequency) {
    setFreq(newFreq);
    switch (newFreq) {
      case "daily":
        // One dose a day at 8 AM — the most common default.
        setTimes(["08:00"]);
        setSelectedDays(null);
        setUseSpecificDays(false);
        break;
      case "twice_daily":
        // Morning and evening — another very common preset.
        setTimes(["08:00", "20:00"]);
        setSelectedDays(null);
        setUseSpecificDays(false);
        break;
      case "weekly":
        // Keep the current first time, or default to 8 AM.
        // Days become required — default to Monday if nothing is selected.
        setTimes(times.length > 0 ? [times[0]] : ["08:00"]);
        setSelectedDays(selectedDays && selectedDays.length > 0 ? selectedDays : ["mon"]);
        setUseSpecificDays(true);
        break;
      case "as_needed":
        // No fixed times or days.
        setTimes([]);
        setSelectedDays(null);
        setUseSpecificDays(false);
        break;
      case "custom":
        // Keep whatever times and day settings were already there.
        if (times.length === 0) setTimes(["08:00"]);
        // useSpecificDays stays as-is so the user's previous choice is preserved.
        break;
    }
  }

  // addTime: appends a new time slot to the list.
  // Suggests a sensible next time based on the last entry (last time + 4 hours).
  // e.g., if the last time is "08:00", the new default is "12:00".
  function addTime() {
    const last = times[times.length - 1];
    if (last) {
      const [h, m] = last.split(":").map(Number);
      const nextH = (h + 4) % 24;
      const nextTime = `${nextH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      setTimes([...times, nextTime]);
    } else {
      setTimes(["08:00"]);
    }
  }

  // removeTime: removes the time at a given position in the list.
  function removeTime(index: number) {
    setTimes(times.filter((_, i) => i !== index));
  }

  // updateTime: replaces the time at a given index with a new value.
  function updateTime(index: number, value: string) {
    const updated = [...times];
    updated[index] = value;
    setTimes(updated);
  }

  // toggleDay: adds or removes a day from the selected days list.
  function toggleDay(dayKey: string) {
    const current = selectedDays ?? [];
    if (current.includes(dayKey)) {
      const next = current.filter((d) => d !== dayKey);
      // If the user deselects all days on a weekly schedule, keep at least one.
      setSelectedDays(next.length === 0 ? [dayKey] : next);
    } else {
      setSelectedDays([...current, dayKey]);
    }
  }

  // handleSave: validates and saves the schedule.
  function handleSave() {
    // Validate all time strings match HH:MM format.
    if (freq !== "as_needed") {
      if (times.length === 0) {
        Alert.alert("Add a Time", "Please add at least one dose time.");
        return;
      }
      const invalid = times.filter((t) => !TIME_RE.test(t));
      if (invalid.length > 0) {
        Alert.alert(
          "Invalid Time",
          `Please enter times in HH:MM format using a 24-hour clock.\n\nExamples: 08:00, 14:30, 20:00\n\nInvalid: ${invalid.join(", ")}`
        );
        return;
      }
    }

    // Weekly requires at least one day selected.
    if (freq === "weekly" && (!selectedDays || selectedDays.length === 0)) {
      Alert.alert("Choose Days", "Please select at least one day of the week.");
      return;
    }

    // For custom with specific days, at least one day must be selected.
    if (freq === "custom" && useSpecificDays && (!selectedDays || selectedDays.length === 0)) {
      Alert.alert("Choose Days", "Please select at least one day, or switch to every day.");
      return;
    }

    // Determine the days to save: null means every day.
    const daysToSave: string[] | null =
      freq === "weekly"
        ? selectedDays
        : freq === "custom" && useSpecificDays
        ? selectedDays
        : null;

    onUpsert({
      frequency: freq,
      timesOfDay: freq === "as_needed" ? [] : times,
      daysOfWeek: daysToSave,
    });
    setMode("view");
  }

  // handleDeactivate: confirms then turns off the schedule.
  function handleDeactivate() {
    Alert.alert(
      "Deactivate Schedule",
      "This turns off the schedule for this medicine. You can set it up again any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: () => {
            onDeactivate();
            setMode("view");
          },
        },
      ]
    );
  }

  // ── No schedule yet — view mode ───────────────────────────────────────────
  if (!schedule && mode === "view") {
    return (
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Schedule
        </Text>
        <Text className="text-sm text-gray-500 mb-4">
          Set a schedule so you always know when to take this medicine.
        </Text>
        <TouchableOpacity
          onPress={enterEditMode}
          className="bg-blue-600 rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold text-sm">Set Up Schedule</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Edit form ─────────────────────────────────────────────────────────────
  if (mode === "editing") {
    // Whether to show the days-of-week picker.
    // Always shown for weekly. Shown for custom only when useSpecificDays is on.
    const showDayPicker = freq === "weekly" || (freq === "custom" && useSpecificDays);
    // Whether to show the time inputs section.
    const showTimes = freq !== "as_needed";
    // Whether the user can add/remove time slots (only true for custom).
    const canEditTimeCount = freq === "custom";

    return (
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Schedule
          </Text>
          <TouchableOpacity onPress={() => setMode("view")}>
            <Text className="text-sm text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* ── Frequency selector ── */}
        {/* A vertical list of 5 radio-style options — tap one to select it. */}
        <Text className="text-xs font-medium text-gray-500 mb-2">How often?</Text>
        <View className="border border-gray-100 rounded-xl overflow-hidden mb-4">
          {(
            [
              { value: "daily",       label: "Once daily",   subtitle: "One dose per day" },
              { value: "twice_daily", label: "Twice daily",  subtitle: "Morning and evening" },
              { value: "weekly",      label: "Weekly",       subtitle: "Specific days of the week" },
              { value: "as_needed",   label: "As needed",    subtitle: "No fixed time — take when required" },
              { value: "custom",      label: "Custom",       subtitle: "Any number of doses, any days" },
            ] as const
          ).map((option, index) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => handleFreqChange(option.value)}
              className={`flex-row items-center px-4 py-3 gap-3 ${
                index > 0 ? "border-t border-gray-50" : ""
              } ${freq === option.value ? "bg-blue-50" : ""}`}
            >
              {/* Radio button circle — filled when selected */}
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  freq === option.value
                    ? "border-blue-600 bg-blue-600"
                    : "border-gray-300"
                }`}
              >
                {freq === option.value && (
                  <View className="w-2 h-2 rounded-full bg-white" />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className={`text-sm font-medium ${
                    freq === option.value ? "text-blue-700" : "text-gray-800"
                  }`}
                >
                  {option.label}
                </Text>
                <Text className="text-xs text-gray-400">{option.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Every day vs. specific days toggle (custom only) ── */}
        {/* Weekly always shows the day picker, so no toggle needed there. */}
        {freq === "custom" && (
          <View className="flex-row mb-4 gap-2">
            <TouchableOpacity
              onPress={() => { setUseSpecificDays(false); setSelectedDays(null); }}
              className={`flex-1 py-2 rounded-xl items-center border ${
                !useSpecificDays
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  !useSpecificDays ? "text-white" : "text-gray-600"
                }`}
              >
                Every day
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setUseSpecificDays(true);
                if (!selectedDays || selectedDays.length === 0) {
                  setSelectedDays(["mon"]);
                }
              }}
              className={`flex-1 py-2 rounded-xl items-center border ${
                useSpecificDays
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  useSpecificDays ? "text-white" : "text-gray-600"
                }`}
              >
                Specific days
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Day of week picker ── */}
        {/* Seven circular toggle buttons (Mo Tu We Th Fr Sa Su).
            Tap a day to add it; tap again to remove it. */}
        {showDayPicker && (
          <View className="mb-4">
            <Text className="text-xs font-medium text-gray-500 mb-2">
              {freq === "weekly" ? "Which days?" : "Which days?"}
            </Text>
            <View className="flex-row justify-between">
              {DAYS.map(({ key, label }) => {
                const isSelected = selectedDays?.includes(key) ?? false;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => toggleDay(key)}
                    className={`w-10 h-10 rounded-full items-center justify-center border ${
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        isSelected ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Time inputs ── */}
        {showTimes && (
          <View className="mb-5">
            <Text className="text-xs font-medium text-gray-500 mb-2">
              {freq === "custom" ? "Dose times (HH:MM, 24-hour)" : "Time (HH:MM, 24-hour)"}
            </Text>

            {times.map((t, index) => (
              <View key={index} className="flex-row items-center gap-2 mb-2">
                <TextInput
                  value={t}
                  onChangeText={(v) => updateTime(index, v)}
                  placeholder="HH:MM"
                  placeholderTextColor="#D1D5DB"
                  // number-pad for iOS, which limits to digits; user must type colon.
                  // keyboardType="numbers-and-punctuation" is more cross-platform.
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-center text-lg font-mono"
                />
                {/* Remove button — only shown for custom schedules with more than one time */}
                {canEditTimeCount && times.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeTime(index)}
                    className="w-10 h-10 rounded-full bg-red-50 border border-red-100 items-center justify-center"
                  >
                    <Ionicons name="remove" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* "Add time" button — only available for custom schedules */}
            {canEditTimeCount && (
              <TouchableOpacity
                onPress={addTime}
                className="flex-row items-center justify-center gap-2 border border-dashed border-blue-300 rounded-xl py-3 mt-1"
              >
                <Ionicons name="add-circle-outline" size={18} color="#3B82F6" />
                <Text className="text-sm text-blue-600 font-medium">Add another time</Text>
              </TouchableOpacity>
            )}

            <Text className="text-xs text-gray-400 mt-2">
              Use 24-hour format — e.g., 08:00 for 8 AM, 20:00 for 8 PM
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSave}
          className="bg-blue-600 rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold">Save Schedule</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── View mode (schedule exists) ───────────────────────────────────────────
  // Renamed to viewTimes / viewDays to avoid clashing with the `times` state
  // variable declared earlier in this same function.
  const viewTimes = parseTimes(schedule!);
  const viewDays = parseDays(schedule!);

  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Schedule
        </Text>
        <TouchableOpacity onPress={enterEditMode}>
          <Text className="text-sm text-blue-600">Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Schedule summary — a single readable sentence */}
      <View className="flex-row items-start gap-3 mb-4">
        <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center mt-0.5">
          <Ionicons name="alarm-outline" size={18} color="#3B82F6" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-800">
            {formatScheduleSummary(schedule!.frequency, viewTimes, viewDays)}
          </Text>
          {/* Show individual times as chips when there are 3 or more */}
          {viewTimes.length >= 3 && (
            <View className="flex-row flex-wrap gap-1 mt-2">
              {viewTimes.map((t, i) => (
                <View key={i} className="bg-blue-50 rounded-full px-3 py-1">
                  <Text className="text-xs text-blue-700 font-medium">{formatTime(t)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Deactivate button — styled as a soft destructive action */}
      <TouchableOpacity
        onPress={handleDeactivate}
        className="border border-gray-200 rounded-xl py-2.5 items-center"
      >
        <Text className="text-sm text-gray-500">Deactivate Schedule</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── InventorySection ────────────────────────────────────────────────────────
// Renders the inventory card. See Phase 6 for full explanation.

interface InventorySectionProps {
  inventory: Inventory | null;
  onUpsert: (input: { quantityOnHand: number; unit: string; lowStockThreshold: number }) => void;
  onRecordRefill: (newQuantity: number) => void;
}

type InventoryMode = "view" | "editing" | "refilling";

function InventorySection({ inventory, onUpsert, onRecordRefill }: InventorySectionProps) {
  const [mode, setMode] = useState<InventoryMode>("view");
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("tablet");
  const [editThreshold, setEditThreshold] = useState("7");
  const [refillQty, setRefillQty] = useState("");

  const isLowStock =
    inventory != null &&
    inventory.quantity_on_hand <= inventory.low_stock_threshold;

  function enterEditMode() {
    setEditQty(String(inventory?.quantity_on_hand ?? ""));
    setEditUnit(inventory?.unit ?? "tablet");
    setEditThreshold(String(inventory?.low_stock_threshold ?? "7"));
    setMode("editing");
  }

  function enterRefillMode() {
    setRefillQty("");
    setMode("refilling");
  }

  function handleSaveEdit() {
    const qty = parseFloat(editQty);
    const threshold = parseFloat(editThreshold);
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

  function handleSaveRefill() {
    const qty = parseFloat(refillQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a number greater than 0.");
      return;
    }
    onRecordRefill(qty);
    setMode("view");
  }

  function showUnitPicker() {
    Alert.alert(
      "Choose Unit",
      "What unit does this medicine use?",
      UNITS.map((unit) => ({
        text: unit.charAt(0).toUpperCase() + unit.slice(1),
        onPress: () => setEditUnit(unit),
      })).concat([{ text: "Cancel", onPress: () => {} }])
    );
  }

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
        <View className="mb-4">
          <Text className="text-xs font-medium text-gray-500 mb-1">Quantity on hand</Text>
          <TextInput
            value={editQty}
            onChangeText={setEditQty}
            placeholder="e.g., 28"
            placeholderTextColor="#D1D5DB"
            keyboardType="decimal-pad"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
        </View>
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
        <View className="mb-5">
          <Text className="text-xs font-medium text-gray-500 mb-1">Warn me when below</Text>
          <TextInput
            value={editThreshold}
            onChangeText={setEditThreshold}
            placeholder="e.g., 7"
            placeholderTextColor="#D1D5DB"
            keyboardType="decimal-pad"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
          <Text className="text-xs text-gray-400 mt-1">Default is 7 — roughly one week's supply</Text>
        </View>
        <TouchableOpacity onPress={handleSaveEdit} className="bg-blue-600 rounded-xl py-3 items-center">
          <Text className="text-white font-semibold">Save</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          autoFocus
        />
        <TouchableOpacity onPress={handleSaveRefill} className="bg-blue-600 rounded-xl py-3 items-center">
          <Text className="text-white font-semibold">Save Refill</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      {isLowStock && (
        <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          <Ionicons name="warning-outline" size={16} color="#D97706" />
          <Text className="text-sm text-amber-700 font-medium">Running low — refill soon</Text>
        </View>
      )}
      <View className="gap-1 mb-4">
        <Text className="text-xs text-gray-400">
          Alert when below {inventory!.low_stock_threshold} {inventory!.unit}s
        </Text>
        {inventory!.last_refill_date ? (
          <Text className="text-xs text-gray-400">
            Last refill: {new Date(inventory!.last_refill_date).toLocaleDateString()}
          </Text>
        ) : (
          <Text className="text-xs text-gray-400">No refill recorded yet</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={enterRefillMode}
        className="border border-blue-200 rounded-xl py-3 items-center"
      >
        <Text className="text-blue-600 font-semibold text-sm">Record Refill</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── DetailRow ───────────────────────────────────────────────────────────────
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
