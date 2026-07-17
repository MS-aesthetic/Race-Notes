# Current Task — UX Overhaul v2 Task B1: Commit-on-Pointerup NumberStepper

**Status:** SOL REPAIR — B1 attempt 1 QA FAIL 94/100 on `d87275d`; B2 blocked
**Branch:** `codex/ux-overhaul`
**Dependency:** Chunk A final QA PASS 98/100 at `2fcebc4`; A1–A4 are closed
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 5, Part 5 Task B1/Chunk B, Part 6.1, and boundary statement 5.2
**Runtime model:** Required repair role is SOL High. Verify from runtime metadata; report `unverified` only if metadata is absent.

## Role and sequencing

Terra initial implementation `d87275d` passed product behavior but failed independent SOL QA at 94/100 because two mutation seeds did not represent the regressions they claimed. SOL owns this repair and subsequent fixes; Terra is not re-invoked. Commit the harness repair separately from the preceding Ralph-only failure record, then stop for independent SOL light QA. Do not begin B2 or B3.

## Permitted files

- `scripts/saved-flash-harness.ts`

No other file is permitted for the repair commit. `src/components/ui/NumberStepper.tsx` and `scripts/setup-touch-target-harness.ts` are accepted and frozen; do not modify them.

## Accepted product behavior — preserve unchanged

1. Pointer down arms gesture tracking and the existing repeat timer but performs zero writes.
2. A short press commits exactly one step on pointer up only when release remains within approximately 8px of the initial pointer position and hold-repeat did not fire.
3. Pointer movement beyond the slop cancels pending single-step and repeat behavior. The originating scroll gesture produces zero writes.
4. `pointercancel` cancels the gesture and timer with zero writes.
5. Direction buttons use `touch-action: pan-y`, allowing vertical scrolling to remain browser-owned.
6. Hold-to-repeat cadence stays behaviorally identical: first repeat at 350ms, then every 100ms. Releasing after repeat must not add an extra single step.
7. Preserve keyboard-accessible single-step behavior, disabled bounds, min/max clamping, decimal/big-step behavior, direct value editing, ARIA labels, focus, cleanup, and unmount timer cancellation.
8. Preserve A4 presentation: every direction target remains at least 44×44px; no pressure-grid or FourBar layout change.

## Exact QA failure

1. `slop-cancel-removed` removes only `press.moved = true` while leaving `cancelPress()` active. Timers and gesture still cancel, so the production-source mutation is behavior-neutral and does not prove that ignored movement is rejected.
2. `pointercancel-write` routes `onPointerCancel` to `stopPress`. `stopPress` performs zero writes, so the mutation does not prove that an actual pointercancel write path is rejected.
3. Product state-machine, source contracts, focused tests, A1–A4 regressions, full 22/24 matrix, exact lint baseline, build, scope, protected paths, signed-out shell, and cavecrew review otherwise passed. Product code requires no repair.

## Required repair

1. Replace the movement seed with an exact production-source mutation that neutralizes the whole movement-cancellation block: beyond-slop movement must be ignored, leaving the gesture armed so the mutated behavior can write. Prove the mutation changes behavior and `b1SourceContractsPass` rejects it.
2. Replace the pointercancel seed with an exact production-source mutation routing the real `onPointerCancel` handler to `finishPress` or another actual write path. Demonstrate the mutated cancel path writes, then prove the production-source contract rejects it.
3. Keep existing pointerdown, `pan-y`, 350ms, 100ms, release-slop, and release-double-step production mutations intact and passing.
4. Preserve the source-derived B1 state model, direct no-move out-of-slop release proof, A1–A4 assertions, and all unrelated UXP-18 assertions.
5. Preserve ordering: `B1 stepper behavior harness: PASS` must print before the same documented stale whole-App reconstruction byte-lock failure. Do not weaken or move the stale assertion.

## Acceptance

- Both replacement mutations are real behavior regressions, not token-only or behavior-neutral edits.
- Movement-ignored mutation produces a write where production produces zero; production-source contract kills it.
- Pointercancel-write mutation produces a write where production produces zero; production-source contract kills it.
- All accepted B1 product behavior and prior A1–A4 proof remain unchanged.

## Required tests and evidence

1. Run focused B1 behavioral/mutation proof plus `setup-touch-target-harness.ts`; capture the B1 PASS marker before the documented saved-flash stale failure.
2. Run A1–A4, tire, Quick Adjust, offline, and relevant Saved/toast regressions.
3. Run all 24 harnesses in one captured matrix. Only `muted-text-color-harness.ts` and the same pre-existing unrelated whole-App assertion in `saved-flash-harness.ts` may remain nonblocking; no new failure is accepted.
4. Run `npm run lint`; require the exact documented three-error baseline and zero new errors.
5. Run `npm run build`; require PASS.
6. Run `git diff --check`, clean status, task-range scope, and protected-path checks.
7. Use cavecrew reviewer for mutation behavioral relevance, stale-lock ordering, exact one-file repair boundary, and A1–A4 regression audit.
8. Commit only `scripts/saved-flash-harness.ts` with a B1 repair-identifying message. Do not update Ralph state again after the repair commit.

## Hard boundaries

- No `NumberStepper.tsx`, setup-touch-target harness, B2/B3 notification, toast, save-status, App, Setup, RaceWeekend, FourBar, CSS, schema, RLS, migration, sync, delete, queue, pull, lifecycle, persistence, package, config, native, Android, release, credential, branch-ref, push, deploy, merge, production, `master`, or Sprint 4 IA change.
- Do not change 350ms/100ms cadence, disable pinch zoom, hide overflow, shrink targets, create/use credentials, or weaken A1–A4 assertions.

## Compressed execution contract

SOL B1 harness-only repair after QA FAIL 94. Modify only `scripts/saved-flash-harness.ts`: replace behavior-neutral movement seed with whole-block ignored-movement regression; replace zero-write `stopPress` pointercancel seed with actual `finishPress` write regression; prove both write and source contract rejects them. Preserve product code, setup harness, A1–A4, stale-lock ordering, full tests, exact lint baseline, build, scope, cavecrew. Commit harness only; stop for independent SOL QA. B2 blocked.
