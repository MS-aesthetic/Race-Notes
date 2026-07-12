# CREW CHIEF — Agent Handoff & Onboarding

> **Purpose:** single entry point for any new LLM/agent picking up this project.
> Read this first, then the linked docs. Last updated **2026-07-12**.

> ### ⚡ Update 2026-07-12 (supersedes stale details below)
> - **Single worktree now.** The `.worktrees/v2` worktree was removed and the repo consolidated to ONE working tree at `C:\Users\maxx\antigravity\Race-Notes`, checked out on **`master`** (no longer detached HEAD). It holds both the app code AND the complete Android platform, so APKs build **directly here** — the old "build-from-main bridge" and the "incomplete v2 android platform" caveats are **retired**. Future parallel dev should use a fresh worktree named **`v3 preview`**.
> - **`master` == `origin/master` == `98bb2e0`+cleanup.** The `preview` (v1) and `preview-v2` branches were retired/removed after consolidation; `master` is the single source of truth. Deploys still default to Netlify preview; production only on Maxx's explicit say-so.
> - **Migration 014 IS applied to live Supabase** (`20260711151905`, applied 2026-07-11). Ignore older "014 not applied" notes.
> - **Current APK provenance established.** `android/app/build/outputs/apk/debug/app-debug.apk` (~9.1 MB) was built from secured commit `98bb2e0` on the complete Android platform, includes the native `@capacitor/push-notifications` plugin, and reflects the SW security fix. The old ~5 MB `CrewChief.apk` / `race_notes.apk` root copies were stale (pre-fix) and were **deleted** during cleanup.
> - **Repo hygiene pass done:** removed dead PWABuilder/TWA leftovers (root gradle files, `pwabuilder-adv-sw.js`, `metadata.json`, `build_apk.bat`, `PWA_INSTRUCTIONS.md`), retired v1 `plan.md`, untracked `.idea/` + root `local.properties`, and added `android/app/google-services.json` to `.gitignore`.

CREW CHIEF (brand: all caps) is a React + TypeScript PWA + Android app that helps
dirt-track racing teams track car setups, race sessions, tire inventory, weather,
pit-crew tasks, maintenance/ERP, pre-race checklists, and (in progress) push
notifications, live team location, and truck routing. Owner/decision-maker: **Maxx**.

Production URL (current deploy history not audited here): https://crew-chief-race-notes.netlify.app
WS-Z draft recorded at deployment time: https://6a525a23a0b54ce49ff7498c--crew-chief-race-notes.netlify.app
Repo (Windows host): `C:\Users\maxx\antigravity\Race-Notes`

---

## 0. Start-here reading order

1. **This file (`HANDOFF.md`)** — orientation, current status, session history, gotchas.
   - **[WS-Z handoff](./docs/HANDOFF_WS_Z_2026-07-11.md)** — exact changes, commits, validation, APK bridge, and remaining rollout gates.
   - **Security:** Existing copied WS-Z APKs predate secured commit `98bb2e0` and are not approved for redistribution, security QA, or native-push QA. Rebuild from current secured source first.
2. **`plan-v2.md`** — the ACTIVE roadmap (workstreams WS-N … WS-Z). Supersedes `plan.md`.
3. **`ralph/STATE.md`** — machine-readable loop state: what's done, scores, human gates, backlog.
4. **`ralph/CURRENT_TASK.md`** — the work order for the WS currently in flight.
5. **`CODEBASE_KNOWLEDGE.md`** — 1000-line deep technical reference (types, tables, components, gotchas, session history).
6. **`AGENTS.md`** — current architecture, workflow, cavecrew/caveman, model,
   branch, and deploy authority.
7. **`.github/agents/*.agent.md`** — the four Ralph-loop agent role definitions.

> **Doc-currency note:** `CODEBASE_KNOWLEDGE.md` predates parts of v2. Current
> workflow authority: `AGENTS.md`, this file, `plan-v2.md`, then `STATE.md`.
> Older sections in this file may still mention Shopping exports/state or earlier
> naming. The dedicated [WS-Z handoff](./docs/HANDOFF_WS_Z_2026-07-11.md) and
> `ralph/CURRENT_TASK.md` override those stale entries.

