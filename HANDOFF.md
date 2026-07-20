# CREW CHIEF — Agent Handoff & Onboarding

> **Purpose:** single entry point for any new LLM/agent picking up this project.
> Read this first, then the linked docs. Last updated **2026-07-19**.

> ## Current override — UX Overhaul v2 final closeout
>
> - Active worktree: `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`.
> - Active branch/product QA base: `codex/ux-overhaul` at `ab2d03117c0475aa0abbef9ad38f2907edd3e881`; final documentation commits may sit above it.
> - `master` in `C:\Users\maxx\antigravity\Race-Notes` remains Release 5.0. Do not edit or merge it.
> - Final product QA is **PASS 100/100**. Repair 3 landed in `4698996` and its delayed-Undo race repair in `ab2d031`; no feature or user action was disabled.
> - Process disclosure: `4698996` was dispatched to Terra High in breach of v2.1-A's permanent Terra ban, with no recorded owner override. QA failed that attempt; the repair transferred permanently to SOL High for `ab2d031`, and Terra was not used again.
> - Final evidence: exact 24/24 harnesses, exact three-error lint baseline, 566-module build, UX v2 task-range product review PASS with literal-branch inheritance disclosed in the final handoff, four-size signed-out draft, Java 21 debug APK, and 3/3 stable Android lifecycle cycles with empty app warning/error and crash buffers.
> - Final draft: `https://6a5d7c9221f0e85b0eda6228--crew-chief-race-notes.netlify.app`.
> - Final debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 12,088,501 bytes, SHA-256 `59E20FDCB74F37AE3C3393202A458B7BBF97320994BF7FEE87D736C7BC8C8D42`.
> - The Part 6.4 cold-reader packet is [`docs/UX_OVERHAUL_V2_FINAL_HANDOFF_2026-07-19.md`](./docs/UX_OVERHAUL_V2_FINAL_HANDOFF_2026-07-19.md). It briefs a future independent reviewer; it is not that reviewer’s verdict.
> - Exact active work order: [`ralph/CURRENT_TASK.md`](./ralph/CURRENT_TASK.md).
> - Complete tools/build/test/current-state runbook: [`docs/UX_OVERHAUL_V2_AGENT_KNOWLEDGE.md`](./docs/UX_OVERHAUL_V2_AGENT_KNOWLEDGE.md).
> - Current routing: `gpt-5.6-sol` High implementation worker, primary `gpt-5.6-sol` Extra High QA/plan authority. Terra and `cavecrew-builder` forbidden. `/caveman full`; cavecrew investigator/reviewer only.
> - Everything below this block remains useful history. Any branch, worktree, model-routing, build-bridge, or open-task statement below that conflicts with this block is historical and superseded.

> ### Play privacy/account deletion follow-up (2026-07-15)
> - Active branch: `codex/play-policy-delete-account` from Release 5.0 `master`.
> - Settings → Account now includes the privacy policy and permanent authenticated account deletion.
> - Public pages: `/privacy/`, `/delete-account/`, `/request-received/`; stable URLs use `https://crew-chief-race-notes.netlify.app` after an explicitly authorized production publish.
> - Supabase migrations `20260715161026`, `20260715161241`, `20260715161505`, and `20260715161637` are applied live. `delete-account` Edge Function v1 is ACTIVE with JWT verification.
> - Deletion removes owned uploads before Auth deletion, resolves team ownership, anonymizes cached teammate identity, revokes sessions, then deletes Auth. Client racing data clears only after server success.
> - Play listing must use the public privacy URL and account-deletion URL. Confirm its developer entity is exactly **Nimbus Engineering** before submission.
> - Final draft: `https://6a57b47b1712493e1f563ff9--crew-chief-race-notes.netlify.app/`. Netlify Forms is enabled and detected `account-deletion-request`; 390px policy/deletion/app-shell checks had no overflow or console errors. Production unchanged.

> **Historical 2026-07-14 UX correction roadmap:** [`docs/archive/plan-v3-ux-corrections.md`](./docs/archive/plan-v3-ux-corrections.md) and [`docs/archive/CLAUDE_UX_REWORK_HANDOFF_2026-07-14.md`](./docs/archive/CLAUDE_UX_REWORK_HANDOFF_2026-07-14.md) preserve Release 5.0 planning history. Active work uses the current override above.

