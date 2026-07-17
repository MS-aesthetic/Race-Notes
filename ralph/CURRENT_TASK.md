# Current Task — UX Overhaul v2 A4 Repair 3: Universal Target and Text Floors

**Status:** READY — SOL fixer; Chunk A QA repair; B1 blocked
**Branch:** `codex/ux-overhaul`
**Failure authority:** Chunk A QA FAIL 82/100 on 2026-07-17, attributed to A4
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 2, Part 5 Task A4/Chunk A QA, Part 6.1–6.2, and boundary statement 5.2
**Runtime model:** Required role is SOL High. Verify from `turn_context.payload.model`; report `unverified` only when metadata is absent.

## Role and sequencing

SOL fixer owns this bounded repair after Chunk A QA failure. Terra is not re-invoked. Preserve A1–A4 behavior and repair only A4's incomplete app-wide 44px and body/value typography floors. Do not begin B1 or change NumberStepper behavior. After repair commit, independent SOL QA must rerun Chunk A gate before Ralph advances.

## Permitted files

- `src/components/AuthView.tsx`
- `src/components/SettingsView.tsx`
- `src/components/RaceWeekendView.tsx`
- `scripts/setup-touch-target-harness.ts`

No other file is permitted. If complete rendered proof cannot be built inside the named harness without another file, stop and revise Ralph authority before editing.

## Required repair

1. Enforce a rendered minimum target of 44px for every compact interactive control in the permitted components at Standard and Large. Height is always at least 44px; compact/icon-only/clear controls also require at least 44px width. Do not reduce any existing larger target.
2. Auth coverage includes signed-out Sign In/Register mode toggles, Display Name/Email/Password inputs, submit, Google, and signed-in Account/Team/Sign Out controls. Keep handlers, auth flow, disabled states, autocomplete, focus, keyboard, and OAuth behavior unchanged.
3. Settings coverage includes Reset to Defaults and every Danger action/state. Privacy and Danger body descriptions must render `text-sm` or larger; labels and chrome may remain `text-xs` but never smaller when rendered.
4. Race Day coverage includes GPS, Zip, weather-clear, weather-refresh, ZIP input/action, session controls, and equivalent compact controls exposed by the repaired states. GPS/Zip/clear targets must meet the 44px rule. Preserve all handlers and state transitions.
5. Racing information values must render `text-sm` or larger. This explicitly includes Weather values and session Best/Finish values. Auth explanatory body copy and Settings Privacy/Danger body copy must also be `text-sm` or larger. Labels, timestamps, badges, and chrome may remain rendered `text-xs`.
6. Preserve A1 scale migration and three tiers, A2 dirty-only in-flow Save Run and safe-area/nav reservations, A3 pressure grid and frozen NumberStepper 350ms/100ms pointer/click/touch semantics, approved FourBar Bar Length/holes order and adaptive stacking, focus/keyboard/accessibility, pinch zoom, offline behavior, and all data handlers.

## Harness requirements

Extend `scripts/setup-touch-target-harness.ts` with meaningful rendered Chromium coverage across `360×800`, `390×844`, `412×915`, and `1080×2118`, at Standard 1.0 and Large 1.15.

Required rendered fixtures/states:

- Auth signed-out mode toggles, fields, submit, Google, explanatory body; signed-in Account/Team/Sign Out state.
- Settings Privacy, every Danger step/action, and theme Reset.
- Race Day new-session weather controls, ZIP state, weather summary/refresh, run/session controls, and session history Best/Finish values.
- Existing Setup, pressure-grid, FourBar, safe-area, and overflow assertions remain intact.

For each case, assert target rectangles, applicable compact width, text computed size/class floor, containment, overlap, and horizontal overflow. Add in-memory bad fixtures that must fail for at least:

- a 43px target;
- a compact target narrower than 44px;
- an Auth or Settings body downgraded below `text-sm`;
- a Weather or Best/Finish value downgraded below `text-sm`.

Proof must consume or source-lock production classes/markup so production regressions fail. Do not create credentials or bypass the login gate.

## Required tests and evidence

1. Run focused A4 harness plus A1–A3, tire, Quick Adjust, and offline regressions.
2. Confirm NumberStepper behavior slice remains byte-identical to pre-A3 timing/pointer/click logic and B1 scroll-safe behavior has not begun.
3. Run all mutation proofs, including existing FourBar rendered mutations and new target/body/value mutations.
4. Run the full harness suite once with captured per-harness results. Only unchanged documented stale failures in `muted-text-color-harness.ts` and `saved-flash-harness.ts` may remain evidence-only.
5. Run `npm run lint`; require exact known three-error baseline and zero new errors.
6. Run `npm run build`; require PASS.
7. Run `git diff --check`, `git status --short`, and scoped diffs from Ralph state commit and repair base. Confirm only permitted files changed and protected/schema/sync/native/release/package paths remain unchanged.
8. Run signed-out shell checks at all four viewports for exact dimensions, target sizes, focus, safe areas, horizontal overflow, and pinch zoom. Signed-in feature visual checks remain unauthorized without supplied credentials; disclose exactly.
9. Use cavecrew investigator for bounded target/text inventory and cavecrew reviewer for final diff/coverage/behavior audit.

## Repair acceptance

- Every rendered interactive target in covered Auth, Settings, and Race Day states is at least 44px high; compact targets are also at least 44px wide.
- Auth explanatory body, Settings Privacy/Danger body, Weather values, and Best/Finish values render `text-sm` or larger.
- No text renders below `text-xs`; labels/chrome remain readable.
- No clipping, overlap, or horizontal overflow at four viewports × Standard/Large.
- A1–A4 behavior, focus/keyboard, safe areas, offline behavior, and pinch zoom remain intact.
- Harness mutations are meaningful and fail bad fixtures.
- Full suite has no new task-related failures; exact lint/build/boundary gates pass.

## Hard boundaries

- No B1 work and no NumberStepper timing, pointer, touch-action, repeat, click, or scroll-safe behavior changes.
- No schema, RLS, migration, edge-function, sync, delete-path, queue, pull, lifecycle, notification, or persistence changes.
- No App, Setup, FourBar, CSS, package, config, native, Android, release, credential, branch-ref, push, deploy, merge, production, `master`, or Sprint 4 IA changes.
- Do not disable pinch zoom, bypass authentication, create/use credentials, hide overflow, shrink targets, or weaken existing A1–A4 harness assertions.

## Compressed execution contract

SOL repair only. First commit Ralph failure/work order alone. Then edit exactly three components plus `setup-touch-target-harness.ts`; enforce universal 44px targets and `text-sm` body/value floors; add rendered four-viewport × Standard/Large coverage and target/text mutations; preserve A1–A4 and frozen NumberStepper semantics; run focused/full/lint/build/diff/shell/cavecrew; commit repair separately. No B1, schema/sync/native/release, credentials, push, deploy, or merge.
