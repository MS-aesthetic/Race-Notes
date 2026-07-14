# Current Task — UXF-6 Maintenance Intervals and Starting Usage

**Status:** CODE_PASS — Terra feature `6cae6cf`; awaiting independent SOL High QA
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Prerequisite:** UXF-5 closed by owner approval at `40fcc5f`

## Goal

Replace redundant Laps / Sessions / Feature Races maintenance measurements with two clear choices: **Races** and **Days**. Let an existing part start with usage already on it, while preserving service history, car/rig scope, automatic checklist injection, local-first persistence, and cloud sync.

## Confirmed behavior

1. **Interval choices:** `MaintenanceIntervalType` becomes exactly `'races' | 'days'`.
   - Both car- and rig-scoped jobs offer the same choices.
   - UI label is `Races`, not `Feature races`.
   - No Laps/Sessions creation or display branch remains.
2. **Race counting:** one race equals one race weekend containing at least one session where `inferSessionType(session) === 'Feature'`.
   - Count a weekend once even if it contains multiple Feature sessions.
   - Established inference must recognize current `sessionType`, `Feature`, `Feature 1`, `Feat. 1`, and `A-MAIN` forms.
   - Race eligibility uses parsed `weekend.date`, not the session's time-only `time` string. A weekend must fall on a calendar date strictly after `lastServicedAt`; same-day service therefore resets the counter to zero. Add a same-day/next-day boundary fixture.
3. **Scope stays unchanged:**
   - Car jobs count only weekends resolved to that component's `carId` through the existing weekend/setup relationship.
   - Rig jobs count qualifying weekends across all cars.
   - Do not refactor lifecycle ownership, `byActiveCar`, deletion, or checklist scope.
4. **Starting usage:** add `startingUsage?: number`, semantically defaulting to `0` when absent.
   - Derived mode: `used = startingUsage + derivedUsage` for both Races and Days.
   - `manualUnits` remains a full override. When numeric, it wins outright and starting/derived usage are ignored.
   - Starting usage accepts finite, nonnegative whole numbers only.
5. **Service reset:** every normal or quick service log sets `startingUsage` to `0`, advances `lastServicedAt`, and retains current `manualUnits` reset semantics (`0` when manual mode existed, otherwise omitted). Undo restores exact prior component bytes.
6. **Default catalog:** use only Races/Days:
   - Engine oil — 3 Races
   - Motor freshen — 10 Races
   - Transmission fluid — 60 Days
   - Wheel bearings — 10 Races
   - Shock rebuild — 10 Races
   - Trailer bearings — 180 Days

## Implementation scope

1. `src/types.ts`
   - Narrow `MaintenanceIntervalType` to `'races' | 'days'`.
   - Add optional `startingUsage?: number` beside `manualUnits`.
   - Update maintenance comments/examples only; no unrelated type work.
2. `src/lib/maintenance.ts`
   - Remove lap/session imports and helpers made dead by narrowing.
   - Derive Races as distinct qualifying weekends using `inferSessionType` from `tireHistory.ts`.
   - Keep current car-resolution exclusion for ambiguous/unbound weekends and rig-global behavior.
   - Add normalized starting usage to derived Races/Days totals; non-finite, negative, or fractional legacy values act as `0`.
   - Preserve `manualUnits` full override.
   - Reset `startingUsage` in `applyServiceLog`.
   - Replace `DEFAULT_COMPONENTS` with exact catalog above.
3. `src/components/TrackersView.tsx`
   - `Measure by` contains only Races and Days for both scopes.
   - Add optional numeric field beside Interval. Dynamic label: `Races already run` or `Days already in service`.
   - Min `0`, step `1`; reject invalid/negative/fractional values rather than silently changing them.
   - Save omitted/blank as `0` or omitted with identical runtime meaning; reset form state after add.
   - Defaults stamp starting usage `0`. Existing Used / Limit / Remaining display stays concise.
4. `src/lib/serviceLog.ts`
   - Narrow exhaustive unit labels to race/races and day/days.
   - Replace stale `night(s)` wording. Record-building and undo contracts stay unchanged.
5. `src/lib/maintenanceSync.ts` (new pure mapper) and `src/lib/sync.ts`
   - Extract explicit component row mapping so the focused harness can round-trip without network.
   - Push `starting_usage: component.startingUsage ?? 0`.
   - Pull `startingUsage` only when it is a finite nonnegative integer; otherwise default `0`. Add negative/fractional/non-finite fixtures.
   - Pull interval as `days` only when exact; otherwise `races`. This prevents pre-wipe invalid text from entering the narrowed TypeScript union without adding visible legacy modes. Because component pushes send the full array, saving maintenance before the owner wipe may persist that disposable test-data normalization; disclose this in QA rather than adding legacy modes.
   - Preserve IDs, scope/car ownership, timestamps, notes, manual units, debounce, RLS behavior, and cloud delete paths.
