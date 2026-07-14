# Main Checklist Redesign Proposal — UXF-7

**Status:** Approved by Maxx as written on 2026-07-14 · UXF-10 build unlocked
**Branch:** `preview-v3`
**Goal:** one clear active list, predictable clear/reset behavior, preserved completion history, and no stale Dashboard tasks.

## Recommendation

Keep one canonical Main Checklist. Make active work the first thing racers see. Move saved lists, reset choices, clear actions, and history behind one **Manage** action. Keep completed work as evidence, but move past-weekend completion out of the active list. Reduce Dashboard to one compact checklist launcher instead of repeating task rows.

Use one optional `TodoItem.archivedAt` field inside the existing `todos.items` JSONB. No new table or SQL migration. Existing `kind`, `sourceType`, `sourceId`, `sourceCycle`, and `removedUntilReset` remain the identity and recurrence controls (`src/types.ts:384-410`; `src/lib/sync.ts:467-500`).

## 1. Current source of truth

| Area | Current authority | Evidence |
|---|---|---|
| Persisted state | `App.tsx` hydrates `race_notes_todos`, canonicalizes it, then every save writes React state, localStorage, and optional cloud sync. | `src/App.tsx:119-125`, `src/App.tsx:272-276` |
| Canonical list | `getMainChecklist()` chooses the named non-template list, with stable fallback. `materializeMainChecklist()` merges older non-template lists and retires source rows as templates. | `src/lib/mainChecklist.ts:6-12`, `src/lib/mainChecklist.ts:25-74` |
| Active projection | `activeChecklistItems()` currently excludes only `removedUntilReset`. | `src/lib/mainChecklist.ts:14-17` |
| Trackers | `ToDoView` reads the canonical list, then divides the shared active projection into open, completed, and My Tasks. | `src/components/ToDoView.tsx:103-116`, `src/components/ToDoView.tsx:242-251` |
| Dashboard | Dashboard reads the same canonical list and shared projection, then counts only open rows. UXF-1 fixed the earlier hidden-item mismatch. | `src/components/DashboardView.tsx:107-114` |
| Saved lists | Checklist templates are separate records. Import copies template items into Main Checklist as Todo items. | `src/components/ToDoView.tsx:135-149`, `src/App.tsx:161-167` |
| Weekend checklists | `WeekendChecklist[]` still exists, is instantiated/synced separately, and does not own current Main Checklist UI. | `src/App.tsx:164-168`, `src/lib/checklists.ts:94-112`, `src/lib/sync.ts:617-711`, `src/App.tsx:1860-1884` |

Recommendation: do not revive the separate Weekend Checklist model. It would create two competing task systems. Continue with one canonical Main Checklist.

## 2. Current behavior matrix

| Item type | Created by | Complete/edit/assign | Remove now | New-weekend reset |
|---|---|---|---|---|
| Manual ad-hoc | Add form creates `kind:'adhoc'`, `sourceType:'manual'`, with optional notes/assignee. | Completion records note/time; edit preserves provenance and updates text/notes/assignee. | Physically deleted. | Keep ON resets it open and erases completion evidence; Keep OFF deletes it. |
| Legacy/core | Missing `kind` reads as core. | Same completion/edit path. | Hidden with `removedUntilReset`. | Returns open; previous note/time is erased. |
| Saved-list/template | Import creates core rows with stable `template:<template>:<item>` source IDs. | Same completion/edit path. | Hidden with `removedUntilReset`. | Existing definitions return/update; missing definitions stay hidden unless completed; newly added definitions materialize. |
| Automatic maintenance | Reconciliation creates core rows with stable component source and service-cycle ID at 90%. | Same completion/edit/assignment path. | Hidden with `removedUntilReset`. | Completed evidence stays and an open same-cycle copy is created; unfinished hidden row returns. |

Evidence: `src/lib/checklistMaintenance.ts:8-10`, `src/components/ToDoView.tsx:135-175`, `src/components/ToDoView.tsx:178-230`, `src/lib/checklistMaintenance.ts:14-77`, `src/lib/checklistMaintenance.ts:94-145`.

## 3. Why current experience feels unpredictable