> ### ⚡ Release update 2026-07-14 (supersedes stale details below)
> - **Release 5.0 baseline:** Main tree `C:\Users\maxx\antigravity\Race-Notes` on `master` now owns released web and Android source. `preview-v3` was promoted and is retired. Future work uses a new branch/worktree from `master`.
> - **`master` is the release source of truth.** The `preview` (v1), `preview-v2`, and `preview-v3` development lines are retired after consolidation. Deploys still default to Netlify preview; production only on Maxx's explicit say-so.
> - **Migration 014 IS applied to live Supabase** (`20260711151905`, applied 2026-07-11). Ignore older "014 not applied" notes.
> - **Android release artifacts:** `release/CrewChief-5.0-release.apk` and `release/CrewChief-5.0-play.aab`, package `nimbus.engineering.crewchief`, versionCode 17/versionName 5.0. The AAB is the Google Play upload package. Artifact hashes are in `release/SHA256SUMS.txt`.
> - **Release validation draft:** `https://6a56d1d228995bd1cef8c421--crew-chief-race-notes.netlify.app` (UXF-9P `0361278`). Netlify production remains untouched; GitHub/Android release does not publish Netlify production.
> - **Repo hygiene pass done:** removed dead PWABuilder/TWA leftovers (root gradle files, `pwabuilder-adv-sw.js`, `metadata.json`, `build_apk.bat`, `PWA_INSTRUCTIONS.md`), retired v1 `plan.md`, untracked `.idea/` + root `local.properties`, and added `android/app/google-services.json` to `.gitignore`.

> ### 🎨 UX OVERHAUL track — historical release lineage
> The UX/UI overhaul was built in `.worktrees/v3` on `preview-v3`, then promoted to `master` for Release 5.0 by owner authorization on 2026-07-14. The worktree and local branch are retired after release.
> - **Historical source:** [`docs/archive/UX_ANALYSIS_2026-07-12.md`](./docs/archive/UX_ANALYSIS_2026-07-12.md) → [`docs/archive/IMPLEMENTATION_PLAN_2026-07-12.md`](./docs/archive/IMPLEMENTATION_PLAN_2026-07-12.md). Forward work uses `SPRINT_INDEX.md`.
> - **Workflow (owner directive):** GPT 5.6 SOL High owns analysis/planning/QA; GPT 5.6 Terra High gets one initial implementation pass; any QA failure transfers fixes to GPT 5.6 SOL High, which loops with SOL QA until PASS. Codex model overrides and rollout metadata are verified in persistent tasks. Generic prose self-identification is not model evidence. **`/caveman full`** stays on.
> - **Chunk status:** ✅ **1–9 complete**. C9 SOL QA attempt 2 PASS at `c8c4a21` + `254d928`; Chunks 6B–9 completion run closed.
> - **New reusable code (chunks 1-4):** `src/components/ui/` (`NumberStepper`, `UndoToast`+`InfoToast`, `EmptyState`, `CollapsibleSection`, `SegmentedGrid`, `BottomSheet`, `HelpSheet`, `LapTimeKeypad`); `src/lib/undo.ts`; `src/lib/backStack.ts`; `src/lib/saveStatus.ts`; `src/lib/sessionSequence.ts`; `src/lib/serviceLog.ts`; `src/lib/scope.ts` (`pickAutoWeekend`, `parseWeekendDate`, `sortWeekends`); `src/components/ContextStrip.tsx`; `src/components/GetRaceReadyCard.tsx`. CSS: `.tap-target`, `.sticky-action-bar`, `.status-chip` + light-theme contrast bump.
> - **Owner UX answers baked into the plan:** (1) app used during the week + at the track after each run; (2) 95% single-user → assignment/concurrency deferred; (3) most teams 1 car (some 2-3) → car UI hidden at ≤1 car; (4) **four-bar changed VERY often trackside → make it FAST, not hidden** (reverses the "fold behind expander" rec — chunk 5); (5) dusk→night racing → sunlight/light-theme tuned; (6) Main Checklist = hybrid core-reset + ad-hoc (chunk 6).
> - **Testing:** v3 APKs use the build-from-main bridge: run lint then build in v3; mirror v3 `dist` to main; run raw `npx cap sync android` (not main `npm run android:sync`, which rebuilds master); run `assembleDebug`. Current Chunk 4 APK is versionCode 14/versionName 3.9 at the standard debug output. Android emulator QA passed fresh-profile hero→weekend→new-session, quick-service cost→Accounting→Undo, and session ⋯ delete→Undo. Emulator native `screencap` showed white because WebView tile-memory/compositor warnings; direct WebView capture and DOM verified rendered UI.
> - **Chunk 4 draft:** https://6a5458d75d0c165c44d0ef9f--crew-chief-race-notes.netlify.app (auth gate renders; zero browser console errors). Production unchanged.
> - **⚠️ BUILD GOTCHA (cost us a blank screen):** a new git worktree does NOT get the gitignored `.env`/`.env.local`. Building the v3 web bundle without them bakes an EMPTY `VITE_SUPABASE_URL` → runtime `Error: supabaseUrl is required` → **blank screen**. Fix applied: copied `.env` + `.env.local` from the main tree into `.worktrees/v3`. Always ensure the worktree has both env files before `vite build`.
> - **⚠️ PWA-cache gotcha:** `adb install -r` can keep serving an OLD Workbox bundle. Full reset: `adb shell pm clear nimbus.engineering.crewchief`. To preserve login/localStorage, force-stop then delete only package WebView `Service Worker`, HTTP Cache, and code-cache directories with `run-as`, then cold-launch. `pm clear --cache-only` was insufficient. Debug: `adb logcat -d | findstr Capacitor/Console`.
> - **Chunk backlog (non-blocking):** dashboard needs 2 back-presses to exit; pending weekend delete remains visible in global ContextStrip during its 5s window; wire `reportSave('synced')` into `sync.ts`; prune dead `'quickref'` union; add BottomSheet focus trap; App.tsx Chunk 4 orchestration exceeded the plan's aspirational ~10-line wiring budget but kept domain state centralized. C5 resolved no-car Setups/Tires/Smasher teaching paths; UX-R1 guards pull generations/auth switches.

