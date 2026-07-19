# Current Task — UX Overhaul v2 Task E1 Context-Aware Help Relocation

**Status:** ACTIVE implementation work order. Chunk D passed 100/100. One `gpt-5.6-sol` HIGH worker owns the initial E1 build. Primary `gpt-5.6-sol` EXTRA HIGH remains QA and plan authority. E2 and all later work remain blocked until E1 passes independent QA.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Dispatch base:** the exact clean governance commit containing this work order. Worker must report its full SHA and verify ancestry through accepted D3 repair `a5e72d058289e6c9a7551bb3502dddc79e284c81` and Chunk D governance `98124bb0bc1ce5d9b711bf4b4373f203aea0d48d`.
**Plan authority:** `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` Task E1, Parts 5.2 and 6.1, and the binding v2.1 Owner Addendum including the callback-only RaceWeekend scope correction.
**Routing:** worker must verify rollout metadata `turn_context.payload.model=gpt-5.6-sol`, `effort=high`, and actual command workdir `C:\Users\maxx\.codex\worktrees\203f\Race-Notes` before any edit or test. Missing or mismatched metadata means stop with no edits. Terra at every tier and `cavecrew-builder` are forbidden.

## Objective

Add one context-aware App Guide question-mark button in the authenticated header beside the unchanged Tuning Guide button. Resolve its destination at click time: visible Race Day FourBar sheet first, Setups tab second, any future mapped context next, App Guide root otherwise. Remove only the redundant Setup-sheet header question mark. Preserve nested FourBar, Loads, and Setup Diff deep links and every accepted A1-D3 behavior.

## ISOLATED scope

Any unrelated change is an automatic QA failure. Authorized implementation files exactly:

1. `src/App.tsx` — App-owned FourBar context signal, click-time header resolver, one accessible 44px question-mark action after Tuning Guide and before theme, and callback prop wiring only.
2. `src/lib/helpRouting.ts` — typed/pure contextual App Guide resolver and explicit App Guide root sentinel/classification only.
3. `src/components/SetupView.tsx` — remove only the redundant Setup-sheet header help button. Keep the `onHelp` prop and nested FourBar, Loads, and Setup Diff forwarding.
4. `src/components/RaceWeekendView.tsx` — callback-only reporting of local FourBar sheet open, close, Android-back close, and unmount/tab departure. No run, setup, persistence, Quick Adjust, or sheet-layout behavior change.
5. `scripts/chunk9-export-help-harness.ts` — production-bound resolver, prop-route, source, accessibility, and mutation proof while retaining every existing Chunk 9 assertion.

`src/components/FourBarQuickAdjust.tsx` is verify-only and must have zero diff. Its inline question mark and exact `onHelp('four-bar')` target remain. `SettingsView.tsx`, `GuideView.tsx`, `QuickReferenceView.tsx`, `HelpSheet.tsx`, every other product/harness file, Ralph/plan/report, sync/data/deletion/lifecycle/status code, native, packages, schema/RLS/migrations, E2, and E3 are protected in the implementation commit.

## Required behavior

1. Add an explicit App Guide root section sentinel, recommended `'app-guide'`. `undefined` cannot represent this root because current `openHelp(undefined)` intentionally opens Tuning Guide/QuickReference.
2. Extend App Guide classification so the root sentinel renders embedded `GuideView` with no forced accordion. Existing `setup`, `four-bar`, `loads`, and `setup-diff` deep links stay valid.
3. Provide one pure resolver with this stable priority:
   - reported FourBar sheet visible → `'four-bar'`;
   - otherwise active tab `setups` → `'setup'`;
   - otherwise any explicitly mapped context → its existing App Guide section;
   - otherwise → App Guide root sentinel.
4. Resolve inside the contextual header button click handler using current state. Do not precompute or retain a stale section across tab/sheet changes.
5. Insert one question-mark button directly after Tuning Guide and before theme. It must be a real button, at least 44x44px, have an exact useful accessible label/title identifying App Guide, and preserve header wrapping/no-overflow behavior.
6. The existing Tuning Guide button remains semantically and behaviorally unchanged: `openHelp()` with no section, QuickReference content, same label/icon/copy/classes/order relative to the new button.
7. RaceWeekend reports true when its FourBar sheet opens and false on every close path, Android back, unmount, and tab departure. Use a stable App callback and avoid effect loops, stale true state, or writes after unmount.
8. Remove only the SetupView header `Setup help` button. Retain its `onHelp` prop and nested routes to FourBar, Loads, and Setup Diff.
9. Keep FourBarQuickAdjust byte-for-byte unchanged, including its 44px inline button and exact `onHelp('four-bar')` call.
10. No data/state persistence, sync, deletion, Saved, Quick Adjust command, setup editability, scroll, theme, safe-area, or navigation-tab behavior changes.

