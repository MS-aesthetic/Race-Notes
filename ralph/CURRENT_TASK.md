# Current Task — UXF-7 Main Checklist Redesign Proposal

**Status:** AWAITING OWNER DESIGN REVIEW — proposal drafted; no application code changed
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Prerequisite:** UXF-6 closed by SOL QA attempt 2 at feature `6cae6cf`, repair `9d0fb26`, closure `21f05c5`

## Deliverable

Review [`docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md`](../docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md). It maps current source of truth, all item classes and flows, tombstone/resurrection behavior, completed evidence, Dashboard density, empty states, target UX/data model, harness changes, and the proposed UXF-10 build cut with file:line evidence.

## Recommended package

1. Active checklist work first; saved lists/reset/clear/history behind **Manage**.
2. One-tap completion with six-second Undo; completion notes remain optional.
3. Completed work stays collapsed since last reset, then archives to History.
4. Clear hides recurring work until reset, deletes unfinished ad-hoc work, and archives completed evidence.
5. Carry preference applies only to unfinished added jobs.
6. Hidden automatic maintenance stays hidden until next reset, returns then only if still due, and clears after service.
7. Saved-list import is idempotent; active edits do not rewrite saved-list definitions.
8. Dashboard becomes one count/mine launcher with no task-name preview.
9. One optional Todo-item JSON field, `archivedAt`; no SQL migration and no second checklist system.

## Gate

Maxx must approve or redline the proposal before UXF-7 closes and before ws-planner adds UXF-10. Approval may be: `Approve UXF-7 proposal as written`, or specific changes to any numbered recommendation above.

## Out of scope until approval

- No application source, harness, schema, migration, package, native, deploy, push, merge, or APK change.
- No UXF-10 work order or implementation.
- No unrelated maintenance, setup lifecycle, Quick Adjust, accounting, or team-concurrency change.

## Evidence

- Two cavecrew investigations mapped 48 data/behavior evidence points, four item classes, seven resurrection paths, UI density, interaction friction, and harness gaps.
- Proposal contains 74 valid current-source file:line references; automated path/range check passes.
- Final cavecrew proposal review passes with no issues after recurrence, history, and projection wording was reconciled.
- UXF-6 remains complete: focused harness, exact three-error lint baseline, 556-module/18-entry build, migration/schema/RLS/grants, and final cavecrew review passed. Production remains unchanged.
