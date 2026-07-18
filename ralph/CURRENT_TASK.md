# Current Task — UX Overhaul v2 Task B3 SOL Repair After Re-QA FAIL 82

**Status:** REPAIR READY — owner approved exact callback-plumbing extension; SOL owns B3 repair; Terra permanently out; B4 blocked
**Branch:** `codex/ux-overhaul`
**Failed repair commit:** `5e660d9`
**Prior failure authority:** `8d1114e`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 10 including UXP-18 and UXN-3, Part 5 Task B3/Chunk B, Part 6.1, boundary statement 5.2, owner repair orders, and this pending scope decision
**Runtime:** model metadata unavailable; recorded `unverified`.

## Owner-approved scope extension

Maxx explicitly approved adding exactly:

- `src/components/SettingsView.tsx`
- `src/components/ExportView.tsx`

These two files may be used solely to thread App's typed sync-status failure callback through Settings into the actual `pullSharedData` production caller. No other behavior, UI, copy, state, export flow, or scope may change.

## Complete approved repair scope

Modify only:

- `src/App.tsx`
- `src/lib/sync.ts`
- `src/components/SettingsView.tsx` — callback forwarding only
- `src/components/ExportView.tsx` — callback forwarding into `pullSharedData` only
- `scripts/saved-flash-harness.ts`
- `scripts/offline-indicator-harness.ts` — assertion/proof modernization only

`src/lib/saveStatus.ts` remains deleted. No other file is permitted after this Ralph-only approval commit.

## Re-QA blockers requiring SOL repair

1. **Stale pull generation can publish terminal failure.** `reportPullFailure` mutates `pullReportedFailure` and global status before checking `isCurrentPull()`. Guard current generation before either mutation so superseded login/resume work cannot poison current identity.
2. **Acknowledgement can resurrect stale Saved.** Terminal `sync-error` or `deferred-delete-retrying` hides but does not clear pending `savedFlash` or its timer. Entering terminal failure must clear/cancel pending success before publishing failure; explicit close may clear terminal state but must never reveal prior Saved/Synced.
3. **Actual shared pull caller remains silent.** `pullSharedData` accepts an optional status callback, but sole production caller in `ExportView` omits it. Thread App's failure callback through `SettingsView` into `ExportView`, then pass it to `pullSharedData`. Successful shared pulls remain notification-silent.

## Required proof

Add compile-real production-source mutations with independent source, model, and rendered/route rejection:

1. Remove/bypass current-generation guard and prove stale pull failure cannot change current global status.
2. Preserve pending Saved on terminal entry and prove failure followed by explicit acknowledgement never reveals Saved/Synced, including acknowledgement before the 1500ms success timer expires.
3. Remove the real callback threaded through App, Settings, Export, and `pullSharedData`; prove actual production caller errors/catches publish terminal `sync-error` while successful shared pulls publish no success.
4. Preserve all accepted B3 proof: unchanged-array activation/pressure propagation, genuine no-op silence, error-only pull reporting, terminal precedence, four typed states, direct >=44px acknowledgement, B1/B2/A1–A4, safe areas, offline listener cleanup, and stale-lock provenance.

## Required gates

1. Focused B3 plus retained B1/B2 proof passes before unchanged saved-flash whole-App stale lock.
2. Full 24-harness matrix is exactly 22/24; only unchanged `muted-text-color-harness.ts` AuthView byte lock and `saved-flash-harness.ts` whole-App reconstruction lock may fail.
3. Relevant offline, pull-on-resume, touch target, delete/undo, confirmation, semantic status, tire, Quick Adjust, and A1–A4 regressions pass.
4. `npm run lint` matches exact three-error baseline; `npm run build` passes with 566 modules.
5. Signed-out 360x800, 390x844, 412x915, and 1080x2118 shell remains exact, overflow-free, >=44px, pinch-enabled, and console-clean. No credentials.
6. `git diff --check`, protected paths, exact approved scope, clean worktree, and cavecrew reviewer pass.
7. Commit code/harness separately from this Ralph-only commit. Stop for independent SOL QA. Do not mark B3 PASS or open B4.

## Hard bans

No B4, Chunk B advancement, Chunk C/D, schema, RLS, migrations, Supabase configuration, NumberStepper, SetupView, RaceWeekendView, CSS, types, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Settings/Export extension is callback plumbing only. Preserve payloads, query order, merge, throttle, generation, local writes, queue/delete/zero-row behavior, B1 interactions, B2 notification semantics, and A1–A4 layouts.
