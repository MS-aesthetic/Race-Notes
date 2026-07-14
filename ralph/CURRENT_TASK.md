# Current Task — UXF-1 Duplicate Other + Shared Active Checklist Projection

**Status:** COMPLETE — SOL QA attempt 1 PASS
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

## Implementation evidence

- Feature commit: `94d1e79`.
- `MAINTENANCE_CATEGORIES` remains sole source for Maintenance category options; `Other` appears once. No equivalent duplicate select exists.
- `activeChecklistItems` is pure, preserves item order/object references, and is shared by ToDo and Dashboard projections.
- Harness covers removed unfinished core items, open/done counts, JSON round trip, shared-selector source wiring, and single `Other`; PASS.
- `npm run lint`: exact three known baseline errors only.
- `npm run build`: PASS, 554 modules and 18 PWA precache entries.
- `git diff --check`: PASS. Cavecrew investigator found no additional duplicate; reviewer: `No issues.`
- No schema, storage shape, package, native, deploy, push, merge, or APK change.

## QA verdict

**PASS — 97.** Feature diff matches UXF-1 exactly. Category mapping renders `Other` once; shared selector is pure and preserves order/object references; ToDo behavior stays equivalent; Dashboard open/mine/count use same active projection; JSON round trip, focused harness, exact three-error lint baseline, 554-module/18-entry build, diff check, clean tree, and cavecrew review pass. UXF-1 closed.
