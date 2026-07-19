# Current Task — UX Overhaul v2 Task D3 Car Cascade Delete

**Status:** ACTIVE after D2 QA attempt 2 PASS, 100/100. One `gpt-5.6-sol` HIGH implementation worker owns the isolated build. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. Chunk D QA and every later task remain blocked until D3 passes independent QA.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Accepted D2 base:** attempt-1 feature `803d5d0ae9cfc1a0b4d268d780d7d1a54f036ba9` plus structured-notice repair `e29c0f0822c1f00d30ad91613a35144d4f245075`. The exact clean D3 dispatch HEAD is the governance commit containing this work order and must be supplied by the primary.
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` item 12, Task D3, Parts 5.2 and 6.1, and the binding v2.1 Owner Addendum including the explicit four-product-file D3 scope correction.
**Routing:** worker must verify rollout metadata `turn_context.payload.model=gpt-5.6-sol`, `effort=high`, and exact 203f cwd before any edit or test. Missing metadata is unverified and cannot satisfy the gate. Terra at every tier and `cavecrew-builder` are forbidden.

## Objective

Make car deletion reachable and trustworthy. Garage must enumerate every car-scoped dependent record, require strong destructive confirmation, then remove the dependents and car through existing queue-plus-push mechanics. Preserve active selection, unrelated data, Race Days, embedded session setup snapshots, D1/D2 retry and anti-resurrection behavior, and honest B2/B3/C4 feedback.

## Binding data interpretation

For selected `carId`, the cascade owns exactly:

1. `Setup[]` rows where `setup.carId === carId` → shared table `setups`.
2. `TireInventoryItem[]` rows where `tire.carId === carId` → personal table `tire_inventory` through the existing personal tire queue.
3. `ShockSession[]` rows where `session.carId === carId` → shared table `shock_sessions`.
4. `MaintenanceComponent[]` rows where `component.scope === 'car' && component.carId === carId` → shared table `maintenance_components`.
5. `MaintenanceLog[]` rows whose `componentId` belongs to a removed car-scoped component → shared table `maintenance_logs`.
6. The selected `Car` → shared table `cars`, always last.

Rig/global maintenance, unrelated cars' records, todos, checklist data, accounting, shopping, trips, and other datasets are not cascaded.

Race Days are historical/global and must not be deleted. When a top-level Race Day setup pointer references a removed setup, clear only that dangling pointer and persist/push the updated weekend through the existing weekend path. Preserve the Race Day itself and every `sessions[]` byte exactly, including legacy fields, `setupId`, and detached `setupSnapshot`. Never mutate or regenerate embedded session snapshots. Surviving setups remain byte-identical except that a `sourceSetupId` pointing to a removed setup may be cleared if required to avoid a dangling lineage reference.

## ISOLATED scope

Any unrelated change is an automatic QA failure.

Authorized product files exactly:

1. `src/App.tsx` — D3 cascade enumeration/orchestration, minimum structured copy, active car/setup reassignment, existing Garage/Setup prop wiring, and no other behavior.
2. `src/components/GarageView.tsx` — dependency enumeration display, accessible destructive confirmation, cancel/in-flight guard, and delete entry point.
3. `src/components/SettingsView.tsx` — Garage prop transport only; no other Settings behavior.
4. `src/components/SetupView.tsx` — disabled setup-delete reason text and use of the existing `onGoToGarage` link only; lifecycle meaning and persistence stay unchanged.

Authorized assertion files exactly:

5. `scripts/car-delete-undo-harness.ts` — extend into production-bound cascade execution while retaining all current Undo/account/add/edit/clear/lifecycle assertions.
6. `scripts/confirm-sheet-harness.ts` — Garage confirmation contract only; retain all existing sheets and update exact count intentionally.
7. `scripts/saved-flash-harness.ts` — actual Nth queued-delete failure/status/zero-Saved proof only; retain all B1-B3/C4/D1/D2 assertions and mutations.
8. `scripts/chunk5-setup-harness.ts` — disabled reason plus Garage-link proof only; retain C1-C5 snapshot/lifecycle proof.

No other product, harness, Ralph, plan, report, native, package/config, schema, migration, RLS, release, or later-task file may change in the implementation commit.

Protected and read-only: `src/lib/sync.ts`, `src/lib/teamDataOwnership.ts`, `src/lib/setupLifecycle.ts`, `src/lib/resumePull.ts`, all shared/personal queue implementations and formats, replay effects, pull filters, D1 selected-ID proof, D2 clear flow, B2/B3 notification arbiter, 5-second retry, 30-second resume throttle, account/auth-generation guards, payload/mappers/merge, types/schema/RLS/migrations, native files, and Supabase configuration.

## Required UI behavior

1. Garage delete is no longer disabled merely because the car has scoped data.
2. Activating Delete opens a strong destructive confirmation; it never starts the cascade directly.
3. The sheet identifies the car and enumerates exact nonzero categories and counts in stable order: setups, tires, shock records, maintenance components, maintenance logs. Plurals must be accurate.
4. Copy states that the car and listed linked records will be permanently removed from this account/device and that historical Race Day session snapshots remain.
5. Confirm and Cancel remain at least 44px. Cancel performs zero state, storage, queue, push, dirty, selection, or notification writes.
6. While a cascade is in flight, a second submit is blocked.
7. A setup whose canonical `getSetupEditability(...).deletable` is false states the canonical reason in accessible text/title and offers a separate action that routes to Garage through existing `onGoToGarage`. Do not change the predicate or make historical/locked setups individually deletable.
8. Successful local cascade feedback is honest and structured. If any queued cloud delete fails later, retry/error status wins over and terminally suppresses Saved/Synced.

## Required cascade behavior

1. Resolve the selected car and all dependent IDs from the latest refs inside the delayed commit, not stale render arrays.
2. Preserve the accepted Undo slot. Garage confirmation requests the existing pending delete; Undo makes the car visible with zero writes. Timeout/dismiss/pagehide/unmount/forced next request commits once. Clear All cancels the pending car without committing. Account replacement cancels/blocks old-account writes exactly as today.
3. At commit, queue every removed shared ID with the existing account-scoped shared queue and call each matching existing push with the retained array and current canonical owner/team arguments.
4. Queue every removed personal tire ID with the existing account-scoped personal queue and call the existing tire push with the retained array.
5. Dependency order is setups, tires, shock sessions, maintenance logs, maintenance components, then cars last. Weekend pointer repair may persist before the car, but queues no weekend delete.
6. Persist retained arrays to React state/refs/localStorage using the existing keys. Do not call a save adapter that restores locked setups or arms an unrelated Saved path.
7. D3 must not mark C4 dirty or publish Saved for the cascade. Structured queued/success status may render; D1 retry/error must dominate if cloud deletion is not proven.
8. If deleting the active car, choose the first surviving car using accepted order. Update `activeCarIdRef`, React state, and `race_notes_active_car`. Select that replacement's latest setup. If no replacement or no setup exists, reset active setup safely to `INITIAL_SETUP` and remove stale `race_notes_setup`/active-car selection as appropriate. No deleted setup may remain active.
9. If deleting a non-active car, preserve active car and active setup bytes exactly.
10. Race Days and all session records survive byte-for-byte. Only dangling top-level setup IDs may be cleared; session `setupId`, `setupSnapshot`, `setupUsed`, notes, adjustments, and legacy fields are immutable.
11. Surviving rig/global maintenance, unrelated-car maintenance/logs, and every unrelated dataset remain byte-identical.
12. Queued removed IDs remain filtered from pulls before proven deletion. A zero-row/error/exception remains queued, retries at exactly 5,000ms, and cannot resurrect after resume.

No direct Supabase delete, new queue, new storage key, new delete primitive, schema/type/ownership expansion, per-record owner guess, or queue bypass.

## Required production-bound proof

The harness extension must compile/execute the real cascade and real confirmation/prop routes. Deterministic mocks only; no credential or live database. It must independently fail for at least:

1. Any dependency category is missing or counted incorrectly.
2. Confirmation is bypassed, Cancel writes anything, or double-submit invokes twice.
3. Any removed ID uses the wrong account/table/ID, misses its existing queue, or misses the matching push.
4. Car queue/push runs before any dependent category.
5. A personal tire uses shared queue semantics or the wrong account.
6. A car-scoped maintenance component or dependent log survives; a rig/global or unrelated-car component/log is deleted.
7. Delayed commit uses stale arrays, applies after account replacement, duplicates through lifecycle triggers, or breaks add/edit/Undo/Clear All behavior.
8. Active car or active setup points to removed data, replacement selection is wrong, or no-replacement reset leaves stale storage.
9. A non-active cascade changes current car/setup bytes.
10. A Race Day is deleted, any `sessions[]` byte changes, or any session `setupId`/`setupSnapshot` is removed/mutated.
11. A dangling top-level weekend/setup lineage pointer remains after its setup is removed, or an unrelated pointer changes.
12. An actual Nth queued-delete failure is treated as success, its intent is removed, retry timing changes, later push success overwrites terminal error, or Saved/Synced appears.
13. Disabled setup-delete reason is missing/wrong, Garage link is missing, or canonical editability semantics change.
14. Direct Supabase delete, new primitive/queue/key, sync/pull/filter/throttle/generation/lifecycle change, or later-task code appears.

Print total D3 assertions and unique mutation names/count. Retain every pre-D3 assertion and mutation in the four harnesses; no assertion removal or weakening.

## Builder gates before commit

1. Verify runtime metadata, exact branch, exact dispatch HEAD, ancestry through `e29c0f0`, `803d5d0`, `1ca3576`, and accepted Chunk C, plus clean tree before editing.
2. `git diff --name-status` and `git diff --check`; scope must be exactly the eight authorized files above. Every protected path has zero diff.
3. Run focused D1/D2/D3, car Undo, confirmation/status, team ownership, offline/resume, weekend delete, setup snapshot/lifecycle, Quick Adjust, tire, and touch-target regressions.
4. Run raw full 24-harness matrix. Expected result is exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing `15 !== 16`.
5. `npm run lint` must report exactly the three known baseline errors and no new error.
6. `npm run build` must succeed with exactly 566 transformed modules.
7. Obtain cavecrew-reviewer exact diff/protected-path review.
8. Create exactly one D3-identifying implementation commit containing only the eight authorized files. Do not edit Ralph/plan/report or begin Chunk D QA/E1.
9. Return exact runtime/rollout evidence, commit/parent, file list/diff, D3 assertions/mutations, focused/raw/lint/build evidence, protected audit, reviewer verdict, and final clean status. Stop. No live database, deploy, APK, push, PR, or merge.

## Independent QA gates

Primary Extra High QA independently re-verifies runtime/ref/clean/ancestry and audits every changed line. Rerun focused/raw/lint/build. Exercise in fixtures: empty cascade, every dependency category, active/non-active car, no replacement, replacement without setup, rig/global maintenance survival, Race Day/session snapshot byte survival, Undo/lifecycle/account replacement, zero-row/Nth failure, retry and resume anti-resurrection. Inspect draft at 360x800, 390x844, and 412x915 for exact enumeration, reason/link, confirmation/cancel, 44px targets, no overflow, themes/scales, and no console error. Build/install Java 21 debug APK and run a bounded synthetic car cascade; never use or recreate the D2 destructive account fixtures, which are intentionally cleared. Obtain independent cavecrew review and score strictly. Any finding transfers repair to SOL High; Terra is never dispatched.

## Hard bans

No Chunk D QA, Chunk E, final QA, or handoff work; no change to sync primitives, queue formats, replay, pull filters, retry/throttle/auth-generation/status priority, setup lifecycle meaning, D2 clear flow, schema/RLS/migrations/Supabase configuration, native source/version/signing/release, package/config, production Netlify publish, Git push, PR, merge, `master`, credentials, account/team/membership data, or another user's data. Preserve all A1-D2 acceptance, local-first persistence, account/team isolation, safe areas, pinch zoom, themes, accessibility, and the exact three-error lint baseline.
