# Car Profiles — Implementation Plan

> Target repo: `C:\Users\maxx\antigravity\Race-Notes` (CREW CHIEF)
> Branch suggestion: `feature/car-profiles` (cut from `feature/session-v2`)
> Author of plan: review pass, 2026-06-29
> Audience: an implementing model/developer with no prior context on this codebase.

---

## 0. Decision Summary (locked by product owner)

- **Strategy: Option A — relational `carId` tagging.** One combined dataset; views filter to the active car. No per-car namespacing of storage, no re-hydration on car switch.
- **Scope of car-tagging (what becomes per-car):**
  - `Setup` (setups)
  - `TireInventoryItem` (tire inventory)
  - `ShockSession` (smasher / shock-load graphs)
- **Stays GLOBAL (NOT car-scoped):** race weekends, sessions, active session, accounting, shopping, to-dos, theme.
- **Car ownership: team-owned with user fallback.** Cars belong to the team (`team_id`) when the user is on a team, else to the user (`user_id`). Visible to teammates via the existing `in_same_team()` RLS pattern.
- **Active-car selection is per-device, NOT synced.** Stored in localStorage (`race_notes_active_car`). Each teammate/device picks its own active car. This avoids one member's car switch yanking the context out from under another.

### Why this is the right shape for this codebase
The app is **local-first** (localStorage primary, Supabase synced on top) with **all global state in one root component** (`src/App.tsx`) and **every entity currently scoped only by `user_id`**. Option A adds a single new dimension (`carId`) to three entities and one filter (`activeCarId`) threaded through the relevant views. Because all data already lives in memory in `App.tsx`, switching the active car is just a **filter change** — no data reload, no re-pull. That is the cheapest correct path given the architecture.

---

## 1. The New Entity: `Car`

A car profile is a small record. Add to `src/types.ts`:

```ts
/** Allowed car types — drives the Settings dropdown. Keep extensible. */
export const CAR_TYPES = ['Dirt Late Model', 'A Mod', 'B Mod'] as const;
export type CarType = typeof CAR_TYPES[number] | string; // string fallback for forward-compat

export interface Car {
  id: string;                 // client-generated, e.g. `car-${Date.now()}-${rand}`
  teamId?: string | null;     // set when user is on a team; else null
  userId: string;             // creator / owner (always set)
  carType: CarType;           // dropdown value
  chassis: string;            // free text — chassis name/number
  division: string;           // free text — division being raced
  /** Optional friendly label; if empty, UI derives "{chassis} · {carType}" */
  name?: string;
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
}
```

> Note: `CAR_TYPES` is the canonical dropdown source. Storing `carType` as a string (not a hard enum column in SQL) keeps it forward-compatible if more types are added later. Validate against `CAR_TYPES` only in the UI.

### Add `carId` to the three scoped interfaces
In `src/types.ts`:
- `interface Setup { ... carId?: string; }`  (optional during migration window; treat missing as "unassigned")
- `interface TireInventoryItem { ... carId?: string; }`
- `ShockSession` lives **inside `src/components/SmasherLoadsView.tsx`** (local interface, not in `types.ts`). Add `carId?: string;` there. Consider promoting `ShockSession` to `types.ts` as part of this work so it can be referenced by props — optional but cleaner.

`carId` is intentionally **optional** in the type so existing serialized data deserializes without error; the backfill (Section 6) assigns a real value on first run.

---

## 2. Active-Car Global State (`src/App.tsx`)

`App.tsx` is the single state hub. Add:

```ts
// --- Cars ---
const [cars, setCars] = useState<Car[]>(() => {
  try { const s = localStorage.getItem('race_notes_cars'); return s ? JSON.parse(s) : []; }
  catch { return []; }
});
const [activeCarId, setActiveCarId] = useState<string | null>(() => {
  return localStorage.getItem('race_notes_active_car');
});
```

New localStorage keys (add to the key registry in `CODEBASE_KNOWLEDGE.md` §6):

