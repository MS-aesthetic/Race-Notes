# CREW CHIEF — Build Plan v2 (Multi-Agent): ERP · Checklists · Location/Push · Truck Directions

> **Purpose.** Single source of truth for the **v2 feature batch**. Written so multiple
> AI coding agents can work in parallel with minimal collisions, in the same format as
> `plan.md` (WS-A…WS-M, all complete). This batch continues at **WS-N**.
>
> **Branch:** all v2 work happens on **`preview-v2`** (worktree: `.worktrees/v2`),
> merged into `preview` per-workstream after review. `preview` → `master` remains
> owner-gated (Maxx explicit approval only).
>
> Inherit **§0 Working Agreement** and **§1 Coordination** from `plan.md` verbatim —
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

**Open decisions for Maxx (answer before the flagged WS starts):**
1. *(WS-O)* Trailer/truck maintenance items aren't car-scoped. Proposal: `scope: 'car' | 'rig'` on each component — `car` items filter by `byActiveCar`, `rig` items always show. OK?
2. *(WS-P)* Maintenance UI home: proposal = new **"Service" sub-tab in Trackers** (alongside Todos/Accounting/Shopping) + a "Service Due" dashboard panel. Alternative: sub-tab under Setups.
3. *(WS-T)* v1 location sharing is **foreground-only** (app open, "share while heading to track"). True background tracking needs an Android foreground service + `ACCESS_BACKGROUND_LOCATION` review — deferred to v3. OK?
4. *(WS-W)* Map tiles: proposal = **Leaflet + free OSM raster tiles** (no key, tiny lib, WebView-safe) with the HERE route polyline drawn on top; HERE quota spent only on routing/geocoding/POI. Alternative: HERE vector tiles (better look, more quota).
5. *(WS-V)* Default truck profile numbers needed: rig gross weight, height, length, width, axle count (editable per team; used for routing restrictions).

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

### Agent roles (how to run this with subagents/sessions)
| Role | Owns | Notes |
|---|---|---|
| **Coordinator** (main session) | plan-v2.md, merge order, `App.tsx` wiring conflicts, owner approvals | Only role that merges WS branches into `preview-v2`/`preview` |
| **Data-Model agent** | WS-N | One shot, reviewed carefully — everything depends on it |
| **Maintenance agent** | WS-O, WS-P | Mirrors `tireHistory.ts` patterns |
| **Checklist agent** | WS-Q, WS-R | Mirrors Todo patterns |
| **Platform agent** | WS-S | Needs Firebase console + Supabase secrets access (human-assisted steps flagged below) |
| **Geo agent** | WS-T, WS-U | Realtime + privacy review |
| **Routing agent** | WS-V, WS-W, WS-X | Needs HERE API key (human step) |
| **QA agent** | WS-Y + per-WS verification | Runs lint/build via Windows PowerShell, deploys Netlify previews, drives the test matrix |

**Tooling per agent:** host-side file tools only (never write through the Linux mount);
`npm run lint` + `npm run build` via Windows PowerShell; Supabase MCP for reading
schema/advisors and *drafting* migrations — **migrations are applied to the live
project only by the Coordinator with Maxx's approval**; Netlify CLI for preview
deploys only.

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
   - `scope:'rig'` components count **weekends** (trailer goes to every race) or
     days — not car sessions.
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

## WS-P — Maintenance UI ("Service")

- **Trackers → new "Service" sub-tab** (pending open decision #2): component list
  grouped Car / Rig, each row = name · usage vs interval (`font-mono`) · status
  chip (ok/due/overdue) · "Log service" button (modal: date, notes, cost →
  optional accounting entry). Add/edit/delete components; seed catalog offered on
  first open.
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
2. Wrappers: `geocode(query)`, `truckRoute(origin, dest, profile: TruckProfile)` —
   Routing v8 `transportMode=truck` with `truck[grossWeight|height|length|width|
   axleCount]`, `avoid[features]=ferry,uTurns` + `tollTransponders` options as
   needed; request `return=polyline,summary,actions,tolls`; decode **flexible
   polyline** (`src/lib/geo/flexpolyline.ts` — vendor HERE's MIT reference
   implementation).
3. `findTruckStops(polyline)` / `findRestAreas(polyline)` — HERE Discover/Browse
   along route corridor (categories: truck stop `700-7900-0131`-family, rest area)
   with distance-along-route sorting. *(Verify exact category IDs against current
   HERE docs during implementation.)*
4. Cache route + POI results into the `SavedTrip` (avoid re-spending quota);
   offline: show cached trip, disable re-route.

## WS-W — Trip Planner UI (`TripPlannerView.tsx`)

- Entry points: **"Directions" button on a weekend** (destination pre-filled from
  `weekend.location`/track name) + a Trips list (per-weekend or ad-hoc).
- Origin: current GPS or saved "Shop" home base (stored in `TruckProfile`).
- Map: Leaflet + OSM tiles, route polyline, truck-stop/rest-area markers with
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
