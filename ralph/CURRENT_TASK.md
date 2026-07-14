# Current Task — UXF-2 Quick Adjust Net-Outcome Coalescing

**Status:** IN_PROGRESS — Terra initial build attempt 1
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Prerequisite:** UXF-1 closed by SOL QA at `44be917`

## Goal

Store one net adjustment row per run, corner, and field instead of one row per stepper tap.

## Scope

1. In `applyQuickAdjust`, after `details` exists and only for non-`other` commands, search `setup.changeLog` newest-to-oldest for same `runId`, `corner`, and `field`.
2. When found, replace matching Setup row in place: preserve existing `id` and original `before`; replace `after`, `note`, `loadSessionId`, and `timestamp` with latest command values.
3. Replace matching run adjustment in place using same base ID plus `-run`; preserve original before and set `value` to `<originalBefore> to <latestAfter>`. Append nothing.
4. When no match, or command kind is `other`, keep current new-row behavior and ID patterns.
5. Run ID remains coalescing boundary. Reversal to original value stays as one net row with equal before/after.
6. Update `scripts/chunk7-quick-adjust-harness.ts`: eight rapid RR spring-round taps become one net row plus four earlier distinct rows; assert first rapid ID survives, `0.0` to `4.0`, final field `4.0`; add distinct-field, distinct-run, two-Other, reversal, latest load-session, and sync round-trip cases.
7. Inspect Setup/Race Weekend history renderers for ordering assumptions. Change only if current renderer breaks with in-place rows.

## Files

**Primary:**
- `src/lib/quickAdjust.ts`
- `scripts/chunk7-quick-adjust-harness.ts`

**Inspection only unless needed:**
- Setup/Race Weekend adjustment-history renderers

## Out of scope

- No lifecycle label changes.
- No change to Quick Adjust ownership/lock gates.
- No schema or sync-mapper change; `changeLog` remains JSONB.
- No stepper changes outside Quick Adjust.
- No deploy, push, merge, package, native, or APK work.

## Acceptance

1. Eight `+0.5` taps on one run/corner/field yield one Setup row and one run row, net `0.0` to `4.0`, with correct field value and first command ID.
2. Distinct fields, distinct runs, and `other` commands never coalesce.
3. Reversal remains one `0.0` to `0.0` row.
4. Latest note/load-session/timestamp win; original before and row position remain.
5. JSON/local/cloud round trip preserves coalesced history; `updatedAt` still bumps.
6. Full chunk7 harness passes; lint stays exact three-error baseline; build and `git diff --check` pass.
7. Cavecrew review finds no blocker.

## Routing

Terra owns one initial build pass. Commit feature and durable handoff evidence, then return to SOL High QA. Any QA failure transfers repair to SOL fixer.
