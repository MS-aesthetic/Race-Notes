# Car Profiles — Step-by-Step Implementation Task List

> Repo: `C:\Users\maxx\antigravity\Race-Notes` (CREW CHIEF)
> Companion doc (read first for full context/rationale): `./CAR_PROFILES_IMPLEMENTATION_PLAN.md`
> Branch: create `feature/car-profiles` from `feature/session-v2`. **Do NOT merge to `master` without explicit owner approval.**
> Implementer: Sonnet (new chat). Work top to bottom; each phase compiles and is testable.

---

## Locked Decisions (do not re-litigate)

- **Strategy:** Option A — relational `carId` tagging. One combined dataset; views filter by the active car. No storage namespacing, no reload on car switch.
- **Car-scoped (per-car):** `Setup`, `TireInventoryItem`, `ShockSession` (smasher). Everything else is **global**: weekends, sessions, active session, accounting, shopping, to-dos, theme.
- **Car ownership:** team-owned with user fallback (`team_id` when on a team, else `user_id`). Visible to teammates via `in_same_team()` RLS.
- **Active car:** per-device, stored in `localStorage['race_notes_active_car']`. **Never synced.**
- **DECISION 1 — Smasher cloud sync: YES.** Build a `shock_sessions` cloud table + sync, and lift smasher state into `App.tsx` (Section 4a-ii of the plan).
- **DECISION 2 — Car deletion: BLOCK if data exists.** A car that still owns any setup, tire, or shock session cannot be deleted; show "Reassign or delete this car's data first."
- **DECISION 3 — New-weekend setup picker: FILTER to active car.**

Conventions to follow: local-first (localStorage primary, debounced Supabase push), camelCase in TS ↔ snake_case in SQL, reuse existing Tailwind v4 `@theme` tokens (no new colors), `client-generated text` PKs. **Run `npm run lint` (`tsc --noEmit`) before every commit — Vite does not type-check.**

---

## PHASE 1 — Types & Constants

- [ ] **1.1** In `src/types.ts`, add the car type constants:
  ```ts
  export const CAR_TYPES = ['Dirt Late Model', 'A Mod', 'B Mod'] as const;
  export type CarType = typeof CAR_TYPES[number] | string;
  ```
- [ ] **1.2** In `src/types.ts`, add the `Car` interface: `id, teamId?, userId, carType, chassis, division, name?, createdAt, updatedAt` (see plan §1 for exact fields/comments).
- [ ] **1.3** In `src/types.ts`, add `carId?: string;` to `Setup` and to `TireInventoryItem`.
- [ ] **1.4** Promote `ShockSession` from `SmasherLoadsView.tsx` into `src/types.ts` (export it) and add `carId?: string;`. Update `SmasherLoadsView.tsx` to import it. (Required because smasher state is being lifted to `App.tsx` per Decision 1.)
- [ ] **1.5** In `src/data.ts`, add `export const INITIAL_CARS: Car[] = [];` and `export const INITIAL_SHOCK_SESSIONS: ShockSession[] = [];`.
- [ ] **1.6** `npm run lint` → 0 errors. Commit: `feat(types): add Car entity, CAR_TYPES, carId fields`.

**Acceptance:** Project type-checks; no behavior change yet.

---

## PHASE 2 — Supabase Migration `009_cars.sql`

- [ ] **2.1** Create `supabase/migrations/009_cars.sql` containing:
  - `cars` table (`id text PK, user_id uuid NOT NULL, team_id uuid REFERENCES teams ON DELETE SET NULL, car_type, chassis, division, name, created_at, updated_at`) + RLS: "Users manage own cars", "Team can view cars", "Team can update cars" (use `in_same_team()`); indexes on `user_id`, `team_id`. (Plan §4.)
  - `ALTER TABLE setups ADD COLUMN IF NOT EXISTS car_id text;` + index.
  - `ALTER TABLE tire_inventory ADD COLUMN IF NOT EXISTS car_id text;` + index.
  - **`shock_sessions` table** (Decision 1): `id text PK, user_id uuid NOT NULL, car_id text, label text, corner text, spring_rate text, shock text, date text, points jsonb DEFAULT '[]', photos text[] DEFAULT '{}', created_at timestamptz, updated_at timestamptz`; enable RLS; policies "Users manage own shock sessions" (`auth.uid() = user_id`) + "Team can view shock sessions" / "Team can update shock sessions" via `in_same_team()`; index on `user_id`, `car_id`.
  - Keep all `car_id` columns as plain `text` (no FK) to match existing client-generated PKs and avoid backfill ordering issues.
- [ ] **2.2** Run the migration in the Supabase SQL editor. Verify with `list_tables` that `cars` and `shock_sessions` exist and `setups`/`tire_inventory` have `car_id`.
- [ ] **2.3** Commit: `feat(db): migration 009 — cars, shock_sessions, car_id columns`.

