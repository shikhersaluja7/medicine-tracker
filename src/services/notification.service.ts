// src/services/notification.service.ts — Schedules and cancels local push notifications.
//
// Think of this service like a personal reminder assistant who sets alarms for you.
// "Take your Aspirin at 8 AM every day" — this service writes those alarms on the
// calendar. When an alarm goes off, your phone buzzes. When you tap "Take", the
// service erases that alarm so it doesn't buzz again.
//
// Notifications are scheduled for a 7-day window at a time.
// Every app launch refreshes the window — like reprinting next week's planner page.
//
// Three types of work this service does:
//   1. Ask the user for permission to send notifications
//   2. Schedule dose reminders for the next 7 days
//   3. Fire a one-time low-stock alert when a medicine is running out

import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";

// ─── Foreground notification behaviour ───────────────────────────────────────
// By default, iOS and Android hide notifications silently when the app is already open.
// This tells expo-notifications to ALWAYS show the alert banner and play a sound —
// even if the user is actively using the app.
//
// Like telling your alarm clock: "Wake me up even if I'm already awake."
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // show the banner at the top of the screen (legacy field)
    shouldShowBanner: true,  // show the banner in SDK 55+ (new required field)
    shouldShowList: true,    // include in the notification centre list (new required field)
    shouldPlaySound: true,   // play the default notification sound
    shouldSetBadge: false,   // don't show a number badge on the app icon
  }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Generates a short random ID for new notification_log rows.
function generateId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
}

// Maps JavaScript's getDay() index (0 = Sunday) to our stored day key strings.
// e.g., new Date("2026-03-09").getDay() = 1 → "mon"
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// Returns true if the schedule applies to the given date.
// daysOfWeek = null means the schedule runs every day.
function isDayScheduled(daysOfWeek: string[] | null, date: Date): boolean {
  if (!daysOfWeek) return true; // null = every day — always valid
  const dayKey = DAY_KEYS[date.getDay()];
  return daysOfWeek.includes(dayKey);
}

// ─── Permissions ─────────────────────────────────────────────────────────────

// Asks the device for permission to send notifications.
// Returns true if the user grants permission, false if they deny.
//
// On iOS: a system dialog pops up asking "Allow Notifications?" — shown only ONCE.
// On Android 13+: same thing — the user must tap Allow.
// If permission was already granted, calling this again is a safe no-op.
export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Checks the current permission status WITHOUT showing a dialog.
// Like peeking at whether you have a library card without going to the desk.
// Returns "granted", "denied", or "undetermined".
export async function getPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status; // PermissionStatus enum values are strings: "granted" | "denied" | "undetermined"
}

// ─── Cancel helpers ───────────────────────────────────────────────────────────

// Cancels all dose_reminder notifications for a user and deletes them from the DB.
// Called before re-scheduling — like erasing the old planner before writing the new week.
//
// We only cancel dose_reminder rows here; low_stock rows are event-driven and kept separately.
async function cancelAllDoseReminders(db: SQLiteDatabase, userId: string): Promise<void> {
  const rows = db.getAllSync<{ notification_id: string }>(
    `SELECT notification_id FROM notification_log
     WHERE user_id = ? AND type = 'dose_reminder'`,
    userId
  );

  for (const row of rows) {
    try {
      // expo-notifications cancels a future notification by its ID string.
      // If the notification already fired (past), the cancel is a no-op.
      await Notifications.cancelScheduledNotificationAsync(row.notification_id);
    } catch {
      // The notification may have already fired or been dismissed — that is fine.
    }
  }

  db.runSync(
    `DELETE FROM notification_log WHERE user_id = ? AND type = 'dose_reminder'`,
    userId
  );
}

// Cancels all notifications (dose reminders AND low-stock alerts) for one medicine.
// Used when a medicine is archived or its schedule is deleted entirely.
export async function cancelMedicineNotifications(
  db: SQLiteDatabase,
  medicineId: string,
  userId: string
): Promise<void> {
  const rows = db.getAllSync<{ notification_id: string }>(
    `SELECT notification_id FROM notification_log
     WHERE medicine_id = ? AND user_id = ?`,
    medicineId,
    userId
  );

  for (const row of rows) {
    try {
      await Notifications.cancelScheduledNotificationAsync(row.notification_id);
    } catch {
      // Already fired or missing — ignore.
    }
  }

  db.runSync(
    `DELETE FROM notification_log WHERE medicine_id = ? AND user_id = ?`,
    medicineId,
    userId
  );
}

