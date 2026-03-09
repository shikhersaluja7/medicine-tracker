// app/(tabs)/dashboard.tsx — The "Today" tab: daily dose tracking hub.
//
// This is the first screen the user sees every time they open the app.
// It answers three questions at a glance:
//   1. What do I need to take today, and when?
//   2. How consistently have I been taking my medicines this week?
//   3. Do any medicines need a refill soon?
//
// Dose cards are grouped into Morning / Afternoon / Evening.
// Tapping "Take" marks the dose and decrements the stock count.
// Tapping "Skip" shows a small note field before confirming.

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { db } from "@/db/client";
import { getLowStockInventories, type LowStockItem } from "@/services/inventory.service";
import {
  generateTodaysDoses,
  getTodaysDoses,
  markTaken,
  markSkipped,
  getOverallAdherence,
  type TodaysDose,
  type AdherenceStats,
} from "@/services/intake.service";
import {
  rescheduleAllNotifications,
  cancelDoseNotification,
  checkAndNotifyLowStock,
} from "@/services/notification.service";
import { Ionicons } from "@expo/vector-icons";

// ─── Time helpers ─────────────────────────────────────────────────────────────

// Converts a 24-hour "HH:MM" string to a 12-hour readable format.
// e.g., "08:00" → "8:00 AM",  "20:00" → "8:00 PM"
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

// Groups a dose into "morning", "afternoon", or "evening" based on its hour.
//   Morning:   before noon       (0–11)
//   Afternoon: noon to 5 PM      (12–16)
//   Evening:   5 PM and later    (17–23)
type TimeOfDay = "morning" | "afternoon" | "evening";

