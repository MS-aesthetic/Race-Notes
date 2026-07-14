# Claude Handoff — UX Rework Corrections

**Date:** 2026-07-14  
**Owner:** Maxx  
**Workspace:** `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`  
**Branch:** `preview-v3`  
**Starting commit:** `84d59ea` (Chunks 6B–9 SOL QA closure, before this documentation-only handoff)

## Purpose and authority

Chunks 6B–9 passed their technical QA gates, but the owner has rejected several UX and product decisions after using the result. The corrections in this document supersede prior chunk acceptance wherever they conflict.

This is an analysis and planning handoff, not an implementation specification. First reproduce and trace each issue, then propose a revised dependency-aware plan. Do not treat a prior harness PASS as proof that the current behavior is still desired; some harnesses deliberately encode behavior now being changed.

No application source, database schema, deployment, or native package was changed while preparing this handoff.

## Required reading order

Read these files from the v3 worktree before planning:

1. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\AGENTS.md`
2. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\HANDOFF.md`
3. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\CODEBASE_KNOWLEDGE.md`
4. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\ralph\CURRENT_TASK.md`
5. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\ralph\STATE.md`
6. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\docs\IMPLEMENTATION_PLAN_2026-07-12.md`
7. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\docs\UX_ANALYSIS_2026-07-12.md`
8. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\docs\USER_GUIDE.md`
9. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\plan-v2.md`
10. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\docs\HANDOFF_WS_Z_2026-07-11.md` (historical WS-Z context)
11. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\.agents\skills\cavecrew\SKILL.md`
12. `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3\.agents\skills\caveman\SKILL.md`

`ralph/CURRENT_TASK.md` accurately records what Chunks 6B–9 built, but its owner decisions are historical where this document conflicts. `CODEBASE_KNOWLEDGE.md` contains useful implementation history; verify its status headings against the newer closure entries near the bottom.

## Current release state

- UX work remains isolated on `preview-v3`; production and `master` were not changed.
- Chunks 1–9 are technically complete at `84d59ea`.
- C9 feature commit: `c8c4a21`.
- C9 language repair: `254d928`.
- C9 final QA/docs closure: `84d59ea`.
- Latest draft: `https://6a55bd0dfd16f2bd74bf6c1a--crew-chief-race-notes.netlify.app`.
- That draft predates the final copy-only repair at `254d928`; source/build QA covered the repair, but no replacement draft was made.
- Supabase project: `swblfeayxoprodhwxqak`.
- Relevant applied migrations: `20260714010630_add_load_session_ride_height.sql` and `20260714020037_setup_weekend_lifecycle.sql`.

## Owner corrections

### 1. Tone and copy density

Current copy overcorrected into language that feels simplistic and patronizing. Many screens also explain routine details that do not need permanent inline text.

Desired direction:

- Use concise, professional dirt-racing language.
- Keep established racing and setup terms when racers already understand them.
- Avoid both academic wording and oversimplified “simpleton” wording.
- Keep operational screens focused on the action and current state.
- Move longer explanations, definitions, and app instructions into the App Guide.
- Use short contextual help only where a wrong action has meaningful consequences.

This requires a judgment-based copy audit, not a global word replacement.

Primary files:

- `src/components/QuickReferenceView.tsx`
- `src/components/GuideView.tsx`
- `docs/USER_GUIDE.md`
- Other visible component strings found during the audit

### 2. Tuning Guide is a tuning reference, not an app guide

Remove the app-help/how-to block at the top of the Tuning Guide:

- Setup Sheet
- Four-Bar
- Load Sessions
- Compare Setups

Remove the “Before You Change Anything” explanation.

The Tuning Guide should open directly into useful tuning-reference material: symptom, likely direction, adjustment, expected effect, and cautions. Instructions for operating Crew Chief belong in the App Guide and `docs/USER_GUIDE.md`.

Confirmed source locations:

- `src/components/QuickReferenceView.tsx:712` — Setup Sheet help item
- `src/components/QuickReferenceView.tsx:716` — Four-Bar help item
- `src/components/QuickReferenceView.tsx:720` — Load Sessions help item
- `src/components/QuickReferenceView.tsx:724` — Compare Setups help item
- `src/components/QuickReferenceView.tsx:745` — “Before You Change Anything”

Preserve useful tuning content. Do not remove Setup, four-bar, Load Session, or setup-diff instructions from the App Guide merely because they leave the Tuning Guide.

### 3. Quick Adjust must record outcomes, not clicks

Current C7 behavior appends one `SetupChange` and one run `SetupAdjustment` for every command. Six `+0.5` taps used to add three spring rounds therefore create six history rows.

Confirmed implementation:

- `src/lib/quickAdjust.ts:249` creates a setup change for each command.
- `src/lib/quickAdjust.ts:254` creates a run adjustment for each command.
- `src/lib/quickAdjust.ts:261` appends every command to `Setup.changeLog`.
- `src/lib/quickAdjust.ts:262` prepends every command to `ActiveSession.adjustments`.
- `scripts/chunk7-quick-adjust-harness.ts` currently validates the per-command model and must be revised.

