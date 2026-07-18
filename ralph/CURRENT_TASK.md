# Current Task — UX Overhaul v2 Task C5 Setup Naming and Rename Affordance

**Status:** READY FOR `gpt-5.6-sol` HIGH IMPLEMENTATION. C4 is accepted at 100/100; Chunk C QA and all later work remain blocked.
**Branch:** `codex/ux-overhaul`
**Exact clean baseline:** `83230c9ea563fd79106be602dd5f602567ea14e5`
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` items 6b and 15, Task C5, v2.1 Owner Addendum, Part 5 escalation rule, and Part 6 gates
**Runtime routing:** implementation must execute as `gpt-5.6-sol` **High** in a separate worker task; primary QA/plan/state work executes as `gpt-5.6-sol` **Extra High**. Runtime `turn_context.payload.model` and effort are authoritative. Missing runtime metadata is `unverified` and cannot satisfy the build role. Terra at every tier and `cavecrew-builder` are forbidden.

## Owner outcome

Prevent accidental anonymous blank setups while keeping copies fast. Starting from blank must require a real trimmed name. Copying an existing setup must still work without typing because the copy receives a meaningful derived name. Editable setup cards must show an obvious pencil action that opens the existing form and focuses the existing Chassis/name input. Historical or otherwise non-editable setups remain view-only.

## Authorized scope

May change only:

1. `src/components/SetupView.tsx`
2. `scripts/chunk5-setup-harness.ts`

No App wiring, new component, shared primitive, CSS file, lifecycle helper, sync helper, type, schema, native, package/config, or other harness is presently indicated. The standing owner approval permits a separate assertion-only EOL portability fix only if a real portability failure is reproduced; stop and report before expanding beyond the two named files for any other reason.

## Canonical creation semantics

1. `newSetupName.trim()` is the only accepted name for a new-from-blank setup. Leading/trailing whitespace does not persist.
2. Blank mode with an empty or whitespace-only name creates zero records, performs zero state/localStorage/cloud writes, changes no active selection, marks no C4 dirty state, and shows no Saved. It exposes the exact inline hint `Name this setup` through an accessible error relationship.
3. The blank action is visibly disabled while the trimmed name is empty. If an empty blank attempt is still delivered through keyboard/programmatic submission, the handler guard rejects it and exposes the same hint. The handler guard is authoritative; visual disabled state alone is insufficient.
4. The `Setup #N` fallback is removed from every no-source/blank path. No route can create an anonymous numbered setup.
5. Copy mode remains frictionless. With an empty name and a valid same-car source, it derives the existing meaningful source-based name, clones values/provenance, clears media and historical change rows exactly as today, and creates normally. Do not require text or show `Name this setup` for this copy path.
6. A typed non-empty name overrides the derived copy name after trimming, as today.
7. When no copy source exists, the apparent default/create-starting action is a blank creation and therefore obeys the required-name rule.
8. Existing IDs, timestamps, lifecycle role/source linkage, active selection, copy pressure provenance/info, local-first persistence, cloud ownership, C4 feedback boundaries, and no-active-car behavior remain unchanged.

## Canonical rename semantics

1. Add one visible pencil icon beside the setup name in each editable, non-historical card header. It has an accessible name/title such as `Rename setup`, a minimum 44×44px target, and remains usable at 360px without clipping or displacing lifecycle badges/actions.
2. Clicking the pencil stops header-toggle propagation, expands that exact card if needed, then focuses the existing Chassis input for that setup after it mounts. Selecting the current text is acceptable but not required.
3. Use the existing Chassis input and `handleMetadataChange` persistence path. Do not add a second rename state, modal, schema field, localStorage key, or cloud call.
4. Clicking the pencil alone is navigation/focus only: zero setup mutation, zero local/cloud write, zero dirty mark, zero Saved. Actual typing retains immediate local persistence and C4 boundary-only confirmation.
5. Historical baseline/final/explicitly locked/finished-weekend setups and the active event-owned edit-frozen setup remain non-editable under the accepted C1 predicate. They must not expose an enabled rename action or focus a disabled field.
6. An unrelated editable Current Setup remains renameable while a live Race Day exists. Rename persists across relaunch, and lifecycle/version labels/provenance do not change.
7. Rename affordance changes discoverability only. Card expansion, `Use Setup`, clone, compare, delete, share, pending/bound diffs, Legacy log, corner forms, attachments, and all other setup UI stay unchanged.

## Mutation-complete harness contract

Extend the EOL-normalized production-bound C1–C3 portion of `scripts/chunk5-setup-harness.ts`; retain every accepted assertion and killed mutation. Bind tests to real `SetupView.tsx` slices and independently prove:

