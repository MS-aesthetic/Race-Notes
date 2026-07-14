# Current Task — UX Chunks 6B–9 Completion Run

**Status:** IN PROGRESS — C6B SOL QA ATTEMPT 3 PASS; C7 READY FOR TERRA BUILD
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Model route:** GPT 5.6 SOL High plan/QA; GPT 5.6 Terra High build.
**Communication/delegation:** `/caveman full`; cavecrew investigators/reviewers.

## Owner decisions

- Finish Weekend always works, including zero-run test days. Button lives at page bottom.
- Setup history uses immutable Baseline, editable Weekend Setup, immutable Final,
  then editable Current Setup copied from Final.
- Use dedicated version labels; never overload chassis.
- C7 structured and free-text changes update both current run and Weekend Setup log.
- Main Checklist automatically receives maintenance jobs at 90% of configured
  interval. Users can assign any job after creation, including imported/automatic jobs.
- Testing may consolidate where risk permits. C6B keeps its own gate; C7+C8 share
  one coherent gate; C9 owns final whole-app regression.

## Chunk 6B — setup lifecycle

### Data contract

- `Setup` optional metadata: `versionLabel`, `lifecycleRole`
  (`current|baseline|weekend|final`), `sourceSetupId`, `weekendId`, `lockedAt`,
  `changeLog`, `updatedAt`. Missing role means editable Current for legacy data.
- `RaceWeekend` optional metadata: `status` (`active|finished`), `finishedAt`,
  `sourceSetupId`, `baselineSetupId`, `activeSetupId`, `finalSetupId`, `updatedAt`.
  Missing status means active.
- Setup changes are append-only records with unique ID, timestamp, label, optional
  corner/field, before/after, note, run ID, and Load Session ID.
- Keep legacy `RaceWeekend.setupId` as Baseline compatibility alias for current
  maintenance/tire consumers. Lifecycle resolver prefers Final, then active Weekend,
  then Baseline, then legacy setup.

### Behavior

1. Starting weekend chooses selected same-car setup, else current/latest same-car
   setup, else exact blank factory. Clone distinct Baseline and Weekend Setup rows.
2. Baseline is view-only. Weekend Setup becomes selected edit target and owns empty
   event change log. Weekend creation cannot later rebind lifecycle IDs.
3. App boundary rejects mutations/deletion of Baseline/Final and completed Weekend
   snapshots; UI also renders them view-only. Clone remains allowed and produces Current.
4. All event setup writes resolve through `activeSetupId`, never generic latest setup.
5. Finish transaction, local-first and synchronous: snapshot Final, lock Weekend Setup,
   mark weekend finished, clear active weekend and active run, clone Final to editable
   Current, select Current, persist all keys, then cloud push.
6. Finished weekends remain visible history but cannot activate or accept runs.
   Auto-pick, stale recovery, Dashboard, and ContextStrip exclude them.
7. Timestamp-aware merge prevents older cloud data from undoing an offline finish.

### Cloud/migration

- Create migration with `supabase migration new`; additive nullable/default-safe
  columns only, no lifecycle foreign keys.
- Explicit mappings for lifecycle fields, timestamps, setup change log, and currently
  omitted setup scalars (`toe`, `jbar`, `jbar_frame_height`, `jbar_pinion_height`,
  stagger/pull-bar fields as live schema requires).
- Verify live `information_schema`, migration history, push/pull round trip, and advisors.

### C6B acceptance/gate

- Pure harness covers start from source/blank, distinct IDs, immutable snapshots,
  finish with zero sessions, editable Current copy, legacy defaults, and locked writes.
- Offline reload preserves lifecycle; stale cloud fixture cannot reactivate finished event.
- Finished weekends excluded from active pickers; history still viewable.
- Exact three-error lint baseline; build PASS; cavecrew diff review; focused mobile
  light/dark Default/Large runtime; authenticated cloud round trip; Netlify draft.

### C6B Terra result — 2026-07-13

