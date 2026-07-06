# Current Task — WS-O: Maintenance engine (car-scoping fix + finalize)

**Workstream:** WS-O — Maintenance Engine
**Attempt:** 1
**Files (Primary):** `src/lib/maintenance.ts`

## Scope

`src/lib/maintenance.ts` already has a working scaffold (`DEFAULT_COMPONENTS`,
`getComponentStatus`, `applyServiceLog`) but its own comment flags an unresolved
gap: **car scoping is not implemented** — `sessionsSince` sums sessions from
*every* weekend regardless of which car ran them, so a `scope:'car'` component
(e.g. "Engine oil" on Car A) would incorrectly count Car B's laps too.

1. Fix car scoping per plan-v2.md decision #1:
   - `scope: 'rig'` components → count across **all** weekends/cars (unchanged,
     already correct — the hauler goes to every race).
   - `scope: 'car'` components → only count weekends whose bound `Setup`
     (`weekend.setupId` → `savedSetups.find(s => s.id === weekend.setupId)`)
     has a matching `carId`. Weekends with no bound setup, or a bound setup
     with no `carId`, are excluded from car-scoped counting (ambiguous —
     don't guess).
2. Update `getComponentStatus` signature to accept a new `savedSetups: Setup[]`
   parameter (needed to resolve weekend → car). Update the JSDoc comment above
   it to remove the stale "scaffold counts all sessions" caveat once fixed.
3. Import `Setup` type from `../types`.
4. Do NOT touch `applyServiceLog`, `DEFAULT_COMPONENTS`, or add any new exports
   beyond what's needed for the fix above — keep the diff surgical.
5. Do NOT wire this into `App.tsx`, `sync.ts`, or any component — that's WS-P.

## Out of scope
- No UI changes.
- No sync.ts changes (already has maintenance_components/logs push/pull from WS-N).
- No App.tsx state changes.
- No changes to DEFAULT_COMPONENTS catalog values.

## Acceptance criteria
- [ ] `getComponentStatus(component, weekends, savedSetups)` correctly excludes
      other cars' sessions for `scope:'car'` components.
- [ ] `scope:'rig'` components still count all weekends (no regression).
- [ ] `npm run lint` — baseline 3 errors only, no new errors.
- [ ] `npm run build` — succeeds.
- [ ] Diff confined to `src/lib/maintenance.ts`.
- [ ] Stale "scaffold" TODO comment about car-scoping removed/updated to reflect the fix.

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
