# CREW CHIEF — Codebase Knowledge File

> Last updated: 2026-07-14 (UX Chunk 9 — SOL QA PASS; UX correction sprints active)
> Branch at time of writing: `preview-v3` (active UX worktree; release `master` remains separate)
> Purpose: Comprehensive reference for any LLM or developer picking up this codebase.
>
> ⚠️ **2026-07-14:** UX Chunks 1–9 are technically complete on **`preview-v3`**. Owner-correction sprints are active; start with `SPRINT_INDEX.md`, then use `HANDOFF.md`, `ralph/CURRENT_TASK.md`, and `ralph/STATE.md` for current authority. This file remains the deep technical reference.

## 2026-07-12 UX Chunk 4 override

- Commit `21405e9`: Dashboard launchpad is current behavior.
- Dashboard top order: device-local Get Race-Ready card, ≥64px `+ LOG RUN`
  hero, active-weekend summary, scoped service chip, collapsed checklist/service
  summaries, Setup/Tire link-outs. Full weekend CRUD remains in Sessions.
- Fresh `+ LOG RUN` with no weekend opens a teaching sheet. Creating a weekend
  from that flow auto-activates it and continues directly into new-session.
- `GetRaceReadyCard.tsx` checks real active-car/setup/weekend/session data and
  persists dismissal at `race_notes_onboarding_dismissed`.
- `src/lib/serviceLog.ts` builds quick-service records. Cost greater than zero
  also creates linked Accounting expense; Dashboard Undo removes both and
  restores previous maintenance counter.
- Dashboard maintenance visibility: active-car components plus global rig
  components only. Never show/reset another car's component.
- Weekend/session destructive actions use ⋯ sheets and delayed Undo commit.
- `sortWeekends()` in `src/lib/scope.ts` is canonical: active first, then date
  descending; ContextStrip, Sessions, Dashboard, and Export use it.
- Android QA APK: main-tree `android/app/build/outputs/apk/debug/app-debug.apk`,
  versionCode 14/versionName 3.9. Build v3 `dist` first, copy it to main, run
  raw `npx cap sync android`, then Gradle. Never run main-tree
  `npm run android:sync` for this bridge because it rebuilds master over v3.
- Chunk 4 draft: `https://6a5458d75d0c165c44d0ef9f--crew-chief-race-notes.netlify.app`.

## 2026-07-11 WS-Z behavior override

Newer than older sections below; this block wins conflicts:

- Rear scale weight canonical key: `CornerSetup.loadWeight`; legacy `load` remains
  readable/preserved through `src/lib/setupCompat.ts`.
- C6A supersedes the older asymmetric four-bar rule: LR and RR each expose Top
  and Bottom bars with frame hole, length, birdcage hole, Ride Height angle, and
  Full Droop angle. See §25.
- Weekend creation exists on Dashboard, activates weekend, and does not open a
  session. Session creation requires device-local `race_notes_active_weekend`.
- Sessions with zero weekends show only Create Weekend content action. Sessions
  contains no New Weekend or weekend-checklist UI.
- Trackers visible tabs: Checklist, Service, Templates, Accounting. Checklist is
  one global Main Checklist; templates import fresh unchecked copies. No weekend
  association.
- Shopping UI/export retired. `race_notes_shopping` remains untouched for rollback.
  Legacy weekend-checklist rows remain hidden, synced, and recoverable.

## 0. Session 8 Summary (read this first)

Everything below this point that isn't already reflected elsewhere in this doc was added/changed in session 8:

1. **Google OAuth** (web + native Android) — sign in/register with Google, in addition to email/password. See §7a.
2. **Mandatory auth gate** — the app now requires a login before any tab is usable, but stays usable **offline** on a device that has logged in at least once. See §7b.
3. **Tire usage history** — derived (no new DB table) tracking of which session/track/corner/session-type each tire was used in, with lap estimates, CSV export, and a printable report. See §20.
4. **Shock load compare/overlay** — compare multiple `ShockSession` graphs on one chart plus an interpolated table, with CSV export. See §21.
5. **Zoom-based UI sizing.** C6A exposes only Default (1.15) and Large (1.45), while preserving legacy stored enum values. See §22 and §25.
6. **Android API 36 / AGP 8.9.1 / Gradle 8.11.1** readiness bump for the Aug 31, 2026 Google Play requirement. See §13.
7. **Bug fix:** "Clear All Data" now actually clears todos/accounting/shopping (previously left them stale). See §15.
8. **Build/deploy tooling note:** real builds, git pushes, and Netlify/Android deploys for this repo should be done via **Windows-MCP PowerShell** (acts on the real Windows machine) — the Cowork Linux sandbox (`mcp__workspace__bash`) cannot push to git (no credential helper) and has had spurious EPERM/tsc artifacts on this repo's cross-platform mount. Use the sandbox for read-only inspection only.
9. **Unresolved anomaly:** across this session, `android/app/build.gradle`'s `versionCode`/`versionName` was found reverted to old values twice, and once a just-created source file (`src/lib/tireHistory.ts`) was found staged for deletion in git, with no corresponding action taken by the assistant. Root cause unknown — suspected a concurrent process/another AI session touching the same working copy. If you're a fresh agent picking this up: **verify `android/app/build.gradle`'s current `versionCode` against git/user before trusting any value written here**, and be alert for unexplained working-tree changes.
10. **Orphaned components:** `src/components/TeamView.tsx` and `src/components/ToDoView.tsx` exist in the repo but are **not imported/rendered anywhere in `App.tsx`** as of session 8 (team management and standalone todos were apparently folded into `TrackersView.tsx`, which now has a Todos sub-tab alongside Accounting/Shopping — see §4 and §9 `TrackersView.tsx`). Don't assume these files are live UI without checking `App.tsx` imports first.

---

## 1. App Identity

| Field | Value |
|-------|-------|
| Brand name | **CREW CHIEF** |
| Capacitor appId | `com.racenotes.app` |
| Netlify URL | `https://crew-chief-race-notes.netlify.app` |
| Platform | PWA + Android APK via Capacitor |
| Repo root | `C:\Users\maxx\antigravity\Race-Notes` |

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Styling | TailwindCSS v4 (`@theme` block in CSS — **no `tailwind.config.js`**) |
| Animations | Framer Motion (`motion` package) |
| Mobile | Capacitor 8 (Android only) |
| Backend / Auth | Supabase (auth + Postgres + Storage), Google OAuth via Supabase provider (session 8) |
| PWA | `vite-plugin-pwa` + Workbox |
| Deployment | Netlify CLI — `netlify deploy --prod --dir=dist` (production) or `netlify deploy --dir=dist` (preview/draft, prints a `Draft URL`) |

### UI scaling — 2-choice `zoom` system (C6A, legacy enum compatible)
The old approach (`document.documentElement.style.fontSize = theme.fontSize === 'large' ? '19px' : '16px'`) is **gone**. Root font size is now a constant `16px`. Scaling is done with the CSS `zoom` property instead, applied to the app shell:

```ts
// App.tsx theme effect
root.style.fontSize = '16px'; // constant now
const zoomMap: Record<AppTheme['fontSize'], number> = {
  standard: 1.15, large: 1.15, xlarge: 1.45, xxlarge: 1.45,
};
root.style.setProperty('--ui-zoom', String(zoomMap[theme.fontSize] ?? 1.15));
```
```css
/* src/index.css */
#applet-main-body, #applet-auth-gate { zoom: var(--ui-zoom, 1); }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
```
`AppTheme.fontSize` retains `'standard' | 'large' | 'xlarge' | 'xxlarge'` so old storage hydrates safely. The UI exposes only `large` as **Default** and `xlarge` as **Large**. Hydration normalizes `standard`→`large` and `xxlarge`→`xlarge`. `zoom` scales fixed-pixel Tailwind classes as well as rem text; `text-size-adjust: 100%` prevents Chromium text inflation from double-scaling.

### TailwindCSS custom tokens (defined in `src/index.css` `@theme` block)
Key custom color tokens (set dynamically by theme system in `App.tsx`):
- `--color-primary` / `--color-on-primary`
- `--color-surface` / `--color-surface-container` / `--color-surface-bright` / `--color-surface-container-high`
- `--color-on-surface` / `--color-on-surface-variant`
- `--color-outline-variant`
- `--color-primary-fixed`

---

## 3. Project Structure

```
Race-Notes/
├── src/
│   ├── App.tsx                    # Root component — all global state, routing, modals
│   ├── types.ts                   # All TypeScript interfaces
│   ├── data.ts                    # INITIAL_* constants (mostly empty arrays)
│   ├── index.css                  # Global styles + @theme TailwindCSS tokens
│   ├── components/
│   │   ├── AuthView.tsx           # Login / signup / profile
│   │   ├── DashboardView.tsx      # Landing: recent weekends, quick actions
│   │   ├── ExportView.tsx         # Weekend report + export (sub-tab of Settings)
│   │   ├── QuickReferenceView.tsx # Dirt-track tuning reference / adjustment finder
│   │   ├── RaceWeekendView.tsx    # Active session editor + all-sessions list
│   │   ├── GarageView.tsx         # Car CRUD + active-car selector (inside Settings)
│   │   ├── SettingsView.tsx       # Account / Style / Export / Garage sub-tabs
│   │   ├── SetupView.tsx          # Car setup sheet + tire inventory + smasher
│   │   ├── SmasherLoadsView.tsx   # Shock load data points + dyno graph photos
│   │   ├── TeamView.tsx           # Team management (invite, roles)
│   │   ├── ToDoView.tsx           # Shared to-do lists (multi-list)
│   │   └── TrackersView.tsx       # Accounting + Shopping sub-tabs
│   └── lib/
│       ├── supabase.ts            # Supabase client + AppUser type + auth helpers (incl. Google OAuth, session 8)
│       ├── sync.ts                # Push/pull helpers for cloud sync
│       ├── scope.ts               # byActiveCar filter helper (car-profiles feature)
│       ├── tireHistory.ts         # Tire usage history derivation + CSV/report export (session 8, new)
│       └── shockCompare.ts        # Shock-graph interpolation + comparison table + CSV export (session 8, new)
├── capacitor.config.ts
├── vite.config.ts
├── package.json
└── android/                       # Capacitor Android project
```

---

## 4. App Navigation (tabs)

Tab IDs are string literals stored in `activeTab` state in `App.tsx`. **Current type** (verified session 8):
```ts
useState<'dashboard' | 'setups' | 'raceweekend' | 'quickref' | 'settings' | 'trackers'>('dashboard')
```
**There is no `'todos'` tab and no `'team'` tab** — do not add navigation code that references either.

| Tab ID | Component | Description |
|--------|-----------|-------------|
| `dashboard` | `DashboardView` | Home screen — recent weekends, quick-start |
| `raceweekend` | `RaceWeekendView` | Active session log + all sessions for current weekend |
| `setups` | `SetupView` | Car setup sheet, tire inventory (incl. usage history), smasher load graphs |
| `trackers` | `TrackersView` | Sub-tabs: **Accounting · Shopping · Todos** (todos live here, not a separate top-level tab) |
| `quickref` | `QuickReferenceView` | Tuning reference guide / adjustment finder |
| `settings` | `SettingsView` | Account, theme, export, garage |

**Bottom nav bar order (left → right):** Dashboard · Setups · Sessions · Trackers · Reference · Settings.

**Note:** `src/components/TeamView.tsx` and `src/components/ToDoView.tsx` still exist as files but are **not imported by `App.tsx`** (confirmed via grep, session 8) — they're orphaned/unwired. Todo list functionality is provided through `TrackersView.tsx`'s Todos sub-tab instead.

