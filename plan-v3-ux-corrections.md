# CREW CHIEF — Plan v3: UX Correction Batch (UXF)

> **Purpose.** Single source of truth for the 2026-07-14 owner-correction batch.
> Source of requirements: `docs/archive/CLAUDE_UX_REWORK_HANDOFF_2026-07-14.md` (owner
> rejections of Chunks 6B–9 UX/product decisions — technical QA passed, product
> acceptance did not). This file **supersedes `plan-v2.md`** as the active
> roadmap; plan-v2.md is archived (see §Superseded documents). The ralph loop
> (`ralph/STATE.md`, `ralph/CURRENT_TASK.md`, `.github/agents/*.agent.md`,
> `.codex/agents/*.toml`) consumes this file exactly as it consumed plan-v2.md.
>
> **Branch/worktree:** all work on **`preview-v3`** in
> `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`. Starting point: commit
> `84d59ea` (+ this documentation handoff). No merge to `preview`/`master`, no
> production deploy, no schema change, no APK release without explicit Maxx
> approval.
>
> **Architecture invariants (inherited, non-negotiable):** local-first
> dual-write; no router; car scoping via `byActiveCar()`; types only in
> `src/types.ts`; sync only in `src/lib/sync.ts`; every delete path calls its
> `delete*FromCloud()`; theme tokens, no hardcoded hex in components (existing
> `SmasherLoadsView` inline SVG colors are grandfathered — do not expand them);
> tsc/lint baseline = exactly 3 known errors; builds/git through Windows
> PowerShell.

---

## 0. Workstream ID scheme

This batch uses **UXF-1 … UXF-10** ("UX Fix"). Rationale: `WS-A…WS-M` (v1),
`WS-N…WS-Z` (v2) and `UX-C1…UX-C9` / `UX-R1` (v3 chunk track) are all taken in
`ralph/STATE.md` history; `UXF-` collides with none of them and greps cleanly.
ws-planner picks the next eligible UXF exactly as it picked the next WS.

Correction-item → workstream map (items numbered per the handoff doc):

| Handoff item | Workstream |
|---|---|
| 9 duplicate "Other", 10 Dashboard/checklist desync | UXF-1 |
| 3 Quick Adjust coalescing | UXF-2 |
| 4 Setup lifecycle relabel | UXF-3 |
| 5 Load-graph Y-axis flip | UXF-4 |
| 1 copy tone, 2 Tuning Guide de-scope, 6 checklist over-explanation | UXF-5 |
| 8 maintenance interval consolidation | UXF-6 |
| 7 Main Checklist redesign (spec-only) → future build WS | UXF-7 |
| — docs/state hygiene (stale onboarding, stale WS-Z gate) | UXF-8 |
| — batch regression gate | UXF-9 |
| Approved UXF-7 Main Checklist build | UXF-10 |

## 1. Coordination

### Dependency graph / execution order

```
UXF-8  Docs & state hygiene            (DO FIRST — fixes stale onboarding that
                                        would misroute every later agent)
UXF-1  Trivial bug fixes               (no prereqs; do early)
UXF-5  Copy & progressive disclosure   (after UXF-1 — shares TrackersView.tsx)
UXF-3  Lifecycle relabel               (all Maxx questions resolved — clear to build)
UXF-4  Load-graph travel view          (all Maxx questions resolved — clear to build)
UXF-2  Quick Adjust coalescing         (all Maxx questions resolved — clear to build)
UXF-6  Interval consolidation + start  (after UXF-5 — shares TrackersView.tsx;
                                        all Maxx questions resolved — clear to build)
UXF-7  Main Checklist redesign SPEC    (approved 2026-07-14; complete)
UXF-10 Main Checklist redesign BUILD   (approved UXF-7 package)
UXF-9  Batch QA + draft deploy         (LAST — gates the batch)
```

- The loop is serial (one WS in flight). The graph shows *eligibility*:
  UXF-1, -2, -3, -4 are mutually independent. All design questions for this
  batch were resolved with Maxx on 2026-07-14 (see §Decisions log) — no
  workstream below is gated on a pending human decision. Maxx approved UXF-7
  as written on 2026-07-14, unlocking UXF-10.
- `TrackersView.tsx` is the hot file of this batch (UXF-1 → UXF-5 → UXF-6 in
  that order). UXF-10 may use minimal `App.tsx` wiring only if Manage-sheet/back behavior
  cannot remain inside `ToDoView`; no unrelated App changes.
- UXF-7 produced an approved proposal document, not code. UXF-10 is its exact follow-on build.

### File ownership matrix