| Key | Type | Notes |
|-----|------|-------|
| `race_notes_cars` | `Car[]` | All car profiles (mirrors cloud) |
| `race_notes_active_car` | `string` (carId) | Per-device selected car; NOT synced |

### Handlers to add in `App.tsx`
```ts
const handleSaveCars = (updated: Car[]) => {
  setCars(updated);
  localStorage.setItem('race_notes_cars', JSON.stringify(updated));
  if (user) pushCars(updated, user.id, team?.id ?? null, setSyncStatus);
};

const handleSelectCar = (carId: string) => {
  setActiveCarId(carId);
  localStorage.setItem('race_notes_active_car', carId);
  // No data reload needed — views re-filter on activeCarId.
};

const handleDeleteCar = async (carId: string) => {
  // See Section 7 (deletion policy) before implementing cascade.
};
```

### Derived value to pass down
```ts
const activeCar = cars.find(c => c.id === activeCarId) ?? null;
```

Pass `cars`, `activeCarId`, `activeCar`, `handleSelectCar`, `handleSaveCars`, `handleDeleteCar` into the views that need them (Settings, Setup, Smasher, Dashboard).

---

## 3. Filtering Rule (the core of Option A)

Every list of a scoped entity filters by `activeCarId`. Define one helper (e.g. in `src/lib/scope.ts` or inline) and use it everywhere:

```ts
const byActiveCar = <T extends { carId?: string }>(items: T[], carId: string | null) =>
  carId ? items.filter(i => i.carId === carId) : items;
```

**Apply at the point of display, not by mutating the master arrays.** The master `savedSetups`, `tireInventory`, and shock-session arrays stay complete in state/localStorage; only the rendered slice is filtered. This keeps cross-car data intact and makes car-switching instant.

**Every create handler must stamp `carId = activeCarId`.** This is the single most error-prone part of Option A — audit each creation path (Section 5).

---

## 4. Supabase Schema — new migration `009_cars.sql`

Migrations are plain SQL run in the Supabase SQL editor (see existing `001`–`008`). Follow the same RLS conventions and the `in_same_team()` helper from `003_teams_and_todos.sql`.

```sql
-- ============================================================================
-- Migration 009: Car Profiles
-- ============================================================================

-- 1. cars table
CREATE TABLE public.cars (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  car_type text DEFAULT '',
  chassis  text DEFAULT '',
  division text DEFAULT '',
  name     text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Owner manages own cars
CREATE POLICY "Users manage own cars"
  ON public.cars FOR ALL
  USING ((auth.uid())::uuid = user_id);

-- Teammates can view/edit cars owned by anyone in the same team
CREATE POLICY "Team can view cars"
  ON public.cars FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));
CREATE POLICY "Team can update cars"
  ON public.cars FOR UPDATE
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_cars_user_id ON public.cars(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_team_id ON public.cars(team_id);

-- 2. Add car_id to the three scoped tables
ALTER TABLE public.setups         ADD COLUMN IF NOT EXISTS car_id text;
ALTER TABLE public.tire_inventory ADD COLUMN IF NOT EXISTS car_id text;

CREATE INDEX IF NOT EXISTS idx_setups_car_id ON public.setups(car_id);
CREATE INDEX IF NOT EXISTS idx_tire_inventory_car_id ON public.tire_inventory(car_id);

-- 3. (Optional) Cloud table for smasher/shock data — see Section 4a.
```

> Do **not** add a FK constraint from `setups.car_id` / `tire_inventory.car_id` to `cars.id` with `ON DELETE CASCADE` unless the deletion policy (Section 7) is "cascade." A loose `text` column (no FK) matches how `setups.id`/`weekends.id` are already modeled (client-generated `text` PKs) and avoids ordering problems during backfill. Recommended: keep `car_id` as a plain `text` column, enforce integrity in app logic.

