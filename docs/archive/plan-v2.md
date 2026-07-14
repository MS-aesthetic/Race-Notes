> **SUPERSEDED 2026-07-14** by `plan-v3-ux-corrections.md` (the active roadmap
> for the owner UX-correction batch, UXF-1…UXF-9). This file is archived for
> reference. WS-N…Z technical history remains the record of what those
> workstreams did; WS-T/U/W/X/Y are **pending, not cancelled** — a future plan
> must re-adopt them; archiving this file is not a decision to drop them.

# CREW CHIEF — Build Plan v2 (Multi-Agent): ERP · Checklists · Location/Push · Truck Directions

> **2026-07-12 active-track override:** this document remains authority for the
> WS-N…Z batch, but current UX feature work is on `preview-v3`. Chunks 1–5 and
> urgent repair UX-R1 are complete; Chunk 6 is next and unblocked. Use `docs/IMPLEMENTATION_PLAN_2026-07-12.md`,
> `ralph/CURRENT_TASK.md`, `ralph/STATE.md`, and `HANDOFF.md` for that track.
> Do not follow the stale `preview-v2` branch directions below for UX work.

> **Purpose.** Single source of truth for the **v2 feature batch**. Written so multiple
> AI coding agents can work in parallel with minimal collisions, in the same format as
> `plan.md` (WS-A…WS-M, all complete). This batch continues at **WS-N**.
>
> **Branch:** all v2 work happens on **`preview-v2`** (worktree: `.worktrees/v2`).
> Every merge from `preview-v2` to `preview`, and from `preview` to `master`,
> requires explicit Maxx approval.
>
> Keep these architecture rules from v1; do not inherit v1 branch/deploy steps:
> local-first dual-write, no router, car scoping via `byActiveCar()`, all types in
> `src/types.ts`, all sync in `src/lib/sync.ts`, additive `IF NOT EXISTS` migrations
> with `in_same_team()` RLS, deletion requires `delete*FromCloud()`, tsc baseline =
> 3 known errors, builds/git through Windows PowerShell only.

---

## 0. The Four Features — Analysis & Decisions

| # | Feature | Verdict | Core risk |
|---|---------|---------|-----------|
| 1 | **Maintenance / ERP** (laps & time on parts) | Highest value / lowest risk — direct extension of the proven tire-lifecycle pattern (WS-C, `tireHistory.ts`) | Getting usage derivation right (single source of truth = session data) |
| 2 | **Pre-race checklists** | Low risk — Todo/template infrastructure already half-exists (`todos.is_template`) | Template vs instance semantics |
| 3 | **Location sharing + push** | Highest infrastructure lift — first server-side code (Edge Functions), FCM, Realtime, new privacy surface | Push token lifecycle across PWA + APK; privacy design |
| 4 | **Truck directions** | Biggest external-dependency surface — HERE API key, map rendering, quota | HERE quota (30k/mo free); honest scoping: route *planning* in-app, live turn-by-turn via handoff |

**Decisions made (with Maxx, 2026-07-02):**
- Routing provider: **HERE** (Routing API v8 `transportMode=truck` — grade/curvature/truck-attribute aware; free tier 30k req/mo).
- Push backend: **Supabase Edge Functions + FCM** (stays in existing stack; Realtime for live locations). No OneSignal.
- Priority order: **ERP → Checklists → Location/Push → Directions.**
- Deliverable now: this plan + scaffold (types, draft migrations, lib/component skeletons) on `preview-v2`.

**Resolved decisions (Maxx, 2026-07-06):**
1. *(WS-O)* **Rig is its own team-wide entity.** The hauler transports any of the team's cars, so `scope: 'rig'` components are **team-global** — never car-filtered, visible to the whole team, usage counted in weekends/days across all cars. `scope: 'car'` components filter by `byActiveCar` as usual.
2. *(WS-P)* **Service lives in the Trackers tab, modeled as to-do templates.** Recurring maintenance (weekly car maintenance etc.) is presented like the existing Todo template UX — a "Service" sub-tab in Trackers whose items are template-driven and auto-tracked by the maintenance engine (WS-O derivation still applies; the template look/feel comes from Todos).
3. *(WS-T)* **Foreground-only location sharing** for v1 (app open). Background tracking deferred.
4. *(WS-W)* **Leaflet + free OSM raster tiles** (the cheaper option) — no tile key; HERE quota spent only on routing/geocoding/POI.
5. *(WS-V)* **Default truck profile:** 20,000 lb gross weight · 10 ft height · 48 ft length · 7 ft width (editable per team; `DEFAULT_TRUCK_PROFILE` in `types.ts`).