---

## 5. TypeScript Interfaces (`src/types.ts`)

### `Car` + `CAR_TYPES` *(feature/car-profiles)*
```ts
export const CAR_TYPES = ['Dirt Late Model', 'A Mod', 'B Mod'] as const;
export type CarType = typeof CAR_TYPES[number] | string; // open-ended for custom values

export interface Car {
  id: string;          // client-generated UUID
  teamId?: string | null;
  userId: string;
  carType: CarType;
  chassis: string;
  division: string;
  name?: string;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}
```
**Ownership:** if the user is on a team (`teamId` is set), the car is team-owned and visible to all team members. Otherwise it is user-owned.

### `ShockCorner` / `ShockDataPoint` / `ShockSession` *(feature/car-profiles — promoted from local types)*
```ts
export type ShockCorner = 'LF' | 'RF' | 'LR' | 'RR';
export interface ShockDataPoint { height: string; load: string; }
export interface ShockSession {
  id: string; label: string; corner: ShockCorner;
  springRate: string; shock: string; date: string;
  points: ShockDataPoint[]; photos?: string[];
  carId?: string; // car-scoped
}
```
Previously defined as local types inside `SmasherLoadsView.tsx`; now global so `App.tsx` and `sync.ts` can use them.

### `CornerSetup`
Per-corner setup data (spring, shock, tire, measurements). All measurement fields are strings for flexibility. Key fields:
- `spring`, `shock`, `tireComp`, `tireSize`, `tirePress`
- `tireInventoryId` — links to `TireInventoryItem.id`
- Rear-specific: `springHeight`, `load`, `topBarLength`, `bottomBarLength`, bar angles, `droop`, `preload`
- `boundGraphId` — links to a shock dyno graph in SmasherLoadsView

### `Setup`
Full car setup sheet. One per entry in the saved setups list.
```ts
interface Setup {
  id: string; chassis: string; track: string; date: string; carType: string;
  lf: CornerSetup; rf: CornerSetup; lr: CornerSetup; rr: CornerSetup;
  gear?: string; toe?: string; jbar?: string; jbarFrameHeight?: string; jbarPinionHeight?: string;
  frontStagger?: string; rearStagger?: string;
  pullBarFrameHole?: string; pullBarRearHole?: string; pullBarAngle?: string;
  notes?: string;
  screenshots?: string[]; // Supabase Storage public URLs
  carId?: string;          // car-scoped (feature/car-profiles)
}
```

### `TireInventoryItem`
```ts
interface TireInventoryItem {
  id: string; tireNumber: string; size: string; compound: string;
  wheelBackspacing: '2' | '3' | '4'; durometer: string;
  carId?: string; // car-scoped (feature/car-profiles)
}
```

