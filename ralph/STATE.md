# Ralph Loop — State

> Machine-readable loop state. Only **ws-planner** (status → in_progress) and
> **ws-qa** (verdicts, completion) edit this file. Humans edit the Human Gates
> section. See plan-v2.md §1 for the loop protocol.

## How to run the loop (VS Code + Copilot)

1. Open `.worktrees/v3` as the workspace (branch `preview-v3`) for current UX work.
2. Read repo-local `caveman` + `cavecrew` skills. Use `/caveman full` always;
   route bounded delegated work through cavecrew.
3. `@ws-planner` using GPT 5.6 SOL High writes `ralph/CURRENT_TASK.md`.
4. `@ws-builder` using GPT 5.6 Terra High implements and commits.
5. `@ws-qa` using GPT 5.6 SOL High grades independently. FAIL 1–2 returns to
   Terra. FAIL 3 transfers implementation to `@ws-fixer` using GPT 5.6 SOL High,
   then returns to SOL QA.

If exact models are unavailable, disclose limitation. Never claim unavailable
model ran. `STATE.md` and `CURRENT_TASK.md` remain durable loop state; cavecrew
messages/tool results may carry transient coordination.

## Workstream status

| WS | Title | Status | Attempts | Score | Commit | Notes |
|----|-------|--------|----------|-------|--------|-------|
| WS-N | Data model & migrations foundation | complete | 1 | 96 | e0ecbbf | Types + migrations 011-013 + sync.ts mappers (push/pull/delete) + data.ts defaults for maintenance/checklists/trips. Migrations still need owner approval before apply (human gate 4). |
| WS-O | Maintenance engine | complete | 1 | 95 | 17ad130 | Car-scoping fix: getComponentStatus now takes savedSetups, resolves weekend.setupId->Setup.carId, excludes unresolvable weekends for scope:'car'. scope:'rig' unaffected (counts all). lint 3-baseline only, build clean. |
| WS-P | Maintenance UI (Trackers "Service", todo-template style) | complete | 1 | 93 | 47da05b | Service sub-tab in Trackers: Car/Rig grouped rows, status chips (ok/due/overdue), usage bars, Log modal (date/type/notes/cost→accounting), Add Component form, Add Defaults seed. Dashboard Service Due collapsible panel (only due/overdue items). App.tsx state+handlers+cloud-pull wired. lint 3-baseline only, build clean. |
| WS-Q | Checklist engine | complete | 1 | 94 | f482938 | Added materializeStarterTemplate() to bridge STARTER_TEMPLATES (plain strings) into real, ID-bearing, user-owned ChecklistTemplate objects. instantiateTemplate/checklistProgress/STARTER_TEMPLATES untouched. lint 3-baseline only, build clean.
| WS-R | Checklist UI | complete | 1 | 92 | f220947 | ChecklistsSection in RaceWeekendView weekend banner (attach templates, check-off with doneAt/doneBy, delete). ChecklistsTab template manager in Trackers (CRUD items, starter templates, expand-to-edit). App.tsx state+pull+delete-weekend-null wired. lint 3-baseline only, build clean. |
| WS-S | Push infrastructure | complete | 1 | 93 | 93d870d | registerForPush (native+web VAPID, graceful no-op, onConflict-token upsert), unregisterPush pre-signOut token delete, firebase-messaging-sw.js scoped + excluded from Workbox precache, send-push edge fn deployed LIVE (verify_jwt; 401/405/no-user-401 smoke-passed; 400/403/200+prune inspection-only, deferred to WS-Y). OWNER ACTION: add `nimbus.engineering.crewchief://auth-callback` to Supabase Auth → URL Configuration → Redirect URLs or native Google sign-in breaks. |
| WS-T | Location sharing (foreground) | pending | 0 | — | — | |
| WS-U | Ping / come-here notifications | pending | 0 | — | — | Needs WS-S |
| WS-V | HERE truck-routing lib | complete | 1 | 93 | 3694aed | flexpolyline decoder + here.ts (geocode/truckRoute/POI discover/planTrip, full HereError taxonomy); live-API verified, lint/build green |
| WS-W | Trip planner UI | pending | 0 | — | — | Needs WS-V |
| WS-X | Teammates on route | pending | 0 | — | — | Needs WS-T + WS-W |
| WS-Y | QA hardening & release | pending | 0 | — | — | Last; gates the batch |
| WS-Z | July 11 product simplification | in_progress | 1 | — | — | Code complete; reviewer/build/draft-deploy pass. Await migration 014 + authenticated/offline/theme/zoom/mobile visual QA. |

