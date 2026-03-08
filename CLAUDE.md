# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Medicine Tracker is a mobile app (iOS + Android) that helps families manage medicines.
Each person logs in with their own Auth0 account and keeps their data locally on their device.

Core features:
- Add prescriptions by camera scan (AI OCR) or manual entry
- Track inventory (quantity on hand, low-stock alerts)
- Dosage schedules with daily reminders
- Restock reminders when stock runs low

## Commands

```bash
npx expo start              # Start dev server — scan QR code with Expo Go on phone
npx expo start --android    # Start and open Android emulator
npx expo start --ios        # Start and open iOS simulator (Mac only)
npm run test                # Run all unit tests once
npm run test:watch          # Run tests in watch mode (re-runs on file save)
npm run typecheck           # TypeScript type check (no emit)
npm run lint                # ESLint across all .ts and .tsx files
```

Run a single test file:
```bash
npx vitest run src/services/medicine.service.test.ts
```

## Tech Stack

| Layer | Package | Version |
|-------|---------|---------|
| Framework | expo + expo-router | SDK 55 |
| Language | TypeScript | strict mode |
| Styling | nativewind (Tailwind) | v4 |
| Database | expo-sqlite | local, on-device |
| Auth | Auth0 via expo-auth-session | OIDC + email |
| OCR | Anthropic Claude API | claude-haiku-4-5 |
| Notifications | expo-notifications | local only |
| Tests | vitest | unit tests |

## Architecture

### Routing (expo-router)
File-based routing — the file path = the URL/screen path.
- `app/_layout.tsx` — root layout, wraps everything in AuthProvider
- `app/(auth)/sign-in.tsx` — login screen (redirect here if not authenticated)
- `app/(tabs)/` — bottom tab bar screens (dashboard, medicines, settings)
- `app/medicine/[id].tsx` — dynamic route for a specific medicine by ID

### Auth Flow
Auth0 OIDC via `expo-auth-session`. After login, the Auth0 `sub` field (unique user ID)
is stored in `expo-secure-store` and used to scope all database queries.

```
App open → check stored token → valid? → /dashboard
                                      → expired? → refresh → /dashboard
                              → none? → /sign-in → Auth0 login → /dashboard
```

Key files:
- `src/auth/auth0-config.ts` — reads Auth0 domain + client ID from .env
- `src/auth/AuthContext.tsx` — provides `useAuth()` hook with `{ user, login, logout }`

### Database
expo-sqlite. All data lives on the device. Tables:
- `medicines` — one row per prescription
- `schedules` — when to take each medicine (times, frequency)
- `intake_logs` — dose history (taken / skipped / pending)
- `inventory` — quantity on hand + low-stock threshold
- `notification_log` — expo notification IDs so we can cancel them

**Critical rule:** Every single database query MUST include `WHERE user_id = ?` using the
Auth0 sub. Failing to filter by user_id would mix family members' data.

```ts
// CORRECT — always filter by userId
const medicines = await getMedicines(db, userId);

// WRONG — never query without userId
const medicines = db.getAllSync('SELECT * FROM medicines'); // ← bug!
```

Key files:
- `src/db/client.ts` — opens the SQLite connection
- `src/db/schema.ts` — TypeScript interfaces matching every table
- `src/db/migrations.ts` — `runMigrations(db)` — call this on app startup

### Services
All database reads/writes go through service files. Never query SQLite directly from a component.

Every service function signature: `functionName(db, userId, ...otherArgs)`

- `src/services/medicine.service.ts` — CRUD for medicines
- `src/services/schedule.service.ts` — dosage schedules
- `src/services/intake.service.ts` — dose logging + adherence calculation
- `src/services/inventory.service.ts` — quantity tracking + low-stock detection
- `src/services/notification.service.ts` — schedule/cancel local notifications
- `src/services/ocr.service.ts` — send image to Claude API, parse prescription fields

### Hooks
React hooks in `src/hooks/` call the services and provide data to components.
Hooks handle loading states and re-fetching after mutations.

- `src/hooks/useMedicines.ts`
- `src/hooks/useSchedule.ts`
- `src/hooks/useInventory.ts`

## Code Conventions

- **Comments**: Add inline comments on any non-obvious line. Include a concrete example.
  ```ts
  // Parse Auth0 sub from JWT payload — e.g., sub = "auth0|abc123xyz"
  const userId = session.user.sub;
  ```
- **Before editing**: Summarize what will change in plain English, then wait for approval.
- **One phase at a time**: Complete and verify each phase before starting the next.
- **No `any` types** — use `unknown` and narrow with type guards.
- **Styles**: NativeWind `className` strings only — never `StyleSheet.create`.
- **File names**: kebab-case (`medicine-card.tsx`), component names: PascalCase (`MedicineCard`).
- **Imports**: Use `@/` alias for `src/` (e.g., `import { db } from "@/db/client"`).

## Environment Variables

All secrets live in `.env` (gitignored). The `.env` file has placeholder values
showing what variables are needed. Never commit real keys.

```
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your_client_id_here
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Variables prefixed with `EXPO_PUBLIC_` are bundled into the app and visible to users.
Only safe-to-expose values (Auth0 domain/client ID) use this prefix.
The Anthropic key should NOT use `EXPO_PUBLIC_` in production — use a backend proxy instead.
For development/learning purposes it is acceptable to use it directly.

## Slash Commands

Custom commands available in Claude Code sessions:
- `/add-medicine` — interactively add a medicine to the database
- `/reset-db` — drop all tables and re-run migrations (dev only)
- `/test-notification` — fire a test notification in 5 seconds
- `/check-schema` — show current SQLite schema and row counts
