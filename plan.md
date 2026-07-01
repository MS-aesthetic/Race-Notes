# CREW CHIEF — Build Plan (Multi-Agent)

> **Purpose.** This document is the single source of truth for the next batch of
> features and fixes for **CREW CHIEF**. It is written so that multiple AI coding
> agents (e.g. GitHub Copilot agents) can work **in parallel** with minimal
> collisions. Each workstream (WS) is self-contained: it lists the ask, the files
> to touch, the data-model changes, step-by-step tasks, considerations, and
> success criteria.
>
> Read **§0 Working Agreement** and **§1 Coordination** before starting ANY
> workstream.

---

## 0. Working Agreement (READ FIRST — applies to every workstream)

### Branch & deploy workflow — MANDATORY
- **All changes are made on the `preview` branch.** Do **not** commit feature work
  directly to `master`.
  ```bash
  git checkout preview            # create from master if it doesn't exist:
  # git checkout -b preview master
  ```
- **Push to GitHub on the `preview` branch:**
  ```bash
  git push origin preview
  ```
- **Deploy to the Netlify PREVIEW/draft build only:**
  ```bash
  npm run build
  netlify deploy --dir=dist       # preview/draft — DEFAULT
  ```
- **NEVER** run `netlify deploy --prod` and **NEVER** merge `preview` → `master`
  unless the owner (**Maxx**) **explicitly** says "push to production" / "merge to
  master". The Netlify site is **not** Git-connected, so pushing to GitHub does
  not deploy anything — deploying is always a separate manual CLI step.
- Builds/pushes for this repo run through **Windows PowerShell** (real Git
  Credential Manager + Rollup native binary). The Linux sandbox cannot type-check
  reliably and must never write repo files over the mount (it can produce
  null-byte-corrupted files).

### Definition of done (every WS)
1. `npm run lint` (`tsc --noEmit`) introduces **zero new** type errors. Baseline
   has **3 known pre-existing** errors (two `File`-typed upload args in
   `RaceWeekendView`/`SmasherLoadsView`, one `key`-on-`CornerForm`) — do not add
   more on top.
2. `npm run build` succeeds on Windows.
3. Deployed to a Netlify **preview** URL and visually verified (hard-refresh /
   incognito to beat the PWA service-worker cache).
4. Works **offline** (local-first) and, when logged in, syncs to Supabase.
5. Respects **light and dark** themes and the font-scale zoom.

### Non-negotiable architecture rules (from AGENTS.md / CODEBASE_KNOWLEDGE.md)
- **Local-first dual-write:** every mutation updates React state **and**
  `localStorage` in the same handler; cloud push (`src/lib/sync.ts`) is a third,
  optional step only when `user` is truthy.
- **No router:** navigation is a single `activeTab` string in `App.tsx`. Deep-links
  into a tab's sub-view use a dedicated state var (e.g. `settingsSubTab`).
- **Car scoping:** setups, tires, shock sessions are scoped to the active car via
  `byActiveCar()` (`src/lib/scope.ts`). Weekends, todos, accounting, shopping are
  global. `activeCarId` (`race_notes_active_car`) is **device-local, never synced**.
- **All new interfaces go in `src/types.ts`.** All push/pull helpers go in
  `src/lib/sync.ts`. New Supabase columns/tables need a migration in
  `supabase/migrations/` **and** the `car_id`/RLS conventions (`in_same_team()`).
- **Deletion sync:** deleting a cloud-backed row requires an explicit
  `delete*FromCloud(id)` call in addition to the upsert push.
- Styling: TailwindCSS v4 (`@theme` in `src/index.css`, no config file). Use
  semantic tokens (`bg-surface`, `text-primary`, `border-outline-variant`,
  `font-mono`, `font-display`). App is `max-w-2xl` mobile-portrait first.

### Product context
- **CREW CHIEF** (all caps brand): React 19 + TS + Vite 6 PWA, Capacitor 8 Android
  wrapper, Supabase (auth + Postgres + Storage). Dirt-track racing logbook for
  crews: car setups, race weekends/sessions, tire inventory, shock (smasher) dyno
  graphs, weather, and pit tasks/accounting/shopping.