6. `supabase/migrations/`
   - Create migration with `npx supabase migration new add_maintenance_starting_usage`; global CLI is unavailable.
   - Exact reviewed SQL:
     ```sql
     alter table if exists public.maintenance_components
       add column if not exists starting_usage integer not null default 0;
     ```
   - No interval rewrite, row deletion, constraint, RLS, index, grant, table, or log change.
   - Apply once to project `swblfeayxoprodhwxqak` only after local review, then align committed migration version with remote history.
7. `scripts/chunk8-trackers-harness.ts`
   - Preserve all current checklist/template/accounting assertions.
   - Add exact Races/Days source checks and no Laps/Sessions/Feature races option.
   - Prove zero-session `startingUsage: 10` reports 10; one qualifying Feature weekend reports 11; multiple Features in one weekend still report 11.
   - Prove `Feature 1`, `Feat. 1`, and `A-MAIN` inference.
   - Prove car A excludes car B, while rig counts both.
   - Prove manual override wins, immediate 90% checklist injection works, normal/quick service reset starting usage, and undo-compatible prior bytes remain intact.
   - Prove pure cloud mapper round-trip for zero/nonzero starting usage and narrowed interval.

## Live Supabase facts — verified 2026-07-14

- Project `swblfeayxoprodhwxqak`; migrations applied through `20260714020037 setup_weekend_lifecycle`.
- `public.maintenance_components` has RLS enabled and no `starting_usage` column.
- Seven test rows exist: 2 Days, 3 Laps, 2 Races. Migration must not delete or rewrite them. Client pull safely normalizes unsupported interval text to Races, which may persist on a later full maintenance save; owner plans a test-data wipe before production.
- Existing table/API grants remain valid for an added column. 2026 Data API new-table exposure change does not apply because this alters an existing exposed RLS table.

## Verification gates

1. `npx tsx scripts/chunk8-trackers-harness.ts` PASS.
2. Exact three-error `npm run lint` baseline; no new errors.
3. `npm run build` PASS.
4. `git diff --check` PASS; scope audit clean; cavecrew reviewer finds no blocker.
5. Live migration verification after safe apply:
   - migration listed once;
   - `starting_usage` is integer, `NOT NULL`, default `0`;
   - row count remains 7 and existing rows read `0`;
   - RLS remains enabled;
   - security/performance advisors checked;
   - authenticated Races/Days component push/pull/delete round trip if session available. Do not invent evidence when auth is unavailable.
6. Runtime: 320/390 px, light/dark, Default/Large; add car and rig jobs; starting usage displays immediately; service resets it; automatic checklist appears at 90%; offline reload retains field.
7. Create one Netlify draft after coherent PASS. Never production.

## Out of scope

- No Main Checklist redesign or resurrection-policy changes; UXF-7 owns proposal.
- No automatic checklist threshold/cycle/idempotence change.
- No maintenance component edit flow, lifecycle/setup/run changes, accounting changes, package/native config, APK, production deploy, remote push, or merge.
- No migration-time cleanup or conversion of current Laps/Sessions test rows. Safe client normalization described above is allowed for disposable test data; no visible legacy interval mode is allowed.

## Routing

Terra High owns one initial cross-file build pass. Cavecrew handles bounded trace/review only. Commit feature and durable handoff, then return to SOL High for independent UXF-6 QA. Any QA failure transfers to SOL fixer; Terra is not re-invoked. UXF-7 stays locked until UXF-6 QA PASS.

## Terra implementation result — 2026-07-14

- Feature commit: `6cae6cf`.
- `MaintenanceIntervalType` is now Races/Days only. Race usage counts each distinct qualifying Feature weekend once, uses the existing setup-to-car resolution for car scope, and remains global for rig scope.
- Optional `startingUsage` is normalized to a finite nonnegative whole number, adds to derived usage, yields to the existing `manualUnits` full override, and resets through normal/quick service. Date-only service values are parsed as local calendar dates so same-day weekends remain zero and the next day counts.
- `maintenanceSync.ts` explicitly maps `starting_usage`; unsupported disposable cloud interval text normalizes to Races. Existing IDs, RLS, delete paths, JSON/local-first behavior, and checklist reconciliation remain unchanged.
- Migration `20260714215528_add_maintenance_starting_usage.sql` was reviewed and applied once to project `swblfeayxoprodhwxqak`. Verification: integer, `NOT NULL`, default `0`; seven rows retained and read `0`; RLS still enabled. Security/performance advisors were checked before and after; existing unrelated advisor findings remain.
- Focused chunk8 harness PASS; lint is the exact three-error baseline; production build PASS (`556` modules, `18` PWA entries); diff check PASS; cavecrew re-review found no issues.
- Draft: `https://6a56b1449f3477512a85c566--crew-chief-race-notes.netlify.app`. Signed-out shell at 320/390 px has no horizontal overflow or console warnings. The unique draft origin had no remembered login, so authenticated component push/pull/delete and signed-in light/dark Default/Large runtime are not claimed; pure mapper, live schema, build, and focused fixtures cover those paths pending SOL adjudication.
- No production deploy, remote push, merge, package/native configuration, or APK change. UXF-7 remains locked until SOL PASS.
