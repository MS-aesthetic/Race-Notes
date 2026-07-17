# Current Task — UX Overhaul v2 Task B2: SOL QA Failure Repair

**Status:** REPAIR — attempt 3 owned by SOL; independent SOL QA required after repair; B3 blocked
**Branch:** `codex/ux-overhaul`
**Failed build:** SOL repair commit `131705c`, independent QA FAIL 95/100
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 9 including N3, Part 5 Task B2/Chunk B, Part 6.1, and boundary statement 5.2
**Runtime:** SOL High fixer. Terra is not re-invoked after first QA failure.

## Exact repair scope

Modify only:

- `scripts/saved-flash-harness.ts`

All product code and every other harness are accepted and frozen. No other file is permitted after this Ralph-only work-order commit.

## Required repairs

1. Repair only `infoPriorityMutation` rendered proof. Seed simultaneous info + Saved state through production-derived routing extracted from the mutated App renderer; do not hardcode the priority result independently of mutated production source.
2. Baseline production source must render exactly one info notification for simultaneous info + Saved.
3. Priority mutation must alter real production source, compile as TSX, render Saved while hiding info, and independently fail source, model, and rendered gates.
4. Preserve existing compile-real co-render proof and all B1/B2 geometry, resolved-context dedupe, success-before-dedupe ordering, shared 1500ms Saved/Synced/pull timeout, safe-area/header/nav/44px/overflow proof, duplicate-copy proof, four modernized regression harnesses, and both named stale-lock positions.
5. Do not change product behavior or any non-priority proof contract.

## Required gates

1. Focused B1/B2 harness proof must reach both PASS markers before unchanged saved-flash stale whole-App lock.
2. Run A1–A4, tire, Quick Adjust, offline, pull-on-resume, semantic-status, and all relevant notification regressions.
3. Run all 24 harnesses captured. Required result: 22/24 PASS. Only unchanged `muted-text-color-harness.ts` AuthView byte lock and unchanged `saved-flash-harness.ts` whole-App reconstruction byte lock may fail.
4. `npm run lint`: exact documented three-error baseline, zero new errors.
5. `npm run build`: PASS.
6. Signed-out shell at 360×800, 390×844, 412×915, 1080×2118: exact dimensions, no horizontal overflow, controls at least 44px, pinch zoom enabled, zero console errors. Do not create or use credentials.
7. `git diff --check`; exact one-file harness repair diff after Ralph commit; protected paths clean; worktree clean after commit.
8. Cavecrew review must pass notification priority, keyed copy, all success timers, actual rendered geometry/mutations, regression-harness modernization, B1/A1–A4 preservation, and scope.
9. Commit repair code/harness separately with B2-identifying message. Do not advance Ralph after builder completion. Stop for independent SOL QA.

## Hard bans

No B3 or Chunk C. No product component, `App.tsx`, other harness, `SetupView.tsx`, NumberStepper, RaceWeekend, FourBar, CSS, types, `sync.ts`, `saveStatus.ts`, schema, RLS, migrations, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Do not alter delete/queue/pull/resume-throttle/lifecycle/persistence meaning.
