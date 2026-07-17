# Current Task — UX Overhaul v2 Task B1: Commit-on-Pointerup NumberStepper

**Status:** READY — one Terra High initial build; SOL light QA next; B2 blocked
**Branch:** `codex/ux-overhaul`
**Dependency:** Chunk A final QA PASS 98/100 at `2fcebc4`; A1–A4 are closed
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 5, Part 5 Task B1/Chunk B, Part 6.1, and boundary statement 5.2
**Runtime model:** Required builder role is Terra High. Verify from runtime metadata; report `unverified` only if metadata is absent.

## Role and sequencing

Terra receives one initial implementation pass. Implement B1 only, commit code and harness together, then stop for independent SOL light QA. Any QA failure transfers fixes to SOL; Terra is not re-invoked. Do not begin B2 or B3.

## Permitted files

- `src/components/ui/NumberStepper.tsx`
- `scripts/saved-flash-harness.ts`
- `scripts/setup-touch-target-harness.ts` — bounded dependency update only: replace obsolete A3 assertions that B1 is untouched; preserve all A3/A4 target, pressure, FourBar, viewport, text, and overflow proof

No other file is permitted. Roadmap product scope remains `NumberStepper.tsx` only; both script files are harness coverage.

## Required behavior

1. Pointer down arms gesture tracking and the existing repeat timer but performs zero writes.
2. A short press commits exactly one step on pointer up only when release remains within approximately 8px of the initial pointer position and hold-repeat did not fire.
3. Pointer movement beyond the slop cancels pending single-step and repeat behavior. The originating scroll gesture produces zero writes.
4. `pointercancel` cancels the gesture and timer with zero writes.
5. Direction buttons use `touch-action: pan-y`, allowing vertical scrolling to remain browser-owned.
6. Hold-to-repeat cadence stays behaviorally identical: first repeat at 350ms, then every 100ms. Releasing after repeat must not add an extra single step.
7. Preserve keyboard-accessible single-step behavior, disabled bounds, min/max clamping, decimal/big-step behavior, direct value editing, ARIA labels, focus, cleanup, and unmount timer cancellation.
8. Preserve A4 presentation: every direction target remains at least 44×44px; no pressure-grid or FourBar layout change.

## Harness requirements

1. Add a meaningful zero-writes-on-scroll behavioral assertion to `scripts/saved-flash-harness.ts` using real B1 source/logic contracts. It must distinguish pointer down, in-slop pointer up, beyond-slop movement, pointer cancel, and hold repeat.
2. Add mutation checks that fail if any of these regress: mutation on pointer down, movement no longer cancels, `pointercancel` writes, `pan-y` returns to `none`, 350ms delay changes, 100ms cadence changes, or release after repeat adds a step.
3. Update `scripts/setup-touch-target-harness.ts` only to replace its pre-B1 byte-equality/`touch-none`/no-`pointermove` locks with B1 contracts. Retain all existing 44px, actual-width pressure, FourBar 12-case, repair eight-case, exact Weather/Best-Finish, safe-area, overlap, and overflow assertions and mutations.
4. `saved-flash-harness.ts` has a pre-existing unrelated whole-App reconstruction byte-lock failure. It may remain evidence-only only if the same assertion remains the sole saved-flash failure and all new B1 assertions demonstrably execute and pass before it. Do not weaken unrelated UXP-18 assertions or modify `App.tsx`.

## Acceptance

- Scroll beginning over either stepper direction button causes zero `onChange` writes and zero Saved/toast side effects.
- In-slop short press commits exactly one step on pointer up, never pointer down.
- Hold repeat begins at 350ms and continues at 100ms with no release double-step.
- Movement beyond approximately 8px and `pointercancel` cancel with zero writes.
- Vertical scrolling works through `touch-action: pan-y`.
- Keyboard, bounds, editing, ARIA/focus, 44px targets, pressure grid, FourBar layout, and all A1–A4 behavior remain intact.

## Required tests and evidence

1. Run focused B1 behavioral/mutation proof plus `setup-touch-target-harness.ts`.
2. Run A1–A4, tire, Quick Adjust, offline, and relevant Saved/toast regressions.
3. Run all 24 harnesses in one captured matrix. Only `muted-text-color-harness.ts` and the same pre-existing unrelated whole-App assertion in `saved-flash-harness.ts` may remain nonblocking; no new failure is accepted.
4. Run `npm run lint`; require the exact documented three-error baseline and zero new errors.
5. Run `npm run build`; require PASS.
6. Run `git diff --check`, clean status, task-range scope, and protected-path checks.
7. Use cavecrew reviewer for pointer/timer state-machine, mutation strength, exact three-file boundary, and A1–A4 regression audit.
8. Commit code plus harness only with a B1-identifying message. Do not update Ralph state.

## Hard boundaries

- No B2/B3 notification, toast, save-status, App, Setup, RaceWeekend, FourBar, CSS, schema, RLS, migration, sync, delete, queue, pull, lifecycle, persistence, package, config, native, Android, release, credential, branch-ref, push, deploy, merge, production, `master`, or Sprint 4 IA change.
- Do not change 350ms/100ms cadence, disable pinch zoom, hide overflow, shrink targets, create/use credentials, or weaken A1–A4 assertions.

## Compressed execution contract

Terra initial B1 only. Commit pointerup within ~8px; pointerdown/scroll/cancel zero writes; `pan-y`; repeat 350ms/100ms unchanged; no release double-step. Modify only NumberStepper plus two named harnesses, preserve A1–A4, run focused/full/lint/build/diff/cavecrew, commit code+harness, stop for SOL. B2 blocked. No push, deploy, merge, schema, native, or release change.