> ### 🏁 UX-C5 Trackside Setups — complete 2026-07-13
> - Feature commit `d5ef1f4`; final cavecrew `CODE_PASS`; SOL High final adjudication passed after the required SOL→Terra→SOL failure-routing loop.
> - `src/lib/setupSteps.ts` is the canonical numeric/units/pressure adapter layer. Blank setup-pressure imports preserve existing manual/logged tire and pressure-block bytes; real imported pressure replaces both.
> - `src/lib/setupCompat.ts` owns same-car newest/prior selection, deep clone, and blank factory. Never fall back across cars; cross-car clone clears tire inventory IDs.
> - `App.tsx` owns one full-master-array setup writer. It persists saved setups, optionally activates/persists one setup, then cloud-pushes the full array. Quick-log and Setups share it.
> - `FourBarQuickAdjust.tsx` is controlled and shared by Setups and quick-log. Quick-log changes also serialize into the active session/weekend record and coalesce by `fourbar-{corner}-{field}`.
> - `TiresSubView.tsx` remains active-car scoped and uses linked inventory size consistently for display and stagger. Existing CRUD, CSV/report, lifecycle, and usage-history paths remain.
> - Runtime evidence: Android 4.1 (16), 320 CSS px / XX-Large, current Workbox assets after targeted cache purge; baseline creation, Setups, four-bar, Tires modal geometry, repeated quick-log adjustment, Save Run, cold relaunch, and logcat passed. Netlify draft shell/auth gate and final asset hash returned HTTP 200; unique draft origin had no remembered login.
> - C6A is closed. SOL High (`gpt-5.6-sol`, high reasoning metadata) independently re-ran harnesses, exact lint baseline, build, draft shell, and live Supabase schema/history; PASS. C6B is next. Do not redo C5/C6A unless a new regression is demonstrated.
> - **C6A draft:** https://6a558ea45dc5716d3bed026a--crew-chief-race-notes.netlify.app. Production unchanged.

