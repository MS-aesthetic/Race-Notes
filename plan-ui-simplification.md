# Plan — UI Simplification Sprint (feature/ui-simplification)

**Branch:** `feature/ui-simplification` (off `master` @ `13343e5`, v5.2.1 / versionCode 24)
**Status:** SPEC — awaiting owner approval of decision points, then Chunk A begins.
**Direction note:** This branch is one of two parallel directions the owner may develop.
`master` stays untouched as the "full-featured" direction. Do NOT merge to master without
an explicit owner decision. Rebase onto master only if master moves.

## Model routing (per owner instruction)

| Role | Model |
| --- | --- |
| Investigation / inspection | Sonnet 5 High |
| Build / implementation | Opus 5 medium |
| Quick QA + plan updates after each task | Opus 5 High |
| Chunk QA gate + owner communication | Fable 5 High (session lead) |

Workflow per chunk: Opus 5 medium implements → Opus 5 High quick-QAs the diff and updates
this plan's checkboxes/notes → Fable 5 High runs the chunk QA gate before the chunk commit.
One commit per chunk, message prefix `feat(simplify):` or `refactor(simplify):`.

## Ground rules

- **Frontend-only where sensible.** No Supabase schema changes, no type/field deletions in
  `src/types.ts`. Removed UI just stops writing fields; historical data keeps rendering.
- **Baseline guard:** `npm run lint` (tsc) has exactly 3 pre-existing errors
  (`RaceWeekendView.tsx:467`, `SetupView.tsx:890`, `SmasherLoadsView.tsx:617` — line numbers
  may shift). After every chunk: still exactly 3, same errors, no new ones. `npm run build`
  must pass.
- **Shared components that must NOT be deleted** (verified consumers elsewhere):
  `FourBarQuickAdjust.tsx` (used by SetupView), `NumberStepper`, `SegmentedGrid`,
  `BottomSheet`, `ConfirmSheet`, `LapTimeKeypad`, `EmptyState`, `CarRequiredPrompt`,
  `UndoToast`/`InfoToast`, `applyExplicitCornerField` in `lib/quickAdjust.ts` (used by SetupView).
- Investigation reference: full findings live in the session that produced this plan;
  key line references are inlined per chunk below.

## Decision points (owner)

- **D1 — "Synced / Syncing…" pills.** The save-confirmation surface is a 3-way arbiter in
  `App.tsx:2690-2740`: `infoToast` (feature notices — stays), `savedFlash` ("Saved" /
  "Offline — saved on device" — removed), and `syncStatus` notices. `Synced`/`Syncing…` fire
  on every debounced cloud push — functionally another "it saved" pill, and today users see
  "Saved" then "Synced" back-to-back. **Default (in scope): remove `synced`/`syncing`
  confirmations too; keep `sync-error` and `deferred-delete-retrying` warnings.**
- **D2 — "Next Session" behavior.** Today's SAVE RUN button doesn't actually save anything
  new (every keystroke already persists); it only clears the dirty flag and collapses the
  editor. A button named "Next Session" implies advancing. **Default (in scope): on tap —
  persist, collapse the finished editor, and open the new-session form (`openNewSession()`),
  same flow as the existing "Log Run" CTA.** If owner wants label/position change only, say
  so and Chunk C shrinks.
- **D3 — Setup lifecycle system.** The baseline/weekend/final setup versioning
  (`setupLifecycle.ts`, 538 lines, weekend create/finish hooks) exists to support live
  trackside setup evolution. Removing quick-adjust weakens its purpose, but ripping it out
  is a large architectural change touching weekend flows and historical references.
  **Out of scope for this sprint. Deferred follow-up decision.**

---

## Chunk A — Remove "Saved" confirmations

**Goal:** no save-confirmation pills, ever. Errors and feature info notices unchanged.

