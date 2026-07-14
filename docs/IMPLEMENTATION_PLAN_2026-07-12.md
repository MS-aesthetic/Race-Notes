# IMPLEMENTATION PLAN

> **PROGRESS (2026-07-13) — branch `preview-v3`:** Chunks 1–7 ✅ SOL QA PASS · Chunk 8 unlocked for Terra · 9 locked by dependencies. Current routing: GPT 5.6 SOL High plans/QAs; GPT 5.6 Terra High builds; persistent-task model handoff verified. `/caveman full`. Status: `HANDOFF.md` + `ralph/STATE.md`.
**CREW CHIEF â€” UX overhaul, all 37 recommendations (owner-adjusted)**

**Sequencing philosophy.** Three rules drive the ordering:

1. **Primitives first.** Roughly a third of the recs consume the same six widgets (steppers, undo toasts, empty states, collapsible sections, help sheet, tap-grid). Build them once, in isolation, with zero `App.tsx` churn â€” every later chunk then becomes mostly view-file work.
2. **One big `App.tsx` pass, early, then leave it alone.** `App.tsx` is ~1850 lines and every rec that touches nav, header, tab order, context, bootstrap, or back-handling wants to edit it. Chunk 2 batches *all* of those into a single pass (recs 4, 5, 6, 27, 28, 29, 32, 33, 37). Every subsequent chunk touches `App.tsx` only for one-line wiring (a prop, an import) or not at all.
3. **Structure before features that lean on it.** Sessions-owns-weekends (#15) restructures the Race Weekend flow, so the Sessions chunk runs *before* the Dashboard chunk whose "+ LOG RUN" hero (#7) deep-links into it. Context strip (#6) lands in the shell pass, before #7 needs it. The reversed four-bar quick-adjust (#18) is built in the Setups chunk as a standalone component specifically so the quick-log flow (chunk 3) can mount it too.

QA is consolidated per chunk: each chunk ends with one test pass covering everything in it, plus the standing gates **`tsc --noEmit` (3-error baseline, add none)** and **`vite build`** on Windows â€” those two apply to every chunk and are not repeated in each QA list.

> **Path note for builders:** file paths below assume `src/App.tsx`, `src/types.ts`, `src/data.ts`, `src/components/*.tsx`, `src/lib/*.ts` per the codebase map. Verify exact paths with Glob before editing; the component/lib *names* are authoritative.

---

## BUILD CHUNKS

### CHUNK 1 â€” Shared primitives + glove/glare/zoom hardening
**Goal:** Build every reusable widget and the global touch/contrast/zoom CSS layer, with no `App.tsx` changes and no behavior changes to existing screens (except passive CSS hardening). Everything here is consumed by chunks 2â€“7.
**Covers:** 31, 34 (build portion), plus the primitive library consumed by 2, 3, 8, 9, 12, 13, 17, 18, 24, 36.

| Task | Spec | Files | Effort | Deps |
|---|---|---|---|---|
| **[31] Glove/glare hardening layer** | Add a global interaction-hardening CSS layer: (a) utility class `.tap-target` guaranteeing â‰¥48Ã—48px hit area (use padding/`min-height`, not transform); (b) `.sticky-action-bar` â€” bottom-pinned primary-action container with `env(safe-area-inset-bottom)` padding, `bg-surface-container-high`, top border `border-outline-variant`; (c) chips standard: icon + text label, never icon-only, `min-height: 48px`; (d) contrast pass: in the **light** theme, bump `text-on-surface-variant` and `border-outline-variant` token values so body-secondary text hits â‰¥ 4.5:1 against `bg-surface` (dusk/sunlight readability per owner answer 5). Theme tokens only â€” no hex in components; token *values* change only inside the `@theme` block. Acceptance: grep finds no new raw hex in `src/components` or `src/App.tsx`; every new primitive below uses `.tap-target`. | Modify: `src/index.css` (or wherever `@theme` lives â€” Glob for `@theme`). New: none. | Med | â€” |
| **[34] Font-zoom hardening (build half)** | Audit for fixed pixel heights/widths on text containers that break at `--ui-zoom` xxlarge. Rules for all NEW components in this plan: no fixed heights on text rows; `line-clamp`/`truncate` on labels that can grow; steppers and keypads size in `rem` so they scale with zoom. Fix any existing offenders found by grep (`h-\[\d+px\]`, `text-\[\d+px\]`) in the dense views (`DashboardView`, `SetupView`, `RaceWeekendView`). Acceptance: at xxlarge, no clipped text in the primitive demo states (verified in chunk QA); full-app zoom sweep happens in chunk 7. | Modify: offending component files per grep. | Low-Med | â€” |
| **[prim] `<NumberStepper>`** | `src/components/ui/NumberStepper.tsx`. Props: `value`, `onChange`, `step`, `bigStep?` (long-press or secondary +/âˆ’ uses bigStep), `min?`, `max?`, `unit?` (e.g. `"psi"`, `"Â°"`, `"in"`), `format?` (decimals), `label?`. Layout: `[âˆ’] value+unit [+]`, buttons â‰¥48px, `font-mono` value, long-press auto-repeat (~350ms delay then 100ms interval, clear on pointerup/leave). Also renders value as a tappable field that focuses a plain numeric input for direct entry. Consumed by: 17, 18, 12/14 (pressures/temps), 26. | New: `src/components/ui/NumberStepper.tsx`. | Low | 31 (uses `.tap-target`) |
| **[prim] `<UndoToast>` + `useUndoableDelete`** | `src/components/ui/UndoToast.tsx` + `src/lib/undo.ts`. `useUndoableDelete<T>` contract: caller passes `{ item, removeFromState, restoreToState, commit }`. On delete: remove from React state + localStorage immediately, show toast `"[label] deleted â€” UNDO"` for 5s. UNDO â†’ `restoreToState` (re-set state + localStorage + re-push if signed in), no cloud call ever made. Timeout/dismiss/second-delete â†’ `commit()` which performs the `delete*FromCloud(id)` call. Critical: `delete*FromCloud` must ONLY fire in `commit`, never eagerly â€” this is the whole point. Toast renders above the bottom nav, one at a time (new delete force-commits the pending one). Consumed by: 8, and any delete path touched in chunks 3â€“6. | New: `src/components/ui/UndoToast.tsx`, `src/lib/undo.ts`. | Low | â€” |
| **[prim] `<EmptyState>`** | `src/components/ui/EmptyState.tsx`. Props: `icon` (Material Symbol name), `title`, `body`, `cta?: { label, onClick }`, `secondaryCta?`. Racing-voiced copy comes from call sites. Big centered layout, CTA is a full-width primary button (â‰¥48px). Consumed by: 3, 1, 15, 21. | New: `src/components/ui/EmptyState.tsx`. | Trivial | â€” |
| **[prim] `<CollapsibleSection>`** | `src/components/ui/CollapsibleSection.tsx`. Props: `title`, `subtitle?`, `storageKey?` (persists open/closed in localStorage), `defaultOpen`, `badge?`. Header row is a â‰¥48px full-width tap target with chevron. Consumed by: 9, 21, 29 (expand-state preservation comes free via `storageKey`). | New: `src/components/ui/CollapsibleSection.tsx`. | Trivial | â€” |
| **[prim] `<SegmentedGrid>`** | `src/components/ui/SegmentedGrid.tsx`. Renders an NÃ—M grid of single-tap toggle cells (rows = phases, cols = conditions), each cell â‰¥48px, selected cell uses `text-primary` on `bg-surface-container-highest` with bold border. Props: `rows: {id,label}[]`, `cols: {id,label}[]`, `value: Record<rowId, colId|null>`, `onChange`. One selection per row. Consumed by: 12. | New: `src/components/ui/SegmentedGrid.tsx`. | Low | â€” |
| **[prim] `<BottomSheet>` + `<HelpSheet>`** | `src/components/ui/BottomSheet.tsx`: generic modal sheet sliding from bottom, scrim tap + drag-handle close, exposes `onClose` (chunk 2 wires Android back to it). `src/components/ui/HelpSheet.tsx`: BottomSheet hosting `QuickReferenceView` with an optional `section?` prop to scroll to an anchor. Consumed by: 27, 36, 13 (keypad sheet), 25 (service sheet), 6 (switch pickers). | New: `src/components/ui/BottomSheet.tsx`, `src/components/ui/HelpSheet.tsx`. Modify: `src/components/QuickReferenceView.tsx` (accept optional `section` prop + section anchors; no other change). | Low | â€” |

**Consolidated QA â€” Chunk 1** (one pass):
- `tsc --noEmit` and `vite build` pass, error count unchanged â€” **CODE-VERIFIABLE**.
- Grep: no raw hex colors in any new file; every new interactive element carries `.tap-target` or explicit `min-h-12`; no `delete*FromCloud` reference outside `sync.ts` + `undo.ts` commit path â€” **CODE-VERIFIABLE**.
- Grep confirms no import of new primitives from `App.tsx` yet (chunk isolation) â€” **CODE-VERIFIABLE**.
- Browser: temporarily mount each primitive on any dev view (or Vite playground route-less scratch render), verify: stepper long-press repeat, undo toast restore + delayed commit (watch network tab â€” no cloud delete until timeout), grid single-tap select, sheet drag-close â€” **RUNTIME**.
- Light theme: secondary text contrast spot-check â‰¥4.5:1 (devtools contrast checker) on Dashboard + Setups â€” **RUNTIME**.
- Set `--ui-zoom` to xxlarge; primitives don't clip â€” **RUNTIME**.

---

### CHUNK 2 â€” App shell: nav, header, context, bootstrap (the one big `App.tsx` pass)
**Goal:** Every `App.tsx` structural change lands here, once. After this chunk, `App.tsx` is frozen except for trivial wiring lines.
**Covers:** 4, 5, 6, 27, 28, 29, 32, 33, 37.

| Task | Spec | Files | Effort | Deps |
|---|---|---|---|---|
| **[27] 6â†’5 tabs, QuickRef â†’ help sheet** | Remove `quickref` from the bottom-nav tab array. Keep `'quickref'` as a legal `activeTab` value internally OR (preferred) delete it and route all former entry points to a `helpOpen` boolean rendering `<HelpSheet>`. Top bar gains a persistent "?" icon button (â‰¥48px) opening HelpSheet. Acceptance: bottom nav shows exactly 5 tabs; QuickRef content fully reachable from "?" on every tab; no dead `activeTab==='quickref'` branches remain (grep). | Modify: `src/App.tsx`. | Low | HelpSheet (C1) |
| **[28] Tab order = race-day ritual** | Reorder nav array to: **Dashboard â†’ Setups â†’ Sessions (Race Weekend) â†’ Trackers â†’ Settings** â€” mirrors the trackside ritual: check status â†’ set the car up â†’ run/log â†’ post-run trackers. Pure array reorder + label check (Race Weekend tab label becomes "Sessions" here, ahead of chunk 4's ownership change). | Modify: `src/App.tsx`. | Trivial | 27 |
| **[6] Unified car+weekend context strip** | New `src/components/ContextStrip.tsx`, rendered once in `App.tsx` between header and tab content, visible on `dashboard | setups | raceweekend | trackers`. Shows: car chip (name/number â€” **rendered only when `cars.length > 1`**, per #37) + weekend chip (`track Â· Sat Jul 12` or "No active weekend"). Tap car chip â†’ BottomSheet car picker; tap weekend chip â†’ BottomSheet weekend picker sorted per #10 (active first, then date desc) with a "+ New weekend" row that fires the existing new-weekend modal. Props: `cars, activeCarId, weekends, activeWeekendId, onSelectCar, onSelectWeekend, onNewWeekend` â€” all existing App.tsx state/handlers, no new state shape. Acceptance: strip reflects switches instantly; with 1 car the strip shows only the weekend chip; with 0 weekends the chip is a CTA. | New: `src/components/ContextStrip.tsx`. Modify: `src/App.tsx` (single mount + props). | Med | 37, BottomSheet (C1) |
| **[37] Hide car UI at â‰¤1 car; honest switch toast** | Global rule: **every** car chip/switcher/selector renders `null` when `cars.length <= 1` (ContextStrip, Dashboard, Settings header â€” grep for existing car-switch UI and gate each). With 2â€“3 cars, switching shows a toast: `"Now viewing #57 Modified â€” setups, sessions & trackers switched."` Toast lives in the `onSelectCar` handler in `App.tsx` (reuse UndoToast's toast shell as a plain info toast â€” export an `InfoToast` variant from `UndoToast.tsx`). Garage management in Settings remains fully visible regardless (that's where you *add* car #2). | Modify: `src/App.tsx`, `src/components/ui/UndoToast.tsx` (info variant), any component with a car switcher (grep `activeCarId` selectors). | Trivial-Low | 6 |
| **[32] Light-theme toggle in top bar** | Sun/moon icon button in the top bar (next to "?"). Tap toggles theme immediately, persists to the same settings storage the Style sub-tab uses (keep Style sub-tab as the "full" control; the top-bar button is a shortcut). Icon reflects current state. Light-theme outdoor tuning itself is the token work in [31]. Acceptance: toggle round-trips with Settingsâ†’Style; persists across reload. | Modify: `src/App.tsx` (button + handler reusing existing theme setter). | Low | 31 |
| **[33] Saved-state + offline trust (single-user scope)** | New `src/lib/saveStatus.ts`: tiny pub-sub â€” `reportSave(scope: 'local'|'synced')`, `subscribe(cb)`, plus `navigator.onLine` + `online/offline` listeners. Instrument the dual-write path: wherever `App.tsx` does `setX; localStorage.setItem; if(user) pushX`, call `reportSave('local')` after the localStorage write and have `sync.ts` push helpers resolve â†’ `reportSave('synced')` (one call added inside the shared push wrapper in `sync.ts`, NOT at 30 call sites â€” if no shared wrapper exists, create `pushWithStatus` in `sync.ts` and leave call sites alone by wrapping at export). Top-bar indicator (inside ContextStrip or header): âœ“ **"Saved"** (local write, signed out), âœ“ **"Synced"** (push resolved), cloud-off icon **"Offline â€” saved on device"** (offline; clears when back online + push succeeds). NO "who changed" metadata (deferred). Acceptance: airplane-mode edit shows offline badge yet data survives reload; badge flips to Synced after reconnect. | New: `src/lib/saveStatus.ts`. Modify: `src/lib/sync.ts` (status hooks ONLY â€” sync helpers stay in sync.ts per convention), `src/App.tsx` or `ContextStrip.tsx` (indicator). | Med | 6 |
| **[29] Tab scroll/expand preservation + Android back** | (a) Scroll: `useRef<Record<tab, number>>`; on tab switch save `scrollTop` of the scroll container, on activate restore via `requestAnimationFrame`. (b) Expand state: already persisted via CollapsibleSection `storageKey` (C1) â€” no extra work, just a convention note: all new collapsibles must pass `storageKey`. (c) Android back: on tab change away from dashboard, `history.pushState({tab})`; on sheet/modal open, `pushState({modal})`. `popstate` handler: if a modal/sheet is open â†’ close it; else if `activeTab !== 'dashboard'` â†’ go to dashboard; else let the app exit (do not push). All BottomSheets register through a single `useBackClosable(isOpen, onClose)` hook in `src/lib/backStack.ts` so future modals get it free. Acceptance: back from an open sheet closes the sheet (doesn't exit); back from Setups â†’ Dashboard; back from Dashboard â†’ exits; scroll positions survive tab round-trips. | New: `src/lib/backStack.ts`. Modify: `src/App.tsx`, `src/components/ui/BottomSheet.tsx` (use hook). | Med | BottomSheet (C1) |
| **[4] Auto-create first car** | In the App bootstrap effect: if the initial load completes with `cars.length === 0`, silently create a default car (`name: "My Car"`, sensible INITIAL_* defaults from `data.ts`) and set `activeCarId`. **Guard:** for a signed-in user, run only after the initial cloud pull resolves (avoid duplicating a car that exists in cloud); for local-only, run immediately. Combined with #37, a fresh single-car user never sees car-management friction at all. Acceptance: fresh profile â†’ Setups/Sessions immediately usable, no "create a car first" wall; sign-in on a second device does NOT create a duplicate. | Modify: `src/App.tsx` (bootstrap effect), `src/data.ts` if a default-car factory is needed. | Low | â€” |
| **[5] Auto-activate weekend** | Two triggers: (a) creating a weekend sets `activeWeekendId` to it immediately (+ info toast `"Active: Eldora Â· Sat Jul 12"`); (b) on app load, if `activeWeekendId` is null/stale and any weekend has a date within Â±3 days of today (prefer today/upcoming, else most recent), auto-select it with the same toast. Logic in a pure helper `pickAutoWeekend(weekends, today)` in `src/lib/scope.ts` (it's car/weekend scoping logic â€” fits) so it's unit-greppable. | Modify: `src/lib/scope.ts` (helper), `src/App.tsx` (two call sites). | Low | 37 (toast variant) |

**Consolidated QA â€” Chunk 2** (one pass â€” this is the highest-risk chunk; test thoroughly here so later chunks inherit a stable shell):
- Grep: no `quickref` in the nav array; nav array length = 5 and order matches spec; `delete*FromCloud` call-site count unchanged; `pushState` only in `backStack.ts`/`App.tsx` â€” **CODE-VERIFIABLE**.
- Fresh-profile flow: clear localStorage, load signed-out â†’ car auto-created, active; no car chips anywhere visible â€” **RUNTIME, NEEDS-DATA (clean profile)**.
- Two-car profile: car chips appear, switch shows honest toast, Dashboard/Setups/Trackers data all rescope (spot-check via `byActiveCar` results) â€” **RUNTIME, NEEDS-DATA (2 cars)**.
- Create weekend â†’ becomes active + toast; reload with a weekend dated today â†’ auto-activates â€” **RUNTIME, NEEDS-DATA (weekend dated today)**.
- Context strip: both pickers open/close, selection updates strip + downstream tabs â€” **RUNTIME**.
- Back-button matrix (Android emulator or browser back): sheet open â†’ closes; non-dashboard tab â†’ dashboard; dashboard â†’ exit; never traps â€” **RUNTIME**.
- Scroll preservation: scroll deep in Trackers, tab away and back, position restored â€” **RUNTIME**.
- Save indicator: edit while offline (devtools offline) â†’ "Offline â€” saved on device", reload retains data, reconnect â†’ "Synced" â€” **RUNTIME**.
- Theme toggle round-trips with Settingsâ†’Style and persists across reload â€” **RUNTIME**.
- "?" opens QuickRef sheet from all 5 tabs â€” **RUNTIME**.

---

### CHUNK 3 â€” Sessions & Race Weekend: quick-log flow (the structural chunk)
**Goal:** Make the Sessions tab own weekends, and make logging a run after coming off the track fast, ordered, and glove-friendly â€” without being so stripped-down it loses completeness (owner answer 1).
**Covers:** 15, 11, 14, 12, 13. (Dashboard's #7 hero deep-links into this in chunk 4.)

| Task | Spec | Files | Effort | Deps |
|---|---|---|---|---|
| **[15] Sessions tab owns weekends** | `RaceWeekendView` becomes the single home for weekend CRUD: weekend list (sorted per #10), select, create, edit, delete (â‹¯ + undo per #8 pattern). **Move the new-weekend and new-session modal JSX out of `App.tsx` into `RaceWeekendView`** â€” App.tsx keeps only the state-mutation handlers (`createWeekend`, `createSession`, â€¦) passed as props; this *removes* lines from App.tsx, honoring the churn budget. Dashboard (chunk 4) will stop listing all weekends and become a launchpad. Expose an imperative entry prop `initialAction?: 'new-session' | 'new-weekend'` on `RaceWeekendView` (cleared after consumption) so the Dashboard hero can deep-link. No-weekend state uses `<EmptyState>`: *"No race weekends yet â€” where are you racing next?"* + "New weekend" CTA. Acceptance: all weekend CRUD reachable from Sessions tab; App.tsx line count goes DOWN in this task; deep-link prop opens the new-session flow on mount. | Modify: `src/components/RaceWeekendView.tsx` (major), `src/App.tsx` (move-out only: modal JSX leaves, handlers stay, one `initialAction` prop). | Med | C2 shell |
| **[11] Smart session sequencing / auto-name / prefill** | New `src/lib/sessionSequence.ts`: `suggestNextSession(sessions: Session[], weekendId): { type, name, prefill }`. Ordering knowledge: Practice/Hot Laps â†’ Qualifying â†’ Heat(s) â†’ B-Main â†’ Feature. Auto-name with counters ("Hot Laps 2", "Heat 1"). `prefill` carries forward from the most recent session in the weekend: track condition, tire pressures/compounds, gear â€” anything the previous session recorded that plausibly persists. New-session flow opens pre-populated with the suggestion; type + name remain editable (one-tap type chips). Acceptance: after logging Hot Laps 1, opening new session defaults to "Hot Laps 2" or "Qualifying" per sequence, with prior pressures pre-filled; pure function is deterministic and lives entirely in `lib/` (unit-checkable via a scratch harness). | New: `src/lib/sessionSequence.ts`. Modify: `src/components/RaceWeekendView.tsx` (consume in new-session flow). | Low | 15 |
| **[14] Top-to-bottom quick-log layout** | Reorder the session log form to match the trackside debrief flow, one continuous scroll, no horizontal tab-hopping: **1)** Session identity (auto-suggested per #11, usually untouched) â†’ **2)** Track state (condition chips) â†’ **3)** Result / laps (lap time via #13 keypad, finish position) â†’ **4)** Handling diagnostics (#12 grid) â†’ **5)** Tire temps/pressures (NumberSteppers) â†’ **6)** Changes made (free text + four-bar quick-adjust entry point placeholder â€” wired in chunk 5) â†’ **7)** Notes. Sticky bottom `.sticky-action-bar` with a full-width **"SAVE RUN"** primary button always visible. Every section optional â€” Save works with only identity filled (balance speed vs completeness). Acceptance: full log possible top-to-bottom with thumbs only, no keyboard needed except Notes; Save always reachable without scrolling. | Modify: `src/components/RaceWeekendView.tsx`. | Med | 15, 12, 13, NumberStepper (C1) |
| **[12] Diagnostics 3Ã—3 tap grid** | Handling diagnostics as a `<SegmentedGrid>`: rows = corner **Entry / Middle / Exit**, cols = **Tight / Neutral / Loose**. One tap per row; tap again to clear. Persist to the session's existing diagnostics field â€” check `types.ts` for the current shape; if it's free-text today, add an optional structured field `handling?: { entry?: 'tight'|'neutral'|'loose'; middle?: ...; exit?: ... }` to the Session type (types.ts only) and keep legacy text rendering intact. Acceptance: 3 taps max to capture a full handling read; saved value survives reload + sync round-trip. | Modify: `src/types.ts` (optional field), `src/components/RaceWeekendView.tsx`. | Low | SegmentedGrid (C1) |
| **[13] Lap-time keypad** | `src/components/ui/LapTimeKeypad.tsx`: BottomSheet numeric keypad for lap-time fields. Big keys (â‰¥56px), digits + backspace + Done; input auto-formats right-to-left as `ss.sss` rolling into `m:ss.sss` (e.g., typing 1-5-8-3-2 â†’ `15.832`; 1-1-5-8-3-2 â†’ `1:15.832`). Value stored in the session's existing lap-time field format (inspect `types.ts` â€” store seconds as number or the existing string convention, do not invent a new format). Tapping any lap-time input opens the keypad instead of the OS keyboard (`inputMode="none"` + focus handler). Acceptance: gloved-thumb entry of a lap time in â‰¤6 taps; malformed values impossible. | New: `src/components/ui/LapTimeKeypad.tsx`. Modify: `src/components/RaceWeekendView.tsx`. | Med | BottomSheet (C1) |

**Consolidated QA â€” Chunk 3** (one pass, one seeded weekend):
- Grep: new-weekend/new-session modal JSX no longer in `App.tsx`; `App.tsx` diff is net-negative lines for this chunk; `sessionSequence.ts` has no React imports (pure lib) â€” **CODE-VERIFIABLE**.
- Sequence logic table-check: run `suggestNextSession` against 4 fixture arrays (empty / practice-only / through-heats / full-night) via a scratch node script, assert type+name â€” **CODE-VERIFIABLE (harness)**.
- End-to-end "hot-pit debrief": create weekend â†’ new session (suggested Hot Laps 1) â†’ fill top-to-bottom: condition chip, lap time via keypad, 3-tap handling grid, bump RR pressure with stepper, note â†’ SAVE RUN via sticky bar â†’ session appears; open next session â†’ auto-suggests next type with pressures carried â€” **RUNTIME, NEEDS-DATA (seeded weekend)**.
- Keypad formatting edge cases: sub-minute, over-minute, backspace across the colon â€” **RUNTIME**.
- Back button closes keypad sheet without losing the half-filled form â€” **RUNTIME**.
- Reload + (if signed in) second-device pull shows structured handling + lap time intact â€” **RUNTIME, NEEDS-DATA (auth account)**.
- xxlarge zoom: quick-log form fully usable, sticky Save not overlapped â€” **RUNTIME**.

---

### CHUNK 4 â€” Dashboard: launchpad, hero, onboarding
**Goal:** Dashboard becomes a glanceable launchpad â€” one giant "+ LOG RUN", weekend summary, maintenance chip, and a first-run path that gets a new racer race-ready.
**Covers:** 7, 9, 10, 8, 25, 1, 2, 3.

| Task | Spec | Files | Effort | Deps |
|---|---|---|---|---|
| **[7] "+ LOG RUN" Dashboard hero** | Full-width hero button at the top of Dashboard (below context strip), the visually dominant element (`font-display`, â‰¥64px tall). Tap: **if active weekend exists** â†’ `setActiveTab('raceweekend')` + set `initialAction:'new-session'` (from #15) â†’ quick-log opens pre-filled per #11. **If no active weekend** â†’ teaching sheet (#2 pattern): *"No active weekend â€” start one?"* with a one-tap **"Start weekend at [last track] today"** (creates weekend with today's date + most recent track, auto-activates per #5, then continues straight into new-session) plus a "Pick trackâ€¦" secondary. Acceptance: from cold Dashboard to an open, pre-filled quick-log form in â‰¤2 taps when a weekend is active, â‰¤3 when not. | Modify: `src/components/DashboardView.tsx`, `src/App.tsx` (one prop threading `initialAction` â€” wiring line only). | Med | 15, 11, 5 |
| **[9] Collapse panels / drop duplicates** | Wrap all secondary Dashboard panels in `<CollapsibleSection storageKey=â€¦>`. Remove the full weekend list from Dashboard (now owned by Sessions per #15) â€” replace with a single **active-weekend summary card** (track, date, session count, last lap time) that taps through to the Sessions tab. Remove any panel duplicating Trackers/Setups content wholesale; keep one-line summaries that link out. Acceptance: Dashboard fits ~2 screen-heights with all sections collapsed; zero data shown in two places in full form. | Modify: `src/components/DashboardView.tsx`. | Trivial-Low | 15, CollapsibleSection (C1) |
| **[10] This-weekend-first sorting** | Shared comparator `sortWeekends(weekends, activeWeekendId)` in `src/lib/scope.ts`: active first, then by date desc. Used by: Sessions list (#15), context-strip picker (#6), export pickers. Acceptance: grep shows all weekend `.sort` call sites use the shared comparator. | Modify: `src/lib/scope.ts`, call sites in `RaceWeekendView.tsx`, `ContextStrip.tsx`, `ExportView.tsx`. | Trivial | â€” |
| **[8] Deletes behind â‹¯ + undo toasts** | All destructive actions on Dashboard cards AND weekend/session rows (Sessions tab) move behind a â‹¯ overflow button (BottomSheet menu: Edit / Compare (where relevant, #20) / Delete). Delete uses `useUndoableDelete` (C1): instant UI removal, 5s undo, cloud delete only on commit. Acceptance: no bare trash icons on list rows in Dashboard or Sessions; deleting a session then tapping UNDO restores it fully (state + localStorage + cloud untouched); letting it expire fires exactly one `delete*FromCloud`. | Modify: `src/components/DashboardView.tsx`, `src/components/RaceWeekendView.tsx`. | Low | undo (C1) |
| **[25] Service-log chip + auto-accounting** | Dashboard maintenance chip row driven by `getComponentStatus` (`lib/maintenance.ts`): worst-status component shown as an icon+text chip (e.g., âš  "Engine â€” 2 nights over"). Tap â†’ BottomSheet quick service log: component (pre-selected), what was done, cost (optional), date=today. Saving: writes the service entry AND, if cost > 0, auto-creates a matching accounting expense (category "Maintenance", same description) with a toast *"Logged + added to accounting â€” UNDO"* (undo removes both). Cross-record creation logic goes in `src/lib/maintenance.ts` (or a small `src/lib/serviceLog.ts`), not App.tsx. Acceptance: service + expense created atomically from Dashboard in â‰¤4 taps; undo removes both records. | New (optional): `src/lib/serviceLog.ts`. Modify: `src/components/DashboardView.tsx`, `src/lib/maintenance.ts`. | Low | undo (C1) |
| **[1] First-run "Get race-ready" card** | Dashboard top card shown until completed/dismissed (flag in localStorage, device-local like activeCarId). Steps with live checkmarks: âœ“ **Car added** (auto-done via #4) â†’ **Start a race weekend** â†’ **Enter your baseline setup** â†’ **Log your first run**. Each incomplete step is a tap-through CTA to the right place (weekend â†’ #7 teaching flow; setup â†’ Setups tab; run â†’ hero). Completion detected from actual data (weekends.length, setups, sessions), not step-tapping. Auto-dismisses with a small *"You're race-ready ðŸ"* state once all done; X to dismiss early. Acceptance: card never reappears after dismissal; steps check themselves off from real data. | New: `src/components/GetRaceReadyCard.tsx`. Modify: `src/components/DashboardView.tsx`. | Low | 4, 7 |
| **[2] Disabledâ†’teaching buttons** | Pattern (not a component): any primary action currently rendered `disabled` for a missing-prerequisite reason becomes **enabled** and, on tap, opens a BottomSheet explaining the prerequisite with a CTA that resolves it. Apply everywhere the pattern exists â€” grep `disabled` across `src/components` + `App.tsx` and convert each case where the reason is "you haven't created X yet" (known: Log-Run/new-session with no weekend (#7 covers it), setup actions with no car (moot after #4), export with no data â†’ teaching sheet pointing at first-run card). Buttons disabled for validity reasons (mid-save, invalid form) stay disabled. Acceptance: grep review of every `disabled=` occurrence documented in the PR description as converted / intentionally-kept. | Modify: call sites per grep (DashboardView, SetupView, ExportView). | Trivial-Low | 7 |
| **[3] Empty-state CTAs** | Replace every blank/placeholder list body with `<EmptyState>` + racing copy: Dashboard sessions summary (*"Nothing logged yet â€” hit + LOG RUN after your first laps"*), Setups (*"No setups for this car â€” start from your baseline"* â†’ CTA), Trackers accounting/service/checklist, Sessions (done in #15). Grep for existing "No â€¦" placeholder strings to find all sites. | Modify: `DashboardView.tsx`, `SetupView.tsx`, `TrackersView.tsx` (CTA wiring only; deeper Trackers work is chunk 6). | Low | EmptyState (C1) |

**Consolidated QA â€” Chunk 4** (one pass, two profiles):
- Grep: `App.tsx` diff for this chunk â‰¤ ~10 lines (prop threading only); all weekend sorts use `sortWeekends`; no `disabled` primary CTAs left for missing-prereq reasons (per the audit list) â€” **CODE-VERIFIABLE**.
- **Fresh-profile path** (clear storage): auto-car (#4) â†’ race-ready card shows step 2 pending â†’ hero tap â†’ teaching sheet â†’ one-tap start weekend â†’ lands in quick-log â†’ save run â†’ back to Dashboard â†’ card fully checked + auto-dismisses â€” **RUNTIME, NEEDS-DATA (clean profile)** â€” this single walkthrough verifies 1, 2, 4, 5, 7, and chunk-3 wiring together.
- **Seasoned-profile path** (seeded data): hero goes straight to quick-log in 2 taps; Dashboard summary card matches active weekend; collapsed sections persist across reload; sort order active-first â€” **RUNTIME, NEEDS-DATA (seeded)**.
- Delete via â‹¯ on a session: UNDO restores; expiry â†’ exactly one cloud delete (network tab) â€” **RUNTIME**.
- Service chip â†’ log with cost â†’ both service + accounting records exist; UNDO removes both â€” **RUNTIME, NEEDS-DATA (component near/over service interval)**.
- Empty states render with CTAs on a profile with a car but nothing else â€” **RUNTIME**.

---

## OWNER REVISION — 2026-07-13 (CURRENT AUTHORITY)

Original seven-chunk plan below remains implementation history. Current remaining order:

1. **Chunk 6A — setup/measurement refinement.** Blank setup defaults: 500 lb each corner, 17 in Ride Height C-to-C, 10 PSI, LF/RF caster 3, LF camber 4, RF camber -4. Move complete four-bar block to setup bottom. LR and RR each show Top Bar and Bottom Bar with Frame Hole → Length → Birdcage Hole and Ride Height Angle → Full Droop Angle. Tires show last pressure, cycles, estimated laps. User-facing Shock Session becomes Load Session; new load sessions accept optional Ride Height C-to-C. Keep existing graph mapping when visual QA confirms decreasing physical height moves lower on screen. Style exposes only Default (existing 1.15) and Large (existing 1.45), without scale captions. Tuning Guide explains High/Medium/Low in plain racer language and removes AFCO/chassis-specific user wording.
2. **Chunk 6B — setup history lifecycle.** Starting weekend creates immutable Baseline plus editable Weekend Setup. All event changes write Weekend Setup and its change log. Finish Weekend button is always visible at page bottom and has no run/race gate. Finish creates immutable Final snapshot, marks weekend finished, clears active-weekend selection, and creates/selects an editable Current Setup copy from Final. Existing weekends/setups migrate through optional fields and safe defaults.

   **Terra build result (`2a941d3`):** implemented and cavecrew-reviewed. Pure harness,
   exact lint baseline, build, live additive migration `20260714020037`, local 390 px
   zero-run lifecycle, dark/light, and draft `6a5599e37111d0563ffaf5f3` pass. Awaiting
   independent SOL QA attempt 1 found three blockers: cross-car new-weekend fallback,
   missing legacy-Finish upgrade, and non-retry-safe partial Finish with duplicate IDs.
   Terra repair `874fecc` now enforces same-car source selection, upgrades legacy
   zero-run weekends, rejects dangling explicit links, and makes partial Finish
   idempotent while preserving lock/history timestamps. Expanded harness, cavecrew,
   exact lint baseline, build, and 390 px draft shell pass. Draft
   `6a55a024d663b44ca4f639c7`. SOL QA attempt 2 found four remaining blockers:
   missing event Setup falls back to selected car in RaceWeekend UI; no-link legacy
   Finish borrows selected-car data; stale Final/Current recovery rows can replace an
   unlocked Weekend Setup; and finished-weekend relationship does not lock an unlocked
   partial-cloud Weekend snapshot. Terra repair 2 `7b58b30` now passes only valid
   event-owned Setup (or null) to RaceWeekend, guards run/quick-adjust UI, uses an
   exact blank for no-link legacy Finish, rebuilds stale Final/Current rows whenever
   Weekend remains unlocked, and adds finished-weekend relationship locks at App/UI
   boundaries while preserving Clone. Expanded harness, cavecrew, exact lint baseline,
   540-module build, `git diff --check`, and draft `6a55a43a8cc5f6b9da612c69`
   shell/console pass. No SQL change. SOL QA attempt 3 PASS: two cavecrew reviews,
   harness, exact lint baseline, 540-module build, diff check, live migration plus
   23/23 mapped-column/RLS/grant checks, and advisor review passed. Lifecycle tables
   remain empty, so no authenticated data fixture exists. C6B closed; C7 unlocked.
3. **Chunk 7 — expanded Quick Adjust.** Spring rate ±25 lb; spring rounds ±0.5; rounds mark corner Ride Height C-to-C for review until user updates it; shock note or bound Load graph; J-Bar frame/pinion ±0.25 in; manual gear. Other changes remain free text. Structured and free-text entries append to Weekend Setup change log and current run adjustments.
   Terra CODE_PASS at `58e4522`: unified App-owned atomic commits, strict event-owned
   Setup plus present-run gate, provenance-bearing exact-once logs, real same-car/corner
   Load Sessions, legacy numeric normalization, and pure mapper round-trip harness.
   No migration. Full build/cloud/mobile/draft gate remains consolidated after C8.
   SOL QA attempt 1 found three blockers: off-grid spring/J-Bar values snap instead of
   receiving exact deltas; raw finished-weekend selection can expose selected-car Setup
   in event UI; stale/deleted runs can render Quick Adjust. Repair returns to Terra;
   C8 remains locked.
   Terra repair `030122c` now applies exact off-grid relative deltas, blocks generic
   Setup for raw invalid/finished weekend selection, and gates run UI on unfinished
   event plus current session-record membership. Expanded focused gates pass; awaiting
   SOL QA attempt 2.
   SOL QA attempt 2 PASS: expanded harness, repair diff, exact lint baseline, and
   cavecrew review pass. C7 closed; C8 unlocked. Full coherent gate remains after C8.
4. **Chunk 8 — Trackers/Maintenance.** Former Chunk 6 plus Service→Maintenance Logs, plain explanation of interval tracking, idempotent Main Checklist task injection at ≥90% interval, and assignment/edit after creation for manual/template/automatic tasks.
5. **Chunk 9 — export/help/final regression.** Former Chunk 7 after all new screens stabilize.

Dependency: 6A → 6B → 7; 6B → 8; 7+8 → 9. Feature builds stay serial. Test once per coherent slice, then consolidated Android/preview regression per completed chunk.

Execution decision (2026-07-13): isolate C6B behind its own migration/sync/lifecycle
gate. Build C7 then C8 serially and consolidate their lint/build/cloud/mobile/draft
verification after both, while retaining focused pure harnesses per chunk. C9 owns the
final full-app regression and final draft. Exact active acceptance lives in
`ralph/CURRENT_TASK.md`.

### CHUNK 5 â€” Setups: corner cards, four-bar quick-adjust, tires, diff
**Goal:** Setups become thumb-operable at the track, with the four-bar/birdcage â€” the owner's most-common trackside adjustment â€” promoted to a first-class, â‰¤1-tap quick-adjust surface (reversed #18).
**Covers:** 16, 17, 18(reversed), 19, 20, 21.

| Task | Spec | Files | Effort | Deps |
|---|---|---|---|---|
| **[18-R] Four-bar/birdcage quick-adjust (PROMINENT)** | New `src/components/FourBarQuickAdjust.tsx` â€” a self-contained panel, glove-first: two corner cards **LR** and **RR**, each with four `<NumberStepper>` rows: **Bar length** (step 0.25in or existing unit â€” read current field types from `types.ts`/`setupCompat.ts` and match), **Frame hole** (step 1, integer), **Birdcage hole** (step 1, integer), **Bar angle** (step 0.5Â°). Values read/write the active setup's existing four-bar fields directly (dual-write via existing handlers â€” no new persistence path). Each change appends a provenance line to a lightweight change-log (see #19). **Entry points (both â‰¤1 tap):** (a) a prominent card pinned at the TOP of `SetupView` â€” "FOUR-BAR / BIRDCAGE" with current LR/RR values summarized, tap expands inline (not a separate screen, no expander-hiding â€” expanded by default at the track is acceptable via `CollapsibleSection defaultOpen storageKey`); (b) in the quick-log "Changes made" section (chunk 3 placeholder), a "Four-bar" button opening the same component in a BottomSheet against the active setup, so bar changes made between runs get captured in-flow. Acceptance: from Setups tab, adjusting RR birdcage hole = 1 tap (already visible) + stepper taps; from quick-log, â‰¤2 taps; both surfaces show identical live values (same state source). | New: `src/components/FourBarQuickAdjust.tsx`. Modify: `src/components/SetupView.tsx`, `src/components/RaceWeekendView.tsx` (mount in changes section), `src/App.tsx` only if setup handlers aren't already passed to RaceWeekendView (wiring lines). | Med | NumberStepper (C1), C3 quick-log |
| **[17] Corner cards + steppers** | Rework SetupView's per-corner numeric entry into a 2Ã—2 corner-card grid (LF/RF/LR/RR, matching physical car orientation â€” left column = left side) per setup section (weights/heights, pressures, springs, shocks â€” mirror the existing section list). Every numeric field becomes a `<NumberStepper>` with sensible per-field steps (pressure 0.5psi, weight 5lb, height 0.125in â€” derive from field, constants table in `src/lib/setupSteps.ts`). Non-corner scalar fields (e.g., gear, stagger) keep single-row steppers. Acceptance: no raw `<input type=number>` remains for corner values; steps table lives in one lib file. | New: `src/lib/setupSteps.ts` (step/unit constants per field). Modify: `src/components/SetupView.tsx`. | Med | NumberStepper (C1) |
| **[16] Copy-last-setup default** | Creating a new setup defaults to **cloning the active car's most recent setup** (by date/updated), name auto-suggested ("Eldora 7/12 â€” from Cedar Lake 7/5"). Toast: *"Copied from Cedar Lake 7/5"*. Explicit secondary "Start blank" option. Clone logic = pure helper `cloneSetup(prev, overrides)` in `src/lib/setupCompat.ts` (compat file already owns setup-shape knowledge). Acceptance: default path never presents an all-zeros setup when a prior one exists. | Modify: `src/lib/setupCompat.ts`, `src/components/SetupView.tsx`. | Low | â€” |
| **[19] Pressure propagation toast + provenance** | Wherever pressures auto-carry (setupâ†’session prefill per #11, copy-last per #16, four-bar/pressure edits from quick-log per #18-R), show an info toast naming the source (*"Pressures carried from Heat 1"*) and store a provenance string on the receiving record (optional field `sourceNote?: string` on the relevant types â€” types.ts only). Display provenance as a small caption where the values render. Acceptance: every auto-filled pressure block shows where it came from. | Modify: `src/types.ts` (optional field), `src/lib/sessionSequence.ts`, `src/lib/setupCompat.ts`, render sites in `SetupView.tsx`/`RaceWeekendView.tsx`. | Low | 11, 16 |
| **[20] Setup diff entry points** | â‹¯ menu on each setup card gains **"Compareâ€¦"** â†’ opens `SetupDiffView` pre-selected: this setup vs the car's previous setup (default), both slots editable. Session cards (Sessions tab) with an associated setup get the same entry. Requires `SetupDiffView` to accept `initialA/initialB` props (check current signature; add optional props, keep existing standalone behavior). Acceptance: 2 taps from a setup card to a rendered diff. | Modify: `src/components/SetupDiffView.tsx` (optional props), `src/components/SetupView.tsx`, `src/components/RaceWeekendView.tsx`. | Low | 8 (â‹¯ pattern) |
| **[21] Tires sub-view in Setups** | Add a segmented sub-view toggle at the top of SetupView: **Setup | Tires**. Tires view surfaces `tireHistory.ts` data for the active car: current tire set (sizes, compounds, stagger computed), pressure history per corner (last 5 sessions, small table, `font-mono`), and tire log entries. Read-mostly; edits happen through existing tire fields. Empty state via `<EmptyState>`. Acceptance: stagger and pressure history visible without leaving Setups; no new persistence â€” renders from existing `tireHistory` helpers. | New: `src/components/TiresSubView.tsx`. Modify: `src/components/SetupView.tsx` (sub-toggle + mount). | Med | tireHistory (existing) |

**Consolidated QA â€” Chunk 5** (one pass, seeded car with â‰¥2 setups + sessions):
- **Final 2026-07-13:** PASS at `d5ef1f4`. Both pure harnesses, exact three-error
  lint baseline, 539-module build, cavecrew final review, Netlify draft, and
  Android 320 CSS px / XX-Large quick-log/four-bar/Tires drills passed. Final
  draft: `https://6a5509763fc2865568212af7--crew-chief-race-notes.netlify.app`.
- Grep: no `input type="number"` left for corner fields in SetupView; step constants only in `setupSteps.ts`; new types are optional fields only (backward-compatible with synced data) â€” **CODE-VERIFIABLE**.
- `setupCompat` round-trip: clone an old-shape setup fixture through `cloneSetup`, confirm no field loss (scratch harness) â€” **CODE-VERIFIABLE (harness)**.
- Trackside four-bar drill: Setups tab â†’ RR birdcage +1 hole via stepper â†’ value persists, provenance/change line recorded â†’ open quick-log â†’ Changes â†’ Four-bar sheet shows the SAME value â†’ LR angle âˆ’0.5Â° â†’ both surfaces agree after close â€” **RUNTIME, NEEDS-DATA (active setup with four-bar fields)**.
- New setup defaults to clone-with-toast; "Start blank" still works â€” **RUNTIME**.
- Pref-fill provenance captions visible on a #11-prefilled session â€” **RUNTIME**.
- Compare from setup card â‹¯ â†’ diff renders correct pair â€” **RUNTIME, NEEDS-DATA (2 setups)**.
- Tires sub-view: stagger math matches hand calc; history shows last sessions; empty state on a tire-less car â€” **RUNTIME, NEEDS-DATA (tire history)**.
- Gloved-ergonomics spot check: all steppers hit â‰¥48px, long-press repeat works, xxlarge zoom doesn't clip corner cards â€” **RUNTIME**.

---

### CHUNK 6 â€” Trackers: hybrid checklist, templates merge, accounting speed
**Goal:** The Main Checklist becomes the weekend reset ritual (core items) plus a scratchpad (ad-hoc), with big tap targets; Templates stop being a separate tab; accounting entry gets faster.
**Covers:** 22, 23, 24, 26.

| Task | Spec | Files | Effort | Deps |
|---|---|---|---|---|
| **[23] Hybrid checklist model (core + ad-hoc)** | **Data model:** add `kind: 'core' | 'adhoc'` to the checklist-item type in `types.ts` (default `'core'`; migration: `materializeMainChecklist` stamps `kind:'core'` on template-derived items; any existing items without `kind` are treated as `'core'` at read time â€” no destructive migration). Items added by the user directly on the checklist (not via template) are `'adhoc'`. **Reset flow** in `mainChecklist.ts`: `resetMainChecklist(items, { keepAdhoc: boolean })` â†’ unchecks all core items and re-materializes any core template items that were deleted; ad-hoc items: `keepAdhoc: true` â†’ kept in list but unchecked; `false` â†’ removed. **UI:** "Reset for new weekend" button at the top of the checklist opens a confirm sheet: *"Reset the checklist for [next weekend]? Core items will be unchecked."* + toggle row **"Keep my added items"** (default ON, remembered in localStorage). Ad-hoc items get a subtle visual tag (small "+" glyph or `text-on-surface-variant` label). Acceptance: reset never touches core item definitions; ad-hoc add â†’ reset(keep) â†’ item survives unchecked; reset(clear) â†’ gone. | Modify: `src/types.ts`, `src/lib/mainChecklist.ts`, `src/lib/checklists.ts` (if item CRUD lives there), `src/components/TrackersView.tsx` / `ToDoView`. | Low-Med | â€” |
| **[24] Big row-tap checklist (ergonomics only)** | Entire checklist row is the toggle target (â‰¥56px rows), checkbox becomes a visual indicator only; checked rows show strikethrough + dim. Row â‹¯ (or long-press) for edit/delete (delete uses undo pattern). **Dropped per owner:** no assignment-based "mine-first" sorting â€” keep existing order (core template order first, ad-hoc appended). | Modify: `ToDoView` (within `TrackersView.tsx` or its own file â€” Glob for `ToDoView`). | Trivial-Low | 23, undo (C1) |
| **[22] Merge Templates into Checklist sub-tab** | Remove `TemplatesTab` as a top-level Trackers tab. Checklist screen gains a compact header action **"Edit list"** (or segmented `Checklist | Manage`) hosting the former Templates UI: template items = the **core** item definitions (this is now literally the core-item editor for #23, which makes the merge natural). Trackers top-level tabs become: **Checklist Â· Service Â· Accounting** (+ Smasher Loads if currently a tab â€” leave untouched). All existing template CRUD preserved, just relocated. Acceptance: no Templates top-level tab; editing a template item updates what the next reset materializes. | Modify: `src/components/TrackersView.tsx`. | Low | 23 |
| **[26] Accounting defaults + recents** | New-entry form: date defaults to **today**; category defaults to **last used**; below the amount field, a chip row of the 5 most recent distinct description/category pairs â€” tap fills description+category (amount left for entry, keypad-friendly `inputMode="decimal"`). Recents derived from existing entries at render (no new storage). Auto-entries from #25 appear here with their "Maintenance" category. Acceptance: repeat expense (pit pass, fuel, tires) loggable in â‰¤4 taps + amount. | Modify: `src/components/TrackersView.tsx` (AccountingTab). | Trivial | â€” |

**Consolidated QA â€” Chunk 6** (one pass):
- Grep: `kind` field optional/backward-compatible; no top-level Templates tab reference; `resetMainChecklist` unit-checked via harness with 4 fixtures (all-core / mixed keep / mixed clear / deleted-core-item re-materializes) â€” **CODE-VERIFIABLE (harness)**.
- Weekend-reset ritual walkthrough: check off half the core list, add 2 ad-hoc items ("borrow spare bead-lock", "pay pit stall"), check one â†’ Reset with keep-ON â†’ core all unchecked, ad-hoc present + unchecked â†’ Reset with keep-OFF â†’ ad-hoc gone â€” **RUNTIME, NEEDS-DATA (materialized checklist)**.
- Row-tap toggling with fat-finger taps anywhere on the row; xxlarge zoom rows don't collapse â€” **RUNTIME**.
- Edit list (former Templates): add a core item â†’ reset â†’ it materializes â€” **RUNTIME**.
- Accounting: recents chips appear after 2 entries; defaults correct; #25 auto-entry visible with category Maintenance â€” **RUNTIME, NEEDS-DATA (existing entries)**.
- Sync round-trip: checklist with `kind` fields pushes/pulls without error on a signed-in account (confirms `sync.ts` tolerates the new field; if column mapping is strict, add field in `sync.ts` mappers â€” sync changes stay in `sync.ts`) â€” **RUNTIME, NEEDS-DATA (auth)**.

---

### CHUNK 7 â€” Export, contextual help, copy audit, final polish sweep
**Goal:** Close out sharing, help, and language; run the whole-app polish/regression sweep that validates the cumulative result.
**Covers:** 35, 36, 30, 34 (QA half).

| Task | Spec | Files | Effort | Deps |
|---|---|---|---|---|
| **[35] Share weekend/setup PDF from the card** | Extract the PDF-generation logic currently inside `ExportView` into `src/lib/exportPdf.ts` (pure: takes weekend/setup + related data, returns a `Blob`/`File`). `ExportView` consumes it (behavior unchanged). Add **"Shareâ€¦"** to the â‹¯ menu of weekend cards (Sessions tab) and setup cards (Setups tab): generate PDF â†’ `navigator.share({ files: [file], title })`; if `navigator.canShare` fails (desktop) â†’ fall back to blob download. Filename: `crewchief-eldora-2026-07-12.pdf` style. Acceptance: from a weekend card to the Android share sheet in 2 taps; desktop falls back to download; ExportView output byte-identical in structure. | New: `src/lib/exportPdf.ts` (extraction). Modify: `src/components/ExportView.tsx`, `src/components/RaceWeekendView.tsx`, `src/components/SetupView.tsx` (menu items). | Low | 8 (â‹¯ menus) |
| **[36] Contextual "?" help** | Beyond the global top-bar "?" (chunk 2), add contextual "?" icon buttons on complex screens that open `<HelpSheet section=â€¦>` scrolled to the matching QuickRef section: SetupView â†’ setup/gearing reference; four-bar panel â†’ rear-suspension reference; SmasherLoadsView â†’ its reference; Diff view â†’ how-to-read-diffs blurb (add short section to QuickReferenceView if missing). Acceptance: each "?" lands on the relevant section, not the top. | Modify: `src/components/QuickReferenceView.tsx` (anchors/sections), `SetupView.tsx`, `FourBarQuickAdjust.tsx`, `SmasherLoadsView.tsx`, `SetupDiffView.tsx`. | Low | HelpSheet (C1/C2) |
| **[30] Racing-language copy audit** | Single sweep of user-facing strings: replace generic app-speak with racer vocabulary. Method: grep for button/label/toast strings across `src/components` + `App.tsx`; produce a before/after table in the PR. Canon examples: "Add entry"â†’"Log run", "Session created"â†’"Run logged", "Items"â†’"Jobs" (checklist), "Vehicle"â†’"Car", weekend copy uses track names + night language ("race night", "between rounds"). Do NOT rename code identifiers or storage keys â€” display strings only. Acceptance: PR table reviewed; no key/identifier renames (grep storage keys unchanged). | Modify: display strings across component files. | Trivial | all prior copy landed |
| **[34-QA] Font-zoom + glove final sweep** | No new build work â€” this is the app-wide validation half of #34/#31 now that all screens are final. Fix-forward any clipping found (component-local fixes only). | Modify: as found. | Low | all chunks |

**Consolidated QA â€” Chunk 7** (this chunk's pass doubles as the **full-app regression sweep**):
- Grep: no storage-key/identifier renames from the copy audit; `exportPdf.ts` has no React imports; `ExportView` still builds â€” **CODE-VERIFIABLE**.
- Share: weekend card â†’ share sheet on Android emulator; desktop Chrome â†’ file download fallback; PDF opens and contains setup + sessions â€” **RUNTIME, NEEDS-DATA (populated weekend)**.
- Every "?" lands on its section â€” **RUNTIME**.
- **Full regression matrix** (one evening-at-the-track simulation, both themes, zoom standard + xxlarge, online + offline): fresh install â†’ auto car â†’ race-ready card â†’ start weekend â†’ checklist reset â†’ baseline setup (clone) â†’ LOG RUN hero â†’ quick-log with keypad/grid/steppers â†’ four-bar tweak from quick-log â†’ next session auto-suggested â†’ service chip log w/ auto-accounting â†’ share PDF â†’ Android back all the way out. â€” **RUNTIME, NEEDS-DATA (scripted seed profile â€” QA agent should build one seed script/fixture localStorage blob and reuse it)**.
- Light theme in bright-screen conditions: max brightness screenshot review of Dashboard, quick-log, Setups â€” **RUNTIME**.

---

## SEQUENCE & DEPENDENCIES

| # | Chunk | Why here |
|---|---|---|
| 1 | Primitives + hardening | Zero-risk, zero-App.tsx; everything downstream consumes it. |
| 2 | App shell (nav/header/bootstrap) | The single consolidated `App.tsx` pass. Delivers context strip (#6) **before** the Log-Run hero (#7) needs it, tab structure before views move, back-stack before more sheets appear. After this, `App.tsx` is change-frozen except wiring lines. |
| 3 | Sessions/quick-log | #15 is the structural change others lean on: Dashboard hero (#7) deep-links into it; four-bar-in-quick-log (#18-R) mounts inside its "Changes" section; #11 prefill feeds #19 provenance. Must precede chunks 4 and 5. |
| 4 | Dashboard/onboarding | Consumes #15's `initialAction` deep-link and #5 auto-activate; establishes the â‹¯+undo pattern reused in chunks 5â€“7. |
| 5 | Setups/four-bar | Needs quick-log (C3) for the second four-bar entry point and NumberStepper (C1). Feeds nothing later except a "?" hook. |
| 6 | Trackers/checklist | Independent of 3â€“5 (could swap with 5 if staffing allows parallel agents in worktrees; only shared surface is the undo primitive and TrackersView empty-states from C4 #3 â€” coordinate on `TrackersView.tsx`). |
| 7 | Export/help/copy + regression | Copy audit and app-wide zoom sweep only make sense last; â‹¯ menus (C4/C5) must exist for Share entries. |

**Cross-chunk dependency summary:** C1 â†’ everything; C2#6 â†’ C4#7; C2#5 â†’ C4#7; C3#15 â†’ C4#7/#9 and C5#18-R; C3#11 â†’ C5#19; C4#8 (â‹¯ pattern) â†’ C5#20 and C7#35; C6#23 â†’ C6#22/#24.

---

## SHARED PRIMITIVES

| Primitive | File | Built in | Consumed by (recs) |
|---|---|---|---|
| `NumberStepper` | `src/components/ui/NumberStepper.tsx` | C1 | 17, 18-R, 14 (pressures/temps), 26 (amounts optional) |
| `UndoToast` + info variant + `useUndoableDelete` | `src/components/ui/UndoToast.tsx`, `src/lib/undo.ts` | C1 | 8, 25, 24, 37 (info toast), 5, 16, 19 (info toasts) |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | C1 | 3, 1, 15, 21 |
| `CollapsibleSection` (persisted) | `src/components/ui/CollapsibleSection.tsx` | C1 | 9, 18-R (Setups panel), 29 (expand persistence), 21 |
| `SegmentedGrid` | `src/components/ui/SegmentedGrid.tsx` | C1 | 12 |
| `BottomSheet` (+ back-close hook) | `src/components/ui/BottomSheet.tsx`, `src/lib/backStack.ts` | C1/C2 | 6, 13, 25, 27, 36, 2, 8 (â‹¯ menus), 18-R (quick-log mount), 29 |
| `HelpSheet` | `src/components/ui/HelpSheet.tsx` | C1 | 27, 36 |
| `ContextStrip` | `src/components/ContextStrip.tsx` | C2 | 6, 33 (indicator host), 37 |
| `FourBarQuickAdjust` | `src/components/FourBarQuickAdjust.tsx` | C5 | 18-R (two mounts: Setups + quick-log) |
| `LapTimeKeypad` | `src/components/ui/LapTimeKeypad.tsx` | C3 | 13 (any lap-time field app-wide) |
| `sortWeekends` | `src/lib/scope.ts` | C4 | 10 (all weekend lists), 6 |
| `pickAutoWeekend` | `src/lib/scope.ts` | C2 | 5 |
| `suggestNextSession` | `src/lib/sessionSequence.ts` | C3 | 11, 7, 19 |
| `cloneSetup` | `src/lib/setupCompat.ts` | C5 | 16, 19 |
| `setupSteps` constants | `src/lib/setupSteps.ts` | C5 | 17, 18-R |
| `resetMainChecklist` | `src/lib/mainChecklist.ts` | C6 | 23, 22 |
| `saveStatus` pub-sub | `src/lib/saveStatus.ts` | C2 | 33 |
| `exportPdf` | `src/lib/exportPdf.ts` | C7 | 35, ExportView |

**Conventions carried through every chunk:** new types â†’ `src/types.ts` only, as *optional* fields (sync-safe); sync/cloud helpers â†’ `src/lib/sync.ts` only; theme tokens only, no hex; every new collapsible passes `storageKey`; every sheet uses `useBackClosable`; every delete goes through `useUndoableDelete`.

---

## DEFERRED (phase-later)

Parked explicitly per owner answers â€” do not build, but don't design against them:

1. **Mine-first checklist sorting / item assignment (#24 original)** â€” 95% single-user; only the row-tap ergonomics shipped. Revisit if multi-crew usage materializes. The `kind` field on checklist items was designed so an `assignee?` field can be added later without migration.
2. **"Who changed this" attribution (#33 original)** â€” dropped from the saved-state indicator; `saveStatus.ts` is scoped to save/sync/offline only. Provenance strings (#19) intentionally record *what/where*, not *who*.
3. **Concurrency/conflict framing** â€” no conflict UI, no last-writer-wins messaging; current sync behavior unchanged.
4. **Multi-car prominence beyond 2â€“3 cars** â€” car UI is hidden at â‰¤1 car and toast-honest at 2â€“3; no fleet-scale car management is planned.
5. **90-second extreme quick-log** â€” owner wants balance; the quick-log (#14) keeps all sections available (all optional) rather than a stripped mandatory-minimum mode. A future "hot-lap mode" that hides sections 5â€“7 is a natural later toggle if trackside use demands it.
6. **Four-bar presets/history** ("my heat-race bar settings") â€” the quick-adjust ships with live values + provenance lines only; named presets are an obvious later layer on `FourBarQuickAdjust`.
agentId: a0acfa01f2161550e (use SendMessage with to: 'a0acfa01f2161550e', summary: '<5-10 word recap>' to continue this agent)
<usage>subagent_tokens: 45246
tool_uses: 0
duration_ms: 364081</usage>
