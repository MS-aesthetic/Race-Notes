# CREW CHIEF — Codebase Knowledge File

> Last updated: 2026-06-30 (session 7 — bug fixes & sessions accordion)
> Branch at time of writing: `master` (all features merged — car-profiles, session-v2, weekend-v2)
> Purpose: Comprehensive reference for any LLM or developer picking up this codebase.

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
| Mobile | Capacitor 6 (Android only) |
| Backend / Auth | Supabase (auth + Postgres + Storage) |
| PWA | `vite-plugin-pwa` + Workbox |
| Deployment | Netlify CLI (`netlify deploy --prod --dir=dist`) |

### Font scaling
Font base size is controlled at runtime via:
```ts
document.documentElement.style.fontSize = theme.fontSize === 'large' ? '19px' : '16px';
```
All Tailwind `rem` sizes scale automatically with this.

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
│       ├── supabase.ts            # Supabase client + AppUser type
│       ├── sync.ts                # Push/pull helpers for cloud sync
│       └── scope.ts               # byActiveCar filter helper (car-profiles feature)
├── capacitor.config.ts
├── vite.config.ts
├── package.json
└── android/                       # Capacitor Android project
```

---

## 4. App Navigation (tabs)

Tab IDs are string literals stored in `activeTab` state in `App.tsx`.

| Tab ID | Component | Description |
|--------|-----------|-------------|
| `dashboard` | `DashboardView` | Home screen — recent weekends, quick-start |
| `raceweekend` | `RaceWeekendView` | Active session log + all sessions for current weekend |
| `setups` | `SetupView` | Car setup sheet, tire inventory, smasher load graphs |
| `trackers` | `TrackersView` | Accounting ledger + shopping list |
| `todos` | `ToDoView` | To-do lists with team assignment |
| `quickref` | `QuickReferenceView` | Tuning reference guide / adjustment finder |
| `team` | `TeamView` | Team invite + member list |
| `settings` | `SettingsView` | Account, theme, export |

**Bottom nav bar order (left → right):** Dashboard · Setups · Sessions · Trackers · Reference · Settings
(Trackers was swapped to appear before Reference in session 4.)

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
  fontSize: 'standard' | 'large'; // 16px or 19px base
}
```

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

---

### `QuickReferenceView.tsx`
Symptom picker label: **"Symptom"** (not "What is the car doing?"). Option labels are short — no parenthetical descriptions, no `[TIGHTEN]`/`[LOOSEN]` group prefix in the `<select>` options.

---

### `SmasherLoadsView.tsx`
Shock load graph data entry. Each `ShockSession` (now a global type in `types.ts`, not same as `SessionRecord`) has:
- Corner + shock ID
- Data points: height/load pairs — **text inputs with `inputMode="decimal"`**, no stepper buttons
- Dyno graph photos: base64 JPEG (compressed via canvas). Photos live here, NOT in RaceWeekendView.

**feature/car-profiles changes:** State lifted to App.tsx. Props: `activeCarId?`, `sessions?` (full array from App), `onSave?`. When props are provided the component uses them; falls back to localStorage for backward compatibility. New sessions are stamped with `carId`. `byActiveCar` filter applied at display time. "New Session" button disabled with tooltip when no car is active.

---

### `TrackersView.tsx`
Sub-tabs: Accounting | Shopping. Entries can be linked to a race weekend via `weekendId`/`weekendName`. Accounting supports a base64 receipt photo.

---

### `SettingsView.tsx`
Sub-tabs: **Garage | Account | Style | Export**. "Appearance" was renamed to "Style"; "Garage" is a new first tab (feature/car-profiles). Passes `weekends`, `todos`, `accounting`, `shopping` down to `ExportView`. Accepts `initialSubTab?` prop so App.tsx can deep-link directly to Garage (e.g. from the header car chip).

**Clear All Data** (session 7): Account tab now has a "Danger Zone" section at the bottom. Two-step confirm ("Clear All Data" → "Are you sure?"). Calls `onClearAllData?: () => Promise<void>` prop, implemented in App.tsx as `handleClearAllData`:
- Removes all 11 `race_notes_*` localStorage keys
- Deletes all user rows from Supabase: `weekends`, `setups`, `tire_inventory`, `cars`, `shock_sessions`
- Resets all relevant React state to empty arrays / null
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
| Setup photos | Supabase Storage public URLs in `Setup.screenshots[]` |

---

## 13. Build & Deploy Commands

### Development
```bash
npm run dev
# Vite dev server at localhost:3000
```

### Web + Netlify
```bash
npm run build        # outputs to dist/
npm run lint         # tsc --noEmit (type check only — build does NOT type-check)

# Deploy (use cmd /c to bypass PowerShell execution policy):
cmd /c "netlify deploy --prod --dir=dist"
```

### Android APK
```bash
npm run build
npx cap sync android

# Run Gradle via .bat file to avoid PowerShell timeout:
# build_apk.bat contents: cd android && gradlew assembleDebug
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

**versionCode:** `3`, versionName `"3.0"` (as of session 7 — bump with every APK that needs to install over a previous version)

**Android permissions required** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

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