> ### 🧬 UX-C6B Setup Lifecycle — SOL QA attempt 3 PASS 2026-07-13
> - Feature commit `2a941d3`; repair `874fecc`; repair 2 `7b58b30`; SOL plan `21c6aca`. C6B closed; C7 unlocked.
> - Starting a weekend creates dedicated immutable Baseline and editable Weekend Setup. Every normal setup edit is enforced at the App boundary and appended to Weekend Setup history. Runs resolve the weekend's `activeSetupId`, never a generic current-car setup.
> - Finish Weekend is page-bottom and works with zero runs. It locks Weekend Setup, creates immutable Final, marks event finished, clears active event/run, then selects an editable Current copy. Finished events remain history and cannot auto-activate.
> - `src/lib/setupLifecycle.ts` owns pure start/finish/lock/diff/timestamp-merge behavior. `sync.ts` explicitly maps lifecycle fields and previously omitted toe/J-bar scalars. Active runs now carry `updatedAt` so stale cloud state cannot revive a finished event.
> - Live migration `20260714020037_setup_weekend_lifecycle.sql` applied/verified on project `swblfeayxoprodhwxqak`; repair adds no SQL. Draft: https://6a55a024d663b44ca4f639c7--crew-chief-race-notes.netlify.app.
> - Repair makes new-weekend selection same-car while preserving event-owned setup routing; upgrades legacy zero-run weekends from valid linked/safe fallback sources; rejects dangling explicit links; and makes partial Finish retry-safe with deterministic dedupe plus preserved locks/history.
> - Evidence: expanded lifecycle/source harness PASS; exact three-error lint baseline; 540-module build PASS; cavecrew re-review clean; 390 px draft shell and console PASS. Unique draft origin lacked remembered auth, so SOL must independently adjudicate full authenticated sync evidence.
> - Repair 2 closes QA-attempt-2 blockers: RaceWeekend gets owned event Setup or null with guarded run/quick-adjust UI; no-link legacy Finish uses exact blank setup values; unlocked Weekend bytes rebuild stale deterministic Final/Current rows; and finished-weekend relationship locks Weekend snapshots even without `lockedAt`. Clone stays allowed.
> - SOL QA attempt 3 evidence: two cavecrew reviews clean; expanded harness PASS; exact three-error lint baseline; 540-module/16-entry build; diff check and clean tree PASS; 390×844 draft shell with zero console errors. Live migration present; 23/23 checked mapped columns, RLS, authenticated CRUD, and zero relevant security-advisor findings verified. Both lifecycle tables are empty, so no authenticated data round trip exists. Draft: https://6a55a43a8cc5f6b9da612c69--crew-chief-race-notes.netlify.app.

> ### 🔧 UX-C7 Quick Adjust — Terra CODE_PASS 2026-07-13
> - Feature commit `58e4522`; awaiting independent SOL QA. C8 stays locked until verdict.
> - `src/lib/quickAdjust.ts` owns event/run target resolution, numeric normalization,
>   Load Session filtering, marker rules, and atomic one-to-one Setup/run history.
> - `QuickAdjustPanel.tsx` adds LF/RF/LR/RR Spring Rate ±25, Spring Rounds ±0.5,
>   shock note plus real same-car/corner Load Session, J-Bar ±0.25, manual gear,
>   Other Change, and Four-bar entry. Garage selection never supplies event data.
> - Optional C7 fields round-trip through existing setup-corner/change-log/session JSON.
>   `setupSync.ts` makes unchanged row mapping pure-testable; no SQL migration.
> - Focused harness and diff check PASS; lint exact three-error baseline; cavecrew final
>   review clean. Build/cloud/mobile/Netlify gate deliberately consolidated after C8.
> - SOL QA attempt 1 FAIL: off-grid values receive wrong snapped deltas (`510 +25`
>   becomes `525`; `9.10 +.25` becomes `9.25`), raw finished-weekend selection can
>   pass generic selected-car Setup into RaceWeekend UI, and stale/deleted run can
>   still render Quick Adjust. App mutation guard blocks writes, but availability and
>   ownership contract still fails. Terra repair required; C8 remains locked.
> - Terra repair `030122c` preserves off-grid values while adding exact relative deltas,
>   blocks generic Setup for every raw invalid/finished weekend selection, and requires
>   unfinished weekend plus current run-record membership before editor/Quick Adjust
>   renders. Expanded harness, exact lint baseline, diff check, cavecrew review pass.
>   No SQL or full coherent gate yet; awaiting SOL QA attempt 2.
> - SOL QA attempt 2 PASS: expanded harness, repair-range diff check, exact lint
>   baseline, independent code inspection, and cavecrew review all pass. C7 closed;
>   C8 unlocked. Combined build/cloud/mobile/Netlify gate remains due after C8.

> ### 🧰 UX-C8 Trackers/Maintenance — SOL QA PASS 2026-07-13
> - Feature `2f60420`; independent SOL QA passed. C8 closed; C9 unlocked.
> - Visible Service copy is now Maintenance Logs across Trackers, Dashboard, Guide,
>   and user guide. Internal `service` values, storage keys, and DB tables stay stable.
> - `src/lib/checklistMaintenance.ts` owns optional `core|adhoc` compatibility,
>   remembered reset behavior, template-source re-materialization/tombstones, and
>   idempotent 90% automatic maintenance jobs. Completed history is retained while a
>   still-due current-cycle job reopens. Todo JSON sync needs no migration.
> - Main Checklist whole rows toggle at 56px minimum. Edit-after-create handles text,
>   notes, and assignee without losing manual/template/maintenance provenance. Templates
>   now live under Checklist → Edit List; existing CRUD/starter convergence remains.
> - Accounting defaults date to today/category to last-entered and offers five distinct
>   description/category repeat chips that never touch amount/date.
> - Evidence: focused C8 and accumulated C6–C8 harnesses PASS; exact three-error lint
>   baseline; 545-module/16-entry build; diff check and cavecrew re-review clean.
>   Android debug current bundle shows dark mobile Maintenance naming and automatic
>   checklist injection with no crash. Draft `6a55b29bbc2a11f748b406a3` boots at 320px
>   with zero console errors; unique origin has no remembered auth. No SQL/production.
> - SOL independently re-ran C6A–C8 harnesses, exact lint baseline, 545-module build,
>   and diff check. Cavecrew found no issues. Template tombstone/repopulation, completed
>   maintenance history/current reopen, stale assignment, 90% boundary/idempotence,
>   and accounting repeat semantics pass. Todo additions stay in existing JSONB; no
>   migration. Authenticated task rows were unavailable and are not claimed.