- Feature commit `2a941d3`; cavecrew review PASS after fixing both cross-car
  `activeSetupId` ownership paths.
- Pure lifecycle harness PASS. Lint remains the exact three known errors. Vite build
  PASS (540 modules, 16 Workbox entries). `git diff --check` PASS.
- Additive migration `20260714020037_setup_weekend_lifecycle.sql` applied to and
  verified on Supabase project `swblfeayxoprodhwxqak`; all 25 expected columns and
  migration history are present. Existing advisor warnings were not broadened.
- Local 390 px runtime PASS: start from exact blank, immutable Baseline, editable
  Weekend Setup/change log, page-bottom Finish with zero runs, finished history,
  immutable Final and Weekend snapshots, editable selected Current, dark/light.
- Draft `https://6a5599e37111d0563ffaf5f3--crew-chief-race-notes.netlify.app` loads
  cleanly. Its unique origin had no remembered account, so authenticated draft data
  entry was not performed; SOL must adjudicate cloud evidence independently.
- Production, `master`, remote branch, and release APK unchanged. C7 not started.

### C6B SOL QA attempt 1 — FAIL (2026-07-13)

- `src/App.tsx`: after Car A owns the active weekend, switching to Car B and
  starting another weekend can fall back to Car A's Weekend Setup. Source fallback
  must stay same-car: explicit selected setup → current/latest active-car setup → blank.
- `src/lib/setupLifecycle.ts`: pre-C6B weekends have no `activeSetupId`; Finish must
  upgrade/fallback from legacy `setupId` into a dedicated Weekend snapshot without
  locking or mutating the original source.
- `src/lib/setupLifecycle.ts`: Finish is not recovery-safe. A crash after setup
  localStorage but before weekend localStorage leaves a locked Weekend Setup and
  blocks retry; preexisting deterministic Final/Current IDs can duplicate. Retry
  must complete the matching partial lifecycle and replace/dedupe deterministic IDs.
- Required repair harnesses: cross-car new-weekend source, zero-session legacy Finish,
  partial-finish retry, and unique lifecycle IDs. Existing harness/lint/build/live
  schema/migration/RLS/draft shell all pass. C7 remains blocked.

### C6B Terra repair — complete, awaiting SOL QA attempt 2 (2026-07-13)

- Repair commit `874fecc` keeps new-weekend source selection same-car and separates
  active-car setup from event-owned RaceWeekend setup.
- Legacy zero-session Finish upgrades a valid linked source into its own Weekend
  snapshot without changing the original. Missing legacy links can use exact same-car
  or blank fallback; dangling explicit links fail safely and never borrow another car.
- Interrupted Finish is idempotent: deterministic Weekend/Final/Current IDs replace
  duplicates, matching snapshots retain lock/update timestamps and history, and retry
  completes the still-active weekend.
- Expanded lifecycle/source harness PASS; cavecrew re-review reports no issues.
  Exact three-error lint baseline, 540-module build, and `git diff --check` PASS.
- Draft `https://6a55a024d663b44ca4f639c7--crew-chief-race-notes.netlify.app`
  loads at 390 px with no console errors. Unique origin remains at login gate, so
  legacy/partial recovery is covered by pure harness rather than authenticated UI.
- Migration unchanged. Production, remote branch, `master`, and release APK unchanged.
  C7 remains locked pending independent SOL QA attempt 2.

### C6B SOL QA attempt 2 — FAIL (2026-07-13)

1. `src/App.tsx`: when an active weekend's owned Setup is missing/invalid,
   `raceWeekendSetup` falls back to selected car's generic setup. RaceWeekend quick
   edit can then expose/mutate another car. If an active weekend exists, pass only its
   valid event-owned Setup or `null`; generic active-car fallback is allowed only when
   no active weekend exists.
2. `src/App.tsx`: legacy weekend with no `setupId` receives `activeCarSetup` as Finish
   fallback. Switching selector before Finish silently copies that car's data. Use a
   proven event-car source when one exists; otherwise create exact blank fallback.