### 4a. Smasher / shock-load data — currently LOCAL-ONLY
`ShockSession[]` is persisted only to `localStorage['race_notes_shock_graphs']` inside `SmasherLoadsView.tsx`; it has **no cloud table and no sync**. Two choices:

- **4a-i (recommended, minimal):** Keep smasher data local-only. Just add `carId` to each `ShockSession` and filter by `activeCarId` in the component. No migration needed for smasher; one less moving part. Risk: smasher data does not sync across devices (same as today).
- **4a-ii (fuller):** Add a `shock_sessions` cloud table (`id text PK, user_id, car_id text, label, corner, spring_rate, shock, date, points jsonb, photos text[], updated_at`) with the same team RLS, plus `pushShockSessions`/`pullShockSessions` in `sync.ts`, and lift state up to `App.tsx`. More work; gives cross-device smasher sync as a bonus.

**Default to 4a-i** unless the owner wants smasher cloud sync now. Either way the user-visible behavior (per-car filtering) is identical.

---

## 5. Sync Layer Changes (`src/lib/sync.ts`)

### 5.1 New functions
```ts
export function pushCars(cars: Car[], userId: string, teamId: string | null, onStatus?: SyncCallback) {
  // debounced 500ms like pushTires; upsert onConflict 'id'
  // rows: { id, user_id: userId, team_id: teamId, car_type, chassis, division, name, created_at, updated_at }
}

export async function pullCars(userId: string, onStatus?: SyncCallback): Promise<Car[]> {
  // SELECT * FROM cars  (RLS returns own + teammates'); map snake_case -> camelCase
}

export async function deleteCarFromCloud(carId: string): Promise<void> {
  // hard delete by id, immediate (no debounce), mirror deleteTireFromCloud
}
```
Follow the **exact** debounce/upsert pattern already used by `pushTires`/`pushSetups`. Map DB snake_case (`car_type`, `team_id`) to camelCase (`carType`, `teamId`) in `pullCars`, mirroring `pullTires`.

### 5.2 Modify existing setup/tire sync to carry `car_id`
- `pushSetups`: add `car_id: s.carId ?? null` to each row object.
- `pullAllData` → setups mapper: add `carId: (r.car_id as string) ?? undefined`.
- `pullSharedData` → setups mapper: same addition.
- `pushTires`: add `car_id: t.carId ?? null`.
- `pullTires`: add `carId: (r.car_id as string) ?? undefined`.

> The `mergeIntoLocalStorage` cloud-wins-by-id logic needs **no change** — `carId` rides along inside each item.

---

## 6. One-Time Client Backfill (default car)

Existing users already have setups/tires/shock graphs with no `carId`. On the first load after this update, create a default car and assign orphaned data to it. Put this in `App.tsx` after initial localStorage load + after `cars` is known.

