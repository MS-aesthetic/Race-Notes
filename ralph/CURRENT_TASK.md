# Current Task — UXF-9P Owner Preflight Corrections

**Status:** READY FOR IMPLEMENTATION
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md` → UXF-9P
**Next:** UXF-9 final Claude Fable QA plan; no final gate until UXF-9P passes.

## Owner requirements

### 1. No-car guidance

1. Reuse one prominent car-required prompt with an **Add a Car** action that opens
   Settings → Garage.
2. Show it on Setups and Sessions when no active car exists. Dashboard must give the same
   direct path and must not let Log Run/New Race Day continue into a creation form.
3. Context strip must offer Add a Car instead of New Race Day when there are zero cars.
4. Guard every race-day/session creation entry at the App boundary. No-car attempts must not
   open/submit a form or queue a follow-on run. Keep the current save-time guard as defense.
5. Existing active event-owned setup/run behavior remains unchanged.

### 2. Tuning Guide

Top-right Tuning Guide opens directly at **Pit-Side Adjustment Finder**. It must not contain
Tuning Guide/Setup Sheet/Four-Bar/Load Sessions/Compare Setups help cards. Contextual help and
Settings → Guide keep those operating topics. Current source already satisfies this; preserve
and strengthen regression coverage. Screenshot came from an older draft.

### 3. Race Day display vocabulary

Replace user-visible Weekend/Race Weekend copy with Race Day/Race Days throughout app UI,
App Guide, reports, CSV headings, share status, confirmations, accessibility labels, and
`docs/USER_GUIDE.md`.

Keep internal compatibility byte-identical: `RaceWeekend`, `weekends`, `weekendId`,
`weekendName`, `raceweekend`, storage keys, DB tables/columns, function names, lifecycle role
`'weekend'`, and legacy stored `Weekend Setup` mapping. Never rewrite user-created names/free
text. Newly generated fallback labels use Race Day; legacy exact Race Weekend display maps to
Race Day without mutating stored bytes.

## Focused evidence

Add `scripts/uxf9p-owner-corrections-harness.ts` or extend current focused harnesses to prove:

1. No-car Setups/Sessions/Dashboard/Context strip expose Add a Car and route Garage.
2. App creation action and Race Day form guard before opening/submitting; quick-start cannot
   queue a run without a car; active-car path remains available.
3. Current global Tuning Guide begins with Adjustment Finder and excludes five help cards.
4. Direct visible source/report/CSV/guide copy uses Race Day; internal identifiers and legacy
   lifecycle fixture remain unchanged.
5. PDF report title/notes/master section and tire CSV header use Race Day.

Run focused harnesses, exact three-error lint baseline, production build, diff check, cavecrew
review, and a 320/390 light/dark Default/Large runtime. Create one new Netlify draft only after
coherent PASS. No production deploy, push, merge, schema, package/native config, or release APK.

After PASS, write `docs/CLAUDE_FABLE_FINAL_QA_PLAN.md`, update durable state/context, commit,
and hand off final execution. Technical QA must not start from the stale screenshot draft.