---

## 1. Coordination

### Dependency graph / execution order
```
WS-N  Data model + migrations v2 (foundation — DO FIRST, blocks everything)
  ├──► WS-O  Maintenance engine (lib + sync)      ──► WS-P  Maintenance UI
  ├──► WS-Q  Checklist engine (templates+instances)──► WS-R  Checklist UI
  ├──► WS-S  Push infrastructure (FCM + Edge Fn)  ──► WS-U  Ping/notify UX
  │            └────────────────────────────────────┐
  ├──► WS-T  Location sharing (Realtime + map) ────┴► WS-X  Teammates-on-route + ETA
  └──► WS-V  HERE routing lib                     ──► WS-W  Trip planner UI ─► WS-X
WS-Y  QA hardening + release (last; gates the batch)
```
- **Parallel lanes after WS-N:** (O→P), (Q→R), (S, T, V) can all run concurrently —
  they own disjoint files.
- **WS-S before WS-U/X**; **WS-V before WS-W**; **WS-T and WS-W before WS-X**.
- `App.tsx` and `types.ts` are hot files: WS-N lands *all* type/migration changes up
  front; later workstreams touch `App.tsx` only in their designated region and keep
  diffs surgical (extract logic into `src/lib/*` / new components).

### File ownership matrix
| Workstream | Primary (owns) | Shared (coordinate) |
|---|---|---|
| WS-N | `types.ts`, `supabase/migrations/011–013_*.sql`, `sync.ts` mappers, `data.ts`, `.env.example` | — |
| WS-O | `src/lib/maintenance.ts` | `sync.ts` (its own section), `App.tsx` (state block) |
| WS-P | `src/components/MaintenanceView.tsx` | `TrackersView.tsx` (add sub-tab), `DashboardView.tsx` (panel), `App.tsx` (wire) |
| WS-Q | `src/lib/checklists.ts` | `sync.ts`, `App.tsx` (state block) |
| WS-R | `src/components/ChecklistsView.tsx` | `TrackersView.tsx`, `RaceWeekendView.tsx` (weekend section), `App.tsx` |
| WS-S | `src/lib/push.ts`, `supabase/functions/send-push/`, `android/` (FCM config) | `App.tsx` (auth region), `AndroidManifest.xml`, `vite-plugin-pwa` SW config |
| WS-T | `src/lib/location.ts`, `src/components/TeamMapView.tsx` | `TeamView.tsx` (revive — currently orphaned), `App.tsx` |
| WS-U | notification UI (`src/components/NotificationsPanel.tsx`) | `App.tsx` (header bell), `TeamMapView.tsx` |
| WS-V | `src/lib/geo/here.ts`, `src/lib/geo/flexpolyline.ts` | `.env.example` |
| WS-W | `src/components/TripPlannerView.tsx` | `RaceWeekendView.tsx` ("Directions" button), `App.tsx` (tab/deep-link) |
| WS-X | — (integration) | `TripPlannerView.tsx`, `TeamMapView.tsx` |
| WS-Y | test scripts, `docs/QA_V2.md` | everything (read-only + fixes) |

### Execution model — the Ralph Loop (VS Code + GitHub Copilot)

Every workstream is delivered through a repeating **plan → build → test** loop run
inside VS Code with GitHub Copilot custom agents (`.github/agents/*.agent.md`).
Loop state lives in `ralph/STATE.md`; the active work order lives in
`ralph/CURRENT_TASK.md`. These files + git commits hold durable state so any
session can resume cold. Cavecrew messages/tool results may carry transient
coordination; decisions affecting scope/status must be persisted.

