# Current Task — UX Overhaul v2 A3: Tire-Pressure Grid and Stepper Layout

**Status:** READY — Terra initial build, attempt 1
**Branch:** `codex/ux-overhaul`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 4, Part 5 Task A3, and boundary statement 5.2
**Runtime model:** Verify from `turn_context.payload.model` before work; if unavailable, report `unverified`.

## Builder role

Work as Terra initial builder. Read `AGENTS.md`, `.agents/skills/caveman/SKILL.md`, `.agents/skills/cavecrew/SKILL.md`, this file, `ralph/STATE.md`, Part 2 item 4, Part 5 Task A3, and boundary statement 5.2 before editing. Use `/caveman full`; use cavecrew for delegated work.

Implement only Task A3. Land feature code and harness coverage together in one task-identifying commit. Do not self-certify or advance Ralph state; SOL light QA owns verdict and state advancement.

## Authorized files only

- `src/components/RaceWeekendView.tsx` — tire-pressure grid only.
- `src/components/ui/NumberStepper.tsx` — stepper button/value/unit layout only.
- `scripts/setup-touch-target-harness.ts` — A3 byte-lock/behavior assertions plus exact current-baseline compatibility required for this focused harness; no unrelated weakening.

Any edit outside these three files, or outside named surfaces within them, fails scope.

## Required change

1. Replace tire-pressure grid with exact responsive fallback: `repeat(auto-fit,minmax(10.5rem,1fr))`, based on actual available width rather than device breakpoint.
2. Give shared NumberStepper minus and plus buttons a minimum 44px touch floor, as required by Part 2 items 4 and 2.
3. Render value with `whitespace-nowrap tabular-nums`.
4. Render unit as a separate, smaller `shrink-0` element.
5. Preserve four visually distinct regions: minus button, value, unit, plus button.
6. Update `scripts/setup-touch-target-harness.ts` only for A3 layout/touch assertions and exact current-baseline compatibility required to run the focused harness. Do not weaken unrelated behavioral coverage.
7. Make zero stepper timing, pointer, `touch-action`, repeat, or commit-semantics changes. B1 owns scroll-safe commit behavior later.

## Acceptance

- All four tire-pressure controls remain distinct, readable, and free of clip/overlap at `360×800`, `390×844`, `412×915`, and `1080×2118`.
- Verify every named viewport at both Standard/Default and Large scale.
- Grid fallback follows actual available width; it may collapse when effective width cannot fit two `10.5rem` columns.
- Minus, value, unit, and plus remain separate regions for every pressure control.
- Shared NumberStepper buttons retain at least 44px target floors.
- Focus, keyboard, accessibility names/semantics, pinch-zoom, and safe-area behavior remain unchanged.
- No scroll-triggered mutation, timing, pointer, `touch-action`, repeat, or commit behavior changes land in A3.

## Required verification

1. Run focused `scripts/setup-touch-target-harness.ts`; it must PASS.
2. Mutation-check new A3 assertion once by invalidating implementation or an in-memory fixture; prove failure, restore, rerun PASS. Commit no mutation artifact.
3. Inspect rendered/layout behavior at all four named viewports under Standard/Default and Large. If signed-in visual state lacks authorized credentials, do not create or use credentials; disclose limitation for SOL QA.
4. Run `npm run lint`; result must match exact known three-error baseline, with zero new errors.
5. Run `npm run build`; it must PASS.
6. Run `git diff --check` and `git status --short`.
7. Inspect `git diff 141b17d..HEAD` and working diff. A3 commit must contain only three authorized files and only A3 code+harness work.
8. Run relevant pressure-grid, NumberStepper, A1 scale, A2 reservation, Quick Adjust, focus/keyboard, and offline regressions available in current harnesses. Treat unrelated pre-existing stale byte-lock failures as evidence; do not edit outside A3 scope.
9. Use cavecrew reviewer on final A3 diff.
10. Commit once with an A3-identifying message. Report commit SHA and concise evidence for focused harness, mutation proof, exact lint baseline, build, regressions, review, diff check, scope, and status.

## Hard boundaries

- No files outside three authorized files; no Ralph edits by builder.
- No A2 reservation changes, A4 density work, B1 scroll-safe stepper work, or any other task.
- No schema, RLS, migrations, edge functions, or sync behavior changes.
- No deletion behavior, dual weekend-delete changes, team-owner canonical-write changes, account-scoped deferred-delete queue changes, UXN-1 pull-filtering changes, or protected delete-path work.
- No UXN-3 pull-on-resume throttle or generation-isolation changes.
- No setup lifecycle role/history/immutability changes.
- Do not sync `activeCarId` or `activeWeekendId`; both remain localStorage-only.
- Do not disable pinch-zoom or regress focus, keyboard, accessibility, or safe-area behavior.
- No native, Android, release, APK/AAB, package, credential, branch-ref, push, deploy, merge, production, or `master` work.
- Do not begin Sprint 4 IA work.
- Stop after one A3 code+harness commit and handoff to SOL light QA. Do not begin A4.

## Compressed builder contract

Patch only tire-pressure auto-fit grid, NumberStepper 44px button/value/unit layout, and focused A3 harness compatibility/assertions. Preserve four regions and all timing/pointer/`touch-action`/repeat/commit behavior. Verify four viewports × both scales when authorized; focused harness plus mutation proof; exact three-error lint baseline; build; relevant regressions; cavecrew review; diff/status scoped. Commit code+harness once. No Ralph/schema/sync/delete/throttle/generation/lifecycle/native/release/branch/push/deploy/merge/A2/A4/B1/Sprint-4 work.
