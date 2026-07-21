# Claude Fable Final QA Plan — Sprint 1 UX Corrections

**Prepared:** 2026-07-14  
**Worktree:** `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`  
**Branch:** `preview-v3`  
**Owner-preflight feature commit:** `0361278`  
**Final draft:** https://6a56d1d228995bd1cef8c421--crew-chief-race-notes.netlify.app/  

> **2026-07-15 release addendum:** Also verify Settings → Account privacy policy and typed account deletion, public `/privacy/` and `/delete-account/` pages, Netlify request form detection, server-failure local-data preservation, and a disposable authenticated account deletion covering owned uploads plus team-owner transfer. Never use an owner/production account for the destructive test.
> **Policy/deletion draft:** https://6a57b47b1712493e1f563ff9--crew-chief-race-notes.netlify.app/
**Production:** unchanged

## 1. Mission and boundaries

Execute independent final technical QA for UXF-1 through UXF-10 plus UXF-9P. Do not edit
application code during this pass. If a blocker appears, record exact reproduction steps,
expected result, actual result, device/viewport, console evidence, and likely owning file; then
stop and return `FAIL`. A technical `PASS` moves the sprint to `AWAITING OWNER ACCEPTANCE`.
Only Maxx's walkthrough closes Sprint 1.

Do not deploy production, push, merge, change Supabase schema, manually edit cloud rows, change
packages/native configuration, or build/copy a release APK. Normal test-record writes through
the app are allowed only in a disposable/fresh account. Use that account for destructive
empty-car and checklist-clear cases. Do not delete Maxx's real cars or production-like records.

## 2. Read-first authority

Read, in order:

1. `AGENTS.md`
2. `SPRINT_INDEX.md`
3. `plan-v3-ux-corrections.md`
4. `docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md`
5. `ralph/CURRENT_TASK.md`
6. `ralph/STATE.md`
7. `HANDOFF.md`
8. `context/knowledge/CODEBASE_KNOWLEDGE.md`
9. This file

Confirm branch `preview-v3`, feature commit `0361278` is present, and the tree is clean before
testing. Review `0361278` and the final handoff-doc commit. Internal `RaceWeekend`, `weekends`,
`weekendId`, `weekendName`, `raceweekend`, localStorage keys, DB names, sync columns, and
`lifecycleRole: 'weekend'` intentionally remain unchanged.

## 3. Automated gate

Run every command from the v3 worktree:

