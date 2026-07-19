# Current Task — UX Overhaul v2 Task E1 Harness Repair

**Status:** ACTIVE QA-attempt-3 final SOL repair work order. E1 attempts 1 and 2 each failed 96/100 on harness-only completeness gaps. The product implementation is correct and frozen. One `gpt-5.6-sol` HIGH worker owns this final delegated repair. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. If attempt 3 fails independent QA, plan §5.0 requires the primary to implement the next fix directly. E2 and all later work remain blocked until E1 passes.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Product candidate:** `45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf`, parent `cbe874f491cc81e218f495e7bb50ac5f14f49aaa`.
**Failed repair:** `e2e7fe9548a80975f010eac74647541824e5c0b1`, parent `59aeaa3ef901d51d40560875a9f1c0259edd7dfa`.
**Dispatch base:** the exact clean Ralph attempt-2 failure-record commit containing this work order. Worker must report its full SHA and verify ancestry through failed repair `e2e7fe9548a80975f010eac74647541824e5c0b1`, E1 product `45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf`, accepted D3 repair `a5e72d058289e6c9a7551bb3502dddc79e284c81`, and Chunk D governance.
**Routing:** worker must verify rollout metadata `turn_context.payload.model=gpt-5.6-sol`, `effort=high`, and actual command workdir `C:\Users\maxx\.codex\worktrees\203f\Race-Notes` before any edit or test. Missing or mismatched metadata means stop with no edits. Terra at every tier and `cavecrew-builder` are forbidden.

## Failure to repair

E1 product behavior remains correct. Attempt-1's missing Git scope binding is repaired. Attempt 2 reports 97 assertions and 35 mutations, and its focused/raw/lint/build/scope gates pass. Independent QA found that the pure validator calls `.trim()` and `.filter(Boolean)`: replacing `src/App.tsx` with `" src/App.tsx "` or appending an empty string still validates. This violates the requirement to reject every missing or extra path and preserves a false-negative channel in the production-bound proof.

## ISOLATED repair scope

Edit exactly one file:

1. `scripts/chunk9-export-help-harness.ts`

Every product file is frozen, including `src/App.tsx`, `src/lib/helpRouting.ts`, `src/components/RaceWeekendView.tsx`, `src/components/SetupView.tsx`, and `src/components/FourBarQuickAdjust.tsx`. Ralph, plan, owner report, every other harness, E2/E3 files, sync/data/deletion/lifecycle/status code, native, packages, schema/RLS/migrations, and configuration are protected in the repair commit.

## Required repair

1. Retain the production-bound scope check for exact E1 implementation commit `45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf` against its exact parent.
2. Compare the separator-normalized, sorted result to exactly these five paths:
   - `scripts/chunk9-export-help-harness.ts`
   - `src/App.tsx`
   - `src/components/RaceWeekendView.tsx`
   - `src/components/SetupView.tsx`
   - `src/lib/helpRouting.ts`
3. Explicitly prove `src/components/FourBarQuickAdjust.tsx` is absent from that implementation diff.
4. Repair the pure validator so it normalizes only path separators (`\\` to `/`) and sorting. Do not trim strings and do not filter entries inside the validator. Git command output may continue removing the terminal blank line before it enters the validator.
5. Retain all current missing, duplicate, protected, E2, E3, native, schema, and package mutations. Add unique killed mutations for both:
   - an appended empty-string extra path;
   - an authorized path replaced by a leading/trailing-whitespace variant.
6. Retain the representative unauthorized-path coverage:
   - a general protected/product path such as `src/lib/sync.ts`;
   - an E2 path such as `src/components/GarageView.tsx`;
   - an E3 path such as `src/index.css`;
   - native Android source;
   - a Supabase migration/schema path;
   - package/config scope such as `package.json`.
7. The actual Git-derived scope assertion and each synthetic missing/duplicate/extra-path mutation must fail independently if weakened or removed. Do not replace external commit checks, reviewer checks, or normal Git scope gates; this is additional production-bound proof.
8. Preserve all 97 current E1 assertions and all 35 current mutations without weakening. Retain source EOL normalization. Print the new E1 assertion total and full unique mutation list/count.

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

Primary Extra High QA independently verifies repair ref/clean/ancestry and every changed line; confirms the scope validator reads the exact original E1 implementation commit rather than a synthetic-only fixture; directly probes exact, empty-extra, whitespace-altered, missing, duplicate, protected, E2, E3, native, schema, and package cases; reruns focused/raw/lint/build; re-verifies the frozen product truth table and close/back/unmount behavior; reuses the existing draft because product bytes are frozen; installs a Java 21 debug APK and checks the authenticated header routes without changing owner racing data; obtains independent cavecrew review; and scores strictly.

## Hard bans

No product change; no E2, E3, final QA, handoff, sync/data/deletion/queue/pull/ownership/lifecycle/Saved/Quick Adjust/setup-editability change; no storage key, schema, RLS, migration, Supabase configuration, native source/version, package/config, release/signing, production Netlify publish, Git push, PR, merge, `master`, credentials, account/team/membership mutation, or destructive data test. Preserve all A1-D3 and Chunk D acceptance, local-first behavior, account/team isolation, safe areas, pinch zoom, themes, accessibility, and the exact three-error lint baseline.
