# Medicine Tracker — User Guide

Welcome to Medicine Tracker! This guide walks you through everything you need to know to get the most out of the app — from adding your first medicine to understanding your weekly adherence report.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Adding a Medicine](#2-adding-a-medicine)
3. [Setting a Dose Schedule](#3-setting-a-dose-schedule)
4. [Tracking Your Daily Doses](#4-tracking-your-daily-doses)
5. [Managing Your Stock](#5-managing-your-stock)
6. [Understanding Adherence](#6-understanding-adherence)
7. [Push Notifications](#7-push-notifications)
8. [Family Use — Multiple Accounts](#8-family-use--multiple-accounts)
9. [Tips & Tricks](#9-tips--tricks)
10. [Frequently Asked Questions](#10-frequently-asked-questions)

---

## 1. Getting Started

### First launch

When you open the app for the first time, you will see the **Sign In** screen.

Tap **Sign In** — a secure browser window opens where you can log in with your email and password, or with your Google account. This is powered by Auth0, a trusted identity provider, and Medicine Tracker never sees your password.

After signing in, you land on the **Today** tab — your daily home base.

### Staying logged in

You stay logged in automatically between app sessions. You will only need to sign in again if you explicitly tap **Sign Out** in the Settings tab.

### Your data is private

All your medicine and dose data is stored **only on your phone**. Nothing is sent to any server except:
- The login process (handled securely by Auth0).
- Prescription label photos, if you use the camera scan feature (sent to Anthropic's Claude AI for reading — the photo is not stored by Anthropic).

---

## 2. Adding a Medicine

You can add a medicine in two ways: by **scanning a prescription label** with your camera, or by **typing the details manually**.

### Option A — Scan a Prescription Label (recommended for new prescriptions)

1. Go to the **Medicines** tab (pill bottle icon at the bottom).
2. Tap the **+** button in the top-right corner.
3. On the Add Medicine screen, tap **Scan Prescription Label**.
4. Choose **Camera** to take a photo now, or **Photo Library** to use an existing photo.
5. Hold your phone steady over the prescription label and take the photo.
6. Wait a few seconds while the app reads the label. You will see a "Scanning prescription…" spinner.
7. The app fills in the **Name**, **Dosage**, **Instructions**, and **Doctor** fields automatically.
8. Review the filled-in details, correct anything that looks wrong, then tap **Save**.

> **Important:** Always check the scan results before saving. The app will never auto-save — you are always in control.

**If the scan fails:**
- "Could not connect" — check your internet connection and try again.
- "Could not read the label" — try a clearer photo with better lighting.
- "Could not find medicine details" — the label may not have enough text. Add the medicine manually.

### Option B — Manual Entry

1. Go to **Medicines** → tap **+**.
2. Fill in the fields:
   - **Name** (required) — e.g., *Lisinopril*
   - **Dosage** (required) — e.g., *10mg tablet*
   - **Instructions** (optional) — e.g., *Take with food, in the morning*
   - **Doctor** (optional) — e.g., *Dr. Mehta*
3. Tap **Save**.

### Editing a medicine

1. Go to **Medicines** and tap any card to open the detail screen.
2. Tap the **Edit** button (pencil icon, top-right).
3. Make your changes and tap **Save**.

### Archiving (removing) a medicine

When you stop taking a medicine, you can archive it — it disappears from your list but your dose history is preserved.

1. Open the medicine detail screen.
2. Tap **Archive Medicine** (shown in red at the bottom).
3. Confirm in the dialog.

---

## 3. Setting a Dose Schedule

A schedule tells the app *when* you need to take a medicine so it can remind you and track your doses.

### How to set a schedule

1. Open a medicine from the **Medicines** tab.
2. Scroll down to the **Schedule** section and tap **Set Up Schedule**.
3. Choose a frequency:

| Frequency | What it means |
|-----------|--------------|
| **Daily** | One fixed time every day — e.g., 8:00 AM |
| **Twice Daily** | Two fixed times every day — e.g., 8:00 AM and 8:00 PM |
| **Weekly** | Specific days of the week — e.g., Monday, Wednesday, Friday |
| **As Needed** | No fixed times — you take it whenever required (e.g., pain relief) |
| **Custom** | Any combination — e.g., three times a day on weekdays only |

4. Set your dose time(s) using the HH:MM fields.
5. For **Weekly** or **Custom**, tap the day buttons (Mo Tu We Th Fr Sa Su) to select which days apply.
6. Tap **Save Schedule**.

### Changing a schedule

Open the medicine detail and tap **Edit** in the Schedule section. Your old schedule is preserved in history — only the new schedule is active.

### Turning a schedule off

Open the medicine detail → Schedule section → tap **Remove Schedule**. Your dose history is kept; no new reminder rows are created.

---

## 4. Tracking Your Daily Doses

The **Today** tab (home screen) is your daily dose tracker.

### Reading the Today screen

Doses are grouped into three time bands:

| Group | Hours |
|-------|-------|
| ☀️ Morning | Before noon |
| 🌤 Afternoon | Noon to 5 PM |
| 🌙 Evening | 5 PM and later |

Each dose card shows:
- The **medicine name**
- The **scheduled time**
- An **Overdue** badge if the scheduled time has passed and you haven't acted yet

### Marking a dose as taken

Tap the green **Take** button on a dose card. The card turns green with a checkmark, and one unit is automatically deducted from your stock count.

### Skipping a dose

Tap the grey **Skip** button. A small text field appears — you can type an optional reason (e.g., "felt nauseous") or leave it blank. Tap **Confirm Skip** to record it.

### All done!

When every dose for the day has been marked (taken or skipped), a 🎉 celebration appears. Well done!

---

## 5. Managing Your Stock

Keep track of how many tablets (or ml, or capsules) you have left so you never run out unexpectedly.

### Setting up inventory

1. Open a medicine from the **Medicines** tab.
2. Scroll to the **Inventory** section and tap **Set Up Inventory**.
3. Enter:
   - **Quantity on hand** — how many you have right now (e.g., *28*)
   - **Unit** — tablet, capsule, ml, or patch
   - **Low-stock threshold** — you will be warned when quantity drops to this level (default: 7, roughly one week's supply)
4. Tap **Save**.

### Recording a refill

When you pick up a new prescription:

1. Open the medicine detail → **Inventory** section.
2. Tap **Record Refill**.
3. Enter the new total quantity.
4. Tap **Save**. The refill date is recorded automatically.

### Low-stock warnings

When your stock reaches or drops below the threshold:
- An **amber "Low Stock" badge** appears on the medicine card in the Medicines tab.
- A **Low Stock section** appears on the Today dashboard listing all affected medicines.
- A **push notification** is sent (if notifications are enabled).

Tap any low-stock item to go straight to that medicine's inventory section.

> **Tip:** The default threshold is 7. If you take a medicine twice a day, change it to 14 to get two weeks' warning.

---

## 6. Understanding Adherence

Adherence is a measure of how consistently you take your scheduled medicines.

**Formula:** `(doses taken ÷ total doses due) × 100 = adherence %`

For example: if you took 17 out of 20 scheduled doses this week, your adherence is 85%.

### Where to find your adherence

| Location | What it shows |
|----------|--------------|
| Today tab → "This Week" card | Your adherence across **all** medicines for the last 7 days |
| Medicine detail screen | Adherence for that **one medicine** over the last 7 days |

### Colour coding

| Colour | Meaning |
|--------|---------|
| 🟢 Green | 80% or above — great job! |
| 🟡 Amber | 50–79% — room to improve |
| 🔴 Red | Below 50% — consider talking to your doctor |

### What counts

- **Taken** doses count toward the adherence score.
- **Skipped** doses count in the denominator (they were due) but not in the numerator.
- **Pending** doses (not yet acted on for today) are excluded — they haven't happened yet.
- **As-needed** medicines with no fixed schedule are not included.

---

## 7. Push Notifications

Medicine Tracker sends local reminders directly from your phone — no internet required after setup.

### Dose reminders

You receive a notification at each of your scheduled dose times. The notification shows the medicine name and dosage. Tapping the notification opens the app.

Once you mark a dose as **Taken**, the reminder for that slot is automatically cancelled.

### Low-stock alerts

When your inventory drops to or below the low-stock threshold, you receive a one-time alert. The alert does not repeat with every subsequent dose — it fires once, and clears when you record a refill.

### Turning notifications on

The app asks for notification permission on first launch. If you missed it or declined:

1. Go to the **Settings** tab (person icon).
2. Find the **Notifications** section.
3. If it shows "Enable", tap it — your phone's Settings app opens.
4. Find **Medicine Tracker** → turn on **Notifications**.

### Turning notifications off

Go to your phone's Settings → Notifications → Medicine Tracker → toggle off. The app continues to work normally — you just won't receive buzzes.

---

## 8. Family Use — Multiple Accounts

Medicine Tracker is designed for families where each person manages their own medicines separately.

**Each family member needs their own account:**
- Each person signs in with their own email (or Google account) on the same device, or on their own device.
- Data is completely separated — you will never see another family member's medicines or dose history.

**Switching accounts on a shared device:**
1. Go to **Settings** → **Sign Out**.
2. The app returns to the sign-in screen.
3. Sign in with a different account.

> **Note:** Each person's data stays on the device where they logged in. There is no cloud sync — if your phone is lost or replaced, the data on it cannot be recovered.

---

## 9. Tips & Tricks

**Set your schedule as early as possible.** The app generates today's dose reminders the first time it opens each day. If you set up a schedule after midday, times earlier in the day won't appear until tomorrow.

**Use custom scheduling for complex regimens.** If you take a medicine three times a day on weekdays only (e.g., a pain reliever during the work week), choose **Custom**, add three time slots, and select Mon–Fri.

**Tap the low-stock card on the dashboard to jump straight to that medicine.** You can record a refill without navigating through the full medicines list.

**Pull down on the Medicines list to refresh** if you've just added or changed medicines on another screen.

**Skip with a note.** If you skip a dose because you already took it earlier, felt unwell, or had a doctor's instruction — leave a short note. It shows up in your dose history and helps when reviewing adherence.

**Check your adherence weekly.** The 7-day view on the dashboard resets on a rolling basis. Checking it at the same time each week gives you a consistent habit.

---

## 10. Frequently Asked Questions

**Q: Can I use the app without internet?**
Yes. The app works fully offline for all daily use — tracking doses, viewing medicines, managing stock, and receiving notifications. You only need internet to sign in (Auth0) or to scan a prescription label (Claude AI).

**Q: Is my health data sent anywhere?**
Only prescription label photos (when you use the scan feature) are briefly sent to Anthropic's Claude AI for reading. The image is not stored. Everything else — your medicines, schedules, dose history, inventory — stays on your phone.

**Q: What happens if I get a new phone?**
Your data is stored locally on your current device. When you switch phones, you'll need to re-add your medicines. There is no cloud backup in the current version.

**Q: Can I undo marking a dose as taken?**
Not currently. If you marked a dose incorrectly, contact your healthcare provider if the error is medically significant. A future version may add an undo option.

**Q: Why doesn't the scan always get the right information?**
Prescription labels vary widely — some are printed in tiny fonts, have unusual layouts, or include abbreviations. Try a well-lit, in-focus photo with the label filling as much of the frame as possible. You can always correct any field before saving.

**Q: My notification showed up at the wrong time — why?**
Notifications are scheduled in your local time zone. If you travel across time zones, reopen the app once to re-schedule notifications for the new local time.

**Q: How do I stop the low-stock notification from repeating?**
The low-stock alert fires only once when stock first drops below your threshold. It stops after that. To clear it, record a refill (the alert won't fire again until stock drops low a second time after a refill).

**Q: What does "Overdue" mean on a dose card?**
It means the scheduled time for that dose has already passed and you haven't marked it as taken or skipped yet. You can still tap Take or Skip — the history will record the actual time you acted, not the scheduled time.

**Q: Can I set different low-stock thresholds for different medicines?**
Yes. Open each medicine's detail screen → Inventory section → edit the threshold individually. For example, set 14 for a twice-daily medicine (two weeks' warning) and 7 for a once-daily medicine (one week's warning).

---

*Medicine Tracker is intended as a personal organisational aid. It does not provide medical advice. Always follow your doctor's or pharmacist's guidance regarding dosage and medication management.*
