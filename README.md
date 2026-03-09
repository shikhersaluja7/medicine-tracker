# Medicine Tracker

A mobile app (iOS + Android) for families to manage prescriptions, track daily doses, monitor inventory, and receive timely reminders — all stored locally on the device with no cloud dependency.

Built with **Expo SDK 55**, **React Native**, **TypeScript** (strict), **SQLite**, and **Auth0**. All 9 planned phases are complete and shipped.

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Auth** | Auth0 OIDC + PKCE login. Session persists across restarts via SecureStore. |
| 2 | **Medicine CRUD** | Add, view, edit, and archive prescriptions. |
| 3 | **OCR Scanning** | Photograph a prescription label — Claude AI extracts name, dosage, instructions, doctor. |
| 4 | **Inventory** | Track quantity on hand. Low-stock badge and dashboard alert when running low. |
| 5 | **Schedules** | Set dose times: daily, twice-daily, weekly, as-needed, or fully custom (any times, any days). |
| 6 | **Dose Tracking** | Dashboard shows today's doses grouped by morning / afternoon / evening. Tap Take or Skip. |
| 7 | **Adherence** | 7-day adherence % on dashboard and per-medicine detail screen. |
| 8 | **Notifications** | Local push reminders at scheduled dose times. Low-stock alerts. All cancellable. |

---

## Prerequisites

- **Node.js** 18+ and **npm** 9+
- **Expo Go** app on your physical phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
  _or_ an iOS simulator (macOS only) or Android emulator
