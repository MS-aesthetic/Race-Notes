# Current Task — UX Overhaul v2 Task C2 Session Snapshot Model and Diff Engine

**Status:** BUILD READY — exactly one Terra Extra High initial implementation pass; C3–C5 and Chunk D/E blocked
**Branch:** `codex/ux-overhaul`
**C1 dependency gate:** PASS 98 at `82e6acf`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 7, Part 5 Task C2, Part 6.1, and boundary statement 5.2
**Runtime:** builder must use explicit `gpt-5.6-terra` with `xhigh`; model metadata is authoritative, absent metadata records `unverified`.

## Permitted files — exact scope

Modify only:

- `src/types.ts`
- `src/lib/setupLifecycle.ts`
- `src/App.tsx`
- `scripts/chunk5-setup-harness.ts`

No other file is permitted. Commit code and harness together with a task-identifying C2 message. Leave `ralph/STATE.md` and `ralph/CURRENT_TASK.md` untouched during build.

## Required implementation

1. Add a typed, legacy-optional embedded `setupSnapshot` and `setupId` provenance to `SessionRecord`. Snapshot must be plain deep-copied data, not a live `Setup` reference. It must carry display identity plus tunable setup state needed for session comparison: corners, four-bar, pressures, gearing, and other persisted tune fields. Exclude attachments, lifecycle/lock metadata, stored `changeLog`, timestamps, and transient UI/provenance fields from diff meaning.
2. Add pure snapshot-capture and `diffSetupSnapshots` logic in `setupLifecycle.ts`. Diff must be deterministic, return zero rows for equal snapshots, cover top-level tune fields and all four corners, and ignore identity/lifecycle/UI-only noise. Do not mutate either input.
3. At the existing session-creation boundary in `App.tsx`, capture exactly one snapshot from the resolved event-owned `sessionSetup`, write that frozen value plus `setupId` into the new `SessionRecord`, and derive `setupUsed` from the same captured snapshot. No setup keeps the legacy-safe `No starting setup` fallback.
4. Remove `withSetupDiffLog` from the live `handleSaveSetups` hot path and its App import. An edit burst must append zero `SetupChange` entries. Keep `withSetupDiffLog` itself and all existing stored legacy `changeLog` bytes intact for read-only compatibility.
5. Preserve local-first setup writes, pressure propagation, Quick Adjust behavior, C1 editability, B1–B4 feedback truthfulness, car scoping, session IDs, and every existing session field. Snapshot data rides the existing `RaceWeekend.sessions` JSON payload through unchanged `weekendToCloudRow`/`weekendFromCloudRow`; no schema change.

## Acceptance

1. Creating a session captures snapshot bytes equal to current resolved setup state and stores matching `setupId` provenance.
2. Later edits to source setup, active setup, or a later session never mutate any existing session snapshot; no shared nested corner references remain.
3. Known before/after fixtures produce exact deterministic diff rows for top-level and corner changes; equal snapshots produce zero rows; transient/UI-only changes produce zero rows.
4. A multi-edit live-trackside burst appends zero `SetupChange` records while immediate local persistence and pressure propagation remain unchanged.
5. Legacy SessionRecords without snapshot/provenance remain valid. Existing legacy `changeLog` data remains byte-identical and readable; no migration or rewrite.
6. Existing sync mappers round-trip embedded snapshot/provenance without any `sync.ts`, SQL, schema, RLS, migration, or Supabase configuration change. If inspection proves a true schema change is required, stop and report; do not implement it.
7. No C3 session/pending-diff UI, C4 autosave boundary, C5 naming/pencil, or later-chunk behavior appears in the diff.

## Required validation

1. Expand `scripts/chunk5-setup-harness.ts` with snapshot capture, nested-reference immutability, post-capture source-edit immutability, exact diff fixture, equal/noise-zero diff, setupId/setupUsed creation binding, legacy compatibility, sync-payload round trip, and zero-append edit-burst assertions.
2. Add meaningful compile-real/source/model mutations for at least: shallow/live-reference capture, omitted snapshot or setupId binding, later-edit snapshot mutation, missed top-level/corner diff, and reintroduced `withSetupDiffLog` hot-path append. Each mutation must independently fail its claimed gate.
3. Run focused C2 harness plus lifecycle, C1 editability, Quick Adjust, B1–B4 notification/offline/resume, tire, touch-target, and confirmation regressions.
4. Run full 24-harness matrix. Exact accepted result remains 22/24; only unchanged `muted-text-color-harness.ts` AuthView byte lock and final `saved-flash-harness.ts` whole-App reconstruction byte lock may fail. Any other failure blocks completion.
5. `npm run lint` must match exact three-error baseline; `npm run build` must pass with expected current 566 modules unless the bundler gives a clearly explained module-count-only delta from the new typed helper.
6. Verify signed-out 360x800, 390x844, 412x915, and 1080x2118 shell remains overflow-free, >=44px, pinch-enabled, and console-clean. Do not create or use credentials. Snapshot behavior is proven with deterministic fixtures.
7. Verify exact four-file diff, `git diff --check`, protected paths, clean worktree after commit, and cavecrew reviewer.
8. Report commit SHA and exact evidence. Stop for independent SOL light QA; do not advance Ralph or begin C3.

## Exclusions and hard bans

No C3–C5, Chunk D/E, session diff/pending UI, `SetupView` UI change, Quick Adjust logic change, autosave boundaries, required-name flow, pencil/rename affordance, editability/historical-definition change, schema, RLS, migrations, Supabase configuration, `sync.ts`, CSS, NumberStepper, RaceWeekendView, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Preserve dual weekend-delete, team-owner canonical writes, deferred delete queue, UXN-1 filtering, UXN-3 pull behavior, local-only active IDs, pinch zoom, accessibility, safe areas, and all A1–C1 acceptance.
