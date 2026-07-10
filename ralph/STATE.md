# Ralph Loop — State

> Machine-readable loop state. Only **ws-planner** (status → in_progress) and
> **ws-qa** (verdicts, completion) edit this file. Humans edit the Human Gates
> section. See plan-v2.md §1 for the loop protocol.

## How to run the loop (VS Code + Copilot)

1. Open `.worktrees/v2` as the workspace (branch `preview-v2`).
2. `@ws-planner` → writes `ralph/CURRENT_TASK.md` for the next WS.
3. `@ws-builder` → implements it, commits `WS-x attempt N: ...`.
4. `@ws-qa` → grades. PASS → back to step 2. FAIL ≤2 attempts → step 3.
   FAIL >2 attempts → `@ws-fixer`, then back to step 4.

## Workstream status

| WS | Title | Status | Attempts | Score | Commit | Notes |
|----|-------|--------|----------|-------|--------|-------|
| WS-N | Data model & migrations foundation | complete | 1 | 96 | e0ecbbf | Types + migrations 011-013 + sync.ts mappers (push/pull/delete) + data.ts defaults for maintenance/checklists/trips. Migrations still need owner approval before apply (human gate 4). |
| WS-O | Maintenance engine | complete | 1 | 95 | 17ad130 | Car-scoping fix: getComponentStatus now takes savedSetups, resolves weekend.setupId->Setup.carId, excludes unresolvable weekends for scope:'car'. scope:'rig' unaffected (counts all). lint 3-baseline only, build clean. |
| WS-P | Maintenance UI (Trackers "Service", todo-template style) | complete | 1 | 93 | 47da05b | Service sub-tab in Trackers: Car/Rig grouped rows, status chips (ok/due/overdue), usage bars, Log modal (date/type/notes/cost→accounting), Add Component form, Add Defaults seed. Dashboard Service Due collapsible panel (only due/overdue items). App.tsx state+handlers+cloud-pull wired. lint 3-baseline only, build clean. |
| WS-Q | Checklist engine | complete | 1 | 94 | f482938 | Added materializeStarterTemplate() to bridge STARTER_TEMPLATES (plain strings) into real, ID-bearing, user-owned ChecklistTemplate objects. instantiateTemplate/checklistProgress/STARTER_TEMPLATES untouched. lint 3-baseline only, build clean.
| WS-R | Checklist UI | complete | 1 | 92 | f220947 | ChecklistsSection in RaceWeekendView weekend banner (attach templates, check-off with doneAt/doneBy, delete). ChecklistsTab template manager in Trackers (CRUD items, starter templates, expand-to-edit). App.tsx state+pull+delete-weekend-null wired. lint 3-baseline only, build clean. |
| WS-S | Push infrastructure | pending | 0 | — | — | Human gates cleared, but PAUSED 2026-07-10: needs package-name rename to `nimbus.engineering.crewchief` committed on preview-v2 first (owner-decided; branches still say com.racenotes.app, Firebase+google-services already nimbus). Web push lib + send-push edge fn + firebase-messaging-sw.js are package-agnostic and can build independently; native manifest/FCM config deferred until rename lands. |
| WS-T | Location sharing (foreground) | pending | 0 | — | — | |
| WS-U | Ping / come-here notifications | pending | 0 | — | — | Needs WS-S |
| WS-V | HERE truck-routing lib | complete | 1 | 93 | 3694aed | flexpolyline decoder + here.ts (geocode/truckRoute/POI discover/planTrip, full HereError taxonomy); live-API verified, lint/build green |
| WS-W | Trip planner UI | pending | 0 | — | — | Needs WS-V |
| WS-X | Teammates on route | pending | 0 | — | — | Needs WS-T + WS-W |
| WS-Y | QA hardening & release | pending | 0 | — | — | Last; gates the batch |

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

## Backlog

_(follow-up items discovered during QA — do not expand an in-flight WS)_
- WS-V: re-attribute `firebase` + `@capacitor/push-notifications` package.json additions to WS-S's commit (installed but unused by WS-V; currently left uncommitted in the worktree).
- WS-V: consider HERE category-ID filtering as a fallback to Discover text search for non-English locales / noisy results.
- WS-S: PAUSED — commit the package-name rename to `nimbus.engineering.crewchief` on preview-v2 before any native/FCM work (owner-decided 2026-07-10; Firebase + google-services.json already nimbus).
