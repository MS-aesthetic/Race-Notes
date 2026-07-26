# Plan — UI Simplification Sprint (feature/ui-simplification)

**Branch:** `feature/ui-simplification` (off `master` @ `13343e5`, v5.2.1 / versionCode 24)
**Status:** Chunks A–I implemented and committed; owner QA (browser/APK) open. Setups are
de-lifecycled as of Chunk I (D3 resolved: plain saved setups + clone; no roles/locks).
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
- [x] Remove `PendingSetupDiffSummary` + `resolvePendingSetupDiff` (`SetupView.tsx:80-154`,
      render at 954-957) — the "Pending — will bind to next session" drift widget loses its
      purpose without trackside adjustments.
- [x] KEEP `LegacySetupLog` (156-172, render at 959) — it displays existing historical
      changeLog entries; the data source stops growing but old data must stay visible.
- [x] KEEP: static editor (metadata, notes, car setup details, 4 corner forms, four-bar,
      attachments), Compare/diff (`SetupDiffView`), clone/share, lifecycle badges.
- [x] Sweep for now-dead props/imports in SetupView after the trim.
- [x] Note in plan after QA: line number of the `SetupView.tsx:890` baseline error will
      shift up by the removed line count — record the new line here: **806**

Acceptance criteria:
- Setups page shows no "Pending" diff widget for the active weekend's setup; legacy change
  logs on old setups still render; everything else pixel-equivalent.
- tsc: same 3 errors (SetupView one at a shifted line); build passes.

Est: ~80-90 lines. Risk: low.

### Chunk D — QA notes (Opus 5 High, uncommitted tree)

- **Actuals:** `SetupView.tsx` −88/+3 (net **−85**), single file — `git diff HEAD --numstat` shows
  no other path. Inside the estimate. `App.tsx`, `setupLifecycle.ts`, `types.ts`,
  `SetupDiffView.tsx`, `RaceWeekendView.tsx` all zero diff.
- **Removal is complete and clean.** `PendingSetupDiff` type + `resolvePendingSetupDiff` +
  `PendingSetupDiffSummary` (was 80-154) gone as one contiguous block; `grep` over `src/` returns
  zero for all three, and no other `src/` file ever imported them. The render-site IIFE
  (`{setupItem.id === activeEventSetupId && (() => {…})()}`) was removed whole — the hunk's own
  context lines show `</fieldset>` above and `<LegacySetupLog …>` below, and JSX nesting still
  closes correctly (`</fieldset>` 868 → `<LegacySetupLog>` 870 → `</div>` 871 → `)}` 872 → card
  `</div>` 873 → `);` 874 → map close 875).
- **`LegacySetupLog` byte-identical**, component (now 80-99) and render (now 870). Both appear only
  as diff context lines — zero `+`/`−` inside either.
- **Import trim correct.** `SetupSnapshotDiff` dropped from the `types` import, and
  `captureSetupSnapshot` / `diffSetupSnapshots` / `isWeekendFinished` from the `setupLifecycle`
  import; grep confirms zero remaining uses of any of the four in the file. Kept symbols still
  earn their place: `RaceWeekend` types the `weekends?` prop (36); `weekends` +
  `activeEventSetupId` feed the four `getSetupEditability` call sites (391, 399, 413, 576) and
  `weekends` is also passed to `TiresSubView` (898). Note tsconfig has no `noUnusedLocals`, so tsc
  would not have caught a missed import — the sweep is grep-verified, not compiler-verified.
- **Header wrapper simplification (extra, not in scope list, benign).** The `flex items-start
  justify-between gap-3` row + inner bare `<div>` around the `<h2>` were dropped; the `h2` is now a
  direct child of the `flex flex-col gap-2` header (509-510). Both wrappers were single-child
  leftovers from the Chunk A caption removal. Visually equivalent — the `h2` classes are unchanged,
  it stretches full width as a flex item exactly as the removed row did, and `gap-2` to the sub-tab
  grid is untouched.
- **Baseline:** exactly 3, identities unchanged. `SetupView.tsx` shifted **886 → 806** (80 lines
  net removed above the error; `RaceWeekendView:341` and `SmasherLoadsView:617` unmoved).
  `npm run build` passes.