- Tabs: `dashboard | setups | raceweekend | trackers | quickref | settings`.
  (`trackers` = todos + accounting + shopping. `raceweekend` = "Sessions".)
- Deployed preview: `https://crew-chief-race-notes.netlify.app` (production URL;
  updated only on explicit request).
- Full reference: `CODEBASE_KNOWLEDGE.md`, `AGENTS.md`, `PROJECT_INSTRUCTIONS.md`,
  `docs/USER_GUIDE.md`.

---

## 1. Coordination — parallelizing without merge hell

`src/App.tsx` and `src/types.ts` are **hot shared files** that most workstreams
touch. To avoid conflicts:

- **Do WS-A (Data Model & Migrations Foundation) FIRST and merge it into `preview`
  before starting the data-dependent workstreams.** It adds all new fields/types
  and empty Supabase columns so downstream agents don't fight over `types.ts`.
- When two agents must edit `App.tsx`, edit **different regions** and keep diffs
  small. Prefer extracting new logic into new files (`src/lib/*`,
  `src/components/*`) and wiring with a couple of lines in `App.tsx`.
- One agent owns each file listed under **Primary files**. Files under **Shared
  (coordinate)** require a heads-up in the PR description.

### Suggested execution order / dependency graph
```
WS-A  Data model + migrations  ──►  WS-C Tire lifecycle
                               ├──►  WS-B Setup diff
                               ├──►  WS-F Task↔weekend
                               └──►  WS-G Exports (depends on C, E, F data)
WS-D  Carry-over setup            (parallel; light App.tsx touch)
WS-E  Weather history/forecast    (parallel; App.tsx weekend-create region)
WS-H  Settings default+bigger menu(parallel; SettingsView only)
WS-I  Font default 1.15           (parallel; tiny)
WS-J  Reference overhaul          (parallel; QuickReferenceView only)
WS-K  Light mode fixes            (parallel; index.css only)
WS-L  Session track-condition     (parallel; App.tsx session-form region)
WS-M  Dashboard nav fixes         (parallel; DashboardView + small App.tsx)
```
Low-conflict quick wins (H, I, J, K, M) can start immediately.

---

## WS-A — Data Model & Migrations Foundation  *(do first; blocks C/B/F/G)*

**Goal:** land every new type/field/column so downstream WS don't collide in
`types.ts` / migrations.

**Primary files:** `src/types.ts`, `supabase/migrations/010_feature_batch.sql`,
`src/lib/sync.ts` (column mapping), `src/data.ts` (defaults).

**Type changes (`src/types.ts`):**
- `TireInventoryItem`: add
  - `dateAdded?: string` (ISO; when added to inventory)
  - `initialAgeDays?: number` (user-entered "Age" at add time; default `0`)
  - `usageDates?: string[]` (ISO dates the tire was mounted in a session)
  - `heatCycles?: number` (count of sessions mounted; auto-incremented)
  - (derived at display: `ageDays = initialAgeDays + daysSince(dateAdded)`;
    `estLaps = Σ SESSION_TYPE_LAPS[sessionType]` over usage — reuse
    `SESSION_TYPE_LAPS` already in `types.ts`.)
- `RaceWeekend`: add `weatherHistory?: WeatherHistoryDay[]` and
  `weatherForecast?: WeatherHistoryDay[]`.
  ```ts
  export interface WeatherHistoryDay {
    date: string;          // ISO yyyy-mm-dd
    tempMaxF?: number; tempMinF?: number;
    precipIn?: number;     // total precipitation inches
    windMph?: number;
    code?: number;         // WMO weather code
    summary?: string;      // human string
  }
  ```
- `Todo`: add `weekendId?: string` and `weekendName?: string` (list-level
  association) — note `TodoItem` already has per-item `weekendId`. Decide (see
  WS-F) whether association is per-list, per-item, or both; add whichever fields
  that WS needs here so the migration is one-shot.
- No type change needed for Setup diff (WS-B) — it reads existing `Setup` fields.

**Supabase migration `010_feature_batch.sql`:**
- `ALTER TABLE tire_inventory ADD COLUMN IF NOT EXISTS date_added timestamptz,
  ADD COLUMN IF NOT EXISTS initial_age_days int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_dates jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS heat_cycles int DEFAULT 0;`