### `TireDetails`
Tire state as used in an active session (what's physically on the car):
```ts
interface TireDetails {
  compound: string; size: string; airPressure: string;
  tireId?: string; durometer?: string; backSpacing?: string;
}
```

### `SessionRecord`
A completed/saved session stored inside `RaceWeekend.sessions[]`.
```ts
interface SessionRecord {
  id: string;
  type: 'H1' | 'Q1' | 'P2' | 'A-MAIN' | string; // legacy values; new sessions use display string
  name: string;    // same as type (e.g. "Test", "Test 2", "Heat Race")
  track: string; condition: string; bestLap: string;
  isBest?: boolean; avgLap?: string; finishPos?: string;
  diagnostics?: {
    cornerEntry: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    cornerEntryNotes?: string;
    centerApex: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    centerApexNotes?: string;
    cornerExit: 'TIGHT' | 'NEUTRAL' | 'LOOSE';
    cornerExitNotes?: string;
  };
  adjustments?: SetupAdjustment[];
  tires?: { lf: TireDetails; rf: TireDetails; lr: TireDetails; rr: TireDetails; };
  pressures?: { lf: string; rf: string; lr: string; rr: string; };
  competitionNotes?: string; weather?: string; time?: string;
  setupUsed?: string; screenshots?: string[];
}
```
**Note:** `type` and `name` are set to the same full string (e.g. `"Test 2"`). Legacy codes like `'H1'` still exist in the union but are not used for new sessions.

### `WeatherSnapshot`
```ts
interface WeatherSnapshot {
  temp: number; humidity: number; windSpeed: number;
  condition: string; location: string; fetchedAt: string; // ISO timestamp
}
```

### `RaceWeekend`
```ts
interface RaceWeekend {
  id: string; name: string; track: string; date: string;
  sessions: SessionRecord[];
  notes?: string;            // free-text weekend notes
  weather?: WeatherSnapshot; // fetched via GPS or zip
  location?: string;         // human-readable location string
  setupId?: string;          // bound Setup.id
  setupName?: string;        // cached chassis name for display
}
```

### `ActiveSession`
The in-progress session being edited live. Mirrors most of `SessionRecord` but is a singleton flat object.
- Stored in `localStorage['race_notes_active_session']`
- When a session is "saved": it gets appended to the matching `RaceWeekend.sessions[]` array

### `TodoItem` / `Todo`
- `TodoItem`: single task with `text`, `done`, optional `assignedTo`/`assignedToName`, optional `weekendId`/`weekendName`
- `Todo`: a named list containing `TodoItem[]`, owned by a `user_id`

### `AccountingEntry`
```ts
interface AccountingEntry {
  id: string; name: string; description?: string;
  amount: number; type: 'income' | 'expense';
  payer?: string; payee?: string; date: string;
  weekendId?: string; weekendName?: string;
  receiptPhoto?: string; // base64
}
```

### `ShoppingItem`
```ts
interface ShoppingItem {
  id: string; name: string; description?: string;
  cost?: number; purchased: boolean; purchasedAt?: string;
  weekendId?: string; weekendName?: string;
}
```

### `AppTheme`
```ts
interface AppTheme {
  mode: 'dark' | 'light';
  accent: string;           // hex e.g. "#ffb3ac"
  fontSize: 'standard' | 'large' | 'xlarge' | 'xxlarge'; // legacy-compatible; UI exposes Default/Large only
}
```

### Session types / lap estimates (session 8, `types.ts`)
```ts
export const SESSION_TYPES = ['Test', 'Hot Laps', 'Qualifying', 'Heat Race', 'Feature'] as const;
export type SessionType = typeof SESSION_TYPES[number];
export const SESSION_TYPE_LAPS: Record<SessionType, number> = {
  Test: 5, 'Hot Laps': 5, Qualifying: 3, 'Heat Race': 10, Feature: 30,
};
```
`SessionRecord` and `ActiveSession` both gained an optional `sessionType?: SessionType` field. Used by `src/lib/tireHistory.ts` to compute estimated laps per tire usage. For sessions saved before this field existed, `inferSessionType()` in `tireHistory.ts` falls back to a regex match on the legacy `name`/`type` string (e.g. "Heat", "A-MAIN", "Qual", "HL", "Test") and flags the result with a `*` in the UI to indicate it's inferred, not stored.

---

## 6. localStorage Keys

| Key | Stored type | Description |
|-----|-------------|-------------|
| `race_notes_setup` | `Setup` | Currently active setup sheet |
| `race_notes_saved_setups` | `Setup[]` | All saved setups |
| `race_notes_weekends` | `RaceWeekend[]` | All race weekends + their sessions |
| `race_notes_active_session` | `ActiveSession` | Session being edited right now |
| `race_notes_tires` | `TireInventoryItem[]` | Tire inventory |
| `race_notes_shock_graphs` | `ShockSession[]` | Smasher load graph data — now lifted to App.tsx, synced to cloud |
| `race_notes_cars` | `Car[]` | All cars (synced to cloud) |
| `race_notes_active_car` | `string` | Active car ID — **device-local, never synced to Supabase** |
| `race_notes_todos` | `Todo[]` | To-do lists |
| `race_notes_accounting` | `AccountingEntry[]` | Accounting ledger entries |
| `race_notes_shopping` | `ShoppingItem[]` | Shopping list items |
| `race_notes_theme` | `AppTheme` | User theme preferences |
| `race_notes_registered_user` | serialized minimal user record | **Session 8, new.** Durable "this device has logged in before" flag, independent of live Supabase session validity/expiry. Set by `rememberLocalAccount(user)` on any successful login/session-restore; only cleared by explicit `signOut()`. Powers the offline-resilient auth gate — see §7b. |

All keys are read on mount via `useEffect` in `App.tsx`. Cloud data (when logged in) is merged on top of local data.

---

## 7. Cloud Sync (`src/lib/sync.ts`)

### Strategy
**Local-first**: localStorage is always the primary write target. Supabase is secondary and synced after auth.

### Push functions (local → Supabase)
All push calls are debounced 500ms via a shared `pushDebounceTimers` Map.

| Function | Supabase table | Behavior |
|----------|----------------|----------|
| `pushWeekends(weekends, userId)` | `race_weekends` | upserts all surviving weekends |
| `pushSetups(setups, userId)` | `setups` | upserts all setups (includes `car_id`) |
| `pushActiveSession(session, userId)` | `active_sessions` | upserts single row keyed by user_id |
| `pushTodos(todos, userId)` | `todos` | upserts all todos |
| `pushTires(tires, userId)` | `tire_inventory` | upserts all tires (includes `car_id`) |
| `pushCars(cars, userId, teamId)` | `cars` | upserts all cars |
| `pushShockSessions(sessions, userId)` | `shock_sessions` | upserts all shock sessions |
| `deleteWeekendFromCloud(weekendId)` | `race_weekends` | **hard-deletes** one row by id (no debounce) |
| `deleteCarFromCloud(carId)` | `cars` | hard-deletes one car |
| `deleteShockSessionFromCloud(sessionId)` | `shock_sessions` | hard-deletes one shock session |

### Pull function
`pullAllData(userId)` — called once on login. Returns setups, weekends, and active session from cloud. App.tsx merges them via `mergeIntoLocalStorage` + setState merge loops.

### `mergeIntoLocalStorage(type, cloudData, localKey)`
Cloud items always overwrite local items of the same `id`. Local-only items are preserved. Deleted local items re-appear if cloud record was not explicitly deleted.

### CRITICAL GOTCHA — deletion sync
`pushWeekends` only upserts remaining records; it does **not** delete the removed row from Supabase. When deleting a weekend you **must** also call `deleteWeekendFromCloud(weekendId)` — otherwise the deleted weekend comes back on the next page refresh (pullAllData re-adds it). **This bug was fixed in `feature/session-v2`.**

---

## 7a. Google OAuth (session 8, new)

**`src/lib/supabase.ts`:**
- Client config now sets `flowType: 'pkce'`, `detectSessionInUrl: true` (was `false`).
- `NATIVE_AUTH_CALLBACK_URL = 'com.racenotes.app://auth-callback'` — custom URL scheme for native OAuth return.
- `signInWithGoogle()` — on web, does a normal `supabase.auth.signInWithOAuth` redirect. On native (Capacitor), opens the OAuth URL in the system browser via `@capacitor/browser`'s `Browser.open` with `skipBrowserRedirect: true`, so the app itself doesn't navigate away.
- `handleNativeAuthCallback(url)` — called when the OS hands the app back the `com.racenotes.app://auth-callback` deep link; extracts the auth code and calls `supabase.auth.exchangeCodeForSession`.

**`src/App.tsx`:** a `useEffect` (native-only) registers `CapacitorApp.addListener('appUrlOpen', ...)` (from `@capacitor/app`) which pipes the returned URL into `handleNativeAuthCallback`.

**`android/app/src/main/AndroidManifest.xml`:** `MainActivity` has a second `<intent-filter>` for `VIEW` + `BROWSABLE`/`DEFAULT` with `<data android:scheme="com.racenotes.app" android:host="auth-callback" />` so Android routes that deep link back into the app.

**`src/components/AuthView.tsx`:** "Continue with Google" button (inline Google "G" SVG) below a divider under the email/password form, calling `handleGoogleSignIn` → `signInWithGoogle()`.

**Supabase side:** Google provider configured directly in the Supabase dashboard (project `swblfeayxoprodhwxqak`) with a Client ID/Secret from Google Auth Platform (formerly "OAuth consent screen"). Migration `supabase/migrations/002_oauth_profile_metadata.sql` updates the `public.handle_new_user()` trigger to populate `display_name`/`avatar_url` from OAuth metadata (`full_name`/`name`/`avatar_url`/`picture`), `ON CONFLICT (id) DO NOTHING`.

**Dependencies added:** `@capacitor/app@^8.1.0`, `@capacitor/browser@^8.0.3` (`package.json`).

**Confirmed working** end-to-end on both Netlify (web redirect flow) and Android (native browser + deep-link flow).

---

## 7b. Mandatory Auth Gate + Offline Resilience (session 8, new)

The app used to be usable without logging in. As of session 8, **login is required to use any tab**, but the app must still work **offline** once a device has logged in at least once (racing pits often have no signal).

**Mechanism (`src/lib/supabase.ts` + `src/App.tsx`):**
- `REGISTERED_USER_KEY = 'race_notes_registered_user'` — a localStorage flag completely independent of Supabase's live session/token state.
- `rememberLocalAccount(user)` — writes the flag; called from `initAuth()` and the `onAuthChange` listener whenever a session is successfully restored or a sign-in succeeds. **Never cleared on a null/expired session** — only `signOut()` clears it (via `rememberLocalAccount(null)`), so a Supabase token expiring while offline does not lock the user out.
- `hasLocalAccount()` — reads the flag.
- In `App.tsx`: `const isUnlocked = !!user || hasLocalAcct;`
  - If `!authReady` → minimal splash screen.
  - If `!isUnlocked` → full-screen `id="applet-auth-gate"` shell (header + centered `<AuthView />`) — no tabs render, no data is shown.
  - Otherwise the normal app renders (`id="applet-main-body"`).
- Explicit "Sign Out" in Settings calls `signOut()`, which clears both the live Supabase session **and** the local `hasLocalAccount` flag, re-locking the device.

**Why not just check `user`:** relying solely on live Supabase session state would lock a legitimate, previously-logged-in user out the moment their token needs to refresh while offline in the pits. The local flag decouples "has this device ever authenticated" from "is the cloud session currently valid," which is what makes true offline use possible after first login.

---

## 8. Supabase Tables

| Table | Key columns | Notes |
|-------|-------------|-------|
| `race_weekends` | `id, user_id, name, track, date, sessions (jsonb), updated_at` | sessions array stored as JSONB blob |
| `setups` | `id, user_id, chassis, track, date, lf/rf/lr/rr (jsonb), screenshots (text[]), car_id (text), updated_at` | `car_id` added in migration 009 |
| `active_sessions` | `id, user_id, data (jsonb), updated_at` | one row per user |
| `todos` | `id, user_id, title, items (jsonb), is_template, updated_at` | |
| `tire_inventory` | `id, user_id, tire_number, size, compound, wheel_backspacing, durometer, car_id (text), created_at, updated_at` | `car_id` added in migration 009 |
| `cars` | `id (text), user_id, team_id, car_type, chassis, division, name, created_at, updated_at` | migration 009; `id` is text (client-generated UUID) to match local-first pattern |
| `shock_sessions` | `id (text), user_id, car_id (text), label, corner, spring_rate, shock, date, points (jsonb), photos (text[]), created_at, updated_at` | migration 009; replaces localStorage-only storage |
| `shared_setups` | `setup_id, shared_with (user_id)` | sharing permissions |
| `shared_weekends` | `weekend_id, shared_with (user_id)` | sharing permissions |
| Storage bucket | `race-attachments` | photos/files; path: `{userId}/{entityType}/{entityId}/{timestamp}.{ext}` |

**Migration file:** `supabase/migrations/009_cars.sql`
**RLS pattern:** all new tables use `in_same_team()` helper — team members can view/update each other's cars, setups, tires, and shock sessions.

---

## 9. Component Details

### `App.tsx`
The entire app runs from one root component. No React Router — navigation is a single `activeTab` string state.

**Key state variables:**
```ts
activeTab: string                    // current tab
weekends: RaceWeekend[]              // all race weekends
activeSession: ActiveSession         // the session being edited live
setup: Setup                         // currently active car setup
savedSetups: Setup[]                 // all saved setups
tireInventory: TireInventoryItem[]   // all tires
user: User | null                    // Supabase auth user
team: Team | null                    // user's team
theme: AppTheme                      // dark/light, accent color, font size

// Car profiles (feature/car-profiles)
cars: Car[]                          // all cars (from race_notes_cars)
activeCarId: string | null           // active car (from race_notes_active_car, device-local)
shockSessions: ShockSession[]        // all shock sessions (lifted from SmasherLoadsView)
settingsSubTab: string               // deep-link target for SettingsView
```

**Derived:**
```ts
const activeCar = cars.find(c => c.id === activeCarId) ?? null;
```

**Car handlers:**
- `handleSaveCars(updated)` — persists to `race_notes_cars` + pushCars to cloud
- `handleSelectCar(carId)` — writes to `race_notes_active_car` (localStorage only, never synced)
- `handleDeleteCar(carId)` — **blocked** if car owns any setup/tire/shock data; alerts the user; otherwise deletes locally + cloud, selects next car
- `handleSaveShockSessions(updated)` — persists to `race_notes_shock_graphs` + pushShockSessions to cloud

**Auto-select effect:** on mount and whenever `cars` or `activeCarId` changes, if `activeCarId` is missing or dangling (not in `cars`), auto-selects `cars[0].id`.

**One-time backfill effect (useRef guarded):** runs once after post-login pull if `cars.length === 0`. Creates a `defaultCar` from the first setup's chassis/carType, stamps all legacy setups, tires, and shock sessions with `defaultCar.id`, saves the car, and selects it.

**New-weekend setup picker:** filters `savedSetups` to active car's setups (`s.carId === activeCarId`).

**Header:** active car chip (shows `chassis · carType`) appears when a car is selected; taps to `Settings → Garage`. "Add Car" button appears when `cars.length === 0`.

// New session form
showNewSessionForm: boolean
newSessionWeekendId: string
newSessionType: 'Test'|'Hot Laps'|'Qualifying'|'Heat Race'|'Feature'
newSessionTimeOfDay: 'current'|'Afternoon'|'Evening'|'Night'
sessionWeatherStr: string            // formatted weather string for the session
sessionWeatherLoading / Error / showZip / zipCode

// New weekend form
showNewWeekendForm: boolean
newWeekendSetupId: string            // bound setup ID
newWeekendName / Track / Date: string
```

**Key handlers:**
- `handleOpenNewSessionForm(preferWeekendId?)` — resets all session form state, sets `newSessionWeekendId` from the active session's weekendId (or first weekend), opens modal.
- `handleCreateNewSession(e)` — validates, calls `buildSessionName`, resolves time, saves to `weekends`, pushes to cloud, sets `activeSession`, navigates to `raceweekend` tab.
- `buildSessionName(type, weekendId)` — auto-numbers sessions ("Test", "Test 2", "Test 3"...).
- `handleDeleteWeekend(weekendId)` — removes from state + localStorage + calls `deleteWeekendFromCloud(id)` + `pushWeekends(...)`.
- `handleCreateNewWeekend(e)` — creates weekend with bound setup, then auto-opens session form.
- `handleUpdateWeekend(updated)` — persists weekend edits (notes, weather, etc.) to state + localStorage + cloud.

**Cloud sync flow:**
1. Mount: read all data from localStorage into state.
2. Auth login: `pullAllData` → merge cloud into local → setState.
3. Data change: write to localStorage immediately, debounced push to Supabase.

---

### `RaceWeekendView.tsx`
Props: `{ user, session, weekends, tireInventory?, savedSetups?, onUpdateSession, onUpdateWeekend, onDeleteSession, onSelectSession, onNewSession?, onNewWeekend? }`

Five visual sections (in order):
1. **Weekend info** — banner (name, track, date, setup name), GPS/zip weather widget, weekend notes textarea.
2. **Dual CTAs** — "New Weekend" + "New Session" buttons side-by-side (both dashed-border). `onNewWeekend` opens the weekend form; `onNewSession` opens the session form.
3. **Active session editor** — collapsible; inline editing of `ActiveSession` (lap times, diagnostics, tires installed per corner, adjustments, photo attachments). Tire dropdowns per corner filter out tires already selected on other corners within the same session. "Import from Setup" button auto-fills corner tires from the bound setup.
4. **All Weekends accordion** — ALL weekends shown (sorted newest → oldest by date), each collapsible. Inside each: session cards with Load/Delete buttons. The active weekend starts expanded. `expandedWeekendIds` is a `Set<string>` state.

Weekend resolution logic:
```ts
const currentWeekend =
  weekends.find(w => w.id === session.weekendId) ||
  weekends.find(w => w.track === session.track) ||
  weekends[0];
```

**Tire picker:** Per-corner inventory dropdown + air pressure input. Selecting a tire auto-fills compound, size, durometer, backspacing from the inventory item.

---

### `DashboardView.tsx`
Weekend list with track filter. Delete button on each weekend card. Quick-action buttons: New Weekend, New Session.

Session rows show full session name as plain text — no badge box. `normalizeSessionName()` helper maps legacy full-type names ("QUALIFYING", "HOT LAPS") to the current short codes ("Qual", "HL") for display only; data is not mutated.

Three collapsible sections below the weekend list:
- **Setups** — list of saved setups (name, track, date); tap to navigate to setup.
- **Tires** — inventory in single-line format: `#ID [space] Size | BS | Compound | Duro`. ID in primary color, rest in `text-on-surface`.
- **Open Tasks** — open to-do items across all lists, with "assigned to me" highlight.

---

### `SetupView.tsx`
Full car setup form (4 corners, pull bar, stagger, gear, notes, screenshots). Contains tire inventory management (`TireInventoryItem` CRUD). Links to `SmasherLoadsView` for shock dyno data.

**feature/car-profiles changes:** Accepts `activeCarId?`, `activeCar?`, `shockSessions?`, `onSaveShockSessions?`. New setups and tires are stamped with `carId`. `byActiveCar` filter applied at display time (`displayedSetups`, `displayedTires`). CornerForm receives `displayedTires` so inventory picker only shows active car's tires. "New Setup" form and "Add Tire" button show a prompt ("Add a car in Settings → Garage to start.") and are disabled when no car is active.

**Car Setup Info Baseline section** includes:
- Gear, JBar Length, J-Bar Frame/Pinion Height, Pull Bar holes
- **Computed stagger** (RF−LF, RR−LR) — auto-calculated from tire sizes
- **Computed weight calculations** — displayed when all 4 corner Scale Weights are entered:
  - Nose % = (LF + RF) / Total
  - Left % = (LF + LR) / Total
  - Cross % = (LR + RF) / Total
  - LR Split = LR − RR (in lb)
  - Total Scale Weight display

**CornerForm** — "Load Weight" field is labelled **Scale Weight (lb)** in the UI. The underlying field key is still `loadWeight` in the `CornerSetup` type.

**Tire uniqueness** — CornerForm tire dropdowns filter out tires already selected on other corners within the same setup. Cross-setup / cross-session reuse is allowed.

**Tire inventory list** — same single-line format as Dashboard: `#ID Size | BS | Compound | Duro`. Size field auto-appends `"` on blur if missing.

**Tire usage history (session 8, new):** tire rows are now expandable (click to toggle `expandedTireId` state). Expanding a tire shows total estimated laps plus a per-usage list (date, track, session name, corner badge, session type with a `*` suffix if the type was inferred rather than stored — see §5 Session types). Header of the Tires tab gains CSV/Report export buttons (`downloadTireUsageCsv`, `printTireUsageReport` from `src/lib/tireHistory.ts`), shown whenever the active car has at least one tire. `weekends?: RaceWeekend[]` is a new prop on `SetupView` (default `[]`) so it can derive usage from session data without a new DB table. See §20 for the full feature writeup.

**Fixed bug (session 8):** `byActiveCar<Setup>(setups, activeCarId)` and `byActiveCar<TireInventoryItem>(tires, activeCarId)` now pass explicit type arguments. The bare (un-parameterized) calls were silently collapsing TypeScript's inferred `T` down to the bare constraint `{carId?: string}`, which caused a large cascade of `tsc` errors throughout this file (Vite/esbuild doesn't type-check, so the app worked fine at runtime regardless — but `npm run lint` was broken). If you see similar `tsc` errors after touching `byActiveCar` call sites elsewhere, apply the same fix: pass the item type explicitly, e.g. `byActiveCar<ShockSession>(sessions, activeCarId)`.