3. `src/lib/setupLifecycle.ts`: deterministic Final/Current rows are reused even when
   matching Weekend Setup is still unlocked. Stale rows can replace newer active data.
   Reuse recovery rows only when matching Weekend snapshot is already locked; otherwise
   rebuild Final/Current from current Weekend Setup and replace deterministic IDs.
4. Completed Weekend immutability depends only on `Setup.lockedAt`. A partial cloud
   state can contain finished `RaceWeekend` plus unlocked Weekend Setup, which remains
   editable/deletable. App boundary and UI lock checks must also treat a Weekend Setup
   tied to a finished weekend as historical regardless of missing `lockedAt`.

Required repair harness additions: missing event-owned setup never falls back through
RaceWeekend UI; no-link legacy Finish after car switch uses blank/proven source only;
unlocked Weekend plus stale deterministic rows rebuilds from Weekend data; finished
weekend relationship locks an unlocked Weekend snapshot. Existing harness, exact
three-error lint baseline, 540-module build, live migration/schema/RLS, and draft HTTP
shell pass. Live `setups`/`race_weekends` contain zero rows, so no authenticated data
round trip was available. Advisors show no setup/weekend security finding; existing
performance-policy warnings predate this column-only migration. C7 remains locked.

### C6B Terra repair 2 — CODE_PASS, awaiting SOL QA attempt 3 (2026-07-13)

- Feature repair commit `7b58b30` removes generic selected-car fallback whenever an
  active weekend exists. RaceWeekend receives its valid owned Weekend Setup or `null`;
  New Session/run editor and quick adjustments stay guarded with plain recovery copy,
  while Finish Weekend remains available.
- No-link legacy Finish now receives a newly constructed exact blank setup only. It may
  carry selected car identity for future Current ownership, but never copies selected
  setup values. Valid legacy `setupId` upgrade and dangling-link rejection remain intact.
- Deterministic Final/Current rows are reused only for a true partial Finish whose
  matching Weekend snapshot is already locked. An unlocked Weekend rebuilds both rows
  from its latest bytes and replaces/dedupes stale deterministic IDs.
- `isSetupLocked(setup, weekends)` adds relational protection: a Weekend-role Setup
  linked to a finished weekend is immutable at App mutation/deletion boundaries and
  in Setup UI even when `lockedAt` is missing. Clone remains enabled.
- Expanded harness covers Car A event/Car B selector isolation, missing event-owned UI
  resolution, blank no-link Finish, unlocked gear 7 versus stale gear 6 recovery,
  deterministic uniqueness, and relationship locking. PASS. Cavecrew review: no issues.
- Exact three-error lint baseline; build PASS (540 modules, 16 Workbox entries);
  `git diff --check` PASS. Draft
  `https://6a55a43a8cc5f6b9da612c69--crew-chief-race-notes.netlify.app` boots at
  390×844 with zero console errors. Unique origin has no remembered account, so deep
  lifecycle UI remains harness/local evidence. Migration and live schema unchanged.
- Production, remote branch, `master`, and release APK unchanged. C7 remains locked
  until independent SOL QA attempt 3 passes.

### C6B SOL QA attempt 3 — PASS (2026-07-13)

- Independent inspection and two cavecrew reviews found no issues across event-owned
  setup resolution, missing-setup guards, no-link legacy Finish, stale-row recovery,
  partial-Finish chronology, relationship locks, App mutation/deletion enforcement,
  clone behavior, local-first persistence, sync mappings, and finished-event exclusion.
- Expanded lifecycle harness PASS. `npm run lint` remains exactly the three known
  baseline errors. Vite build PASS: 540 modules and 16 Workbox entries.
  `git diff --check 19a2989..e0e8343` PASS; worktree clean before QA docs.
- Supabase project `swblfeayxoprodhwxqak`: migration `20260714020037` present;
  all 23 explicitly checked mapped lifecycle/scalar columns present; RLS enabled and
  authenticated CRUD granted on `setups`/`race_weekends`. Both tables contain zero
  rows, so no authenticated lifecycle data round trip was available. Security advisor
  has zero setup/weekend findings; pre-existing RLS performance warnings remain.