| WS | Primary (owns) | Shared (coordinate) |
|---|---|---|
| UXF-1 | `src/components/TrackersView.tsx` (category select only), `src/components/DashboardView.tsx`, `src/lib/mainChecklist.ts` | `src/components/ToDoView.tsx` (adopt shared selector), `scripts/chunk8-trackers-harness.ts` |
| UXF-2 | `src/lib/quickAdjust.ts`, `scripts/chunk7-quick-adjust-harness.ts` | — |
| UXF-3 | `src/lib/setupLifecycle.ts` | `src/components/SetupView.tsx`, `src/components/RaceWeekendView.tsx`, `src/App.tsx` (user-visible strings only), `scripts/chunk6b-lifecycle-harness.ts` |
| UXF-4 | `src/components/SmasherLoadsView.tsx` | `scripts/chunk6a-refinement-harness.ts`; `src/lib/shockCompare.ts` read-only (regression check, no edits) |
| UXF-5 | `src/components/QuickReferenceView.tsx`, `src/components/GuideView.tsx`, `docs/USER_GUIDE.md` | `src/lib/checklistMaintenance.ts` (one string), `src/components/TrackersView.tsx` (one banner), `scripts/chunk8-trackers-harness.ts`, `scripts/chunk9-export-help-harness.ts` |
| UXF-6 | `src/components/TrackersView.tsx` ("Measure by" + starting-usage input), `src/lib/maintenance.ts` (`getComponentStatus`, `DEFAULT_COMPONENTS`) | `src/types.ts` (narrow `MaintenanceIntervalType`, add `startingUsage`), `src/lib/sync.ts` (`starting_usage` column mapping), `src/lib/checklistMaintenance.ts` (verify only), `scripts/chunk8-trackers-harness.ts` |
| UXF-7 | `docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md` (new) | everything else read-only |
| UXF-8 | `PROJECT_INSTRUCTIONS.md`, `docs/archive/plan-v2.md` (banner already applied), `CODEBASE_KNOWLEDGE.md` (header line only), `ralph/STATE.md` (WS-Z row + human-gates note) | `docs/archive/car-profiles/*` (RESOLVED Q6 — stays archived; the feature it specced is already built, nothing to restore) |
| UXF-9 | test scripts, QA notes in `ralph/STATE.md` | everything (read-only + fixes) |
| UXF-10 | `src/types.ts`, `src/lib/mainChecklist.ts`, `src/lib/checklistMaintenance.ts`, `src/components/ToDoView.tsx`, `src/components/DashboardView.tsx`, `scripts/chunk8-trackers-harness.ts` | `src/App.tsx` minimal sheet/back wiring only if required; existing Todo sync mapper is verification-only |

### Loop protocol, model routing, QA rubric

Identical to the archived `docs/archive/plan-v2.md` §1 (kept as the reference
for the full protocol text). Summary restated so this file stands alone:

- `ws-planner` (GPT 5.6 SOL High) reads this file + `ralph/STATE.md`, picks the
  next unblocked UXF, writes `ralph/CURRENT_TASK.md`.
- `ws-builder` (GPT 5.6 Terra High) implements exactly CURRENT_TASK.md, runs
  `npm run lint` + `npm run build`, commits `UXF-n attempt N: <summary>` to
  `preview-v3`. Never edits this plan or STATE.md. **Gets exactly one initial
  pass per workstream** (routing updated 2026-07-14).
- `ws-qa` (GPT 5.6 SOL High) grades; **any FAIL routes straight to `ws-fixer`
  (SOL High)** — Terra is not re-invoked once attempt 1 fails. `ws-fixer` loops
  with `ws-qa` (SOL ↔ SOL) until PASS. PASS = all hard gates + score ≥ 90.
  `cavecrew-investigator` (Terra Medium) handles bounded research/search for
  either role.
- Hard gates: (1) lint exactly 3-error baseline; (2) Windows build succeeds;
  (3) diff confined to the WS's Primary/Shared files; (4) architecture
  invariants (header block above); (5) every acceptance criterion in
  CURRENT_TASK.md demonstrably met, including harness updates.
- `/caveman full` for all loop artifacts; cavecrew for bounded delegation
  (`.agents/skills/cavecrew/SKILL.md`, `.agents/skills/caveman/SKILL.md`).
- Human-only gates: Supabase migrations/secrets, deploys beyond Netlify draft,
  branch merges, APK signing — none are expected in this batch (no schema
  changes anywhere below).
- Harnesses run via `npx tsx scripts/<name>.ts` (existing convention).

### Migration status (correcting stale state)

Verified live against Supabase project `swblfeayxoprodhwxqak` on 2026-07-14
via MCP `list_migrations`: `014_team_delete_policies` (20260711151905),
`add_load_session_ride_height` (20260714010630), and
`setup_weekend_lifecycle` (20260714020037) are **all applied**. The WS-Z
"await migration 014" note in ralph/STATE.md and the archived plan-v2.md is
stale — UXF-8 corrects it. **This batch requires zero new migrations.**

---

## UXF-1 — Trivial bug fixes: duplicate "Other" + Dashboard/checklist desync

**Goal:** two confirmed, mechanical bugs (handoff items 9 and 10).

**Scope:**
1. `src/components/TrackersView.tsx:587` — delete the hardcoded
   `<option value="Other">Other</option>`; line 586 already maps
   `MAINTENANCE_CATEGORIES`, which ends in `'Other'` (`src/types.ts:500-502`).
   Audit the file (and any other `<select>` over `MAINTENANCE_CATEGORIES`) for
   the same doubled-option pattern; fix any found.
2. Add a shared selector to `src/lib/mainChecklist.ts`:
   `activeChecklistItems(list: Todo): TodoItem[]` returning
   `(list.items ?? []).filter(i => !i.removedUntilReset)`. Pure, no side
   effects.
3. `src/components/ToDoView.tsx:244` — replace the inline
   `activeTodo?.items.filter(item => !item.removedUntilReset)` with the shared
   selector (behavior identical).
4. `src/components/DashboardView.tsx:107-112` — build `openItems` /
   `assignedToMe` / `openTaskCount` from `activeChecklistItems(mainChecklist)`
   plus the existing `!i.done` (and `assignedTo`) filters, so Dashboard shows
   exactly the Main Checklist's active projection.
5. Extend `scripts/chunk8-trackers-harness.ts`: fixture with a core item marked
   `removedUntilReset` → assert the shared selector excludes it and a
   done-item filter over the selector matches what Dashboard should count.

**Out of scope:** any Main Checklist model/UX change (UXF-7); the
resurrect-on-reconcile policy for cleared automatic items (UXF-7 analyzes it —
this WS only aligns the two views on the *existing* rule); copy changes
(UXF-5); the "Measure by" selector (UXF-6).

**Acceptance criteria:**
1. Maintenance "Category" dropdown lists "Other" exactly once; creating and
   re-editing a component with category `Other` (and a legacy stored `Other`
   component) still works.