Status values: `pending` · `in_progress` · `complete` · `scaffolded` (partial pre-work exists)

## Human gates (Maxx) — required before the flagged WS can start

- [x] 1. Firebase project + `google-services.json` in `android/app/` (→ WS-S) — done 2026-07-10; pkg nimbus.engineering.crewchief, gitignored
- [x] 2. `FCM_SERVICE_ACCOUNT_JSON` secret set in Supabase + web VAPID key in `.env.local` (→ WS-S) — done 2026-07-10
- [x] 3. HERE account + `VITE_HERE_API_KEY` in `.env.local` (→ WS-V) — done 2026-07-10
- [x] 4. Apply migrations 011–013 to live Supabase (→ before WS-O/Q/S/T cloud sync testing) — applied 2026-07-10

**All human gates cleared 2026-07-10 → WS-S and WS-V are now unblocked.**

## Grade log

_(ws-qa appends one line per verdict: date · WS · attempt · PASS/FAIL · score · summary)_
- 2026-07 · WS-N · attempt 1 · PASS · 96 · sync.ts mappers (maintenance_components, maintenance_logs, checklist_templates, weekend_checklists, saved_trips) + data.ts INITIAL_* defaults. lint 3-baseline only, build clean. Diff scoped to sync.ts + data.ts only.
- 2026-07 · WS-O · attempt 1 · PASS · 95 · Fixed car-scoping gap in getComponentStatus (added savedSetups param, resolves weekend->car via setupId indirection, rig scope unaffected). Diff scoped to maintenance.ts only. lint 3-baseline only, build clean. No callers yet (App.tsx wiring deferred to WS-P, by design).
- 2026-07 · WS-Q · attempt 1 · PASS · 94 · Added materializeStarterTemplate() — starter templates were plain string[] items but instantiateTemplate() needs full ChecklistTemplateItem[] w/ ids; new fn bridges the gap. Diff scoped to checklists.ts only. lint 3-baseline only, build clean. No callers yet (App.tsx/UI wiring deferred to WS-R, by design).
- 2026-07 · WS-P · attempt 1 · PASS · 93 · Full maintenance UI: Service sub-tab (Car/Rig sections, usage bars, status chips, Log modal, Add form, Add Defaults), Dashboard Service Due panel. App.tsx state+pull wiring. Accounting auto-entry on cost log. lint 3-baseline only, build clean.
- 2026-07 · WS-R · attempt 1 · PASS · 92 · Weekend checklists in RaceWeekendView (attach from template, check-off w/doneAt stamp, delete, blank option). ChecklistsTab template manager in Trackers (CRUD, starter seeds, item add/delete). App.tsx state+cloud-pull+delete-weekend nulling. lint 3-baseline only, build clean.
- 2026-07 · WS-V · attempt 1 · PASS · 93 · All gates + live HERE API verification (decode test vector, geocode, 5.5mi truck route, 10 sorted truck stops, full error taxonomy) passed; Discover text-search POI trade-off accepted; package.json WS-S deps to re-attribute. Commit 3694aed.
- 2026-07 · WS-S · attempt 1 · PASS · 93 · All hard gates met; push register/unregister + dual-SW build verified live; send-push deployed (verify_jwt) with 401/405/no-user-401 live smoke; 400/403/200/prune + device rendering inspection-verified, deferred to WS-Y. Commit 93d870d.
- 2026-07-11 · WS-Z · attempt 1 · PROVISIONAL PASS · — · Cavecrew diff review and deterministic data checks pass; lint has baseline 3 errors only; build and Netlify draft HTTP smoke pass. Final score/status held for migration 014 plus authenticated/offline/theme/zoom/mobile visual QA.

## Backlog

