# Current Task — UX Overhaul v2 Task C2.5 Setups Corner Alignment and Stacked Stepper

**Status:** READY FOR `gpt-5.6-sol` HIGH IMPLEMENTATION SUBAGENT — owner-priority task; C3 and all later work remain blocked.
**Branch:** `codex/ux-overhaul`
**C2 baseline:** product `253897a2518b3ed5f3148926e522163a9ea9d0b3` + EOL-only repair `13b556fc664b6fa75d9b82ca768319e303e6a03e`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` v2.1-C, v2.1-E, v2.1-F, Part 5 escalation rule, and Part 6 gates
**Runtime routing:** implementation must execute as `gpt-5.6-sol` **High**; primary QA/plan/state work executes as `gpt-5.6-sol` **Extra High**. Runtime metadata is authoritative; absent metadata is `unverified` and cannot satisfy the build role. Terra and `cavecrew-builder` are forbidden.

## Owner outcome

On Setups corner cards, paired LF/RF and LR/RR fields must align cleanly instead of drifting because text inputs and tall steppers have different structures. Every stacked stepper must show one full-width value row above one two-column button row:

```text
----- VALUE -----
(     −     ) (     +     )
```

The value remains tap-to-edit and includes its unit. The minus and plus buttons are equal width and each at least 44px tall. Inline steppers elsewhere must not change.

## Exact implementation scope

Change only:

1. `src/components/ui/NumberStepper.tsx`
2. `src/components/SetupView.tsx`
3. `src/components/TiresSubView.tsx`
4. `scripts/setup-touch-target-harness.ts`

No other file may change during implementation. If a different file is genuinely required, stop and return exact evidence for owner/QA scope approval.

## Build contract

1. Add `layout?: 'inline' | 'stacked'` to `NumberStepper`; default is `'inline'`.
2. Preserve the existing inline DOM, classes, tap-to-edit behavior, keyboard behavior, pointer slop cancellation, commit-on-pointerup behavior, and 350ms/100ms hold-repeat cadence.
3. In stacked layout only, render a full-width value region on row one and a two-column `[−][+]` button grid on row two. Value and both buttons are at least 44px tall; buttons split available width evenly. Keep current disabled behavior, accessible names, numeric formatting, unit rendering, and pointer handlers.
4. Remove the arbitrary-variant `role=group`/`basis-full` stacking selectors from `SetupView.tsx` and `TiresSubView.tsx`. Pass `layout="stacked"` at the intended corner/tire stepper call sites.
5. Align paired corner fields at row start. Give labels a consistent single-line footprint (truncate or equivalent reserved height) so adjacent controls begin at the same vertical position. Conditional pressure/legacy notes stay below their own control and must not move the neighboring control.
6. Keep all setup values, step sizes, min/max bounds, units, pressure provenance, persistence calls, Saved/sync notifications, setup lifecycle rules, and Quick Adjust behavior unchanged.
7. Extend `scripts/setup-touch-target-harness.ts` with compile-real/source/model coverage that proves:
   - stacked value appears above the button row;
   - stacked minus/plus buttons are equal-width and at least 44px;
   - default inline rendering remains unchanged;
   - SetupView and TiresSubView use the first-class stacked prop and contain no arbitrary-variant `basis-full` stacking selectors;
   - a mutation that restores old DOM order or removes the stacked layout binding fails.
8. Commit only after the focused harness, exact lint baseline, build, diff check, clean-scope check, and `cavecrew-reviewer` pass. Commit message must identify C2.5. Stop for primary QA; do not edit Ralph/plan/owner-report files.

## Independent QA gates

1. Diff is exactly the four authorized files; protected paths and later C3+ scope are absent; `git diff --check` and clean worktree pass.
2. `npx tsx scripts/setup-touch-target-harness.ts` passes, including one independently exercised layout mutation.
3. `npx tsx scripts/chunk5-setup-harness.ts`, `npx tsx scripts/chunk5-tires-harness.ts`, and the full raw 24-harness matrix pass at the established exact **22/24**, with failures only in unchanged `muted-text-color-harness.ts` and `saved-flash-harness.ts` stale locks.
4. `npm run lint` reports exactly the three known baseline errors. `npm run build` passes with 566 modules.
5. NumberStepper timing/pointer logic has zero semantic diff. Inline call sites retain their prior layout and interaction behavior.
6. Built-in browser visual QA at 360×800, 390×844, and 412×915 covers Default and Large scales. LF/RF and LR/RR controls row-align; stacked value is above side-by-side buttons; no clipping, overlap, or horizontal overflow; browser console has no warning/error.
7. Hold-repeat retains 350ms/100ms cadence; pointer movement, pointer cancel, and scroll over a stepper produce zero unintended writes.
8. Tires sub-view stacked pressure/backspacing controls match the Setups design.
9. Java 21 debug APK is built after `npx cap sync android`, installed to the running emulator, and visually checked. Debug only: no release/signing/`release/` change.
10. Independent `cavecrew-reviewer` reports no blocking finding. Primary records a strict PASS/FAIL score and updates Ralph, this plan, and `docs/OWNER_REPORT_UX_OVERHAUL.md`.

## Exclusions and hard bans

No C3–C5, Chunk D/E, session-diff UI, pending-change UI, setup lifecycle definition, Quick Adjust logic, autosave timing, Saved/sync arbiter, copy/naming/rename/editability behavior, schema, RLS, migration, Supabase configuration, native source, Android version/signing, release artifacts, package/config, credentials, production deploy, push, merge, or `master` change. Preserve all A1–C2 acceptance, dual-write behavior, team-owner writes, deferred deletes, offline/resume behavior, safe areas, pinch zoom, themes, and accessibility. Terra and `cavecrew-builder` remain forbidden.
