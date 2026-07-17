# Current Task — UX Overhaul v2 A4: App-Wide Density and Whitespace Pass

**Status:** READY — Terra initial build, attempt 1
**Branch:** `codex/ux-overhaul`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 2, Part 5 Task A4, Part 6.1, and boundary statement 5.2
**Runtime model:** Verify from `turn_context.payload.model` before work; if unavailable, report `unverified`.

## Builder role

Work as Terra initial builder. Read `AGENTS.md`, `.agents/skills/caveman/SKILL.md`, `.agents/skills/cavecrew/SKILL.md`, this file, `ralph/STATE.md`, Part 2 item 2, Part 5 Task A4, Part 6.1, and boundary statement 5.2 before editing. Use `/caveman full`; use cavecrew for delegated work.

Implement only Task A4. Land feature code and both harness updates together in one task-identifying commit. Do not self-certify, run Chunk A QA, or advance Ralph state; SOL light QA owns verdict and state advancement.

## Authorized files only

- `src/App.tsx` — header and bottom-nav density only.
- `src/components/ContextStrip.tsx` — chip/control density only.
- `src/components/SetupView.tsx` — shared input floor, phone-first corner grid, and mechanical padding/gap/label density only.
- `src/index.css` — bottom-nav height/active-scale and shared `.tap-target` floor only; safe-area/system-inset rules remain untouched.
- `src/components/FourBarQuickAdjust.tsx` — real compact stepper layout and mechanical density only.
- `src/components/RaceWeekendView.tsx` — freeform input floors and mechanical card/padding/gap/label density only.
- `src/components/GarageView.tsx` — padding/gap/label tier-down only.
- `src/components/TiresSubView.tsx` — padding/gap/label tier-down only.
- `src/components/TrackersView.tsx` — padding/gap/label tier-down only.
- `src/components/SettingsView.tsx` — padding/gap/label tier-down only.
- `src/components/DashboardView.tsx` — padding/gap/label tier-down only.
- `scripts/setup-touch-target-harness.ts` — replace remaining byte-diff locks with A4 behavioral touch-floor/corner-grid/density assertions; preserve A3 behavior locks.
- `scripts/chunk5-setup-harness.ts` — A4 phone-grid/density assertions and current-baseline compatibility only; preserve A2 reservation and all unrelated behavioral coverage.

Any edit outside these thirteen files, or outside named surfaces within them, fails scope.

## Required change

1. Apply control-floor equalization at Standard 1.0: shared interactive floors `48px` to `44px` (`min-h-12` to `min-h-11`) for SetupView shared inputs, header controls, and ContextStrip chips; change `.tap-target` from `3rem` to `2.75rem`.
2. Raise RaceWeekendView freeform inputs lacking a floor to at least `44px`; do not shrink racing-data values.
3. Remove active bottom-nav `scale-105`; make header/nav heights follow the 44px control floor. Use header `py-2` rather than `py-3`; preserve existing nav routing, active state, accessibility, and A2 bottom clearance.
4. Make SetupView corner forms phone-first with two columns at `min-[360px]`; preserve field order, handlers, computed values, locks, and lifecycle behavior.
5. Make `FourBarQuickAdjust` compact behavior real: three usable columns at normal portrait widths, label-inline single-row steppers, and ± targets at least 44px. Preserve adjustment math, values, handlers, help, focus, keyboard, and Quick Adjust semantics.
6. Apply mechanical container density across every authorized view: card/container `p-4` to `p-3`; inner grouping `p-3` to `p-2`; list rows/chips lose one vertical-padding tier. Do not reduce an interactive control below 44px or alter safe-area/system-inset padding.
7. Apply mechanical gap density: sibling-card `gap-4`/`space-y-4` to `gap-3`/`space-y-3`; intra-card `gap-3` to `gap-2`; Setup corner and pressure-grid gutters remain `gap-2`.
8. Apply label typography tier-down only: `text-base` labels to `text-sm`; eligible `text-sm` section/field labels to `text-xs` with tracking retained and `leading-tight` for multiline labels. No text below Tailwind `text-xs`; body and racing-data/value text stay at least `text-sm`.
9. Keep tier-down changes mechanical and presentation-only. No record creation, mutation, persistence, sync, navigation, lifecycle, deletion, or notification behavior changes.
10. Rewrite only necessary harness locks into behavioral assertions: interactive controls meet computed ≥44px floor at Standard 1.0; Setup corner form yields two columns at ≥360px effective width; compact FourBar yields three usable columns; A1 scale, A2 reservation, A3 pressure-grid and frozen NumberStepper behavior remain locked.

## Acceptance

