# Current Task — UX Overhaul v2 Task C2 Session Snapshot Model and Diff Engine

**Status:** SOL REPAIR BLOCKED — attempt 1 FAIL 92/100; assertion-only scope extension awaits owner approval; C3–C5 and Chunk D/E blocked
**Branch:** `codex/ux-overhaul`
**Integrated QA commit:** `253897a2518b3ed5f3148926e522163a9ea9d0b3`
**Builder original:** `32135814ead0cc28179dc0ead9dfbc91a311f2fc` (identical tree)
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 2 item 7, Part 5 Task C2, Part 6.1, and boundary statement 5.2
**Runtime:** all C2 repair implementation and QA use explicit `gpt-5.6-sol` with `high`. Terra and `cavecrew-builder` are permanently forbidden after attempt 1 FAIL. Runtime metadata remains authoritative; absent metadata records `unverified`.

## Attempt 1 failure record

Independent SOL QA found no current product defect. Snapshot type/capture/diff behavior, one canonical setup resolution and capture, matching `setupId`/`setupSnapshot`/`setupUsed`, detached plain data, complete ordered tune allowlists, legacy `changeLog` preservation, unchanged opaque sessions JSON sync, Quick Adjust neutrality, exact four-file feature scope, protected paths, clean worktrees, and cavecrew review all passed.

Required Windows harness result failed: raw matrix was **20/24**, not exact **22/24**.

- Allowed named stale failures: `scripts/muted-text-color-harness.ts` and `scripts/saved-flash-harness.ts`.
- Unexpected failure: `scripts/chunk5-setup-harness.ts` at the C2 baseline source/model gate. Its multiline source match hardcodes LF and rejects the normal CRLF Windows checkout.
- Unexpected failure: `scripts/offline-indicator-harness.ts` at the terminal-clear mutation. Its source replacement hardcodes LF and does not mutate CRLF `src/App.tsx`.
- Both focused harnesses pass on the identical LF builder tree, confirming harness portability defects rather than product behavior defects.

Passing gates: lint matched the exact three known baseline errors; build passed with 566 modules; signed-out 360×800, 390×844, 412×915, and 1080×2118 shells retained the auth gate, zero horizontal overflow, controls at least 44px, pinch-enabled viewport metadata, and zero console warnings/errors; diff, protected-path, clean-tree, and cavecrew checks passed.

## Owner approval gate — repair must not begin

Current C2 scope already permits `scripts/chunk5-setup-harness.ts`. Repair also needs an assertion-only extension for `scripts/offline-indicator-harness.ts`, which is outside the existing exact file list.

**Pending owner approval:** allow exactly `scripts/offline-indicator-harness.ts`, solely to normalize the read `src/App.tsx` source from CRLF to LF before existing mutation checks. No product behavior, application file, copy, sync logic, or later-task scope may change.

Do not begin either repair until owner approval is recorded. Do not edit feature code, harness code, Ralph state, or Git history while approval is pending.

## SOL repair work order after approval

1. Change only `scripts/chunk5-setup-harness.ts` and owner-approved `scripts/offline-indicator-harness.ts`.
2. In `scripts/chunk5-setup-harness.ts`, make C2 source and mutation matching EOL-agnostic. Accept LF and CRLF without weakening exact production-symbol, allowlist, binding, noise, detachment, or logging-rewire gates.
3. In `scripts/offline-indicator-harness.ts`, normalize the read App source from CRLF to LF before existing mutation checks. Keep every B1–B4 assertion and expected behavior unchanged.
4. No product changes are presently indicated or authorized. Keep `src/types.ts`, `src/lib/setupLifecycle.ts`, `src/App.tsx`, `src/lib/sync.ts`, and all components byte-unchanged from `253897a` during repair.
5. Commit repair harnesses together with a C2 task-identifying SOL repair message. Leave Ralph files unchanged during implementation.

## Exact post-repair gates

1. `npx tsx scripts/chunk5-setup-harness.ts` passes from the normal CRLF Windows checkout, including every C1/C2 source, model, behavioral, and mutation gate.
2. `npx tsx scripts/offline-indicator-harness.ts` passes from the same checkout, including terminal-entry clearing, later-Saved suppression, acknowledgement safety, typed status rendering, pull failure, and stale-generation gates.
3. Raw full 24-harness matrix is exactly **22/24**. Only unchanged `muted-text-color-harness.ts` AuthView byte lock and final `saved-flash-harness.ts` whole-App reconstruction byte lock may fail. Any other failure blocks completion.
4. `npm run lint` matches the exact three-error baseline. `npm run build` passes with 566 modules.
5. Repair diff contains only the two approved harness files; `git diff --check`, protected paths, worktree cleanliness, and independent `cavecrew-reviewer` all pass.
6. Report repair commit SHA and exact evidence. Stop for independent SOL QA. Do not advance Ralph or begin C3.

## Exclusions and hard bans

No product changes; no C3–C5 or Chunk D/E; no session diff/pending UI; no SetupView, Quick Adjust, autosave, naming, rename, editability, lifecycle-definition, sync, schema, RLS, migration, Supabase configuration, CSS, NumberStepper, RaceWeekendView, native, Android, release, package/config, credentials, branch-ref, push, deploy, merge, production, or `master` change. Preserve dual weekend-delete, team-owner canonical writes, deferred delete queue, UXN-1 filtering, UXN-3 pull behavior, local-only active IDs, pinch zoom, accessibility, safe areas, and all A1–C1 acceptance. Terra and `cavecrew-builder` remain forbidden for all future C2 work.