## Required production-bound proof

Extend `chunk9-export-help-harness.ts` with deterministic real-code/source/markup proof. It must compile/execute the pure resolver and fail independently for at least:

1. FourBar override removed or lower priority than Setups.
2. Every Race Day state incorrectly maps to FourBar even when the sheet is closed.
3. Setups mapping removed or wrong.
4. Root fallback uses `undefined`, opens QuickReference/Tuning Guide, or fails App Guide classification.
5. Contextual header calls bare `openHelp()` or resolves at render time with stale state.
6. Tuning Guide is rewired to contextual App Guide behavior.
7. RaceWeekend misses true on open or false on close, Android back, unmount, or tab departure.
8. Setup inline question mark remains, or removing it also removes nested `onHelp` routes.
9. FourBar inline help disappears, changes target, or `FourBarQuickAdjust.tsx` changes.
10. Header question mark is outside the authenticated action group, under 44px, missing its accessible label/title, or placed away from Tuning Guide.
11. Any non-authorized file, E2/E3 behavior, persistence/sync/deletion/lifecycle/status/native/schema/package change appears.

Print E1 assertion count and unique mutation names/count. Retain all prior Chunk 9 assertions without removal or weakening. Normalize source EOLs before exact mutation matching.

## Builder gates before commit

1. Verify exact runtime metadata, branch, dispatch HEAD, ancestry, and clean tree before editing.
2. `git diff --name-status` and `git diff --check`; implementation scope must be exactly the five authorized files. Every protected file, especially `FourBarQuickAdjust.tsx`, has zero diff.
3. Run `chunk9-export-help-harness.ts`, plus `offline-indicator-harness.ts`, `saved-flash-harness.ts`, `ux-r1-color-harness.ts`, `setup-touch-target-harness.ts`, `chunk5-setup-harness.ts`, `chunk6b-lifecycle-harness.ts`, and `chunk7-quick-adjust-harness.ts`.
4. Run the raw full 24-harness matrix. Expected result is exactly 23/24 with only unchanged `muted-text-color-harness.ts` failing `15 !== 16`.
5. `npm run lint` must report exactly the three known baseline errors and no new error. `npm run build` must succeed with exactly 566 transformed modules.
6. Obtain cavecrew-reviewer exact diff/protected-path review.
7. Create exactly one E1-identifying implementation commit containing only the five authorized files. Do not edit Ralph/plan/report or begin E2.
8. Return exact rollout/model/effort/workdir evidence, commit/parent, file list/diff, E1 assertions/mutations, focused/raw/lint/build results, protected audit, reviewer verdict, and clean status. Stop. No deploy, APK, live data, push, PR, or merge.

## Independent QA gates

Primary Extra High QA independently verifies ref/clean/ancestry and every changed line; reruns focused/raw/lint/build; tests the resolver truth table for Setups, Race Day FourBar open/closed, Dashboard, Settings, and Trackers; confirms close/back/unmount clears stale FourBar context; verifies Tuning Guide versus App Guide root and all nested deep links; inspects a draft at 360x800, 390x844, and 412x915 in Default/Large for header order, wrapping, >=44px targets, no overflow, and zero browser errors; builds/installs a Java 21 debug APK and exercises the same header routes without changing owner racing data; obtains independent cavecrew review; and scores strictly.

## Hard bans

No E2, E3, final QA, handoff, sync/data/deletion/queue/pull/ownership/lifecycle/Saved/Quick Adjust/setup-editability change; no new storage key, schema, RLS, migration, Supabase configuration, native source/version, package/config, release/signing, production Netlify publish, Git push, PR, merge, `master`, credentials, account/team/membership mutation, or destructive data test. Preserve all A1-D3 and Chunk D acceptance, local-first behavior, account/team isolation, safe areas, pinch zoom, themes, accessibility, and the exact three-error lint baseline.