2. Remove a not-done core item from Main Checklist → Dashboard open-task count
   and list update immediately, and remain consistent after reload and after a
   cloud pull (todos JSONB round trip — no schema involved).
3. `ToDoView` visible items are byte-identical to before the refactor (pure
   extraction).
4. chunk8 harness PASS with the new assertions; lint baseline; build.

**Human prerequisites:** none.

---

## UXF-2 — Quick Adjust coalescing (net outcome, not per-tap rows)

**Goal:** handoff item 3. Design resolved (Opus, 2026-07-14): coalesce
same-field repeat adjustments within a run into one net row.

**Scope:**
1. In `src/lib/quickAdjust.ts` `applyQuickAdjust` (currently lines 228-266):
   after computing `details`, and only when `command.kind !== 'other'`, search
   `setup.changeLog` from newest to oldest for an entry matching
   `entry.runId === runId && entry.corner === details.corner &&
   entry.field === details.field`.
2. **If found (coalesce):** produce an updated entry that keeps the existing
   row's `id` and original `before`, and overwrites `after` (=`details.after`),
   `note`, `loadSessionId`, and `timestamp` (=`now`). Replace the row **in
   place** in `changeLog` (same index). Update the matching
   `session.adjustments` row (same base id, `-run` suffix) the same way,
   in place, with `value` = `` `${originalBefore} to ${details.after}` ``.
   Do not append anything.
3. **If not found (or kind `'other'`):** append/prepend new rows exactly as
   today (ids `${commandId}-setup` / `${commandId}-run`).
4. Coalescing boundary is the run: `runId` participates in the match key, so a
   new run always starts fresh rows. Reversal to the original value leaves a
   net row with `before === after` — keep the row (records that something was
   tried and reverted).
