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
| WS-P | Maintenance UI (Trackers "Service", todo-template style) | pending | 0 | — | — | |
| WS-Q | Checklist engine | pending | 0 | — | — | |
| WS-R | Checklist UI | pending | 0 | — | — | |
| WS-S | Push infrastructure | pending | 0 | — | — | Blocked by human gates 1–2 |
| WS-T | Location sharing (foreground) | pending | 0 | — | — | |
| WS-U | Ping / come-here notifications | pending | 0 | — | — | Needs WS-S |
| WS-V | HERE truck-routing lib | pending | 0 | — | — | Blocked by human gate 3 |
| WS-W | Trip planner UI | pending | 0 | — | — | Needs WS-V |
| WS-X | Teammates on route | pending | 0 | — | — | Needs WS-T + WS-W |
| WS-Y | QA hardening & release | pending | 0 | — | — | Last; gates the batch |

Status values: `pending` · `in_progress` · `complete` · `scaffolded` (partial pre-work exists)

## Human gates (Maxx) — required before the flagged WS can start

- [ ] 1. Firebase project + `google-services.json` in `android/app/` (→ WS-S)
- [ ] 2. `supabase secrets set FCM_SERVICE_ACCOUNT_JSON=...` + web VAPID key in `.env.local` (→ WS-S)
- [ ] 3. HERE account + `VITE_HERE_API_KEY` in `.env.local` (→ WS-V)
- [ ] 4. Apply migrations 011–013 to live Supabase (→ before WS-O/Q/S/T cloud sync testing)

## Grade log

_(ws-qa appends one line per verdict: date · WS · attempt · PASS/FAIL · score · summary)_
- 2026-07 · WS-N · attempt 1 · PASS · 96 · sync.ts mappers (maintenance_components, maintenance_logs, checklist_templates, weekend_checklists, saved_trips) + data.ts INITIAL_* defaults. lint 3-baseline only, build clean. Diff scoped to sync.ts + data.ts only.
- 2026-07 · WS-O · attempt 1 · PASS · 95 · Fixed car-scoping gap in getComponentStatus (added savedSetups param, resolves weekend->car via setupId indirection, rig scope unaffected). Diff scoped to maintenance.ts only. lint 3-baseline only, build clean. No callers yet (App.tsx wiring deferred to WS-P, by design).

## Backlog

_(follow-up items discovered during QA — do not expand an in-flight WS)_
