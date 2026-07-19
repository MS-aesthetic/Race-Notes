# Current Task — UX Overhaul v2 Task E2 Add/Create Label Convention

**Status:** ACTIVE copy-only implementation work order. E1 passed 100/100 on QA attempt 3. One `gpt-5.6-sol` HIGH worker owns E2. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. E3 and final QA remain blocked until E2 passes independent QA.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Dispatch base:** the exact clean E1 governance commit containing this work order. Worker must report its full SHA and verify ancestry through final E1 proof repair `b160f7a5b38db0a12b3f367b48d75d38eecb5c69`, E1 product `45e60c95a5bf4e08fccb261cd2ecc85fe28cdddf`, accepted D3 repair, and Chunk D governance.
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Task E2, Parts 5.2 and 6.1, plus the binding v2.1 Owner Addendum.
**Routing:** worker must verify rollout metadata `turn_context.payload.model=gpt-5.6-sol`, `effort=high`, and actual command workdir `C:\Users\maxx\.codex\worktrees\203f\Race-Notes` before any edit or test. Missing or mismatched metadata means stop with no edits. Terra at every tier and `cavecrew-builder` are forbidden.

## Objective

Make Add/New consistently mean “open a creation form” and Create mean “submit a new record.” Change only the three currently noncompliant create-submit labels. Preserve openers, edit/save labels, handlers, styling, form logic, persistence, and every accepted A1–E1 behavior. Race Day already uses `CREATE RACE DAY`; verify it and do not change its product bytes.

## ISOLATED scope

Authorized changed files exactly:

1. `src/components/GarageView.tsx` — change only the new-car form submit text `Add Car` to `Create Car`.
2. `src/components/TiresSubView.tsx` — change only the creation branch of the submit text from `Add Tire` to `Create Tire`; keep edit branch `Save Tire` unchanged.
3. `src/components/TrackersView.tsx` — change only the new-maintenance form submit text `Add Maintenance Job` to `Create Job`.
4. `CODEBASE_KNOWLEDGE.md` — add one concise durable convention: Add/New opens a creation form; Create submits a new record; Save applies edits.
5. `scripts/setup-touch-target-harness.ts` — add production-bound source and mutation proof for all four surfaces.

`src/components/RaceWeekendView.tsx` is verify-only and must have zero E2 diff because its new-event submit already reads `CREATE RACE DAY`. Every other product/harness/governance file, App, help routing, sync/data/deletion/lifecycle/status code, native, packages, schema/RLS/migrations, E3, and final QA are protected.

## Required behavior

1. Garage opener labels remain `Add Car`; only the create-form submit becomes `Create Car`.
2. Tire opener labels remain `Add Tire` / `Add First Tire`; the new-tire submit becomes `Create Tire`; the edit submit remains `Save Tire`.
3. Race Day opener labels remain `New Race Day` / `+ New Race Day`; the existing new-event submit remains `CREATE RACE DAY`; edit submit remains `SAVE CHANGES`.
4. Maintenance opener remains `Add Maintenance Job`; the new-maintenance submit becomes `Create Job`.
5. Do not change form titles, fields, validation, disabled state, event handlers, callback arguments, persistence, cloud calls, success feedback, modal behavior, classes, touch geometry, capitalization styling, or visible copy outside those three submit strings and the knowledge-base convention.
6. No opener and its corresponding new-record submit may have identical visible text after E2.

## Required production-bound proof

Extend `scripts/setup-touch-target-harness.ts` without weakening existing assertions. Normalize source EOLs before exact matching. Add a named E2 assertion count and unique mutation list/count proving:

1. Exact new-record submit labels are `Create Car`, `Create Tire`, `CREATE RACE DAY`, and `Create Job` in their submit/creation branches.
2. Exact openers remain Add/New labels on all four surfaces.
3. Tire edit remains `Save Tire`; Race Day edit remains `SAVE CHANGES`.
4. Garage, Tire, and Maintenance submit handlers, disabled/validation semantics, `type` attributes, and classes remain bound to their existing surrounding source spans.
5. RaceWeekend is read as real production source and its already-compliant submit is verified without an E2 product diff.
6. Four independent mutations reverting each create submit to its opener wording fail. The Race Day mutation must change only the create branch.
7. Independent mutations changing each opener to its Create label fail.
8. A mutation changing either edit/save branch to Create fails.
9. A mutation that rewires a handler or removes submit type/disabled behavior fails.

Print E2 assertion count and full unique mutation names/count. Retain every pre-E2 harness assertion and mutation.

## Worker gates before commit

1. Verify exact runtime metadata, branch, dispatch HEAD, ancestry, and clean tree before editing.
2. Diff must be exactly the five authorized changed files. `RaceWeekendView.tsx` and every protected file have zero E2 diff. `git diff --check` must pass.
3. Run `setup-touch-target-harness.ts`, `confirm-sheet-harness.ts`, `garage-empty-state-harness.ts`, `chunk5-tires-harness.ts`, `chunk8-trackers-harness.ts`, `chunk6b-lifecycle-harness.ts`, `chunk7-quick-adjust-harness.ts`, and `offline-indicator-harness.ts`.
4. Run the raw full 24-harness matrix. Expected result is exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing `15 !== 16`.
5. `npm run lint` must report exactly the three known baseline errors and no new error. `npm run build` must succeed with exactly 566 transformed modules.
6. Obtain cavecrew-reviewer copy-only diff, exact label, handler/class neutrality, protected-path, and clean-tree review.
7. Create exactly one E2-identifying commit containing only the five authorized changed files. Do not edit Ralph/plan/owner report or begin E3.
8. Return exact rollout/model/effort/workdir, commit/parent/files/diff, E2 assertion/mutation counts, focused/raw/lint/build results, RaceWeekend zero diff, reviewer verdict, and clean status. Stop. No deploy, APK, live data, push, PR, or merge.

## Independent QA gates

Primary Extra High QA independently verifies ref/clean/ancestry and every changed line; confirms all four opener/submit pairs and both edit labels; verifies handlers/classes/validation byte-neutrality; reruns focused/raw/lint/build; inspects a draft at 360x800, 390x844, and 412x915 for visible labels, wrapping, 44px targets, and no overflow/errors; builds/installs a Java 21 debug APK and checks the four form surfaces without submitting or changing owner racing data; obtains independent cavecrew review; and scores strictly.

## Hard bans

No E3/final QA/handoff; no App/help/sync/data/deletion/queue/pull/ownership/lifecycle/Saved/Quick Adjust/setup-editability behavior; no new storage key, schema, RLS, migration, Supabase configuration, native source/version, package/config, release/signing, production Netlify publish, Git push, PR, merge, `master`, credentials, account/team/membership mutation, or live/destructive data test. Preserve all A1–E1 acceptance, local-first behavior, account/team isolation, safe areas, pinch zoom, themes, accessibility, and exact three-error lint baseline.
