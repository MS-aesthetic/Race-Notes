# Current Task — UXF-4 Load Graph Travel Axis

**Status:** CODE_PASS — Terra initial build attempt 1 complete at `0c2c827`; independent SOL QA required
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Prerequisite:** UXF-3 closed by SOL QA at `04f1351`; feature `72ea4f8`

## Goal

Make load curves rise as spring/shock compression and load increase. Chart Y-axis becomes derived travel while every stored and exported source measurement remains raw height.

## Scope

1. In `src/components/SmasherLoadsView.tsx`, add/export pure display helpers:
   - `toTravel(height, maxHeight) = maxHeight - height`.
   - A pure travel-to-SVG-Y helper or equivalent testable function where `0` travel is chart floor and maximum travel is chart top.
   - Do not round or mutate source points inside these helpers.
2. Single-session chart:
   - Parse/sort load and height exactly as today.
   - Use that session's largest valid height as zero travel.
   - Map travel through a shared `0..maxTravel` display domain. More travel must have smaller SVG Y and therefore plot higher.
   - Y ticks show travel in inches, maximum at top and `0` at bottom. Rename Y-axis to `TRAVEL (in)`. X-axis/load behavior stays unchanged.
   - Area fill remains anchored to chart floor.
3. Comparison chart:
   - Use the largest valid height across all selected series as the comparison dataset's common zero. Do not independently zero each series; that would hide real height differences between sessions.
   - Plot every series against one shared `0..maxTravel` axis so sessions remain comparable.
   - Use same top-to-bottom travel ticks and `TRAVEL (in)` label. X/load behavior stays unchanged.
4. Raw measured height must remain available inside both charts:
   - Every point must expose `Travel … in · Height … in` by hover/tap or an equivalent in-chart detail.
   - Single-session SVG is the PNG source, so its exported static image must also contain the raw height values. Use compact point labels, a raw-height scale, or another SVG-native treatment that survives canvas export without relying only on browser hover.
   - Keep copy compact; do not add explanatory paragraphs around the graph.
5. Preserve stored `ShockDataPoint.height/load`, session JSON, localStorage, cloud sync, CSV exports, ride-height fields, tables, colors, and chart layout outside the minimum label/point-detail needs.
6. `src/lib/shockCompare.ts` stays byte-unchanged. Its interpolation and comparison-table outputs remain raw-height based.
7. Expand `scripts/chunk6a-refinement-harness.ts`:
   - Import/test pure travel helpers with a descending-height, ascending-load fixture.
   - Assert tallest height gives `0`, lower heights give increasing travel, and SVG Y moves upward as travel increases.
   - Assert top tick/domain is maximum travel and bottom is zero through helper/source fixtures.
   - Assert both chart paths use travel, display `TRAVEL (in)`, and expose raw Height plus Travel point detail.
   - Remove the old raw-height direction/source assertion.
   - Add a small `buildComparisonRows` regression fixture proving interpolation still returns the same raw-height values without editing `shockCompare.ts`.

## Files

**Primary:**
- `src/components/SmasherLoadsView.tsx`
- `scripts/chunk6a-refinement-harness.ts`

**Read-only regression boundary:**
- `src/lib/shockCompare.ts`

## Out of scope

- No stored measurement rewrite, type/schema/migration/sync/localStorage change.
- No `shockCompare.ts` edit, CSV/table semantic change, ride-height change, chart color redesign, package/native work, deploy, push, merge, or APK.
- No UXF-5 copy/guide work or other sprint item.

## Acceptance

1. Monotonic fixture with load rising and height falling plots upward/right in single and comparison charts.
2. Tallest valid height is `0` in a single session; tallest valid height across selected series is comparison zero. Axis bottom is `0`; top is largest displayed travel.
3. Each plotted point exposes both travel and actual height. Single-session PNG path contains raw-height information without hover.
4. Stored point/session JSON and raw-height CSV/comparison interpolation remain unchanged.
5. Full chunk6a harness PASS; exact three-error lint baseline; production build PASS; `git diff --check` PASS.
6. Focused local visual check with a seeded/real session confirms travel axis, upward curve, readable height detail, and PNG output. Cavecrew review finds no blocker.

## Routing

Terra owns one initial build pass. Primary owns cross-file implementation; cavecrew handles bounded trace/review. Commit feature and durable handoff, then return to SOL High QA. Any QA failure transfers repair to SOL fixer; Terra is not re-invoked.

## Terra attempt 1 evidence — 2026-07-14

- Feature commit: `0c2c827`.
- Exported pure `toTravel` and `travelToSvgY` helpers drive both SVG paths. Single chart zero uses its tallest point; comparison zero uses tallest point across all selected series. Maximum travel maps to top; zero maps to floor, including equal-height fallback.
- Both Y axes now show travel. Single chart keeps compact raw-height labels in SVG so PNG serialization retains measurements. Single and comparison points expose Travel + Height by hover, tap, keyboard, and accessible name.
- Stored points/session shapes, sync, localStorage, raw-height table/CSV, and `src/lib/shockCompare.ts` are byte-unchanged. Comparison-row interpolation regression passes.
- `npx tsx scripts/chunk6a-refinement-harness.ts`: PASS.
- `npm run lint`: exact three known baseline errors only; no new errors.
- `npm run build`: PASS, 554 modules and 18 PWA entries.
- `git diff --check`: PASS. Cavecrew found one harness coverage gap; repaired exact two-chart assertion; re-review returned `No issues.`
- Local server/auth shell passed at 390px. Localhost had no remembered account, so no authenticated seeded-chart or downloaded-PNG runtime claim is made. SVG-native height labels and unchanged PNG serializer are verified by code/harness/build; final interactive visual gate remains for SOL/UXF-9.
