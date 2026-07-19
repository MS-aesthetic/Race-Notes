# Current Task — Final QA Repair 1: Modernize the Muted-Text Harness

**Status:** ACTIVE bounded SOL High repair after final full-sprint QA attempt 1 failed 96/100 at clean governance HEAD `306c6fe0f383d22dca765f40d76b9e6f3d35ba20`.
**Branch/worktree:** existing `codex/ux-overhaul` at `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`; do not create or switch any branch or worktree.
**Implementation runtime:** persistent `gpt-5.6-sol` High worker only. Primary `gpt-5.6-sol` Extra High remains QA and plan authority. Terra at every tier and `cavecrew-builder` are forbidden.
**Owner approval:** Maxx authorized the primary to approve subordinate task scopes when required. The primary approves exactly this one-file harness-only repair. No product change is approved or indicated.
**Communication/delegation:** `/caveman full`; cavecrew investigator/reviewer contracts only.

## Failure evidence

The final raw Windows matrix is exactly 23/24. `scripts/muted-text-color-harness.ts` stops at line 71 because current `src/components/RaceWeekendView.tsx` has 15 `text-on-surface-muted` sites while the historical inventory expects 16.

This is a stale harness, not a product regression:

- `e8d7016^` has 16 sites; accepted C3 commit `e8d70165ca7600e3b47d597e444fc953e6624fc7` and current product have 15.
- C3 intentionally removed the obsolete disabled `Compare setup` action, including its `text-on-surface-muted opacity-40 cursor-not-allowed` branch.
- C3 replaced that mutable comparison with frozen per-session `Bound setup changes` plus `Log setup changes` navigation.
- `scripts/chunk5-setup-harness.ts` already behaviorally and mutation-binds the bound renderer, exact snapshot rows, legacy removal, navigation wiring, and button callback.
- Independent cavecrew review also found latent stale locks after the first failure: current components, Four Bar, source-diff scope, and CSS are compared to historical parents despite accepted later changes.

## Authorized file

- `scripts/muted-text-color-harness.ts`

Every product file is frozen. Do not restore the old Compare action or muted token. Do not edit Ralph, plan, owner report, handoff, Git history outside the single task commit, generated output, dependencies, native files, schema/RLS/migrations/edge code, package/config, or any other harness.

## Required repair

Modernize the harness without weakening the original UXP-17 proof:

1. Keep current-tree global assertions for zero old alpha utilities, no replacement hex in JSX/TS, exact dark/light muted tokens, contrast on all named surfaces, and preservation of semantic status token families.
2. Preserve the original migration proof at pinned history: parent `a68731a`, implementation `89845e8`, exactly 105 migrated alpha tokens across 16 components, eight original opacity exceptions, and exactly 17 changed source files including `src/index.css`.
3. Run the historical component reverse-byte checks against `89845e8` contents, not the evolved current files.
4. Run the historical CSS reverse-byte check against `89845e8` CSS, while leaving current CSS token and contrast checks bound to HEAD.
5. Pin the phone-layout reversal to implementation commit `d047791`, not current Four Bar bytes.
6. Model exact current deltas from the original inventory: `SetupView.tsx` is `+1`, `RaceWeekendView.tsx` is `-1`, all other components are unchanged, current total is exactly 105, and the same 16 components contain muted utilities.
7. Bind the Race Weekend `-1` delta to exact C3 commit `e8d7016` and parent `3559282fc02f5e28d24e08155673defeab060e4c`: the old disabled Compare block is gone and the bound-summary/Log replacement is present.
8. Assert exactly seven surviving current opacity exceptions and exact zero for the removed C3 Compare opacity branch.
9. Add independent mutation proof that fails if the removed disabled Compare muted site is reintroduced, the accepted `-1` delta is lost, a current muted token or declaration is removed, an old alpha utility returns, or a required historical migration/exception is changed. Every mutation must change its target and be killed by the advertised assertion.
10. Make Git reads and EOL handling Windows-safe and deterministic. Do not use current whole-file equality to historical parents.

## Required worker gates

- `npx tsx scripts/muted-text-color-harness.ts` passes and prints exact assertion/mutation totals.
- Demonstrate every new mutation changes the intended source and is killed.
- Run all 24 `scripts/*-harness.ts` files in one raw Windows capture: exact 24/24 required.
- Run the focused cross-task set from the final-QA work order, including `chunk5-setup-harness.ts`, `setup-touch-target-harness.ts`, `saved-flash-harness.ts`, lifecycle, Quick Adjust, offline/resume, D1/D2/D3, help, labels, native auth, and confirmation.
- `npm run lint` reports exactly the three known baseline errors and no new error.
- `npm run build` succeeds with exactly 566 transformed modules.
- Exact one-file diff, `git diff --check`, protected paths unchanged, and clean worktree after one task-identifying commit.
- Obtain cavecrew reviewer findings-first PASS.

## Independent QA after worker

Primary reruns the repaired harness, its mutation audit, the raw 24/24 matrix, focused cross-task group, exact lint/build, ancestry/scope/protected/clean checks, and cavecrew review. Product bytes must remain identical to `f6e918174cc22a16eeabf59ef106bcb26b97a8b2` plus prior accepted product ancestry. A PASS resumes the remaining final browser, Android, authorized data-cleanup, whole-branch boundary, Part 6.4 handoff, governance, draft/debug artifact, and saving-point push gates. A FAIL receives an exact new SOL High repair order with the failure count carried forward.

## Hard bans

No product edits; no primary implementation before three consecutive failed repair attempts; no Terra; no `cavecrew-builder`; no other harness; no credential disclosure/storage; no live data mutation during this repair; no deploy; no APK build; no push; no PR; no merge/master; no production Netlify; no release/signing; no schema/RLS/migration/edge; no Sprint 4 IA.