---

## 1. Repository layout, branches & worktrees (READ — easy to trip on)

Git worktrees in play:

| Path | Branch | Role |
|---|---|---|
| `C:\Users\maxx\antigravity\Race-Notes` | detached HEAD | **Main tree.** Has the COMPLETE Android platform (Gradle files, `google-services.json`, keystore, SDK `local.properties`). Used to build APKs. Preserve its current generated/host-specific dirty files. |
| `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v2` | `preview-v2` | **v2 dev worktree.** Where ALL current feature work (WS-N…WS-Z) happens. Web build works here. Its `android/` platform is INCOMPLETE. |

Audited refs on 2026-07-12: `preview` = `6407d6e`; `preview-v2` and `master` =
`98bb2e0`. Git refs do not indicate Netlify deployment state; current Netlify
deploy history was not audited in this handoff session. Main-tree dirty files to preserve: `android/app/capacitor.build.gradle`,
`android/capacitor.settings.gradle`, and untracked `android/app/google-services.json`.

**Critical gotchas about the split:**

- `android/app/build.gradle`, `android/build.gradle`, `android/app/google-services.json`, `android/local.properties`, `gradle.properties`, `settings.gradle` are **gitignored** → they exist only in the main tree, NOT in the v2 worktree. So **you cannot `assembleDebug` from the v2 worktree as-is.**
- **How APKs are currently built** (see §7): build the web in `preview-v2`, mirror `dist/` into the main tree, `cap sync` + `assembleDebug` there. Native Capacitor plugins added only in v2 (e.g. `@capacitor/push-notifications`) are therefore NOT in that APK — fine for UI testing, not for native-push testing.
- Branch rule: **all feature work on `preview-v2`**; the v1 line was `preview`. **NEVER merge to `master` or deploy to production without Maxx's explicit say-so.**

Package/app identity: **`nimbus.engineering.crewchief`** (renamed from `com.racenotes.app` this session — see §5). App name "Crew Chief". Native OAuth deep link kept for BOTH schemes during transition.

---

## 2. Tech stack

- React 19 + TypeScript, Vite 6, TailwindCSS v4 (`@theme` in CSS — **no** `tailwind.config.js`).
- Capacitor **8** (Android). JDK **21** required for Android builds (`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`).
- Supabase (Postgres + Auth + RLS + Edge Functions + Realtime).
- Netlify hosting (manual CLI deploy; NOT git-connected).
- **Local-first:** `localStorage` is the primary write target; Supabase is the secondary/optional sync layer (only when signed in). Live features (push, location) are the exception — they are server/Realtime data, NOT in the local-first loop.

### Architecture one-pager
- **No React Router.** Navigation = single `activeTab` string in `src/App.tsx`. Tabs: `dashboard | setups | raceweekend | trackers | quickref | settings`. Trackers = Checklist/Service/Templates/Accounting. No `todos` or `team` tab.
- **All domain state lives in `App.tsx`** and is passed down as props; views are prop-driven.
- **Dual-write pattern:** every mutation updates React state AND `localStorage`, then `if (user) push*()` to Supabase. Every delete path must also call `delete*FromCloud(id)`.
- **Car scoping:** setups, tires, shock sessions are scoped to the active car via `byActiveCar()` (`src/lib/scope.ts`); weekends, todos, accounting, shopping, checklists are global; maintenance components are `scope: 'car' | 'rig'` (rig = team-wide).
- Active car and active weekend are device-local (`race_notes_active_car`,
  `race_notes_active_weekend`; never synced).
- New TS interfaces → **only** in `src/types.ts`. Sync push/pull/delete helpers → **only** in `src/lib/sync.ts`.
- Styling: theme tokens only (`bg-surface`, `bg-surface-container`, `text-on-surface`, `text-on-surface-variant`, `text-primary`, `border-outline-variant`, `font-mono`, `font-display`). No hardcoded hex. Labels are `font-mono uppercase`.
- Lint = `tsc --noEmit` with a known **3-error baseline** (RaceWeekendView.tsx:368, SetupView.tsx:669, SmasherLoadsView.tsx:507). Never add errors on top. Vite build does NOT type-check.

---

## 3. Development approach — the "Ralph loop"

