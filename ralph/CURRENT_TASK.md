# Current Task — UX Overhaul v2 Task C1 Single Editability Predicate

**Status:** BUILD READY — ISOLATED; exactly one Terra High initial implementation pass; C2–C5 and Chunk D/E blocked
**Branch:** `codex/ux-overhaul`
**B4 dependency gate:** PASS 98 at `be462e3`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 6 including N8, Part 5 Task C1, Part 6.1, and boundary statement 5.2
**Runtime:** model metadata not exposed; record `unverified`.

## Permitted files — exact isolated scope

Modify only:

- `src/lib/setupLifecycle.ts`
- `src/components/SetupView.tsx`
- `src/App.tsx`
- `scripts/chunk5-setup-harness.ts`

No other file is permitted. Commit code and harness together with a task-identifying C1 message. Leave `ralph/STATE.md` and `ralph/CURRENT_TASK.md` untouched during the build.

## Required implementation

1. Export one canonical `getSetupEditability(setup, weekends, activeEventSetupId)` from `setupLifecycle.ts`, returning `{ editable, deletable, reason }` with typed reasons covering `historical-role`, `locked`, `finished-weekend`, and `in-play-elsewhere`.
2. Make `SetupView.tsx` and `App.tsx` use that predicate and only that predicate for matching edit/delete decisions. Remove their divergent local/inline recomputation without expanding unrelated orchestration.
3. Demote the `activeEventSetupId` case to `in-play-elsewhere`: non-historical and non-delete-blocking; edit-frozen only for the setup in the same active weekend. An unrelated live Race Day must not freeze every setup.
4. Preserve historical meaning byte-for-byte: baseline/final roles, `lockedAt`, and finished-weekend relationships remain exactly as historical/immutable as before. Do not alter `isSetupLocked` inputs or historical-role definitions.
5. Existing chassis-name field must be editable for a non-historical setup while a live Race Day exists. Do not add the dedicated pencil/rename affordance; that belongs to C5.
6. Preserve B2/B3 truthfulness: blocked historical edits change zero data bytes and produce no false Saved/Synced feedback. Preserve local-first writes, car scoping, pressure propagation, and every B1–B4 behavior.

## Acceptance

1. Deliberate edit on every historical fixture changes zero bytes in setup, saved-setups, active selection, pressures, local persistence model, and cloud-write model.
2. Baseline, final, explicit `lockedAt`, and finished-weekend fixtures keep their prior editable/deletable results and typed reasons.
3. Non-historical setup on the owner's live-Race-Day pattern is editable and deletable; its chassis-name input is enabled.
4. `in-play-elsewhere` setup is edit-frozen but deletable; unrelated setups remain editable/deletable.
5. `SetupView` and `App` return identical `{ editable, deletable, reason }` for every fixture. No alternate editability rule remains in either call site.
6. No C2 snapshot/diff/logging, C3 session UI, C4 autosave, C5 naming/affordance, or later-chunk behavior appears in the diff.

## Required validation

1. Expand `scripts/chunk5-setup-harness.ts` with both-call-sites-agree fixtures, owner live-Race-Day rename fixture, all four typed reasons, unrelated-live-event editability, `in-play-elsewhere` deletability, and hard zero-byte historical mutation proof.
2. Add meaningful production-source mutations: bypass historical rejection, restore the over-broad any-active-event freeze, diverge one call site, or make `in-play-elsewhere` delete-blocking. Each mutation must compile where applicable and fail source/model/behavior gates.
3. Run focused C1 harness plus lifecycle, Quick Adjust, B1–B4 notification/offline/resume, tire, touch-target, and A1–A4 regressions.
4. Run full 24-harness matrix. Exact accepted result remains 22/24; only unchanged `muted-text-color-harness.ts` AuthView byte lock and final `saved-flash-harness.ts` whole-App reconstruction byte lock may fail. Any other failure blocks builder completion.
5. `npm run lint` must match exact three-error baseline; `npm run build` must pass with 566 modules.
6. Verify signed-out 360x800, 390x844, 412x915, and 1080x2118 shell remains overflow-free, >=44px, pinch-enabled, and console-clean. Do not create or use credentials. Authenticated owner-pattern behavior is proven through deterministic fixtures unless credentials are separately authorized.
7. Verify exact four-file diff, `git diff --check`, protected paths, clean worktree after commit, and cavecrew reviewer. ISOLATED means any unrelated change is automatic failure.
8. Report commit SHA and exact evidence. Stop for independent SOL light QA; do not advance Ralph or begin C2.

## Exclusions and hard bans

No C2–C5, Chunk D/E, snapshot fields, session diff UI, Quick Adjust changes, per-press logging changes, autosave boundaries, required-name flow, pencil/rename affordance, historical-definition change, schema, RLS, migrations, Supabase configuration, `sync.ts`, types, CSS, NumberStepper, RaceWeekendView, native, Android, release, package/config, credentials, branch refs, push, deploy, merge, production, or `master` changes. Preserve dual weekend-delete, team-owner canonical writes, deferred delete queue, UXN-1 filtering, UXN-3 pull behavior, local-only active IDs, pinch zoom, accessibility, safe areas, and all B1–B4 acceptance.