- **Additional stale-harness breakage (runtime string matches only; type-checks clean, not in CI).**
  `scripts/chunk5-setup-harness.ts` asserts on the deleted symbols as source text at
  790-791, 872-879, 1018-1022, 1117-1119. The harness imports nothing from `SetupView.tsx` (only
  `src/types` + `src/lib/*`, all untouched), so tsc stays clean — it fails only when executed.
  `:1124` still works (`LegacySetupLog` → `// ─── Corner Form Sub-component` extraction markers both
  survive). Folds into final-gate TODO item 2 (rework of that file).

---

## Final gate (Fable 5 High, end of sprint)

- [x] Full `npm run lint` + `npm run build` clean vs baseline. Final baseline lines:
      `RaceWeekendView.tsx:341`, `SetupView.tsx:806`, `SmasherLoadsView.tsx:617` — same 3
      identities as the pre-sprint baseline (467/890/617); shifts are pure line drift from
      removals above each error.
- [ ] **OWNER**: Manual pass on device build (debug APK): acceptance criteria re-checked with
      real data — no confirmation pills anywhere; sync-error warning still appears on failure;
      Runs editor shows only Identity/Track Condition/Laps & Result/Diagnostics/Notes/
      Attachments; NEXT SESSION inline at form end, advances and opens the new editor expanded.
      *(Superseded in part by the 2026-07-26 amendments below — sync-error pill is now removed
      too, and the historical-data gate is dropped.)*
- [x] ~~OWNER: Historical-data regression~~ — DROPPED per owner 2026-07-26: data will be wiped;
      historical trackside-history rendering is removed instead (Chunk F).
- [x] Debug APK rebuilt for owner testing (`release/CrewChief-5.2.1-ui-simplification-debug.apk`).
- [ ] Plan archived to `context/archive/` — HELD until the owner picks a direction; the plan
      stays at repo root while this branch is under active evaluation.

---

## Owner amendments — 2026-07-26 (post-APK review)

1. **All sync pills go.** "User will understand that sync won't work in airplane mode." The
   remaining `sync-error` / `deferred-delete-retrying` warning pill is removed too → Chunk E.
   Boundary kept (flagged to owner): dismissible feature notices (`infoToast` — share/upload/
   operation failures, car-switch guidance) stay; they are not save/sync pills and removing
   them would silence non-sync errors.
2. **Historical trackside history not needed.** Owner will wipe data; the render surfaces for
   per-run adjustments/diff history are removed → Chunk F. Data-model fields still untouched
   (frontend-only rule).

## Chunk E — Remove sync warning pills

**Goal:** the notification surface renders `infoToast` notices ONLY. No sync pills of any kind.

Scope (src/App.tsx):
- [x] Arbiter: drop the `isFailure` branch — render only when `infoToast` is set; msg/icon/
      dismiss simplify accordingly (`clearInfo` only).
- [x] Remove now-dead sync-status display plumbing as far as it cleanly goes WITHOUT touching
      `src/lib/sync.ts`: `acknowledgeSyncStatus`, auto-clear effects (`SUCCESS_TOAST_MS`,
      `clearTransientSyncStatus`) — investigate actual usage first; keep `setSyncStatus`
      callback wiring into sync.ts intact (a no-op-ish state write is fine) or remove the
      state entirely if nothing else reads it. Grep `syncStatus` for other readers (e.g.
      header offline chip uses `isOnline`, not `syncStatus` — verify).
- [x] KEEP: the header offline connectivity chip (`isOnline`) — it is how the user "understands
      sync won't work in airplane mode".

Acceptance: airplane-mode edits produce no pill of any kind; feature notices still render;
tsc same 3 identities; build passes.

### Chunk E — QA notes (Opus 5 High, uncommitted tree)

- **Actuals:** `App.tsx` +7/−51 (net **−44**), single file — `git diff HEAD --numstat` shows no
  other `src/` path. `src/lib/sync.ts` byte-untouched, as required.
- **Arbiter is infoToast-only** (2446-2476). Guard collapsed to `if (!infoToast) return null;`,
  `msg = resolveInfoCopy(infoToast)`, icon hardcoded `info`, dismiss hardcoded `clearInfo`. The
  a11y/layout contract survived intact: `data-notification-slot="arbiter"`, `role="status"`,
  `aria-live="polite"`, `aria-label="Dismiss notification"`, `top: notificationTop`, `tap-target`
  on the close button. Zero `syncStatus` / `isFailure` / `cloud_off` / `Sync failed — will retry`
  left in the block.