- Standard 1.0 is materially denser while remaining readable and operable; Large remains usable.
- At `360×800`, `390×844`, `412×915`, and `1080×2118`, under both Standard/Default and Large, every affected surface has no clip, overlap, or horizontal overflow.
- SetupView shows two usable corner columns at normal portrait widths; FourBar Quick Adjust shows three usable columns.
- All interactive targets remain at least 44px; Race Weekend freeform inputs reach that floor.
- No text falls below `text-xs`; body and racing-data/value text remain at least `text-sm`.
- Header/nav/ContextStrip are denser; active nav no longer scales; routing, focus, keyboard, accessibility names, safe-area behavior, and pinch-zoom remain unchanged.
- A2 Save Run/nav reservation and A3 pressure-grid separation remain intact at every named viewport and scale.
- No application behavior or data bytes change from presentation-only A4 work.

## Required verification

1. Run `scripts/setup-touch-target-harness.ts` and `scripts/chunk5-setup-harness.ts`; both must PASS.
2. Mutation-check each new behavioral assertion category once using in-memory fixtures or temporary non-committed mutations: 44px floor, two-column Setup grid, three-column FourBar layout, and typography floor. Restore and rerun focused harnesses PASS; commit no mutation artifact.
3. Run full harness suite in one captured run per Part 6.1. Do not weaken or rewrite unrelated assertions to manufacture green results. Any unrelated stale byte-lock failure is evidence only and may not expand A4 scope.
4. Inspect every affected UI surface at all four named viewports under Standard/Default and Large, beginning at 360×800 Standard. Exercise scroll extremes, focus, keyboard, nav, ContextStrip, Setup corners, FourBar, Race Day freeform inputs/pressure controls/Save Run, Garage, Tires, Trackers, Settings, and Dashboard. If signed-in state lacks authorized credentials, do not create or use credentials; disclose exact visual limitation for SOL QA.
5. Run `npm run lint`; result must match exact known three-error baseline, with zero new errors.
6. Run `npm run build`; it must PASS.
7. Run `git diff --check`, `git status --short`, and inspect `git diff 4618ce3..HEAD` plus working diff. A4 commit must contain only thirteen authorized files and only A4 presentation+harness work.
8. Run focused A1 scale, A2 reservation, A3 pressure/NumberStepper, Quick Adjust, focus/keyboard, tire, and offline regressions available in current harnesses.
9. Use cavecrew reviewer on final A4 diff, with explicit audit of mechanical-only scope, target/text floors, safe-area preservation, and unchanged handlers/data behavior.
10. Commit once with an A4-identifying message. Report commit SHA and concise evidence for focused and full harnesses, mutation proofs, exact lint baseline, build, viewport matrix or authorization caveat, regressions, review, diff check, scope, and status.

## Hard boundaries

- No files outside thirteen authorized files; no Ralph edits by builder.
- No A1 theme migration changes, A2 reservation/sticky-bar behavior changes, A3 pressure-grid or NumberStepper timing/pointer/`touch-action`/repeat/click/commit changes, B1 scroll-safe stepper work, or any later task.
- No setup lifecycle/editability/role/history/immutability changes; no per-press logging, session snapshots, autosave, toast/status, help relocation, naming, or Add-X copy work.
- No schema, RLS, migrations, edge functions, sync behavior, or cloud payload changes.
- No deletion behavior, dual weekend-delete changes, team-owner canonical-write changes, account-scoped deferred-delete queue changes, UXN-1 pull-filtering changes, or protected delete-path work.
- No UXN-3 pull-on-resume throttle or generation-isolation changes.
- Do not sync `activeCarId` or `activeWeekendId`; both remain localStorage-only.
- Do not disable pinch-zoom or regress focus, keyboard, accessibility, safe-area, or offline behavior.
- No package, native, Android, release, APK/AAB, credential, branch-ref, push, deploy, merge, production, or `master` work.
- Do not begin Sprint 4 IA work.
- Stop after one A4 code+harness commit and handoff to SOL light QA. Do not run Chunk A QA or begin B1.

## Compressed builder contract

Patch only authorized A4 presentation surfaces plus two harnesses. Equalize 44px controls, raise Race Day freeform inputs, remove active-nav scaling, produce two Setup columns and three compact FourBar columns, mechanically reduce padding/gaps/labels with `text-xs` chrome and `text-sm` body/value floors. Preserve A1–A3, all handlers/data bytes, focus/keyboard/safe-area/pinch-zoom, and protected paths. Verify focused+full harnesses, mutation proofs, four viewports × two scales when authorized, exact lint baseline, build, regressions, cavecrew review, diff/status; commit once. No Ralph/schema/sync/delete/throttle/generation/lifecycle/notification/native/release/branch/push/deploy/merge/B1/Sprint-4 work.