- Current Supabase grant-default breaking change affects newly created tables, not
  this additive-column migration on existing exposed tables.
- Draft `https://6a55a43a8cc5f6b9da612c69--crew-chief-race-notes.netlify.app`
  boots at 390×844 with zero console errors. Draft and localhost origins both lacked
  a remembered account; deep lifecycle runtime remains prior local evidence plus pure
  fixtures. No production deploy, remote push, master merge, or release APK.
- C6B closed. C7 unlocked for Terra High implementation; C7+C8 keep planned combined
  coherent gate after focused per-chunk harnesses.

## Chunk 7 — expanded Quick Adjust

- Active unfinished Weekend Setup only. No unsafe controls without active run/weekend.
- Corner selector LF/RF/LR/RR.
- Spring Rate reads setup; ±25 lb. Legacy numeric strings such as `500 lb` normalize
  only when user changes them; blank/non-numeric values require manual entry.
- Spring Rounds uses cumulative ±0.5. Any rounds change marks that corner's Ride
  Height C-to-C for review. Only explicit C-to-C update clears marker.
- Shock supports committed note plus real Load Session picker filtered by active car
  and matching corner. Note and graph binding persist independently.
- J-Bar Frame and Pinion use ±0.25 in. Gear is manual committed entry.
- Four-bar remains available. Other Change free text remains.
- Every committed structured/free-text change appends once to current run adjustments
  and once to Weekend Setup change log. Rapid taps cannot lose or duplicate entries.
- C7 harness covers numeric steps, marker lifecycle, car/corner graph filter, sync
  round trip, lock protection, and one-to-one log/run entries.

### C7 Terra CODE_PASS — awaiting SOL QA

- Feature commit `58e4522`. `QuickAdjustPanel` routes Spring Rate, Spring Rounds,
  shock note/Load Session, J-Bar, gear, Other Change, and Four-bar through one
  App-owned atomic commit path.
- Target resolution requires active unfinished weekend, its valid event-owned Weekend
  Setup, and a run ID still present in that weekend. Selected Garage car/setup never
  participates. App refs serialize rapid commands before React renders.
- Each successful command appends one provenance-bearing run adjustment and one Setup
  change. New optional corner/history fields remain inside existing JSON columns;
  `setupSync.ts` extracts the unchanged explicit mapper for pure round-trip tests.
  No SQL migration.
- Spring strings remain byte-preserved until deliberate edit. Step/manual commit then
  canonicalizes numeric values. Spring rounds mark Ride Height C-to-C; only explicit
  C-to-C editing clears marker. Setup Load picker now uses real same-car/corner rows.
- Focused harness PASS; `git diff --check` PASS; lint has exact three known baseline
  errors only. Cavecrew review found two medium and three low issues; all fixed, then
  re-review returned `No issues.` Full build/cloud/mobile/draft gate stays consolidated
  after C8 per owner direction. C8 remains locked pending SOL C7 verdict.

### C7 SOL QA attempt 1 — FAIL; return to Terra

- `stepSpringRate()` snaps to a global 25 lb grid after adding the delta. Off-grid
  legacy `510 lb` therefore becomes `525`, but a deliberate +25 change must become
  `535`. `stepQuarterInch()` has the same error: `9.10 + 0.25` becomes `9.25`, not
  `9.35`. Preserve parsed base, add exact delta, then format decimals; normalization
  means removing legacy units, not changing the requested increment.
- App derives `activeWeekend = null` when raw `activeWeekendId` points to a finished
  weekend, then `selectRaceWeekendSetup()` falls back to selected-car Setup. Pass
  `null` to RaceWeekend whenever any raw weekend selection exists but is not a valid
  unfinished owned event, so unsafe generic Setup never reaches event UI.