- **Reader map — nothing dangles.** Repo grep over `src/` for `syncStatus|syncStatusRef|`
  `acknowledgeSyncStatus|clearTransientSyncStatus|SUCCESS_TOAST_MS|isTerminalSyncStatus|`
  `pullReportedFailure` returns exactly 4 hits, all the intended survivors: the
  `NotificationStatus` type (68), the ref (820), and the two-line `setSyncStatus` (821-823). The
  `syncStatus` *state* (`useState` + `setSyncStatusState`), `acknowledgeSyncStatus`,
  `clearTransientSyncStatus`, `isTerminalSyncStatus`, `SUCCESS_TOAST_MS`, the success auto-clear
  effect, and `pullReportedFailure` are all gone with no orphan callers.
- **The `setSyncStatus` minimal-ref-write choice is right.** The plan offered "no-op-ish state
  write OR remove the state entirely"; the build agent took a third, better option — keep the
  callback and the ref, drop the `useState`. It preserves ~45 `pushX(…, setSyncStatus)` call
  sites and both `deferred-delete-retrying` reporters (936, 973) without a single signature
  change, keeps `sync.ts` untouched per D1, and removes a re-render per push. Contravariance
  still holds for the forwarded prop: `(next: NotificationStatus) => void` is assignable to
  `onSyncStatus?: (status: SyncStatus) => void` because `NotificationStatus = SyncStatus |
  'syncing'` is the wider parameter — `ExportView`/`SettingsView` forwarding type-checks
  unchanged (tsc clean, `App.tsx:2614` → `SettingsView.tsx:399` → `ExportView.tsx:81-83`).
- **Cross-arbitration removal (a) — `setSyncStatus` no longer kills a live `car-delete-queued`
  toast: CORRECT.** That branch existed only so a sync-failure *pill* could take the slot from an
  info notice. With no pill, the eviction has no beneficiary — keeping it would have been a
  notice that deletes itself for no visible reason. The notice now runs its normal 3s lifetime
  (`App.tsx:347-354`) or dies on `clearInfo`.
- **Cross-arbitration removal (b) — the `isTerminalSyncStatus(syncStatusRef.current)` gate around
  the car-delete notice (now `App.tsx:650`) is gone: CORRECT, and this one was load-bearing.**
  Left in place it would have read a ref that nothing else reads or resets, so a single earlier
  `sync-error` would have latched it `true` for the rest of the session and silently swallowed
  every subsequent "queued for delete" notice — precisely the outcome the "feature notices stay"
  boundary forbids. Verified nothing else can swallow it: the only remaining suppressor is the
  5s `INFO_DEDUPE_MS` dedupe (1014-1022), which keys on the *resolved copy string* (car label
  included), so it can only collapse a literal double-delete of the same car inside 5s.
- **`infoToastRef` is now write-only (1008, 1011, 1020, 350) — benign.** Its one reader was the
  removed eviction branch. It is still assigned in lockstep with `setInfoToast`, so it is
  correct-but-dead rather than stale; no `noUnusedLocals` in tsconfig, so it costs nothing.
  Candidate for the deferred cleanup sprint, not a Chunk E defect.
- **Airplane mode:** `setSyncStatus('sync-error')` / `('deferred-delete-retrying')` /
  `('syncing')` are now a single ref assignment with no reader — no state update, no render, no
  throw, no unmount-timer risk (the only timer that touched sync status was the deleted
  `SUCCESS_TOAST_MS` effect). Offline UX is carried entirely by the header `isOnline` chip
  (`App.tsx:2393`, `cloud_off`), which is untouched.
- **Baseline unshifted:** exactly 3 errors, same identities *and same line numbers* —
  `RaceWeekendView.tsx:341`, `SetupView.tsx:806`, `SmasherLoadsView.tsx:617`. All removals sit
  in `App.tsx`, so nothing drifted. `npm run build` passes (4.82s, PWA 22 precache entries).