Development uses autonomous multi-agent loop. `ralph/STATE.md` (loop state,
verdicts, gates, backlog) and `ralph/CURRENT_TASK.md` (active work order) remain
durable authority so any session can resume cold. Cavecrew messages/tool results
may carry transient coordination; durable decisions must land in those files.

```
┌─► 1. PLAN   ws-planner   — picks next unblocked WS, writes CURRENT_TASK.md
│   2. BUILD  ws-builder   — implements EXACTLY the work order; lint+build before finishing;
│                            commits "WS-x attempt N: ..." to preview-v2
│   3. TEST/QA ws-qa       — grades diff vs rubric, writes verdict+fixes to STATE/CURRENT_TASK
│        ├ PASS (all gates + score ≥ 90) → mark complete, attempts=0 ─────────┐
│        ├ FAIL reviewing attempt 1–2 → Terra BUILD, next attempt             │
│        └ FAIL reviewing attempt 3 → SOL FIX takeover                        │
│   4. FIX    ws-fixer     — escalation; fixes directly, re-runs lint/build   │
└──────────────────────────── next WS ◄──────────────────────────────────────┘
```

### Agents & model routing (owner directive 2026-07-11)

| Agent | File | Model | Role |
|---|---|---|---|
| `ws-planner` | `.github/agents/ws-planner.agent.md` | **GPT 5.6 SOL High** | Analysis, spec, work order |
| `ws-builder` | `.github/agents/ws-builder.agent.md` | **GPT 5.6 Terra High** | Feature implementation |
| `ws-qa` | `.github/agents/ws-qa.agent.md` | **GPT 5.6 SOL High** | Independent QA, plan/task updates, loop gate |
| `ws-fixer` | `.github/agents/ws-fixer.agent.md` | **GPT 5.6 SOL High** | Implementation takeover after third failed QA review |

> Owner instruction (2026-07-11) supersedes prior Fable/DeepSeek/Opus routing.
> QA failures 1–2 return to Terra. Failure 3 transfers implementation to SOL;
> SOL then performs final QA. If exact models are unavailable, disclose that fact
> and never claim they ran.

### QA rubric (every gate is hard — any miss = FAIL)
1. `npm run lint` clean beyond the 3-error baseline.
2. `npm run build` succeeds (Windows).
3. Scope: diff touches only the WS's Primary/Shared files (see ownership matrix in `plan-v2.md`).
4. Architecture rules: local-first dual-write; no router; correct car/rig/global scoping; types only in `types.ts`; sync only in `sync.ts`; `delete*FromCloud` on every delete path; theme tokens (no hardcoded hex).
5. All acceptance criteria in `CURRENT_TASK.md` demonstrably met.
Then score the remainder 0–100 (code quality, edge cases, offline behavior, regression risk). PASS = all gates + ≥ 90.

### How this maps when a single coordinating agent runs the loop
When one coordinating agent drives everything: SOL plans, Terra builds, SOL QA
reviews. Coordinator persists `STATE.md`/`CURRENT_TASK.md` and commits. Two commits
per WS: `WS-x attempt N: …` (build) and `ws-qa: WS-x PASS (score) …` (state).

### Mandatory agent skills
- Read `.agents/skills/caveman/SKILL.md`.
  Use `/caveman full` for every development/status/user message. Code, commits,
  security warnings, and irreversible confirmations remain normal.
- Read `.agents/skills/cavecrew/SKILL.md`.
  Use investigator for tracing, builder for known edits of at most two files,
  reviewer for diffs. Primary agent owns cross-cutting builds of three or more files.
- These rules persist across future sessions until Maxx explicitly changes them.

---

## 4. Roadmap & status (from `plan-v2.md` + `STATE.md`)

**v1 (plan.md, WS-A…WS-M):** COMPLETE — data model, tire lifecycle, setup diff, task↔weekend, weather history, carry-over setups, exports, UI/theme/reference passes.

**v2 (plan-v2.md, WS-N…WS-Z):**