_(follow-up items discovered during QA — do not expand an in-flight WS)_
- WS-V: re-attribute `firebase` + `@capacitor/push-notifications` package.json additions to WS-S. [RESOLVED 2026-07-10 — committed under WS-S 93d870d.]
- WS-Y: live-verify send-push authenticated paths (400 malformed, 403 non-teammate, 200 success + notifications insert, dead-token prune) with a real user JWT, plus actual push RENDERING on Android APK + web PWA. Inspection-only so far.
- WS-S: `com.racenotes.app` deep-link scheme still kept alongside the nimbus scheme (back-compat) — confirm intentional or remove in a later pass.
- WS-V: consider HERE category-ID filtering as a fallback to Discover text search for non-English locales / noisy results.
- WS-S: PAUSED — commit the package-name rename to `nimbus.engineering.crewchief` on preview-v2 before any native/FCM work (owner-decided 2026-07-10; Firebase + google-services.json already nimbus).
- WS-Z: apply migration 014, then verify team-member template/service deletion plus offline reload and theme/zoom/mobile presentation on draft deploy.


## UX Overhaul (branch `preview-v3`, started 2026-07-12)

Separate track from WS-N…Z. Source: `docs/UX_ANALYSIS_2026-07-12.md` (historical Fable audit, 37 recs) → `docs/IMPLEMENTATION_PLAN_2026-07-12.md` (7 chunks). Current owner routing: GPT 5.6 SOL High plans/QAs, GPT 5.6 Terra High builds; runtime metadata is authoritative and unobservable identity is `unverified`. `/caveman full`. Consolidated QA per chunk + `tsc` (3-baseline) / `vite build` gates. Runtime QA accumulates on v3 APK and Netlify drafts.

| Chunk | Scope | Status | Commit |
|---|---|---|---|
| 1 | Shared UI primitives (`components/ui/*`, `lib/undo.ts`) + glove/glare/zoom hardening CSS | ✅ complete (Fable QA PASS-w-notes) | e04b15c |
| 2 | App shell: 6→5 tabs (QuickRef→HelpSheet), race-day order, ContextStrip (car+weekend, car hidden ≤1), sunlight toggle, auto-create-first-car, auto-activate-weekend, scroll preservation + Android back (`backStack.ts`), offline badge (`saveStatus.ts`) | ✅ complete (PASS, no blockers) | 306445d |
| 3 | Sessions owns weekends (modals moved out of App.tsx, −451 lines), quick-log top-to-bottom + SAVE RUN, `LapTimeKeypad`, 3×3 diagnostics `SegmentedGrid`, `sessionSequence.ts` auto-name/prefill | ✅ complete (PASS, no blockers; pure fns harness-PASS) | c68f27d |
| 4 | Dashboard: launchpad + "+LOG RUN" hero + first-run card + sorting + ⋯/Undo + scoped quick-service/Accounting | ✅ complete | 21405e9 |
| R1 | **URGENT pre-Chunk-5 regression repair:** Dashboard-first team banner, WCAG light accent/type floor, named AFCO-scoped Tuning Guide, deterministic exact starter-template convergence | ✅ complete — CODE_PASS + RUNTIME_PASS; Android 4.0 (15); SOL→Terra→SOL metadata verified | b6d702e |
| 5 | Setups: corner cards + steppers, **four-bar quick-adjust (fast, not hidden)**, tires sub-view, copy-last-setup, diff entry, propagation toast | ✅ complete — CODE_PASS + RUNTIME_PASS | d5ef1f4 |
| 6A | Setup/measurement refinement: blank defaults, complete LR/RR top+bottom four-bar rows, tire summary, Load Session naming/ride height, two font choices, plain priority help | ✅ complete — SOL QA PASS; CODE_PASS + local RUNTIME_PASS + Netlify draft + live migration verified | ae9395b |
| 6B | Setup history lifecycle: immutable baseline, editable Weekend Setup, always-available Finish Weekend, immutable final snapshot, editable Current Setup copy | ✅ complete — SOL QA attempt 3 PASS | 2a941d3 + 874fecc + 7b58b30 |
| 7 | Quick Adjust expansion: spring rate/rounds, ride-height review flag, shock note/load graph, J-bar, gear, active-setup change log | ✅ complete — SOL QA attempt 2 PASS | 58e4522 + 030122c |
| 8 | Trackers: hybrid Main Checklist, merged Templates, Maintenance Logs, 90%-interval task injection, after-create assignment, accounting defaults | ⬜ pending | — |
| 9 | Export share, contextual help, racing-language copy audit, final two-size/font/glove regression | ⬜ pending | — |

