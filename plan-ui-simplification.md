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
- [x] Remove `savedFlash`/`savedFlashTimer` state (~1129-1130), `clearSavedFlash`,
      `flashSaved` (1133-1163), and the `savedFlash` branch of the notification arbiter
      JSX (2690-2740). Keep `infoToast` branch fully intact.
- [x] Remove the dirty-flag plumbing: `SavedFeedbackController`/`createSavedFeedbackController`
      (73-91), `installSavedFeedbackBoundaries` (93-129), `flushSavedFeedbackOnTabChange`
      (131-135), refs (295-297), wiring effects (1164-1183), `SAVED_FEEDBACK_INTERVAL_MS`.
- [x] Remove `markSavedDirty`/`flushSavedBoundary` (298-299) **and all ~24 call sites**
      (grep `markSavedDirty` to zero). Prefer deleting call lines over a no-op stub —
      leave no dead machinery.
- [x] Per D1 default: stop rendering `Syncing…`/`Synced`/`Offline — saved on device` status
      notices; keep `Sync failed — will retry` and deferred-delete warnings rendering
      exactly as today. `SyncStatus` type in `src/lib/sync.ts` is NOT changed (frontend-only);
      the arbiter just ignores the non-error statuses.
- [x] Remove the `"Saved as you change it"` caption + pulsing dot in `SetupView.tsx:591`
      (it's a save-confirmation in spirit; Setups header gets cleaner too).

Acceptance criteria:
- Editing any field in any tab produces zero "Saved"/"Synced"/"Syncing" pills across tab
  switches, app background, and 30s+ idle.
- Forcing a sync failure (airplane mode + edit + reconnect-fail) still shows the sync-error
  warning. Feature info toasts (e.g. car-switch notice, share confirmations) still appear.
- `grep -i "markSavedDirty\|savedFlash\|flashSaved"` returns nothing.
- tsc: same 3 baseline errors; build passes.

Est: ~150-200 lines removed, single file + one caption. Risk: medium (3-way arbiter surgery).

### Chunk A — QA notes (Opus 5 High, uncommitted tree)

- **Actuals:** `App.tsx` −177/+18 (net −159), `SetupView.tsx` −4/+0. Net −163, at the low end
  of the estimate. 22 `markSavedDirty()` call sites removed (est. said ~24) + 1
  `flushSavedBoundary()` call in `handleCreateNewSession`. Every deleted hunk is the call line
  only — no adjacent statement collateral.
- **Arbiter:** collapses to `isInfo || isFailure`; info still wins over sync-error. `role="status"`,
  `aria-live="polite"`, `data-notification-slot="arbiter"`, `top: notificationTop`, and the
  `onClick={isInfo ? clearInfo : acknowledgeSyncStatus}` dismiss all survived. Dismiss button is
  now unconditional, which is equivalent — the arbiter only renders for those two branches.
- **Deviation — `notifySaved` params.** The param existed only to suppress a Saved flash, so it
  went with it: `handleSaveShockSessions` and `handleSaveTodos` lost their `notifySaved = true`
  second arg, and `handleSaveCars` lost the `notifySaved` derivation. Call sites updated; prop
  types already declared one param. `handleSaveCars`' boolean-overload normalization
  (`if (typeof (expectedAccountId as unknown) === 'boolean') expectedAccountId = undefined;`)
  stays, and the `@ts-expect-error` caller at `App.tsx:1625` still resolves.
- **Baseline:** exactly 3, identities unchanged. `SetupView.tsx` shifted **890 → 886**
  (`RaceWeekendView:467` and `SmasherLoadsView:617` unmoved). `npm run build` passes.
- **Stale harnesses (decision deferred to final gate).** Three regression harnesses assert on the
  removed machinery: `scripts/saved-flash-harness.ts` (whole file), `scripts/offline-indicator-harness.ts:58-73`,
  `scripts/chunk5-setup-harness.ts:308-389,1540`. None are referenced by `package.json` or CI, and
  all type-check clean, so lint/build are unaffected. `scripts/car-delete-undo-harness.ts:52` is
  an absence assertion and still passes. Repo-wide `grep markSavedDirty|savedFlash|flashSaved`
  is therefore non-empty (harnesses + docs); `src/` is clean, which is what the criterion meant.
- **Residual (benign):** `SUCCESS_TOAST_MS` and the `synced`/`offline-saved` auto-dismiss effect
  (`App.tsx:1089-1098`) survive but are now unreachable — nothing sets those statuses and the
  arbiter ignores them. Left in place since `SyncStatus` is frontend-only-unchanged per D1.

## Chunk B — Runs tab: remove Tires & Pressures + Changes Made

**Goal:** Active Session Editor keeps Identity, Track Condition, Laps & Result, Handling
Diagnostics, Competition Notes, Attachments. Sections "Tires & Pressures" and "Changes Made"
(including the Four-bar Quick Adjust trigger) are gone.

Scope:
- [x] `RaceWeekendView.tsx`: delete JSX sections 5-6 (1388-1477), `fourBarOpen` state (293)
      + its visibility effect (309-313), the four-bar `BottomSheet` (1724-1726),
      `handleQuickAdjustCommit`/`handleQuickFourBarChange` (449-460),
      `handleImportTiresFromSetup` (~410-447), now-unused imports
      (`QuickAdjustPanel`, `FourBarQuickAdjust`).
- [x] Delete `src/components/QuickAdjustPanel.tsx` (only consumer is RaceWeekendView — verified).
- [x] `App.tsx`: delete `handleCommitQuickAdjust` (1966-2010), the `onCommitQuickAdjust`
      prop (2832) and prop-type plumbing, `applyQuickAdjust`/`resolveQuickAdjustTarget` imports.
- [ ] **DEFERRED to final gate** — `lib/quickAdjust.ts`: trim to `applyExplicitCornerField`
      (+ its minimal deps) only. Blocked: `scripts/` is inside the tsc program and two harnesses
      import the doomed exports (see QA notes). Also note the spec target is wrong —
      `isQuickAdjustRunAvailable` must survive the trim (RaceWeekendView still gates the editor
      on it), so the keep-set is `applyExplicitCornerField` + `isQuickAdjustRunAvailable`.
- [x] Do NOT touch: session-creation pressure propagation (`setupSteps.ts` helpers in
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

### Chunk B — QA notes (Opus 5 High, uncommitted tree)

- **Actuals:** `RaceWeekendView.tsx` −218/+4, `App.tsx` −68/+2, `QuickAdjustPanel.tsx` −170
  (deleted). Net −450 across 3 files, ~90 over the estimate. `lib/quickAdjust.ts` untouched
  (deferred), which is why the 4th file never moved.
- **Render order verified** in the active editor: header (1126) → Identity (1145) → Track
  Condition (1161) → Laps & Result (1189) → Handling Diagnostics (1225) → Competition Notes
  (1269) → Attachments (1280) → SAVE RUN bar (1306). Sections renumbered 7→5. Competition
  Notes + Attachments bodies are byte-identical to HEAD — only the section comment number moved.
- **Historical rendering intact:** `resolveBoundSetupDiff` (126), `BoundSetupDiffSummary` (176),
  `SessionSetupDetails` (210) and its `record.adjustments` list (217-221) are outside every hunk;
  the "All Race Days" call site at 1438-1439 is unchanged. `types.ts` untouched.
- **No over-deletion.** 9 hunks, all boundaries clean. `handleCreateNewSession` and the
  `setupSteps` pressure helpers in `App.tsx` (1769-1783, 1954-1986, 2292-2327) are untouched —
  the only diff mention of `handleCreateNewSession` is a context line in the props hunk.
  `FourBarQuickAdjust.tsx`, `NumberStepper.tsx` and `setupSteps.ts` have zero diff.
  `NumberStepper` retains 3 consumers (`FourBarQuickAdjust`, `SetupView`, `TiresSubView`).
  Surviving imports still earn their place: `TireDetails` (38), `scopedTireInventory` (481),
  `displayLifecycleText` (213/1148).
- **Props/types:** `RaceWeekendViewProps` (42-67) and the `App.tsx:2595` call site match exactly —
  no leftover required props, no unused passed props.
- **Baseline:** exactly 3, identities unchanged. `RaceWeekendView.tsx` shifted **467 → 348**
  (119 lines removed above the error; `SetupView:886` and `SmasherLoadsView:617` unmoved).
  `npm run build` passes.
- **Deviation (a) — `quickAdjust.ts` left untrimmed. CONFIRMED VALID.** `tsconfig.json` has no
  `include` and excludes only `supabase/functions`/`dist`/`node_modules`, so `scripts/` is in the
  tsc program. `scripts/chunk7-quick-adjust-harness.ts:4-15` imports 10 symbols and
  `scripts/chunk5-setup-harness.ts:11` imports `applyQuickAdjust`; trimming to the correct keep-set
  leaves 9 dead named imports → 9 new TS2305 errors. `isQuickAdjustRunAvailable` is genuinely
  live: `RaceWeekendView.tsx:298` computes `hasActiveSession` from it and 1124 gates the whole
  editor on that.
- **Deviation (b) — extra props removed. VALID, no behavior loss.** `raceDayFourBarVisible` had
  exactly one reader in `src/` (the App Guide header button, now `App.tsx:2450`), so
  `fourBarVisible: false` is faithful — the sheet it tracked no longer exists. SetupView's four-bar
  help does **not** route through `resolveContextualAppGuideSection`: `App.tsx:2589` passes
  `onHelp={openHelp}` → `SetupView.tsx:905` → `FourBarQuickAdjust.tsx:125` calls
  `onHelp('four-bar')` directly. Unchanged. `shockSessions` still has 14 other `App.tsx` uses and
  is still passed to its other consumer at 2582.
- **Deviation (c) — INFO_COPY entries + `componentInfoNotice` "Four-bar" branch. VALID.** No
  `onInfo`/`showInfo` caller in `src/` references the three removed reasons; the 5 surviving
  `onInfo?.()` calls in RaceWeekendView (318-322, 478) map to PDF/weekend-missing reasons that
  still exist. Only hits are in `scripts/saved-flash-harness.ts:1858-1859` (already-stale fixture
  strings from Chunk A).
- **Acceptance-criteria grep caveat (same shape as Chunk A).** `grep QuickAdjustPanel` and
  `grep "applyQuickAdjust\|resolveQuickAdjustTarget"` are clean in `src/` but non-empty repo-wide
  (harnesses + `HANDOFF.md` + `context/knowledge/CODEBASE_KNOWLEDGE.md` + this plan). `src/` clean
  is what the criterion meant.
- **Runtime-only harness collateral (type-checks fine, lint/build unaffected, not in CI).**
  `scripts/setup-touch-target-harness.ts:34` does `read('src/components/QuickAdjustPanel.tsx')` →
  now throws ENOENT. `scripts/chunk9-export-help-harness.ts:332,337-338,391-409` asserts on
  `raceDayFourBarVisible` / `onFourBarVisibilityChange` source text in `App.tsx` and
  `RaceWeekendView.tsx` → those regexes now fail.
- **Residual (benign):** `resolveContextualAppGuideSection`'s `if (fourBarVisible)` branch is
  unreachable from its only production caller; `mergeImportedSetupPressure` in `setupSteps.ts`
  now has no `src/` consumer; `session.pressureSourceNote` is still written on session creation
  but no longer displayed in the Runs tab (its only render site was the removed Tires caption).
  All left in place — `setupSteps.ts` and `helpRouting.ts` are out of Chunk B scope.
- **Final-gate TODO (order matters):** 1) delete `scripts/chunk7-quick-adjust-harness.ts`;
  2) rework `scripts/chunk5-setup-harness.ts` C3 fixture off `applyQuickAdjust`;
  3) then trim `lib/quickAdjust.ts` to `applyExplicitCornerField` + `isQuickAdjustRunAvailable`;
  4) drop the `QuickAdjustPanel` read + the four-bar-visibility assertions from
  `setup-touch-target-harness.ts` / `chunk9-export-help-harness.ts`.