> ### 📄 UX-C9 Export/Help/Final Sweep — TERRA CODE_PASS 2026-07-13
> - Feature `c8c4a21`; independent SOL final QA remains open.
> - `src/lib/exportPdf.ts` owns pure report/PDF generation. Setup and weekend Share
>   create actual PDF files through native Capacitor file share, Web Share, or desktop
>   download. Cancel is quiet; failures never report success.
> - Setup, four-bar, Load Sessions, and setup-difference help buttons route to direct,
>   plain racer-language sections. Visible copy no longer claims AFCO/chassis/package
>   specificity or uses unexplained academic terms; identifiers/storage/DB stayed.
> - C5–C9 plus UX-R1 harnesses PASS; lint exact three-error baseline; build 554 modules /
>   18 PWA entries; diff and cavecrew final review PASS. No migration or new package.
> - Android debug chooser received a named PDF; cancellation, help/back, dark Default,
>   light Large, cold offline saved data, and crash buffer passed. Final draft auth shell
>   passes 320/390 with zero overflow/console errors. Unique origin was signed out, so
>   authenticated draft data is not claimed.
> - SOL QA attempt 1 found one blocker: hard-coded Shock/J-Bar/Four-bar rows in
>   `QuickReferenceView.tsx` still visibly say “trailing arm geometry,” “rear roll
>   center,” “chassis roll,” “through apex,” and “weight transfer.” These rows bypass
>   `plainRacerEffect`; replace direct rendered copy with plain dirt-shop language and
>   add source fixtures. PDF/share/help plus full C5–C9 gates otherwise pass.
> - Terra repair `254d928` closes that blocker. Direct tables now use accurate plain
>   racer language. Harness decodes and translates every real effect before audit, then
>   checks direct component copy separately and guards broken replacement grammar.
>   Focused harness, exact lint baseline, 554-module/18-entry build, diff check, and
>   cavecrew re-review pass. No new draft/Android build needed for copy-only repair.
> - SOL QA attempt 2 independently passed all C5–C9 plus UX-R1 harnesses, exact lint
>   baseline, 554-module/18-entry build, repair-range diff, and cavecrew review. All 134
>   real guide effects are translated/audited plus direct copy and grammar guards.
>   Original final draft/Android runtime gate remains accepted for display-copy-only
>   repair. C9 and Chunks 6B–9 are closed; production and release surfaces untouched.

> ### 🧭 Owner revision — 2026-07-13
> - Finish Weekend is always available at page bottom. No race/session gate; test days may be finished normally.
> - Setup ownership: immutable Baseline snapshot, editable Weekend Setup during event, immutable Final snapshot at finish, then editable Current Setup copied from Final. Historical snapshots never become normal edit targets.
> - Four-bar UI lives at setup bottom and shows LR then RR. Each side has Top Bar and Bottom Bar rows: Frame Hole → Bar Length → Birdcage Hole; Angle at Ride Height → Angle at Full Droop.
> - Tuning priority help must use plain racer language, not academic wording: High = try first; Medium = try next if first change did not fix it; Low = fine-tuning after bigger items are checked.
> - Style offers two sizes only: **Default** uses existing 1.15 scale; **Large** uses existing 1.45 scale. Do not show numeric scale values. Normalize legacy Standard to Default and legacy XX-Large to Large without deleting theme data.

CREW CHIEF (brand: all caps) is a React + TypeScript PWA + Android app that helps
dirt-track racing teams track car setups, race sessions, tire inventory, weather,
pit-crew tasks, maintenance/ERP, pre-race checklists, and (in progress) push
notifications, live team location, and truck routing. Owner/decision-maker: **Maxx**.

Production URL (current deploy history not audited here): https://crew-chief-race-notes.netlify.app
WS-Z draft recorded at deployment time: https://6a525a23a0b54ce49ff7498c--crew-chief-race-notes.netlify.app
Repo (Windows host): `C:\Users\maxx\antigravity\Race-Notes`