---

### `QuickReferenceView.tsx`
Symptom picker label: **"Symptom"** (not "What is the car doing?"). Option labels are short — no parenthetical descriptions, no `[TIGHTEN]`/`[LOOSEN]` group prefix in the `<select>` options.

---

### `SmasherLoadsView.tsx`
Shock load graph data entry. Each `ShockSession` (now a global type in `types.ts`, not same as `SessionRecord`) has:
- Corner + shock ID
- Data points: height/load pairs — **text inputs with `inputMode="decimal"`**, no stepper buttons
- Dyno graph photos: base64 JPEG (compressed via canvas). Photos live here, NOT in RaceWeekendView.

**feature/car-profiles changes:** State lifted to App.tsx. Props: `activeCarId?`, `sessions?` (full array from App), `onSave?`. When props are provided the component uses them; falls back to localStorage for backward compatibility. New sessions are stamped with `carId`. `byActiveCar` filter applied at display time (also fixed to `byActiveCar<ShockSession>(...)` explicit-generic, session 8 — see the same gotcha noted under `SetupView.tsx` above). "New Session" button disabled with tooltip when no car is active.

**Compare/overlay mode (session 8, new):** header gains a "Compare" toggle button, shown once there are 2+ sessions for the active car. Compare panel: a checkbox session picker (color dot + corner badge per session, colors from a fixed 8-color `COMPARE_PALETTE`, exported as `sessionCompareColor(index)`), a multi-series overlay chart (`ShockCompareChart` component — reuses the single-session `ShockLineChart`'s axis/grid styling but with a combined min/max domain across all selected sessions), and an interpolated comparison table below it. The original single-session view is gated behind `!compareMode &&`. See §21 for the interpolation logic.

---

### `TrackersView.tsx`
Sub-tabs: Accounting | Shopping. Entries can be linked to a race weekend via `weekendId`/`weekendName`. Accounting supports a base64 receipt photo.

---

### `SettingsView.tsx`
Sub-tabs: **Garage | Account | Style | Export**. "Appearance" was renamed to "Style"; "Garage" is a new first tab (feature/car-profiles). Passes `weekends`, `todos`, `accounting`, `shopping` down to `ExportView`. Accepts `initialSubTab?` prop so App.tsx can deep-link directly to Garage (e.g. from the header car chip).

**Clear All Data** (session 7, fixed session 8): Account tab has a "Danger Zone" section at the bottom. Two-step confirm ("Clear All Data" → "Are you sure?"). Calls `onClearAllData?: () => Promise<void>` prop, implemented in App.tsx as `handleClearAllData`:
- Removes all `race_notes_*` localStorage keys
- Deletes all user rows from Supabase: `weekends`, `setups`, `tire_inventory`, `cars`, `shock_sessions`, and (**session 8 fix**) `todos`
- Resets all relevant React state to empty arrays / null, including (**session 8 fix**) `todos`, `accounting`, `shopping` — previously these three were never reset in-memory, so old items stayed visible on screen after a "clear" even though other data cleared correctly
- Auto-cancels confirm if user doesn't confirm within 5 seconds

### `GarageView.tsx` *(feature/car-profiles)*
Rendered inside SettingsView's Garage tab. Manages the `Car[]` array:
- Active-car selector — button row, highlighted with `border-primary bg-primary/5`
- Add car form: `CAR_TYPES` dropdown, chassis, division, name
- Per-car inline edit form
- Delete button disabled (with tooltip) when the car owns any setups, tires, or shock sessions (`setupCount + tireCount + shockCount > 0`)
- Auto-selects the first car when a car is first added

---

### `ExportView.tsx`
Contains a "Weekend Report" tab. Generates a printable HTML report for a selected weekend, including sessions, weather, notes, linked tasks, accounting, and shopping items. Opened as a sub-tab inside Settings.

---

## 10. Session Creation Flow

1. User taps **"Start New Session"** (large button in `RaceWeekendView` or Dashboard quick-action).
2. `handleOpenNewSessionForm()` in App.tsx resets form state and opens the modal.
3. Modal shows:
   - **Weekend selector** — which weekend to attach the session to
   - **Session type** button picker: `Test | Hot Laps | Qualifying | Heat Race | Feature`
   - Auto-number preview: "Will be logged as: Test 2"
   - **Time picker**: Current Time (device clock at submit) | Afternoon | Evening | Night
   - **Weather widget**: GPS (Nominatim + Open-Meteo) | Zip code fallback
4. On submit: `handleCreateNewSession` builds name, resolves time, appends to weekend's `sessions[]`, saves to localStorage, pushes to cloud. Sets `activeSession` and navigates to `raceweekend` tab.

### Auto-numbering (`buildSessionName`)
```ts
const existing = weekend.sessions.filter(
  s => s.name === type || s.name.startsWith(`${type} `)
);
if (existing.length === 0) return type;       // "Test"
return `${type} ${existing.length + 1}`;     // "Test 2", "Test 3" ...
```

---

## 11. Weather Fetch Flow

Used in both session creation (`App.tsx`) and weekend-level weather (`RaceWeekendView.tsx`).

**GPS path:**
1. `navigator.geolocation.getCurrentPosition` → lat/lon
2. Nominatim `/reverse` → city/state string
3. Open-Meteo `/forecast?latitude=&longitude=&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph`
4. WMO weather code → human string via `weatherCodeToStr()`

**Zip path:**
1. Nominatim `/search?postalcode=XXXXX&country=US` → lat/lon
2. Same Open-Meteo call

**APIs (no key required):**
- `https://nominatim.openstreetmap.org/reverse`
- `https://nominatim.openstreetmap.org/search`
- `https://api.open-meteo.com/v1/forecast`

---

## 12. Image Handling

**Compression helper (used in multiple components):**
```ts
function compressImage(file: File, maxPx = 1024, quality = 0.82): Promise<string>
// Returns base64 JPEG data URL
```

**Storage by entity:**
| Photo type | Where stored |
|-----------|-------------|
| Session screenshots | base64 in `SessionRecord.screenshots[]` → inside `RaceWeekend.sessions` JSONB |
| Accounting receipts | base64 in `AccountingEntry.receiptPhoto` → in `race_notes_accounting` |
| Shock dyno graphs | base64 in SmasherLoadsView's `ShockSession.photos[]` → `race_notes_shock_graphs` |

---

## 20. Session 9 — In-app Guide, tire-size parsing, compound quick-pick

**Tire size parsing (`src/lib/tireSize.ts`, new).**
Racers enter sizes as decimals (`86.5`) or whole+fraction (`86 1/2`, `86-1/2`), sometimes with a trailing inch mark. `parseTireSize()` normalizes all of these to a number; `compareTireSize()` is an ascending comparator (unparseable sizes sort last); `sortBySize()` returns a size-sorted copy of any `{ size?: string }[]`.

- Every tire **picker dropdown** is now size-sorted:
  - `SetupView.tsx` `CornerForm` inventory `<select>` → wrapped in `sortBySize(...)`.
  - `RaceWeekendView.tsx` per-corner `availableTires` → wrapped in `sortBySize(...)`.
- `SetupView.tsx` inventory-list Size↑/Size↓ sort switched from the old digits-only `parseSz` (decimals only) to `compareTireSize` so fractions sort correctly.

**Compound quick-pick (`SetupView.tsx`, Add Tire modal).**
Above the compound text input, tappable chips list every distinct compound already present in `tires`. Tapping a chip fills the field; the user can still type a brand-new compound. Removes retyping known compounds. Chips are ≥32px tall for touch.

**In-app Guide (`src/components/GuideView.tsx`, new).**
Accordion of collapsible topic headers (Requiring an account, Creating a team, Adding a car, Creating a setup, Creating a weekend, Logging a session, Adding tires, Adding spring smasher graphs, Adding tasks, Assigning tasks, Adding shopping). Each header expands step-by-step instructions + optional tip. Big touch targets (≥56px header), `aria-expanded`/`aria-controls`/`role="region"` for accessibility. Wired as a new **Guide** sub-tab in `SettingsView.tsx` (subTab union now includes `'guide'`, and `initialSubTab` too). **No dashboard tab** — lives under Settings only.

**Canonical user-facing copy:** `docs/USER_GUIDE.md` mirrors the Guide content — keep both in sync when flows change.

**Context files:** `AGENTS.md` refreshed to the 2026-07-01 revision.
| Setup photos | Supabase Storage public URLs in `Setup.screenshots[]` |

---

## 13. Build & Deploy Commands

### Development
```bash
npm run dev
# Vite dev server at localhost:3000
```

**Session 8 note — where to run these:** the Cowork Linux sandbox (`mcp__workspace__bash`) cannot push to git (no credential helper available there) and has produced spurious build/type-check artifacts on this repo's cross-platform mount. Use **Windows-MCP PowerShell** (operates on the real Windows machine, real Git Credential Manager) for any command below that pushes, builds, or deploys for real. The sandbox is fine for read-only inspection (`grep`, `cat`, `wc -l`, etc.).

### Web + Netlify
```bash
npm run build        # outputs to dist/
npm run lint         # tsc --noEmit (type check only — build does NOT type-check)

# Production deploy:
netlify deploy --prod --dir=dist
# Preview/draft deploy (does not touch production, prints a "Draft URL"):
netlify deploy --dir=dist
```
Netlify MCP tools are also available in this environment (`mcp__<netlify-connector-id>__netlify-*`) but the CLI via PowerShell has been the more predictable path used so far. When sharing a preview deploy with the user, always restate the actual Draft URL directly in the chat message — don't just say "see the build output above."

### Android APK
```bash
npm run build
npx cap sync android

# Gradle regularly exceeds a single PowerShell tool call's response window (~20-45s).
# Launch it detached and poll the log instead of waiting synchronously:
#   [System.Diagnostics.Process]::Start(...) redirecting to build_log.txt
#   then poll with `Get-Content -Tail` after `Start-Sleep`
# cd android && gradlew clean assembleDebug   (use `clean` for extra safety against stale artifacts)
# Output: android/app/build/outputs/apk/debug/app-debug.apk

copy android\app\build\outputs\apk\debug\app-debug.apk CrewChief.apk
```

**Java:** Java 21 required (as of @capacitor/filesystem@8). Installed at:
`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`
Set JAVA_HOME before building:
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

**versionCode / versionName:** last verified `6` / `"3.3"` (checked directly in `android/app/build.gradle` on 2026-07-01). **Re-verify this before trusting it** — see the unresolved anomaly note in §0: this value has been found silently reverted to old values (e.g. back to `3`/`"3.0"`) more than once during session 8, by a process other than the assistant. Bump both values with every APK build meant to install over a previous version.

**`android/app/build.gradle` is gitignored** (`.gitignore` has a `build.gradle` entry that matches this path specifically) and contains the release keystore password in plaintext (`CrewChief2024!`). This means: (1) version bumps here are **local-only and never appear in git history/commits**, and (2) don't assume `git log`/`git diff` will show version history for this file — check the live file directly.

**Android API 36 readiness (session 8):** bumped ahead of Google Play's Aug 31, 2026 Android 16 (API 36) requirement deadline.
- `android/variables.gradle`: `compileSdkVersion` / `targetSdkVersion` 35 → 36
- `android/build.gradle` (and a duplicate, seemingly-unused copy at repo root `build.gradle` — kept in sync anyway): AGP classpath `8.3.2` → `8.9.1`
- `android/gradle/wrapper/gradle-wrapper.properties`: Gradle `8.7` → `8.11.1`

**Android permissions required** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```
Plus (session 8, for native Google OAuth deep-link return) a second `<intent-filter>` on `MainActivity` — see §7a.

---

## 14. Git Workflow

**Rule: Never merge a feature branch to master without explicit user approval.**

| Branch | Status |
|--------|--------|
| `master` | Production — all features merged here; deployed to Netlify |

Feature branches merged to master (history, newest first):
- `feature/car-profiles` — Car entity, GarageView, byActiveCar scoping, shock sync (session 6)
- `feature/session-v2` — Session modal rework, weekend reports, tire inventory
- `feature/weekend-v2` — Weekend report, ExportView, SettingsView weekend props

**RULE: Never merge a feature branch to master without explicit owner approval.**

Standard commit:
```bash
git add -A
git commit -m "feat: description"
git push
```

---

## 15. Known Issues / Gotchas

| Issue | Root Cause | Status |
|-------|-----------|--------|
| Deleted weekends return on refresh | `pushWeekends` upserts but never deletes; `pullAllData` re-adds the cloud record | **Fixed** — `deleteWeekendFromCloud` now called on delete |
| +Session button did nothing | Header button called `setNewSessionName` / `setNewSessionWeather` — state vars removed in session-v2 rework; silent JS runtime error swallowed click | **Fixed** — replaced with `handleOpenNewSessionForm()` |
| Task click from Dashboard navigates blank | `onGoToTodos={() => setActiveTab('todos')}` — `'todos'` is not a valid tab ID; correct ID is `'trackers'` | **Fixed** (session 7) |
| GPS "Location Denied" on Android | `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` missing from AndroidManifest.xml | **Fixed** (session 7) |
| Sessions tab only shows active weekend | `RaceWeekendView` only rendered `currentWeekend.sessions` | **Fixed** (session 7) — full accordion with all weekends |
| Ghost weekend on new session | `newSessionWeekendId` persisted stale ID from deleted weekends | **Fixed** (session 7) — `handleOpenNewSessionForm` validates against `weekends` array |
| APK requires Java 21 | `@capacitor/filesystem@8` added `jvmToolchain(21)` | **Fixed** — install JDK 21 via `winget install Microsoft.OpenJDK.21` |
| Vite build doesn't type-check | Vite/esbuild transpiles only. Run `npm run lint` (`tsc --noEmit`) to catch type errors before pushing | Ongoing — always lint before deploy |
| TailwindCSS v4 — no config file | All customization is in `src/index.css` `@theme {}` block | Remember this when adding new tokens |
| Cloud-wins merge on login | `mergeIntoLocalStorage` always lets cloud overwrite local on login. Offline edits made before login may be overwritten | By design — acceptable tradeoff for multi-device sync |
| Session `type` vs `name` fields | Both set to the same display string. Legacy type union `'H1' | 'Q1' | ...` preserved for backward compat | Don't rely on the `type` field for new logic |
| "Clear All Data" left todos/accounting/shopping visible | `handleClearAllData` never reset those three React state arrays, and never deleted cloud `todos` rows | **Fixed session 8** — see §9 SettingsView |
| `byActiveCar<T>()` generic collapses to `{carId?: string}` on bare calls | TypeScript infers the constraint type instead of the array's element type when no explicit type argument is given | **Fixed session 8** at all known call sites — always pass the type explicitly, e.g. `byActiveCar<Setup>(...)` |
| PWA (Add to Home Screen) rendered noticeably smaller than the APK | No cross-platform UI-scale normalization; root font-size approach didn't fully account for Chrome's own text-inflation behavior | **Fixed session 8; simplified C6A** — `zoom` with Default/Large choices, see §2 and §22 |
| `android/app/build.gradle` versionCode/versionName reverting unexpectedly; once a new source file was found staged for deletion | **Unresolved** — suspected concurrent process/other AI session touching the same working copy; not caused by this assistant | **Open** — re-verify current values before trusting them; watch for unexplained working-tree changes (see §0) |
| Sandbox (`mcp__workspace__bash`) can't push to git; occasional spurious `tsc`/build errors there | No git credential helper in the Linux sandbox; cross-platform mount quirks | **Known limitation** — use Windows-MCP PowerShell for real builds/pushes on this repo |

---

## 16. Team Profile (`TeamView.tsx` + Supabase)

**Supabase migration applied:** `ALTER TABLE teams ADD COLUMN IF NOT EXISTS profile_data jsonb;`

**Types (`src/types.ts`):**
```ts
interface TeamProfile {
  racePassUrl?: string;
  transponderIds?: string;
  hometown?: string;
  age?: string;
  carNumber?: string;
  division?: string;
}
interface Team {
  id: string; name: string; banner_url?: string; created_at: string;
  profile?: TeamProfile;
}
```

**Supabase helper (`src/lib/supabase.ts`):**
```ts
export async function updateTeamProfile(teamId: string, profile: TeamProfile): Promise<boolean>
```
`getUserTeam` now maps `profile_data` → `team.profile`.

**TeamView.tsx UI:**
- Team owner: "Team / Driver Profile" card with edit button → inline form (Car #, Division, Hometown, Age, Transponder ID, MyRacePass URL)
- Members: read-only view of the same fields
- MyRacePass URL renders as a clickable link
- Save calls `updateTeamProfile` directly (no debounce)

---

## 17. Data Flow Diagram

```
User action
    │
    ▼
React state (useState)  ─────────────────────────────────────► UI re-renders
    │
    ├──► localStorage.setItem(key, JSON)      (synchronous, immediate)
    │
    └──► push*(data, userId)                  (debounced 500ms → Supabase upsert)
              │
              └── On delete: also deleteWeekendFromCloud(id)   (immediate)

On login / page refresh (authenticated):
    pullAllData(userId)
        │
        ├── mergeIntoLocalStorage(...)     (cloud items overwrite matching local by id)
        └── setState(prev => merge loop)   (same merge applied to React state)
```

---

## 18. Recent Changes Log (feature/session-v2)

| Change | File(s) |
|--------|---------|
| Session short codes in display (HL, Qual, Heat, Feat.) | `App.tsx` — `buildSessionName`, `SESSION_CODES` |
| Dashboard: Setups / Tires / Open Tasks collapsible sections | `DashboardView.tsx` |
| Dashboard: session rows show full name, no badge box | `DashboardView.tsx` |
| Dashboard: tire rows in single-line format (`#ID Size \| BS \| Compound \| Duro`) | `DashboardView.tsx` |
| Sessions tab: collapsible active session editor | `RaceWeekendView.tsx` |
| Sessions tab: air pressure always visible; tire dropdown only if inventory exists | `RaceWeekendView.tsx` |
| Sessions tab: "Import from Setup" button fills corner tires from bound setup | `RaceWeekendView.tsx` |
| Sessions tab: "Start New Session" CTA moved between Weekend Info and Active Log | `RaceWeekendView.tsx` |
| Sessions tab: tire uniqueness — same tire can't be on 2 corners of same session | `RaceWeekendView.tsx` |
| Reference tab: label "Symptom"; short option labels; no `[TIGHTEN]`/`[LOOSEN]` prefix | `QuickReferenceView.tsx` |
| Setup: tire uniqueness — same tire can't be on 2 corners of same setup | `SetupView.tsx` |
| Setup: "JBar" → "JBar Length"; "Load Weight" → "Scale Weight (lb)" | `SetupView.tsx` |
| Setup: tire inventory single-line format; size auto-appends `"` on blur | `SetupView.tsx` |
| Setup: calculated weight fields (Nose %, Left %, Cross %, LR Split, Total) | `SetupView.tsx` |
| Team profile fields: Car #, Division, Hometown, Age, Transponder, MyRacePass URL | `TeamView.tsx`, `types.ts`, `lib/supabase.ts` |
| Supabase: `profile_data jsonb` column added to `teams` table | migration applied |
| Bottom nav: Trackers now appears before Reference | `App.tsx` |
| Delete weekend now syncs correctly to cloud | `App.tsx`, `lib/sync.ts` |
| Tire cloud sync: `tire_inventory` Supabase table + RLS; `pushTires`, `pullTires`, `deleteTireFromCloud` | `lib/sync.ts`, `App.tsx` |
| `TireInventoryItem`: added `airPressure?: string` and `createdAt?: string` fields | `types.ts` |
| Tire add form: Air Pressure (psi) field; new tires get `createdAt` ISO timestamp | `SetupView.tsx` |
| Tire list: sort by Newest/Oldest/Size↑/Size↓; filter by Compound | `SetupView.tsx` |
| Tire list: `airPressure` shown in single-line row if present (both Dashboard and Setups tab) | `SetupView.tsx`, `DashboardView.tsx` |
| App pulls tires from cloud on login; pushes on every save; deletes from cloud on tire delete | `App.tsx` |

**feature/car-profiles additions:**

| Change | File(s) |
|--------|---------|
| `Car`, `CAR_TYPES`, `CarType` types added | `types.ts` |
| `ShockCorner`, `ShockDataPoint`, `ShockSession` promoted to global types | `types.ts` |
| `carId?: string` added to `Setup` and `TireInventoryItem` | `types.ts` |
| `INITIAL_CARS`, `INITIAL_SHOCK_SESSIONS` constants added | `data.ts` |
| `pushCars`, `pullCars`, `deleteCarFromCloud`, `pushShockSessions`, `pullShockSessions`, `deleteShockSessionFromCloud` | `lib/sync.ts` |
| `car_id` column mapped in all setup/tire push+pull | `lib/sync.ts` |
| `byActiveCar` filter helper | `lib/scope.ts` (new) |
| Supabase migration 009: `cars`, `shock_sessions` tables; `car_id` on `setups` + `tire_inventory` | `supabase/migrations/009_cars.sql` |
| App: `cars`, `activeCarId`, `shockSessions` state; all car handlers; header chip; backfill effect | `App.tsx` |
| GarageView component (car CRUD + active-car selector) | `src/components/GarageView.tsx` (new) |
| SettingsView: Garage tab added (first tab); `initialSubTab?` prop; "Appearance" → "Style" | `SettingsView.tsx` |
| SetupView: car scoping (`byActiveCar`), `carId` stamping, empty-state guards | `SetupView.tsx` |
| SmasherLoadsView: state lifted to App; props for sessions + onSave + activeCarId | `SmasherLoadsView.tsx` |
| DashboardView: `byActiveCar` applied to setups + tires in dashboard panels | `DashboardView.tsx` |

---

## 19. Car Profiles Architecture *(feature/car-profiles)*

### Design: Option A — Relational carId tagging
One combined dataset. Views filter by active car using `byActiveCar`. The master arrays in App.tsx always hold all items for all cars — filtering happens only at display time, never mutating the source arrays.

### Scoped vs. Global entities
| Scoped to active car | Global (never car-scoped) |
|---------------------|--------------------------|
| `Setup[]` | `RaceWeekend[]` |
| `TireInventoryItem[]` | `ActiveSession` |
| `ShockSession[]` | `AccountingEntry[]` |
| | `ShoppingItem[]` |
| | `Todo[]` |
| | `AppTheme` |

### Active car — device-local
`activeCarId` (from `race_notes_active_car`) is **never synced to Supabase**. Each device/browser independently picks which car is "active." This is intentional — one person might be working on two cars simultaneously on different devices.

### Filter helper (`src/lib/scope.ts`)
```ts
export const byActiveCar = <T extends { carId?: string }>(
  items: T[],
  carId: string | null,
): T[] => (carId ? items.filter(i => i.carId === carId) : items);
```
When `carId` is `null` (no active car), **all items are returned** — no data is hidden, just unfiltered.

### Deletion policy
A car **cannot be deleted** if it owns any setup, tire, or shock session data. `handleDeleteCar` in App.tsx checks `carSetupCount + carTireCount + carShockCount > 0` and alerts the user instead of deleting. GarageView's delete button is also disabled with a tooltip showing the counts.

### One-time backfill
Runs once after the first post-login `doPull` completes, guarded by a `didBackfill` `useRef`. If `cars.length === 0` at that point, it creates a single `defaultCar` from the first setup's chassis/carType and stamps all existing setups, tires, and shock sessions with that car's id. This migrates legacy data seamlessly without user interaction.

### Empty-state guards
When `activeCarId` is null: "New Setup" form is replaced with a prompt, "Add Tire" and "New Session" buttons are disabled — all say "Add a car in Settings → Garage to start." App.tsx also auto-selects `cars[0]` if `activeCarId` is missing but cars exist.

---

## 20. Tire Usage History (session 8)

**Goal:** for each tire in inventory, show which sessions it was used in, at which track, on which corner, in which session type, and an estimated lap count — without adding a new Supabase table (derived entirely from existing `RaceWeekend`/`SessionRecord` data).

**`src/lib/tireHistory.ts` (new file):**
```ts
inferSessionType(session: SessionRecord): SessionType | null
// Falls back to regex matching on the legacy name/type string when sessionType wasn't stored
// (e.g. "Heat" → Heat Race, "A-MAIN" → Feature, "Qual" → Qualifying, "HL" → Hot Laps, "Test" → Test).

estimatedLapsFor(session: SessionRecord): number
// SESSION_TYPE_LAPS[inferSessionType(session)] ?? 0

interface TireUsageRecord {
  weekendId, weekendName, track, date,
  sessionId, sessionName,
  corner: ShockCorner,          // which corner the tire was mounted on for that session
  sessionType: SessionType | null,
  inferred: boolean,            // true if sessionType came from inferSessionType() rather than a stored field
  laps: number,
}

getTireUsageHistory(tireId: string, weekends: RaceWeekend[]): TireUsageRecord[]
getTireTotalLaps(tireId: string, weekends: RaceWeekend[]): number
getAllTireUsage(weekends: RaceWeekend[]): Record<string, TireUsageRecord[]>   // keyed by tireId, for bulk export

buildTireUsageCsv(tires: TireInventoryItem[], weekends: RaceWeekend[]): string
downloadTireUsageCsv(tires, weekends): void   // Blob + object URL download

buildTireUsageReportHtml(tires, weekends): string  // styled printable HTML, window.onload = () => window.print()
printTireUsageReport(tires, weekends): void         // window.open + write + trigger print
```

**How a tire's corner/session is determined:** it walks each `SessionRecord.tires` (per-corner `TireDetails`, each carrying a `tireId`) across every `RaceWeekend.sessions[]`, and for every corner where `tireDetails.tireId === targetTireId`, emits one `TireUsageRecord`.

**UI:** in `SetupView.tsx`'s Tires tab — see §9 `SetupView.tsx` for the expandable-row and export-button details.

---

## 21. Shock Load Compare/Overlay (session 8)

**Goal:** compare/overlay multiple `ShockSession` "smasher load" graphs (e.g. before/after a spring change) as both a chart and a table, interpolating between each session's own real datapoints so the table isn't limited to whatever heights happen to coincide across sessions.

**`src/lib/shockCompare.ts` (new file):**
```ts
interpolateLoadAtHeight(session: ShockSession, height: number): number | null
// Sorts session.points by height, does linear interpolation between the two nearest
// real points. Returns null if the session has no data or `height` falls outside
// that session's own measured range — deliberately does NOT extrapolate.

interface ComparisonRow { height: number; values: (number | null)[]; }

buildComparisonRows(sessions: ShockSession[]): ComparisonRow[]
// Rows = the UNION of every distinct height value across all selected sessions
// (rounded to 2 decimals), sorted ascending — not an arbitrary fixed grid.
// Each row's `values` array has one interpolated (or null) load per session,
// in the same order as the `sessions` array passed in.

buildComparisonCsv(sessions: ShockSession[]): string
downloadComparisonCsv(sessions: ShockSession[]): void
```

**UI:** `src/components/SmasherLoadsView.tsx` — see §9 `SmasherLoadsView.tsx` for the Compare toggle, `ShockCompareChart`, `COMPARE_PALETTE`/`sessionCompareColor(index)`, and the comparison table + CSV export button.

---

## 22. Two-Choice Zoom-Based UI Sizing (C6A override)

See §2 "UI scaling — 2-choice `zoom` system" for the full mechanism (constant `16px` root font-size + CSS `zoom` on the app shell driven by `--ui-zoom`).

**Why this was needed:** the user reported the PWA (installed via Chrome "Add to Home Screen") rendered noticeably smaller than the same app packaged as an APK, and that even the APK could stand to be a bit larger for pit-side use on small phones in bright sunlight. Root `font-size` scaling alone didn't fully solve either problem — some UI used fixed-`px` Tailwind classes that don't scale with `rem`, and Chrome's own text-inflation behavior interacted unpredictably with a root font-size change.

**Current behavior:** CSS `zoom` applies to `#applet-main-body` and `#applet-auth-gate`. Default is 1.15 and Large is 1.45. Legacy Standard and XX-Large normalize to those two current choices. Chromium text inflation stays normalized with `text-size-adjust: 100%`.

**`SettingsView.tsx` Style tab:** two buttons only—Default and Large. Numeric scale values are intentionally hidden from users.

---

## 23. UX-R1 Regression Repair + Codex Model Handoffs (2026-07-13)

- Dashboard renders the team identity/banner before Get Race-Ready and Log Run.
- `src/lib/colorContrast.ts` derives a readable light-mode accent against the
  darkest real light surface without mutating the stored theme accent.
- Explicit Tailwind `text-[8px]` through `text-[11px]` utilities render at a 12px
  minimum. Chromium `zoom` remains the app-shell scaling path; C6A reduces the UI
  to Default/Large while preserving legacy stored values.
- The persistent header exposes a named **Tuning Guide** while the bottom shell
  stays at five tabs. C6A supersedes R1's AFCO/package wording with basic dirt-oval
  direction and direct High/Medium/Low explanations.
- `src/lib/checklists.ts` fingerprints exact untouched starter semantics.
  Reconciliation waits for signed-in pull settlement, seeds only missing starters,
  removes only exact duplicates, pushes only seeded rows, and cloud-deletes only
  discarded duplicate IDs. Customized and same-name templates survive.
- Material Symbols Outlined is local (`material-symbols@0.45.7`); Workbox includes
  WOFF2 and permits the 3.96 MiB font with a 5 MiB precache limit. Android cold
  offline launch therefore keeps icons and layout intact.
- Runtime QA: 320×800 Android WebView passed dark/light × Standard/Large/X-Large/
  XX-Large; cold offline launch passed after HTTP/service-worker cache removal.
  Current APK is versionCode 15/versionName 4.0 at root `race_notes.apk`.
- Project Codex roles live in `.codex/agents/*.toml`. Model changes happen by
  continuing one task with an explicit model override: SOL planning/QA → Terra
  implementation → SOL QA. `handoff_thread` is for checkout/worktree/host state,
  not model selection. Runtime truth is rollout `turn_context.payload.model`.
  Verify config plus a smoke-token sequence with
  `powershell -ExecutionPolicy Bypass -File scripts/verify-agent-handoff.ps1 -Token <token>`.

---

## 24. UX Chunk 5 — Trackside Setups (2026-07-13, `d5ef1f4`)

### Canonical setup state and car isolation

- `App.tsx` now routes Setups and quick-log through one full-array save seam:
  update React `savedSetups`, persist `race_notes_saved_setups`, optionally set
  and persist active `setup`, then `pushSetups(fullMasterArray, ...)` when signed in.
- Car switches select only `pickLatestSetupForCar(savedSetups, carId)`. A car with
  no setup never sees or uses the previous car's setup.
- `src/lib/setupCompat.ts` exports newest/prior same-car selectors, `cloneSetup`,
  and `makeBlankSetup`. Clone is deep; cross-car tire inventory links are cleared.

### Numeric and pressure compatibility

- `src/lib/setupSteps.ts` centralizes step size, decimals, units, legacy numeric
  parsing, canonical formatting, four-bar adjustment IDs/labels, fractional-safe
  stagger, linked tire-size resolution, and pressure-block compatibility.
- Corner storage remains string-based. Rendering never rewrites a legacy string;
  the first deliberate stepper edit writes canonical numeric text.
- `mergeImportedSetupPressure()` prevents a blank setup pressure from erasing an
  existing manual/logged tire pressure or session pressure-block value. A real
  setup pressure replaces both. If no pressure imports, existing provenance stays.
- `SessionRecord.pressures` and `TireDetails.airPressure` are resolved/mirrored by
  shared helpers. Optional `pressureSourceNote` carries prior-session/setup origin;
  a manual edit clears stale carry provenance.

### UI surfaces

- Setups retains four controls: Setups, Loads, Tires, Compare.
- `FourBarQuickAdjust.tsx` is controlled and shared. In Setups it lives inside the
  expanded setup after all four corner forms. LR and RR each show full Top and
  Bottom bar measurements and both Ride Height/Full Droop angles.
- Corner forms render physical order LF/RF then LR/RR. Numeric fields use
  `NumberStepper`; tire size remains free text so values such as `86 1/2` work.
- New setup defaults to copying the newest same-car setup; Start Blank remains.
  A first setup for a car activates immediately. Setup/session Compare opens with
  the selected setup and immediate same-car prior setup.
- Quick-log `FOUR-BAR QUICK-ADJUST` uses the same setup object/component contract.
  Each field has one stable `SetupAdjustment` ID, so repeated taps update one row.
- `TiresSubView.tsx` shows current linked set, stagger, latest linked-tire pressure,
  cycles, estimated laps, active-car inventory CRUD, sorting/filtering, CSV/report,
  lifecycle and usage.

### Verification and rollout

- Harnesses: `scripts/chunk5-setup-harness.ts` and
  `scripts/chunk5-tires-harness.ts`; both print PASS and exit nonzero on failure.
- Type-check remains exactly the three documented baseline errors. Production
  Vite build: 539 modules; Workbox: 16 precache entries.
- Android QA used debug versionCode 16/versionName 4.1 at 320 CSS px / XX-Large.
  `adb install -r` initially served stale Workbox files; deleting only WebView
  Service Worker/HTTP/code cache with `run-as` preserved localStorage and loaded
  the current bundle. `pm clear --cache-only` did not remove Service Worker data.
- Final Netlify draft:
  `https://6a5509763fc2865568212af7--crew-chief-race-notes.netlify.app`.
  Production, `master`, root release APK, and remote branch were not changed.

---

## 25. UX Chunk 6A — Setup / Measurement Refinement (2026-07-13)

- `makeBlankSetup()` alone owns new-blank defaults: 500 lb, 17 in Ride Height
  C-to-C, 10 PSI, front caster 3, LF camber 4, RF camber -4. `INITIAL_SETUP`,
  normalization, copy-last, and existing records remain non-destructive.
- `CornerSetup` adds optional bottom-bar Ride Height and Full Droop angles.
  Legacy `bottomBarAngle` remains display-only when its measurement position is
  unknown. Setups now place complete LR then RR Top/Bottom bars after corners.
- Tire cards show the linked tire's last logged pressure, heat cycles, and
  estimated laps. Pressure history sorts race date/time before ID timestamp and
  can filter by linked tire per corner, preventing swap mismatches.
- `ShockSession` adds optional `rideHeightCtoC`. Visible terminology is Load
  Session. `sync.ts` explicitly maps `ride_height_ctoc`; deletion now removes the
  cloud row as well as local state. Migration
  `20260714010630_add_load_session_ride_height.sql` was applied and verified on
  Supabase project `swblfeayxoprodhwxqak`.
- Height/load graph math was already correct for the requested display: lower
  physical height renders lower on screen. Runtime fixture: 12 in/100 lb `cy=18`,
  10 in/200 lb `cy=176`; single/compare harness equations agree.
- Style UI exposes only Default (internal `large`, 1.15) and Large (internal
  `xlarge`, 1.45); scale values are hidden. Legacy `standard` normalizes to
  Default and `xxlarge` to Large without changing the storage key/type union.
- Tuning Guide uses basic dirt-oval language, no AFCO/package-specific claims,
  and explains High/Medium/Low in direct try-first/try-next/fine-tune terms.
- Feature commit `ae9395b`. SOL QA PASS using verified `gpt-5.6-sol` high runtime
  metadata. Three focused harnesses PASS; cavecrew review has zero code findings;
  lint remains exactly three known baseline errors; Vite build PASS.
  Local mobile runtime at 390×844 passed light/dark contrast, setup defaults,
  four-bar order, Load Session create/edit/reload, and graph direction.
- Netlify draft: `https://6a558ea45dc5716d3bed026a--crew-chief-race-notes.netlify.app`.
  Auth gate and console PASS. Production remains unchanged.
- C6B is intentionally separate: immutable Baseline → editable Weekend Setup →
  immutable Final → editable Current Setup. Finish Weekend will always be
  available at the page bottom, including test days with zero sessions.

---

## 26. UX Chunk 6B — Setup Weekend Lifecycle (2026-07-13)

- `src/lib/setupLifecycle.ts` is the lifecycle authority: start, finish, lock checks,
  setup diff history, finished-event checks, and timestamp-aware local/cloud merge.
- New weekends clone a same-car source into distinct `setup-baseline-{weekendId}` and
  `setup-weekend-{weekendId}` rows. `RaceWeekend.setupId` remains the Baseline alias;
  `activeSetupId` owns every event edit and run setup lookup.
- Baseline, Final, and completed Weekend Setup are immutable in UI and at the
  `App.tsx` save boundary. Clone remains allowed and produces editable Current.
- Finish is local-first and permits zero sessions. It creates `setup-final-*`, locks
  Weekend Setup, marks the weekend finished, clears active weekend/run, creates
  `setup-current-*` from Final, and selects Current. Finished weekends remain history
  and are excluded from automatic selection/context.
- Setup and weekend sync now use explicit row mappers and `updatedAt`. Toe, J-Bar,
  J-Bar frame/pinion, lifecycle IDs/status, version labels, locks, and change logs all
  round-trip. ActiveSession also carries `updatedAt` to protect an offline finish.
- Migration `20260714020037_setup_weekend_lifecycle.sql` is additive and was applied
  to project `swblfeayxoprodhwxqak`; live information schema and migration history
  verified. Existing RLS/advisor findings were unchanged by this column-only migration.
- Terra feature commit `2a941d3`. Harness, cavecrew, exact lint baseline, build, 390 px
  zero-run runtime, dark/light, and draft shell passed. Draft:
  `https://6a5599e37111d0563ffaf5f3--crew-chief-race-notes.netlify.app`.
  SOL QA attempt 1 failed because new-weekend fallback could cross cars after a switch,
  legacy weekends could not finish, and interrupted local Finish could not recover.
  Live schema/RLS/migration history remained valid; repair details follow.
- Terra repair commit `874fecc` separates active-car source selection from event-owned
  RaceWeekend setup routing. `pickWeekendSourceSetup()` accepts only explicit/current/
  latest setups belonging to selected car; otherwise new-weekend creation uses blank.
- Legacy Finish creates a dedicated Weekend snapshot from valid `setupId`, or from
  caller-provided safe same-car/blank fallback only when `setupId` is absent. Dangling
  explicit links fail safely instead of borrowing currently selected car data.
- Partial-Finish retry recognizes matching locked deterministic snapshots, replaces
  duplicate Weekend/Final/Current IDs, and preserves their original lock/update times
  and history. Expanded harness covers cross-car source, zero-run legacy, dangling link,
  no-source blank fallback, partial retry, chronology, history, and uniqueness.
- Repair gate: harness PASS; cavecrew re-review clean; exact three-error lint baseline;
  build PASS (540 modules, 16 Workbox entries); 390 px draft shell and console PASS.
  Draft `https://6a55a024d663b44ca4f639c7--crew-chief-race-notes.netlify.app`.
  Migration unchanged; independent QA attempt 2 details follow.
- SOL QA attempt 2 failed four remaining edges. `raceWeekendSetup` uses generic
  selected-car fallback when event-owned setup cannot resolve; no-link legacy Finish
  passes selected-car data as fallback; matching deterministic Final/Current rows can
  be reused while Weekend Setup is still unlocked; and completed-weekend relationship
  does not lock an unlocked partial-cloud Weekend snapshot at App/UI boundaries.
- Direct fixture showed no-link legacy Finish copied `car-b`, and an unlocked Weekend
  gear `7.00` reused stale Final gear `6.00`. Repair 2 must add event-only UI resolution,
  blank/proven legacy fallback, locked-only recovery reuse, and relational finished-
  weekend locking. Existing harness/build/schema gates remain green; C7 stays locked.
- Terra repair 2 commit `7b58b30` makes event UI resolution explicit: with an active
  weekend, RaceWeekend receives its validated Weekend Setup or `null`, never the car
  selector's generic setup. Missing ownership disables run/quick-adjust editing with
  direct recovery copy while Finish Weekend remains available.
- No-link legacy Finish now gets a fresh `makeBlankSetup()` fallback. Selected car
  identity may stamp the future Current row, but selected setup bytes are never copied.
  Valid linked legacy upgrade and dangling explicit-link rejection are unchanged.
- Deterministic Final/Current recovery rows are reused only when the matching Weekend
  snapshot is already locked. An unlocked Weekend rebuilds both from current bytes and
  replaces/dedupes stale IDs. `isSetupLocked(setup, weekends)` also locks a Weekend-role
  Setup linked to a finished weekend even if partial cloud data omitted `lockedAt`.
  App mutation/deletion boundaries and Setup UI both use that relationship; Clone stays
  enabled and produces an editable Current copy.
- Repair-2 harness adds Car A event/Car B selector isolation, missing event-setup UI
  selection, exact-blank no-link Finish, unlocked gear 7 versus stale gear 6 recovery,
  deterministic uniqueness, and relationship-lock fixtures. Harness PASS; cavecrew no
  issues; exact three-error lint baseline; build PASS (540 modules, 16 Workbox entries);
  `git diff --check` PASS. Draft
  `https://6a55a43a8cc5f6b9da612c69--crew-chief-race-notes.netlify.app` boots at
  390×844 with zero console errors. No migration/live schema change.
- SOL QA attempt 3 PASS. Independent code inspection plus two cavecrew reviews found
  no issues. Harness, exact lint baseline, 540-module/16-entry build, diff check, and
  clean-tree checks passed. Live project `swblfeayxoprodhwxqak` has migration
  `20260714020037`, all 23 rechecked mapped lifecycle/scalar columns, RLS enabled, and
  authenticated CRUD grants on both lifecycle tables. Tables contain zero rows, so no
  authenticated lifecycle round-trip fixture exists. Security advisor has no relevant
  setup/weekend finding; existing RLS performance warnings predate C6B. Current
  Supabase new-table grant change does not affect this existing-table column migration.
  C6B closed; C7 unlocked.

## 27. UX Chunk 7 — Expanded Quick Adjust (2026-07-13)

- Terra feature commit `58e4522` is CODE_PASS and awaits independent SOL QA. C8 must
  not start until that verdict.
- `src/lib/quickAdjust.ts` is pure C7 authority. `resolveQuickAdjustTarget()` accepts
  only device-active unfinished weekend, its exact `activeSetupId` Weekend Setup, and
  an active run ID still present in that weekend. No selected-car setup fallback.
- `applyQuickAdjust()` derives changes from latest App refs, then produces one
  `SetupChange` and one `SetupAdjustment` with shared timestamp, `sessionId`/`runId`,
  and optional `loadSessionId`. App persists setups, weekend session mirror, active
  session, and active setup together before debounced cloud writes. Monotonic command
  suffixes prevent same-millisecond collisions.
- `QuickAdjustPanel.tsx` supplies LF/RF/LR/RR Spring Rate ±25 lb, cumulative Spring
  Rounds ±0.5, independent shock note and Load Session binding, J-Bar Frame/Pinion
  ±0.25 in, manual gear, Other Change, and Four-bar access. Step actions parse stored
  values only when committed; blank/non-numeric spring/J-Bar values require manual
  numeric entry. Existing strings remain untouched until edit.
- Corner JSON adds optional `springRounds`, `rideHeightNeedsReview`, and `shockNote`.
  Spring-round input sets review marker even when cumulative value returns to zero.
  Only explicit `loadCtoC` editing in Setup UI clears it. Marker is displayed beside
  Ride Height C-to-C and omitted from generic diff noise.
- Load Session filtering uses event Setup `carId` plus selected corner. Setup UI now
  lists real Load Sessions instead of sample data. Existing `boundGraphId` stores link.
- `src/lib/setupSync.ts` extracts setup row mapping from `sync.ts` without row-shape
  change. Corner/change-log/run objects remain JSONB, so C7 requires no SQL migration.
- `scripts/chunk7-quick-adjust-harness.ts` covers numeric normalization/steps, strict
  event and present-run resolution, marker set/clear, same-car/corner filtering,
  independent shock fields, rapid sequential exact-once logs, mapper round trip, and
  lifecycle lock rejection. Harness and diff check pass; lint remains exact three
  known baseline errors. Cavecrew review findings were fixed; re-review found no issues.
  Full build/cloud/mobile/Netlify gate is intentionally consolidated after C8.
- SOL QA attempt 1 failed three edges. Numeric step helpers use grid-snapping format:
  `510 lb +25` incorrectly becomes `525`, and `9.10 in +0.25` becomes `9.25`; exact
  deltas must preserve off-grid bases. Raw `activeWeekendId` targeting a finished
  weekend makes App fall back to selected-car Setup for RaceWeekend UI. Finally,
  `RaceWeekendView.hasActiveSession` omits unfinished status and current session-record
  membership, so stale/deleted runs can render Quick Adjust despite App write rejection.
  Repair belongs to Terra; C8 stays locked until SOL QA attempt 2 passes.
- Terra repair `030122c` replaces grid snap with precision-preserving normalization
  and exact relative addition. It adds `selectRaceWeekendSetupForSelection()` so only
  an absent raw selection allows generic current-car Setup; stale/invalid/finished IDs
  return null. `isQuickAdjustRunAvailable()` now gates UI on unfinished event, exact
  owned Weekend Setup, matching run IDs, and session-record membership. Expanded
  off-grid/selection/deleted-run fixtures pass; lint remains exact baseline; cavecrew
  found no issues. Await SOL QA attempt 2; C8 remains locked.
- SOL QA attempt 2 PASS. Independent inspection verified exact relative numeric
  behavior, raw weekend ownership, present-run UI membership, atomic one-to-one logs,
  marker lifecycle, load filtering, lifecycle locks, and mapper parity. Expanded C7
  harness and repair-range diff check pass; lint remains exact baseline; cavecrew found
  no issues. C7 closed; C8 unlocked. Combined full runtime gate remains due after C8.

## 28. UX Chunk 8 — Trackers and Maintenance Logs (2026-07-13)

- Terra feature `2f60420` passed independent SOL QA; C8 is closed and C9 is unlocked.
- Visible UI uses **Maintenance Logs**. Internal `SubTab='service'`, `MaintenanceLog`
  values, localStorage keys, and Supabase table/column names are deliberately unchanged.
- `TodoItem.kind` is optional `core|adhoc`; missing means core. Optional `sourceType`,
  `sourceId`, `sourceCycle`, and `removedUntilReset` live inside existing `todos.items`
  JSONB. `src/lib/checklistMaintenance.ts` is reset/reconciliation authority.
- Manual tasks are ad-hoc. Imported and maintenance tasks are core. Reset clears core
  and kept ad-hoc completion state, drops ad-hoc when preference is off, restores hidden
  core definitions, and follows later template item edits/additions/deletions using
  stable template source IDs and hidden tombstones.
- Automatic jobs use stable `maintenance:<componentId>` source plus service-cycle key.
  `pct >= 0.90` creates one current job; repeated reconciliation is idempotent. Below
  90% removes unfinished current jobs only. Completed history remains, and a new/current
  due job can coexist when reset or a later service cycle requires it.
- App gates reconciliation until initial cloud pull completes, then saves Todo changes
  through one React/localStorage/cloud handler. New Weekend reads remembered
  `race_notes_keep_added_items` and resets Main Checklist local-first.
- Checklist rows are whole-row 56px toggle targets. Task edit retains source/completion
  metadata and supports text, notes, and assignment for every origin. Stale/offline
  assignees remain unless the user explicitly chooses Unassigned.
- Templates are removed from the visible top-level tab bar and mounted under Checklist
  → Edit List. Legacy internal `'templates'` navigation opens that nested manager.
- `AccountingEntry.category` is optional and local-only. `accountingDefaults.ts` derives
  local-today date, last-entered category (`Other` for legacy), and five newest distinct
  description/category repeats; chips do not alter amount/date.
- No schema migration. Harness `scripts/chunk8-trackers-harness.ts` plus C6A/C6B/C7
  harnesses pass. Lint exact baseline; build 545 modules/16 PWA entries; cavecrew clean.
  Android debug dark mobile smoke confirms current naming and due-job injection. Draft:
  `https://6a55b29bbc2a11f748b406a3--crew-chief-race-notes.netlify.app`.
- SOL QA re-ran C6A/C6B/C7/C8 harnesses, exact three-error lint baseline, the
  545-module/16-entry production build, and feature-range diff check. Independent
  cavecrew review found no issues. Existing Todo JSONB carries the optional fields;
  no migration is needed. Authenticated live Todo rows were unavailable and are not
  claimed. The draft predates only the final hidden-template tombstone correction;
  source inspection and the focused fixture cover that edge.

## 29. UX Chunk 9 — PDF Share, Context Help, Racer Copy (2026-07-13)

- Terra feature `c8c4a21` is CODE_PASS and awaits independent SOL final QA.
- `src/lib/exportPdf.ts` owns pure printable report documents plus dependency-free PDF
  file bytes. `src/lib/reportShare.ts` owns native Filesystem/Share, browser Web Share,
  desktop download, quiet cancellation, and honest failure results. ExportView retains
  its existing browser print flow.
- Setup and weekend cards share only the selected record. App-owned `helpSection` routes
  HelpSheet directly to Setup, four-bar, Load Sessions, and setup-difference anchors.
  Racer-language edits are display-only; persisted identifiers and DB/service names stay.
- Gate evidence: C5–C9 and UX-R1 harnesses PASS; lint exact three-error baseline; build
  554 modules/18 PWA entries; diff and cavecrew final review PASS. Android debug actual
  file chooser/cancel/back/help/theme/size/offline smoke passed. Final Netlify draft
  `6a55bd0dfd16f2bd74bf6c1a` passes 320/390 signed-out shell with no overflow or console
  errors. No SQL, package, production deploy, remote push, master merge, or release APK.
- SOL C9 QA attempt 1 FAIL is limited to visible copy. Direct Shock/J-Bar/Four-bar table
  strings in `QuickReferenceView.tsx` bypass `plainRacerEffect` and still expose academic
  terms such as trailing-arm geometry, rear roll center, chassis roll, apex, and weight
  transfer. Raw research strings are safe only when rendered through the translator.
  Terra should repair displayed rows and extend source fixtures; no PDF/share/lifecycle,
  sync, schema, package, native, or deploy repair is indicated.
- Terra repair `254d928` closes the C9 copy blocker. Direct guide tables use plain racer
  phrasing. `plainRacerEffect` now applies ordered, meaning-safe phrase translation and
  grammar cleanup. C9 harness decodes every raw effect literal, renders it through the
  translator, audits the full rendered corpus, and audits direct component copy separately.
  Focused harness, exact lint baseline, 554-module/18-entry build, diff check, and cavecrew
  review pass. Await SOL QA attempt 2; no other subsystem changed.
- SOL C9 QA attempt 2 PASS closes C9 and Chunks 6B–9. Independent run passed C5–C9 plus
  UX-R1 harnesses, exact three-error lint baseline, 554-module/18-entry build, repair-range
  diff, and cavecrew review. Harness confirms all 134 effect literals are translated and
  audited, with separate direct-copy and grammar checks. Prior final draft/Android evidence
  remains accepted for this display-only repair. No production/release/cloud/native change.

## 30. UXF-5 — Tuning Guide and App Guide Separation (2026-07-14)

- Feature `e2f0553` plus SOL display repair `83e652f` passed technical QA at 96.
  Maxx approved tone on draft `6a5682d667a1ecb5c117bf39`; UXF-5 is complete and
  UXF-6 is unlocked.
- Sectionless `helpSection` opens Tuning Guide. The pure `isAppGuideSection()` boundary
  recognizes `setup`, `four-bar`, `loads`, and `setup-diff`; those requests render an
  embedded `GuideView` under an App Guide title. The section value remains the source of
  truth on every reopen, preventing stale contextual topics.
- Tuning Guide starts with Pit-Side Adjustment Finder. Operating instructions and the
  maintenance 90% rule live in `GuideView` and `docs/USER_GUIDE.md`. Settings → Guide uses
  the same component without embedded-sheet styling.
- `plainRacerEffect` is the display-only translation boundary. Raw researched adjustment
  records, directions, and cautions are not rewritten. The C9 harness decodes and renders
  all 134 effect literals, audits direct copy separately, and guards concrete grammar cases.
- Maintenance rows retain status, progress, Used/Limit/Remaining, and Log action. The
  permanent threshold banner and row reason paragraphs are removed. Automatic Todo text is
  exactly `${used}/${limit} ${intervalType}`; threshold, cycle, stable source ID, reset,
  reconciliation, JSONB, and cloud behavior are unchanged.
- Gate: chunk8 and chunk9 harnesses PASS; lint is the exact three-error baseline; production
  build transforms 555 modules and precaches 18 PWA entries; diff and cavecrew review pass.
  Local signed-out shell had zero console errors. Authenticated contextual runtime was not
  available and is not claimed; sequential embedded Guide topics are covered by SSR fixtures.
- No checklist redesign, maintenance interval change, lifecycle, schema/migration, sync/type,
  package, native config, preview/production deploy, remote push, merge, or APK change.
- SOL technical QA attempt 1 found five awkward translated phrases that escaped the corpus
  guard. SOL fixer added ordered exact replacements and focused assertions; Terra was not
  re-invoked. Attempt 2 passed both harnesses, exact lint baseline, 555-module/18-entry build,
  diff, clean tree, and cavecrew re-review. Raw `BEHAVIOR_DATA` remains byte-equal to the
  planning base after line-ending normalization. Owner acceptance followed on the draft.
- Owner acceptance: draft deploy from `f12fb49` returned HTTP 200 and Maxx approved tone.
  Production remained unchanged.

## 31. UXF-6 — Races/Days Maintenance and Starting Usage (2026-07-14)

- Terra feature `6cae6cf` is CODE_PASS and awaits independent SOL QA. Visible maintenance
  intervals are exactly Races and Days for both car and rig scopes.
- `getComponentStatus()` counts a qualifying Feature weekend once, even with multiple
  Feature sessions. Car items retain setup-to-car resolution; rig items count across cars.
  A weekend date must be strictly later than the service calendar date. Date-only service
  values are parsed locally, avoiding UTC rollover at the America/New_York boundary.
- `MaintenanceComponent.startingUsage` is optional and defaults semantically to zero.
  Valid whole nonnegative starting usage adds to derived Races/Days; `manualUnits` remains
  the full override. Normal and quick service reset starting usage, while undo retains the
  prior component bytes.
- `src/lib/maintenanceSync.ts` is the pure cloud mapping boundary. It explicitly round-trips
  `starting_usage`; invalid starting values become zero and unsupported disposable interval
  text becomes Races. IDs, scope, notes, timestamps, RLS, deletion, and local-first paths
  remain unchanged.
- Migration `20260714215528_add_maintenance_starting_usage.sql` added integer `NOT NULL`
  `starting_usage DEFAULT 0` to `public.maintenance_components`. It was applied once to
  project `swblfeayxoprodhwxqak`; all seven test rows remain, read zero, and RLS remains on.
  No interval rows were rewritten or deleted.
- Focused chunk8 harness, exact three-error lint baseline, 556-module/18-entry build, diff,
  and cavecrew review pass. Draft `6a56b1449f3477512a85c566` has a clean 320/390 signed-out
  shell. The unique origin had no remembered login, so authenticated application round-trip
  and signed-in theme/size runtime are not claimed.