- `ALTER TABLE race_weekends ADD COLUMN IF NOT EXISTS weather_history jsonb,
  ADD COLUMN IF NOT EXISTS weather_forecast jsonb;`
- `ALTER TABLE todos ADD COLUMN IF NOT EXISTS weekend_id text,
  ADD COLUMN IF NOT EXISTS weekend_name text;`
- Keep existing RLS (`in_same_team()`), no new tables required.

**sync.ts:** extend `pushTires`/`pullTires`, `pushWeekends`/`pullAllData`,
`pushTodos`/`pullTodos` column mappers to (de)serialize the new fields. Preserve
backward-compat (missing → sensible defaults).

**Success criteria:** app builds; existing data loads with defaults; new fields
round-trip local↔cloud; `tsc` clean.

---

## WS-B — Setup Diff View

**Ask:** Pick two setups and highlight only what changed (springs, bars, stagger,
pressures, etc.) — answers "what did we change and did it help?"

**Primary files:** `src/lib/setupDiff.ts` (new), `src/components/SetupDiffView.tsx`
(new). **Shared:** `SetupView.tsx` (add a "Compare" entry point), `App.tsx` (wire,
minimal).

**Steps:**
1. `setupDiff.ts`: `diffSetups(a: Setup, b: Setup): SetupDiffRow[]` where a row is
   `{ label, path, groupLabel, aValue, bValue, changed }`. Walk the four
   `CornerSetup` corners (LF/RF/LR/RR) plus top-level fields (gear, toe, jbar*,
   stagger, pullBar*, notes). Provide a human label map and group headings
   (Front, Rear, Bars/J-bar, Stagger, Corners→per corner). Treat empty/undefined
   as "—". Numeric-aware compare where possible (e.g. tire sizes via
   `parseTireSize`).
2. `SetupDiffView.tsx`: two setup pickers (default: active car's setups, newest
   two pre-selected). Toggle "Only show changes" (default ON). Render grouped
   rows; changed rows highlighted (accent left-border + `bg-primary/5`), old→new
   shown side by side with an arrow. Mobile: stack aValue/bValue.
3. Entry point: add a **Compare** button in `SetupView` header (near the sub-tab
   row) that opens the diff (modal or a `subTab: 'compare'`). Keep it car-scoped.

**Considerations:** read-only (no mutation). Handle same-setup selection
gracefully. Long notes: diff as "changed" without char-diff (keep simple).

**Success criteria:** selecting two setups shows only differing fields by default;
toggling reveals all; works with 2+ setups; zero mutations.

---

## WS-C — Tire Lifecycle: heat cycles, dates, age, lap estimate

**Ask:** Auto-increment a tire's heat-cycle count each session it's mounted; store
date added, usage dates, age (days), and estimated laps. Show these in the
inventory list. Add an **Age** entry when adding a tire (default `0`).

**Depends on:** WS-A.

**Primary files:** `src/lib/tireHistory.ts` (extend), `src/components/SetupView.tsx`
(Add-Tire form + inventory rows). **Shared:** `App.tsx` (session-save handler must
stamp tire usage), `src/lib/tireHistory.ts` already derives usage from weekends.

**Steps:**
1. **Add Age field** to the Add-Tire modal in `SetupView.tsx`: numeric input
   "Age (days)", default `0`; set `dateAdded = new Date().toISOString()` and
   `initialAgeDays = value` on save. Important for new users importing existing,
   already-used inventory.
2. **Heat-cycle + usage tracking.** When a session is saved/updated with tires
   mounted (`App.tsx` `handleUpdateSession` / `handleCreateNewSession` and the
   RaceWeekendView tire pickers), for each mounted `tireId` record the session
   date into `usageDates` (dedupe by session id/date) and set
   `heatCycles = usageDates.length`. Prefer **deriving** heatCycles/usage from
   weekend/session data (single source of truth) via `tireHistory.ts` rather than
   hand-maintaining counters, then persisting the derived values onto the tire for
   fast display. Reuse existing `getTireUsageHistory(tireId, weekends)`.
3. **Estimated laps:** `estLaps = Σ SESSION_TYPE_LAPS[session.sessionType]` across
   the tire's usage (already implemented as `getTireTotalLaps`). Surface it.