**Acceptance:** Tables/columns present in Supabase; RLS enabled.

---

## PHASE 3 — Sync Layer (`src/lib/sync.ts`)

- [ ] **3.1** Add `pushCars(cars, userId, teamId, onStatus?)` — debounced 500ms, `upsert onConflict 'id'`, map camelCase→snake_case (`car_type`, `team_id`). Mirror `pushTires`.
- [ ] **3.2** Add `pullCars(userId, onStatus?)` — `SELECT * FROM cars` (RLS returns own + team), map snake_case→camelCase. Mirror `pullTires`.
- [ ] **3.3** Add `deleteCarFromCloud(carId)` — immediate hard delete by id (no debounce). Mirror `deleteTireFromCloud`.
- [ ] **3.4** Modify `pushSetups`: add `car_id: s.carId ?? null` to each row.
- [ ] **3.5** Modify setups mappers in `pullAllData` AND `pullSharedData`: add `carId: (r.car_id as string) ?? undefined`.
- [ ] **3.6** Modify `pushTires`: add `car_id: t.carId ?? null`. Modify `pullTires` mapper: add `carId`.
- [ ] **3.7** Add smasher sync (Decision 1): `pushShockSessions(sessions, userId, onStatus?)` (debounced upsert), `pullShockSessions(userId, onStatus?)`, `deleteShockSessionFromCloud(id)`. Map `springRate`↔`spring_rate`, `points`/`photos` as-is.
- [ ] **3.8** `npm run lint` → 0 errors. Commit: `feat(sync): cars + shock_sessions sync; car_id on setup/tire push+pull`.

**Acceptance:** New sync fns compile; `mergeIntoLocalStorage` untouched (carId rides inside items).

---

## PHASE 4 — App State + Garage UI

- [ ] **4.1** `src/App.tsx`: add `cars` state (load from `race_notes_cars`) and `activeCarId` state (load from `race_notes_active_car`). Add `activeCar = cars.find(c => c.id === activeCarId) ?? null`.
- [ ] **4.2** Add `shockSessions` state (load from existing `race_notes_shock_graphs`) now that smasher state is lifted into `App.tsx`. Add `handleSaveShockSessions` (setState + localStorage + `pushShockSessions` if logged in).
- [ ] **4.3** Add handlers: `handleSaveCars` (setState + `race_notes_cars` + `pushCars`), `handleSelectCar` (setState + `race_notes_active_car`; **no data reload**), `handleDeleteCar` (Phase 7).
- [ ] **4.4** On login, call `pullCars` and `pullShockSessions`; merge into state/localStorage like the existing tire/setup pulls.
- [ ] **4.5** Create `src/components/GarageView.tsx`:
  - Active-car selector: cars rendered as **buttons**, active highlighted (`border-primary bg-primary/10`), tap → `onSelectCar`.
  - Add-car form: **Car Type `<select>` from `CAR_TYPES`**, Chassis text, Division text, optional Name text.
  - Edit + delete per car (delete wired in Phase 7). Show per-car data counts (setups/tires/shock) for the delete guard.
  - Reuse existing Tailwind tokens (`bg-surface-container`, `border-outline-variant`, `font-mono uppercase`, `text-primary`).
- [ ] **4.6** `src/components/SettingsView.tsx`: add a **`garage`** sub-tab to the existing `subTab` union + button bar (now 4 tabs); render `<GarageView ... />` with props `cars, activeCarId, onSelectCar, onSaveCars, onDeleteCar` + counts.
- [ ] **4.7** Add a persistent **active-car chip** in the `App.tsx` header showing `{chassis} · {carType}`; tap → Settings → Garage.
- [ ] **4.8** `npm run lint` → 0 errors. Commit: `feat(cars): app state + Garage UI + active-car chip`.

**Acceptance:** Can create, list, select, and edit cars; active car persists across refresh; chip reflects selection.

---

## PHASE 5 — One-Time Backfill (default car)