function getTimeOfDay(hhmm: string): TimeOfDay {
  const hour = parseInt(hhmm.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useAuth();

  // doses: today's scheduled dose entries from intake_logs.
  const [doses, setDoses] = useState<TodaysDose[]>([]);

  // adherence: overall taken/total/percentage for the last 7 days (all medicines).
  const [adherence, setAdherence] = useState<AdherenceStats>({
    taken: 0,
    total: 0,
    percentage: 0,
  });

  // lowStockItems: medicines running at or below their threshold.
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  // isLoading: true on the very first load before data arrives.
  const [isLoading, setIsLoading] = useState(true);

  // hasRescheduled: tracks whether we've already re-scheduled notifications this app session.
  // Using a ref (not state) so changing it doesn't trigger a re-render.
  // Like a sticky note that says "already set all the alarms today — don't set them again."
  const hasRescheduled = useRef(false);

  // skippingLogId: the logId of the dose currently being skipped (shows inline form).
  // null means no skip is in progress.
  const [skippingLogId, setSkippingLogId] = useState<string | null>(null);

  // skipNote: the optional reason text typed into the skip form.
  const [skipNote, setSkipNote] = useState("");

  // refreshData: reads all dashboard data from SQLite and updates state.
  // Called on every screen focus AND after every Take/Skip action so the
  // UI always reflects the latest database state.
  const refreshData = useCallback(() => {
    if (!user) return;
    // Step 1: create any pending dose rows for today that don't exist yet.
    generateTodaysDoses(db, user.sub);
    // Step 2: load everything needed for the UI.
    setDoses(getTodaysDoses(db, user.sub));
    setAdherence(getOverallAdherence(db, user.sub, 7));
    setLowStockItems(getLowStockInventories(db, user.sub));
    setIsLoading(false);

    // Step 3: reschedule notifications once per app session.
    // We skip this on subsequent focus calls (e.g., switching back from another tab).
    // rescheduleAllNotifications is async, so we fire-and-forget to keep refreshData sync.
    if (!hasRescheduled.current) {
      hasRescheduled.current = true;
      rescheduleAllNotifications(db, user.sub).catch(console.error);
    }
  }, [user]);

  // Run refreshData every time this tab becomes visible.
  // Like a shop assistant who checks the shelves every time they walk in —
  // not just once at the start of their shift.
  useFocusEffect(refreshData);

  // ── Take handler ──────────────────────────────────────────────────────────
  function handleTake(dose: TodaysDose) {
    if (!user) return;
    // Record the dose as taken and decrement inventory in SQLite.
    markTaken(db, dose.logId, user.sub, dose.medicineId);

    // Cancel the scheduled reminder — no need to buzz if they already took it.
    cancelDoseNotification(db, user.sub, dose.medicineId, dose.scheduledAt).catch(
      console.error
    );

    // Check if taking this dose pushed the inventory below the low-stock threshold.
    // If so, fire a one-time low-stock alert. If stock is fine, this is a no-op.
    checkAndNotifyLowStock(db, user.sub, dose.medicineId, dose.medicineName).catch(
      console.error
    );

    refreshData();
  }

  // ── Skip handlers ─────────────────────────────────────────────────────────
  function handleSkipPress(logId: string) {
    // Open the inline skip form for this specific dose card.
    setSkippingLogId(logId);
    setSkipNote("");
  }

  function handleSkipConfirm() {
    if (!skippingLogId || !user) return;
    markSkipped(db, skippingLogId, user.sub, skipNote.trim() || undefined);
    setSkippingLogId(null);
    setSkipNote("");
    refreshData();
  }

  function handleSkipCancel() {
    setSkippingLogId(null);
    setSkipNote("");
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Group doses by time of day for the three-section layout.
  const grouped: Record<TimeOfDay, TodaysDose[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const dose of doses) {
    grouped[getTimeOfDay(dose.scheduledTime)].push(dose);
  }

  // Count doses that are still pending (not yet acted on).
  const pendingCount = doses.filter((d) => d.status === "pending").length;
  const doneCount = doses.filter(
    (d) => d.status === "taken" || d.status === "skipped"
  ).length;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="px-5 pt-14 pb-5 bg-white border-b border-gray-100">
          <Text className="text-sm text-gray-400">{greeting},</Text>
          <Text className="text-2xl font-bold text-gray-900">{firstName} 👋</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">

      {/* ── Header ── */}
      <View className="px-5 pt-14 pb-5 bg-white border-b border-gray-100">
        <Text className="text-sm text-gray-400">{greeting},</Text>
        <View className="flex-row items-end justify-between">
          <Text className="text-2xl font-bold text-gray-900">{firstName} 👋</Text>
          {/* Show today's progress as a fraction when there are doses scheduled */}
          {doses.length > 0 && (
            <Text className="text-sm text-gray-400 mb-0.5">
              {doneCount}/{doses.length} done today
            </Text>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* ── Today's Doses ── */}
        <View className="mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Today's Doses
          </Text>

          {doses.length === 0 ? (
            // Empty state: no doses scheduled for today.
            // This appears when no medicines have an active schedule set up.
            <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center">
              <Text className="text-3xl mb-2">💊</Text>
              <Text className="text-sm font-medium text-gray-600 text-center">
                No doses scheduled for today
              </Text>
              <Text className="text-xs text-gray-400 text-center mt-1 leading-4">
                Open a medicine and tap "Set Up Schedule" to add dose times.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/medicines")}
                className="mt-4 bg-blue-600 rounded-xl px-5 py-2.5"
              >
                <Text className="text-white font-semibold text-sm">Go to Medicines</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Render the three time-of-day groups.
            // A group is only shown if it has at least one dose.
            <>
              {(
                [
                  { key: "morning" as TimeOfDay, label: "Morning", icon: "sunny-outline" },
                  { key: "afternoon" as TimeOfDay, label: "Afternoon", icon: "partly-sunny-outline" },
                  { key: "evening" as TimeOfDay, label: "Evening", icon: "moon-outline" },
                ] as const
              ).map(({ key, label, icon }) => {
                const group = grouped[key];
                if (group.length === 0) return null;
                return (
                  <View key={key} className="mb-3">
                    {/* Group header with icon */}
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <Ionicons name={icon} size={13} color="#9CA3AF" />
                      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {label}
                      </Text>
                    </View>

                    {group.map((dose) => (
                      <DoseCard
                        key={dose.logId}
                        dose={dose}
                        isSkipping={skippingLogId === dose.logId}
                        skipNote={skipNote}
                        onSkipNoteChange={setSkipNote}
                        onTake={() => handleTake(dose)}
                        onSkipPress={() => handleSkipPress(dose.logId)}
                        onSkipConfirm={handleSkipConfirm}
                        onSkipCancel={handleSkipCancel}
                      />
                    ))}
                  </View>
                );
              })}

              {/* All-done celebration shown when every dose is resolved */}
              {pendingCount === 0 && doneCount > 0 && (
                <View className="bg-green-50 border border-green-100 rounded-2xl p-4 items-center mt-1">
                  <Text className="text-lg">🎉</Text>
                  <Text className="text-sm font-medium text-green-700 mt-1">
                    All done for today!
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── This Week adherence ── */}
        {adherence.total > 0 && (
          <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              This Week
            </Text>
            <View className="flex-row items-center gap-4">
              {/* Large percentage number — the headline stat */}
              <View
                className={`w-16 h-16 rounded-2xl items-center justify-center ${
                  adherence.percentage >= 80
                    ? "bg-green-50"
                    : adherence.percentage >= 50
                    ? "bg-amber-50"
                    : "bg-red-50"
                }`}
              >
                <Text
                  className={`text-2xl font-bold ${
                    adherence.percentage >= 80
                      ? "text-green-600"
                      : adherence.percentage >= 50
                      ? "text-amber-600"
                      : "text-red-500"
                  }`}
                >
                  {adherence.percentage}%
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800">
                  Adherence
                </Text>
                <Text className="text-sm text-gray-400 mt-0.5">
                  {adherence.taken} of {adherence.total} doses taken (last 7 days)
                </Text>
              </View>
            </View>

            {/* Thin progress bar — a visual version of the percentage */}
            <View className="h-2 bg-gray-100 rounded-full mt-4 overflow-hidden">
              <View
                className={`h-2 rounded-full ${
                  adherence.percentage >= 80
                    ? "bg-green-500"
                    : adherence.percentage >= 50
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${adherence.percentage}%` }}
              />
            </View>
          </View>
        )}

        {/* ── Low Stock ── */}
        {lowStockItems.length > 0 && (
          <View className="bg-white rounded-2xl border border-amber-200 mb-4 overflow-hidden">
            <View className="flex-row items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-100">
              <Ionicons name="warning-outline" size={16} color="#D97706" />
              <Text className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Low Stock
              </Text>
            </View>
            {lowStockItems.map(({ inventory, medicineName }, index) => (
              <TouchableOpacity
                key={inventory.medicine_id}
                onPress={() => router.push(`/medicine/${inventory.medicine_id}`)}
                className={`flex-row items-center justify-between px-5 py-4 ${
                  index < lowStockItems.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">{medicineName}</Text>
                  <Text className="text-xs text-amber-600 mt-0.5">
                    {inventory.quantity_on_hand % 1 === 0
                      ? inventory.quantity_on_hand
                      : inventory.quantity_on_hand.toFixed(1)}{" "}
                    {inventory.unit}s remaining
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D97706" />
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── DoseCard ────────────────────────────────────────────────────────────────
// Renders one dose entry. Shows different UI depending on status:
//   pending  → Take button (green) + Skip button (gray)
//   taken    → Green checkmark + "Taken at HH:MM AM/PM"
//   skipped  → Gray dash + "Skipped" (with note if one was left)
//
// When isSkipping = true, the card expands to show an inline note field
// and Confirm/Cancel buttons — like a small form popping out of the card.

interface DoseCardProps {
  dose: TodaysDose;
  isSkipping: boolean;
  skipNote: string;
  onSkipNoteChange: (text: string) => void;
  onTake: () => void;
  onSkipPress: () => void;
  onSkipConfirm: () => void;
  onSkipCancel: () => void;
}

function DoseCard({
  dose,
  isSkipping,
  skipNote,
  onSkipNoteChange,
  onTake,
  onSkipPress,
  onSkipConfirm,
  onSkipCancel,
}: DoseCardProps) {
  return (
    <View className="bg-white rounded-2xl border border-gray-100 mb-2 overflow-hidden">

      {/* ── Main row ── */}
      <View className="flex-row items-center px-4 py-3 gap-3">

        {/* Status indicator circle on the left */}
        <StatusDot status={dose.status} />

        {/* Medicine name + scheduled time */}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
            {dose.medicineName}
          </Text>

          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Text className="text-xs text-gray-400">
              {formatTime(dose.scheduledTime)}
            </Text>

            {/* Overdue badge — shown when a pending dose is past its time */}
            {dose.isOverdue && (
              <View className="bg-red-50 border border-red-100 rounded-full px-1.5 py-0.5">
                <Text className="text-xs font-medium text-red-500">Overdue</Text>
              </View>
            )}

            {/* Result label for resolved doses */}
            {dose.status === "taken" && dose.takenAt && (
              <Text className="text-xs text-green-600">
                Taken at {formatTime(dose.takenAt.slice(11, 16))}
              </Text>
            )}
            {dose.status === "skipped" && (
              <Text className="text-xs text-gray-400">
                Skipped{dose.notes ? ` — ${dose.notes}` : ""}
              </Text>
            )}
          </View>
        </View>

        {/* Action buttons — only shown for pending doses */}
        {dose.status === "pending" && !isSkipping && (
          <View className="flex-row gap-2">
            {/* Take button — green to signal a positive, healthy action */}
            <TouchableOpacity
              onPress={onTake}
              className="bg-green-600 rounded-xl px-3 py-1.5"
            >
              <Text className="text-white text-xs font-semibold">Take</Text>
            </TouchableOpacity>

            {/* Skip button — muted gray so it's less prominent than Take */}
            <TouchableOpacity
              onPress={onSkipPress}
              className="border border-gray-200 rounded-xl px-3 py-1.5"
            >
              <Text className="text-gray-500 text-xs font-semibold">Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Inline skip form ── */}
      {/* Shown when the user taps Skip — expands below the main row.
          Like a mini form sliding out of the card to ask "any reason?" */}
      {isSkipping && (
        <View className="px-4 pb-4 border-t border-gray-50 pt-3">
          <Text className="text-xs text-gray-500 mb-2">
            Why are you skipping? (optional)
          </Text>
          <TextInput
            value={skipNote}
            onChangeText={onSkipNoteChange}
            placeholder="e.g., felt nauseous, already took earlier"
            placeholderTextColor="#D1D5DB"
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 mb-3"
            autoFocus
          />
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={onSkipConfirm}
              className="flex-1 bg-gray-800 rounded-xl py-2.5 items-center"
            >
              <Text className="text-white text-sm font-semibold">Confirm Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSkipCancel}
              className="border border-gray-200 rounded-xl px-4 py-2.5 items-center"
            >
              <Text className="text-gray-500 text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── StatusDot ───────────────────────────────────────────────────────────────
// The coloured circle on the left of each dose card.
//   pending  → empty circle (white with gray border) — waiting to be acted on
//   taken    → green filled circle with a checkmark
//   skipped  → gray circle with a dash

function StatusDot({ status }: { status: TodaysDose["status"] }) {
  if (status === "taken") {
    return (
      <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
        <Ionicons name="checkmark" size={16} color="white" />
      </View>
    );
  }
  if (status === "skipped") {
    return (
      <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
        <Ionicons name="remove" size={16} color="#6B7280" />
      </View>
    );
  }
  // Pending
  return (
    <View className="w-8 h-8 rounded-full border-2 border-gray-200 bg-white items-center justify-center" />
  );
}

