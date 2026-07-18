# Current Task — UX Overhaul v2 Task B3 SOL Repair After Final QA FAIL 90

**Status:** REPAIR READY — SOL owns narrow attempt-3 repair; Terra permanently out; B4 blocked
**Branch:** `codex/ux-overhaul`
**Failed repair commit:** `efe534c8b06a821f4d529f692da9f1210cb85dd7`
**Owner scope authority:** `87c96db`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 10 including UXP-18 and UXN-3, Part 5 Task B3/Chunk B, Part 6.1, boundary statement 5.2, owner repair orders, and this repair order
**Runtime:** model metadata not exposed; record `unverified`.

## Owner-approved scope extension

Maxx explicitly approved adding exactly:

- `src/components/SettingsView.tsx`
- `src/components/ExportView.tsx`

These two files may be used solely to thread App's typed sync-status failure callback through Settings into the actual `pullSharedData` production caller. No other behavior, UI, copy, state, export flow, or scope may change.

## Narrow repair scope

Modify only:

- `src/App.tsx`
- `src/components/ExportView.tsx` — shared-pull callback lifecycle/current-user guard only
- `scripts/saved-flash-harness.ts`
- `scripts/offline-indicator-harness.ts` — assertion/proof modernization only

Other approved B3 files (`src/lib/sync.ts`, `src/components/SettingsView.tsx`) remain unchanged unless essential to these two repairs. `src/lib/saveStatus.ts` remains deleted. No other file is permitted.

## Final-QA blockers requiring SOL repair

1. **Later Saved can survive terminal status.** Entering `sync-error` or `deferred-delete-retrying` clears current Saved state/timer, but later `flashSaved()` calls still arm hidden Saved while terminal status persists. Explicit acknowledgement then reveals stale Saved until its timer expires. While either terminal status persists, `flashSaved()` must not arm Saved; terminal entry still clears/cancels pending success; acknowledgement must reveal no prior or later Saved/Synced.
2. **Shared-pull callback can publish from stale Export work.** `ExportView` passes App's status callback directly into asynchronous `pullSharedData` without effect cleanup or current-user guard. Unmounted or superseded-user work can publish terminal error into current identity. Wrap callback with effect-scoped cleanup and captured/current user identity validation. Successful shared pulls remain silent.

## Required proof

Add compile-real production-source mutations with independent source, model, and rendered/route rejection:

1. Seed compile-real production mutation that permits `flashSaved()` during terminal status. Model/render baseline `failure -> later online/offline local save -> acknowledgement` as zero Saved/Synced; mutation must arm and reveal Saved, and independently fail source, model, and rendered gates.
2. Seed compile-real production mutation that removes/bypasses Export effect cleanup/current-user guard. Model stale shared-pull rejection after unmount and user switch; mutation must publish terminal error and independently fail source, model, and route/rendered gates.
3. Preserve accepted B3 proof: unchanged-array activation/pressure propagation, genuine no-op silence, every pull query/catch failure, current-generation rejection, error-only shared-pull reporting, terminal precedence, four typed states, direct >=44px acknowledgement, B1/B2/A1–A4, safe areas, offline listener cleanup, and stale-lock provenance.

## Required gates

1. Focused B3 plus retained B1/B2 proof passes before unchanged saved-flash whole-App stale lock.
2. Full 24-harness matrix is exactly 22/24; only unchanged `muted-text-color-harness.ts` AuthView byte lock and `saved-flash-harness.ts` whole-App reconstruction lock may fail.
3. Relevant offline, pull-on-resume, touch target, delete/undo, confirmation, semantic status, tire, Quick Adjust, and A1–A4 regressions pass.
4. `npm run lint` matches exact three-error baseline; `npm run build` passes with 566 modules.
5. Signed-out 360x800, 390x844, 412x915, and 1080x2118 shell remains exact, overflow-free, >=44px, pinch-enabled, and console-clean. No credentials.
6. `git diff --check`, protected paths, exact approved scope, clean worktree, and cavecrew reviewer pass.
7. Commit code/harness separately from Ralph-only FAIL record. Stop for independent SOL QA. Do not mark B3 PASS or open B4.

## Hard bans

No B4, Chunk B advancement, Chunk C/D, schema, RLS, migrations, Supabase configuration, NumberStepper, SetupView, RaceWeekendView, Settings behavior, CSS, types, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Preserve successful-pull silence, payloads, query order, merge, throttle, generation, local writes, queue/delete/zero-row behavior, B1 interactions, B2 notification semantics, and A1–A4 layouts.