4. **Inventory row** (`SetupView` tire list, and mirror on Dashboard): add compact
   data points — **Heat Cycles**, **Est. Laps**, **Age (days)**. Age =
   `initialAgeDays + daysSince(dateAdded)`. Keep the single-line format readable;
   put the new metrics in the expanded tire detail if the row gets too dense.
5. **Aging warning:** when `heatCycles >= N` (make `N` a constant, default e.g. 8)
   or `ageDays >= 90`, show a subtle warning chip ("Aging") on the tire.

**Considerations:** don't double-count a tire used on multiple corners in the same
session (one cycle per session). Backfill: existing tires get `heatCycles` derived
from history on first load. Keep offline-safe.

**Success criteria:** mounting a tire in a session bumps its heat cycles; inventory
shows Heat Cycles / Est. Laps / Age; Age entry works on add (default 0); aging chip
appears past threshold.

---

## WS-D — Carry-Over / Duplicate Setup (copy to new car/track)

**Ask:** Start a new setup from a previous one as a baseline; extend the existing
clone with a "copy to new car/track" variant.

**Primary files:** `src/components/SetupView.tsx` (clone handler already exists at
the copy icon). **Shared:** none major.

**Steps:**
1. Turn the existing clone action into a small "Carry over" dialog: pick target
   **car** (defaults to active car) and optionally new **track**/**date**/**name**;
   clone all setup fields, assign new `id`, stamp `carId` = chosen car,
   `date = today`, clear `screenshots` (or keep — decide; default clear to avoid
   stale photos). Keep tire *inventory links* only if same car; otherwise clear
   `tireInventoryId` per corner (tire IDs are car-scoped).
2. Make it obvious in UI this is a fresh baseline (toast "Copied as new setup").

**Success criteria:** can duplicate a setup onto the active or another car with a
new track/date; car scoping stays correct; no cross-car tire link leakage.

---

## WS-E — Weather History & Forecast on Weekend Creation

**Ask:** When a race weekend is created, show the weather **history for the week
leading up** to the race (rain + heat) plus a forecast, to understand track prep.

**Primary files:** `src/lib/weather.ts` (new or extend existing weather logic in
`App.tsx`/`RaceWeekendView.tsx`), `src/components/RaceWeekendView.tsx` (display).
**Shared:** `App.tsx` (weekend-create flow), `types.ts` (WS-A added types).

**Steps:**
1. Reuse the existing geocoding (Nominatim) + Open-Meteo integration. Add:
   - **History:** Open-Meteo **Archive/History** API
     (`https://archive-api.open-meteo.com/v1/archive`) with
     `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,
     wind_speed_10m_max`, `temperature_unit=fahrenheit`,
     `precipitation_unit=inch`, for the **7 days before** the race date.
   - **Forecast:** existing Open-Meteo forecast `daily=` for race day + a few days.
2. On weekend create (and on demand via a refresh button), fetch by GPS or the
   entered zip, store into `weekend.weatherHistory[]` / `weatherForecast[]`.
3. Display a compact 7-day strip in `RaceWeekendView` weekend banner: per day show
   hi/lo °F, precip (in) with a rain icon when `precipIn > 0`, and a small
   bar/heat indicator. Summварize "X in of rain in the last 7 days".

**Considerations:** APIs are keyless but rate-limited — cache in the weekend
record; don't refetch on every render. Archive API has a ~5-day lag for the most
recent days; fall back to the forecast API's `past_days` param (up to 92) to cover
the gap. Handle offline gracefully (show cached or "unavailable").

**Success criteria:** creating a weekend with a location stores and shows the prior
7 days of rain/heat plus a short forecast; values persist and sync.

---

## WS-F — Associate Task Lists with a Weekend (or leave unassociated)

**Ask:** A task list can be linked to a weekend, or left general.

**Primary files:** `src/components/TrackersView.tsx` (Todos sub-tab),
`src/components/ToDoView.tsx` (if reused). **Shared:** `App.tsx` (todo handlers),
`types.ts` (WS-A fields), `sync.ts`.