```powershell
npx.cmd tsx scripts/chunk5-setup-harness.ts
npx.cmd tsx scripts/chunk5-tires-harness.ts
npx.cmd tsx scripts/chunk6a-refinement-harness.ts
npx.cmd tsx scripts/chunk6b-lifecycle-harness.ts
npx.cmd tsx scripts/chunk7-quick-adjust-harness.ts
npx.cmd tsx scripts/chunk8-trackers-harness.ts
npx.cmd tsx scripts/chunk9-export-help-harness.ts
npx.cmd tsx scripts/ux-r1-starters-harness.ts
npx.cmd tsx scripts/ux-r1-color-harness.ts
npx.cmd tsx scripts/uxf9p-owner-corrections-harness.ts
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Expected:

- All ten harnesses pass.
- Lint reports exactly three known errors and no others:
  - `RaceWeekendView.tsx`: existing `unknown` to `File` upload argument.
  - `SetupView.tsx`: existing `key` on `CornerFormProps`.
  - `SmasherLoadsView.tsx`: existing `unknown` to `File` upload argument.
- Build succeeds with 559 modules and 18 PWA precache entries. Chunk-size/dynamic-import
  warnings are known and non-blocking.
- Diff check is clean; worktree has no uncommitted files.

Any additional type error, harness failure, build failure, or dirty unexpected file is a FAIL.

## 4. UXF-9P owner-preflight checks

### A. No-car path

Use a fresh account/device state containing zero cars.

1. Dashboard shows a prominent **Add a Car to Log Runs** action and an **Add a car first**
   prompt in the Active Race Day area.
2. The context strip shows **Add a car to start a Race Day**, not a New Race Day control.
3. Setups shows the shared **Add a car first** prompt.
4. Sessions shows the shared prompt. If an old Race Day is visible but its car is absent,
   **Log Run** is replaced/guarded and no active run editor appears.
5. From Dashboard, Sessions, Setups, context strip, and Export/Start Race Day paths, select
   **Add a Car**, **Log Run**, or **New Race Day**. Every no-car attempt must open
   Settings → Garage directly—even when Settings was last left on another section.
6. No Race Day form or run form opens first. No hidden follow-on run is queued. No Race Day,
   session, Setup, or cloud row is created.
7. Add one car. Confirm New Race Day opens normally; save it; log one run; confirm both are
   car-scoped and survive reload.

### B. Tuning Guide separation

1. Top-right `?` opens **Tuning Guide** directly at **Pit-Side Adjustment Finder**.
2. It must not begin with or contain the five old operating-help cards: Tuning Guide intro,
   Setup Sheet, Four-Bar, Load Sessions, Compare Setups.
3. Settings → Guide still contains operating help for Setup, four-bar, Load Sessions, setup
   comparison, checklist/maintenance, Race Days, and runs.
4. Contextual `?` links from Setup/four-bar/Loads/Compare open their correct App Guide section.
   Reopen two different topics in sequence; the second topic must replace the first.
5. Scrim, Close, and Android Back close help without changing the active app screen.

### C. Race Day language

Walk Dashboard, context picker, Sessions, Setup history/diff, Quick Adjust, Checklist reset,
Maintenance/Accounting filters, Export, Auth shell, App Guide, share menus, confirmations, empty
states, accessibility labels, generated PDF, master PDF, and tire CSV.

- User-facing event wording is **Race Day/Race Days**, not Weekend/Race Weekend.
- Setup lifecycle wording stays Starting Setup → Live-Trackside Setup → Raced Setup when a
  Feature exists, otherwise Finished Setup → Current Setup.
- A known generated legacy label such as `Race Weekend Starting Setup` displays as
  `Race Day Starting Setup` without changing stored bytes.
- User-created names/free text containing “Race Weekend” remain exactly as entered.
- Internal identifiers, storage keys, JSON/cloud fields, and database names are unchanged.

## 5. Whole-sprint functional regression

### Setups and Race Day lifecycle

1. Blank Setup defaults match the approved corner weights, ride heights, pressures,
   caster/camber, and complete LR/RR top/bottom four-bar layout.
2. Start a Race Day from a selected same-car Setup. Confirm immutable Starting Setup,
   editable Live-Trackside Setup, and event-owned `activeSetupId` behavior.
3. Switch Garage car while the Race Day is active. Runs/Quick Adjust must still use the
   event-owned car and Setup; a new Race Day for the other car must not clone cross-car bytes.
4. Finish a zero-run test and a Feature Race Day. Confirm immutable Finished/Raced Setup and
   editable Current Setup. Finished Race Days do not auto-activate.
5. Legacy/no-link/dangling-link and partial-finish recovery paths remain safe and idempotent.

### Quick Adjust

1. Verify LF/RF/LR/RR selection; spring rate ±25; spring rounds ±0.5 and ride-height review
   marker; shock note and filtered Load Session; J-bar frame/pinion ±0.25; manual gear;
   four-bar and Other Change.
2. Multiple taps on the same run/corner/field create one net-outcome row, preserving the
   original before value and latest after value. Reversal remains visible as a net row.
3. Different fields, corners, runs, and Other Change rows stay distinct.
4. Run history and Live-Trackside Setup changeLog remain paired and survive reload/cloud pull.

### Load Sessions

1. New Load Session accepts optional Ride Height C-to-C.
2. Single graph uses tallest valid height as zero travel; more compression moves up/right.
3. Comparison uses one common zero across all selected sessions—not a separate zero per line.
4. Travel and actual Height are available by pointer, keyboard, and accessible name; static
   height labels survive SVG/PNG export. CSV/table retain raw measured height.

### Main Checklist

1. One canonical Main Checklist only. Dashboard shows one compact `Checklist · N open · M mine`
   launcher or `Checklist clear`; no task-name previews.
2. Open items appear first. Whole-row completion target is at least 56 px; row actions are at
   least 44 px and do not accidentally complete the task.
3. Completion occurs exactly once. Six-second Undo restores prior bytes. Mark open works.
   Completion note persists.
4. Manage sheet owns saved-list import/management, carry preference, Reset, Clear current list,
   Clear completed, and grouped History. Android Back closes it first.
5. Reset carries only unfinished ad-hoc items when enabled and opens exactly one eligible
   core/template/maintenance recurrence. Clear hides removed items immediately on both
   Checklist and Dashboard.
6. Same-cycle maintenance tombstones suppress recreation. Archived history does not suppress
   a later eligible cycle. Deleted templates and no-longer-due maintenance stay absent.
7. Text, notes, assignment, My Tasks, template-imported assignment, and automatic-maintenance
   assignment all remain editable after creation.

### Maintenance and Accounting

1. Visible interval choices are only Races and Days for car and rig.
2. Defaults: Engine oil 3 races; Motor freshen 10 races; Transmission fluid 60 days;
   Wheel bearings 10 races; Shock rebuild 10 races; Trailer bearings 180 days.
3. One Race equals one distinct Race Day containing inferred Feature. Multiple Features in one
   Race Day count once. Same-calendar-day service resets to zero; next calendar day counts one.
4. Starting usage defaults zero, adds to derived usage, and resets on service. Manual units are
   a full override. Undo restores prior bytes.
5. At exactly 90% a stable automatic checklist job appears; 89.9% does not. Service/below
   threshold removes unfinished automatic work but preserves completed history.
6. Accounting defaults to local today and last-used category. Five most-recent distinct chips
   fill description/category only and never change amount/date. `Other` appears once.

### Export, share, persistence, and scope

1. Export reports preserve content and produce valid PDFs. Setup/Race Day share contains only
   the selected record. Native share uses a real file; browser fallback downloads; cancel is
   quiet; failures never report success; date-only filenames do not timezone-shift.
2. Create/edit/delete for every touched entity updates React state and localStorage together.
   Reload offline and confirm the same records, active projections, archived history, labels,
   Quick Adjust net rows, and maintenance starting usage.
3. With an authenticated disposable account, verify cloud round trip for Setup lifecycle,
   Race Day/session, Quick Adjust changeLog, Todo `archivedAt`/tombstone state, Load Session
   ride height, and Maintenance `starting_usage`. Confirm deletion does not resurrect.
4. Verify car scoping for Setups, tires, Load Sessions, Quick Adjust, and car maintenance.
   Rig maintenance, Race Days, checklist, and accounting remain intentionally global where
   documented.

If authenticated cloud testing is unavailable, say so explicitly. Do not infer a pass from
pure mapper tests; report that portion as `NOT RUN`, not FAIL, unless the path itself is broken.

## 6. Visual/runtime matrix

Run authenticated app checks at both 320×800 and 390×844:

| Theme | Size |
|---|---|
| Dark | Default |
| Dark | Large |
| Light | Default |
| Light | Large |

For every combination verify no horizontal overflow, clipped sheets, nested task scrolling,
hidden actions, unreadable accent/secondary text, or text below the approved floor. Check the
Dashboard, Sessions/Race Day form, Setup corners/four-bar, Load graph, Quick Adjust, Checklist
Manage/History, Maintenance editor, Tuning Guide finder, App Guide, and Export.

Run Android debug only if an already-configured debug environment is available. Verify cold
launch, offline launch, system Back priority, share chooser, keyboard/focus flow, and no crash
logs. Do not bump version or produce/copy a release APK.

The prepared final draft was already checked signed-out at 320 and 390: no horizontal overflow,
no console warnings/errors, and Auth copy says Race Days. That is supporting evidence only; it
does not replace authenticated feature testing.

## 7. Final report format

Return one report with:

1. `PASS`, `FAIL`, or `PASS WITH NOT-RUN EXTERNAL GATES`.
2. Commit and draft URL tested.
3. Automated gate table with actual output.
4. UXF-9P checks A/B/C, item by item.
5. Whole-sprint sections, item by item.
6. Runtime matrix with device/browser, viewport, theme, and size.
7. Cloud/offline/Android evidence, clearly separating tested from unavailable.
8. Every finding with severity, exact reproduction, expected/actual, screenshot/log, and likely
   owning file.
9. Explicit confirmation that production, Git remote, schema, packages, native config, and
   release APK were untouched.
10. If technically green, final state: `AWAITING OWNER ACCEPTANCE` and the exact owner
    walkthrough items still needing Maxx's sign-off.