- **Additional stale-harness breakage (runtime only; type-checks clean, not in `package.json`).**
  `scripts/car-delete-undo-harness.ts:740` carries a D3 mutation named
  `terminal-priority-guard-removed` whose "before" text is the exact guard this chunk deleted;
  the uniqueness assert at `:751` now finds 0 occurrences and the harness fails there. Its
  sandbox `isTerminalSyncStatus` stub (`:402, :494`) is now unreferenced by the extracted body.
  Note the irony worth recording: that mutant is now the production source. Folds into the
  final-gate deferred cleanup as a new item alongside 1-5. `scripts/offline-indicator-harness.ts` and
  `scripts/saved-flash-harness.ts` were already stale from Chunk A — Chunk E deepens, but does
  not widen, that debt.

## Chunk F — Remove historical trackside-history rendering

**Goal:** no per-run setup-history/diff chrome anywhere.

Scope:
- [x] `RaceWeekendView.tsx`: remove `resolveBoundSetupDiff`, `BoundSetupDiffSummary`, and the
      adjustments/diff rendering inside `SessionSetupDetails` (~126-242). If
      `SessionSetupDetails` has non-history content (e.g. plain "setup used" label), keep that
      part — build agent reports structure and judges; goal is zero history/diff UI in
      "All Race Days" cards.
- [x] `SetupView.tsx`: remove `LegacySetupLog` (component + render).
- [x] Sweep now-dead imports/types usages in both files (grep-verify each).
- [x] Do NOT touch: types.ts, snapshot capture at session creation (App.tsx), setupLifecycle.ts,
      SetupDiffView (manual Compare stays — it is user-invoked, not run-history).

Acceptance: "All Race Days" session cards show no adjustments/diff blocks; Setups cards show
no legacy change log; tsc same 3 identities (lines shift up); build passes.

### Chunk F — QA notes (Opus 5, uncommitted tree)

- **Actuals:** `RaceWeekendView.tsx` +4/−93 (net **−89**), `SetupView.tsx` +0/−23 (net **−23**) —
  net **−112**. `git diff HEAD --numstat` and `git status --porcelain` both show exactly these two
  paths; `types.ts`, `App.tsx`, `setupLifecycle.ts` and `SetupDiffView` are byte-untouched, so the
  "do not touch" fence held.
- **`SessionSetupDetails` kept-and-narrowed is the right call.** The component was not pure
  history: `Config` (`displayLifecycleText(record.setupUsed)`), `Conditions` and `Notes` are the
  only per-run summary a collapsed session card carries, and nothing else renders them. What was
  removed is exactly the two history surfaces — the `<BoundSetupDiffSummary>` element and the
  `record.adjustments` bullet list. Signature narrowed `{ record, boundDiff }` → `{ record }`
  (`RaceWeekendView.tsx:133`), and the sole call site collapsed cleanly: the 4-line IIFE that
  computed `boundDiff` is gone, replaced by a bare `<SessionSetupDetails record={sx} />`
  (`:1340`) inside the same `{expanded && (…)}` block — no orphan braces, no stray fragment.
- **`LogSetupChangesButton` survived byte-identical** (`RaceWeekendView.tsx:121-131`) despite
  sitting immediately below the removed 77-line span — the diff shows it wholly as context, zero
  `+`/`-` lines. Still rendered at `:1232`. Correct: it is a user-invoked action, not run history,
  and it is the same boundary that spared `SetupDiffView`.
- **`LegacySetupLog` fully gone** from `SetupView.tsx` — component (was 80-100) and render. The
  render removal took the element *and* its preceding blank line out of the attachments card;
  `</fieldset>` → `</div>` now close consecutively (`:846-847`) with the enclosing
  `{expanded && (…)}` / `.map()` chain intact. `changeLog` survivors are exactly two, both the
  `changeLog: []` initializers on new-setup creation, now at `:350` and `:424` (were 371/445
  pre-diff — pure drift from the 23 removed lines above them). No `Setup['changeLog']` consumer
  remains in the view layer.
