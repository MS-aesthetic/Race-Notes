# Plan — Setup tab: full-width fields + preload in lb

Branch: `feature/setup-layout-preload` (off `master` = 5.2.1).
Scope: **two files**, presentation + one field spec. No data-model or schema changes.

## Goal

1. In each corner card (`CornerForm`), make these fields span the **full card width**
   (both columns of the card's inner 2-col grid), instead of sitting in a half-width cell:
   - Tire (inventory picker)
   - Bound Load Graph
   - Spring
   - Shock
   - Shock Note
2. Change **Preload** from inches to **lb**, with **10-lb** stepper increments (whole numbers).

## Context (verified in code)

`src/components/SetupView.tsx` — `CornerForm` renders fields into:
```
<div className="... grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 items-start">
```
So at ≥360px the card is 2 columns; a full-width field needs `min-[360px]:col-span-2`
(at <360px the grid is already 1 column, so it's full-width there automatically).

Current per-field wrappers:
- Tire picker (~line 232): `className="col-span-1 lg:col-span-2 min-w-0 bg-surface-container ..."`
  → spans 2 cols only at `lg`; on a phone it's half-width. **Wrong breakpoint.**
- Bound Load Graph (~line 257): `className="col-span-1 lg:col-span-2 min-w-0 bg-surface-container ..."` — same issue.
- Spring (~line 272): `<div className="min-w-0">` — half-width cell.
- Shock (~line 283): `<div className="min-w-0">` — half-width cell.
- Shock Note (~line 287): `<div className="min-w-0">` — half-width cell.

`src/lib/setupSteps.ts` — `SETUP_STEPS.preload` (line ~43):
```
preload: { step: 0.125, decimals: 3, unit: 'in' },
```
`NumericCornerFieldInput` passes `step`, `decimals`, `unit`, `min` straight to `NumberStepper`,
whose +/- buttons move by `step`. So changing the spec is sufficient for both display and buttons.

## Changes

### File 1 — `src/lib/setupSteps.ts`
Change the `preload` spec to:
```ts
preload: { step: 10, decimals: 0, unit: 'lb', min: 0 },
```
- `step: 10` → +/- buttons move by 10 lb.
- `decimals: 0` → whole numbers.
- `unit: 'lb'` → label shows `lb`.
- `min: 0` → no negative preload.

### File 2 — `src/components/SetupView.tsx`
Add a shared full-width class and apply it to the five fields. Prefer a named constant next to
the existing `STACKED_CORNER_FIELD_CLASS` (~line 77):
```ts
const FULL_WIDTH_CORNER_FIELD_CLASS = 'col-span-1 min-[360px]:col-span-2 min-w-0';
```
Then:
- **Tire picker** wrapper: replace `col-span-1 lg:col-span-2 min-w-0` with
  `${FULL_WIDTH_CORNER_FIELD_CLASS}` (keep the rest of the classes:
  `bg-surface-container p-2 rounded border border-outline-variant/30 flex flex-wrap items-center justify-between gap-2`).
- **Bound Load Graph** wrapper: same replacement (keep the rest of its classes).
- **Spring** wrapper: `min-w-0` → `FULL_WIDTH_CORNER_FIELD_CLASS`.
- **Shock** wrapper: `min-w-0` → `FULL_WIDTH_CORNER_FIELD_CLASS`.
- **Shock Note** wrapper: `min-w-0` → `FULL_WIDTH_CORNER_FIELD_CLASS`.

Leave all other fields (Scale Weight, Ride Height, Caster, Camber, Droop, Preload, Tire
Compound, Tire Size, Pressure, Backspacing, Spring Height) exactly as they are — they stay
two-per-row.

## Do NOT
- Do not change `src/types.ts` (`preload`/`preloadUnit` stay). `preloadUnit` is currently unused.
- Do not add data migration. Existing stored preload values (inches) are left as-is.
- Do not touch the outer LF/RF/LR/RR grid, other components, tests, or version numbers.

## Known consequence (surface to owner, do not "fix")
Existing setups have `preload` stored as inches (e.g. `1.000`). After this change that value is
displayed as `1 lb`, and the first stepper edit snaps it to the nearest 10. This is expected given
the unit switch; owner will re-enter preload where it matters. Not a bug.

## Acceptance criteria (for QA)
1. `npm run build` succeeds (566-ish modules), `npx tsc --noEmit` shows **only the 3 known
   baseline errors** (RaceWeekendView 467, SetupView 889, SmasherLoadsView 617) — no new ones.
2. In `CornerForm`, Tire, Bound Load Graph, Spring, Shock, Shock Note each occupy a full row at
   the 360px phone width (class resolves to `min-[360px]:col-span-2`).
3. Every other corner field remains two-per-row.
4. Preload renders with `lb`, whole numbers, and +/- move by 10 with a floor of 0.
5. No changes outside the two files above; no version/manifest changes.
