# Current Task — UX Overhaul v2 Task D1 Zero-Row Delete Detection

**Status:** READY FOR one `gpt-5.6-sol` HIGH implementation subagent. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. Chunk C is accepted at 100/100. D2 and every later task remain blocked until D1 passes independent QA.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create another branch or worktree.
**Expected builder parent:** `5d553cc10e7537b908d6e3c1bc46c2169ad87393` (`docs: close Chunk C and issue D1 work order`). The worker must verify exact HEAD and a clean tree before editing.
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Task D1, Part 5.2, Part 6.1, and the binding v2.1 Owner Addendum.
**Routing:** implementation worker must verify runtime `turn_context.payload.model=gpt-5.6-sol` and `effort=high` from rollout metadata before editing. Missing metadata is unverified and cannot satisfy the gate. Terra at every tier and `cavecrew-builder` are forbidden.

## Objective

Make a shared cloud delete succeed only when Supabase proves that at least one matching row was deleted. A delete that returns no API error but affects zero rows is a failure: the existing account-scoped intent remains queued, the existing replay loop retries it, and B3's typed status renderer reports an honest error/retrying state. Never report success for a zero-row delete and never allow the next pull to resurrect locally deleted data because the intent was discarded early.

## ISOLATED scope

This is the first named protected-path exception. Any unrelated change is an automatic QA failure.

Authorized product footprint only:

1. `src/lib/sync.ts` — only `deleteTeamSharedRecordFromCloud` (currently around lines 24-43): request the deleted row id with `.select('id')`, reject zero returned rows, keep existing exception/error behavior, and preserve the boolean contract.
2. `src/App.tsx` — only the existing shared-delete replay decision around the `deleteTeamSharedRecordFromCloud` call and `removePendingTeamDelete` branch (currently around lines 893-930), and only if a source change is necessary to preserve the queued intent/retrying status. Do not rewrite the effect, queue, timer, auth-generation guards, or status arbiter.

Authorized test footprint only:

3. `scripts/saved-flash-harness.ts` — add production-bound zero-row proof and independent mutations. Retain every existing B1-B3/C4 assertion and mutation.

No other product, harness, documentation, Ralph, native, package/config, schema, migration, RLS, edge-function, release, or credential file may change in the implementation commit. No assertion may be removed or weakened. Standing owner approval covers only assertion-only EOL portability if genuinely required; it does not broaden D1 product scope.

## Required behavior

1. The Supabase chain remains the same table-scoped exact-id delete, extended with `.select('id')` so affected rows are observable.
2. API error or thrown exception still calls the existing `sync-error` status path and returns `false`.
3. A successful response with an empty/missing returned-row set is treated as failure: return `false`, publish honest failure status, and do not claim success.
4. A response containing the requested deleted row id returns `true` without changing payload, owner, table, or queue semantics.
5. The replay loop removes an intent only on `true`. Zero-row/error/exception results keep the exact account-scoped intent queued, set or retain `deferred-delete-retrying`, and schedule the existing 5-second replay without duplicate timers or generation drift.
6. Success, failure, acknowledgement, and later Saved behavior continue through B2/B3/C4 arbitration. Failure must never render Saved or Synced and acknowledgement must not discard the queued intent.
7. Existing dual weekend-delete behavior, solo-only discard rule, team-owner canonical writes, deferred queue format/key, auth-generation cancellation, 30-second pull throttle, UXN-1 filtering, sync payloads/mappers, and local-first writes remain byte/behavior equivalent outside the exact D1 footprint.
8. No database policy or live data mutation is authorized. Use deterministic mocked/compiled production proof for RLS-style zero-row behavior.

## Required harness proof

The D1 extension must compile or execute the real changed helper/replay slice and fail independently for at least:

1. `.select('id')` removed.
2. Empty returned rows treated as success.
3. Missing returned data treated as success.
4. API error or exception treated as success.
5. Zero-row intent removed from the queue.
6. Zero-row result fails to reach `sync-error`/`deferred-delete-retrying` truthfully.
7. Retry scheduling removed or changed from the existing 5,000ms behavior.
8. Success row incorrectly retained/retried.
9. Auth-account/generation cancellation guard weakened.
10. A terminal delete failure allows Saved/Synced to overwrite or resurrect.

Prove normal success, zero-row, API-error, exception, queued retry, eventual success, clean acknowledgement, and next-pull fixture behavior. Mutation names/counts must be printed. Synthetic-only or source-string-only proof is insufficient.

## Builder gates before commit

1. Verify runtime, exact branch, exact pinned parent, and clean tree before edit.
2. Show `git diff --name-status` and `git diff --check`; scope must be only the authorized files and line regions.
3. Run the focused D1 Saved/deferred-delete harness plus offline/resume, team ownership, confirmation/status, weekend delete, and current C1-C5 setup/lifecycle/Quick Adjust regressions.
4. Run the raw full 24-harness matrix. Expected result remains exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing. Any other failure blocks commit.
5. `npm run lint` must report exactly the three known baseline errors and no new error.
6. `npm run build` must succeed with exactly 566 transformed modules.
7. Commit implementation plus harness together once with a D1-identifying message. Do not update Ralph/plan/owner report; primary owns QA governance.
8. Return exact commit/parent, file list, diff summary, focused/raw/lint/build results, mutation count/names, and runtime metadata. Stop. Do not begin D2.

## Independent QA gates

Primary Extra High QA must independently re-verify runtime/ref/clean/ancestry, audit every changed line against the isolated exception, rerun focused/raw/lint/build, inspect the explicit Crew Chief draft shell at 360x800, 390x844, and 412x915, build/install only a Java 21 debug APK, and exercise deterministic zero-row/queued-retry/eventual-success/status-priority scenarios. Obtain a cavecrew-reviewer diff/protected-path review. Score strictly. Any finding transfers repair to a SOL High implementation worker; Terra is never dispatched.

## Hard bans

No D2/D3/Chunk E work; no new delete primitive; no queue format/key or ownership rule change; no payload/mapper/merge/throttle/filter change; no sync success semantics outside the exact shared-delete helper; no schema/RLS/migration/Supabase configuration; no native source/version/signing/release; no production Netlify publish; no Git push; no merge; no `master` change; no credentials. Preserve all A1-C5 and Chunk C acceptance, local-first persistence, account/team isolation, safe areas, pinch zoom, themes, accessibility, and the exact three-error lint baseline.