- `RaceWeekendView.hasActiveSession` checks only matching IDs. It must also require
  unfinished `currentWeekend` and a matching run still present in
  `currentWeekend.sessions`; stale/cloud-deleted runs must not render editor/Quick
  Adjust even though App commit boundary already rejects them.
- Add off-grid spring/J-Bar fixtures plus finished-weekend and deleted-run UI resolver
  fixtures. Re-run focused harness, exact lint baseline, diff check, cavecrew review.
  No SQL change. C8 stays locked until repair passes SOL QA attempt 2.

### C7 Terra repair 1 CODE_PASS — awaiting SOL QA attempt 2

- Repair commit `030122c`. Numeric normalization now preserves parsed values; +/-
  commands add exact relative deltas and trim units/trailing zeroes without grid snap.
  Expanded fixtures cover `510 ±25`, `9.10 ±0.25`, `9.125 +0.25`, and both J-Bar
  fields in full Setup/run transactions.
- `selectRaceWeekendSetupForSelection()` distinguishes no raw selection from stale,
  invalid, or finished selection. Generic active-car Setup is available only with no
  raw weekend ID; every raw invalid/finished event returns `null` to RaceWeekend UI.
- `isQuickAdjustRunAvailable()` requires unfinished selected weekend, exact owned
  Weekend Setup, matching active run IDs, and run membership in weekend sessions.
  Deleted/stale runs and finished events no longer render editor/Quick Adjust.
- Expanded C7 harness PASS; exact three-error lint baseline; `git diff --check` PASS;
  cavecrew repair review `No issues.` No SQL/build/cloud/mobile/draft change. C8 stays
  locked until independent SOL QA attempt 2.

## Chunk 8 — Trackers and Maintenance Logs

- Rename visible Service wording/tab to Maintenance Logs; identifiers/storage stay stable.
- Explain interval tracking in plain shop language: used amount, configured limit,
  remaining amount, and why a job appears.
- Main Checklist item kind is optional `core|adhoc`; missing kind reads as core.
- Reset for new weekend unchecks/re-materializes core jobs. Keep-added-items toggle
  defaults on and is remembered; when off, ad-hoc jobs are removed.
- Entire checklist row toggles with >=56 px target. Edit action supports text, notes,
  and assignment after creation for manual, template-imported, and automatic jobs.
- Move Templates under Checklist as Edit List/Manage. Remove top-level Templates tab;
  preserve CRUD and deterministic starter convergence.
- Reconcile maintenance jobs at `pct >= 0.90` into Main Checklist with stable source ID.
  Repeated reconciliation is idempotent. After service/reset below threshold, remove
  only unfinished automatic job; preserve completed history.
- Accounting new entry defaults date today and category last used; five recent distinct
  description/category chips fill repeat details but not amount.

## Chunk 9 — export, help, copy, final regression

- Extract pure PDF generation into `src/lib/exportPdf.ts`; Export screen unchanged.
- Setup/weekend card Share uses native file share when supported, desktop download fallback.
- Add contextual help anchors for Setup, four-bar, Load Sessions, and setup diff.
- Display-string-only racer-language audit. No identifier/storage-key renames.
- Whole-app regression: both themes, Default/Large, 320/390 mobile, online/offline,
  setup lifecycle, Quick Adjust, checklist/maintenance automation, assignment,
  PDF share/download, Android back, auth shell, car scoping, deletion sync.
- Final exact lint baseline, build, harness suite, cavecrew review, Supabase verification,
  Android runtime, and one final Netlify draft. Production/master remain unchanged.

## Execution / QA consolidation

1. Terra builds C6B. SOL independently QAs C6B because it changes ownership, sync,
   migration, and finish semantics.
2. Terra builds C7 then C8 serially. Focused harnesses run during each build; one combined
   lint/build/cloud/mobile/draft gate runs after both. SOL adjudicates each chunk from
   same evidence and returns any blocker to Terra.
3. Terra builds C9. SOL runs full regression and closes chunks 6B–9 only when all hard
   gates pass. No production deploy, master merge, or remote push without owner request.