- An **Auth0** account (free tier is sufficient) — [auth0.com](https://auth0.com)
- An **Anthropic API key** for OCR — [console.anthropic.com](https://console.anthropic.com)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/shikhersaluja7/medicine-tracker.git
cd medicine-tracker
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your real values:

```bash
cp .env.example .env
```

Open `.env` and set:

```env
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your_client_id_here
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> **Security note:** `.env` is gitignored. Never commit real keys. The `EXPO_PUBLIC_ANTHROPIC_API_KEY` is bundled into the app binary — acceptable for development and personal/family use, but should be moved behind a backend proxy before any App Store distribution.

### 3. Configure Auth0

In your Auth0 dashboard:

1. Create a **Native** application.
2. Under **Allowed Callback URLs**, add:
   ```
   exp://localhost:8081,medicine-tracker://callback
   ```
3. Under **Allowed Logout URLs**, add the same two URLs.
4. Copy the **Domain** and **Client ID** into `.env`.

### 4. Start the dev server

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone. The app opens and runs the database migrations automatically on first launch.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npx expo start` | Start dev server — scan QR with Expo Go |
| `npx expo start --android` | Start and open Android emulator |
| `npx expo start --ios` | Start and open iOS simulator (macOS only) |
| `npm run test` | Run all unit tests once |
| `npm run test:watch` | Re-run tests on every file save |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | ESLint across all `.ts` and `.tsx` files |

Run a single test file:

```bash
npx vitest run src/services/medicine.service.test.ts
```

---

## Project Structure

```
medicine-tracker/
├── app/                        # Screens (expo-router file-based routing)
│   ├── _layout.tsx             # Root — migrations, auth, notification permission
│   ├── index.tsx               # Redirect: authenticated → dashboard, else → sign-in
│   ├── (auth)/sign-in.tsx      # Auth0 login screen
│   ├── (tabs)/
│   │   ├── dashboard.tsx       # Today's doses + adherence + low-stock
│   │   ├── medicines.tsx       # Medicine list
│   │   └── settings.tsx        # Account + notification status
│   └── medicine/
│       ├── new.tsx             # Add medicine (manual or OCR scan)
│       ├── [id].tsx            # Detail: schedule, inventory, adherence
│       └── [id]-edit.tsx       # Edit existing medicine
├── src/
│   ├── auth/                   # Auth0 config + AuthContext (useAuth hook)
│   ├── components/             # Reusable UI (MedicineCard)
│   ├── db/                     # SQLite client, schema types, migrations
│   ├── hooks/                  # useMedicines, useInventory, useSchedule
│   └── services/               # All database + API logic (no direct DB in screens)
│       ├── medicine.service.ts
│       ├── ocr.service.ts      # Claude API call
│       ├── inventory.service.ts
│       ├── schedule.service.ts
│       ├── intake.service.ts
│       └── notification.service.ts
├── docs/
│   ├── architecture.md         # Layered architecture, data model, security
│   ├── architecture-diagram.mmd# Mermaid source diagrams
│   ├── spec.md                 # Full product specification + acceptance criteria
│   └── user-guide.md           # Customer-facing how-to guide
├── .env.example                # Required environment variable names (no values)
├── CLAUDE.md                   # AI assistant coding instructions
└── README.md                   # This file
```

---

## Architecture

The app follows a strict four-layer pattern:

```
Screens  →  Hooks  →  Services  →  SQLite
```

- **Screens** (`app/`) — render UI, handle user events, call hooks and services.
- **Hooks** (`src/hooks/`) — bridge services to React state; expose `{ data, isLoading, refetch }`.
- **Services** (`src/services/`) — pure functions; all SQL lives here. Every function signature is `fn(db, userId, ...args)`.
- **Database** (`src/db/`) — SQLite connection, TypeScript interfaces, migrations.

**Security invariant:** Every database query includes `WHERE user_id = ?` using the Auth0 `sub`. No query ever touches another user's data.

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown including data model, auth flow, and security threat model.

---

## Tech Stack

| Layer | Package | Version |
|-------|---------|---------|
| Framework | expo + expo-router | SDK 55 |
| Language | TypeScript | strict |
| Styling | NativeWind (Tailwind) | v4 |
| Database | expo-sqlite | local, on-device |
| Auth | Auth0 via expo-auth-session | OIDC + PKCE |
| OCR | Anthropic Claude API | claude-haiku-4-5 |
| Notifications | expo-notifications | local only |
| Tests | vitest | unit tests |

---

## Testing

```bash
npm run test
```

Tests live in `src/services/*.test.ts` alongside the service files. They use vitest with `vi.mock("expo-sqlite")` to test SQL logic without a real database.

Current coverage: **15 tests** across `medicine.service.ts` (CRUD, user scoping, edge cases).

---

## Custom Slash Commands (Claude Code)

When working in a Claude Code session, these commands are available:

| Command | What it does |
|---------|-------------|
| `/add-medicine` | Interactively add a medicine to the database |
| `/reset-db` | Drop all tables and re-run migrations (dev only) |
| `/test-notification` | Fire a test notification in 5 seconds |
| `/check-schema` | Show current SQLite schema and row counts |
| `/docs-sync` | Scan codebase and update `docs/` to match |

---

## Environment Variables Reference

| Variable | Used for | Safe to commit? |
|----------|----------|----------------|
| `EXPO_PUBLIC_AUTH0_DOMAIN` | Auth0 tenant domain | Yes (not a secret) |
| `EXPO_PUBLIC_AUTH0_CLIENT_ID` | Auth0 app identifier | Yes (not a secret) |
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Claude OCR API calls | No — gitignored |

---

## Contributing

1. Branch from `main`.
2. Follow the commenting style in `CLAUDE.md` — every non-obvious line needs a kid-friendly analogy.
3. Add tests for any new service functions.
4. Run `npm run typecheck && npm run lint && npm run test` before pushing.
5. Keep PRs focused — one feature or fix per PR.

---

## Known Limitations

- **Single device only** — all data is local. No cloud sync or backup.
- **OCR API key** — bundled into the binary for development. Use a backend proxy for production.
- **Auth0 token refresh** — not yet implemented. Sessions may expire after extended inactivity.

See [`docs/architecture.md § Tech Debt`](docs/architecture.md#12-tech-debt--known-trade-offs) for the full list.

---

## License

Private repository — no public license.
