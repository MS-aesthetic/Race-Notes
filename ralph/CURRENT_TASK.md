# Current Task — UX Overhaul v2 Chunk A QA: Scale & Density Foundation

**Status:** READY — SOL chunk gate; B1 blocked
**Branch:** `codex/ux-overhaul`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 5 Chunk A QA, Part 6.2, Part 6.1, and boundary statement 5.2
**Runtime model:** Verify from `turn_context.payload.model`; required role is SOL High. If metadata is unavailable, report `unverified`.

## Role and sequencing

Run the mandatory Chunk A QA gate after A4 light-QA PASS. This is SOL-owned, read-only verification, not a Terra implementation task. Do not begin Task B1 until this gate passes and Ralph state advances again.

Completed Chunk A feature commits:

- A1 `dc49c06` — scale default and migration.
- A2 `141b17d` — Save Run reservation and bottom-nav clearance.
- A3 `4618ce3` — tire-pressure grid and stepper layout.
- A4 initial `d821ad6`, SOL repair `2f668ce` — app-wide density and whitespace pass.

## Permitted files

No application, harness, schema, native, release, or configuration files are authorized for modification. Chunk QA is read-only. Only SOL may update `ralph/STATE.md` and `ralph/CURRENT_TASK.md` after the verdict in a separate state-advancement commit.

Terra has no permitted files and must not run an implementation pass. Task B1 remains blocked until Chunk A QA is green.

## Required combined acceptance

1. Re-verify A1 Default=`standard` 1.0, Large 1.15, Extra Large 1.45, one-time legacy `large` migration, Reset target, local-only theme storage, and pinch zoom.
2. Re-verify A2 dirty-only in-flow Save Run bar, safe-area reservation, global bottom-nav clearance, and clean-session absence.
3. Re-verify A3 pressure-grid `auto-fit/minmax(10.5rem)` separation, distinct minus/value/unit/plus regions, 44px targets, and frozen NumberStepper timing/pointer/click behavior.
4. Re-verify A4 44px floors, phone-first two-column Setup grid, approved FourBar order, width-pressure-only hole stacking, no clip/overlap/overflow, complete density tiers, `text-xs` chrome floor, and `text-sm` body/value floor.
5. Verify Chunk A cross-task interactions explicitly:
   - A1 scale × A4 density and typography floors.
   - A2 Save Run/nav reservation × A4 reduced header/nav/control heights.
   - A3 pressure-grid and NumberStepper presentation × A4 44px target equalization.
6. At `360×800`, `390×844`, `412×915`, and `1080×2118`, test Standard/Default and Large together: every view's scroll extremes, live Settings tier switching, focus, keyboard, safe areas, nav clearance, Setup corners/FourBar, Race Day pressure/freeform/Save Run, and horizontal overflow. Confirm pinch zoom remains enabled. Do not create or use credentials; disclose signed-in visual limitations exactly.
7. Reproduce owner screenshot scenarios 1–3 named by Chunk A authority where authorized state permits.

## Required tests and evidence

1. Run focused A1–A4 harnesses: `chunk6a-refinement-harness.ts`, `chunk5-setup-harness.ts`, `setup-touch-target-harness.ts`, and `chunk5-tires-harness.ts`.
2. Re-run meaningful mutation proofs for migration idempotence, dirty-only/reservation behavior, pressure-grid/44px targets, FourBar order/adaptive width budget, clipping/overflow, and typography floors. Each bad fixture must fail.
3. Run Quick Adjust and offline regressions; prove NumberStepper repeat cadence remains 350ms/100ms and scroll-safe B1 behavior has not begun.
4. Run the full harness suite once with captured per-harness results. Existing `muted-text-color-harness.ts` AuthView and `saved-flash-harness.ts` whole-App stale byte locks may remain evidence only if failures are unchanged and no other harness fails. Do not rewrite them during this gate.
5. Run `npm run lint`; require the exact known three-error baseline and zero new errors.
6. Run `npm run build`; require PASS.
7. Run `git diff --check`, `git status --short`, and inspect cumulative `git diff 10955de..HEAD`. Confirm each A1–A4 feature commit stayed inside its task files, Ralph commits stayed separate, protected paths stayed unchanged, and tree is clean.
8. Use cavecrew reviewer for the cumulative Chunk A diff, explicitly checking scale/density interaction, target/text floors, sticky/nav reservations, safe areas, focus/keyboard, pinch zoom, and unchanged data/handler semantics.

## Chunk A PASS gate

- Default is materially denser than Large without unreadable text.
- Setup corners remain two usable columns at normal portrait widths.
- FourBar Bar Length stays full-width; Frame/Birdcage sit below in two Standard-width columns and stack only under real width pressure.
- Save Run never obscures content; nothing sits behind bottom nav.
- Four pressure controls remain distinct at Standard and Large.
- Every interactive target is at least 44px; body/value text is at least `text-sm`; no text renders below `text-xs`.
- Scroll extremes, focus, keyboard, safe areas, routing, offline behavior, and pinch zoom remain intact.
- Full suite has no task-related failures; boundary and commit hygiene checks pass.

## Verdict handling

- PASS: record Chunk A completion and evidence in `ralph/STATE.md`, explicitly recommend owner on-device density review at this natural stopping point, then set `ralph/CURRENT_TASK.md` to Task B1 for Terra initial implementation.
- FAIL: attribute failure to offending A task, retain its attempt count, and write a bounded repair order. Do not open B1.

## Hard boundaries

- No code or harness edits during Chunk A QA.
- Do not begin B1 or any later task before gate PASS.
- No schema, RLS, migration, edge-function, sync, delete-path, deferred-queue, pull-filter, pull-throttle, generation-isolation, lifecycle, notification, or active-car/weekend synchronization changes.
- Do not disable pinch zoom or regress focus, keyboard, accessibility, offline, or safe-area behavior.
- No package, native, Android, release, APK/AAB, credential, branch-ref, push, deploy, merge, production, `master`, or Sprint 4 IA work.

## Compressed QA contract

Read-only SOL Chunk A gate. Re-verify A1–A4 together at all four viewports under Standard and Large; test scale × density, reservation × reduced nav, and pressure-grid × 44px interactions; run focused mutations, regressions, one captured full suite, exact lint baseline, build, cumulative diff/scope/status, signed-out shell checks, and cavecrew review. No credentials or edits. PASS unlocks B1 through a later Ralph-only state commit; FAIL returns a bounded repair order to the offending A task.