```
┌─► 1. PLAN   ws-planner  (GPT 5.6 SOL High)
│      Reads plan-v2.md + ralph/STATE.md → picks the next unblocked WS →
│      writes ralph/CURRENT_TASK.md (scope, files, steps, acceptance criteria).
│
│   2. BUILD  ws-builder  (GPT 5.6 Terra High)
│      Implements EXACTLY ralph/CURRENT_TASK.md. Runs `npm run lint` +
│      `npm run build` before finishing. Commits WIP to `preview-v2`
│      ("WS-x attempt N: ..."). Never edits plan-v2.md or STATE.md.
│
│   3. TEST/QA  ws-qa  (GPT 5.6 SOL High)
│      Grades the diff against the rubric below. Writes grade + findings into
│      ralph/STATE.md and updates ralph/CURRENT_TASK.md with concrete fixes.
│      ├─ PASS (all gates + score ≥ 90) → mark WS complete in STATE.md,
│      │    squash-worthy note for Coordinator, attempts = 0 ──────────────┐
│      ├─ FAIL reviewing attempt 1–2 → Terra BUILD, next attempt           │
│      └─ FAIL reviewing attempt 3 → SOL FIX takeover                      │
│                                                                          │
│   4. FIX   ws-fixer  (GPT 5.6 SOL High)                                 │
│      Takes over the branch, fixes the failures directly, re-runs         │
│      lint/build, hands back to 3. TEST/QA. Reset only after QA PASS.     │
│                                                                          │
└──────────────────────────── next WS ◄────────────────────────────────────┘
```

**Model routing (owner directive 2026-07-11):**
| Agent | File | Model | Role |
|---|---|---|---|
| `ws-planner` | `.github/agents/ws-planner.agent.md` | GPT 5.6 SOL High | Analysis, spec, work order |
| `ws-builder` | `.github/agents/ws-builder.agent.md` | GPT 5.6 Terra High | Feature implementation |
| `ws-qa` | `.github/agents/ws-qa.agent.md` | GPT 5.6 SOL High | Independent QA, plan/task updates, loop gate |
| `ws-fixer` | `.github/agents/ws-fixer.agent.md` | GPT 5.6 SOL High | Implementation takeover after third failed QA review |

QA failures 1–2 return to Terra. Failure 3 (more than two failed QA reviews)
transfers implementation to SOL; SOL performs final QA afterward. Model identity
must come from rollout `turn_context.payload.model`, not prose self-identification.
Use explicit task-turn model overrides and `scripts/verify-agent-handoff.ps1`.

**QA grading rubric (ws-qa; every gate is hard — any miss = FAIL):**
1. `npm run lint` — zero errors beyond the 3-error baseline.
2. `npm run build` succeeds (Windows).
3. Scope: diff touches only the WS's Primary/Shared files (ownership matrix).
4. Architecture: local-first dual-write; no router; car/rig/global scoping
   correct; types only in `types.ts`; sync only in `sync.ts`;
   `delete*FromCloud` on every delete path; theme tokens (no hardcoded hex).
5. Acceptance criteria from `ralph/CURRENT_TASK.md` all demonstrably met.
Score the remainder 0–100 (code quality, edge cases, offline behavior,
light/dark, font scale). **Pass = all gates + score ≥ 90.**

**Copilot/VS Code ground rules:**
- Agents run in the `.worktrees/v2` folder opened as the VS Code workspace
  (branch `preview-v2`); terminal = Windows PowerShell (lint/build/git all work
  natively there).
- One WS in flight at a time (the loop is serial by design — merge-conflict-free
  by construction; parallel lanes in the dependency graph tell the planner what's
  *eligible*, not what to run concurrently).
- **Human-only gates (Maxx / Coordinator, never any agent):** applying Supabase
  migrations, `supabase secrets set`, Firebase/HERE console setup, Netlify
  deploys beyond preview, merging `preview-v2` → `preview` → `master`,
  Google Play / APK signing.
- Commit style: `WS-x attempt N: <summary>` while looping; ws-qa notes the final
  passing commit hash in STATE.md.
- **All agents talk /caveman (full)** — saves tokens per loop iteration. Applies
  to chat replies, CURRENT_TASK.md, STATE.md entries, QA findings: drop
  articles/filler/hedging, fragments OK, short synonyms. Exact always: technical
  terms, code symbols, file paths, error strings, acceptance criteria numbers.
  Normal prose exempt: code blocks, commit messages, security warnings,
  irreversible-action confirmations, multi-step sequences where fragment order
  risks misread.
- **All delegated work uses cavecrew.** Read
  `.agents/skills/cavecrew/SKILL.md` and `.agents/skills/caveman/SKILL.md` first.
  Investigator locates code; builder handles known edits of at most two files;
  reviewer checks diffs. Primary agent owns cross-cutting builds.

---

