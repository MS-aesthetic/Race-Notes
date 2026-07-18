# Current Task — UX Overhaul v2 Task B3: Honest Status Feedback

**Status:** READY — owner-approved narrow harness extension recorded; exactly one Terra High initial build; stop for independent SOL QA
**Branch:** `codex/ux-overhaul`
**Dependency gate:** B1 and B2 complete; final B2 independent SOL QA PASS 98 at `546ffa5`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 10 including UXP-18 and UXN-3, Part 5 Task B3/Chunk B, Part 6.1, and boundary statement 5.2
**Runtime:** Terra High initial builder. Any QA failure transfers repair ownership to SOL; Terra is not re-invoked.

## Exact scope

Modify only:

- `src/App.tsx`
- `src/lib/sync.ts`
- `src/lib/saveStatus.ts` — delete this obsolete module; keep any still-required online-state behavior inside the permitted files without semantic drift
- `scripts/saved-flash-harness.ts`
- `scripts/offline-indicator-harness.ts` — assertion-only modernization so existing offline/online proof follows the relocated typed sync-status hook after `src/lib/saveStatus.ts` deletion

No other file is permitted.

## Required implementation

1. Finish UXP-18 at the bounded save path: call `flashSaved()` only when the user mutation actually persisted. A blocked or reverted `handleSaveSetups` branch must return with zero Saved/Synced notification.
2. Replace string-whitelist status handling with one typed, truthful four-outcome renderer through the completed B2 top notification arbiter:
   - synced;
   - offline-saved;
   - deferred-delete-retrying;
   - sync-error.
3. Use exact failure copy `Sync failed — will retry`. Failed cloud writes or deletes must never show Saved or Synced. Offline local persistence must remain honestly identified as offline-saved. Existing deferred-delete state must remain a passive retry warning.
4. Success status auto-dismiss remains the B2 shared approximately 1500ms lifetime. Deferred-retry and sync-error states persist until explicit acknowledgement. Preserve B2 keyed-copy dedupe, info-over-Saved priority, safe-area top pill geometry, 44px direct close, and no co-render.
5. In `src/lib/sync.ts`, make only the minimum typed status/error-callback changes needed for push-helper failure reporting. Audit every changed helper line. Do not change write payloads, success criteria, retry behavior, delete queries, zero-row meaning, queue contents, queue timing, or pull merge/throttle behavior.
6. Delete dead `src/lib/saveStatus.ts`. Preserve its still-live online/offline observation behavior by relocating only what is necessary within the permitted files; do not recreate the dead reporting abstraction.
7. UXN-3 is frozen: cloud pulls, resume pulls, and hydration never enqueue a success notification. Preserve the 30-second pull throttle and all lifecycle meaning.
8. Preserve local-first dual writes, honest offline Saved behavior, B1 pointer state machine, B2 arbiter behavior, and every A1–A4 layout/accessibility guarantee. Do not implement C4 dirty-boundary autosave or D1/D2/D3 delete semantics early.
9. Owner-approved scope extension is harness-only: update `scripts/offline-indicator-harness.ts` solely to import/extract the relocated online-status implementation and assert the new typed status renderer. It may not change product behavior, weaken offline/header/toast assertions, waive failures, or become a third stale lock.

## Harness acceptance

Extend `scripts/saved-flash-harness.ts` with production-source, model, and rendered proof. All seeds must mutate real permitted production source and independently fail the relevant gates.

1. Blocked/reverted save mutation: zero Saved and zero Synced.
2. Persisted local offline mutation: exactly one truthful offline-saved status, never Synced.
3. Push failure and failed-delete reporting: persistent `Sync failed — will retry`, never Saved/Synced.
4. Deferred delete: persistent deferred-retry warning, never success.
5. Actual push success: synced outcome uses the shared approximately 1500ms success timer.
6. Pull, resume pull, hydration, scroll start, pointer movement, and pointercancel: zero success notifications.
7. Mutations must cover at least: reintroducing flash on the blocked branch, removing a real push-helper error callback/report, changing sync-error to success, auto-dismissing an error, and making a pull enqueue success. Each advertised fault must compile where applicable, occur behaviorally, and be rejected.
8. Retain all B1/B2 priority, co-render, dedupe, shared-timer, real header/toast/nav geometry, safe-area, 44px close, overflow, viewport/scale, A1–A4, and stale-lock provenance proof.
9. Modernized offline-indicator proof must pass against the deleted-module replacement, retain live navigator event/listener cleanup checks, retain persistent offline-chip checks, and verify all four typed status states plus success-only dismissal and persistent error acknowledgement.

## Required gates

1. Focused B3 plus retained B1/B2 harness proof must PASS before the unchanged saved-flash stale whole-App lock.
2. Run A1–A4, tire, Quick Adjust, offline, pull-on-resume, semantic-status, deletion/undo, confirmation, and notification regressions.
3. Run all 24 harnesses captured. Required result: 22/24 PASS. Only these two unchanged named stale byte locks may fail:
   - `muted-text-color-harness.ts` AuthView byte lock;
   - `saved-flash-harness.ts` post-B1/B2 whole-App reconstruction byte lock.
4. `npm run lint`: exact documented three-error baseline only — `RaceWeekendView` unknown-to-`File`, `SetupView` `key`/`CornerFormProps`, and `SmasherLoadsView` unknown-to-`File`.
5. `npm run build`: PASS with the current 567-module baseline unless an explained toolchain-only count changes.
6. Signed-out shell at 360×800, 390×844, 412×915, and 1080×2118: exact dimensions, no horizontal overflow, controls at least 44px, pinch zoom enabled, notification below wrapped safe-area header and above nav, zero console errors. Do not create or use credentials.
7. `git diff --check`; exact five-file boundary including the authorized deletion and assertion-only offline harness modernization; protected paths clean; worktree clean after commit.
8. Cavecrew reviewer must pass typed outcome truthfulness, failure persistence/copy, blocked/pull zero-success behavior, sync-helper error-only drift audit, B1/B2/A1–A4 preservation, mutations, and scope.
9. Commit code plus harness only with a B3-identifying message. Leave both Ralph files untouched after builder completion. Stop for independent SOL QA; do not open Chunk B QA or C1 yourself.

## Hard bans

No B4, Chunk B QA advancement, Chunk C, C1–C5, or D1–D3. No `src/types.ts`, NumberStepper, SetupView, RaceWeekendView, CSS, other component or harness beyond the two named B3 harnesses, schema, RLS, migrations, Supabase configuration, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Do not alter dual-write data, delete/undo/cascade/zero-row behavior, retry-queue semantics, pull merge/throttle/lifecycle behavior, or B1/B2 interaction semantics. `scripts/offline-indicator-harness.ts` authority is proof-maintenance only and grants zero application-behavior expansion.
