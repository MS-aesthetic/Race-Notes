# Current Task — WS-R: Checklist UI (weekend checklists + template manager)

**Workstream:** WS-R — Checklist UI
**Attempt:** 1
**Files (Primary):** `src/components/RaceWeekendView.tsx`, `src/components/TrackersView.tsx`
**Files (Secondary):** `src/App.tsx`

## Scope

Wire the WS-Q `checklists.ts` engine into UI.

### App.tsx
1. Add `ChecklistTemplate, WeekendChecklist` to type imports.
2. Import sync fns: `pushChecklistTemplates, pullChecklistTemplates, pushWeekendChecklists, pullWeekendChecklists`.
3. Import engine fns: `instantiateTemplate, materializeStarterTemplate, checklistProgress` from `./lib/checklists`.
4. Add state: `checklistTemplates: ChecklistTemplate[]`, `weekendChecklists: WeekendChecklist[]`.
5. Add handlers: `handleSaveChecklistTemplates`, `handleSaveWeekendChecklists`.
6. Pull in cloud sync.
7. Pass `checklistTemplates, weekendChecklists, onSaveWeekendChecklists` to `<RaceWeekendView>`.
8. Pass `checklistTemplates, onSaveChecklistTemplates` to `<TrackersView>`.
9. Add `checklistTemplates, weekendChecklists` to Saved-toast watch list.
10. In `handleDeleteWeekend`: null out `weekendId` on checklists belonging to that weekend (set weekendId to undefined, preserve the list).

### RaceWeekendView.tsx (primary)
1. Add props: `checklistTemplates?: ChecklistTemplate[]`, `weekendChecklists?: WeekendChecklist[]`, `onSaveWeekendChecklists?: (c: WeekendChecklist[]) => void`.
2. Import `ChecklistTemplate, WeekendChecklist` from `../types`; `instantiateTemplate, checklistProgress` from `../lib/checklists`.
3. Inside the Weekend Info Banner section (after the weekend-notes textarea, before `</section>`): add a **Checklists** collapsible sub-section.
   - Shows each attached checklist as a row: name + `done/total` progress ring + tap to expand items.
   - Expanded: shows each `ChecklistItemState` row with checkbox; checking stamps `doneAt + doneBy = user?.id`.
   - "+ Add checklist" button → small sheet modal: lists available templates + "Blank" option.
   - Blank option creates a new WeekendChecklist with empty items array that can be extended.
   - Delete icon per checklist (removes from weekendChecklists by id).

### TrackersView.tsx (primary)
1. Add `'checklists'` to `SubTab` type.
2. Add props: `checklistTemplates: ChecklistTemplate[]`, `onSaveChecklistTemplates: (t: ChecklistTemplate[]) => void`.
3. Add "Checklists" tab to `SUB_TABS`.
4. Implement inline `<ChecklistsTab>` component:
   - Lists templates with name, item count, edit/delete.
   - Edit: toggle expanded to show item list + add/remove/reorder items.
   - "Add template" form (name, category).
   - "Use starter templates" button if no templates yet — calls `materializeStarterTemplate` on each STARTER_TEMPLATE.

## Out of scope
- New-weekend flow template picker (modal post-create) — skip for now.
- Offline team-sync reordering — items just persisted as-is.

## Acceptance criteria
- [ ] Checklists section appears in RaceWeekendView weekend banner; shows progress per checklist.
- [ ] Can attach a template to a weekend, check off items (doneAt stamped).
- [ ] Template manager in Trackers → Checklists: CRUD works, starter templates offered.
- [ ] Weekend delete nulls weekendId on associated checklists (list preserved).
- [ ] `npm run lint` — baseline 3 errors only.
- [ ] `npm run build` — succeeds.

## Human prerequisites
None.

**Workstream:** WS-P — Maintenance UI
**Attempt:** 1
**Files (Primary):** `src/components/TrackersView.tsx`
**Files (Secondary):** `src/App.tsx`, `src/components/DashboardView.tsx`

## Scope

Wire the WS-O `maintenance.ts` engine into actual UI.

### App.tsx (minimal wiring only)
1. Import `MaintenanceComponent, MaintenanceLog` from `./types`.
2. Import `pushMaintenanceComponents, pullMaintenanceComponents, pushMaintenanceLogs, pullMaintenanceLogs, deleteMaintenanceComponentFromCloud, deleteMaintenanceLogFromCloud` from `./lib/sync`.
3. Add state: `maintenance: MaintenanceComponent[]` (init from `race_notes_maintenance`), `maintenanceLogs: MaintenanceLog[]` (init from `race_notes_maintenance_logs`), `trackersSubTab: 'tasks'|'accounting'|'shopping'|'service'` (default `'tasks'`).
4. Handlers: `handleSaveMaintenance`, `handleSaveMaintenanceLogs`.
5. Pull maintenance & logs in the `doPull` cloud-sync effect.
6. Add `maintenance, maintenanceLogs` to Saved-toast watch list.
7. Pass new props to `<TrackersView>` and `<DashboardView>`.
8. Add `race_notes_maintenance` + `race_notes_maintenance_logs` to `handleClearAllData`.