1. Management controls come before trackside work. Main Checklist title/help, Edit List, import, preference, and reset occupy one card; another card repeats list framing and counts before the add field and tasks (`src/components/ToDoView.tsx:310-385`).
2. Same close icon means two different outcomes: recurring/core work is hidden until reset, while ad-hoc work is deleted (`src/components/ToDoView.tsx:199-203`, `src/components/ToDoView.tsx:503-515`).
3. Reset confirmation mentions completion marks and notes, but not hidden-item return, template re-materialization, or ad-hoc removal (`src/components/ToDoView.tsx:232-240`, `src/components/ToDoView.tsx:343-350`).
4. Completed rows stay inline with active work and use nearly full-size cards (`src/components/ToDoView.tsx:530-613`). Most completed non-maintenance evidence is then erased or deleted at reset (`src/lib/checklistMaintenance.ts:28-47`).
5. Dashboard repeats Main Checklist name, open count, assigned count, and up to three task names inside a section whose title already has the count (`src/components/DashboardView.tsx:391-445`).
6. Dashboard may correctly say “clear” while Checklist still shows completed rows. The two screens use different meanings of clear (`src/components/DashboardView.tsx:402-408`, `src/components/ToDoView.tsx:541-619`).
7. Empty active list can say “Add your first task” while hidden recurring jobs still exist and will return (`src/components/ToDoView.tsx:616-619`, `src/lib/checklistMaintenance.ts:37-46`).
8. Re-importing a saved list appends new random-ID rows without checking stable source IDs, so duplicate jobs are possible (`src/components/ToDoView.tsx:135-149`).
9. Row action glyphs are smaller than the 56px row target, and nested app/Trackers/task-list scrolling makes mobile ownership harder to follow (`src/components/ToDoView.tsx:469-515`, `src/components/ToDoView.tsx:545-610`, `src/components/TrackersView.tsx:930-970`).

## 4. Current resurrection map

- Removing a core, template, or automatic job sets `removedUntilReset`; both Dashboard and Trackers hide it now (`src/components/ToDoView.tsx:199-203`, `src/lib/mainChecklist.ts:14-17`).
- Reset clears that tombstone on retained rows, so hidden recurring jobs return (`src/lib/checklistMaintenance.ts:28-47`).
- Reset scans imported saved-list definitions and adds definitions missing from Main Checklist (`src/lib/checklistMaintenance.ts:19-25`, `src/lib/checklistMaintenance.ts:49-59`).
- A template item deleted from its saved list keeps completed evidence visible but leaves unfinished occurrence tombstoned; restoring the definition allows it to return on a later reset (`src/lib/checklistMaintenance.ts:31-46`).
- Completed automatic maintenance is preserved and reset creates an open same-cycle copy when none exists (`src/lib/checklistMaintenance.ts:36`, `src/lib/checklistMaintenance.ts:61-75`).
- Maintenance reconciliation does **not** immediately resurrect a deliberately hidden same-cycle row because tombstones still satisfy the current existence check (`src/lib/checklistMaintenance.ts:138-145`).
- Servicing below 90% or deleting the component removes unfinished automatic rows but preserves completed ones (`src/lib/checklistMaintenance.ts:146-157`). A later due cycle may create a new row (`src/lib/checklistMaintenance.ts:138-145`).
- Reconciliation runs after cloud hydration and whenever maintenance, weekends, setups, or Todos change, then persists any change (`src/App.tsx:447-454`).

## 5. Proposed screen structure

### Trackers → Checklist

1. Compact header: **Checklist**, `N open`, optional `N mine`, and one **Manage** button.
2. Add-task row immediately below header.
3. Active open jobs first. Each 56px row shows checkbox, task, short note when present, and assignee. One 44px-plus overflow action owns Edit and Remove.
4. Checkbox completes immediately and shows Undo. Completion note stays available as an optional row action; it no longer blocks every check-off behind a modal. Current mandatory modal path is at `src/components/ToDoView.tsx:15-80`, `src/components/ToDoView.tsx:178-197`.
5. **Completed since last reset** becomes a collapsed summary, not full rows mixed into active work. This global list has no weekend ID; its cycle boundary is the most recent manual reset or automatic new-weekend reset (`src/components/ToDoView.tsx:237-240`, `src/App.tsx:1194-1195`).
6. Empty state: **Checklist clear** with `Add task` and `Add from saved list`. No claim that this is the user's first task.

### Manage sheet

- Add from saved list.
- Manage saved lists.
- `Carry unfinished added jobs to next weekend` toggle. Reuse current preference key `race_notes_keep_added_items` (`src/lib/checklistMaintenance.ts:5`, `src/components/ToDoView.tsx:232-235`).
- Reset for new weekend.
- Clear current list.
- View history.

This removes the large management card before active work while preserving every capability currently at `src/components/ToDoView.tsx:310-352`.