// Cancels the dose reminder notification for a specific scheduled slot.
// Called right after the user taps "Take" — no need to buzz them if they already took it!
//
// scheduledAt is stored as "YYYY-MM-DDTHH:MM:00" (local time, NO "Z" suffix).
// We parse it as local time, convert to UTC ISO, then match against notification_log.
export async function cancelDoseNotification(
  db: SQLiteDatabase,
  userId: string,
  medicineId: string,
  scheduledAt: string // e.g., "2026-03-09T08:00:00"
): Promise<void> {
  // Parse "YYYY-MM-DDTHH:MM:00" as local time.
  // "T" splits the date from the time, then we separate year/month/day and hour/minute.
  const [datePart, timePart] = scheduledAt.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [h, m] = timePart.split(":").map(Number);

  // new Date(year, month-1, day, h, m) creates a local-time Date.
  // month - 1 because JavaScript months are 0-indexed (January = 0, December = 11).
  const fireDate = new Date(year, month - 1, day, h, m, 0, 0);

  // Convert to UTC ISO string to match how we stored it in notification_log.
  // e.g., "2026-03-09T02:30:00.000Z" (UTC, not local time)
  const scheduledFor = fireDate.toISOString();

  const rows = db.getAllSync<{ notification_id: string }>(
    `SELECT notification_id FROM notification_log
     WHERE user_id = ? AND medicine_id = ? AND scheduled_for = ? AND type = 'dose_reminder'`,
    userId,
    medicineId,
    scheduledFor
  );

  for (const row of rows) {
    try {
      await Notifications.cancelScheduledNotificationAsync(row.notification_id);
    } catch {
      // May have already fired.
    }
  }

  db.runSync(
    `DELETE FROM notification_log
     WHERE user_id = ? AND medicine_id = ? AND scheduled_for = ? AND type = 'dose_reminder'`,
    userId,
    medicineId,
    scheduledFor
  );
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

// Schedules dose reminder notifications for all active medicines over the next 7 days.
// Only future times are scheduled — past times are silently skipped.
//
// Like a secretary who checks every calendar entry for the next 7 days and sets an
// alarm for each meeting that hasn't happened yet.
export async function scheduleDoseNotifications(
  db: SQLiteDatabase,
  userId: string
): Promise<void> {
  // Fetch all active schedules for this user, joined with medicine name and dosage.
  const schedules = db.getAllSync<{
    medicine_id: string;
    medicine_name: string;
    dosage: string;
    frequency: string;
    times_of_day: string;        // JSON string, e.g., '["08:00","20:00"]'
    days_of_week: string | null; // JSON string or null (null means every day)
  }>(
    `SELECT s.medicine_id,
            m.name   AS medicine_name,
            m.dosage,
            s.frequency,
            s.times_of_day,
            s.days_of_week
     FROM schedules s
     JOIN medicines m ON m.id = s.medicine_id
     WHERE s.user_id = ? AND s.is_active = 1 AND m.is_active = 1`,
    userId
  );

  const now = new Date();

  for (const schedule of schedules) {
    // "As needed" schedules have no fixed times — nothing to schedule.
    if (schedule.frequency === "as_needed") continue;

    // Parse the JSON strings back into arrays.
    // times_of_day: ["08:00", "20:00"]
    // days_of_week: ["mon", "wed", "fri"] or null
    const timesOfDay = JSON.parse(schedule.times_of_day) as string[];
    const daysOfWeek = schedule.days_of_week
      ? (JSON.parse(schedule.days_of_week) as string[])
      : null;

    // Loop through today + 6 more days = 7 days total.
    // dayOffset 0 = today, dayOffset 1 = tomorrow, etc.
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + dayOffset);

      // Skip days where this schedule doesn't apply.
      // e.g., a Mon/Wed/Fri schedule skips Tuesday.
      if (!isDayScheduled(daysOfWeek, targetDate)) continue;

      for (const time of timesOfDay) {
        const [h, m] = time.split(":").map(Number);

        // Build the exact Date when the notification should fire.
        // We copy targetDate to avoid mutating the loop variable across iterations.
        const fireDate = new Date(targetDate);
        fireDate.setHours(h, m, 0, 0);

        // Skip times that have already passed — no point in a reminder for 2 hours ago.
        if (fireDate <= now) continue;

        // Convert to UTC ISO string for storage.
        const scheduledFor = fireDate.toISOString();

        // Check if we already have a notification scheduled for this exact slot.
        // Prevents duplicates if reschedule is called before the 7-day window expires.
        const existing = db.getFirstSync<{ id: string }>(
          `SELECT id FROM notification_log
           WHERE user_id = ? AND medicine_id = ? AND scheduled_for = ? AND type = 'dose_reminder'`,
          userId,
          schedule.medicine_id,
          scheduledFor
        );
        if (existing) continue; // already scheduled — skip

        // Tell expo-notifications to fire this notification at the exact date and time.
        // scheduleNotificationAsync returns a string ID we can use later to cancel.
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time to take ${schedule.medicine_name}`,
            // Show the dosage if available, e.g., "Dosage: 500mg tablet"
            body: schedule.dosage
              ? `Dosage: ${schedule.dosage}`
              : "Tap here to log your dose.",
            // data is passed back to the app when the user taps the notification.
            // We include medicineId so we could navigate to the right screen.
            data: { medicineId: schedule.medicine_id, userId },
          },
          // DATE trigger fires exactly once at the given Date object.
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate, // local-time Date; expo-notifications handles UTC conversion
          },
        });

        // Save the notification ID so we can cancel it later (e.g., when dose is taken).
        db.runSync(
          `INSERT INTO notification_log
             (id, user_id, medicine_id, notification_id, type, scheduled_for, created_at)
           VALUES (?, ?, ?, ?, 'dose_reminder', ?, ?)`,
          generateId(),
          userId,
          schedule.medicine_id,
          notificationId,
          scheduledFor,
          new Date().toISOString()
        );
      }
    }
  }
}

// ─── Low-stock notifications ──────────────────────────────────────────────────

// Checks if a medicine is low on stock and schedules a one-time alert if so.
// Also cancels any existing low-stock alert if stock has been refilled.
//
// Like a pantry alarm:
//   - It ONLY rings ONCE when supplies get low (not on every dose after that).
//   - It stops ringing once you've restocked the shelf.
//
// Call this after marking a dose as "Taken" (stock just decreased)
// or after recording a refill (stock just increased).
export async function checkAndNotifyLowStock(
  db: SQLiteDatabase,
  userId: string,
  medicineId: string,
  medicineName: string
): Promise<void> {
  // Read the current inventory for this medicine.
  const inv = db.getFirstSync<{
    quantity_on_hand: number;
    low_stock_threshold: number;
    unit: string;
  }>(
    `SELECT quantity_on_hand, low_stock_threshold, unit
     FROM inventory
     WHERE medicine_id = ? AND user_id = ?`,
    medicineId,
    userId
  );

  if (!inv) return; // No inventory record set up — nothing to check.

  // "Low" means quantity at or below the warning threshold.
  // e.g., 5 tablets left with a threshold of 7 → isLow = true
  const isLow = inv.quantity_on_hand <= inv.low_stock_threshold;

  // Check if we already fired a low-stock notification for this medicine.
  const existing = db.getFirstSync<{ notification_id: string }>(
    `SELECT notification_id FROM notification_log
     WHERE user_id = ? AND medicine_id = ? AND type = 'low_stock'`,
    userId,
    medicineId
  );

  if (isLow && !existing) {
    // Stock just dropped to the warning level — schedule an immediate alert.
    // We add a 2-second delay so the "Take" confirmation finishes first.
    const fireDate = new Date(Date.now() + 2000);

    // Format the quantity: show as integer if whole (e.g., "5"), decimal if fractional (e.g., "2.5").
    const qty =
      inv.quantity_on_hand % 1 === 0
        ? inv.quantity_on_hand.toString()
        : inv.quantity_on_hand.toFixed(1);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Low stock: ${medicineName}`,
        body: `Only ${qty} ${inv.unit}s remaining. Time to refill!`,
        data: { medicineId, userId, type: "low_stock" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });

    // Log it so we don't fire the alert again on the next dose.
    db.runSync(
      `INSERT INTO notification_log
         (id, user_id, medicine_id, notification_id, type, scheduled_for, created_at)
       VALUES (?, ?, ?, ?, 'low_stock', ?, ?)`,
      generateId(),
      userId,
      medicineId,
      notificationId,
      fireDate.toISOString(),
      new Date().toISOString()
    );
  } else if (!isLow && existing) {
    // Stock has been refilled above the threshold — cancel the pending low-stock alert.
    // Like turning off the pantry alarm after restocking the shelf.
    try {
      await Notifications.cancelScheduledNotificationAsync(existing.notification_id);
    } catch {
      // The notification may have already fired before the refill — that is fine.
    }
    db.runSync(
      `DELETE FROM notification_log
       WHERE user_id = ? AND medicine_id = ? AND type = 'low_stock'`,
      userId,
      medicineId
    );
  }
}

// ─── Reschedule all ───────────────────────────────────────────────────────────

// Cancels all existing dose reminder notifications and schedules a fresh 7-day window.
// Called once per app launch.
//
// Why reschedule on every launch?
//   - Device restarts wipe all scheduled notifications — we need to restore them.
//   - Schedule changes (new medicines, updated times) are picked up automatically.
//   - The 7-day window advances as each day passes.
//
// Like tearing off last week's planner page and filling in the new week's schedule.
export async function rescheduleAllNotifications(
  db: SQLiteDatabase,
  userId: string
): Promise<void> {
  // Check permission first — no point scheduling if the user has blocked notifications.
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  // Wipe and re-create all dose_reminder entries for this user.
  await cancelAllDoseReminders(db, userId);
  await scheduleDoseNotifications(db, userId);
}