1. Empty and whitespace-only blank creation execute the real handler and produce zero setup/state/save/selection/info/dirty effects with exact `Name this setup` error copy.
2. A valid blank name is trimmed, creates exactly one blank Current Setup, and never uses `Setup #N`.
3. No-source default creation follows the same required-name guard.
4. Empty-name copy with a valid source still auto-names, clones the exact source tune/provenance, and preserves copy info/persistence behavior; a typed copy name trims and wins.
5. The real blank control is disabled when trimmed-empty and enabled when named; required/error semantics are accessible without blocking the copy submit path.
6. The real editable-card pencil is rendered, accessible, at least 44×44px at 360px, stops propagation, expands the target card, and focuses its exact Chassis input after mount.
7. Historical/edit-frozen cards cannot invoke rename; the accepted C1 owner fixture still permits rename on an unrelated Current Setup while a live Race Day exists.
8. Pencil-only focus produces zero mutation/write/dirty/Saved; actual chassis input change uses the existing save path and remains compatible with C4 no-immediate/one-boundary behavior.
9. Mutations that restore `Setup #N`, remove/whitespace-weaken the blank guard, block blankless copy, fail to trim, remove the inline hint, remove or undersize the pencil, omit propagation stop/expand/focus, point to the wrong setup input, expose rename on read-only cards, or add persistence on focus independently fail.
10. Compile the real changed TSX/handler slices, print the new C5 assertion count and unique killed mutation list, and keep every existing C1–C3 assertion/mutation green. Synthetic-only models or fixed-parent whole-file locks are insufficient.

## Worker gates before commit

1. `npx tsx scripts/chunk5-setup-harness.ts`
2. `npx tsx scripts/saved-flash-harness.ts`
3. `npx tsx scripts/chunk6b-lifecycle-harness.ts`
4. `npx tsx scripts/chunk7-quick-adjust-harness.ts`
5. `npx tsx scripts/offline-indicator-harness.ts`
6. `npx tsx scripts/pull-on-resume-harness.ts`
7. `npx tsx scripts/chunk5-tires-harness.ts`
8. `npx tsx scripts/setup-touch-target-harness.ts`
9. Raw full 24-harness matrix is exactly **23/24**, with the only failure the unchanged `muted-text-color-harness.ts` stale AuthView lock. `saved-flash-harness.ts` and the expanded setup harness must pass and may not be waived.
10. `npm run lint` reports exactly the three known baseline errors and no new error.
11. `npm run build` succeeds with exactly 566 transformed modules.
12. `git diff --check`, exact two-file scope/protected-path audit, and clean post-commit worktree pass.
13. Independent `cavecrew-reviewer` reports no blocking finding.

Commit exactly the two authorized product/harness files with a C5-identifying message. Stop for primary QA. Do not edit Ralph, the technical plan, the owner report, native files, release files, or Git history beyond that one commit. Do not deploy, push, merge, begin Chunk C QA, or start Chunk D.

## Independent primary QA gates

1. Verify runtime model/effort, exact baseline/head, branch, scope, protected paths, diff check, and clean tree.
2. Inspect every changed line and independently execute the real creation/rename semantics and every harness mutation above.
3. Run focused C5 plus C1–C4 setup/editability/snapshot/diff/Saved, lifecycle, Quick Adjust, offline/resume, tire, touch, and status regressions. Raw matrix must be exact 23/24 with only the named muted-text lock.
4. Lint must be the exact three-error baseline; build must be exactly 566 modules.
5. Exercise the owner scenario with a live Race Day present: empty/whitespace blank rejected with no data or Saved; source copy with no typed name auto-named; a valid named blank created; pencil visible at 360px; unrelated Current Setup renamed through focused Chassis input; rename survives relaunch; historical/active event-owned cards remain view-only; C4 no-immediate and one-boundary confirmation remain truthful.
6. Deploy a correct-site Netlify draft and inspect the signed-out shell at 360×800, 390×844, and 412×915. Inspect authenticated Setups at required phone widths, light/dark, and Default/Large: no overflow, all new controls at least 44px, viewport meta intact, no product console warning/error.
7. Run `npx cap sync android`, build a Java 21 debug APK only, install to the running emulator, and verify the owner scenario plus relaunch persistence. No release build, signing, native source edit, or production deploy.
8. Obtain independent `cavecrew-reviewer` scope/diff/behavior review. Record strict PASS/FAIL score in Ralph, keep this plan current, and update `docs/OWNER_REPORT_UX_OVERHAUL.md` in full plain English.

## Exclusions and hard bans

No Chunk C QA, Chunk D/E, C1 lifecycle/editability meaning changes, C2 snapshot/model changes, C3 pending/bound/Legacy/Quick Adjust changes, C4 dirty/boundary/arbiter changes, notification copy/layout redesign, sync timing/payload/merge/throttle changes, setup ID/version/provenance migration, schema/RLS/migration/Supabase configuration, native source, Android version/signing, release artifacts, package/config, credentials, production deploy, Git push, merge, or `master` change. Preserve all A1–C4 acceptance, dual-write behavior, team-owner writes, deferred deletes, offline/resume behavior, safe areas, pinch zoom, themes, and accessibility. Terra and `cavecrew-builder` remain forbidden.