```ts
useEffect(() => {
  if (cars.length > 0) return;                 // already has cars → skip
  const hasLegacyData =
    savedSetups.length > 0 || tireInventory.length > 0 /* || shock graphs exist */;
  if (!hasLegacyData) return;                  // brand-new user → no backfill, just prompt to add a car

  // Derive a sensible default type from existing setups, else first CAR_TYPE.
  const guessedType = savedSetups.find(s => s.carType)?.carType || CAR_TYPES[0];
  const defaultCar: Car = {
    id: `car-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: user?.id ?? 'local',
    teamId: team?.id ?? null,
    carType: guessedType,
    chassis: savedSetups.find(s => s.chassis)?.chassis || 'My Car',
    division: '',
    name: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Stamp all legacy data with the default car id
  const stampedSetups = savedSetups.map(s => s.carId ? s : { ...s, carId: defaultCar.id });
  const stampedTires  = tireInventory.map(t => t.carId ? t : { ...t, carId: defaultCar.id });

  handleSaveCars([defaultCar]);
  handleSelectCar(defaultCar.id);
  // persist stamped setups/tires (setState + localStorage + push)
  // stamp shock graphs inside SmasherLoadsView via the same activeCarId-on-mount rule
}, [/* run once after load; guard with a ref to avoid double-run */]);
```

Backfill considerations:
- Guard with a `useRef` "didBackfill" flag so it runs once.
- Run it **after** `pullAllData`/`pullTires` complete on login, so cloud data is present before stamping (otherwise you stamp local-only and the cloud copies stay unassigned). Simplest: run backfill in the same place that finalizes post-login merge.
- `userId: 'local'` placeholder for offline-created cars; when the user later logs in, reassign `userId` on first push (or just push with the real id — `pushCars` takes `userId` as an arg, so the row gets the correct owner regardless of the stored field). Prefer setting `userId` at push time.
- Smasher graphs: stamp on mount inside `SmasherLoadsView` (any `ShockSession` lacking `carId` gets the current `activeCarId`).

---

## 7. Car Deletion Policy (decide before coding `handleDeleteCar`)

Deleting a car must do something with its setups/tires/smasher data. Pick one and implement consistently:

- **A. Block-if-nonempty (safest, recommended for v1):** Disallow deleting a car that still owns setups/tires/smasher records. Show "Reassign or delete this car's data first." Cheapest to reason about; zero orphan risk.
- **B. Cascade delete:** Delete the car and all its scoped data (local + cloud + `deleteWeekendFromCloud`-style hard deletes for each). Powerful but destructive — require a typed confirmation.
- **C. Reassign:** On delete, prompt "move this car's data to {other car}?" then re-stamp `carId`.

Recommend **A** for v1, with C as a fast follow. Whatever is chosen, document it in `CODEBASE_KNOWLEDGE.md`.

Edge case — **zero cars / no active car:** If `cars.length === 0` or `activeCarId` is null/dangling (points to a deleted car), Setup/Tire/Smasher create actions should be disabled with a prompt: "Add a car in Settings → Garage to start." On car list load, if `activeCarId` is missing but cars exist, auto-select the first car.

---

## 8. UI Work

### 8.1 Settings → "Garage" (car manager)
`SettingsView.tsx` currently has sub-tabs `account | appearance | export` (a simple `subTab` state + a 3-button bar). Add a **`garage`** sub-tab (4 buttons now). Build the manager either inline or as a new component `src/components/GarageView.tsx` (preferred for file size; mirror the styling tokens used across the app — `bg-surface-container`, `border-outline-variant`, `font-mono uppercase`, `text-primary`, etc.).

Garage view contents:
1. **Active-car selector** — the list of cars rendered as **buttons** (the owner's explicit ask). Active car highlighted (`border-primary bg-primary/10` like the existing mode/font pickers). Tapping selects it via `handleSelectCar`.
2. **Add Car form:**
   - Car Type — `<select>` populated from `CAR_TYPES` (dropdown, per spec).
   - Chassis — text input.
   - Division — text input.
   - Optional Name — text input (placeholder derives from chassis).
3. **Edit / delete** per car (delete obeys Section 7).

Props to pass from `App.tsx` → `SettingsView` → `GarageView`: `cars`, `activeCarId`, `onSelectCar`, `onSaveCars`, `onDeleteCar`, plus counts of scoped data per car (for the delete guard / display), e.g. derive `setupCount`, `tireCount` per car from the master arrays.

### 8.2 Persistent active-car indicator
Add a small chip showing the active car (e.g. `{chassis} · {carType}`) in the app header/top bar in `App.tsx`, so the user always knows which car the app is acting on. Tapping it can deep-link to Settings → Garage. This is important UX: because filtering is silent, users need a constant reminder of context.

### 8.3 `SetupView.tsx`
- Filter the **saved setups list** by `activeCarId` (`byActiveCar`).
- Filter the **tire inventory** list/CRUD by `activeCarId`.
- On **create setup** and **create tire**, stamp `carId: activeCarId`.
- The existing free-text `carType` field on a setup should **default from the active car** (`activeCar.carType`) and can be shown read-only or pre-filled. Reconcile: the car is now the source of truth for type; the setup's `carType` becomes a denormalized copy for display/report continuity.
- Receives new props: `activeCarId`, `activeCar`.

### 8.4 `SmasherLoadsView.tsx`
- Currently renders with **no props** (`<SmasherLoadsView />` in `SetupView.tsx:667`) and owns its own `race_notes_shock_graphs` storage.
- Change signature to `SmasherLoadsView({ activeCarId }: { activeCarId: string | null })` and thread `activeCarId` down from `App.tsx` → `SetupView` → `SmasherLoadsView`.
- Filter displayed `sessions` by `activeCarId`; stamp `carId: activeCarId` in the `newSession` builder (`SmasherLoadsView.tsx:305`); stamp any legacy session lacking `carId` on mount.

### 8.5 `DashboardView.tsx`
- The collapsible **Setups** and **Tires** sections must filter by `activeCarId`.
- Optionally show the active car name near the top.

### 8.6 New-weekend setup picker (global weekend, scoped setups)
Weekends stay global, but a weekend binds a `setupId`, and setups are now per-car. In the **new-weekend form** (`App.tsx`), filter the setup dropdown to `activeCar`'s setups (clearest), OR show all setups grouped by car. Recommend: **filter to active car** — a weekend is run with the currently selected car in practice. Document this choice.

---

## 9. File-by-File Change Checklist

| File | Change |
|------|--------|
| `src/types.ts` | Add `Car`, `CAR_TYPES`, `CarType`; add `carId?` to `Setup` and `TireInventoryItem`; (optional) move `ShockSession` here with `carId?`. |
| `src/data.ts` | Add `INITIAL_CARS: Car[] = []`. |
| `supabase/migrations/009_cars.sql` | New: `cars` table + RLS + indexes; `ALTER TABLE` add `car_id` to `setups` & `tire_inventory`; (optional) `shock_sessions` table. |
| `src/lib/sync.ts` | Add `pushCars` / `pullCars` / `deleteCarFromCloud`; add `car_id` to `pushSetups`/`pushTires` rows and to `pullAllData`/`pullSharedData`/`pullTires` mappers. |
| `src/lib/supabase.ts` | (Optional) `getTeamCars(teamId)` helper if not using generic `pullCars`. |
| `src/App.tsx` | `cars` + `activeCarId` state, load/persist, handlers (`handleSaveCars`/`handleSelectCar`/`handleDeleteCar`), backfill effect, pull cars on login, push on save, pass props to views, active-car header chip, filter new-weekend setup picker. |
| `src/components/SettingsView.tsx` | Add `garage` sub-tab + button; pass props to `GarageView`. |
| `src/components/GarageView.tsx` | **New** — car list-as-buttons selector + add/edit/delete form. |
| `src/components/SetupView.tsx` | Filter setups + tires by `activeCarId`; stamp `carId` on create; default `carType` from active car; accept new props; pass `activeCarId` to `SmasherLoadsView`. |
| `src/components/SmasherLoadsView.tsx` | Accept `activeCarId` prop; filter + stamp shock sessions. |
| `src/components/DashboardView.tsx` | Filter Setups/Tires sections by `activeCarId`. |
| `CODEBASE_KNOWLEDGE.md` | Document new entity, keys, tables, deletion policy, and the global-vs-scoped split. |

---

## 10. Build Order (recommended sequence)

1. **Types + constants** (`types.ts`, `data.ts`) — `Car`, `CAR_TYPES`, `carId` fields. Compiles; nothing wired yet.
2. **Migration `009`** — run in Supabase; verify `cars` table + `car_id` columns via `list_tables`/SQL editor.
3. **Sync layer** — `pushCars`/`pullCars`/`deleteCarFromCloud` + `car_id` on setup/tire push & pull.
4. **App state + Garage UI** — `cars`/`activeCarId` state, load/persist, `GarageView`, Settings sub-tab, header chip. Now you can create/select cars.
5. **Backfill effect** — default car + stamp legacy data; guard run-once.
6. **Scoped filtering + stamping** — `SetupView`, `SmasherLoadsView`, `DashboardView`, new-weekend setup picker.
7. **Deletion policy** — implement chosen Section 7 behavior.
8. **Docs + verification** (Section 11).

Each step compiles and is independently testable; ship behind the same branch.

---

## 11. Verification / Test Plan

Run `npm run lint` (`tsc --noEmit`) before every commit — **Vite build does NOT type-check** (known gotcha). Then verify manually:

- **Backfill:** Load as an existing user with setups/tires → exactly one default car appears, all legacy setups/tires belong to it, it's auto-selected. Runs once (no duplicate cars on refresh).
- **Isolation:** Create Car A (Late Model) and Car B (A Mod). Add tire #1 under A, tire #2 under B. Switch to A → only #1 shows in tire dropdowns/lists. Switch to B → only #2. Same for setups and smasher graphs.
- **No leak on create:** With Car B active, create a setup → it gets B's `carId`, never appears under A.
- **Switch is instant:** Selecting a car re-filters without a network round-trip or visible reload.
- **Cloud round-trip:** Log in on a second device/browser → cars + `car_id` on setups/tires pull down; active car defaults sensibly (first car) since `activeCarId` is per-device.
- **Team visibility:** A teammate sees the team's cars (RLS), can pick one as their own active car.
- **Globals stay global:** Weekends, sessions, accounting, shopping, to-dos are identical regardless of active car.
- **Empty/edge:** Delete down to zero cars (or dangling `activeCarId`) → create actions are blocked with the "add a car" prompt; no crash.
- **Deletion policy** behaves per Section 7 choice.

Suggested: spawn a verification subagent to diff the final changes against this checklist and confirm every create-handler stamps `carId` and every scoped list filters on it (the two failure modes of Option A).

---

## 12. Risks & Gotchas (codebase-specific)

- **The Option-A failure mode is a missed stamp or missed filter.** Audit all creation paths for setups, tires, and shock sessions; audit all display lists. This is the one thing to get 100% right.
- **`SmasherLoadsView` is self-contained and local-only** (no props, own localStorage, no sync). Threading `activeCarId` in is the main structural change there. If smasher cloud sync (4a-ii) is chosen, it's a larger lift (lift state to `App.tsx`).
- **Vite doesn't type-check** — always `npm run lint` before deploy.
- **TailwindCSS v4, no config file** — all tokens live in `src/index.css` `@theme {}`. Reuse existing color tokens in `GarageView`; don't invent new ones unless added to the theme block.
- **Local-first cloud-wins merge:** `mergeIntoLocalStorage` lets cloud overwrite local by `id` on login. `carId` rides inside each record so it's preserved automatically — but make sure the backfill runs *after* the post-login merge, or cloud copies stay unassigned.
- **`activeCarId` must never sync** — keep it out of any push function. It's deliberately device-local.
- **`car_id` as plain `text` (no FK)** matches existing client-generated `text` PKs and avoids backfill ordering issues. Enforce integrity in app code.
- **Don't merge to `master` without explicit owner approval** (repo rule). Work on `feature/car-profiles`.
- **Android/APK + Netlify:** standard build/deploy flow unchanged (`npm run build` → `npx cap sync android` → `build_apk.bat`; `netlify deploy --prod --dir=dist`). No native changes needed.

---

## 13. Open Questions for the Owner (resolve during implementation)

1. **Smasher cloud sync now or later?** (Section 4a — default: keep local-only, just add `carId`.)
2. **Car deletion policy** (Section 7 — recommend block-if-nonempty for v1).
3. **New-weekend setup picker** — filter to active car (recommended) or show all setups grouped by car? (Section 8.6)
4. Should the active-car chip live in the **header** or as a **bottom-nav element**? (Section 8.2 — recommend header.)