- **Import sweep — grep-verified, zero residue.** `SetupSnapshotDiff` dropped from the `../types`
  import (`:2`); `captureSetupSnapshot` and `diffSetupSnapshots` dropped from the
  `../lib/setupLifecycle` import (`:15`, which correctly keeps `displayLifecycleText` /
  `displayVersionLabel` / `isWeekendFinished` / `lifecycleLabel`). A grep of both files for
  `resolveBoundSetupDiff|BoundSetupDiffSummary|BoundSetupDiff|LegacySetupLog|SetupSnapshotDiff|`
  `captureSetupSnapshot|diffSetupSnapshots|boundDiff` returns **0 hits**, and `adjustments` is now
  0 hits in `RaceWeekendView.tsx`. `savedSetups` is still live — prop type `:46`, destructure
  `:146`, `scopedSetups` filter `:211`, `setupUsedUniquelyMatchesCar` `:394` — so the prop stays,
  it just no longer feeds diff resolution.
- **Baseline shifted, identities unchanged:** exactly 3 errors —
  `RaceWeekendView.tsx:255` TS2345 (was 341, −86), `SetupView.tsx:785` TS2322 (was 806, −21),
  `SmasherLoadsView.tsx:617` TS2345 (unchanged, untouched file). Both shifts are pure line drift
  from removals above the error, consistent with the removed spans. `npm run build` passes
  (4.88s, PWA 22 precache entries).
- **`lib/exportPdf.ts` — the "Setup Changes" section is NOT in the weekend PDF, and it is
  UNCONDITIONAL where it does render.** Two corrections to the build agent's flag:
  (a) `buildWeekendReport` (`:184`) calls `weekendSection`, which contains zero `adjustments`
  references — Race Day PDFs, including the per-weekend share at `RaceWeekendView.tsx:225`, are
  unaffected. The heading lives in `setupSection` (`:66-98`), reached only by `buildSetupReport`
  and `buildMasterReport`.
  (b) Inside `setupSection`, the whole `activeRunHtml` block is gated on `activeSession` being
  passed, but *within* that block `<h2>Setup Changes (${adjustments.length})</h2>` (`:79`) renders
  unconditionally, with an explicit `'<p class="empty">No changes recorded.</p>'` empty state
  (`:80`). So: `ExportView.tsx:102` (Export Setup) and `:113` (Export All) both pass
  `activeSession` and will therefore print a literal **"Setup Changes (0)" + "No changes
  recorded."** in every PDF once data is wiped. `SetupView.tsx:473` passes no `activeSession`, so
  the Setups-card share is clean. **FIXED at chunk gate (Fable 5):** the heading + table now
  render only when adjustments exist (`exportPdf.ts:78-79`, 2-line conditional); the plain-text
  `lines` fallback already spread an empty array, so no change needed there. Lint/build
  re-verified after the fix.
- **`scripts/chunk5-setup-harness.ts` debt deepens sharply.** It compiles production exports by
  source-slicing and now references three symbols that no longer exist: `resolveBoundSetupDiff`
  (`:796, :884`), `BoundSetupDiffSummary` (`:797, :818-828, :1026, :1121`) and `LegacySetupLog`
  (`:1019, :1033, :1124`), plus an assertion on the exact removed render string
  `'<LegacySetupLog changes={setupItem.changeLog} />'` (`:879`). It will fail at extraction, not
  at an assert. Runtime-only, not in `package.json`, type-checks clean — same category as the
  Chunk A/E harness rot. This **deepens, does not widen**, the deferred-cleanup debt: the harness
  set needing disposal is unchanged, but `chunk5-setup-harness.ts` has moved from "rework" to
  "rework or delete — three of its subjects no longer exist."

### Final gate decision — harness/lib cleanup DEFERRED until a direction is chosen