Scope (all in `src/App.tsx` unless noted):
- [ ] Remove `savedFlash`/`savedFlashTimer` state (~1129-1130), `clearSavedFlash`,
      `flashSaved` (1133-1163), and the `savedFlash` branch of the notification arbiter
      JSX (2690-2740). Keep `infoToast` branch fully intact.
- [ ] Remove the dirty-flag plumbing: `SavedFeedbackController`/`createSavedFeedbackController`
      (73-91), `installSavedFeedbackBoundaries` (93-129), `flushSavedFeedbackOnTabChange`
      (131-135), refs (295-297), wiring effects (1164-1183), `SAVED_FEEDBACK_INTERVAL_MS`.
- [ ] Remove `markSavedDirty`/`flushSavedBoundary` (298-299) **and all ~24 call sites**
      (grep `markSavedDirty` to zero). Prefer deleting call lines over a no-op stub —
      leave no dead machinery.
- [ ] Per D1 default: stop rendering `Syncing…`/`Synced`/`Offline — saved on device` status
      notices; keep `Sync failed — will retry` and deferred-delete warnings rendering
      exactly as today. `SyncStatus` type in `src/lib/sync.ts` is NOT changed (frontend-only);
      the arbiter just ignores the non-error statuses.
- [ ] Remove the `"Saved as you change it"` caption + pulsing dot in `SetupView.tsx:591`
      (it's a save-confirmation in spirit; Setups header gets cleaner too).

Acceptance criteria:
- Editing any field in any tab produces zero "Saved"/"Synced"/"Syncing" pills across tab
  switches, app background, and 30s+ idle.
- Forcing a sync failure (airplane mode + edit + reconnect-fail) still shows the sync-error
  warning. Feature info toasts (e.g. car-switch notice, share confirmations) still appear.
- `grep -i "markSavedDirty\|savedFlash\|flashSaved"` returns nothing.
- tsc: same 3 baseline errors; build passes.

Est: ~150-200 lines removed, single file + one caption. Risk: medium (3-way arbiter surgery).

## Chunk B — Runs tab: remove Tires & Pressures + Changes Made

**Goal:** Active Session Editor keeps Identity, Track Condition, Laps & Result, Handling
Diagnostics, Competition Notes, Attachments. Sections "Tires & Pressures" and "Changes Made"
(including the Four-bar Quick Adjust trigger) are gone.

Scope:
- [ ] `RaceWeekendView.tsx`: delete JSX sections 5-6 (1388-1477), `fourBarOpen` state (293)
      + its visibility effect (309-313), the four-bar `BottomSheet` (1724-1726),
      `handleQuickAdjustCommit`/`handleQuickFourBarChange` (449-460),
      `handleImportTiresFromSetup` (~410-447), now-unused imports
      (`QuickAdjustPanel`, `FourBarQuickAdjust`).
- [ ] Delete `src/components/QuickAdjustPanel.tsx` (only consumer is RaceWeekendView — verified).
- [ ] `App.tsx`: delete `handleCommitQuickAdjust` (1966-2010), the `onCommitQuickAdjust`
      prop (2832) and prop-type plumbing, `applyQuickAdjust`/`resolveQuickAdjustTarget` imports.
- [ ] `lib/quickAdjust.ts`: trim to `applyExplicitCornerField` (+ its minimal deps) only.
- [ ] Do NOT touch: session-creation pressure propagation (`setupSteps.ts` helpers in
      `handleCreateNewSession`), historical rendering (`SessionSetupDetails`,
      `BoundSetupDiffSummary`, RaceWeekendView 136-242), `FourBarQuickAdjust.tsx` itself,
      types/persistence for `tires`/`pressures`/`adjustments`/`changeLog`.

Acceptance criteria:
- Active editor renders exactly: header, Identity, Track Condition, Laps & Result, Handling
  Diagnostics, Competition Notes, Attachments, bottom action bar. No tire selects, no psi
  steppers, no Import-from-Setup, no adjustments log, no four-bar button/sheet.
- Historical sessions with recorded adjustments/snapshots still render their setup-change
  details in "All Race Days" unchanged.
- SetupView's four-bar section and corner forms behave exactly as before.
- `grep QuickAdjustPanel` → nothing; `grep "applyQuickAdjust\|resolveQuickAdjustTarget"` → nothing.
- tsc: same 3 baseline errors (RaceWeekendView error is at ~467, ABOVE the removal span —
  it must remain the identical error, possibly same line); build passes.

Est: ~360 lines removed across 4 files. Risk: medium (cuts a live write-path; historical
rendering must be regression-checked).

## Chunk C — Bottom action bar: "Next Session"

**Goal:** the floating mid-screen SAVE RUN bar becomes a normal inline button at the very
end of the session form, labeled "Next Session", which advances to logging the next run (D2).

Scope:
- [ ] `RaceWeekendView.tsx` 1516-1528: drop the `.sticky-action-bar` wrapper (or replace
      with a plain non-sticky block) so the button sits inline after Attachments — it is
      already last in DOM order; only the sticky positioning goes.
- [ ] Label: `NEXT SESSION` (match existing button text casing convention), icon swap
      (`save` → something forward-looking, e.g. `arrow_forward`/`add` per existing icon set).
- [ ] Handler: persist + `setIsRunDirty(false)` + `setEditorCollapsed(true)` + `openNewSession()`.
- [ ] Keep `isRunDirty` gating? **No** — show the button whenever the editor is open
      (a "next" affordance shouldn't hide when nothing changed). Remove the gate.
- [ ] `src/index.css`: leave `.sticky-action-bar` class in place if any other view adopts it;
      if RaceWeekendView was its only consumer, delete it (verify by grep).

Acceptance criteria:
- No floating bar while scrolling the form; button appears only at the physical end of the
  session form, above the "All Race Days" list, clear of the bottom nav (safe-area respected).
- Tapping it collapses the finished session editor and immediately opens the new-session
  form. Existing "Log Run" CTA unchanged.
- tsc baseline unchanged; build passes.

Est: ~25-40 lines. Risk: low.

## Chunk D — Setups tab: static-setup cleanup

**Goal:** with trackside quick-adjust gone, remove the run-coupling chrome from SetupView.
Conservative scope — the lifecycle system stays (D3).

Scope:
- [ ] Remove `PendingSetupDiffSummary` + `resolvePendingSetupDiff` (`SetupView.tsx:80-154`,
      render at 954-957) — the "Pending — will bind to next session" drift widget loses its
      purpose without trackside adjustments.
- [ ] KEEP `LegacySetupLog` (156-172, render at 959) — it displays existing historical
      changeLog entries; the data source stops growing but old data must stay visible.
- [ ] KEEP: static editor (metadata, notes, car setup details, 4 corner forms, four-bar,
      attachments), Compare/diff (`SetupDiffView`), clone/share, lifecycle badges.
- [ ] Sweep for now-dead props/imports in SetupView after the trim.
- [ ] Note in plan after QA: line number of the `SetupView.tsx:890` baseline error will
      shift up by the removed line count — record the new line here: ______

Acceptance criteria:
- Setups page shows no "Pending" diff widget for the active weekend's setup; legacy change
  logs on old setups still render; everything else pixel-equivalent.
- tsc: same 3 errors (SetupView one at a shifted line); build passes.

Est: ~80-90 lines. Risk: low.

---

## Final gate (Fable 5 High, end of sprint)

- [ ] Full `npm run lint` + `npm run build` clean vs baseline.
- [ ] Manual pass on device build (debug APK): every acceptance criterion above re-checked.
- [ ] Historical-data regression: open an old weekend with adjustments + snapshots + legacy
      changeLog and verify all history renders.
- [ ] Plan updated with actuals, then archived to `context/archive/` per repo convention.
- [ ] Debug APK rebuilt for owner testing.