- [ ] **5.1** In `App.tsx`, add a run-once effect (guard with `useRef`) that, when `cars.length === 0` but legacy data exists (`savedSetups`/`tireInventory`/`shockSessions`), creates a default `Car` (chassis from first setup or "My Car"; `carType` from first setup's `carType` or `CAR_TYPES[0]`).
- [ ] **5.2** Stamp every legacy `Setup`, `TireInventoryItem`, and `ShockSession` lacking `carId` with the default car's id; persist (setState + localStorage + push).
- [ ] **5.3** `handleSaveCars([defaultCar])` + `handleSelectCar(defaultCar.id)`.
- [ ] **5.4** **Run backfill AFTER post-login pull/merge** so cloud copies also get stamped (otherwise cloud rows stay unassigned). Set `userId` at push time so offline-created cars get the right owner on login.
- [ ] **5.5** Brand-new users (no legacy data): no backfill — they'll be prompted to add a car (Phase 7 empty-state).
- [ ] **5.6** `npm run lint` → 0 errors. Commit: `feat(cars): one-time backfill of legacy data to default car`.

**Acceptance:** Existing user gets exactly one default car owning all prior data; runs once (no dupes on refresh).

---

## PHASE 6 — Scoped Filtering & Stamping

- [ ] **6.1** Add a filter helper (e.g. `src/lib/scope.ts`): `byActiveCar(items, carId)` returning all items when `carId` is null, else `items.filter(i => i.carId === carId)`. **Filter at display time only — never mutate master arrays.**
- [ ] **6.2** `SetupView.tsx`: accept `activeCarId`/`activeCar` props; filter the saved-setups list and the tire-inventory list by `activeCarId`; **stamp `carId: activeCarId` on every setup-create and tire-create**; default a new setup's `carType` from `activeCar.carType`. Pass `activeCarId` down to `SmasherLoadsView`.
- [ ] **6.3** `SmasherLoadsView.tsx`: change to receive `{ activeCarId, sessions, onSave }` props (state now lives in `App.tsx`); filter displayed sessions by `activeCarId`; **stamp `carId: activeCarId`** in the new-session builder; stamp any legacy session lacking `carId`.
- [ ] **6.4** `DashboardView.tsx`: filter the collapsible Setups and Tires sections by `activeCarId`; optionally show active car name.
- [ ] **6.5** New-weekend form in `App.tsx` (**Decision 3**): filter the setup-picker dropdown to `activeCar`'s setups only.
- [ ] **6.6** **AUDIT (critical):** confirm every create path for setups/tires/shock stamps `carId`, and every display list of those entities filters on `activeCarId`. These two are the only failure modes of Option A.
- [ ] **6.7** `npm run lint` → 0 errors. Commit: `feat(cars): scope setups, tires, smasher to active car`.

**Acceptance:** Switching cars instantly re-filters setups/tires/smasher; no cross-car leakage on create.

---

## PHASE 7 — Deletion Policy + Empty States (Decision 2)

- [ ] **7.1** Implement `handleDeleteCar(carId)` to **block** when the car owns any setup, tire, or shock session: compute counts; if any > 0, refuse with message "Reassign or delete this car's data first." If zero, delete locally + `deleteCarFromCloud(carId)`; if it was the active car, select another (or clear).
- [ ] **7.2** GarageView: show the delete button as disabled/guarded with the count-based reason when data exists.
- [ ] **7.3** Empty/edge states: if `cars.length === 0` or `activeCarId` is null/dangling, disable Setup/Tire/Smasher create actions with prompt "Add a car in Settings → Garage to start." On load, if `activeCarId` missing but cars exist, auto-select the first.
- [ ] **7.4** `npm run lint` → 0 errors. Commit: `feat(cars): block deletion with data; empty-state guards`.

**Acceptance:** Cannot delete a car with data; clean prompts when no car is active.

---

## PHASE 8 — Docs & Verification

- [ ] **8.1** Update `CODEBASE_KNOWLEDGE.md`: new `Car` entity + `CAR_TYPES`; new localStorage keys (`race_notes_cars`, `race_notes_active_car`); new tables (`cars`, `shock_sessions`) + `car_id` columns; the global-vs-scoped split; deletion policy; active-car-is-device-local note.
- [ ] **8.2** Manual test pass (full list in plan §11): backfill, isolation between two cars, no-leak-on-create, instant switch, cloud round-trip on a second device, team visibility, globals unchanged, empty-state, deletion block.
- [ ] **8.3** (Recommended) Run a verification subagent to diff the branch against §11 and confirm the §6.6 audit holds.
- [ ] **8.4** Final `npm run lint`; build check `npm run build`. Commit: `docs: car profiles knowledge update`.
- [ ] **8.5** Stop at the branch. **Do not merge to `master`** — await owner approval. Optionally build APK / Netlify preview per `CODEBASE_KNOWLEDGE.md` §13 if owner wants to test on device.

**Acceptance:** Docs updated; all §11 checks pass; branch ready for owner review.

---

## Quick File Map (what gets touched)

| File | Phase |
|------|-------|
| `src/types.ts`, `src/data.ts` | 1 |
| `supabase/migrations/009_cars.sql` | 2 |
| `src/lib/sync.ts` | 3 |
| `src/App.tsx` | 4, 5, 6, 7 |
| `src/components/GarageView.tsx` (new) | 4 |
| `src/components/SettingsView.tsx` | 4 |
| `src/components/SetupView.tsx` | 6 |
| `src/components/SmasherLoadsView.tsx` | 1, 6 |
| `src/components/DashboardView.tsx` | 6 |
| `CODEBASE_KNOWLEDGE.md` | 8 |

Full rationale, SQL, code sketches, and risks: **`./CAR_PROFILES_IMPLEMENTATION_PLAN.md`**.