### UX chunk grade log
- 2026-07-12 · UX-C1 · Fable QA · PASS-WITH-NOTES · primitives safe (undo state-machine no early-fire/leak; applied pagehide-commit + stepper keyboard). lint 3-baseline, build green, isolated (App.tsx untouched).
- 2026-07-12 · UX-C2 · Fable QA · PASS (no blockers) · back-handling no trap/double-handle; one-shot guards (auto-car/weekend) correct; `byActiveCar` byte-identical; dual-writes intact. Backlog: dashboard 2-press exit; auto-car dup if signed-in pull errors→[]; reportSave(synced) TODO; prune `'quickref'` union.
- 2026-07-12 · UX-C3 · Fable QA · PASS (no blockers) · move-out faithful (weather/image/guards/tire-lifecycle/dual-writes preserved via line-diff); undo delete lazy; diagnostics round-trip; keypad string. Pure fns harness PASS. Backlog: deleting weekend still shows in ContextStrip/Dashboard during undo window.
- 2026-07-12 · UX-C4 · current Codex + cavecrew review · PASS-WITH-NOTES · exact named GPT 5.6 routes unavailable/disclosed. Initial review found 3 critical issues (cross-car service, immediate session delete, fresh-flow continuation); fixed. lint exact 3 baseline; build/Gradle green; Android fresh flow/service-accounting Undo/session Undo pass; draft auth gate clean. Commit `21405e9`; draft `6a5458d75d0c165c44d0ef9f`.
- 2026-07-13 · UX-R1 · SOL/Terra/SOL runtime-verified · PASS · five-tab named Tuning Guide; AFCO class/chassis scoping; light accent + 12px floor; deterministic starter convergence; offline local icons/PWA precache; 320×800 theme × four-font matrix; cold offline Android pass. `turn_context.model` is authoritative; earlier generic self-reports of model unavailability were incorrect.
- 2026-07-13 · UX-C5 · SOL/Terra/SOL + cavecrew · PASS · canonical active-car setup writer; same-car copy/blank/diff; numeric adapters/2×2 corners; always-visible shared four-bar; Tires summary/inventory/history; pressure provenance and blank-import preservation. Both harnesses PASS; lint exact 3 baseline; build 539 modules; Android 4.1 (16) 320 CSS px/XX-Large quick-log and cold-cache persistence pass; final draft `6a5509763fc2865568212af7`. Commit `d5ef1f4`.
- 2026-07-13 · Owner revision · Finish Weekend has no session/race lockout (test days are valid). Setup flow uses immutable Baseline → editable Weekend Setup → immutable Final + editable Current copy. Four-bar requires LR/RR top and bottom rows with frame hole, length, birdcage hole, ride-height angle, full-droop angle. Priority labels get plain-language in-app explanations. Font choices collapse to Default (existing 1.15) and Large (existing 1.45); numeric scale text is hidden.
- 2026-07-13 · UX-C6B · Terra High + cavecrew · CODE_PASS / local RUNTIME_PASS, awaiting SOL · lifecycle harness PASS; exact three-error lint baseline; build 540 modules; strict weekend-owned setup resolution prevents cross-car create/reload; zero-run Finish creates locked Final + editable Current; live migration `20260714020037` verified; draft `6a5599e37111d0563ffaf5f3`.
- 2026-07-13 · UX-C6B · SOL High QA attempt 1 · FAIL · cross-car source leak when starting a second weekend after car switch; legacy weekend Finish lacks `setupId` upgrade path; partial local Finish cannot retry and can duplicate deterministic Final/Current IDs. Schema/RLS/migration, harness baseline, exact lint baseline, build, and draft shell PASS. C7 locked; return to Terra.
- 2026-07-13 · UX-C6B · Terra High repair · CODE_PASS / awaiting SOL QA attempt 2 · same-car new-weekend source; event-owned RaceWeekend setup retained; legacy zero-run Finish upgrade; dangling explicit source rejection; idempotent partial-Finish retry with deterministic dedupe and preserved lock/history timestamps. Expanded harness, exact lint baseline, 540-module build, cavecrew re-review, 390 px draft shell/console PASS. Commit `874fecc`; draft `6a55a024d663b44ca4f639c7`. C7 locked.
- 2026-07-13 · UX-C6B · SOL High QA attempt 2 · FAIL · active weekend with missing owned Setup falls back to selected car in RaceWeekend UI; no-link legacy Finish borrows selected-car data; stale deterministic Final/Current rows are reused while Weekend Setup is unlocked; finished-weekend relationship does not lock an unlocked partial-cloud Weekend snapshot. Direct fixture reproduced Car B borrowing and stale Final overwrite. Harness, exact lint baseline, build, live schema/migration/RLS, and draft HTTP pass; cloud tables have zero lifecycle rows. C7 locked; return to Terra.
- 2026-07-13 · UX-C6B · Terra High repair 2 · CODE_PASS / awaiting SOL QA attempt 3 · event UI resolves owned Weekend Setup or null; no-link legacy Finish uses exact blank values; stale deterministic Final/Current rows rebuild from unlocked Weekend bytes; finished relationship locks Weekend Setup at App/UI boundaries without `lockedAt`; clone remains allowed. Expanded harness, exact three-error lint baseline, 540-module/16-entry build, `git diff --check`, cavecrew review, 390×844 draft shell/console PASS. Commit `7b58b30`; draft `6a55a43a8cc5f6b9da612c69`. No SQL change. C7 locked.
- 2026-07-13 · UX-C6B · SOL High QA attempt 3 · PASS · two cavecrew reviews clean; all four attempt-2 blockers closed; lifecycle harness PASS; exact three-error lint baseline; 540-module/16-entry build; diff check and clean tree PASS; draft 390×844 auth shell/console PASS. Live migration present; 23/23 checked mapped columns, RLS, and authenticated CRUD verified; lifecycle tables empty; zero relevant security-advisor findings; existing performance warnings unchanged. C6B closed; C7 unlocked.
- 2026-07-13 · UX-C7 · Terra High + cavecrew · CODE_PASS / awaiting SOL QA · active unfinished event-owned Setup + real run gate; atomic rapid-safe one-to-one run/Setup logging; spring/J-Bar/shock/load/gear/Other/Four-bar controls; marker lifecycle; pure sync mapper round trip; no migration. Focused harness and diff check PASS; lint exact three-error baseline; cavecrew final review clean. Feature `58e4522`. Full coherent build/cloud/mobile/draft gate deferred until C8 by owner-approved consolidation.
- 2026-07-13 · UX-C7 · SOL High QA attempt 1 · FAIL · off-grid spring/J-Bar steps snap to global grid instead of adding exact delta; stale finished-weekend ID can send selected-car generic Setup into RaceWeekend UI; stale/deleted run can render Quick Adjust because UI gate omits unfinished status and session membership. Harness/diff check pass and lint stays exact baseline, but fixtures missed these edges. Return to Terra; C8 locked.
- 2026-07-13 · UX-C7 · Terra High repair 1 · CODE_PASS / awaiting SOL QA 2 · exact relative numeric deltas preserve off-grid bases; raw stale/invalid/finished weekend selection returns null rather than generic selected-car Setup; run UI requires unfinished event, exact owned Setup, and current session-record membership. Expanded harness, exact lint baseline, diff check, and cavecrew review pass. Repair `030122c`; no SQL. C8 locked.
- 2026-07-13 · UX-C7 · SOL High QA attempt 2 · PASS · all attempt-1 blockers closed; complete Quick Adjust harness PASS; repair-range diff check PASS; exact three-error lint baseline; independent cavecrew review clean. Numeric, ownership, run-membership, atomic history, mapper, marker, load filtering, and lock acceptance pass. No SQL/full runtime gate by consolidation. C7 closed; C8 unlocked.

### UX backlog (non-blocking)
- C2: dashboard needs 2 back-presses to exit; wire `reportSave('synced')` into `sync.ts` push helpers; prune dead `'quickref'` in the `activeTab` union. UX-R1 added generation/user guards so stale or failed pulls cannot mark readiness for the wrong auth state.
- C3: pending-delete weekend visible in ContextStrip/Dashboard during 5s undo window (cosmetic); `initialAction='new-session'` with no active weekend opens weekend-create; empty bestLap persists as `"s"` (pre-existing).
- C1: add focus-trap to `BottomSheet` (a11y).
- C4: no-active-car Setups/Tires/Smasher prerequisites were resolved in C5. Global ContextStrip can still show a weekend pending Dashboard undo. App.tsx orchestration grew beyond the ~10-line wiring target; domain-state ownership remains correct.
- C5: unique Netlify draft origin had no remembered login, so authenticated draft feature interaction was not run there; Android preserved-login runtime covered feature paths. `adb install -r` may retain stale Workbox assets; clear only WebView HTTP + Service Worker caches when localStorage must survive.
