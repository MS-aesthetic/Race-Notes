# Current Task — UX Overhaul v2 Task C4 Autosave Feedback Commit Boundaries

**Status:** READY FOR `gpt-5.6-sol` HIGH IMPLEMENTATION. C3 is accepted at 100/100; C5 and all later work remain blocked.
**Branch:** `codex/ux-overhaul`
**Accepted product baseline:** C3 commit `e8d70165ca7600e3b47d597e444fc953e6624fc7` on accepted C2/C2.5 history
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` item 8, Task C4, v2.1 Owner Addendum, Part 5 escalation rule, and Part 6 gates
**Runtime routing:** implementation must execute as `gpt-5.6-sol` **High** in a separate worker task; primary QA/plan/state work executes as `gpt-5.6-sol` **Extra High**. Runtime `turn_context.payload.model` and effort are authoritative. Missing runtime metadata is `unverified` and cannot satisfy the build role. Terra at every tier and `cavecrew-builder` are forbidden.

## Owner outcome

Keep the app local-first and lossless while stopping Saved from flashing on every press or keystroke. Every real mutation must still update React state and localStorage immediately. The visible Saved confirmation becomes one honest acknowledgement at a commit boundary: leave the current app tab/view, background or hide the app, reach 30 seconds while dirty, or create the next run. A clean boundary produces nothing.

## Authorized scope

May change only:

1. `src/App.tsx`
2. `src/components/SetupView.tsx` — only if a narrowly scoped view-unmount boundary callback is genuinely required
3. `src/components/RaceWeekendView.tsx` — only if a narrowly scoped view-unmount boundary callback is genuinely required
4. `scripts/saved-flash-harness.ts`

Prefer the smallest product scope. If App can own tab/view boundaries without component edits, leave both components unchanged. `src/lib/sync.ts`, `src/lib/quickAdjust.ts`, `src/lib/setupLifecycle.ts`, `src/lib/setupDiff.ts`, `src/types.ts`, all schemas/migrations, NumberStepper, notification copy/layout, package/config, native, and C5+ paths are verify-only with zero diff. If another file is genuinely required, stop with exact evidence for primary/owner approval.

## Canonical semantics

1. State and localStorage persistence remain immediate, synchronous, and in the same successful mutation handlers as today. C4 changes feedback timing only. It must not debounce, batch, defer, or remove a local write.
2. A successful user mutation marks Saved feedback dirty only after its final direct localStorage write. Blocked, reverted, zero-row, selection-only, hydration, reconciliation, pull, resume, undo-preview, and other non-persistence paths stay clean.
3. A dirty commit boundary consumes the dirty state and requests exactly one Saved confirmation through the accepted B2/B3 notification arbiter. Repeated events from the same background transition, such as `visibilitychange` followed by `pagehide`, must not double-notify.
4. A clean boundary emits zero Saved confirmations. After a flush, another Saved requires a new successful mutation.
5. Boundaries are:
   - leaving the current bottom app tab/view, including component unmount caused by that navigation;
   - document `visibilitychange` to hidden;
   - `pagehide`;
   - native Capacitor app transition to inactive when available;
   - a periodic 30,000ms interval while dirty;
   - successful session creation, after its snapshot and local weekend/session writes complete.
6. Timer, visibility, pagehide, and native listeners must be registered once, cleaned up exactly once, and never leak or capture stale dirty state.
7. B2/B3 priority remains authoritative. Info or terminal sync/error state can suppress the boundary Saved. Consuming that dirty boundary must not let acknowledgement later resurrect a stale Saved.
8. Cloud push cadence, sync callbacks, pull generation, offline copy, deferred deletes, error persistence, and success timing remain unchanged. `sync.ts` has zero diff.
9. C1–C3 behavior remains unchanged: editability, snapshots, pending/bound diffs, Quick Adjust coalescing, session creation data, notes, pressure propagation, Saved/no-false-Saved guards, and navigation.
10. Simulated process death before any feedback boundary must still lose zero data because the preceding localStorage writes already happened.

## Build contract

1. Replace immediate ordinary `flashSaved()` calls with one explicit dirty-marking path, preserving existing optional notification suppression on background helpers.
2. Add one boundary flush path that atomically checks/clears dirty state before calling the existing `flashSaved()` arbiter entry point.
3. Centralize bottom-tab/view change detection; do not scatter new navigation wrappers across every call site unless evidence proves necessary.
4. Session creation is an explicit boundary and flushes once only after the newly bound snapshot/session is persisted locally.
5. Backgrounding must be reliable on web and Capacitor without changing the existing resume-pull behavior.
6. Keep the accepted top notification slot, copy, 1500ms success lifetime, info dedupe, terminal precedence, offline wording, and close behavior unchanged.
7. Do not add visible UI, settings, persistent dirty flags, localStorage keys, schema fields, sync writes, or analytics.

## Mutation-complete harness contract

Rewrite the stale C4 portion of `scripts/saved-flash-harness.ts`; retain and pass its accepted B1/B2/B3 coverage. Normalize CRLF/LF source reads. Remove obsolete whole-App reconstruction/parent byte locks. Bind behavioral proof to real changed production slices and independently prove:

1. An N-edit burst performs N immediate local writes and zero Saved notifications before a boundary.
2. The next tab/view boundary emits exactly one Saved; a clean second boundary emits zero.
3. Hidden visibility, pagehide, native inactive, and 30,000ms dirty timer each flush exactly once; paired background events coalesce.
4. Successful session creation persists its snapshot/session before one flush. Removing or moving this boundary before persistence fails.
5. Simulated process death mid-burst retains every persisted edit despite zero prior Saved feedback.
6. Blocked, reverted, zero-row, selection-only, hydration, reconciliation, pull, and resume paths remain zero-dirty/zero-Saved.
7. Info and terminal status suppress boundary Saved without later acknowledgement resurrection.
8. Listener/timer cleanup, exact 30,000ms cadence, dirty reset, and re-arm after a later edit are executable, mutation-killed behavior.
9. Mutations that restore immediate `flashSaved`, mark dirty before persistence, omit any boundary, double-flush paired events, fail to clear dirty, alter timer cadence, rewire cloud push timing, or weaken B2/B3 priority independently fail.
10. Print assertion count and killed mutation list. Synthetic models without real production binding are insufficient.

## Worker gates before commit

1. `npx tsx scripts/saved-flash-harness.ts`
2. `npx tsx scripts/chunk5-setup-harness.ts`
3. `npx tsx scripts/chunk6b-lifecycle-harness.ts`
4. `npx tsx scripts/chunk7-quick-adjust-harness.ts`
5. `npx tsx scripts/offline-indicator-harness.ts`
6. `npx tsx scripts/pull-on-resume-harness.ts`
7. `npx tsx scripts/setup-touch-target-harness.ts`
8. Raw full 24-harness matrix is exactly **23/24**, with the only failure the unchanged `muted-text-color-harness.ts` stale AuthView lock. `saved-flash-harness.ts` must now pass and may not be waived.
9. `npm run lint` reports exactly the three known baseline errors and no new error.
10. `npm run build` succeeds with exactly 566 transformed modules.
11. `git diff --check`, exact scope/protected-path audit, and clean post-commit worktree pass.
12. Independent `cavecrew-reviewer` reports no blocking finding.

Commit exactly the authorized product/harness files with a C4-identifying message. Stop for primary QA. Do not edit Ralph, the technical plan, the owner report, native files, release files, or Git history beyond that one commit. Do not deploy, push, merge, or begin C5.

## Independent primary QA gates

1. Verify runtime model/effort, exact parent/head, branch, scope, protected paths, diff check, and clean tree.
2. Inspect every changed line and independently exercise all canonical boundary, persistence, arbiter, and harness mutations above.
3. Run focused C4 plus notification, offline/resume, C1–C3 setup/lifecycle/snapshot/Quick Adjust, tire, touch, and delete/status regressions. Raw matrix must be exact 23/24 with only the named muted-text lock.
4. Lint must be the exact three-error baseline; build must be exactly 566 modules.
5. Prove immediate local persistence with zero pre-boundary Saved, then one Saved at each independently isolated dirty boundary and zero on clean/repeated boundaries. Prove process-death data retention.
6. Deploy a correct-site Netlify draft and inspect the signed-out shell at 360×800, 390×844, and 412×915. Inspect authenticated editing at required mobile sizes/themes/scales: no per-press flash, one boundary flash, no overflow, controls at least 44px, viewport meta intact, no product console warning/error.
7. Run `npx cap sync android`, build a Java 21 debug APK only, install to the running emulator, and verify edit → immediate relaunch persistence before feedback plus background/tab/session/timer boundaries. No release build, signing, native source edit, or production deploy.
8. Obtain independent `cavecrew-reviewer` scope/diff/behavior review. Record strict PASS/FAIL score in Ralph, keep this plan current, and update `docs/OWNER_REPORT_UX_OVERHAUL.md` in full plain English.

## Exclusions and hard bans

No C5, Chunk D/E, setup naming/rename, lifecycle/editability meaning, snapshot/data-model changes, Quick Adjust logic, session diff UI changes, notification layout/copy redesign, sync timing/payload/merge/throttle changes, schema/RLS/migration/Supabase configuration, native source, Android version/signing, release artifacts, package/config, credentials, production deploy, Git push, merge, or `master` change. Preserve all A1–C3 acceptance, dual-write behavior, team-owner writes, deferred deletes, offline/resume behavior, safe areas, pinch zoom, themes, and accessibility. Terra and `cavecrew-builder` remain forbidden.