**Steps:**
1. On a task **list** (`Todo`), add an optional weekend selector (dropdown of
   weekends + "General / none"). Persist `weekendId`/`weekendName`.
2. Filter/group UI: let the Trackers Todos view filter by weekend (and show
   "General"). On the weekend/export views, surface that weekend's linked tasks.
3. Keep existing per-item `TodoItem.weekendId` working; decide precedence (list
   association is the default context; item override allowed).

**Considerations:** todos are **global** (not car-scoped). Deleting a weekend
should null the association, not delete the list.

**Success criteria:** a list can be tied to a weekend or general; filtering works;
associations survive sync and weekend deletion.

---

## WS-G — Granular Exports  *(depends on C/E/F for complete data)*

**Ask:** More detailed exports.
- **Per-Weekend (PDF):** setup used, sessions, weather, tires used, accounting,
  shopping.
- **Tire export:** all tire info (PDF and/or CSV).
- **Setup export (PDF):** one or more setups.
- **Smasher/Load export (PDF).**
- **Accounting export (PDF & CSV).**

**Primary files:** `src/components/ExportView.tsx` (extend — it already builds a
printable HTML weekend report), `src/lib/exports/*` (new helpers). **Shared:**
minimal.

**Steps:**
1. **Approach:** keep the existing "printable HTML → browser print to PDF" pattern
   for PDFs (no heavy PDF lib; works in PWA + Android WebView). CSV via a small
   `toCsv()` helper + Blob download (reuse the CSV pattern already in
   `tireHistory.ts`).
2. **Per-Weekend PDF:** compose one document: bound setup (full sheet), all
   sessions (laps, diagnostics, adjustments, tires mounted per corner), weather
   (snapshot + WS-E history/forecast), tires used that weekend, linked accounting
   entries + totals, linked shopping items. Reuse existing weekend-report scaffold.
3. **Tire export:** table of every inventory field incl. WS-C metrics (heat
   cycles, est laps, age, dateAdded, usageDates). PDF (print) **and** CSV.
4. **Setup export:** select 1..n setups → multi-page PDF, one setup sheet per page.
5. **Smasher export:** per shock session — corner, spring rate, shock, points
   table, and the dyno photo(s); optional multi-graph compare overlay
   (`shockCompare.ts`). PDF.
6. **Accounting export:** ledger table (income/expense, payer/payee, weekend link),
   totals + net. PDF **and** CSV.
7. Put all export entry points under Settings → **Export** (existing sub-tab),
   grouped with clear buttons; respect active-car scoping where relevant
   (tires/setups) and let the user pick "all cars" vs active.

**Considerations:** base64 images (receipts, dyno graphs) inflate print docs —
downscale for print. CSV must escape commas/quotes/newlines. Keep filenames
descriptive (`CrewChief_<type>_<name>_<date>.pdf/csv`).

**Success criteria:** each export produces a correct, readable PDF/CSV with the
listed data; large images don't break layout; CSV opens cleanly in Excel/Sheets.

---

## WS-H — Settings: Garage default + bigger top menu

**Ask:** Make **Garage** the default sub-tab when entering Settings. Make the top
Settings sub-tab menu bigger/easier to tap on mobile.

**Primary files:** `src/components/SettingsView.tsx`. **Shared:** `App.tsx`
(`settingsSubTab` initial state).

**Steps:**
1. Default: in `SettingsView`, `useState(initialSubTab ?? 'garage')`; and in
   `App.tsx` set the `settingsSubTab` initial state to `'garage'` (currently
   `'account'`). Keep deep-links (header car chip → garage, `?` → guide) working.
2. Bigger menu: the sub-tab bar (`Garage | Account | Style | Export | Guide`) is
   currently tiny (`text-xs`, `py-2`). Increase tap height (`py-3`/`min-h-[44px]`),
   slightly larger text, and ensure 5 tabs fit (allow horizontal scroll or a 2-row
   wrap on the narrowest screens rather than truncating labels).

**Success criteria:** opening Settings lands on Garage; sub-tabs are comfortably
tappable at 380px width; all five reachable.

---

## WS-I — Default Font Scale = 1.15 (Large)

**Ask:** Make the **1.15×** (Large) scale the new default.