---

## 0. Start-here reading order

1. **`AGENTS.md`** — repository-wide workflow, safety, architecture, and deploy authority.
2. **`ralph/CURRENT_TASK.md`** — exact active Final Closeout gate state and bans.
3. **`docs/UX_TECHNICAL_REVIEW_2026-07-17.md`** — active plan, Part 5/6, and binding v2.1 addenda.
4. **`ralph/STATE.md`** — durable task scores, commits, failures, and current gate.
5. **`docs/UX_OVERHAUL_V2_AGENT_KNOWLEDGE.md`** — complete tools, strategy, build, QA, deletion-test, runtime, and final-state runbook.
6. **This file (`HANDOFF.md`)** — broad project history and cross-release gotchas.
7. **`CODEBASE_KNOWLEDGE.md`** — deep domain, storage, component, sync, and feature history.
8. **`SPRINT_INDEX.md`** — roadmap index; Sprint 2–4 remain deferred while v2 Final QA is open.

> **Doc-currency note:** historical sections below retain old `preview-v2`/`preview-v3`,
> Terra, build-bridge, Shopping, and release notes for archaeology. They do not
> override the current block, `CURRENT_TASK.md`, or the v2 agent runbook.

---

## 1. Repository layout, branches & worktrees (READ — easy to trip on)

Git worktrees in play:

| Path | Branch | Role |
|---|---|---|
| `C:\Users\maxx\.codex\worktrees\203f\Race-Notes` | `codex/ux-overhaul` | **Active UX Overhaul v2 worktree.** Dependencies and Android project are present; build, test, draft deploy, debug APK, docs, and future repair happen here. |
| `C:\Users\maxx\.codex\worktrees\3d72\Race-Notes` | independent checkout | Primary session/independent QA context. Do not treat it as active branch state or write sprint changes there. |
| `C:\Users\maxx\antigravity\Race-Notes` | `master` | **Release 5.0 baseline.** Preserve existing dirty/generated/native files. No current sprint edit, merge, or push. |

**Critical gotchas about the split:**

- Pin every command to 203f and re-check branch/HEAD/clean status. Desktop thread
  cwd may point at 3d72 even when active work belongs in 203f.
- The old v3 build-from-main bridge is retired for this sprint. Build web and
  debug Android directly in 203f; never copy `dist` into `master`.
- Git refs do not indicate Netlify deployment state. Draft deploys are manual.
- Never merge to `master` or deploy production without a new explicit Maxx authorization.

Package/app identity: **`nimbus.engineering.crewchief`** (renamed from `com.racenotes.app` this session — see §5). App name "Crew Chief". Native OAuth deep link kept for BOTH schemes during transition.

---

## 2. Tech stack

- React 19 + TypeScript, Vite 6, TailwindCSS v4 (`@theme` in CSS — **no** `tailwind.config.js`).
- Capacitor **8** (Android). JDK **21** required for Android builds (`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`).
- Supabase (Postgres + Auth + RLS + Edge Functions + Realtime).
- Netlify hosting (manual CLI deploy; NOT git-connected).
- **Local-first:** `localStorage` is the primary write target; Supabase is the secondary/optional sync layer (only when signed in). Live features (push, location) are the exception — they are server/Realtime data, NOT in the local-first loop.

### Architecture one-pager
- **No React Router.** Navigation = single `activeTab` string in `src/App.tsx`. Visible tabs: Dashboard, Setups, Sessions (`raceweekend`), Trackers, Settings. QuickRef lives in HelpSheet; stale internal `'quickref'` union member is backlog. Trackers = Checklist/Service/Templates/Accounting.
- **All domain state lives in `App.tsx`** and is passed down as props; views are prop-driven.
- **Dual-write pattern:** every mutation updates React state AND `localStorage`, then `if (user) push*()` to Supabase. Every delete path must also call `delete*FromCloud(id)`.
- **Car scoping:** setups, tires, shock sessions are scoped to the active car via `byActiveCar()` (`src/lib/scope.ts`); weekends, todos, accounting, shopping, checklists are global; maintenance components are `scope: 'car' | 'rig'` (rig = team-wide).
- Active car and active weekend are device-local (`race_notes_active_car`,
  `race_notes_active_weekend`; never synced).
