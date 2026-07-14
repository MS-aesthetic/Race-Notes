# Current Task — UXF-9 Final Batch QA and Owner Acceptance

**Status:** READY — SOL TECHNICAL GATE
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md` → UXF-9
**Prerequisites:** UXF-1…8 and UXF-10 complete. UXF-10 feature `3b40a1e`, SOL repair
`075be90`, and QA attempt 2 PASS on 2026-07-14.

## Goal

Run one final whole-batch technical and runtime gate, publish one final Netlify draft, then
walk Maxx through the ten UX corrections. Technical PASS does not close UXF-9. Only Maxx's
item-by-item product acceptance closes Sprint 1 and unlocks Sprint 2.

## Execution owner and repair routing

1. GPT 5.6 SOL High owns the UXF-9 technical gate and acceptance record.
2. Do not start a feature build. If a regression is found, record the exact failed acceptance
   item, make the smallest SOL-fixer repair, add a focused regression fixture, and repeat the
   affected gate before continuing.
3. Use cavecrew only for bounded tracing and final diff review. The primary agent owns the
   cross-cutting gate and any SOL repair.
4. Do not invoke Terra for UXF-9 failures.

## Required technical gate

### 1. Automated regression

Run every current focused harness:

- `scripts/chunk5-setup-harness.ts`
- `scripts/chunk5-tires-harness.ts`
- `scripts/chunk6a-refinement-harness.ts`
- `scripts/chunk6b-lifecycle-harness.ts`
- `scripts/chunk7-quick-adjust-harness.ts`
- `scripts/chunk8-trackers-harness.ts`
- `scripts/chunk9-export-help-harness.ts`
- `scripts/ux-r1-starters-harness.ts`
- `scripts/ux-r1-color-harness.ts`

Also rerun the sync/lifecycle checks named in `HANDOFF.md`. Assertions must reflect only
approved UXF behavior; do not weaken a check to obtain PASS.

### 2. Repository gate

1. `npm run lint` shows exactly the three documented pre-existing errors and no new error.
2. Windows production build succeeds.
3. `git diff --check` passes and the worktree is clean before deployment.
4. Cavecrew final review finds no blocker in the full Sprint 1 range.

### 3. Data and runtime gate

Verify without destructive live-data cleanup:

1. Offline/local-first reload preserves current data and the signed-in device fallback.
2. Authenticated cloud round trip preserves:
   - a coalesced Quick Adjust `changeLog` entry;
   - Starting / Live-Trackside / Current / Raced-or-Finished lifecycle bytes and display;
   - a checklist `removedUntilReset` tombstone plus archived/completion fields;
   - UXF-6 maintenance `starting_usage` and Races/Days behavior.
3. Car-scoped setup/tire/load data and rig-global maintenance remain correctly scoped.
4. Team-visible deletion paths and local/cloud merge behavior remain intact.
5. If authenticated cloud evidence is unavailable, disclose it. Do not claim a pass from a
   signed-out preview shell or pure mapper alone.

### 4. Display and device gate

1. Verify 320px and 390px mobile widths in light and dark themes at Default and Large size.
2. Verify Dashboard, Setup lifecycle, Quick Adjust, travel/load graphs, Tuning Guide/App Guide,
   Main Checklist/Manage/History/Undo, Maintenance Logs, Accounting, and PDF share/download.
3. Verify Android Back closes sheets/help before app exit. Use the existing debug build path
   only if needed; do not create or copy a release APK or change native version/config.
4. Absorb the remaining WS-Z authenticated/offline/theme/zoom/mobile checks and record WS-Z
   complete only when their evidence is real.

### 5. Final draft

After the local gate is coherent, create exactly one new Netlify draft. Never deploy production.
Hard-refresh the unique draft and repeat the signed-out shell plus every authenticated check the
origin permits. Record the exact URL and distinguish draft evidence from Android/local evidence.

## Owner walkthrough

Present the final draft to Maxx and record accept/reject for each correction:

1. Cleared checklist jobs stay off Dashboard and Maintenance category has one Other.
2. Quick Adjust shows one net result per field/run instead of every tap.
3. Setup progression reads Starting → Live-Trackside → Current → Raced/Finished.
4. Load graphs rise with compression using Travel while retaining measured Height.
5. Tuning Guide starts with the adjustment finder; operating help stays in App Guide.
6. Maintenance uses only Races/Days, starting usage, correct defaults, and reset behavior.
7. Main Checklist design: active-first list, completion evidence, Manage, clear/reset/history.
8. Documentation/agent routing follows Sprint index, preview-v3, and first-failure SOL policy.
9. Export/share, contextual help, language, two sizes, contrast, and mobile presentation remain
   accepted from the completed product chunks.
10. Whole-app offline/cloud/car-scope behavior is acceptable on the final draft/device.

Record each answer in `ralph/STATE.md`. If Maxx rejects an item, keep UXF-9 open and create a
scoped follow-up work order. If all ten are accepted, close UXF-9, Sprint 1, and WS-Z as supported
by evidence; then update `SPRINT_INDEX.md` to unlock Sprint 2.

## Deliverables

- Exact command/runtime/cloud evidence in `ralph/STATE.md`, `HANDOFF.md`, and
  `CODEBASE_KNOWLEDGE.md`.
- One final Netlify draft URL.
- Ten-item owner acceptance record.
- Technical PASS state must read **AWAITING OWNER ACCEPTANCE**, not complete.

## Prohibited actions

No production deploy, remote push, branch merge, Supabase schema/data rewrite, package change,
native configuration change, release APK, or Sprint 2 application work.

## UXF-10 closure evidence — 2026-07-14

- SOL QA attempt 1 found two blockers and recorded them in `183a20d`.
- SOL repair `075be90` makes reset prefer the current visible recurrence over a hidden duplicate
  and prevents nested keyboard controls from triggering row completion.
- Expanded Chunk 8 harness PASS, exact known three-error lint baseline, 557-module / 18-entry
  production build PASS, `git diff --check` PASS, clean tree, and cavecrew re-review no issues.
- Draft `https://6a56c2018589bea4d591667d--crew-chief-race-notes.netlify.app/` remains the
  UXF-10 feature draft. Independent signed-out checks passed at 320px and 390px with no overflow
  or console warnings. It predates the narrow SOL repair; no second draft was created because
  UXF-10 authorized one draft. Repair was adjudicated through source, harness, lint, build,
  diff, and review evidence. Terra's earlier signed-in Android runtime evidence remains valid.
- UXF-10 is complete. No SQL, production deploy, push, merge, package/native change, or release
  APK occurred during QA/repair.