### Dashboard

Use one compact launcher:

`Checklist · 5 open · 2 mine`

When zero: `Checklist clear`.

Do not preview three task names. Maintenance Due remains its own quick-service surface (`src/components/DashboardView.tsx:341-389`); removing checklist task previews prevents the same maintenance job appearing twice by name. Current duplicated Checklist rendering is at `src/components/DashboardView.tsx:391-445`.

## 6. Proposed rules

### Completion and history

- Completing a job keeps it in **Completed since last reset** with completion time, note, and assignee.
- Completion is one tap with a six-second Undo. After Undo expires, the completed row remains in the collapsed section; its menu offers **Mark open** and **Add/Edit completion note**. Mark open clears completion time/note using the existing reopen behavior (`src/components/ToDoView.tsx:178-197`).
- `Clear completed` or a new-weekend reset sets `archivedAt` instead of deleting or reopening that completed occurrence.
- History shows archived rows grouped by completion date. Past rows never count on Dashboard and never appear in active work.
- Eligible recurring jobs get a fresh open occurrence after reset; archived occurrence remains unchanged. Core sources always qualify, template sources qualify only while their saved-list definition exists, and maintenance sources qualify only while still due.
- Manual ad-hoc jobs never auto-reopen during reset after completion; explicit **Mark open** remains available. This removes current Keep-ON behavior that erases their evidence and reopens them (`src/lib/checklistMaintenance.ts:28-47`).

### Remove and clear

- Row action says **Remove**, not an unexplained close icon.
- Removing unfinished ad-hoc work deletes it.
- Removing unfinished core/template/automatic work hides it until the next checklist reset with `removedUntilReset`.
- **Clear current list** performs those same rules in bulk and archives completed rows. Dashboard count becomes zero immediately because both screens share the active projection (`src/lib/mainChecklist.ts:14-17`, `src/components/DashboardView.tsx:107-114`).

### New weekend

- Creating a weekend and the manual Reset action call one pure reset path; App already automatically resets during weekend creation (`src/App.tsx:1194-1195`).
- Completed occurrences archive.
- Eligible hidden recurring jobs return.
- Legacy/core sources get exactly one open occurrence. Template sources reopen only while their saved-list definition still exists. Maintenance sources reopen only while the component remains due.
- Only **unfinished** ad-hoc jobs follow the carry preference. ON carries them; OFF removes them. Completed ad-hoc history is preserved either way.

### Saved lists

- Import by stable `sourceId`, not random occurrence ID alone. Match only current active or tombstoned occurrences; archived history does not block a new active occurrence. Importing the same saved list twice therefore adds no duplicate current jobs, while a previously completed/archived occurrence can be used again.
- Editing an active occurrence changes this weekend only. Editing a saved list changes future imports/resets. Current edit helper already preserves provenance (`src/lib/checklistMaintenance.ts:94-104`).
- Removing a saved-list occurrence hides it until reset. Permanent definition removal happens in Saved Lists.

### Automatic maintenance

- At 90%, create one active job for current component/service cycle. Keep stable `sourceId` and `sourceCycle` (`src/lib/checklistMaintenance.ts:107-145`).
- Removing it hides it until next checklist reset. Reconciliation must count a current-cycle tombstone as suppression, but must ignore archived history when deciding whether active work exists.
- Service/below-threshold removes unfinished active or hidden rows only. Completed/archived evidence stays (`src/lib/checklistMaintenance.ts:146-157`).
- If still due at next weekend, reset opens one job. A later service cycle can create one new job.

## 7. Minimal data-model change

Add one optional JSON field:

```ts
archivedAt?: string;
```

Target projections:

- Current visible: `!removedUntilReset && !archivedAt`
- Active open: `!done && !removedUntilReset && !archivedAt`
- Completed since reset: `done && !removedUntilReset && !archivedAt`
- History: `done && archivedAt`

Template and maintenance rows already have stable recurrence identity in `sourceId`; maintenance already has `sourceCycle` (`src/types.ts:401-410`). Legacy core rows receive deterministic `sourceId = core:<canonicalTodoId>:<itemId>` on the first clear/reset/archive lifecycle write. `materializeMainChecklist()` already makes conflicting item IDs stable before that normalization (`src/lib/mainChecklist.ts:25-47`). The new source ID persists through the existing Todo save path (`src/App.tsx:272-276`). Manual ad-hoc rows need no recurrence identity.

