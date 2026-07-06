# Current Task — WS-N: Data model & migrations foundation (finish scaffold) — COMPLETE, see STATE.md

**Workstream:** WS-N — Data Model & Migrations Foundation v2
**Attempt:** 1

## Scope
1. Add `sync.ts` push/pull/delete mappers for the five new v2 entities, following
   the existing debounced-upsert pattern (`pushTires`/`pushCars` style):
   - `maintenance_components` (MaintenanceComponent)
   - `maintenance_logs` (MaintenanceLog)
   - `checklist_templates` (ChecklistTemplate)
   - `weekend_checklists` (WeekendChecklist)
   - `saved_trips` (SavedTrip)
2. Add `data.ts` empty-array/default bootstrap constants for each new entity
   (mirrors `INITIAL_TODOS`/`INITIAL_CARS` pattern): `INITIAL_MAINTENANCE_COMPONENTS`,
   `INITIAL_MAINTENANCE_LOGS`, `INITIAL_CHECKLIST_TEMPLATES`,
   `INITIAL_WEEKEND_CHECKLISTS`, `INITIAL_TRIPS`. Truck profile default already
   exists as `DEFAULT_TRUCK_PROFILE` in `types.ts` — no data.ts change needed there.

## Files
- Primary: `src/lib/sync.ts`, `src/data.ts`

## Out of scope
- No `App.tsx` wiring (that's WS-O/P/Q/R/W's job — they consume these mappers).
- No UI components. No starter checklist templates (WS-Q owns those in
  `checklists.ts`). No maintenance derivation logic (WS-O owns `maintenance.ts`).

## Acceptance criteria
- [ ] `npm run lint` — zero errors beyond 3-error baseline
- [ ] `npm run build` succeeds
- [ ] All 5 entities have push + pull + delete-from-cloud helpers in `sync.ts`
- [ ] Mapper field names match migrations 011–013 column names exactly
- [ ] `data.ts` exports empty-array defaults for all 5 new entities
- [ ] No `App.tsx`, UI, or types.ts changes in this diff

## Human prerequisites
None — this diff only adds library code, no migrations are applied.

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
