# Current Task — UXF-1 Duplicate Other + Shared Active Checklist Projection

**Status:** IN_PROGRESS — Terra initial build attempt 1
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Prerequisite:** UXF-8 closed by SOL QA attempt 3 at `780e4dd`

## Goal

Fix duplicate Maintenance category and make Dashboard/Main Checklist use one active-item projection.

## Scope

1. Remove hardcoded duplicate `<option value="Other">Other</option>` after `MAINTENANCE_CATEGORIES` mapping in `src/components/TrackersView.tsx`. Audit other selects over that constant for same pattern.
2. Add pure `activeChecklistItems(list: Todo): TodoItem[]` to `src/lib/mainChecklist.ts`, returning `(list.items ?? []).filter(item => !item.removedUntilReset)`.
3. Replace `ToDoView.tsx` inline active-item filtering with shared selector; visible behavior stays byte-identical.
4. Build `DashboardView.tsx` `openItems`, `assignedToMe`, and `openTaskCount` from `activeChecklistItems(mainChecklist)` plus existing done/assignment filters.
5. Extend `scripts/chunk8-trackers-harness.ts` with removed core item and done/open projection assertions.

## Files

**Primary:**
- `src/components/TrackersView.tsx`
- `src/components/DashboardView.tsx`
- `src/lib/mainChecklist.ts`

**Shared:**
- `src/components/ToDoView.tsx`
- `scripts/chunk8-trackers-harness.ts`

## Out of scope

- No checklist model or UX redesign.
- No automatic-item resurrection policy changes.
- No copy or Tuning Guide changes.
- No maintenance interval or “Measure by” changes.
- No schema, package, native, deploy, push, merge, or APK work.

## Acceptance

1. Maintenance Category lists `Other` exactly once; new, edited, and legacy `Other` values remain valid.
2. Removed unfinished core item disappears from Dashboard count/list immediately and stays aligned after persisted/cloud JSON round trip without schema change.
3. `ToDoView` active items remain behaviorally identical after selector extraction.
4. Expanded chunk8 harness passes.
5. `npm run lint` shows exact three-error baseline only; `npm run build` passes; `git diff --check` passes.
6. Cavecrew review finds no blocker.

## Routing

Terra owns this one initial build pass. Commit feature and durable handoff evidence, then return to SOL High for independent QA. Any QA failure transfers repair to SOL fixer.
