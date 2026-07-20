# Current Task — Final QA Repair 3: Setup-Deletion Relationship Integrity

**Status:** PLANNED, NOT STARTED. Owner requested documentation only; do not dispatch an implementation worker until a later explicit resume instruction.
**Final QA state:** attempt 3 FAIL, 82/100. Touch-target Repair 2 at `c897cfd406ff074ad1a06535bdc015bb7198bf89` passed its product/proof/runtime gates; final whole-branch review found two deletion-integrity blockers.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch branch/worktree.
**Roles when resumed:** one `gpt-5.6-sol` High implementation task; primary `gpt-5.6-sol` Extra High independently QAs. Terra at every tier and `cavecrew-builder` remain forbidden.
**Communication/delegation:** `/caveman full`; cavecrew investigator/reviewer contracts only.
**Detailed runbook:** `docs/UX_OVERHAUL_V2_AGENT_KNOWLEDGE.md`.

Final QA has three failed passes, but Part 6.3 scopes kickbacks to the offending
task. These are newly discovered reopened C1/D3 defects after earlier task PASS
verdicts, not three consecutive failed implementation attempts of either repair;
the direct-primary escalation has not triggered.

## Accepted state before Repair 3

- Touch-target Repair 2 commit `c897cfd` changes exactly `src/index.css` and `scripts/setup-touch-target-harness.ts`.
- Focused touch proof passes 52 global-floor assertions and kills 6/6 required mutations while retaining prior proof.
- Raw Windows harness matrix is exact 24/24.
- `npm run lint` reports only the exact three known baseline errors.
- `npm run build` transforms exactly 566 modules.
- Draft `6a5d5df113e70a34d7bf2539` passes signed-out 360×800, 390×844, 412×915, and 1080×2118 checks.
- Fresh debug APK is 12,087,764 bytes, SHA-256 `29E9A3A1CE0B51CA38759B6D7D1393C3352B46A61F315A361EDAE67A0E84F6A6`.
- Authenticated Android Default/Large page and form matrix has zero undersized targets or page overflow.
- Authorized device-only then everywhere deletion test passed; owned racing data remains cleared without old-data resurrection. Account, auth, team, and membership remain intact.
- Android 17/API 37 dev emulator WebView 150 has a reproducible system-library `onTrimMemory` SIGILL. Exact APK passes 3/3 lifecycle cycles on stable Android 15/WebView 124. No product repair is indicated for this runtime residual.

## Blocker 1 — active Race Day setup can be deleted

`src/lib/setupLifecycle.ts` currently returns `{ editable: false, deletable: true, reason: 'in-play-elsewhere' }` for the exact active Race Day setup. `SetupView` therefore sends a real deletion to `handleSaveSetups`. `src/App.tsx` removes/pushes the Setup only; the Race Day keeps `activeSetupId`. `resolveWeekendSetup` returns null and `handleCreateNewSession` stops before writing the next run.

Required lifecycle amendment:

- Exact active Race Day setup becomes non-editable and non-deletable while its Race Day is active.
- Unrelated Current setups remain editable/deletable.
- Do not create, clone, or bind a replacement automatically; that would change protected lifecycle meaning.

Generic cleanup for every other permitted setup deletion:

- Calculate removed Setup IDs once.
- Clear surviving Setup `sourceSetupId` only when it targets a removed ID.
- Clear only matching Race Day top-level `setupId`, `sourceSetupId`, `baselineSetupId`, `activeSetupId`, and `finalSetupId`.
- Stamp only changed surviving Setups and Race Days with one fresh ISO timestamp.
- Update canonical refs, React state, localStorage, and existing setup/weekend pushes with identical repaired arrays.
- Queue exact removed Setup IDs through existing delete machinery.
- Preserve every existing `sessions[]` byte.

## Blocker 2 — car cascade does not timestamp relationship repair

`src/App.tsx` car cascade clears surviving Setup lineage and Race Day top-level pointers without advancing `updatedAt`. `mergeTimestampedRecords` gives an equal-timestamp cloud record precedence. If the debounced push fails or races a pull, stale cloud rows can restore cleared pointers; strict no-resurrection/no-dangling acceptance fails.

Required repair:

