# Current Task — UX Overhaul v2 Chunk D Integrated QA

**Status:** ACTIVE mandatory read-only QA. D1, D2, and D3 are accepted individually; Chunk E remains blocked until this whole-chunk gate passes.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Accepted product history:** D1 `1ca35769253696a81eade02dcfd5b75cd156461f`; owner setup-label microfix `dc5c63d1e2e65e1c8475e1cc8b02d96074820c95`; D2 `803d5d0ae9cfc1a0b4d268d780d7d1a54f036ba9` plus `e29c0f0822c1f00d30ad91613a35144d4f245075`; D3 `120fa72632587c72ea1ab6122aff34cd9a393533` plus `a5e72d058289e6c9a7551bb3502dddc79e284c81`.
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md`, Chunk D, Parts 5.2 and 6.1, and the binding v2.1 Owner Addendum.
**Routing:** primary `gpt-5.6-sol` EXTRA HIGH owns QA and plan decisions. This gate is read-only and needs no implementation worker. Use cavecrew-reviewer for an independent cumulative review. Terra at every tier and `cavecrew-builder` are forbidden.

## Objective

Prove D1 zero-row detection, D2 clear-data trust, and D3 car cascade deletion work together without over-deletion, under-deletion, orphaning, resurrection, misleading Saved/Synced feedback, account leakage, or changes to accepted retry, pull-filter, lifecycle, setup-history, and ownership behavior.

Audit the cumulative accepted product range `9d9e4e138f8522921f28d7004f9b973b059baf7e..a5e72d058289e6c9a7551bb3502dddc79e284c81`. Intervening Ralph, plan, and owner-report commits are governance only. The owner-requested setup-label microfix is accepted and must remain isolated from deletion behavior.

## Required integrated proof

1. D1 reports success only for the exact selected deleted ID. Empty, missing, wrong-ID, error, and exception results retain the intent, schedule the exact 5,000ms retry, remain filtered from pulls, and suppress Saved/Synced.
2. D2 device-only clears local racing data with zero cloud deletion and honestly warns that shared data can return. Everywhere queues only the signed-in user's canonically owned shared rows plus personal tires; other team members' records are never targeted. Solo, unresolved-membership, signed-out, and account-replacement guards remain correct.
3. D3 enumerates setups, tires, shock sessions, car-scoped maintenance components, their logs, and the car; every removed ID uses the existing queue-plus-push pair in dependency order with the car last. A true Nth failure remains queued and wins status priority.
4. Active-car, non-active-car, last-car, replacement-without-setup, rig/global maintenance survival, unrelated-car survival, top-level weekend pointer repair, and setup-lineage repair remain correct.
5. Race Days and every embedded session byte survive, including setup ID, setup snapshot, setup-used text, notes, adjustments, and legacy fields.
6. Clear All cancels a pending car Undo without committing it. Undo, timeout, dismiss, pagehide, unmount, forced next request, account replacement, and double-submit behavior remain one-shot and account-safe.
7. Stable signed-out/offline car deletion completes local state/ref/localStorage changes and produces zero shared queue entries, tire queue entries, pushes, or null-owned intents.
8. Queued records cannot resurrect after resume pulls; the 30-second resume throttle, auth generation, owner/team isolation, and canonical pull filtering remain unchanged.
9. Setup cards retain the canonical disabled-delete reason and separate Garage route. Garage retains exact counts, strong confirmation, no-write Cancel, reachable Delete with linked records, and controls at least 44px.
10. The B2/B3/C4 notification arbiter remains truthful: terminal delete failure suppresses Saved/Synced; successful local actions use structured honest notices; no deletion path marks setup dirty.

## Exact QA gates

1. Verify runtime metadata, exact branch/worktree/ref/ancestry, and clean state before and after. Missing runtime metadata is unverified.
2. Audit cumulative name-status and every changed product line against the Chunk D scope and protected-path list. Outside named D1/D2/D3 footprints, sync/replay/pull/queue formats, ownership, lifecycle, schema/RLS/migrations, native, package, release, credentials, and Chunk E product paths must have zero diff.
3. Run the production-bound focused proofs. Required retained totals: D1 62 assertions/13 mutations; D2 143 assertions/29 mutations; D3 222 assertions/41 mutations. Also run ownership, offline, resume, Undo, confirmation, weekend-delete, setup lifecycle/snapshot, Quick Adjust, tire, touch-target, and semantic status regressions.
4. Run the raw full 24-harness matrix. Expected result is exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing `15 !== 16`.
5. `npm run lint` must report exactly the three known baseline errors and no new error. `npm run build` must succeed with exactly 566 transformed modules.
6. Reuse or repeat the exact accepted D3 candidate draft/APK evidence only when product bytes are unchanged: draft shell at 360x800, 390x844, and 412x915; Java 21 debug APK installed on the emulator; no overflow, undersized controls, console error, application crash, or resurrection. Any new live fixture must be bounded, synthetic, and removed afterward.
7. The authorized D2 account's owned racing data must remain cleared. Do not recreate the D2 destructive fixtures. Do not delete the account, authentication record, team, membership, or another user's data. Never store credentials.
8. Obtain cavecrew-reviewer cumulative diff/protected-path and behavior review. Score strictly PASS/FAIL with exact evidence and exact repair instructions if failed.

## Verdict handling

On PASS, update only `ralph/STATE.md`, `ralph/CURRENT_TASK.md`, `docs/UX_TECHNICAL_REVIEW_2026-07-17.md`, and `docs/OWNER_REPORT_UX_OVERHAUL.md`; review and commit those governance files; then open Task E1. On FAIL, record the exact isolated repair order and dispatch one `gpt-5.6-sol` HIGH worker. Terra must never be dispatched. No implementation begins inside the QA turn.

## Hard bans

During QA, no product or harness edit; no Chunk E implementation; no new delete primitive, queue, key, schema, RLS, migration, Supabase configuration, native source/version, package/config, release/signing, production Netlify publish, Git push, PR, merge, or `master` change. No credential persistence. Preserve all A1-D3 acceptance, local-first behavior, account/team isolation, safe areas, pinch zoom, themes, accessibility, and the exact three-error lint baseline.
