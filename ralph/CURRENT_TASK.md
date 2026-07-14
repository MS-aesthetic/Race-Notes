# Current Task — UXF-3 Setup Lifecycle Display Labels

**Status:** IN_PROGRESS — Terra initial build attempt 1
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Prerequisite:** UXF-2 closed by SOL QA at `0c55e7f`

## Goal

Rename lifecycle presentation to Starting, Live-Trackside, Current, and evidence-based Raced/Finished without changing lifecycle data or mechanics.

## Scope

1. Add pure lifecycle display helpers in `src/lib/setupLifecycle.ts`:
   - `lifecycleLabel(role, weekend?)`: baseline `Starting Setup`; weekend `Live-Trackside Setup`; current `Current Setup`; final `Raced Setup` only when supplied originating weekend contains a session with `type === 'Feature'`, otherwise `Finished Setup`.
   - `displayVersionLabel(setup)`: render-time rewrite of legacy `Baseline Setup`, `Weekend Setup`, and `Final Setup` substrings. Legacy Final defaults to `Finished Setup` because no Feature evidence is available. Never mutate input.
2. Change version-label templates only for newly created lifecycle records and relevant name fallbacks in `setupLifecycle.ts` and `App.tsx`.
3. Sweep user-visible old role vocabulary across SetupView, RaceWeekendView, App toasts/modals, and other `src/` sites. Use helpers for role/stored labels. Keep already-correct `Starting Setup (optional)` copy.
4. Update chunk6b lifecycle harness label assertions and add:
   - Feature weekend final is Raced; no-Feature/missing weekend final is Finished.
   - Legacy stored label renders new wording while source object, JSON, and cloud row bytes remain unchanged.
   - Lifecycle behavior/lock/finish/idempotency assertions remain intact.
5. Update lifecycle vocabulary only in `GuideView.tsx` and `docs/USER_GUIDE.md`; tone/structure stays for UXF-5.

## Files

**Primary:**
- `src/lib/setupLifecycle.ts`

**Shared:**
- `src/components/SetupView.tsx`
- `src/components/RaceWeekendView.tsx`
- `src/App.tsx` user-visible strings/new-label templates only
- `scripts/chunk6b-lifecycle-harness.ts`
- `src/components/GuideView.tsx` lifecycle terms only
- `docs/USER_GUIDE.md` lifecycle terms only

## Out of scope

- No lifecycle role/type, storage shape, migration, or RaceWeekend metadata change.
- No finish transaction, lock, ownership, merge, sync, or idempotency behavior change.
- No rewrite of historical stored labels; display mapping only.
- No Quick Adjust coalescing, guide tone/structure, package, native, deploy, push, merge, or APK work.

## Acceptance

1. No user-visible `Baseline Setup`, `Weekend Setup`, or `Final Setup` remains outside display mapping/code comments.
2. New start persists Starting + Live-Trackside labels. Finish persists Raced only with a Feature session; otherwise Finished, plus editable Current.
3. Legacy labels render new wording while stored/local/cloud bytes remain unchanged.
4. All lifecycle mechanics and locks remain unchanged; enforcement messages use new vocabulary.
5. Full chunk6b lifecycle harness passes; exact three-error lint baseline, build, and `git diff --check` pass.
6. Cavecrew review finds no blocker.

## Routing

Terra owns one initial build pass. Primary owns cross-cutting build; cavecrew handles bounded tracing/review. Commit feature and durable handoff, then return to SOL High QA. Any QA failure transfers repair to SOL fixer.