## WS-N — Data Model & Migrations Foundation v2 *(do first; blocks all)*

**Goal:** land every new type, localStorage key, Supabase table/column, and sync
mapper so downstream agents never fight over `types.ts`/`sync.ts`.

**Primary files:** `src/types.ts`, `supabase/migrations/011_maintenance.sql`,
`012_checklists.sql`, `013_location_push.sql`, `src/lib/sync.ts`, `src/data.ts`,
`.env.example`.

**New types (scaffolded on `preview-v2` — see `src/types.ts`):**
- `MaintenanceComponent` — a tracked part/service item. `scope: 'car' | 'rig'`;
  `carId?` (car-scoped when `scope==='car'`); `category` (Oil, Motor, Transmission,
  Bearings, Shocks, Trailer, Other + free text); interval = `{ type: 'laps' |
  'sessions' | 'races' | 'days', value: number }`; `lastServicedAt` ISO;
  `manualUnits?` for non-derivable counters.
- `MaintenanceLog` — service history row; resets the component's counter; optional
  `cost` + `accountingEntryId` (ties a service into the existing accounting ledger).
- `ChecklistTemplate` + `WeekendChecklist` (+ `ChecklistItemState`) — reusable
  template → per-weekend instance with `done/doneBy/doneAt` per item.
- `PushTokenRecord`, `AppNotification` (`type: 'ping' | 'come_here' | 'system'`,
  `data` payload incl. optional lat/lng target).
- `TeamLocation` — `userId, teamId, lat, lng, heading?, speedMph?, updatedAt,
  expiresAt, label?` (e.g. "On the way").
- `TruckProfile` — rig dimensions/weights for HERE truck routing (stored in
  `Team.profile` json + local).
- `SavedTrip` — origin/destination, HERE route summary, decoded polyline, chosen
  truck stops, `weekendId?`.

**New localStorage keys:** `race_notes_maintenance`, `race_notes_maintenance_logs`,
`race_notes_checklist_templates`, `race_notes_weekend_checklists`,
`race_notes_trips`, `race_notes_truck_profile`, `race_notes_location_optin`
(device-local, never synced — like `race_notes_active_car`).

**Migrations (drafted in scaffold — apply with owner approval only):**
- `011_maintenance.sql` — `maintenance_components`, `maintenance_logs` (both
  `id text pk`, `user_id`, `car_id text null`, jsonb payload columns, `updated_at`;
  RLS via `in_same_team()`).
- `012_checklists.sql` — `checklist_templates`, `weekend_checklists`
  (`items jsonb`, `weekend_id text`, RLS team-shared like `todos`).
- `013_location_push.sql` — `push_tokens` (`user_id, token, platform, device_id`,
  unique on token), `notifications` (`to_user, from_user, team_id, type, title,
  body, data jsonb, read_at`), `team_locations` (`user_id pk, team_id, lat, lng,
  heading, speed_mph, label, updated_at, expires_at`) + **Realtime publication**
  on `team_locations` and `notifications`. RLS: rows visible to `in_same_team()`
  only; `push_tokens` visible to owner only (Edge Function uses service role).

**sync.ts:** add push/pull/delete helpers following the existing debounced-upsert
pattern for maintenance, checklists, trips. Location/notifications are **not**
part of the local-first sync loop — they're live data (Realtime + Edge Functions),
documented as such.

**Success criteria:** tsc clean (baseline 3); migrations reviewed + applied;
new fields round-trip local↔cloud; zero UI change.

---

## WS-O — Maintenance Engine (`src/lib/maintenance.ts`)

**Ask:** track laps/time/races on parts — oil changes, races on motor, bearing
service, trans fluid, shock rebuilds/laps, trailer maintenance, etc.

