# Current Task — UX Overhaul v2 A4 Post-Attempt-3 Harness Repair

**Status:** READY — SOL fixer; Chunk A QA repair; B1 blocked
**Branch:** `codex/ux-overhaul`
**Failure authority:** Chunk A QA attempt 2 FAIL 92/100 on repair `25130cd`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 2, Part 5 Task A4/Chunk A QA, Part 6.1–6.2, and boundary statement 5.2
**Runtime model:** SOL High. Verify from runtime metadata.

## Finding

Product implementation is accepted for this repair: Auth, Settings, Race Day, Weather, and Best/Finish target/text floors are correct. Do not modify product components.

`scripts/setup-touch-target-harness.ts` lines near the Weather and Best/Finish production locks use generic class strings occurring multiple times. Changing the exact Weather `{value}` span or exact Best/Finish span from `text-sm` to `text-xs` leaves unrelated generic matches, so source predicates remain green. Current rendered `race-value` mutation changes a copied fixture class only and does not prove that a targeted production regression is rejected.

## Permitted file

- `scripts/setup-touch-target-harness.ts`

No other file is permitted after the required Ralph-only state commit.

## Required repair

1. Extract and lock the exact production Weather `{value}` span, including its class and bound `{value}` content. Do not accept another occurrence of the same class.
2. Extract and lock the exact production Best/Finish span, including its class and `Best: {sx.bestLap || '--'} | Finish: {sx.finishPos || '--'}` content.
3. Feed exact production-derived class/content from both spans into the existing rendered repair fixture. Preserve all existing target, body, time-grid, overflow, FourBar, safe-area, and viewport assertions.
4. Add in-memory mutations against the production source strings themselves:
   - exact Weather `{value}` markup `text-sm` to `text-xs`;
   - exact Best/Finish markup `text-sm` to `text-xs`.
5. Prove each production-source mutation is rejected by the same exact-span lock and rendered value gate. Copied synthetic-fixture mutations may remain as extra coverage but cannot be the only proof.
6. Do not weaken or delete prior mutation cases or source locks.

## Required tests and evidence

1. Run `npx tsx scripts/setup-touch-target-harness.ts`; all FourBar and repair viewport/mutation proof must pass.
2. Run A1–A3, tire, Quick Adjust, and offline focused regressions.
3. Run all 24 harnesses in one captured matrix. Only unchanged documented failures in `muted-text-color-harness.ts` and `saved-flash-harness.ts` are nonblocking.
4. Run `npm run lint`; require exact documented three-error baseline and no new error.
5. Run `npm run build`; require PASS.
6. Run `git diff --check`, clean-status, repair-range scope, and protected-path checks. Only this harness may change after Ralph state commit.
7. Use cavecrew reviewer for exact-span binding, production-source mutation resistance, preserved prior coverage, and boundary audit.
8. Commit harness repair separately from Ralph state.

## Hard boundaries

- B1 remains blocked until independent SOL Chunk A QA PASS.
- No product component, App, NumberStepper, CSS, schema, RLS, migration, sync, delete, queue, pull, lifecycle, notification, persistence, package, config, native, Android, release, credential, branch-ref, push, deploy, merge, production, `master`, or Sprint 4 IA change.
- Do not create/use credentials, bypass auth, disable pinch zoom, hide overflow, shrink targets, alter handlers, or weaken A1–A4 behavior/proof.

## Compressed execution contract

SOL harness-only repair after Ralph-only commit. Bind exact Weather and Best/Finish production spans; reject targeted in-memory production-source `text-sm` to `text-xs` mutations through same lock/render path; preserve all prior proof; run focused/full/lint/build/diff/protected/cavecrew; commit harness alone. B1 blocked. No push, deploy, merge, product, schema, sync, native, or release change.
