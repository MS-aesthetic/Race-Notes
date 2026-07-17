# Current Task — UX Overhaul v2 Task B2: SOL QA Failure Repair

**Status:** REPAIR — attempt 2 owned by SOL; independent SOL QA required after repair; B3 blocked
**Branch:** `codex/ux-overhaul`
**Failed build:** Terra commit `ba7e018`, independent QA FAIL 84/100
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 9 including N3, Part 5 Task B2/Chunk B, Part 6.1, and boundary statement 5.2
**Runtime:** SOL High fixer. Terra is not re-invoked after first QA failure.

## Exact repair scope

Modify only:

- `src/App.tsx`
- `scripts/saved-flash-harness.ts`
- `scripts/car-delete-undo-harness.ts`
- `scripts/chunk5-setup-harness.ts`
- `scripts/confirm-sheet-harness.ts`
- `scripts/offline-indicator-harness.ts`

`src/components/SetupView.tsx` product behavior is accepted and frozen. Four added regression harnesses receive assertion-only modernization for B2-obsoleted renderer/copy anchors; preserve every unrelated behavior assertion. No other file permitted after this Ralph-only work-order commit.

## Required repairs

1. Make every displayed success state use one deterministic approximately 1500ms lifetime. `Saved`, ordinary `Synced`, and pull-path `Synced` must share one constant/cleanup route; remove competing 2500ms/3000ms clear timers without changing pull, throttle, sync, or persistence behavior.
2. Enforce one reason-keyed visible-copy source. `showInfo` must not accept caller-composed finished messages. Dynamic context may be passed as structured values to a central reason resolver, but final visible copy must be built only there. Historical Setup banner remains sole passive historical warning; SetupView stays frozen.
3. Keep one arbiter slot: info suppresses/replaces Saved and sync success; simultaneous state renders exactly one notification; suppressed Saved never reappears.
4. Replace synthetic toast geometry proof. Render production-derived header, notification, and bottom-nav markup using production classes and compiled production CSS. Test online and offline/wrapped header states, safe inset, real `--ui-zoom`, Standard and Large, at 360×800, 390×844, 412×915, and 1080×2118. Directly measure header/toast/nav bounds, containment, overlap, horizontal overflow, compact width, and actual info close button at least 44×44. Do not infer geometry from class-substring booleans or hardcoded header/toast sizes.
5. Make simultaneous co-render and priority mutations compile-real and production-routed. Each mutation must alter real production source, survive extraction/render setup, produce the advertised bad behavior, and fail source/model/rendered gates. Retain real dedupe, timeout, bottom-position, oversized, duplicate-copy, B1 movement, and B1 pointercancel mutations.
6. Modernize only obsolete B2 assertions in four added harnesses:
   - `car-delete-undo`: assert reason-keyed `showInfo` guard ordering and unified renderer; retain undo/delete semantics.
   - `chunk5-setup`: replace obsolete `setInfoToast(null)` lock with current `clearInfo`/arbiter preservation semantics; retain Setup lifecycle and Save Run assertions.
   - `confirm-sheet`: replace obsolete App literal/`setInfoToast` expectations with keyed reasons; retain all confirm and non-App InfoToast assertions.
   - `offline-indicator`: replace old bottom-toast byte lock with unified top arbiter plus exact offline-honest `Offline — saved on device`; retain online/offline detection semantics.
7. Preserve B1 and A1–A4 behavior, keyboard/focus/ARIA, 44px floors, safe areas, pinch zoom, pressure/FourBar geometry, dirty-only Save Run, offline local persistence, and historical banner behavior.

## Required gates

1. Focused B1/B2 harness proof must reach both PASS markers before unchanged saved-flash stale whole-App lock.
2. Run A1–A4, tire, Quick Adjust, offline, pull-on-resume, semantic-status, and all relevant notification regressions.
3. Run all 24 harnesses captured. Required result: 22/24 PASS. Only unchanged `muted-text-color-harness.ts` AuthView byte lock and unchanged `saved-flash-harness.ts` whole-App reconstruction byte lock may fail.
4. `npm run lint`: exact documented three-error baseline, zero new errors.
5. `npm run build`: PASS.
6. Signed-out shell at 360×800, 390×844, 412×915, 1080×2118: exact dimensions, no horizontal overflow, controls at least 44px, pinch zoom enabled, zero console errors. Do not create or use credentials.
7. `git diff --check`; exact six-file repair diff after Ralph commit; protected paths clean; worktree clean after commit.
8. Cavecrew review must pass notification priority, keyed copy, all success timers, actual rendered geometry/mutations, regression-harness modernization, B1/A1–A4 preservation, and scope.
9. Commit repair code/harness separately with B2-identifying message. Do not advance Ralph after builder completion. Stop for independent SOL QA.

## Hard bans

No B3 or Chunk C. No `SetupView.tsx`, NumberStepper, RaceWeekend, FourBar, CSS, types, `sync.ts`, `saveStatus.ts`, schema, RLS, migrations, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Do not alter delete/queue/pull/resume-throttle/lifecycle/persistence meaning.