**Design (mirrors `tireHistory.ts` — derive, don't hand-count):**
1. Usage is **derived from weekend/session data** since `lastServicedAt`:
   - `laps` = Σ `SESSION_TYPE_LAPS[session.type]` for the component's car
   - `sessions` = count of sessions; `races` = count of Feature sessions
   - `days` = days since `lastServicedAt`
   - `scope:'rig'` components count **weekends** (the hauler goes to every race,
     regardless of which car) or days — never car sessions, never car-filtered
     (decision #1: rig is a single team-wide entity).
2. `getComponentStatus(c, weekends, activeCarId) → { used, limit, pct, state }`
   where `state: 'ok' | 'due' | 'overdue'` (`due` at ≥ 80%, constant).
3. `logService(c, log)` → appends `MaintenanceLog`, sets `lastServicedAt`,
   optional linked `AccountingEntry` (reuse existing accounting handlers).
4. Seed catalog: DEFAULT_COMPONENTS constant (Oil change – 3 races; Motor
   freshen – 250 laps; Trans fluid – 60 days; Bearings – 10 races; Shock rebuild
   – 300 laps; Trailer bearings – 180 days; user edits/deletes freely).

**Success criteria:** unit-style verification via a temporary dev harness or
console assertions; counters reset on service log; car scoping correct; offline.

---

## WS-P — Maintenance UI ("Service" in Trackers, to-do-template style)

- **Trackers → new "Service" sub-tab** (decision #2): reuse the **Todo template
  UX** as the visual/interaction model — service items look and behave like a
  template-driven to-do list, but each row is backed by a `MaintenanceComponent`
  and auto-tracked by the WS-O engine: name · usage vs interval (`font-mono`) ·
  status chip (ok/due/overdue) · "Log service" action (modal: date, notes, cost →
  optional accounting entry) instead of a plain checkbox.
- Grouped **Car / Rig** (decision #1: Rig section is team-wide — the hauler
  serves every car, so rig items are never car-filtered and are visible/editable
  by the whole team). Add/edit/delete components; DEFAULT_COMPONENTS seed catalog
  offered as a starter template on first open.
- **Dashboard "Service Due" panel** (collapsible, like Tires): only `due`/`overdue`
  items, tap → Service sub-tab (mirror WS-M deep-link pattern: `trackersSubTab`).
- Car-scoped items respect `byActiveCar`; rig items always visible.

**Success criteria:** run a session → laps tick up; log an oil change → counter
resets + optional expense appears in Accounting; warning chips at 80%/100%.

---

## WS-Q — Checklist Engine (`src/lib/checklists.ts`)

**Ask:** configurable per-weekend checklists — supplies, trailer loading, truck
loading, car prep.

**Design:**
- `ChecklistTemplate` (categories: Supplies, Trailer Loading, Truck Loading,
  Car Prep, Custom) with ordered items. Ship 4 starter templates as constants
  (editable copies, not hardcoded UI).
- `instantiate(template, weekendId) → WeekendChecklist` — snapshot copy (later
  template edits don't mutate past weekends).
- Item check-off stamps `doneBy`/`doneAt` (team-aware, like TodoItem).
- Deleting a weekend nulls `weekendId` (association removed, list preserved) —
  same rule as WS-F.

## WS-R — Checklist UI

- **RaceWeekendView:** "Checklists" section in the weekend banner area — progress
  ring per list (`7/12`), tap to expand and check off. "Add checklist" → pick
  template(s) or blank.
- **New-weekend flow:** after create, offer template picker ("Add your usual
  checklists?").
- **Template manager:** inside the Trackers → Todos area or Settings; CRUD +
  reorder items.
- Todos stay untouched — checklists are a separate, weekend-anchored concept.

**Success criteria:** create weekend → attach templates → check off with name
stamps; template edits don't alter existing weekends; syncs to team; offline.

---

## WS-S — Push Infrastructure *(first server-side code)*

**Human-assisted setup (Maxx or Coordinator, ~30 min):**
1. Create Firebase project → add Android app `com.racenotes.app` →
   `google-services.json` into `android/app/`.
2. Web Push: Firebase web app config + VAPID key for the PWA.
3. Supabase: `supabase secrets set FCM_SERVICE_ACCOUNT_JSON=...` (FCM HTTP v1).

**Build steps:**
1. `@capacitor/push-notifications` (native) + Firebase JS SDK messaging (web).
   `src/lib/push.ts`: `registerForPush(userId)` — request permission
   (Android 13+ runtime `POST_NOTIFICATIONS`), obtain token, upsert into
   `push_tokens` with platform + device id; refresh handling; unregister on
   sign-out.
2. **Edge Function `send-push`** (`supabase/functions/send-push/`): auth'd invoke;
   payload `{ toUserId | toTeamId, notification: {...} }`; verifies caller shares
   a team with target (service-role client + `in_same_team`), inserts a
   `notifications` row, fans out FCM v1 sends to target tokens, prunes dead
   tokens on `UNREGISTERED` errors.
3. PWA service worker: `firebase-messaging-sw.js` alongside the Workbox SW
   (vite-plugin-pwa `injectManifest` or a second registered SW — verify no
   precache conflicts; test hard against the known PWA-cache gotcha).
4. Android: manifest additions (`POST_NOTIFICATIONS`), notification channel,
   tap-through deep link (`com.racenotes.app://notification?...` — reuse existing
   intent-filter pattern; don't disturb the OAuth deep link).

**Success criteria:** device A pings device B (APK + PWA); notification arrives
app-closed (native), tap opens the right screen; tokens cleaned up on sign-out.

---

## WS-T — Location Sharing (foreground, opt-in)

1. `src/lib/location.ts`: `startSharing(label?)` — `watchPosition` (Capacitor
   Geolocation on native, browser API on web), throttled upsert (≥15s or ≥100m
   delta) into `team_locations` with `expires_at = now()+4h`; `stopSharing()`
   deletes the row. Opt-in state is **device-local** (`race_notes_location_optin`).
2. Realtime: subscribe to `team_locations` for the user's team; expose
   `useTeamLocations()` state.
3. **TeamMapView** (Leaflet + OSM tiles): teammate markers (initials/avatar),
   freshness fade (grey >10 min), "sharing" indicator banner while active —
   always visible so nobody is shared silently.
4. Revive `TeamView.tsx` (currently orphaned) or fold team + map into a
   "Team" area reachable from Settings/Dashboard — Coordinator decision at wiring
   time; keep the six-tab bottom nav (no seventh tab; deep-link like Settings
   sub-tabs).

**Privacy rules (non-negotiable):** opt-in per device; TTL auto-expiry; visible
banner while sharing; one-tap stop; row hard-deleted on stop/sign-out; RLS =
same-team only.

## WS-U — Ping / "Come here" Notifications

- From TeamMapView or member list: **Ping** (generic "You're needed") and
  **"Come to me / come to X"** — attaches sender's current lat/lng or a picked
  point in `notification.data`.
- Recipient tap → app opens TeamMapView with target pin + "Directions" handoff
  (Google Maps URL with destination).
- In-app **NotificationsPanel** (header bell, unread badge, `read_at` marking) —
  Realtime subscription on `notifications`.

**Success criteria:** ping round-trip on two devices; location-target ping lands
the pin correctly; unread badge accurate; no cross-team leakage.

---

## WS-V — HERE Truck-Routing Library (`src/lib/geo/here.ts`)

1. `.env`: `VITE_HERE_API_KEY` (domain/app-restricted key; note: client-side by
   design — restrict in HERE console; usage alerting at 80% of 30k/mo).
2. Defaults (decision #5, `DEFAULT_TRUCK_PROFILE` in `types.ts`): **20,000 lb
   gross · 10 ft height · 48 ft length · 7 ft width** — editable per team.
3. Wrappers: `geocode(query)`, `truckRoute(origin, dest, profile: TruckProfile)` —
   Routing v8 `transportMode=truck` with `truck[grossWeight|height|length|width|
   axleCount]`, `avoid[features]=ferry,uTurns` + `tollTransponders` options as
   needed; request `return=polyline,summary,actions,tolls`; decode **flexible
   polyline** (`src/lib/geo/flexpolyline.ts` — vendor HERE's MIT reference
   implementation).
4. `findTruckStops(polyline)` / `findRestAreas(polyline)` — HERE Discover/Browse
   along route corridor (categories: truck stop `700-7900-0131`-family, rest area)
   with distance-along-route sorting. *(Verify exact category IDs against current
   HERE docs during implementation.)*
5. Cache route + POI results into the `SavedTrip` (avoid re-spending quota);
   offline: show cached trip, disable re-route.

## WS-W — Trip Planner UI (`TripPlannerView.tsx`)

- Entry points: **"Directions" button on a weekend** (destination pre-filled from
  `weekend.location`/track name) + a Trips list (per-weekend or ad-hoc).
- Origin: current GPS or saved "Shop" home base (stored in `TruckProfile`).
- Map: **Leaflet + free OSM raster tiles** (decision #4 — no tile key/cost),
  route polyline, truck-stop/rest-area markers with
  toggle chips; elevation/steep-grade warnings from HERE `notices` if present.
- Turn list: collapsible `actions` list (readable, `font-mono` distances).
- **Handoff:** "Start navigation" → opens Google Maps (`google.navigation:` intent
  on Android / universal URL on web) with the destination + up to 9 waypoints
  (chosen truck stops). In-app = planning/preview; voice nav = handoff. Honest v1.
- Save/share: trip saved to weekend; teammates see the same trip (synced).

## WS-X — Teammates on the Route

- TripPlannerView overlays `team_locations` markers (from WS-T) on the trip map;
  "ETA to track" per teammate = HERE route summary from their position (cache,
  refresh manually — quota).
- "On my way" quick action: starts sharing (WS-T) with label + optional push to
  team (WS-U).

**Success criteria (V/W/X):** a real route (e.g. shop → track) avoids
truck-restricted roads; truck stops appear along the corridor; handoff opens
Google Maps correctly on APK; teammates' pins + ETAs render; quota spend per
planned trip ≤ ~5 requests.

---

## WS-Y — QA Hardening & Release *(gates the batch)*

### Per-WS gates (Definition of Done — inherited from plan.md)
1. `npm run lint` — zero new errors over the 3-error baseline.
2. `npm run build` on Windows succeeds.
3. Netlify **preview** deploy, verified in incognito (PWA cache).
4. Offline pass: airplane mode → feature still works from localStorage; sync
   resumes online.
5. Light + dark, font scale standard→xxlarge.
6. Car scoping / global scoping correct per entity table above.
7. Deletion sync: every new entity delete calls its `delete*FromCloud`.

### Batch-level test matrix
| Area | Test |
|---|---|
| Migrations | Idempotent re-run (`IF NOT EXISTS`); existing rows get defaults; **Supabase advisors** clean (RLS enabled on all new tables) |
| RLS | Two test users, same team + third user outside team: verify visibility on all 6 new tables (SQL probes via Supabase MCP) |
| Maintenance | Laps derivation matches hand-count across 2 weekends; service reset; rig vs car scope; accounting link |
| Checklists | Template snapshot isolation; weekend delete nulls association; team co-editing (two browsers) |
| Push | APK app-closed delivery; PWA foreground + background; Android 13 permission flow; token pruning; sign-out cleanup |
| Location | TTL expiry; stop-sharing hard delete; banner always visible; >10min staleness fade; no leak to non-team user |
| Directions | Truck vs car route differs on a known restricted road; POI corridor sanity; offline cached trip; Google Maps handoff (APK WebView external-intent) |
| Regression | Full pass of existing tabs (setups, sessions, tires, smasher, todos, accounting, export) — v2 must not disturb v1 |
| Android | `versionCode` bump; APK over-install; `POST_NOTIFICATIONS` + location permission prompts; deep links (OAuth still works) |

### Release checklist
- [ ] All WS merged to `preview-v2` → reviewed → merged to `preview` (Coordinator)
- [ ] Migrations 011–013 applied to live Supabase (owner-approved)
- [ ] Firebase + HERE keys configured; secrets set; `.env.example` documents all
- [ ] Netlify preview URL signed off by Maxx
- [ ] APK built (`versionCode` +1), copied to Drive as `CrewChief-preview.apk`
- [ ] **No prod deploy, no merge to master** without explicit "push to production"

## Risks
- **App.tsx monolith** — same mitigation as v1: WS-N first, surgical regions,
  extract to libs. Consider extracting v2 state into custom hooks
  (`useMaintenance`, `useChecklists`) to keep App.tsx growth ~zero.
- **Two service workers** (Workbox + FCM) — the single riskiest integration; spike
  early in WS-S, before UI work.
- **HERE quota** — cache aggressively; alert at 80%; degrade to "open Google Maps"
  if exhausted.
- **Privacy** — location features ship only with the WS-T privacy rules intact.
- **Uncommitted work on `preview`** (package rename to `nimbus`, privacy.html) —
  belongs to Maxx; v2 worktree branched from committed HEAD; rebase `preview-v2`
  after that lands.

---

## WS-Z — July 11 Product Simplification *(in progress)*

Authoritative work order: `ralph/CURRENT_TASK.md`.

- Setup scale compatibility + exact LR/RR four-bar inputs.
- Device-local active weekend; session gating; dashboard-only weekend creation;
  no forced session; Sessions checklist retirement.
- One global Main Checklist; template import; retain Service/Templates/Accounting;
  retire Shopping surfaces while preserving legacy data.