## Chunk C — Bottom action bar: "Next Session"

**Goal:** the floating mid-screen SAVE RUN bar becomes a normal inline button at the very
end of the session form, labeled "Next Session", which advances to logging the next run (D2).

Scope:
- [x] `RaceWeekendView.tsx` 1516-1528: drop the `.sticky-action-bar` wrapper (or replace
      with a plain non-sticky block) so the button sits inline after Attachments — it is
      already last in DOM order; only the sticky positioning goes.
- [x] Label: `NEXT SESSION` (match existing button text casing convention), icon swap
      (`save` → something forward-looking, e.g. `arrow_forward`/`add` per existing icon set).
- [x] Handler: persist + `setIsRunDirty(false)` + `setEditorCollapsed(true)` + `openNewSession()`.
      (`setIsRunDirty(false)` moot — the flag itself is gone.)
- [x] Keep `isRunDirty` gating? **No** — show the button whenever the editor is open
      (a "next" affordance shouldn't hide when nothing changed). Remove the gate.
- [x] `src/index.css`: leave `.sticky-action-bar` class in place if any other view adopts it;
      if RaceWeekendView was its only consumer, delete it (verify by grep).

Acceptance criteria:
- No floating bar while scrolling the form; button appears only at the physical end of the
  session form, above the "All Race Days" list, clear of the bottom nav (safe-area respected).
- Tapping it collapses the finished session editor and immediately opens the new-session
  form. Existing "Log Run" CTA unchanged.
- tsc baseline unchanged; build passes.

Est: ~25-40 lines. Risk: low.

### Chunk C — QA notes (Opus 5 High, uncommitted tree)

- **Actuals:** `RaceWeekendView.tsx` −21/+9, `index.css` −12/+0. Net **−24**, inside the estimate.
- **Placement verified.** Button is the last child of the `p-3 pt-0` editor body, immediately after
  Attachments (1272-1292), inside the `{editorCollapsed ? null : (…)}` branch — so it hides with the
  editor. Non-sticky plain block, `mt-6 pt-4 border-t border-outline-variant/60`: siblings get their
  gap from a trailing `mb-6`, but Attachments has none, so `mt-6` reproduces the same 24px + rule
  + 16px rhythm. Container structure is sound after the fragment removal — the conditional now wraps
  a single `<div>` root (open 1135, close 1305, `)}` 1306, `</section>` 1307, `hasActiveSession` close
  1308). Button sits above "All Race Days" (1310) and inside `.app-main-scroll`, whose
  `padding-bottom: calc(4rem + safe-area)` keeps it clear of the bottom nav.
- **Handler:** `handleNextSession` (601-605) = `persistSession({ ...session })` +
  `setEditorCollapsed(true)` + `openNewSession()`. `session` is a prop and the handler is rebuilt each
  render, so the spread reads committed state at click time — no stale closure. Every editor input is
  controlled off `session` with no local buffer, so there is nothing unflushed to lose. Single persist
  call; the pre-existing per-keystroke `updateRun` path is unchanged, so the extra write is an
  idempotent same-value re-persist (identical to the old `handleSaveRun`, not a new double-persist).
- **`openNewSession` (467-492) is pure state-setting** — 11 `setNs*` setters + `setNsOpen(true)`, no
  `setEditorCollapsed`, no re-expand. Its three early-return guards are all unreachable from this
  button: it only renders under `hasActiveSession` (292), which requires `activeCarId` truthy and
  `isQuickAdjustRunAvailable` true — the latter already asserts `weekend` non-null, `weekend.id ===
  activeWeekendId` and `setup` non-null, which is exactly `!activeCarId` / `!currentWeekend` /
  `activeWeekendMissingSetup` (`!!currentWeekend && !activeSetup`) all false. So no path where the
  editor collapses and the new-session sheet fails to open.
- **`isRunDirty` + `activeRunIdentity` fully removed** — `grep` over `src/` returns zero for both.
  The identity-reset `useEffect` went with them. `updateRun` (324-326) is now a bare pass-through to
  `persistSession`; all 9 call sites still route through it, so persistence is unchanged.
- **`.sticky-action-bar` deleted** from `index.css` (was 292-303). `grep` over `src/` + `index.html`
  returns zero — RaceWeekendView was the only consumer. Remaining repo hits are docs
  (`HANDOFF.md:46`, `context/knowledge/UX_TECHNICAL_REVIEW_2026-07-17.md:73`,
  `context/archive/IMPLEMENTATION_PLAN_2026-07-12.md`) and the stale harness below.
- **Baseline:** exactly 3, identities unchanged. `RaceWeekendView.tsx` shifted **348 → 341**
  (7 lines net removed above the error; `SetupView:886` and `SmasherLoadsView:617` unmoved).
  `npm run build` passes.
- **New stale-harness breakage (runtime string matches only; type-checks clean, not in CI).**
  `scripts/chunk5-setup-harness.ts:133-136` assert the four `.sticky-action-bar` CSS declarations and
  `:142` asserts `/\{isRunDirty && \(\s*<div className="sticky-action-bar rounded-b-lg">/` in
  `RaceWeekendView.tsx` — all five now fail. Added to the final-gate harness TODO.
- **Collapsed-editor residual — FIXED at chunk gate (Fable 5).** `editorCollapsed` was never reset,
  so after "Next Session" → submit the new run's editor opened collapsed. Since Chunk C makes this
  the primary run-to-run flow, `setEditorCollapsed(false)` was added to `handleNewSessionSubmit`
  (~509) so a newly created session always opens expanded. Re-verified lint (same 3) + build after
  the fix.
- **Final-gate TODO addendum:** 5) drop the `.sticky-action-bar` CSS assertions and the `isRunDirty`
  sticky-bar regex from `scripts/chunk5-setup-harness.ts:133-136,142` (folds into the existing item 2
  rework of that file).

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
