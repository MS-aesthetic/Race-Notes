# Current Task — UX Overhaul v2 Task E1 Harness Repair

**Status:** ACTIVE QA-attempt-2 repair work order. E1 attempt 1 failed 96/100 on one harness-completeness gap. The product implementation is correct and frozen. One `gpt-5.6-sol` HIGH worker owns the repair. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. E2 and all later work remain blocked until repaired E1 passes independent QA.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Product candidate:** `45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf`, parent `cbe874f491cc81e218f495e7bb50ac5f14f49aaa`.
**Dispatch base:** the exact clean Ralph failure-record commit containing this work order. Worker must report its full SHA and verify ancestry through E1 product `45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf`, accepted D3 repair `a5e72d058289e6c9a7551bb3502dddc79e284c81`, and Chunk D governance.
**Routing:** worker must verify rollout metadata `turn_context.payload.model=gpt-5.6-sol`, `effort=high`, and actual command workdir `C:\Users\maxx\.codex\worktrees\203f\Race-Notes` before any edit or test. Missing or mismatched metadata means stop with no edits. Terra at every tier and `cavecrew-builder` are forbidden.

## Failure to repair

E1 product behavior, exact implementation scope, 85 assertions, 27 existing mutations, focused regressions, raw matrix, lint, build, draft shell, and line review all pass. Independent cavecrew found one binding omission in `scripts/chunk9-export-help-harness.ts`: the harness reads fixed product files but never inspects the E1 implementation commit's changed-file set. Adding an unauthorized, protected, E2, or E3 file to the E1 implementation commit would still leave the harness green. This violates required production-bound proof item 11.

## ISOLATED repair scope

Edit exactly one file:

1. `scripts/chunk9-export-help-harness.ts`

Every product file is frozen, including `src/App.tsx`, `src/lib/helpRouting.ts`, `src/components/RaceWeekendView.tsx`, `src/components/SetupView.tsx`, and `src/components/FourBarQuickAdjust.tsx`. Ralph, plan, owner report, every other harness, E2/E3 files, sync/data/deletion/lifecycle/status code, native, packages, schema/RLS/migrations, and configuration are protected in the repair commit.

## Required repair

1. Add a production-bound scope check that obtains the changed-file names for exact E1 implementation commit `45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf` against its parent.
2. Compare the normalized, sorted result to exactly these five paths:
   - `scripts/chunk9-export-help-harness.ts`
   - `src/App.tsx`
   - `src/components/RaceWeekendView.tsx`
   - `src/components/SetupView.tsx`
   - `src/lib/helpRouting.ts`
3. Explicitly prove `src/components/FourBarQuickAdjust.tsx` is absent from that implementation diff.
4. Use a pure scope validator for deterministic mutation proof. It must reject missing authorized paths, duplicate paths if applicable, and every extra path.
5. Add unique killed mutations that inject representative unauthorized paths covering at least:
   - a general protected/product path such as `src/lib/sync.ts`;
   - an E2 path such as `src/components/GarageView.tsx`;
   - an E3 path such as `src/index.css`;
   - native Android source;
   - a Supabase migration/schema path;
   - package/config scope such as `package.json`.
6. The actual Git-derived scope assertion and each synthetic extra-path mutation must fail independently if weakened or removed. Do not replace external commit checks, reviewer checks, or normal Git scope gates; this is additional production-bound proof.
7. Preserve all 85 existing E1 assertions and all 27 existing mutations without weakening. Retain EOL normalization. Print the new E1 assertion total and full unique mutation list/count.

## Worker gates before commit

1. Verify exact runtime metadata, branch, dispatch HEAD, ancestry, and clean tree before editing.
2. Repair diff must be exactly `scripts/chunk9-export-help-harness.ts`; `git diff --check` must pass and every protected file must have zero repair diff.
3. Run `chunk9-export-help-harness.ts`, `offline-indicator-harness.ts`, `saved-flash-harness.ts`, `ux-r1-color-harness.ts`, `setup-touch-target-harness.ts`, `chunk5-setup-harness.ts`, `chunk6b-lifecycle-harness.ts`, and `chunk7-quick-adjust-harness.ts`.
4. Run the raw full 24-harness matrix. Expected result is exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing `15 !== 16`.
5. `npm run lint` must report exactly the three known baseline errors and no new error. `npm run build` must succeed with exactly 566 transformed modules.
6. Obtain cavecrew-reviewer review of the one-file repair, production-bound Git scope binding, mutation completeness, protected paths, and clean tree.
7. Create exactly one E1-repair-identifying commit containing only `scripts/chunk9-export-help-harness.ts`. Do not edit product or governance files and do not begin E2.
8. Return exact rollout/model/effort/workdir evidence, commit/parent, file list/diff, assertion/mutation counts, focused/raw/lint/build results, protected audit, reviewer verdict, and clean status. Stop. No deploy, APK, live data, push, PR, or merge.

## Independent QA gates

Primary Extra High QA independently verifies repair ref/clean/ancestry and every changed line; confirms the scope validator reads the exact original E1 implementation commit rather than a synthetic-only fixture; mutation-tests missing, extra, protected, E2, E3, native, schema, and package paths; reruns focused/raw/lint/build; re-verifies the frozen product truth table and close/back/unmount behavior; reuses or refreshes the draft only if product bytes differ; installs a Java 21 debug APK and checks the authenticated header routes without changing owner racing data; obtains independent cavecrew review; and scores strictly.

## Hard bans

No product change; no E2, E3, final QA, handoff, sync/data/deletion/queue/pull/ownership/lifecycle/Saved/Quick Adjust/setup-editability change; no storage key, schema, RLS, migration, Supabase configuration, native source/version, package/config, release/signing, production Netlify publish, Git push, PR, merge, `master`, credentials, account/team/membership mutation, or destructive data test. Preserve all A1-D3 and Chunk D acceptance, local-first behavior, account/team isolation, safe areas, pinch zoom, themes, accessibility, and the exact three-error lint baseline.
