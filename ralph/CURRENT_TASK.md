# Current Task — UX Overhaul v2 Task D2 Clear-All-Data Trust Fix

**Status:** REPAIR REQUIRED after D2 QA attempt 1 FAIL, 92/100. One `gpt-5.6-sol` HIGH implementation worker owns the bounded repair. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. D3 and every later task remain blocked until D2 passes independent QA.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**D2 attempt 1 candidate:** `803d5d0ae9cfc1a0b4d268d780d7d1a54f036ba9` (`fix: make clear racing data team-aware (D2)`) on parent `444fb4307ff6349c4cd074a8fac4581f8f1e146b`. Its data paths, dialog, isolated scope, automated gates, build, and reviewer checks pass, but it is not accepted because live device-only feedback is false. The exact clean repair dispatch HEAD is the governance commit containing this failure record and must be supplied by the primary.
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` item 11b, Task D2, Part 5.2, Part 6.1, and the binding v2.1 Owner Addendum.
**Routing:** the implementation worker must verify runtime `turn_context.payload.model=gpt-5.6-sol` and `effort=high` from rollout metadata before any edit or test. Missing metadata is unverified and cannot satisfy the gate. Terra at every tier and `cavecrew-builder` are forbidden.

## Objective

Make Clear Racing Data tell the truth for a resolved team account. The owner must choose between clearing only this device, which queues no cloud delete and warns that shared data will return on sync, and deleting the signed-in user's owned records everywhere, which uses the existing deferred-delete plus push pairing and never targets another person's canonical team data. Preserve the existing signed-out, solo, and team-unresolved flow exactly.

## QA attempt 1 failure and exact repair

On draft `6a5c21695715094ce135f7b4`, the authorized resolved-team device-only scenario did clear all local racing data and a reload re-downloaded the owner fixtures exactly as intended. The post-action toast was nevertheless **That action could not be completed.** Root cause: `handleClearAllData` passes the new success string through `showComponentInfo()`, while `componentInfoNotice()` does not recognize either D2 success string and routes it to the existing `operation-failed` fallback.

Repair only this trust failure:

1. In `src/App.tsx`, add the minimum two dedicated `INFO_COPY` reasons for the resolved-team device-only and everywhere results, and publish them with structured `showInfo(...)` notices from `handleClearAllData`.
2. Exact device-only result text remains **Device data cleared. Shared team data will re-download on next sync.** Exact everywhere result text remains **Your records are queued for deletion. Team records you do not own remain in cloud.** Neither result may route through `componentInfoNotice()` or `operation-failed`.
3. Preserve the attempt-1 dialog, choice order, mode wiring, queue/push/ownership behavior, local wipe, legacy signed-out/solo/unresolved branch, and every protected file byte-for-byte.
4. Extend only `scripts/saved-flash-harness.ts` to compile/execute the real structured info-copy route and fail independently if either result falls back to `operation-failed`, either exact result string changes, or either dedicated reason is removed. Retain all 123 D2 assertions, 23 mutations, D1 62/13, and B1-B3/C4 proof; append new assertions/mutations without weakening anything.
5. Repair commit scope is exactly `src/App.tsx` and `scripts/saved-flash-harness.ts`. `src/components/SettingsView.tsx` must have zero repair diff because its attempt-1 UI already passes.

## Owner-authorized destructive QA account

The owner supplied a dedicated Crew Chief account in the task thread and authorizes the primary QA agent to use it for D2 deletion testing. This authorization is narrow and binding:

1. The SOL High implementation worker and every harness use deterministic mocks only. No credential and no live account data may enter a worker prompt, repository file, report, commit, test fixture, screenshot, or command output.
2. During independent D2 QA, the primary may clear racing data owned by the supplied account through the draft/debug product flow. The primary must not delete the account, team, membership, another user's data, Supabase schema, or authentication records.
3. Run device-only first and prove that owned cloud data can re-download. Run the everywhere choice last and leave the supplied account's owned racing data cleared after the final verification pull.
4. Member/non-owner, malformed-owner, solo, unresolved, zero-row, retry, and anti-resurrection cases remain deterministic fixture tests unless they can be exercised without changing another person or team membership.
5. The credential remains only in the owner-controlled task context. Never copy or echo it into durable project or QA evidence.

## Ownership rule — binding interpretation

The authorized client model does not retain a per-row `user_id` on the nine shared local datasets. Under the accepted `teamDataOwnership` contract, shared data belongs to the canonical team owner resolved by `resolveSyncOwnerId`. Therefore:

1. For a resolved team, the signed-in user owns the shared local set only when `syncOwnerId === user.id`.
2. A resolved non-owner member, a missing owner, or `syncOwnerId === null` owns zero shared local rows. Never guess ownership and never queue those rows.
3. Tire inventory is personal and account-scoped, so the signed-in user owns the local tire rows.
4. `active_sessions`, saved trips, accounting, shopping, and other non-whitelisted data do not gain a new cloud-delete primitive in D2.
5. `src/lib/teamDataOwnership.ts` is read-only. Any per-record ownership metadata, new primitive, or schema/type expansion is out of scope.

## ISOLATED scope

D2 is the second named protected-path exception. Any unrelated change is an automatic QA failure.

Authorized product footprint only:

1. `src/App.tsx` — attempt-1 scope remains only `handleClearAllData`, the minimum callback/type data needed for its two team choices, and the exact `SettingsView` prop wiring. Repair attempt 2 additionally permits only the two minimum structured `INFO_COPY` entries required by the failure section above.
2. `src/components/SettingsView.tsx` — only the Clear Racing Data prop contract, `clearStep` state if needed, and the existing Danger Zone clear-data dialog (current lines about 168-203).

Authorized assertion footprint only:

3. `scripts/saved-flash-harness.ts` — extend the existing production-bound clear handler proof for D2 while retaining every B1-B3/C4/D1 assertion and mutation.

No other product, harness, Ralph, plan, owner-report, native, package/config, schema, migration, RLS, edge-function, release, credential, or later-task file may change in the implementation commit. `src/lib/teamDataOwnership.ts`, `src/lib/sync.ts`, `src/lib/resumePull.ts`, the shared/personal queue implementations, replay effect, pull filter, status arbiter, and D1 proof are protected and read-only. No assertion may be removed or weakened.

## Required UI behavior

1. Only a signed-in account with resolved membership and a real team gets the new two-option choice.
2. The first action is labeled exactly **Clear this device only**. Its dialog copy must include the exact warning **shared team data will re-download on next sync**.
3. The second action is labeled exactly **Delete my records everywhere**. One plain sentence must state that team records the user does not own remain in the cloud.
4. For a non-owner team member, the everywhere copy must not imply shared team records will be deleted; it deletes only account-owned personal records such as tires.
5. Cancel remains available. Each visible action remains at least 44px. While clearing, the choice cannot be submitted a second time.
6. Signed-out, resolved-solo, and team-unresolved users keep the existing single confirmation and behavior. Do not expose the team choice early while ownership is unresolved.

## Required data behavior

1. **Device only:** clear the same 17 local keys and the same in-memory datasets/selections as today. Queue zero shared deletes, queue zero personal-tire deletes, make zero cloud push/delete calls, and publish honest copy that cloud/team data remains and may return on sync.
2. **Everywhere, canonical team owner:** for each local ID in all nine `TEAM_SHARED_SYNC_TABLES`, queue exactly one normal account-scoped intent with `soloOnly=false`, and invoke the corresponding existing empty-dataset push with the resolved canonical owner/team arguments. Queue every personal tire ID for the signed-in account and use the existing tire push/replay path. Then perform the same local wipe.
3. **Everywhere, resolved non-owner or missing canonical owner:** queue zero shared intents and make zero shared pushes. Queue only the signed-in account's personal tire IDs and use the existing tire path. Then perform the same local wipe. Copy must say non-owned team records remain.
4. Existing signed-out/solo/unresolved behavior is byte- and behavior-equivalent: signed-out is local-only; solo/unresolved keeps provisional `soloOnly=true` shared intents plus personal tire intents and the existing resolution rules.
5. Preserve `carUndo.undo()` before storage/state clearing, all 17 local keys, every current state/ref reset, one C4 dirty mark, active selections, and the existing notification priority.
6. D1 remains authoritative: zero-row/error/exception replay failures remain queued, retry at exactly 5,000ms, never render Saved/Synced, and queued owned IDs remain filtered from a pull so they cannot resurrect before proven deletion.
7. Reuse `queueSharedCloudDelete`, `enqueuePendingPersonalTireDelete`, existing push helpers, and the existing replay. No direct Supabase delete, no new queue, no new storage key, and no new delete primitive.

## Required harness proof

The D2 extension must compile or execute the real clear handler and bind the real Settings choice wiring. It must use deterministic mocks only and fail independently for at least:

1. Device-only queues any shared ID.
2. Device-only queues any personal tire ID or calls any cloud push/delete path.
3. Device-only warning is missing or no longer says shared team data re-downloads on next sync.
4. A resolved member/missing-owner everywhere action queues a non-owned shared ID or invokes a shared push.
5. A canonical owner everywhere action omits any ID or any of the nine exact shared tables.
6. An owner everywhere intent uses `soloOnly=true`, the wrong account, table, or ID.
7. An owned shared dataset loses its existing queue-plus-push pairing or uses the wrong owner/team argument.
8. Personal tires are omitted from the everywhere path or attributed to the wrong account.
9. The two labels/copy or callback modes are removed, swapped, or miswired.
10. Signed-out, solo, or unresolved behavior changes.
11. `carUndo.undo()` moves after storage clearing, any current local key/state reset is lost, or the C4 dirty boundary is duplicated/removed.
12. An owned queued fixture resurrects during the next-pull/resume filter.
13. Direct Supabase deletion, a new queue/key/primitive, or any change to the D1 helper/replay/filter/status contract appears.
14. A choice can submit twice while its first clear is in flight.
15. Either resolved-team success result routes through `componentInfoNotice()`/`operation-failed`, loses its dedicated structured reason, or changes its exact success text.

Print D2 assertion count and unique mutation names/count. Retain and rerun all existing B1-B3/C4/D1 proof. Synthetic-only or source-string-only ownership proof is insufficient.

## Builder gates before commit

1. Verify runtime metadata, exact branch, exact repair dispatch HEAD, ancestry through D2 attempt-1 candidate `803d5d0`, accepted pre-D2 base `dc5c63d`, and D1 base `1ca3576`, and a clean tree before editing.
2. Show `git diff --name-status` and `git diff --check`; repair scope must be exactly `src/App.tsx` and `scripts/saved-flash-harness.ts`. `SettingsView.tsx` and every protected path have zero repair diff.
3. Run focused Saved/D1/D2, team ownership, car-delete/clear, confirmation/status, offline/resume, weekend-delete, and current C1-C5 setup/lifecycle/Quick Adjust/tire/touch regressions.
4. Run the raw full 24-harness matrix. Expected result remains exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing `15 !== 16`. Any other failure blocks commit.
5. `npm run lint` must report exactly the three known baseline errors and no new error.
6. `npm run build` must succeed with exactly 566 transformed modules.
7. Commit implementation plus harness once with a D2-identifying message. Do not update Ralph, plan, owner report, or begin D3.
8. Return exact runtime/rollout evidence, commit/parent, file list/diff, focused/raw/lint/build results, mutation count/names, protected-path audit, and final clean status. Stop. No push, deploy, PR, merge, or live database.

## Independent QA gates

Primary Extra High QA must independently re-verify runtime/ref/clean/ancestry, audit every changed line against this isolated exception, rerun focused/raw/lint/build, and exercise signed-out, solo, unresolved, team-owner device-only, team-owner everywhere, member device-only, member everywhere, zero-row retry, and resume anti-resurrection fixtures. Inspect the explicit Crew Chief draft at 360x800, 390x844, and 412x915, including both team choices/copy and 44px targets. Build/install only a Java 21 debug APK. Use the owner-authorized account only under the narrow destructive-QA rules above: prove device-only re-download first, then perform everywhere deletion last and leave the account's owned racing data cleared. Obtain a cavecrew-reviewer diff/protected-path review and score strictly. Any finding transfers repair to a SOL High implementation worker; Terra is never dispatched.

## Hard bans

No D3/Chunk E work; no new delete primitive, queue, key, ownership metadata, direct Supabase delete, or per-record owner guess; no change to `teamDataOwnership.ts`, D1 helper, replay, 5-second timer, account/auth-generation guards, queue format, 30-second resume throttle, UXN-1 filtering, payload/mappers/merge, schema/RLS/migrations/Supabase configuration, native source/version/signing/release, package/config, production Netlify publish, Git push, PR, merge, `master`, or credentials. Preserve all A1-D1 acceptance, local-first persistence, account/team isolation, safe areas, pinch zoom, themes, accessibility, and the exact three-error lint baseline.