| WS | Title | Status |
|---|---|---|
| WS-N | Data model & migrations foundation (011–013, types, sync mappers, defaults) | ✅ complete |
| WS-O | Maintenance engine (`src/lib/maintenance.ts`) | ✅ complete |
| WS-P | Maintenance UI ("Service" in Trackers) | ✅ complete |
| WS-Q | Checklist engine (`src/lib/checklists.ts`) | ✅ complete |
| WS-R | Checklist UI | ✅ complete |
| WS-S | Push infrastructure (FCM + Edge Function) | ✅ complete (attempt 1, 93/100) — see §5 |
| WS-V | HERE truck-routing lib (`src/lib/geo/*`) | ✅ complete (attempt 1, 93/100) — see §5 |
| WS-T | Location sharing (Realtime + Leaflet map) | ⬜ pending |
| WS-U | Ping / "come here" notifications (needs WS-S ✅) | ⬜ pending |
| WS-W | Trip planner UI (needs WS-V ✅) | ⏸ **PARKED by owner** — location/map/directions deferred |
| WS-X | Teammates-on-route + ETA (needs WS-T + WS-W) | ⬜ blocked by WS-W |
| WS-Y | QA hardening + release (last; gates the batch) | ⬜ pending |
| WS-Z | July 11 product simplification | 🟡 code complete; rollout QA pending |

**Earlier human gates cleared 2026-07-10:** Firebase project +
`google-services.json` (nimbus); `FCM_SERVICE_ACCOUNT_JSON` secret in Supabase;
`VITE_HERE_API_KEY` + Firebase web config + VAPID in `.env.local`; migrations
011–013 applied to live Supabase; nimbus redirect URL added to Supabase Auth.

**Open WS-Z gate:** apply `supabase/migrations/014_team_delete_policies.sql`,
then run authenticated team-delete, offline reload, light/dark, zoom, and
mobile/incognito visual QA against latest draft. Production remains unchanged.

**After WS-Z:** WS-T then WS-U (WS-W parked, so WS-X/WS-Y wait on it).

---

## 5. Session history — what was done 2026-07-10 (the "previous chats")

This session cleared the v2 human gates and shipped two workstreams + a rename + UI fixes. Chronologically:

1. **Explained Firebase vs Supabase** and cleared all four human gates:
   - Firebase = push DELIVERY only (FCM). Supabase = backend (DB/auth/Edge/Realtime). The `send-push` Edge Function (Supabase) calls FCM (Firebase). Not redundant.
   - **Migrations 011–013 applied to live Supabase** via MCP (`apply_migration`): 8 new tables — `maintenance_components`, `maintenance_logs`, `checklist_templates`, `weekend_checklists`, `push_tokens`, `notifications`, `team_locations`, `saved_trips` — all RLS-enabled with `in_same_team()` policies; `team_locations`+`notifications` added to `supabase_realtime`. Additive/idempotent; no data touched.
   - Wrote `.env.local` (main tree + v2 worktree) with `VITE_FIREBASE_CONFIG_JSON`, `VITE_FIREBASE_VAPID_KEY`, `VITE_HERE_API_KEY`; Supabase creds too in the v2 copy. All gitignored.
   - Placed the correct `google-services.json` (package `nimbus.engineering.crewchief`, Firebase project `crew-chief-5fb7c`) into main-tree `android/app/`, added it to `.gitignore`, removed stray copies.
   - `FCM_SERVICE_ACCOUNT_JSON` set by Maxx in Supabase Edge Function secrets. Redirect URL `nimbus.engineering.crewchief://auth-callback` added to Supabase Auth by Maxx.
