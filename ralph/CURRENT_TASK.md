# Current Task — UXF-10 Approved Main Checklist Redesign

**Status:** READY FOR TERRA HIGH INITIAL BUILD
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md` → UXF-10
**Approved design:** `docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md`
**Prerequisite:** Maxx approved UXF-7 as written on 2026-07-14; proposal commit `b1855a6`

## Owner decision

Implement the UXF-7 proposal as written. Preserve one canonical Main Checklist. Do not revive
the separate `WeekendChecklist` model and do not create a new table.

## Required behavior

### 1. Pure lifecycle model

1. Add optional `archivedAt?: string` to `TodoItem`. It remains inside existing Todo `items`
   JSONB; no Supabase migration.
2. Keep `activeChecklistItems(list)` as the shared open-work projection used by Trackers and
   Dashboard: exclude `done`, `removedUntilReset`, and `archivedAt` rows.
3. Add explicit pure projections for:
   - current visible: `!removedUntilReset && !archivedAt`;
   - completed since reset: `done && !removedUntilReset && !archivedAt`;
   - history: `done && archivedAt`.
   Preserve input order and object references where a helper only filters.
4. On first clear/reset/archive lifecycle write, normalize legacy/core recurrence identity to
   `core:<canonicalTodoId>:<itemId>` when missing. Never rewrite archived history later.
5. Pure clear operation:
   - unfinished ad-hoc rows are removed;
   - unfinished core/template/maintenance rows get `removedUntilReset: true`;
   - current completed rows get `archivedAt: now` and keep task, notes, assignee,
     `completionNote`, `completedAt`, source identity, and source cycle;
   - already archived rows stay byte-equivalent;
   - resulting active count is zero.
6. Pure new-weekend/manual reset operation:
   - archives current completed occurrences instead of erasing or reopening them;
   - keeps already archived history unchanged;
   - carries only unfinished ad-hoc rows when preference is ON; removes them when OFF;
   - completed ad-hoc rows never auto-reopen;
   - legacy/core sources receive exactly one open current occurrence;
   - template sources receive exactly one open occurrence only while their saved-list
     definition exists, with current definition text;
   - maintenance sources receive exactly one open current-cycle occurrence only while the
     component remains due;
   - hidden eligible recurring rows return; ineligible template/maintenance rows do not;
   - repeated reset is idempotent and never duplicates active occurrences.
7. Add a pure saved-list import helper keyed by stable
   `template:<templateId>:<templateItemId>` source IDs. Existing active or tombstoned current
   occurrences block duplicates; a tombstone stays hidden until reset. Archived history does
   not block a new active occurrence. Repeated import is idempotent.

### 2. Maintenance reconciliation

1. Keep 90% threshold, component/service-cycle identity, car/rig scope, Races/Days math, and
   service behavior unchanged.
2. While due, an unarchived current-cycle row—including a tombstone—suppresses recreation.
   Archived history does not satisfy active existence.
3. At reset, reopen exactly one occurrence only if the component remains due.
4. Service or below-threshold reconciliation removes unfinished open/tombstoned automatic rows
   for that source. Preserve completed current rows and archived history.
5. Later service cycles may create one new occurrence.

### 3. Checklist UI

1. First screen order: compact **Checklist** header with `N open`, optional `N mine`, and one
   **Manage** button; add-task row immediately follows; active open jobs follow.
2. Keep whole-row completion target at least 56px. Use one 44px-plus overflow/action target per
   row for Edit and Remove. Label destructive action **Remove**; no unexplained close glyph.
   Each active row retains task text, short note when present, and assignee. Preserve the
   existing **My Tasks** filter/count behavior.
3. Checkbox/row completes immediately, exactly once, without required modal. Show a six-second
   Undo action that restores prior item bytes. Completion note remains optional through the
   completed-row action.
4. Completed work appears in a collapsed **Completed since last reset** summary. Each completed
   row offers **Mark open** and **Add/Edit completion note**. Mark open clears completion fields
   and `archivedAt` only for that selected current occurrence. Bulk **Clear completed** stays
   inside **Manage**, not in this summary.
5. Empty active state says **Checklist clear** and offers **Add task** plus
   **Add from saved list**. Do not claim this is the first task.
6. Remove nested task-list scrolling. App/page owns vertical scrolling.

### 4. Manage sheet

Use existing `BottomSheet` so scrim, Escape, and Android Back close correctly. One **Manage**
sheet owns:

- Add from saved list;
- Manage saved lists through existing callback;
- `Carry unfinished added jobs to next weekend` preference using
  `race_notes_keep_added_items`, default ON;
- Reset for new weekend with exact effect confirmation;
- Clear current list with exact effect confirmation;
- Clear completed, archiving current completed occurrences without changing open work;
- View History grouped by completion date.

Active occurrence edits never rewrite saved-list definitions. Permanent definition changes
remain in saved-list management.

### 5. Dashboard

Replace current collapsible task preview with one compact launcher:

- nonzero: `Checklist · N open · M mine` when mine is nonzero;
- zero: `Checklist clear`;
- no task-name preview and no repeated list title/count block.

Use the same `activeChecklistItems()` projection as Trackers. Maintenance Due remains its own
surface.

### 6. Persistence and compatibility

1. Keep App's React/localStorage/cloud Todo dual-write path unchanged.
2. `archivedAt`, tombstones, assignments, completion fields, `sourceId`, and `sourceCycle` must
   survive local JSON and existing `pushTodos`/`pullTodos` JSONB round trip.
3. Missing legacy `kind` remains core. Missing `archivedAt` remains current unless tombstoned.
4. Existing completed rows show under **Completed since last reset** until first clear/reset,
   then archive.
5. No SQL migration, sync-column mapper, data rewrite, or second checklist system.

## Focused harness

Expand `scripts/chunk8-trackers-harness.ts` before broad runtime work. Required fixtures:

1. Trackers/Dashboard shared active projection excludes done, tombstoned, and archived rows.
2. Completed ad-hoc archives, never auto-reopens, and carry toggle affects only unfinished
   ad-hoc rows.
3. Recurring core archives and gets exactly one open occurrence; template does so only when
   its definition exists; maintenance does so only while due. Include zero-occurrence cases.
4. Clear hides recurring open rows, deletes unfinished ad-hoc rows, archives completed rows,
   and produces active count zero.
   Separately, Clear completed archives only completed current rows and preserves open rows.
5. Saved-list import is source-ID-idempotent; tombstone suppresses same-cycle import; archived
   history allows one fresh active occurrence.
6. Hidden due maintenance does not resurrect before reset; reset reopens once; service removes
   unfinished hidden/open rows; completed/history survives; later cycle creates once.
7. Template edit/add/delete/restore remains deterministic without duplicates.
8. Edit/assignment/completion-note provenance and archived history bytes survive.
9. JSON/localStorage and Todo cloud-row round trip preserve all optional lifecycle fields.
10. Source/UI guards require 56px rows, 44px actions, one Manage entry, BottomSheet, concise
    empty state, no Dashboard task previews, and no nested task-list scroll.
11. Completion commits once without opening required modal; six-second Undo restores prior
    bytes; Mark open and note edit remain available.

## Validation and handoff

1. Run focused chunk8 harness first.
2. Run exact three-error lint baseline, production build, and `git diff --check`.
3. Use cavecrew only for bounded trace/review; primary builder owns cross-file implementation.
4. Verify local-first reload and existing cloud Todo mapper round trip. No schema change.
5. Verify 320/390 widths, light/dark, Default/Large, Manage/History/Undo, clear/reset, empty
   state, and Android Back. Create one Netlify draft after coherent PASS; never production.
6. Update `ralph/CURRENT_TASK.md`, `ralph/STATE.md`, `HANDOFF.md`,
   `CODEBASE_KNOWLEDGE.md`, and plan with actual evidence. Commit feature and docs.
7. Return same persistent task to GPT 5.6 SOL High for independent UXF-10 QA. Any QA failure
   stays with SOL fixer; Terra is not re-invoked.

## Out of scope

- No maintenance interval/math change, setup lifecycle, Quick Adjust, Accounting, or team-
  concurrency redesign.
- No new route/store/context, SQL/table, package, native config, production deploy, remote push,
  merge, release APK, or UXF-9 work before SOL PASS.