5. Revise `scripts/chunk7-quick-adjust-harness.ts`: the rapid-tap block
   (lines 112-123, eight `+0.5` rr spring-rounds taps) currently asserts
   `changeLog.length === 12` / `adjustments.length === 12` / 12 unique ids →
   now **5** each (4 earlier distinct-field rows + 1 coalesced row). Add
   assertions: coalesced row has `before === '0.0'`, `after === '4.0'`,
   id equals the first rapid command's id, and `rapidSetup.rr.springRounds ===
   '4.0'` (unchanged). Add cases: (a) two taps on *different* fields → two
   rows; (b) two `'other'` commands → two rows; (c) reversal (+0.5 then −0.5)
   → one row `0.0 to 0.0`; (d) `setupToCloudRow` round trip of the coalesced
   changeLog (existing block at ~line 125) still passes with the new counts.
6. Verify the SetupView/RaceWeekendView history renderers need no change (they
   render whatever rows exist); adjust only if a renderer assumed append-only
   ordering by id.

**Out of scope:** lifecycle labels (UXF-3); any change to the locked/ownership
gates at lines 236-241 (must remain byte-identical); schema/sync mappers
(changeLog is JSONB inside the setup row — no mapper change needed); steppers
outside Quick Adjust.

**Acceptance criteria:**
1. Eight rapid `+0.5` taps on one corner/field yield exactly one changeLog row
   and one run adjustment, net `0.0 → 4.0`; field value correct.
2. Distinct fields, distinct runs, and `'other'` free-text never coalesce.
3. Coalesced rows survive local persist + cloud push/pull (dual-write intact,
   `updatedAt` bumped).
4. Revised chunk7 harness PASS in full; lint baseline; build.
5. Load-session-linked adjustments (`loadSessionId`) reflect the latest tap.

**Human prerequisites:** none — **RESOLVED 2026-07-14 (Q4):** net value only,
no per-tap audit trail. Confirmed by Maxx.

---

## UXF-3 — Setup lifecycle relabel: Starting / Live-Trackside / Raced

**Goal:** handoff item 4. Design resolved (Opus, 2026-07-14): pure
display-label rename over the proven lifecycle — **no data-model change, no
migration, role union `'baseline'|'weekend'|'final'|'current'` unchanged.**

Label map: `baseline` → **Starting Setup** · `weekend` → **Live-Trackside
Setup** · `current` → **Current Setup** (unchanged). `final` is
**conditional** (RESOLVED 2026-07-14, Q1): **Raced Setup** if the originating
weekend logged a `'Feature'` session, else **Finished Setup** (covers test
days and any weekend that never ran a feature race).

**Scope:**
1. Add to `src/lib/setupLifecycle.ts`:
   - `lifecycleLabel(role: Setup['lifecycleRole'], weekend?: RaceWeekend): string`
     implementing the map above. For `role === 'final'`: look up the setup's
     originating weekend via its `weekendId` and return `'Raced Setup'` if
     `weekend.sessions.some(s => s.type === 'Feature')`, else
     `'Finished Setup'`. If the weekend can't be resolved (defensive
     fallback), default to `'Finished Setup'` — never guess "Raced" without
     evidence of a feature session.
   - `displayVersionLabel(setup: Setup): string` — returns
     `setup.versionLabel` with the legacy substrings `'Baseline Setup'`,
     `'Weekend Setup'`, `'Final Setup'` rewritten to the new terms at render
     time. Pure; never mutates or persists.
2. Update the persisted `versionLabel` templates for *newly created* records in
   `setupLifecycle.ts` lines 110, 124, 192, 230, 237, 247, 255 (and the
   `setupName` fallbacks at 144/300 if they echo role words), plus
   `src/App.tsx:1493` and `src/App.tsx:1158`.
3. Sweep every **user-visible** string containing the old role words. Known
   sites (verify by grep `Baseline|Weekend Setup|Final Setup|Current Setup`
   across `src/`):
   - `src/components/SetupView.tsx` 306, 567, 608, 612, 740
   - `src/components/RaceWeekendView.tsx` 448, 648 ("Starting Setup
     (optional)" — already correct, keep), 929, 930, 1075, 1504, 1509
   - `src/App.tsx` 967, 1214, 1501, 1527, 1539 (toast strings)
   Rewrite each for the new vocabulary; route role-derived labels through
   `lifecycleLabel()`; route stored labels through `displayVersionLabel()`.
4. Update label expectations in `scripts/chunk6b-lifecycle-harness.ts` (it may
   assert versionLabel text); all lifecycle *behavior* assertions must remain
   untouched and passing.
5. Update `docs/USER_GUIDE.md` and any App Guide (`GuideView.tsx`) mentions of
   the old names (coordinate with UXF-5 if it is in flight — this WS owns only
   the lifecycle vocabulary, UXF-5 owns tone).

**Out of scope:** any change to lifecycle mechanics, locking, finish
transaction, merge protection, or `RaceWeekend` metadata; mutating stored
`versionLabel` values (historical rows keep old bytes; display layer maps
them); the change-log coalescing (UXF-2).

**Acceptance criteria:**
1. Grep of `src/` finds no user-visible literal `'Baseline Setup'` /
   `'Weekend Setup'` / `'Final Setup'` outside `displayVersionLabel`'s mapping
   table and code comments.
2. New weekend start produces setups labeled "… Starting Setup" and
   "… Live-Trackside Setup"; Finish Weekend produces "… Raced Setup" (feature
   session logged) or "… Finished Setup" (no feature session — test day) +
   editable "Current Setup — …"; all persisted only in *new* rows.
3. A legacy setup whose stored `versionLabel` is "2026-07-12 Baseline Setup"
   renders as "2026-07-12 Starting Setup" without its stored bytes changing
   (verify localStorage + cloud row unchanged after render).
4. chunk6b lifecycle harness PASS (behavior assertions unmodified, label
   assertions updated); lint baseline; build.
5. Locked/view-only enforcement toasts read correctly with new vocabulary.

**Human prerequisites:** none — both resolved:
- **RESOLVED (Q1):** test-day finals use "Finished Setup"; only weekends with
  a logged `'Feature'` session get "Raced Setup" (see scope step 1's
  conditional rule).
- **RESOLVED (Q2):** display-only label mapping. Historical rows keep their
  old persisted `versionLabel` text; only display is mapped. No data rewrite.

---

## UXF-4 — Load-graph Y-axis: travel view (RESOLVED 2026-07-14, Q3 — expanded scope)

**Goal:** handoff item 5. Curve must rise left→right as load increases. Maxx's
answer expands this beyond a direction flip: Y-axis becomes a computed
**travel** value (0 = the largest/least-compressed measured height in the
session; travel increases as height decreases), plotted so more travel reads
higher on the chart — and the **actual measured height** must still be shown
alongside travel, not replaced by it.

**Scope:**
1. `src/components/SmasherLoadsView.tsx`: add a pure helper (module-level),
   e.g. `toTravel(height: number, yMaxHeight: number): number` returning
   `yMaxHeight - height` — so travel is `0` at the tallest (least compressed)
   reading in the dataset and increases as height drops.
2. Single-session chart `toSvg` (currently lines 104-107, mapping raw height
   with larger-height-at-top): remap using travel instead of raw height, with
   **more travel positioned higher on the chart** (i.e. `sy` decreases as
   travel increases) — this satisfies "curve rises left→right as load
   increases" without inverting the existing height-based math in place;
   compute travel first, then position by travel the same way height was
   positioned before.
3. Y-axis tick labels (line 134): show the **travel** value at each tick
   (e.g. "0.0", "0.5", "1.0" in.), travel increasing toward the top.
4. **Dual display of actual height (required):** each data point must also
   expose its raw measured height — e.g. a hover/tap tooltip or point label
   showing "Travel 1.25 in · Height 8.75 in" — so nothing about the real
   measurement is lost behind the derived travel number. Builder's choice of
   exact UI (tooltip vs. secondary axis vs. point annotation), but both
   numbers must be visible without leaving the chart.
5. Comparison chart: apply the same travel computation + dual-display
   requirement at its equivalent `toSvg`/tick-label sites (currently ~lines
   259-262, 271).
6. Check the area-fill anchor still fills to the chart floor and looks sane
   with travel-based positioning; adjust only if visually broken.
7. Add a fixture to `scripts/chunk6a-refinement-harness.ts`: given points
   where load ascends and height descends, assert travel is computed
   correctly (`0` at max height, increasing as height drops) and that the
   on-chart position (`sy`) moves up-screen as travel increases. Remove/invert
   any existing old-direction assertions in that harness.
8. Regression-check `src/lib/shockCompare.ts` interpolation outputs are
   unaffected (read-only — it operates on data, not pixels; travel is a
   display-layer concept only).

**Out of scope:** stored measurement values (never touch — height stays the
stored unit, travel is derived at render time only); chart colors/layout;
`shockCompare.ts` edits; ride-height fields elsewhere.

**Acceptance criteria:**
1. Fixture dataset (height falls as load rises) renders a polyline that rises
   left→right in **both** charts, axis labeled in travel; visually verified
   on the draft/local build with at least one real or seeded session.
2. Every plotted point's actual measured height is visible on demand (tooltip
   or equivalent) alongside its travel value — verify with a spot check, not
   just code review.
3. Top Y-axis tick = highest travel value (lowest height) in the dataset;
   `0` travel corresponds to the tallest (least compressed) reading; X axis
   unchanged.
4. Travel-computation fixture PASS; chunk6a harness PASS overall; lint
   baseline; build.
5. PNG/share export of the chart (existing `svgRef` path) reflects the new
   travel axis; if the export is a static image, include the height values in
   it too (e.g. as point labels) since it can't carry a hover tooltip.

**Human prerequisites:** none — **RESOLVED (Q3):** Y-axis is travel (0 =
largest height, increasing = more compression), with actual height shown
alongside, per Maxx.

---

## UXF-5 — Copy tone, Tuning Guide de-scope, checklist over-explanation

**Goal:** handoff items 1, 2, 6. Progressive disclosure: operational screens
show state and action; teaching lives in the App Guide / USER_GUIDE.

**Scope:**
1. **Tuning Guide de-scope** (`src/components/QuickReferenceView.tsx`): remove
   the app-help items at lines 712 (Setup Sheet), 716 (Four-Bar), 720 (Load
   Sessions), 724 (Compare Setups) and the "Before You Change Anything" block
   at line 745. The Tuning Guide must open directly into tuning-reference
   material (symptom → direction → adjustment → effect → cautions).
2. **Relocate, don't delete:** ensure equivalent operating instructions for
   Setup Sheet, Four-Bar, Load Sessions, and Compare Setups exist in the App
   Guide (`src/components/GuideView.tsx`) and `docs/USER_GUIDE.md`; add them
   there if missing.
3. **Checklist over-explanation:**
   - `src/lib/checklistMaintenance.ts:118` — shorten the automatic-task `desc`
     to state only: `` `${used}/${limit} ${component.intervalType}` `` (drop
     "remaining" prose and the "Added because…" sentence). `id`/`sourceCycle`
     construction (lines 107-116) must not change.
   - `src/components/TrackersView.tsx:551-555` — remove the permanent 90%-rule
     banner above Maintenance Logs; move the 90% rule explanation into the App
     Guide maintenance section.
4. **Tone audit (judgment-based, bounded):** sweep visible strings in
   `QuickReferenceView.tsx`, `GuideView.tsx`, and the C9 racer-language
   translation layer for both failure modes: residual academic phrasing
   (`trailing arm geometry`, `rear roll center`, `chassis roll`, `through
   apex`, `weight transfer` were C9's flagged set) **and** patronizing
   oversimplification introduced by the C9 repair. Target: concise,
   professional dirt-racing shop language. Internal values/keys untouched.
5. Update `scripts/chunk9-export-help-harness.ts` (help anchors + visible-copy
   audit) and `scripts/chunk8-trackers-harness.ts` (if it asserts the verbose
   desc or banner) to the new expectations.

**Out of scope:** Main Checklist structure/flows (UXF-7); lifecycle vocabulary
(UXF-3 owns those words — if UXF-3 already landed, do not re-edit its
strings); interval selector (UXF-6); removing tuning *content* from the Tuning
Guide.

**Acceptance criteria:**
1. Tuning Guide's first rendered content is tuning-reference material; the
   four help items and "Before You Change Anything" are gone; the same four
   topics are findable in App Guide + `docs/USER_GUIDE.md`.
2. Automatic maintenance tasks show the terse desc; the 90% banner is gone; a
   90%-due item still appears on Main Checklist exactly as before (behavior
   unchanged — chunk8 harness proves injection/cycle logic untouched).
3. chunk9 copy-audit harness PASS with updated expectations: no banned
   academic phrases, and no reintroduction of removed help anchors.
4. Owner spot-review of a Netlify draft (or local build) for tone — this is
   the one subjective gate in the batch; ws-qa records Maxx's verbal
   accept/reject in STATE.md.
5. Lint baseline; build.

**Human prerequisites:** none to start; Maxx tone review required to close
(criterion 4).

---

## UXF-6 — Maintenance interval consolidation + starting usage (RESOLVED 2026-07-14, Q5)

**Goal:** handoff item 8, expanded per Maxx's clarification. Owner sees
Laps / Sessions / Feature races as redundant variants of one use-based
interval, **and** every new maintenance item forces a "starts at zero" — no
way to enter existing wear on a part when onboarding mid-season.

**Confirmed model (Q5):**
- `car` and `rig` scoped components use the **same two interval choices:
  Races and Days** — no rig-only restriction. Rig wear (trailer, truck) also
  happens at race weekends (towing, setup, teardown), so "Races" (a weekend
  that logged a `'Feature'` session — reuse UXF-3's same rule) applies to rig
  parts exactly as it does to car parts. "Days" covers calendar-based service
  (e.g. annual trailer inspection) for either scope.
- `scope` (`'car' | 'rig'`) is unchanged and does its existing job: car-scoped
  components stay bound to `carId`/`byActiveCar`; rig-scoped stay global
  across cars. This consolidation is purely about the **interval-type**
  picker, not the car/rig split, which already works correctly.
- **No back-compat burden:** per Maxx, all current test data will be wiped
  before production, so `'laps'`/`'sessions'` do not need to keep working or
  render legacy rows. Simplify directly: narrow `MaintenanceIntervalType` to
  `'races' | 'days'` and update every consumer. Do not build legacy-display
  branches for types that will no longer be creatable.
- **Starting usage (new field):** at creation, let the user optionally enter
  existing wear so mid-season onboarding doesn't start parts at zero. Add
  `startingUsage?: number` to `MaintenanceComponent` (default `0` if omitted).
  In `getComponentStatus` (`src/lib/maintenance.ts:76-93`): `used =
  startingUsage + derived`, where `derived` is the existing session/day
  computation (Feature-session count for `'races'`, day count for `'days'`).
  This is additive, not a replacement for `manualUnits` (leave `manualUnits`
  and its full-override behavior untouched — it still exists for anything a
  user wants to track by hand instead of deriving). No offset needed on
  logging service (a new service log resets `lastServicedAt` and should also
  reset `startingUsage` to `0`, mirroring how `manualUnits` already resets on
  service).

**Scope:**
1. `src/types.ts:506`: narrow `MaintenanceIntervalType` to `'races' | 'days'`.
   Add `startingUsage?: number` to `MaintenanceComponent` (near `manualUnits`).
2. `src/lib/maintenance.ts` `getComponentStatus` (lines 76-93): add
   `startingUsage` into the `used` total for both branches (`'days'` and
   session-derived); keep the existing `manualUnits` full-override branch
   exactly as-is (manual mode still wins outright when set). Update the
   service-log reset logic (~line 108-109) to also zero `startingUsage`
   alongside the existing `manualUnits` reset.
3. `src/components/TrackersView.tsx` (~lines 602-609, "Measure by" selector):
   reduce to **Races** / **Days** only, for both `scope: 'car'` and
   `scope: 'rig'` add-forms. Add a "Starting usage" optional numeric input to
   the add-component form (label per interval type: "Races already run" /
   "Days already in service"), wired to `startingUsage`.
4. `DEFAULT_COMPONENTS` seed catalog (`src/lib/maintenance.ts` or `data.ts`):
   re-express every seed entry in `'races'`/`'days'` (drop any lap/session
   seed values — no conversion needed, just author sensible new defaults).
5. Verify `src/lib/checklistMaintenance.ts` 90% injection needs no change
   beyond reading the narrowed type generically (it already does).
6. Update `scripts/chunk8-trackers-harness.ts`: remove any `'laps'`/`'sessions'`
   fixtures/assertions; add a case that a component created with
   `startingUsage` shows correct status/checklist-injection immediately
   (before any new session exists), and that logging a service resets both
   `lastServicedAt` and `startingUsage` to `0`.

**Out of scope:** `src/lib/sync.ts` schema shape beyond adding the
`starting_usage` column mapping (straightforward add, mirrors `manual_units`);
Dashboard service chip logic beyond reading the narrowed type; any actual data
migration (not needed — test data is being wiped).

**Acceptance criteria:**
1. New-component form (both scopes) offers only Races / Days, plus an
   optional starting-usage input.
2. A rig-scoped component using "Races" counts Feature-session weekends
   regardless of which car raced (existing `scope==='rig'` derivation already
   passes `carId: null` — confirm behavior, don't rebuild it).
3. A car-scoped component's usage still only counts sessions/weekends tied to
   its own car (existing `byActiveCar`/`carId` behavior unchanged).
4. A component created with `startingUsage: 10` and zero logged sessions
   shows `used === 10` immediately; after Maxx's next Feature-session weekend
   it becomes `11`.
5. Logging a service resets both `lastServicedAt` and `startingUsage` to `0`.
6. chunk8 harness PASS incl. new starting-usage case; lint baseline; build.

**Human prerequisites:** none — resolved above (Q5).

**Implementation status (2026-07-14): COMPLETE.** Feature `6cae6cf` plus SOL calendar repair
`9d0fb26` passed independent QA attempt 2 at 96. Races/Days-only UI, distinct Feature-weekend
math, ISO/local and DST-safe calendar boundaries, local service defaults, starting usage,
service reset, pure cloud mapping, exact defaults, and migration `20260714215528` are done.
Focused harness, exact lint baseline, 556-module build, diff, clean tree, cavecrew, live
schema/RLS/grant verification, and draft `6a56b1449f3477512a85c566` signed-out 320/390 shell
pass. Authenticated draft data was unavailable and is not claimed. UXF-7 proposal unlocked.

---

## UXF-7 — Main Checklist UX redesign (spec-only)

**Goal:** handoff item 7 — the least-specified correction. Deliverable is a
**proposal document for Maxx**, not code. No source files change.

**Scope:** write `docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md` covering, with
file/line evidence from the current implementation
(`src/components/ToDoView.tsx`, `src/components/DashboardView.tsx`,
`src/lib/mainChecklist.ts`, `src/lib/checklistMaintenance.ts`,
`src/lib/checklists.ts`, `src/App.tsx`, `src/types.ts`,
`scripts/chunk8-trackers-harness.ts`):
1. Current source-of-truth map across Trackers and Dashboard (assume UXF-1's
   shared selector as the baseline).
2. Behavior matrix for core / ad-hoc / template / automatic-maintenance items
   across add, edit, assign, complete, clear/remove, new-weekend reset.
3. `removedUntilReset` tombstone semantics and every path that resurrects an
   item — including whether maintenance reconciliation
   (`reconcileMaintenanceChecklist`) can resurrect a deliberately cleared
   automatic item, and the proposed explicit policy.
4. Completed-evidence vs active-work separation; Dashboard density and
   duplicate-information cuts; empty state.
5. Proposed target model: one understandable active list, predictable
   reset/clear, preserved history — with data-model impact (ideally none),
   localStorage/cloud compatibility, and which chunk8 harness assertions
   change.
6. A cut line: which parts become the follow-on build WS (ws-planner adds it
   to this file as UXF-10 after approval) and which are rejected.

**Out of scope:** any code, harness, or copy change.

**Acceptance criteria:** the proposal answers all eight analysis bullets in
handoff §7; every claim about current behavior carries a file:line reference;
Maxx can approve/redline it in one sitting.

**Human prerequisites:** none to start (analysis is unblocked); a Maxx design
session is required to *close* it and to spawn the build WS.

**Proposal status (2026-07-14): APPROVED / COMPLETE.** SOL drafted
`docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md` with 74 valid current-source references. It
covers all owner analysis bullets and recommends active-first UI, Manage sheet, one-tap
completion/Undo, preserved History, predictable clear/reset and automatic-maintenance
suppression, idempotent saved lists, compact Dashboard, one optional Todo-item JSON field,
no SQL, and an exact UXF-10 build/harness cut. No application code changed during UXF-7.
Maxx approved the proposal as written on 2026-07-14; UXF-10 is now active.

---

## UXF-10 — Approved Main Checklist redesign build

**Goal:** implement the approved UXF-7 package in
`docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md` without creating a second checklist system.

**Scope:**
1. Add optional `TodoItem.archivedAt` inside existing Todo JSONB; add pure current/open/
   completed/history projections, stable recurring identity, archive, clear, reset, and
   idempotent saved-list import helpers.
2. Active-first Checklist UI: compact header/counts, add-task row, 56px open rows, 44px-plus
   actions, collapsed **Completed since last reset**, six-second completion Undo, optional
   completion-note edit, and concise clear empty state.
3. Put saved-list import/management, carry-unfinished preference, reset, clear, and History
   behind one Android-Back-safe **Manage** sheet.
4. Preserve completed evidence. Clear archives completed rows, hides unfinished recurring
   rows until reset, and deletes unfinished ad-hoc rows. Reset archives current completions;
   only unfinished ad-hoc follows carry preference.
5. Template recurrence requires an existing saved-list definition. Maintenance recurrence
   requires the component to remain due. Same-cycle tombstones suppress immediate recreation;
   archived history does not block a later eligible occurrence.
6. Dashboard becomes one compact Checklist launcher with open/mine counts and no task-name
   preview. Trackers and Dashboard use the same pure active projection.
7. Extend `scripts/chunk8-trackers-harness.ts` with every fixture listed in proposal §9,
   including legacy/default compatibility and JSON/local/cloud round trip.

**Primary files:** `src/types.ts`, `src/lib/mainChecklist.ts`,
`src/lib/checklistMaintenance.ts`, `src/components/ToDoView.tsx`,
`src/components/DashboardView.tsx`, `scripts/chunk8-trackers-harness.ts`; minimal `App.tsx`
wiring only if required by sheet/back behavior.

**Out of scope:** new SQL/table, separate `WeekendChecklist` UI, maintenance interval math,
setup lifecycle, Quick Adjust, accounting, team-concurrency redesign, package/native config,
production deploy, remote push, merge, or APK.

**Acceptance:** approved proposal §10 and harness §9 pass; exact three-error lint baseline;
production build; diff check; cavecrew review; local-first reload; cloud JSON mapper/round trip;
320/390 light/dark Default/Large runtime; one Netlify draft after coherent PASS. SOL performs
independent QA after Terra's one initial build pass. Any QA failure transfers fixes to SOL.

**Human prerequisites:** cleared by Maxx approval on 2026-07-14.

---

## UXF-8 — Docs & loop-state hygiene *(do first)*

**Goal:** stale onboarding/state actively misroutes agents; fix before the
loop runs on this plan.

**Scope:**
1. `PROJECT_INSTRUCTIONS.md`: line 12 `worktrees\v2` / `preview-v2` →
   `.worktrees\v3` / `preview-v3`; line 6 `plan-v2.md` → **`SPRINT_INDEX.md`**
   (the master entry point added 2026-07-14 — it points on to this file for
   Sprint 1 and to `sprint-2/3/4-*.md` for the newer UX-audit sprints; do not
   point straight at this file anymore); line 17 "All feature work on
   `preview-v2`" → `preview-v3`. No other edits.
2. `docs/archive/plan-v2.md` already carries its superseded banner (applied
   2026-07-14). Grep the repo for inbound `plan-v2` references and update
   paths where they mean to point at the new plan; leave historical mentions
   in STATE.md/CURRENT_TASK.md as-is.
3. `CODEBASE_KNOWLEDGE.md`: bump the stale header line ("last updated
   2026-07-13 (Chunk 8)") to 2026-07-14 / Chunk 9. **Header only — do not
   regenerate the document** (body is verified current through §29).
4. `ralph/STATE.md`: update the WS-Z row and backlog entry — migration 014
   applied 2026-07-11 and verified live 2026-07-14 (with 20260714010630 and
   20260714020037); remaining WS-Z closeout = the deferred
   authenticated/offline/theme/zoom/mobile visual QA, which UXF-9 absorbs.
   Add a "UXF batch" status table (UXF-1…10, all `pending`) in the same format
   as the existing tables.
5. `docs/archive/car-profiles/*.md`: already moved out of the live docs/ tree.
   **RESOLVED (Q6):** stays archived — the Car Profiles feature these docs
   specced is already built (`Car`, `GarageView.tsx`, `byActiveCar`, etc. all
   exist in the current codebase); the named branches are gone because the
   work landed elsewhere, not because it was abandoned. No restore needed.

**Out of scope:** editing AGENTS.md, HANDOFF.md content beyond reference-path
fixes; rewriting CODEBASE_KNOWLEDGE body; any src change.

**Acceptance criteria:**
1. A cold agent following PROJECT_INSTRUCTIONS.md lands in `.worktrees\v3` on
   `preview-v3` reading this plan.
2. No doc link 404s (grep-verified) against the archived files' new paths.
3. STATE.md shows no "await migration 014" language anywhere; UXF table
   present.
4. Diff touches only the listed docs/state files.

**Human prerequisites:** none — Q6 resolved, step 5's archival stands as-is.

---

## UXF-9 — Batch QA, draft deploy, owner acceptance *(last; gates the batch)*

**Scope:**
1. Full harness suite PASS: chunk6a, chunk6b, chunk7, chunk8, chunk9,
   ux-r1-starters, ux-r1-color, plus sync/lifecycle checks named in
   HANDOFF.md — with the assertions this batch legitimately changed
   (UXF-2/3/4/5/6 documented which).
2. Lint exact 3-error baseline; Windows build; `git diff --check`; clean tree.
3. Netlify **draft** deploy; verify 320 px and 390 px, light + dark, Default +
   Large font; offline reload from localStorage; authenticated cloud round
   trip of: a coalesced quick-adjust changeLog, a relabeled lifecycle set, a
   removed-until-reset checklist item.
4. Absorb the deferred WS-Z runtime items (authenticated/offline/theme/zoom/
   mobile visual pass) — record closure in STATE.md WS-Z row.
5. Owner walkthrough of all ten handoff corrections against the draft; ws-qa
   records item-by-item accept/reject in STATE.md. **Product acceptance by
   Maxx — not technical PASS — closes this batch** (that distinction is why
   this plan exists).
6. No production deploy, no merge, no APK, no schema change.

**Acceptance criteria:** all of the above green + Maxx sign-off logged.
**Human prerequisites:** Maxx walkthrough availability.

---

## Superseded documents

| Document | Disposition |
|---|---|
| `plan-v2.md` | **Archived** → `docs/archive/plan-v2.md` with superseded banner already applied. WS-N…Z technical content stays valid as history; WS-T/U/W/X/Y remain `pending` in STATE.md and are *not* cancelled — they are simply not in this batch; a future plan re-adopts them. |
| `ralph/STATE.md` | **Kept in place** (not archived) — it is the loop's durable memory across plan generations; UXF-8 corrects its stale WS-Z gate and appends the UXF table. |
| `docs/IMPLEMENTATION_PLAN_2026-07-12.md` | **Archived** → `docs/archive/IMPLEMENTATION_PLAN_2026-07-12.md` — historical record of the Chunk 1–9 track (complete); superseded for forward work by this file. |
| `docs/UX_ANALYSIS_2026-07-12.md` | **Archived** → `docs/archive/UX_ANALYSIS_2026-07-12.md` — superseded by the 2026-07-14 handoff and this plan. |
| `docs/HANDOFF_WS_Z_2026-07-11.md` | **Archived** → `docs/archive/HANDOFF_WS_Z_2026-07-11.md` — WS-Z status folded into `ralph/STATE.md` (UXF-8). |
| `docs/car-profiles/CAR_PROFILES_TASKS.md`, `docs/car-profiles/CAR_PROFILES_IMPLEMENTATION_PLAN.md` | **Archived, confirmed correct (Q6, resolved 2026-07-14):** the Car Profiles feature these docs specced is **already built** — `Car`/`CAR_TYPES` in `src/types.ts`, `src/lib/scope.ts` (`byActiveCar`), `src/components/GarageView.tsx`, `ContextStrip.tsx` all exist and work. The named branches (`feature/car-profiles`, `feature/session-v2`) are gone because the work landed elsewhere, not because it was abandoned. Nothing to restore. |
| `PROJECT_INSTRUCTIONS.md` | **Not archived — corrected** (UXF-8): v2→v3 worktree/branch, plan pointer. |
| `CODEBASE_KNOWLEDGE.md` | Kept; header date bump only (UXF-8). |
| `HANDOFF.md` | **Not archived** — still the live onboarding entry point; its stale WS-Z migration note is corrected by UXF-8's reference-path pass. |

## Decisions log

All six design questions raised during planning were resolved with Maxx on
2026-07-14. Recorded here so a builder agent with no other context has the
rationale, not just the answer.

1. **(Q1 → UXF-3)** "Raced Setup" would mislabel a zero-run test day.
   **Resolved:** use "Finished Setup" for weekends with no logged `'Feature'`
   session; "Raced Setup" only when one exists.
2. **(Q2 → UXF-3)** Historical setups' persisted `versionLabel` text.
   **Resolved:** display-only mapping (recommended option) — no data rewrite.
3. **(Q3 → UXF-4)** Load-graph direction. **Resolved, scope expanded:**
   Y-axis becomes a computed **travel** value (0 = largest height, increasing
   = more compression), with actual measured height still shown alongside
   travel (tooltip/point label) — not a simple axis flip.
4. **(Q4 → UXF-2)** Per-tap audit trail for Quick Adjust. **Resolved:** net
   value only, no audit trail (recommended option).
5. **(Q5 → UXF-6)** Interval consolidation. **Resolved, design corrected
   during follow-up:** car and rig scopes both get Races + Days (not a
   car-only/rig-only split — rig wear happens at race weekends too). No
   legacy-compat burden needed (test data will be wiped before production),
   so `'laps'`/`'sessions'` are dropped outright rather than kept working.
   New requirement surfaced in the same discussion: a **starting-usage**
   field so mid-season onboarding doesn't force parts to start at zero — also
   built with no back-compat constraint.
6. **(Q6 → UXF-8 step 5)** `docs/car-profiles/*.md` disposition. **Resolved
   — and the premise was wrong:** these docs aren't a stale/orphaned idea,
   they specced the Car Profiles feature which **is already built and live**
   in this codebase (`Car`, `GarageView.tsx`, `byActiveCar`, etc. all exist).
   Archived copies stay archived as historical build notes; nothing to
   restore or build.
7. **(UXF-7 → UXF-10)** Main Checklist redesign proposal landed and Maxx approved it as
   written on 2026-07-14. UXF-7 is complete; exact approved implementation runs as UXF-10.

## Process note — planning-model pipeline

This plan was produced by a three-tier Claude pipeline: **Sonnet**
(search/verification pass over docs + code + live Supabase), **Opus**
(resolution of the two open design questions: quick-adjust coalescing,
lifecycle relabel), **Fable** (this synthesis/plan). Convention going forward
for planning-heavy work: Sonnet for inspection, Opus for mid-tier design
resolution, Fable for the hardest reasoning/final plan. **Execution** of this
plan stays on the existing ralph loop routing (GPT 5.6 SOL High plan/QA, GPT
5.6 Terra High build) — this note changes no workstream scope.