2. **Config:** routed `ws-qa` to Claude Fable 5 (high reasoning) in `plan-v2.md` + `ws-qa.agent.md`.
3. **WS-V — HERE truck-routing lib** (Fable-planned → built → Fable-QA 93/100, commits `3694aed`, `308eb93`): `src/lib/geo/flexpolyline.ts` (vendored MIT HERE decoder) + `src/lib/geo/here.ts` (`geocode`, `truckRoute` with imperial→metric truck params, `findTruckStops`/`findRestAreas` via HERE Discover, `planTrip`, typed `HereError`). Verified against the LIVE HERE API (real 5.5 mi truck route, 10 sorted truck stops, decode test vector). No UI (that's the parked WS-W).
4. **Package rename** `com.racenotes.app` → `nimbus.engineering.crewchief` on `preview-v2` (commit `02302d9`): `capacitor.config.ts`, `AndroidManifest.xml`, `strings.xml`, `MainActivity.java` (moved to nimbus package dir), `supabase.ts` `NATIVE_AUTH_CALLBACK_URL`. Old scheme kept alongside new for OAuth back-compat.
5. **WS-S — Push infrastructure** (Fable-planned → built → Fable-QA 93/100, commits `93d870d`, `31edf92`):
   - `src/lib/push.ts` — native (Capacitor push) + web (Firebase VAPID) register/unregister; idempotent `push_tokens` upsert; unregister-before-signout.
   - `public/firebase-messaging-sw.js` — registered at its own scope `/firebase-cloud-messaging-push-scope`, excluded from Workbox precache (`vite.config.ts` `workbox.globIgnores`) so the two SWs don't collide.
   - `supabase/functions/send-push/index.ts` — **deployed live** (ACTIVE, `verify_jwt`). Verifies team membership, inserts `notifications`, mints a Google token from `FCM_SERVICE_ACCOUNT_JSON` via Web Crypto RS256 JWT-bearer, fans out FCM HTTP v1, prunes dead tokens.
   - Wiring: `App.tsx` auth region registers on sign-in; `supabase.ts` `signOut()` unregisters (cycle-safe dynamic import). Android manifest: `POST_NOTIFICATIONS` + notification channel.
   - `tsconfig.json` now excludes `supabase/functions` (Deno code shouldn't be type-checked by the app tsc).
   - Live-verified: lint/build, both SWs in `dist`, edge function 401 (no auth) / 405 (bad method) / 401 (no user) smoke checks. **Deferred to WS-Y (needs a signed-in user JWT + a real device):** send-push 400/403/200 + notifications insert + token prune, and actual notification rendering.
6. **Debug APK** built for the emulator (see §7) so Maxx could test the app.
7. **UI fixes** (commit `3dcac32`) from emulator feedback:
   - Settings sub-tab bar (Garage/Account/Style/Export/Guide) font → `font-mono uppercase` to match the app (was `font-sans`).
   - Cloud-sync toggle knob now slides fully (`translate-x-[22px]` on a 44px track; was `translate-x-full` ≈ stuck mid-track).
   - Export view rebuilt into 4 PDF actions: **Export All / Export Setup (select) / Export Weekend (select) / Export Trackers (select: All/Tasks/Accounting/Shopping)**; kept Quick CSV exports and wired Shared-With-Me to the logged-in user; added `savedSetups`+`user` props through `SettingsView`.

**Commit trail on `preview-v2` (newest first):** `3dcac32` (UI fixes) · `31edf92` (WS-S QA) · `93d870d` (WS-S build) · `02302d9` (rename) · `d7c3a01` (ws-qa→Fable) · `308eb93` (WS-V QA) · `3694aed` (WS-V build).

---

## 6. Environment, secrets & external services

| Item | Where | Notes |
|---|---|---|
| Supabase project | `swblfeayxoprodhwxqak` (`https://swblfeayxoprodhwxqak.supabase.co`) | DB, auth, Edge Functions, Realtime |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `.env` (main) + `.env.local` (v2) | client sync/auth |
| `VITE_FIREBASE_CONFIG_JSON` / `VITE_FIREBASE_VAPID_KEY` | `.env.local` | web push |
| `VITE_HERE_API_KEY` | `.env.local` | HERE routing/geocode/discover; restrict by domain in HERE console; free tier 30k tx/mo |
| `FCM_SERVICE_ACCOUNT_JSON` | Supabase Edge Function secrets ONLY | never in a file; used by `send-push` |
| `google-services.json` | main-tree `android/app/` (gitignored) | package `nimbus.engineering.crewchief`, Firebase project `crew-chief-5fb7c` |
| Firebase project | `crew-chief-5fb7c` | Android app + Web app registered |
| Netlify | `crew-chief-race-notes` | manual CLI deploy; NOT git-connected |

> The Supabase MCP connector exposes DB/migrations/edge-functions/advisors/logs/docs — **not** GoTrue auth config. Redirect-URL / auth settings must be changed in the Supabase dashboard by a human.

---

## 7. Build, test & deploy procedures

### Web (works in the v2 worktree)
```
cd .worktrees\v2
npx vite build            # → dist/  (run via cmd; PowerShell blocks npm.ps1 by exec policy)
netlify deploy --dir=dist            # preview (default)
netlify deploy --prod --dir=dist     # production — ONLY when Maxx explicitly says so
```

### Android debug APK (current working method — the "build-from-main" bridge)
Because the v2 worktree lacks the Gradle/`google-services.json` files, the APK is produced from the main tree using the v2 web build:
```
# 1) build web in v2
cd /d C:\Users\maxx\antigravity\Race-Notes\.worktrees\v2 && npx vite build
# 2) mirror v2 dist into the main tree
robocopy ".worktrees\v2\dist" "C:\Users\maxx\antigravity\Race-Notes\dist" /MIR
# 3) sync + assemble in the MAIN tree (has full android platform + nimbus + google-services)
cd /d C:\Users\maxx\antigravity\Race-Notes
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
npx cap sync android
cd android && gradlew.bat assembleDebug --console=plain
# → android\app\build\outputs\apk\debug\app-debug.apk   (~5.3 MB)
```
Install to emulator: `"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "<apk>"` or drag onto the running emulator.
**Caveat:** native Capacitor plugins installed only in v2 (e.g. `@capacitor/push-notifications`) are NOT in this APK, so native push won't work in it (it no-ops gracefully). For a faithful v2 APK incl. native push, the v2 worktree's Android platform must be reconstituted first (copy the gitignored Gradle files + `google-services.json` from the main tree, then build in v2). This is a known TODO.

### Release APK / production
`android/app/build.gradle` (versionCode/versionName, keystore `crew-chief-release.jks`, pw `CrewChief2024!`, alias `crew-chief`) is gitignored and has been observed reverting — re-check before release. Bump `versionCode` for any APK meant to install over a previous one.

### Environment quirks that WILL bite you
- **PowerShell blocks `npm`** (`npm.ps1 cannot be loaded` exec policy) → run npm/npx via **cmd** (`npm.cmd`) or use `mcp__Desktop_Commander__start_process` with `shell: "cmd"`.
- PowerShell has **no `&&`** — use `;` (or use cmd).
- **cmd `set VAR=value && cmd`** captures a trailing space into VAR → wrap as `set "VAR=value"&&…` (this once produced bogus HTTP 401s in an API smoke test).
- Deno edge functions live under `supabase/functions/` and must be **excluded from the app `tsconfig`** (already done) or `tsc` errors on `Deno`/esm.sh imports.
- Migrations were applied via the Supabase MCP `apply_migration`; migration files 011–013 live in `.worktrees/v2/supabase/migrations/`.

---

## 8. Open items / backlog (from `STATE.md`)

- **WS-Y must live-verify** `send-push` authenticated paths (400 malformed, 403 non-teammate, 200 success + `notifications` insert, dead-token prune) with a real user JWT, plus actual push RENDERING on Android APK + web PWA.
- **HERE POIs** use Discover text search (`q=truck stop` / `q=rest area`) instead of category IDs — a documented robustness trade-off; consider category-ID filtering for non-English locales.
- **Deep-link scheme:** old `com.racenotes.app` scheme kept alongside `nimbus.engineering.crewchief` for back-compat — confirm intentional or remove later.
- **v2 Android platform** is incomplete (see §7) — reconstitute for native builds from v2, or keep the build-from-main bridge.
- WS-W (trip planner UI) parked by owner; revisit before WS-X/WS-Y can finish.

---

## 9. Owner constraints & etiquette

- **Never merge `preview-v2` → `master`, and never deploy to production, without Maxx's explicit approval.** Default all deploys to Netlify preview.
- Migrations/secrets/console setup are treated as human gates — surface them; apply DB migrations only with owner awareness.
- Keep commits scoped and use the loop's message convention (`WS-x attempt N: …`, `ws-qa: WS-x PASS …`).
- Prefer new files (`src/lib/*`, `src/components/*`) wired with minimal `App.tsx` diffs; `App.tsx` and `types.ts` are hot shared files.