Desired behavior:

- Capture the starting value and latest committed value for a field.
- Show the net result, such as `LR spring rounds: 0 to +3`, instead of six half-round entries.
- Preserve meaningful reversals and the final raced state without exposing button mechanics.
- Apply the same principle to other repeated steppers where multiple taps represent one adjustment decision.
- Keep run/setup provenance and offline/cloud durability.

Claude must recommend the coalescing boundary. Options to evaluate include per active run, per trackside setup, a short editing transaction, or an explicit commit. The plan must define how later reversals are represented and how existing append-only records remain readable.

### 4. Setup progression must be clear and quiet

Owner's intended progression:

1. **Starting Setup** — setup at the beginning of the weekend.
2. **Live/Trackside Setup** — working setup updated as changes are made during the weekend.
3. **Raced Setup** — final state saved when the weekend is finished.

Current implementation uses `baseline`, `weekend`, `final`, and `current` lifecycle roles with visible labels such as Baseline Setup, Weekend Setup, Final Setup, and Current Setup. Core implementation lives in `src/lib/setupLifecycle.ts`; optional metadata lives in `src/types.ts`; App mutation enforcement lives in `src/App.tsx`.

Claude should first determine whether the owner model can be delivered by relabeling and simplifying views over the existing records or whether the extra editable Current record creates real product confusion. Prefer reuse of the proven lifecycle and migration unless a data-model change is justified.

Required behavior:

- Starting Setup stays unchanged for comparison.
- Live/Trackside Setup shows the current car state during the weekend.
- Finish Weekend creates the immutable Raced Setup from the latest trackside state.
- History emphasizes meaningful net changes, not every UI interaction.
- Existing legacy, Baseline/Weekend/Final/Current, offline, sync, car-scope, retry, and lock protections must survive any terminology or model adjustment.

Relevant source and tests:

- `src/lib/setupLifecycle.ts`
- `src/types.ts`
- `src/App.tsx`
- `src/components/SetupView.tsx`
- `scripts/chunk6b-lifecycle-harness.ts`
- `scripts/chunk7-quick-adjust-harness.ts`
- `supabase/migrations/20260714020037_setup_weekend_lifecycle.sql`

### 5. Load graphs need the opposite height-axis direction

Physical and visual requirement:

- Spring/shock compression increases as measured height decreases.
- Load increases during compression.
- The plotted curve should therefore rise as it moves right when load increases and height decreases.

Current single-session and comparison charts map larger height values toward the top:

- `src/components/SmasherLoadsView.tsx:109` maps height with `1 - normalizedHeight`.
- `src/components/SmasherLoadsView.tsx:261` repeats the same mapping for overlays.
- Y-axis labels also place `yMax` at the top.

That is opposite the requested compression view. Revise both chart paths and their tick labels together. Add a pure mapping fixture and visually verify at least one dataset where height falls while load rises; the line must move up and right. Do not change stored measurement values merely to change presentation.

Relevant tests:

- `scripts/chunk6a-refinement-harness.ts` may encode the old direction and must be reviewed.
- Comparison/interpolation behavior in `src/lib/shockCompare.ts` must remain correct.

### 6. Remove unnecessary checklist explanations

Do not show explanatory copy for routine non-actions such as “below 90% of the limit, so it is not on the checklist.” If an item is not due, it generally does not need an explanation on the active checklist or Dashboard.

Keep deeper interval rules and troubleshooting in the App Guide or a detail view. Active surfaces should show useful state only: item, current usage if needed, due state, assignment, and action.

Current automatic item description is also too verbose:

- `src/lib/checklistMaintenance.ts:104` builds usage, remaining amount, and “Added because...” prose into every automatic task.
- `src/components/TrackersView.tsx:551` permanently explains the 90% rule above Maintenance Logs.

Review both against the new progressive-disclosure direction.

### 7. Main Checklist needs a focused UI/UX redesign

Do not patch isolated labels before mapping the whole checklist experience. Analyze:

- Main Checklist source of truth across Trackers and Dashboard
- core, ad-hoc, template, and automatic-maintenance item behavior
- add, edit, assign, complete, clear/remove, and new-weekend reset flows
- completed evidence versus active work
- hidden/tombstoned items and when they return
- automatic maintenance reconciliation
- Dashboard density and duplicate information
- empty state and clear user expectation

Goal: one understandable active list, predictable reset/clear behavior, and preserved history without stale or resurrected items.

Primary source:

- `src/components/ToDoView.tsx`
- `src/components/DashboardView.tsx`
- `src/lib/mainChecklist.ts`
- `src/lib/checklistMaintenance.ts`
- `src/lib/checklists.ts`
- `src/App.tsx`
- `src/types.ts`
- `scripts/chunk8-trackers-harness.ts`

### 8. Maintenance measurements need consolidation

