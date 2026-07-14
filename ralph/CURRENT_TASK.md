# Current Task — UXF-2 Quick Adjust Net-Outcome Coalescing

**Status:** QA FAIL — SOL QA attempt 1; route repair to SOL fixer attempt 2
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

## Implementation evidence

- Feature commit: `1dd5b75`.
- Non-`other` commands scan Setup history newest-to-oldest by run, corner, and field; matching Setup/run rows keep original IDs, before values, and array positions while latest after/note/load/timestamp replace prior values.
- `other`, distinct fields, and distinct runs remain separate. Reversal remains one equal-before/after row.
- Quick Adjust lock/ownership gates remain byte-identical. App local/cloud full-state write path and JSONB mapper remain unchanged.
- Setup renderer reverses stored history; Race Weekend renderer uses run-array order. Neither assumes new IDs or append-only updates.
- Expanded chunk7 harness covers rapid net result, first ID, row position, distinct fields/runs, two `other` rows, reversal, latest load binding, JSON session persistence, and Setup cloud round trip; PASS.
- `npm run lint`: exact three known baseline errors only.
- `npm run build`: PASS, 554 modules and 18 PWA entries. `git diff --check`: PASS. Cavecrew review: `No issues.`
- No lifecycle label, schema, mapper, stepper, package, native, deploy, push, merge, or APK change.

## QA attempt 1 finding

1. **Missing matching run row reports false success and splits histories.** `src/lib/quickAdjust.ts:276-306` finds a matching Setup change, synthesizes a returned adjustment when `${baseId}-run` is absent, but leaves `session.adjustments` unchanged while returning success and bumping both timestamps. Setup and run histories diverge. Because coalescing must not append, fail explicitly before returning any mutated result when matching run row is absent. Add a harness fixture proving `ok === false` and both input objects remain byte-identical. All other coalescing, persistence, lock, renderer, scope, harness, lint, build, and diff gates pass.
