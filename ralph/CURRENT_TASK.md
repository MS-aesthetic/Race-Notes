# Current Task — UX Overhaul v2 Task E3 Small Closeout Fixes

**Status:** ACTIVE strictly additive implementation work order. E2 passed 100/100 on QA attempt 1 at `2e2c277986be8a36a74d71abb7e02afd561fb701`. One `gpt-5.6-sol` HIGH worker owns E3. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. E3 light QA rolls directly into the final full-sprint QA; no separate Chunk E gate exists.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Dispatch base:** the exact clean governance commit containing this work order. Worker must report its full SHA and verify ancestry through E2 `2e2c277986be8a36a74d71abb7e02afd561fb701`.
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Part 3, Task E3 in Part 5.1, Parts 5.2 and 6.1, and the binding v2.1 Owner Addendum.
**Routing:** worker must verify rollout metadata `turn_context.payload.model=gpt-5.6-sol`, `effort=high`, and actual command workdir `C:\Users\maxx\.codex\worktrees\203f\Race-Notes` before any edit or test. Missing or mismatched metadata means stop with no edits. Terra at every tier and `cavecrew-builder` are forbidden.

## Objective

Close the four low-risk findings from Part 3 with the smallest strictly bounded change: prevent the native-auth callback from publishing state after its effect unmounts, handle a rejected native listener cleanup promise, keep scrollbar hiding mobile/coarse-pointer-only, and document that the two unused team-location functions are intentionally unimplemented scaffolding. Preserve every accepted A1–E2 behavior.

## Exact scope

Authorized changed files exactly:

1. `src/App.tsx` — only the native Android Google-auth deep-link effect around `handleNativeAuthCallback` and its `appUrlOpen` listener cleanup.
2. `src/index.css` — only the existing universal `scrollbar-width` and `::-webkit-scrollbar` rules.
3. `src/lib/location.ts` — comments/annotations only for the intentionally unimplemented `startSharing` and `subscribeTeamLocations` scaffold.

No harness file is changed; the plan explicitly expects none. Every other product, harness, governance, native, package, schema/RLS/migration, release, and configuration path is protected. In `src/App.tsx`, the resume-pull listener, saved-feedback listener, auth flow outside the named effect, state shapes, sync/deletion/data/setup/session/help behavior, and rendered UI are protected.

## Required implementation

1. In the native-auth callback promise's success branch, re-check the effect's existing `active` flag before `setNativeAuthError(null)`.
2. In that promise's failure branch, re-check `active` before logging or calling `setNativeAuthError`; an unmounted effect must publish neither state nor a misleading callback-failure warning.
3. Keep the existing listener removal, but terminate its promise chain with a `.catch` that swallows-with-log a rejected `addListener` or cleanup promise. The cleanup itself remains non-blocking and no new state is introduced.
4. Wrap the existing universal Firefox and WebKit scrollbar-hiding rules in a coarse-pointer media query. Do not alter their selectors or declarations. Fine-pointer/desktop web must retain normal scrollbar affordances.
5. Add concise source comments that explicitly identify `startSharing` and `subscribeTeamLocations` as intentional, currently unwired WS-T scaffolding. Do not change imports, exports, signatures, logging, return values, Supabase calls, localStorage, TTL/throttle constants, or runtime behavior in `location.ts`.
6. No refactor, helper extraction, dependency change, formatting sweep, visible copy change, or opportunistic cleanup.

## Worker gates before commit

1. Verify exact runtime metadata, branch, dispatch HEAD, E2 ancestry, and clean tree before editing.
2. Review every changed line. Diff must be exactly the three authorized files and only the named spans. `git diff --check` must pass.
3. Prove directly from the final diff that both native-auth promise branches are active-guarded; listener cleanup has a terminal `.catch`; scrollbar hiding applies only inside `(pointer: coarse)`; and `location.ts` has comments-only changes.
4. Run the raw full 24-harness matrix. Expected result is exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing `15 !== 16`.
5. Run focused regression harnesses for offline indicator, resume pull, saved feedback, context help, setup touch targets, lifecycle, Quick Adjust, tires, confirmation, D1 zero-row deletion, D2 clear data, and D3 car cascade.
6. `npm run lint` must report exactly the three known baseline errors and no new error. `npm run build` must succeed with exactly 566 transformed modules.
7. Obtain cavecrew-reviewer strict-additive diff, async-lifecycle, pointer-media, comments-only, protected-path, and clean-tree review.
8. Create exactly one E3-identifying commit containing only the three authorized files. Do not edit Ralph, plan, owner report, handoff documents, or begin final QA.
9. Return exact rollout/model/effort/workdir, commit/parent/files/diff, direct acceptance evidence, focused/raw/lint/build results, reviewer verdict, and clean status. Stop. No deploy, APK, live data, push, PR, or merge.

## Independent QA gates

Primary Extra High QA independently verifies ref/clean/ancestry and every changed line; confirms strict additive scope and protected paths; independently checks the two unmount guards, cleanup rejection handling, coarse-versus-fine pointer CSS behavior, and comments-only location diff; reruns the focused regressions, raw matrix, lint, and build; obtains independent cavecrew review; and scores strictly. Because E3 closes implementation, a PASS immediately begins Part 6.3 final full-sprint QA rather than a separate Chunk E gate.

## Hard bans

No behavior outside the four named findings; no E1/E2 change; no harness/governance/handoff edit by the worker; no new storage key, schema, RLS, migration, Supabase configuration, native source/version, package/config, release/signing, production Netlify publish, Git push, PR, merge, `master`, credentials, account/team/membership mutation, or live/destructive data test. Preserve all A1–E2 acceptance, local-first behavior, sync/deletion honesty, setup/session lifecycle, help routing, label convention, safe areas, pinch zoom, themes, accessibility, and exact three-error lint baseline.