- Create one cascade commit timestamp.
- Apply it only to surviving Setups whose `sourceSetupId` is cleared.
- Apply it only to Race Days whose top-level pointer is cleared.
- Preserve untouched Setup/Race Day objects and JSON bytes.
- Preserve Race Day `sessions[]`, session `setupId`, and embedded `setupSnapshot` byte-for-byte.
- If `race_notes_setup` represents the same repaired surviving Setup, update it to that repaired record; preserve unrelated active Setup bytes.
- Keep delete queue IDs/order, push ordering, retry/filter rules, statuses, ownership, and account capture unchanged.

## Exact repair scope

Edit only:

1. `src/lib/setupLifecycle.ts`
2. `src/App.tsx`
3. `scripts/chunk5-setup-harness.ts`
4. `scripts/car-delete-undo-harness.ts`

No `sync.ts`, component, type, native, package, config, schema, RLS, migration, Edge Function, release, or Sprint 4 file is authorized. If these four files cannot close the gate without broader semantics, stop with exact evidence.

## Required production-bound proof

`scripts/chunk5-setup-harness.ts` must compile/exercise the real editability and `handleSaveSetups` paths and prove:

- Exact active Race Day setup deletion attempt performs zero state/ref/localStorage/queue/push writes and no false Saved.
- Historical/locked/finished setup protections remain unchanged.
- Unrelated Current setup edit/delete behavior remains allowed.
- Permitted source deletion clears every required surviving lineage/top-level pointer, stamps only changed records, persists/pushes repaired setups/weekends, queues exact removed IDs, and preserves sessions.

`scripts/car-delete-undo-harness.ts` must execute the real cascade plus real timestamp merge and prove:

- Repaired local Setup/Race Day rows have one strictly newer ISO timestamp and beat captured stale cloud copies after a simulated push failure/pull.
- Untouched records remain exact bytes.
- Signed-out cascade followed by later sign-in/pull cannot restore stale pointers.
- Active setup cache changes only for the exact repaired saved twin.
- All existing delete categories, account ownership, queue/push order, Undo, no-replacement, mid-failure, terminal status, and session-history assertions remain.

Independent mutations must remove or corrupt at least: active-delete guard, each lineage/pointer repair class, Setup timestamp, Race Day timestamp, strict-newer timestamp, changed-only behavior, active-cache repair, ref/state/localStorage writes, weekend push, setup push, exact queue ID, and session preservation. Every mutation must fail behaviorally.

## Worker gates when implementation is later resumed

1. Verify runtime metadata: `gpt-5.6-sol`, effort `high`; absent metadata is unverified.
2. Verify exact 203f worktree, `codex/ux-overhaul`, expected base HEAD, and clean tree.
3. Run focused `chunk5-setup-harness.ts` and `car-delete-undo-harness.ts`; report exact assertions and mutation counts.
4. Run lifecycle, Quick Adjust, tire, Saved/status, offline/resume, clear-data, touch-target, and confirmation regressions.
5. Run all 24 harnesses in one raw Windows capture; exact 24/24 required.
6. `npm run lint`: exact three known errors only.
7. `npm run build`: exactly 566 transformed modules.
8. Verify exact four-file diff, `git diff --check`, protected paths, and clean post-commit tree.
9. Obtain cavecrew reviewer findings-first PASS.
10. Commit exactly the four authorized files with a task-identifying repair message.

## Independent QA and final closeout after repair

Primary reruns all gates, then the Part 6.3 whole-sprint matrix, fresh draft/browser matrix, fresh Java 21 debug APK, stable Android lifecycle/geometry/interactions, stale-cloud/no-resurrection fixtures, whole-branch boundary review, and clean-tree checks. Only a strict green result closes Final QA.

After PASS: produce Part 6.4 cold-reader handoff, update all governance/owner docs, commit final docs, deploy one final Netlify draft, build one final debug APK, and push `codex/ux-overhaul` as a saving point.

## Hard bans

No implementation dispatch during the current documentation-only request; no primary product edit before the plan's escalation rule; no Terra or cavecrew-builder; no credential storage/output; no new destructive live-data test without owner scope; no other-user/account/auth/team/membership deletion; no production Netlify publish; no signed/release APK/AAB or `release/` change; no native source/version; no package/config; no schema/RLS/migration/Edge Function; no PR, master merge/push, or Sprint 4 IA.