- New TS interfaces → **only** in `src/types.ts`. Sync push/pull/delete helpers → **only** in `src/lib/sync.ts`.
- Styling: theme tokens only (`bg-surface`, `bg-surface-container`, `text-on-surface`, `text-on-surface-variant`, `text-primary`, `border-outline-variant`, `font-mono`, `font-display`). No hardcoded hex. Labels are `font-mono uppercase`.
- Lint = `tsc --noEmit` with a known **3-error baseline** (RaceWeekendView.tsx:467, SetupView.tsx:889, SmasherLoadsView.tsx:617 at product base `ab2d031`). Never add errors on top. Vite build does NOT type-check; re-read current lines after future edits.

---

## 3. Development approach — the "Ralph loop"

Development uses autonomous multi-agent loop. `ralph/STATE.md` (loop state,
verdicts, gates, backlog) and `ralph/CURRENT_TASK.md` (active work order) remain
durable authority so any session can resume cold. Cavecrew messages/tool results
may carry transient coordination; durable decisions must land in those files.

```
┌─► 1. PLAN   ws-planner   — picks next unblocked WS, writes CURRENT_TASK.md
│   2. BUILD  ws-builder   — implements EXACTLY the work order; lint+build before finishing;
│                            commits "UXF-x attempt N: ..." to preview-v3
│   3. TEST/QA ws-qa       — grades diff vs rubric, writes verdict+fixes to STATE/CURRENT_TASK
│        ├ PASS (all gates + score ≥ 90) → mark complete, attempts=0 ─────────┐
│        └ FAIL on any attempt → SOL FIX takeover                              │
│   4. FIX    ws-fixer     — owns every post-failure fix, re-runs lint/build  │
└──────────────────────────── next WS ◄──────────────────────────────────────┘
```

### Agents & model routing (v2.1 owner directive 2026-07-18)

The binding v2.1 owner addendum supersedes the historical role table:

| Role | Runtime | Responsibility |
|---|---|---|
| Implementation worker | `gpt-5.6-sol`, effort `high` | Exact current-task edit, focused/full gates, scoped commit |
| Primary QA/plan authority | `gpt-5.6-sol`, effort `xhigh`/Extra High | Work order, independent QA, Ralph/plan/owner docs, final verdict |
| Cavecrew investigator | runtime verified when used | Bounded tracing/evidence only |
| Cavecrew reviewer | runtime verified when used | Findings-first diff/branch review |

Terra at every tier and `cavecrew-builder` are forbidden for active v2 work.
After three consecutive failures of the same task, primary Extra High may implement
directly under the identical restrictions. Dispatch model changes with an explicit
override. `handoff_thread` moves checkout/worktree/host state; it does not choose a
model. Verify rollout `turn_context.payload.model` and effort. Missing metadata means
**unverified**. `scripts/verify-agent-handoff.ps1` has a known one-model scalar bug
that may display only `g`; do not patch it during sprint work.

### QA rubric (every gate is hard — any miss = FAIL)
1. `npm run lint` clean beyond the 3-error baseline.
2. `npm run build` succeeds (Windows).
3. Scope: diff touches only the workstream's Primary/Shared files in the active sprint plan from `SPRINT_INDEX.md`.
4. Architecture rules: local-first dual-write; no router; correct car/rig/global scoping; types only in `types.ts`; sync only in `sync.ts`; `delete*FromCloud` on every delete path; theme tokens (no hardcoded hex).
5. All acceptance criteria in `CURRENT_TASK.md` demonstrably met.
Then score the remainder 0–100 (code quality, edge cases, offline behavior, regression risk). PASS = all gates + ≥ 90.

### How this maps when a single coordinating agent runs the loop
Primary Extra High plans and QAs; separate SOL High task builds. Primary persists
`STATE.md`/`CURRENT_TASK.md`, plan snapshots, and owner report. Product and governance
commits stay separately identifiable where practical.

### Mandatory agent skills
- Read `.agents/skills/caveman/SKILL.md`.
  Use `/caveman full` for every development/status/user message. Code, commits,
  security warnings, and irreversible confirmations remain normal.
- Read `.agents/skills/cavecrew/SKILL.md`.
  Use investigator for tracing and reviewer for diffs. Active v2 forbids
  `cavecrew-builder`; implementation uses the explicit SOL High worker.
- These rules persist across future sessions until Maxx explicitly changes them.

---

## 4. Historical roadmap & status (archived `docs/archive/plan-v2.md` + `STATE.md`)

**v1 (plan.md, WS-A…WS-M):** COMPLETE — data model, tire lifecycle, setup diff, task↔weekend, weather history, carry-over setups, exports, UI/theme/reference passes.

**v2 (archived `docs/archive/plan-v2.md`, WS-N…WS-Z):**

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