The stale-harness disposal (items 1-5 accumulated in the chunk QA notes: delete
`saved-flash-harness.ts` + `chunk7-quick-adjust-harness.ts`, rework `chunk5-setup-harness.ts`,
patch `offline-indicator-harness.ts` / `chunk9-export-help-harness.ts` /
`setup-touch-target-harness.ts`) and the `lib/quickAdjust.ts` trim it blocks are all
**dead-code hygiene, not user-facing**. Doing them now would churn ~2000 lines of QA scripts
on a branch the owner may abandon, and none of it affects lint, build, or the shipped app.
If this direction wins: do the full sweep (harnesses, `quickAdjust.ts` trim, D3 lifecycle
decision) as its own cleanup sprint before merging. If the other direction wins: nothing
was wasted. Sprint totals: **−939 net lines of src/** across 6 chunks (A −163, B −450,
C −24 src, D −85, E −44, F −112; plus CSS/App wiring and the exportPdf gate fix), one
component file deleted.

---

## Owner amendments — 2026-07-26 round 2 (browser/APK hands-on)

Owner verdict on current state: "I think I've made this too complicated and it's hard to
navigate. Trying to reduce noise and clutter by getting back to the essentials." → Chunk G.

### Known issue (recorded, NOT fixed — owner: "shouldn't matter right now")

**Setup revert on next session.** Owner logged a setup change, proceeded to next session, and
the setup reverted to its starting point. Almost certainly the lifecycle snapshot machinery
(`setupLifecycle.ts` baseline/weekend roles + `captureSetupSnapshot` at session creation)
restoring/rebinding rather than carrying the edited state forward. All entry points to
trackside change-logging are hidden as of Chunk G, so it is unreachable — but if setup
tracking is ever revisited (D3), START HERE.

## Chunk G — Back to essentials (hide lifecycle chrome, drop per-run weather)

Scope:
- [x] `SetupView.tsx`: hide the read-only/lifecycle notice box on setup cards — the
      `historicalSetup` copy ("Starting and finished snapshots stay unchanged…", ~47), the
      "managed from Race Day" line (~55), and the "Manage car in Garage" button (~633-634)
      inside it. Remove the whole notice block render; keep `getSetupEditability` itself
      (read-only INPUT locking stays — only the explanatory chrome goes). Keep the
      `CarRequiredPrompt` usage (~515) — that is the no-car empty state, different thing.
- [x] `RaceWeekendView.tsx`: remove `LogSetupChangesButton` (component ~121-131 + render
      ~1232) — last trackside change-logging entry point.
- [x] `RaceWeekendView.tsx`: remove the WEATHER text input from the Active Log identity
      section (session.weather field). The weekend-level Location & Weather widget STAYS.
      `session.weather` keeps existing in types/persistence (frontend-only); new-session
      creation may still stamp it from weekend weather — leave writes alone.
- [x] Sweep now-dead props/imports (e.g. `onLogSetupChanges` plumbing from App.tsx,
      `onGoToGarage` in SetupView IF the notice was its last non-empty-state consumer).

Acceptance: Setups cards show no lifecycle notice / garage button; Runs tab has no
"Log setup changes" button; Active Log has no Weather input; weekend weather widget intact;
tsc 3 baseline identities; build passes. Pipeline: Opus 5 medium build → Fable 5 gate
(owner waived the Opus High quick-QA step for this chunk) → Netlify preview refresh.

### Chunk G — QA notes (Fable 5 gate; Opus High step waived by owner)

- **Actuals:** `SetupView.tsx` −14, `RaceWeekendView.tsx` −29/+4, `App.tsx` −4. Net **−47**.
- **Editability locking verified intact:** `getSetupEditability` still drives the
  `<fieldset disabled={isReadOnly}>` form lock (626), the "View only" badge (578), hidden
  rename/Use-Setup buttons, and the delete button's disabled state + a11y reason
  (`setupDeleteReason` kept for 596/615). Only the explanatory notice chrome went.
- **`onLogSetupChanges` chain fully removed** (5 sites, sole consumer). `onGoToGarage` kept —
  still used by the no-car empty state and two child views.
- **`session.weather` now has zero references in `RaceWeekendView` render**; writes at session
  creation (App.tsx 1963/2021/2266), new-session modal stamp (nsWxStr), and the weekend-level
  Location & Weather widget all untouched.
- **Baseline:** 3 identities unchanged — `RaceWeekendView` 255→242, `SetupView` 785→771,
  `SmasherLoadsView` 617. Build passes. Harness note: `saved-flash-harness.ts:254` string
  assertion on the notice copy now stale (existing deferred category).
- Deployed to Netlify preview alias `ui-simplification` after commit.

---

## Owner amendments — 2026-07-26 round 3 (browser hands-on, screenshots)

1. Weekend banner "still too busy — once loaded, keep minimized unless user clicks on it"
   → Chunk H.
2. Simplify Setups: **no view-only limitations; no baseline / "active trackside" / final
   roles for race weekends; just saved setups + copy/clone; static message telling the user
   to clone before adjustments** → Chunk I. This ACTIVATES the deferred D3 decision at the
   behavior level (weekends bind a plain saved setup; no lifecycle clones), with data wipe
   confirmed by owner — zero migration concerns.

Sonnet investigation (this session) findings that bind the specs below:
- `RaceWeekend.setupId` (types.ts:340) is the pre-existing plain-reference field — reuse it;
  types.ts stays untouched.
- ONE unavoidable lib edit: `lib/quickAdjust.ts:83-99 isQuickAdjustRunAvailable` hard-codes
  the clone triad (`lifecycleRole==='weekend' && setup.weekendId===weekend.id &&
  weekend.activeSetupId===setup.id`); must become a plain `weekend.setupId===setup.id` check
  or the Runs editor never renders. Everything else is App.tsx/component call sites.
- `handleSaveSetups` in App.tsx has 4 `getSetupEditability` guards that mirror the SetupView
  UI gating — must drop in lockstep or edits silently fail to persist.
- Weekend-creation "Starting Setup" is a plain <select> in `weekendFormModal`
  (RaceWeekendView 571-591); COPY LATEST / START BLANK belong to SetupView's create form,
  unrelated.
- `captureSetupSnapshot` + pressure propagation are lifecycle-agnostic — session creation
  works unchanged once `resolveWeekendSetup` does a plain id lookup.

## Chunk H — Weekend banner collapsed by default

Scope (`RaceWeekendView.tsx` only):
- [x] Wrap the Location & Weather block (914-984) + Race Day Notes block (987-995) in a
      collapsed-by-default conditional. Header row (888-911) stays always visible and becomes
      the toggle: rotate-chevron pattern copied from `editorCollapsed` (1030-1033), PLUS
      `aria-expanded` (the existing patterns lack it; add it here). Edit-pencil inside the
      header keeps working via stopPropagation (copy the All Race Days nested-interactive
      pattern, 1238-1256).
- [x] Default collapsed on every load; expansion is component state only, no persistence.
- [x] No mount-safety issues: weather never auto-fetches (fetch is button-driven), notes
      persist per keystroke through props — plain conditional render is safe (investigated).

### Chunk H — QA notes (Fable 5 gate)

- Actuals: +29/−9 (net +20). Header is a div-with-role toggle (valid HTML — real pencil
  button can't nest inside a button), `aria-expanded` added, chevron rotates, pencil isolated
  via stopPropagation on click+keydown. `border-b` made conditional to avoid a doubled
  divider when collapsed (cosmetic deviation, accepted). Baseline: RaceWeekendView 242→243
  (one state line above the error), others unmoved. Committed `24203c6`.

Acceptance: Runs tab loads with the banner showing only the header row; tapping it reveals
weather + notes; pencil still opens the edit form without toggling; tsc 3 identities; build
passes.

## Chunk I — De-lifecycle setups (binds D3)

Scope:
- [x] `lib/quickAdjust.ts` (the ONE lib edit): `isQuickAdjustRunAvailable` — replace the
      clone-triad check with `weekend.setupId === setup.id`; keep all non-lifecycle checks
      (weekend active/finished, session binding) unchanged.
- [x] `App.tsx handleCreateNewWeekend` (~1851): no `startWeekendLifecycle`, no clones —
      stamp `weekend.setupId = sourceSetup?.id` + `setupName`; leave baseline/active/final
      fields unset.
- [x] `App.tsx handleFinishWeekend` (2181-2237): full rewrite — mark finished + timestamps,
      persist, clear active session/weekend. No fallback setup, no final/current clones, no
      `setSetup()` reassignment. Simplify `INFO_COPY['weekend-finished']` (109) to
      "${name} finished." and drop the finalLabel/currentLabel context.
- [x] `App.tsx resolveWeekendSetup` (316-325): plain `savedSetups.find(s => s.id ===
      weekend.setupId)`; drop `isSetupLocked`/role checks.
- [x] `App.tsx handleSaveSetups`: drop the 4 `getSetupEditability` guards (1627/1631/1636/
      1644) + `isSetupLocked` at 1696; KEEP the dangling-pointer repair (1650-1687) — more
      important now that setups are freely deletable.
- [x] `App.tsx`: stop passing `activeEventSetupId` to SetupView (drop prop end-to-end);
      prune dead setupLifecycle imports.
- [x] `SetupView.tsx`: remove all editability gating — `getSetupEditability`/`isReadOnly`
      (554-555), rename guard (369), delete guards (377/391), View-only chip (578), sr-only
      reason + `setupDeleteReason` (50-56, 596), delete-button disable (615-618),
      `!isReadOnly` clauses on rename (573) / Use Setup (589); `<fieldset
      disabled={isReadOnly}>` (626) → plain `<div>`. KEEP minimum-setups check +
      car-ownership check on delete.
- [x] `SetupView.tsx`: "Active trackside" chip (577) → reword to "IN USE" (the selected-setup
      mechanic stays; only the lifecycle-flavored wording goes).
- [x] `SetupView.tsx`: add the static clone tip between the create form (538) and the
      accordion list, styled like the attachment captions:
      "Editing a setup changes it everywhere it's used — clone it first to keep the original."
- [x] `RaceWeekendView.tsx`: finish-weekend copy rewrites (1334, 1341→1431 ConfirmSheet);
      delete the `finalSetupId` history line (867); weekend banner setup line should render
      the plain setup name; dropdown `!setup.lockedAt` filter (584) may stay (permanent no-op).
- [x] Copy pass on missing-setup INFO_COPY strings (App.tsx 106-111): drop "Restore it"
      phrasing (no restore path exists); point to rebinding via Edit Race Day.
- [x] KEEP untouched: `isWeekendFinished` + finished-weekend read-only rules (weekend.status,
      orthogonal to setup lifecycle), `types.ts`, `setupLifecycle.ts` itself (goes fully dead
      except `captureSetupSnapshot`/label helpers — deferred-cleanup category),
      `lib/tireHistory.ts syncTireLifecycle` (unrelated tire system, name collision only).

Acceptance: create weekend → picks saved setup, NO new setup rows appear in Setups; every
setup card fully editable (no View only, no disabled fields, no locked delete); finish
weekend → weekend moves to history, setup list unchanged; Runs editor still gates open with
an active weekend+session; clone tip visible; tsc 3 identities (SetupView 771 shifts; its
TS2322 sits INSIDE the fieldset→div block — identity must not change and must NOT be
drive-by-fixed); build passes.

### Chunk I — QA notes (Fable 5 gate)

- **Actuals:** `App.tsx` +32/−116, `SetupView.tsx` +12/−31, `RaceWeekendView.tsx` +14/−13,
  `lib/quickAdjust.ts` +1/−3. Net **−104**. All 12 scope items done.
- **Gate verified by direct read:** `isQuickAdjustRunAvailable` is the plain
  `weekend.setupId === setup.id` binding (quickAdjust.ts:83-97); `handleCreateNewWeekend`
  (App 1789) builds the weekend with `setupId`/`setupName` and zero setup writes (sets the
  picked setup as the app's current setup — carried over from old behavior);
  `handleFinishWeekend` (App 2131) marks finished + clears session/active id, no clones,
  no `setSetup`. Create→resolve→gate trace confirmed by builder with line refs.
- **Approved deviations:** (1) setup REBINDING enabled in Edit Race Day — the select now
  shows in edit mode and `handleUpdateWeekend` no longer force-restores the old binding;
  required so a weekend whose setup is deleted (now possible — no locks) has a recovery
  path matching the new missing-setup copy. (2) missing-setup strings in RaceWeekendView
  aligned to the new copy. (3) history fallback "Starting Setup saved" → "No setup".
  (4) `missing-weekend-finish` INFO_COPY now unreachable — left, deferred-dead category.
- **Baseline:** RaceWeekendView 243 (unmoved), SetupView 771→**752** (same TS2322 `key`
  error, NOT drive-by-fixed, per spec), SmasherLoadsView 617. Build passes.
- **Dead-code note:** `setupLifecycle.ts` is now dead except `captureSetupSnapshot`,
  `isWeekendFinished`, label helpers, `mergeTimestampedRecords`,
  `repairSetupDeletionReferences`, `selectRaceWeekendSetupForSelection`;
  `resolveQuickAdjustTarget`/`applyQuickAdjust` in quickAdjust.ts remain dead (zero
  callers). All folds into the deferred cleanup sprint if this direction wins.