Current choices are `Laps`, `Sessions`, `Feature races`, and `Days`, backed by `MaintenanceIntervalType = 'laps' | 'sessions' | 'races' | 'days'` in `src/types.ts`. The owner sees Laps, Sessions, and Feature Races as redundant variations of the same use-based interval.

Analyze actual racer workflows and existing stored data before selecting a replacement. The plan must cover:

- simplest useful user-facing choices
- whether one use-based counter can replace multiple choices
- automatic derivation from logged sessions/weekends
- manual correction or override
- conversion/display of legacy `laps`, `sessions`, and `races` records
- sync and migration compatibility
- checklist threshold behavior after conversion

Do not delete or reinterpret stored intervals without a defined compatibility policy.

Relevant source:

- `src/types.ts:505` — `MaintenanceIntervalType`
- `src/components/TrackersView.tsx:603` — measurement selector
- `src/lib/maintenance.ts`
- `src/lib/checklistMaintenance.ts`
- `src/lib/sync.ts`
- `supabase/migrations/011_maintenance.sql`

### 9. “Other” appears twice in Maintenance category

Confirmed cause:

- `MAINTENANCE_CATEGORIES` already includes `Other` in `src/types.ts:500`.
- `src/components/TrackersView.tsx:586` maps that full list.
- `src/components/TrackersView.tsx:587` adds a second hard-coded `<option value="Other">Other</option>`.

Remove duplicate rendering while preserving existing stored `Other` values and custom category compatibility. Audit other category pickers for the same pattern.

### 10. Clearing Main Checklist does not clear Dashboard

Confirmed mismatch:

- `ToDoView` hides removed core items using `removedUntilReset` at `src/components/ToDoView.tsx:244`.
- `DashboardView` builds its open list from every unfinished item at `src/components/DashboardView.tsx:107-110` and does not filter `removedUntilReset`.

Result: items removed from Main Checklist can remain visible on Dashboard.

Required acceptance:

- Removing/clearing an active checklist item updates both Main Checklist and Dashboard immediately.
- Dashboard uses the same active-item projection as Main Checklist.
- Completed history remains available according to the revised UX model.
- Automatic maintenance reconciliation must not immediately resurrect a deliberately cleared item without an explicit, documented policy.
- Reload and cloud round trip preserve the same visible state.

Extracting one shared active-item selector is preferable to duplicating filter rules, but final design belongs in the revised plan.

## Product principles for the revised plan

- Respect racers' knowledge. Use shop and setup terms accurately.
- Keep trackside screens fast and quiet.
- Put teaching material in the App Guide; use progressive disclosure elsewhere.
- Record setup outcomes and progression, not button clicks.
- Keep one source of truth for data shown in more than one view.
- Preserve history without mixing it into current work.
- Maintain local-first dual writes, cloud sync, legacy compatibility, car scope, deletion sync, and lifecycle locks.
- Avoid schema changes until the revised product model and migration risks are explicit.

## Requested Claude deliverables

Before implementation, provide:

1. Reproduction notes and root-cause/source map for every issue above.
2. Revised product specification, including exact user-facing setup progression and checklist semantics.
3. Dependency graph and proposed implementation chunks.
4. Data-model decision for setup change coalescing and maintenance measurement consolidation.
5. Legacy/localStorage/Supabase migration and rollback analysis.
6. Acceptance matrix covering unit/pure harnesses, browser runtime, offline reload, authenticated sync, mobile sizes/themes, and Android where risk warrants.
7. Explicit list of old harness assertions that must change because the owner changed the requirement.
8. A copy/content plan separating Tuning Guide, operational UI, contextual help, and App Guide.

Do not begin a broad build until this revised plan is reviewed. Small diagnostic fixtures or prototypes are acceptable if they do not mutate user data or lock in a design prematurely.

## Existing harnesses to review, not blindly preserve

- `scripts/chunk6a-refinement-harness.ts` — load-session and graph-direction expectations
- `scripts/chunk6b-lifecycle-harness.ts` — setup lifecycle, locking, retry, car ownership
- `scripts/chunk7-quick-adjust-harness.ts` — currently validates one-to-one per-command logging
- `scripts/chunk8-trackers-harness.ts` — checklist, maintenance injection, category/copy behavior
- `scripts/chunk9-export-help-harness.ts` — Tuning Guide help anchors and visible-copy audit
- `scripts/ux-r1-starters-harness.ts` — starter-template convergence and tombstone behavior
- `scripts/ux-r1-color-harness.ts` — theme/accent regression coverage
- Existing sync and lifecycle checks named in `HANDOFF.md` and `CODEBASE_KNOWLEDGE.md` — local/cloud regression coverage

Owner corrections require changing some assertions. Preserve unaffected regression protection.

## Boundaries

- Work in `.worktrees\v3` on `preview-v3`.
- Do not merge to `master`, push remote, deploy production, build/copy a release APK, or change Supabase schema without explicit owner authorization.
- Preview/draft deploy only when runtime review is requested by the approved plan.
- Follow SOL High planning/QA and Terra High implementation routing when those models are available; disclose any model limitation.
