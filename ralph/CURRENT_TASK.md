# Current Task — UX Overhaul v2 Task C3 Session Diff UI and Quick Adjust Coexistence

**Status:** READY FOR `gpt-5.6-sol` HIGH IMPLEMENTATION. C2.5 is accepted at 100/100; C4 and all later work remain blocked.
**Branch:** `codex/ux-overhaul`
**Accepted product baseline:** C2 `253897a2518b3ed5f3148926e522163a9ea9d0b3` + portability repair `13b556fc664b6fa75d9b82ca768319e303e6a03e`; C2.5 feature `8ab870aa88d8158301368389da37020b758e8fbc` + repair `2235c7d4fcabc4c527709d744ea0760fdfc38eb1`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` item 7, Task C3, v2.1 Owner Addendum, Part 5 escalation rule, and Part 6 gates
**Runtime routing:** implementation must execute as `gpt-5.6-sol` **High** in a separate worker task; primary QA/plan/state work executes as `gpt-5.6-sol` **Extra High**. Runtime `turn_context.payload.model` and effort are authoritative. Missing runtime metadata is `unverified` and cannot satisfy the build role. Terra at every tier and `cavecrew-builder` are forbidden.

## Owner outcome

Replace the noisy per-press setup history with two computed, honest views:

1. Setups shows current changes since the latest frozen session snapshot as **Pending — will bind to next session**.
2. Each session shows a compact read-only setup difference bound to that session.

The owner scenario is canonical: Starting Setup → Hot Laps snapshot → edits and/or Quick Adjust → Qualifying snapshot. Before Qualifying, pending must describe the same net change that becomes Qualifying's bound diff after Qualifying is created. Quick Adjust keeps its existing one-net-row-per-field in-run view; the new session summary must not append, persist, or duplicate those rows.

## Exact implementation scope

Change only:

1. `src/components/SetupView.tsx`
2. `src/components/RaceWeekendView.tsx`
3. `src/App.tsx` — Setups navigation callback/wiring only; no session creation, Quick Adjust, lifecycle, Saved, sync, or persistence logic change
4. `scripts/chunk5-setup-harness.ts`

`src/lib/quickAdjust.ts`, `src/lib/setupLifecycle.ts`, `src/lib/setupDiff.ts`, `src/types.ts`, `src/lib/sync.ts`, schemas, and migrations are verify-only and must have zero diff. If another file is genuinely required, stop and return exact evidence for primary/owner scope approval.

## Canonical diff semantics

1. `weekend.sessions` is newest-first. For the session at index `i`, compare the immediately older frozen session at `i + 1` to session `i`.
2. For the chronologically first session, compare the weekend Starting Setup identified by `baselineSetupId` to that session's snapshot. Capture the current referenced Setup as plain data with the existing canonical snapshot helper; do not compare mutable Setup objects directly.
3. Pending compares the newest frozen session snapshot at index `0` to a freshly captured snapshot of the live setup selected for the same active Race Day. If no session exists, compare the weekend Starting Setup snapshot to the current live setup.
4. Require honest provenance: use snapshots and setup ids from the same Race Day/setup lineage. Do not silently compare unrelated setups.
5. Use the accepted deterministic `diffSetupSnapshots` output and its field order. Before/after operands must never be reversed. Zero-difference results show a compact honest empty state, not invented changes.
6. Legacy sessions without `setupSnapshot` or weekends without a resolvable Starting Setup must show an honest unavailable state. Never reconstruct frozen history from a mutable saved setup.
7. Computed pending and bound diffs are display-only. Never write them to a session, Setup `changeLog`, localStorage, cloud payload, or schema.

## Build contract

1. In `SetupView.tsx`, replace the visible `Live-Trackside Changes` presentation with a compact pending section labeled exactly **Pending — will bind to next session**. It must show deterministic current-vs-last-snapshot rows, omit zero/noise rows, and use the existing active Race Day setup provenance.
2. Preserve all existing stored non-run `changeLog` bytes and expose them read-only under a collapsed **Legacy log** disclosure. Do not migrate, delete, append, reorder, or reinterpret old entries.
3. Do not repeat Quick Adjust `runId` rows in the pending or legacy presentation. Existing Quick Adjust rows remain where the Runs UI already renders `SessionRecord.adjustments`.
4. In `RaceWeekendView.tsx`, add a compact read-only bound setup-difference summary to each session. Qualifying in the owner fixture must show exactly the net changes from Hot Laps to the Qualifying snapshot. The first session uses the Starting Setup baseline. Keep the free-text notes section and all existing adjustment rows unchanged.
5. Remove or replace the stale session comparison path that resolves mutable saved setups for historical diff display. No session history may be inferred from a setup's current state.
6. Add one button labeled exactly **Log setup changes** on the sessions page. Through a narrowly scoped callback in `App.tsx`, it navigates to the existing Setups tab and its Setups subtab, with the active setup expanded when the existing state allows it.
7. C1 editability is protected. The navigation button is a review/navigation affordance and does not override `getSetupEditability`, change `activeEventSetupId`, rebind a setup, or make an in-play setup editable. If implementation appears to require any lifecycle/editability change, stop and report the plan conflict; do not modify C1 behavior.
8. Keep `src/lib/quickAdjust.ts` and `handleCommitQuickAdjust` semantically and textually unchanged. Add no logging call. Preserve coalescing by `runId + corner + field`, original `before`, final `after`, persistence, Saved, offline, and sync behavior.
9. Preserve C2 snapshot capture, `setupSnapshot`, `setupId`, `setupUsed`, session creation, deep-copy behavior, sync roundtrip, and deterministic diff helper unchanged.
10. Keep the sessions page uncluttered: compact labels/rows, readable at 360px, no new modal or persistent state, and no hidden overflow.

## Mutation-complete harness contract

Extend `scripts/chunk5-setup-harness.ts` using real changed production code. EOL-sensitive source matching must remain CRLF/LF agnostic. The gate must independently prove:

1. Owner fixture: Starting Setup → Hot Laps snapshot → setup edit and Quick Adjust net change → Qualifying snapshot.
2. Pending before Qualifying equals Qualifying's bound diff after session creation, with the same deterministic rows, values, order, and provenance.
3. Newest-first binding uses index `i + 1`; a mutation using the oldest session or reversing operands fails.
4. First-session comparison uses `baselineSetupId`; mutations using `lifecycleSetupId`, active/current setup, or an unrelated setup fail.
5. Legacy missing-snapshot/baseline cases return honest unavailable states and never reconstruct history from mutable setups.
6. Equal snapshots yield no false rows. Transient, identity, lifecycle, media, and noise fields remain excluded.
7. Pending meaning, Setups navigation wiring, compact session bound summary, Legacy log disclosure, free-text notes, and existing Quick Adjust rows are bound to the compiled/real changed code.
8. Removing the pending view, bound summary, Log setup changes navigation, legacy disclosure, notes, or Quick Adjust rows independently fails.
9. Adding any per-press/session-diff persistence or logging rewire independently fails.
10. Assertion count and killed mutation list are printed. Source-only locks without executable production binding are insufficient.

## Worker gates before commit

1. `npx tsx scripts/chunk5-setup-harness.ts`
2. `npx tsx scripts/chunk6b-lifecycle-harness.ts`
3. `npx tsx scripts/chunk7-quick-adjust-harness.ts`
4. `npx tsx scripts/offline-indicator-harness.ts`
5. `npx tsx scripts/pull-on-resume-harness.ts`
6. Raw full 24-harness matrix is exactly **22/24**, with failures only in unchanged `muted-text-color-harness.ts` and `saved-flash-harness.ts` stale whole-file locks.
7. `npm run lint` reports exactly the three known baseline errors and no new error.
8. `npm run build` succeeds with exactly 566 transformed modules.
9. `git diff --check`, exact scope/protected-path audit, and clean post-commit worktree pass.
10. Independent `cavecrew-reviewer` reports no blocking finding.

Commit exactly the authorized product/harness files with a C3-identifying message. Stop for primary QA. Do not edit Ralph, the technical plan, the owner report, native files, release files, or Git history beyond that one commit. Do not deploy, push, merge, or begin C4.

## Independent primary QA gates

1. Verify runtime model/effort, exact parent/head, branch, scope, protected paths, diff check, and clean tree.
2. Inspect every changed line and independently exercise all canonical semantics and harness mutations above.
3. Run focused C3, lifecycle, Quick Adjust, offline/resume, tire, touch-target, and session regressions; raw matrix must remain exact 22/24 with only the two named stale locks.
4. Lint must be the exact three-error baseline; build must be 566 modules.
5. Verify the owner fixture end-to-end and prove pending-before equals bound-after while Quick Adjust shows one net row and no duplicate/persisted session row.
6. Deploy a Netlify draft preview to the explicit Crew Chief site and inspect the signed-out shell at 360×800, 390×844, and 412×915. Then inspect authenticated Setups/Runs UI at required mobile sizes, themes, and Default/Large scales: no overflow, compact summaries, notes preserved, controls at least 44px, viewport meta intact, no product console warning/error.
7. Run `npx cap sync android`, build a Java 21 debug APK only, install to the running emulator, and inspect the owner scenario. No release build, signing, native source edit, or production deploy.
8. Obtain independent `cavecrew-reviewer` scope/diff/behavior review. Record strict PASS/FAIL score in Ralph, keep this plan current, and update `docs/OWNER_REPORT_UX_OVERHAUL.md` in full plain English.

## Exclusions and hard bans

No C4/C5, Chunk D/E, autosave timing, Saved/sync arbiter, setup naming/rename changes, lifecycle/editability meaning, snapshot/data-model changes, Quick Adjust logic, session creation logic, schema/RLS/migration/Supabase configuration, native source, Android version/signing, release artifacts, package/config, credentials, production deploy, Git push, merge, or `master` change. Preserve all A1–C2.5 acceptance, dual-write behavior, team-owner writes, deferred deletes, offline/resume behavior, safe areas, pinch zoom, themes, and accessibility. Terra and `cavecrew-builder` remain forbidden.