**WS-Z migration status:** migration 014 was applied 2026-07-11 and verified
live 2026-07-14 with the load-session and setup-lifecycle migrations. Remaining
authenticated/offline/theme/zoom/mobile runtime checks are absorbed by UXF-9.

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

### Web (active 203f worktree)

```powershell
Set-Location C:\Users\maxx\.codex\worktrees\203f\Race-Notes
npm.cmd run lint
npm.cmd run build
netlify.cmd deploy --dir=dist
```

Expected current gate: exact three known lint errors, 566 transformed modules,
and a Netlify **draft** URL. Never use `--prod` without a new explicit owner order.

### Android debug APK (direct active-worktree build)

```powershell
Set-Location C:\Users\maxx\.codex\worktrees\203f\Race-Notes
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME='C:\Users\maxx\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
npx.cmd cap sync android
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
```

Output: `android\app\build\outputs\apk\debug\app-debug.apk`.
Install with adb `install -r` so test data remains. Verify WebView asset names after
install because Workbox may preserve an old bundle. Remove only the package's
service-worker/HTTP/code cache when needed; never clear whole app data without
explicit destructive-test authorization.

### Release APK / production
`android/app/build.gradle` is tracked and stores package/version plus environment/property-based signing wiring. Credentials stay in ignored `android/keystore.properties` or environment variables. Re-check version values before release; never copy signing credentials into tracked files.
Active v2 forbids release/signed builds, AABs, `release/` changes, native/version
changes, distribution, and production Netlify publishing.

### Environment quirks that WILL bite you
- PowerShell may block `npm.ps1`/`npx.ps1`/`netlify.ps1`; call `.cmd` shims explicitly.
- Desktop-thread cwd may be 3d72. Always set and verify the 203f worktree before commands.
- **cmd `set VAR=value && cmd`** captures a trailing space into VAR → wrap as `set "VAR=value"&&…` (this once produced bogus HTTP 401s in an API smoke test).
- Deno edge functions live under `supabase/functions/` and must be **excluded from the app `tsconfig`** (already done) or `tsc` errors on `Deno`/esm.sh imports.
- Final closeout forbids Supabase schema/RLS/migration/Edge Function changes.
- Android 17/API 37 dev emulator WebView 150 has a reproducible system-library
  `onTrimMemory` SIGILL. Same APK passes 3/3 lifecycle cycles on stable Android 15;
  use stable API 36/physical device for final release confidence when available.

---

## 8. Open items / backlog (from `STATE.md`)

No product blocker remains in UX Overhaul v2. Repair 3 closed the active-Race-Day
setup deletion and stale-cloud timestamp gaps; `ab2d031` closed the delayed Undo
selection race. The final 24/24/lint3/build566/browser/debug-APK/lifecycle/product-
review gates pass. Final authority-document synchronization and the saving-point
push are the only closeout actions around the product base recorded above.

Deferred nonblocking backlog remains in `ralph/STATE.md` and the v2 runbook,
including API 37 WebView runtime behavior, two-back Dashboard exit, dead `quickref`,
BottomSheet focus trap, location scaffold, and Sprint 4 IA.

---

## 9. Owner constraints & etiquette

### Current handoff — Release 5.0 (2026-07-14)

- UXF-9P feature `0361278` is complete: zero-car actions route directly to Settings → Garage,
  race-day/run creation is guarded before forms and mutation, global Tuning Guide starts at the
  Adjustment Finder, and visible event wording is Race Day/Race Days.
- Internal `RaceWeekend` types, IDs, storage keys, sync/database names, and lifecycle role remain
  unchanged. Legacy generated labels map only at display time; arbitrary user labels are preserved.
- Final draft: `https://6a56d1d228995bd1cef8c421--crew-chief-race-notes.netlify.app/`.
- `docs/CLAUDE_FABLE_FINAL_QA_PLAN.md` remains a useful unexecuted authenticated regression plan; do not claim it ran.
- Ten harnesses, exact three-error lint baseline, 559-module/18-entry build, diff check, and
  cavecrew review pass. Signed-out draft is clean at 320/390; authenticated feature QA remains.
- Maxx authorized release directly. Sprint 1 is closed; Sprint 2 waits for a new owner-started branch.

- **Never deploy Netlify production or merge a future release branch without Maxx's explicit approval.** Default web deploys to Netlify preview.
- Migrations/secrets/console setup are treated as human gates — surface them; apply DB migrations only with owner awareness.
- Keep commits scoped and use the loop's message convention (`WS-x attempt N: …`, `ws-qa: WS-x PASS …`).
- Prefer new files (`src/lib/*`, `src/components/*`) wired with minimal `App.tsx` diffs; `App.tsx` and `types.ts` are hot shared files.