### TrackersView.tsx (primary)
1. Extend `SubTab` to include `'service'`.
2. Add props: `maintenance`, `onSaveMaintenance`, `maintenanceLogs`, `onSaveMaintenanceLogs`, `savedSetups`, `activeCarId`, `initialSubTab?` (replaces local default).
3. Sync `initialSubTab` on mount: `useState(initialSubTab ?? 'tasks')`.
4. Add "Service" tab button.
5. Implement inline `<ServiceTab>` component:
   - Section grouping: **Car** (scope:'car' filtered by activeCarId) + **Rig** (scope:'rig', all).
   - Each row: name · `used/limit unit` (font-mono) · status chip (ok=green/due=yellow/overdue=red) · "Log" button.
   - Empty state: offer `DEFAULT_COMPONENTS` as a starter — "Add defaults" button materializes all into real `MaintenanceComponent` records with generated ids/timestamps.
   - "Add component" button → small form (name, category, scope, intervalType, intervalValue).
   - "Log service" modal: date (default today), type ('service'|'replace'|'inspect'), notes, cost (optional → creates AccountingEntry).
   - Long-press/swipe or delete icon on each row → remove component + its logs.
   - `getComponentStatus(comp, weekends, savedSetups)` drives all status/usage display.
   - `applyServiceLog(comp, log)` used after logging to reset the component's counter.
   - `weekends` prop passed from TrackersView (already in existing props).

### DashboardView.tsx
1. Add props: `maintenance?: MaintenanceComponent[]`, `onGoToService?: () => void`.
2. Import `getComponentStatus` from `../lib/maintenance`.
3. Add `serviceOpen` local state (default `true`).
4. Compute due/overdue items: `maintenance.filter(c => getComponentStatus(c, weekends, savedSetups).state !== 'ok')`.
5. If no due items AND `serviceOpen` false → hide panel entirely. If items exist, show collapsible "Service Due" panel above or below the Open Tasks panel.
6. Each row: name · status chip · tap → calls `onGoToService?.()`.

## Out of scope
- No sync.ts changes (already done by WS-N).
- No new files — ServiceTab stays inline in TrackersView.tsx.
- No WS-R (checklist) changes.

## Acceptance criteria
- [ ] "Service" tab appears in Trackers; shows Car/Rig grouped rows with status chips.
- [ ] "Add defaults" seeds DEFAULT_COMPONENTS on empty state.
- [ ] "Log service" updates the component's `lastServicedAt` and appends a log; counter resets.
- [ ] Dashboard "Service Due" panel shows only due/overdue; tap navigates to Service sub-tab.
- [ ] Car-scoped components respect active car; rig items always visible.
- [ ] `npm run lint` — baseline 3 errors only.
- [ ] `npm run build` — succeeds.

## Human prerequisites
None.
**Files (Primary):** `src/lib/checklists.ts`

## Scope

`src/lib/checklists.ts` already has a near-complete scaffold: `STARTER_TEMPLATES`
(4 templates), `instantiateTemplate(template, weekendId?, weekendName?)`, and
`checklistProgress(list)`. The gap: `STARTER_TEMPLATES` entries have
`items: string[]` (plain labels), but `instantiateTemplate()` requires a real
`ChecklistTemplate` with `items: ChecklistTemplateItem[]` (`{id, text}`). There
is currently no function that turns a starter-template definition into a real,
ID-bearing, user-owned `ChecklistTemplate` — meaning WS-R (UI) would have
nothing to call to actually offer the starter templates to a user.

1. Add `materializeStarterTemplate(starter: typeof STARTER_TEMPLATES[number]): ChecklistTemplate`
   that converts a starter entry into a full `ChecklistTemplate`: generates an
   `id` (reuse the existing `uid()` helper, prefix `'tmpl'`), maps each string
   item to `{ id: uid('tmpli'), text }`, sets `updatedAt` to now.
2. Export it alongside the existing exports.
3. Do not change `STARTER_TEMPLATES` data, `instantiateTemplate`, or
   `checklistProgress`.
4. Do NOT wire into `App.tsx`/UI — that's WS-R.

## Out of scope
- No UI changes, no App.tsx state, no sync.ts changes.
- No changes to the 4 starter template contents/order.

## Acceptance criteria
- [ ] `materializeStarterTemplate()` exists, returns a valid `ChecklistTemplate`
      with unique `id`s for the template and every item.
- [ ] `npm run lint` — baseline 3 errors only, no new errors.
- [ ] `npm run build` — succeeds.
- [ ] Diff confined to `src/lib/checklists.ts`.

## Human prerequisites
None.

<!-- Template (ws-planner fills this in):

# Current Task — WS-x: <title>

**Workstream:** WS-x — <title>
**Attempt:** 1

## Scope
1. ...numbered, concrete implementation steps...

## Files
- Primary: ...
- Shared (touch minimally): ...

## Out of scope
- ...

## Acceptance criteria
- [ ] ...testable bullets ws-qa grades against...

## Human prerequisites
- ...or "none"

## QA findings
_(ws-qa appends numbered findings per failed attempt)_
-->