**Primary files:** `src/App.tsx` (theme default), `src/components/SettingsView.tsx`
(reset button default). **Shared:** minor.

**Steps:**
1. Change the default `AppTheme.fontSize` from `'standard'` to `'large'` in the
   initial theme (App.tsx `useState` initializer/default object) **and** in the
   Settings "Reset to Defaults" handler.
2. **Migration nuance:** only affects users with **no saved theme**. Existing users
   keep their choice. Do not force-override a stored `fontSize`.

**Success criteria:** fresh installs render at 1.15×; existing users unaffected;
reset returns to Large.

---

## WS-J — Reference Tab Overhaul (adjustments only) + new adjustment data

**Ask:** Under Reference, remove all "baseline" information — keep only
adjustments. Add **tire-pressure (per corner)**, **spring-rate**, and
**weight-distribution** adjustment guidance for **dirt Modifieds and dirt Late
Models** (data researched — see **Appendix A**).

**Primary files:** `src/components/QuickReferenceView.tsx`.

**Steps:**
1. Audit `QuickReferenceView`: it's already a symptom-based "Adjustment Finder"
   (`baseAdjustments` + `conditionAdjustments`). **Remove any static baseline
   setup-value/reference content** (baseline numbers, starting-point tables, or a
   "baseline" section) and keep only the symptom→adjustment finder.
