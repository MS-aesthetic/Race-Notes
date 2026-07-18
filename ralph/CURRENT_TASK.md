# Current Task — UX Overhaul v2 Task B3 SOL Repair After QA FAIL 79

**Status:** REPAIR READY — SOL owns implementation and repair QA loop; Terra permanently out for B3; B4 blocked
**Branch:** `codex/ux-overhaul`
**Failed commit:** `95c0ceb`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 10 including UXP-18 and UXN-3, Part 5 Task B3/Chunk B, Part 6.1, boundary statement 5.2, and owner repair order
**Runtime:** SOL repair. Runtime identity must come from metadata; record `unverified` when unavailable.

## Exact repair scope

Modify only:

- `src/App.tsx`
- `src/lib/sync.ts`
- `scripts/saved-flash-harness.ts`
- `scripts/offline-indicator-harness.ts` — assertion/proof modernization only

`src/lib/saveStatus.ts` remains deleted. No other file is permitted after this Ralph-only authority commit.

## Required corrections

1. Separate setup-data persistence from active selection in `handleSaveSetups`:
   - unchanged setup bytes plus a different valid requested active ID must still activate that setup and retain existing pressure/tire/session propagation;
   - genuine blocked/reverted no-op returns with zero Saved/Synced and zero cloud write;
   - setup-array local/cloud writes occur only when setup bytes changed;
   - active-selection/session persistence and feedback remain truthful when selection actually changed.
2. Every Supabase pull query error response and catch must report typed `sync-error`. Successful pulls remain notification-silent. Preserve query payloads/order, merge behavior, 30-second throttle, generation isolation, local writes, queue contents/timing, delete queries, and zero-row meaning.
3. Route every automatic status transition through one terminal-preserving arbiter:
   - `sync-error` and `deferred-delete-retrying` survive later `synced`, `offline-saved`, `syncing`, and pull-completion transitions;
   - failure overrides prior Saved/success immediately;
   - only direct user acknowledgement clears a terminal state;
   - pull-origin successful pushes remain silent;
   - shared ~1500ms timeout applies only to success states.
4. Preserve exact failure copy `Sync failed — will retry`, honest offline copy, B2 info priority/no co-render/dedupe/top safe-area geometry/44px close, B1 pointer semantics, A1–A4 layout, local-first dual writes, deferred queues, and sync lifecycle behavior.

## Required proof

Extend permitted harnesses with compile-real production-source mutations plus source, model, and rendered rejection where applicable:

1. Unchanged-array activation with different active ID succeeds and propagates pressures; mutation that restores early return fails. Genuine blocked/reverted no-op remains silent.
2. Each pull helper error response and catch reports `sync-error`; successful pull/resume/hydration remains zero success. Mutations removing each real error callback fail independently.
3. Terminal sequences `sync-error` or `deferred-delete-retrying` followed by `synced`, `offline-saved`, `syncing`, and pull completion remain terminal until explicit close. Mutations bypassing arbiter fail.
4. Failure arriving during Saved immediately renders persistent error, never Saved/Synced.
5. All four typed states render exact truthful copy/treatment; only success auto-dismisses; errors expose direct >=44px acknowledgement and persist.
6. Retain B1/B2 source/model/rendered mutation proof, real header/toast/nav geometry, safe areas, overflow, Standard/Large and four viewport coverage, offline navigator event/listener cleanup, persistent chip, A1–A4, and stale-lock provenance.

## Required gates

1. Focused B3 plus retained B1/B2 proof passes before unchanged saved-flash whole-App stale lock.
2. Run all relevant A1–A4, B1/B2, tire, Quick Adjust, offline, pull-on-resume, semantic-status, delete/undo, confirmation, and notification regressions.
3. Full 24-harness matrix must be 22/24. Only unchanged `muted-text-color-harness.ts` AuthView byte lock and `saved-flash-harness.ts` post-B1/B2 whole-App reconstruction lock may fail.
4. `npm run lint` matches exact three-error baseline only. `npm run build` passes; 566 modules is explained by deleted `saveStatus.ts`.
5. Signed-out 360x800, 390x844, 412x915, and 1080x2118 shell: exact dimensions, no horizontal overflow, >=44px controls, pinch zoom enabled, zero console errors. Auth-gated signed-in views remain unauthorized without credentials.
6. `git diff --check`; exact four modified files with prior deletion retained; protected paths and Ralph files clean after repair commit.
7. Cavecrew reviewer must pass active-selection behavior, pull error coverage, terminal-state precedence, error-only sync drift, harness mutation strength, and scope.
8. Commit repair code plus harness only with B3-identifying message. Do not mark B3 PASS or open B4; stop for independent SOL QA.

## Hard bans

No B4, Chunk B QA advancement, Chunk C/D, schema, RLS, migrations, Supabase configuration, NumberStepper, SetupView, RaceWeekendView, CSS, types, other components/harnesses, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Do not alter dual-write data, setup lifecycle roles/history, delete/undo/cascade/zero-row behavior, retry queues, pull merge/throttle/generation lifecycle, B1 interactions, or B2/A1–A4 semantics.