Cloud compatibility: `pushTodos()` writes the whole `items` array into JSONB and `pullTodos()` restores it unchanged (`src/lib/sync.ts:467-500`). Therefore `archivedAt` needs a TypeScript addition and mapper/harness coverage, but no Supabase migration. Whole-Todo timestamp merge behavior remains unchanged (`src/App.tsx:751-771`).

Legacy behavior:

- Missing `kind` remains core (`src/lib/checklistMaintenance.ts:8-10`).
- Missing `archivedAt` remains current/visible unless tombstoned.
- Existing completed rows remain “Completed since last reset” until first reset, then archive.
- Existing tombstones remain hidden until reset.

## 8. Follow-on build cut: UXF-10 after approval

### Include

1. Pure checklist lifecycle helpers: active/current-completed/history projections, archive, clear, reset, stable recurrence identity, and idempotent saved-list import.
2. Explicit automatic-maintenance suppression rules described above.
3. ToDoView structure: compact header, add first, Manage sheet, active rows, collapsed completed, history sheet, clear/reset confirmations that state exact effect.
4. Dashboard single-line launcher with shared projection; no task preview rows.
5. Preserve edit/assignment/completion note, local-first writes, cloud JSONB, My Tasks, templates, and 90% maintenance behavior.
6. Focused 320/390 Default/Large light/dark, offline reload, authenticated JSONB round trip when available.

Expected source scope: `src/types.ts`, `src/lib/mainChecklist.ts`, `src/lib/checklistMaintenance.ts`, `src/components/ToDoView.tsx`, `src/components/DashboardView.tsx`, small App wiring only if Manage sheet/back behavior requires it, and `scripts/chunk8-trackers-harness.ts`.

### Reject/defer

- No new checklist table or SQL migration.
- No switch to separate `WeekendChecklist` records.
- No deleting completed evidence on reset.
- No immediate resurrection of a hidden automatic job during same weekend.
- No full completed-history cards inside active work.
- No Dashboard task-name preview.
- No team-concurrency redesign; current whole-Todo last-timestamp merge stays.
- No unrelated maintenance interval, setup lifecycle, Quick Adjust, or accounting changes.

## 9. Required harness changes

Current chunk8 fixtures lock core reopening with erased evidence, Keep-toggle deletion/reopen, template re-materialization, automatic history, and shared projection (`scripts/chunk8-trackers-harness.ts:18-91`, `scripts/chunk8-trackers-harness.ts:191-217`). UXF-10 must replace/extend them with:

1. Shared projection excludes tombstoned and archived rows for both Dashboard and Trackers.
2. Completed ad-hoc archives and never reopens; carry toggle affects only unfinished ad-hoc.
3. Completed recurring occurrence archives. Reset creates exactly one fresh open occurrence for core sources, for template sources whose saved-list definition still exists, and for maintenance sources still due; it creates none for deleted templates or maintenance no longer due.
4. Clear active list hides recurring open rows, deletes unfinished ad-hoc, archives completed, and immediately produces Dashboard count zero.
5. Repeated saved-list import is idempotent by source ID.
6. Hidden due maintenance does not resurrect before reset; reset reopens once; service removes unfinished hidden/open rows; completed history survives; later cycle creates one new task.
7. Template edit/add/delete/restore remains deterministic without duplicate occurrences.
8. Edit/assignment/completion notes preserve provenance and history bytes.
9. JSON/localStorage/cloud round trip preserves `archivedAt`, tombstones, assignment, completion, and source identity.
10. Source/UI checks require 44px-plus row actions, single Manage entry, no Dashboard task preview, concise empty state, and no nested task-list scroll container.
11. Checkbox completion commits once without opening a required modal; Undo restores prior bytes; optional completion-note editing remains available.

## 10. Approval checklist

Recommended approval package:

- [x] Active work first; management behind **Manage**.
- [x] Dashboard shows count/mine summary only, no task-name preview.
- [x] Completed work stays collapsed since last reset, then moves to History.
- [x] Checkbox completes immediately with six-second Undo; completed rows can be marked open and completion notes remain optional/editable.
- [x] Clear hides recurring jobs until reset, deletes unfinished ad-hoc jobs, and archives completed work.
- [x] Carry preference applies only to unfinished added jobs.
- [x] Hidden automatic maintenance stays hidden until next reset, returns only if still due, and clears after service.
- [x] Saved-list import is idempotent; active edits do not rewrite saved-list definitions.
- [x] One optional JSON field (`archivedAt`), no SQL migration, no second checklist system.

Maxx approved this package as written on 2026-07-14. UXF-10 implements this exact package.