2. Add three new adjustment categories/knobs so the finder (or a new "Adjustment
   Reference" section) covers:
   - **Tire pressure per corner** (LF/RF/LR/RR) — direction + typical psi step and
     the tight/loose effect (Appendix A.1).
   - **Spring-rate** changes by corner for tight/loose on entry vs exit, with
     typical lb/in steps (Appendix A.2).
   - **Weight distribution / crossweight (wedge) + left %** — how wedge/LR bite and
     left-side % move handling (Appendix A.3).
3. Keep it **Modified + Late Model** framed. Cite that these are starting points
   ("change one thing at a time, re-scale, re-check"). Optionally tie the presets
   to the WS-L track-condition dropdown so the finder can factor condition.

**Considerations:** this is guidance content, not physics truth — label as
"starting points". Keep the existing short-label UI style. Store the adjustment
data as typed constants (not hardcoded JSX) so it's maintainable.

**Success criteria:** Reference contains **no** baseline info; tire-pressure,
spring-rate, and weight-distribution adjustments are present, corner-specific, and
readable; content matches Appendix A.

---

## WS-K — Light Mode Fixes

**Ask:** Light mode has weird, hard-to-read behavior (see screenshot: dark/near-
black form panels on a light page, low-contrast text, grey "baseline" block).

**Primary files:** `src/index.css` (`@theme` light tokens + any hardcoded darks),
component-level hardcoded colors.

**Steps:**
1. Audit hardcoded dark colors that ignore the theme: search for `bg-[#111]`,
   `bg-[#141414]`, `bg-[#0e0e0e]`, `bg-black`, `text-black`, literal hex in
   `className`/inline styles (SetupView corner/tire panels, RaceWeekendView tire
   cards, inputs). Replace with theme tokens (`bg-surface`,
   `bg-surface-container`, `bg-surface-container-high`, `text-on-surface`).
2. Verify light-mode `--color-*` tokens in `index.css` give sufficient contrast
   (WCAG AA for body text). Fix input fields (currently near-black) to use surface
   tokens so they're legible on a light page.
3. Check the "CAR SETUP INFO BASELINE" grey block and toast/badge colors in light
   mode (the green "Saved" toast text/contrast, primary-on-light).
4. Test every tab in light mode at both dark and light, standard and large font.

**Considerations:** many components were built dark-first with literal hex — this
is mostly a find-and-replace-with-tokens pass plus token tuning. Don't regress dark
mode. Accessibility matters (trackside glare, non-tech users).

**Success criteria:** every screen is legible and consistent in light mode; no
black-on-black or dark-panel-on-light artifacts; dark mode unchanged.

---

## WS-L — New Session: Track-Condition Dropdown + free text

**Ask:** When creating a session, offer dropdown track-condition presets **plus** a
free-text box for extra detail.

**Presets:** `Wet/Green`, `Tacky/Heavy`, `Cleaned Off`, `Rubbered Up`, `Dry Slick`.
Free-text example additions: Rough / Smooth / Dusty / One Lane.

**Primary files:** `src/App.tsx` (new-session form, `newSessionCond` state),
`src/types.ts` (optional `trackConditionPreset` field), `RaceWeekendView.tsx` (if
condition is editable there too).

**Steps:**
1. Add a preset dropdown bound to a new `trackConditionPreset` value; keep the
   existing free-text `condition`/notes box for extras. Persist both onto the
   session (`SessionRecord.condition` can store the preset; add
   `conditionNotes?` for the free text, or concatenate — prefer separate fields).
2. **Align with Reference (WS-J):** reuse/normalize the same condition vocabulary
   as `QuickReferenceView`'s `TrackCondition` so the finder and sessions speak the
   same language (map presets → reference conditions where they differ, e.g.
   Tacky/Heavy → tacky).
3. Show the preset on session cards and include it in exports (WS-G).

**Success criteria:** session creation has the 5 presets + a free-text box; both
persist, display, and export; vocabulary aligns with Reference.

---

## WS-M — Dashboard Navigation Fixes (Tires broken)

**Ask:** On the Dashboard, each panel item should navigate to its respective page.
**Tires doesn't work** right now.

**Root cause (verified):** in `DashboardView.tsx`, the **Setups** panel rows call
`onSelectSetup(id)` (navigates), but the **Tires** panel header only toggles
`setTiresOpen` (expand/collapse) and tire rows have no navigation. There is no prop
to deep-link into **Setups → Tires** sub-tab.

**Primary files:** `src/components/DashboardView.tsx`. **Shared:** `App.tsx` (add a
deep-link like `setupSubTab` state, mirroring `settingsSubTab`) and
`SetupView.tsx` (accept `initialSubTab` to open on the Tires sub-tab).

**Steps:**
1. Add `setupSubTab` state in `App.tsx` (values `'setups' | 'smasherloads' |
   'tires'`) and pass it to `SetupView` as `initialSubTab` (SetupView already has
   internal `subTab` state — accept a prop and seed from it).
2. Add an `onGoToTires` (and `onGoToSetups`) callback to `DashboardView`; wire the
   Tires panel header (and/or a "View all" affordance) to set
   `setupSubTab='tires'` + `activeTab='setups'`. Keep the inline expand too if
   desired, but ensure a clear navigation path exists.
3. Audit the other Dashboard panels (Setups ✓, Open Tasks → trackers) to confirm
   each routes correctly.

**Success criteria:** tapping Tires on the Dashboard opens Setups → Tires; Setups
and Tasks also navigate correctly.

---

## Appendix A — Dirt Modified / Late Model Adjustment Reference (for WS-J)

> **Framing:** starting points for **dirt Late Models and Modifieds**. Change **one
> thing at a time**, then re-scale and re-check ride heights/toe/crossweight.
> "Tight/push" = front slides (not enough steering). "Loose/free" = rear slides
> (too much steering). Corner phases: **Entry**, **Center/Middle**, **Exit/Off**.

### A.1 Tire Pressure (per corner)
General principles:
- **Lower pressure = more tire on the ground = more grip** at that corner (and less
  effective spring rate); **higher pressure = less grip, more stability**, and adds
  effective spring rate.
- Adjust in small steps (≈ **1–2 psi**); track temp changes pressure, so re-check
  through the day. Typical dirt pressures are low; always follow tire-mfr limits.

Corner-by-corner effect (raising pressure at that corner unless noted):
- **RF ↑**: less RF grip → frees the car through the middle (helps a **tight**
  car). **RF ↓** adds front grip → helps a car that **pushes/tight in**.
- **LF ↑/↓**: LF ↓ adds left-front bite/steering (helps **tight-in**); LF ↑ calms
  an **over-steering entry**.
- **RR ↑**: less RR grip → looser off the corner (helps **tight-off**). **RR ↓**
  adds forward bite → helps a car that's **loose-off/spinning**.
- **LR ↑/↓**: LR ↓ adds LR bite/forward drive (helps **loose-off**); LR ↑ reduces
  bite (helps **tight-in from too much LR**).

### A.2 Spring Rate (per corner; front steps ≈ 25–50 lb/in, rear ≈ 10–25 lb/in)
- **Tight on Entry:** soften **LF** and/or stiffen **RF** (≈25–50 lb/in). Also
  consider RF −25–50 or RR +25; re-check toe & crossweight.
- **Loose on Entry:** stiffen **LF** and/or soften **RF**.
- **Tight off (Exit):** soften **LR** and/or stiffen **RR**; or soften LF; verify
  throttle application.
- **Loose off (Exit):** stiffen **LR**… (calm rotation) — commonly **stiffen RR
  25** or **soften LR 25**; also check rear steer and shock rebound.
- Rule: one spring at a time; re-scale and re-check ride heights after each change.

### A.3 Weight Distribution / Crossweight (Wedge) & Left %
- **Crossweight (wedge) = LR% + RF%.** Over 50% = wedge; under 50% = reverse wedge.
- **More wedge** → more push (understeer) into/through the middle in a left turn,
  but the LR carries more load so the car **drives off** better; **too much** wedge
  makes the LR much heavier than RR → **loose into and through** the middle.
- **Too little wedge** → **tight into and through** the middle.
- **Dirt trend (starting window):** **left-side ≈ 53.5–55%**, and roughly
  **75–125 lb of wedge** (adjust to track/tackiness).
- **Adjusting:** raising ride height at a corner **adds** weight there **and** at
  the diagonally opposite corner, removing it from the other two — the primary way
  to add/remove wedge (jacking bolts / spring spacers / ride heights).
- Relationship to **LR bite:** dirt setups often think in "LR bite" (forward drive)
  vs. raw cross % — expose both if practical.

**Sources (verify/expand during WS-J):**
- Matt Murphy "Chassis Tuning 101": https://www.amaintracks.com/wp-content/uploads/2016/03/Murfdogg_Chassis_Tuning_101.pdf
- GRT Race Cars Adjustment Guide: https://www.teamgrt.com/GRT_RACE_CARS_ADJUSTMENT_GUIDE.pdf
- Speedway Motors — Tire Pressure Setup: https://www.speedwaymotors.com/the-toolbox/optimal-tire-pressure-setup-for-quick-lap-times/29995
- Speedway Motors — Weight Distribution / Corner Balance: https://www.speedwaymotors.com/the-toolbox/race-car-weight-distribution-and-how-to-corner-balance/134049
- Hogan Technologies — Balancing a Dirt Stock Car: http://hogantechnologies.com/balancing-a-dirt-stock-car-part-1/
- DirtTrackHQ — Spring Rates Explained: https://www.dirttrackhq.com/questions/dirt-track-spring-rates-explained/

---

## Global Success Criteria & QA Checklist
- [ ] All WS merged into `preview`, pushed to `origin/preview`, deployed to a
      Netlify **preview** URL (never prod without explicit approval).
- [ ] `tsc --noEmit` adds no new errors beyond the 3-error baseline.
- [ ] Works offline; syncs when online; team RLS unaffected.
- [ ] Light **and** dark mode legible on every tab; font scales standard→XX-Large.
- [ ] Car scoping intact (setups/tires/shocks scoped; weekends/todos/accounting
      global).
- [ ] No data loss: dual-write everywhere; deletions call `delete*FromCloud`.
- [ ] Existing data migrates with sane defaults (tires get age/cycles; weekends
      get empty weather arrays; theme default only affects new users).
- [ ] APK still builds (bump `versionCode` in `android/app/build.gradle` when
      shipping an installable build).

## Risks & Considerations
- **`App.tsx` is a monolith** — the biggest merge-conflict risk. Do WS-A first;
  keep other App.tsx edits surgical and in different regions; extract logic to new
  files.
- **PWA cache** hides updates — always verify previews in incognito / after a hard
  refresh; the service worker is `autoUpdate`.
- **Netlify credits** — production deploys consume credits and are owner-gated.
- **Weather APIs** are keyless but rate-limited and the archive API lags ~5 days —
  cache results on the weekend record and use `past_days` for the gap.
- **Base64 images** in exports and records can bloat payloads — downscale for print.
- **Supabase migrations** apply to the live project — additive `IF NOT EXISTS` only;
  never drop columns in this batch.
