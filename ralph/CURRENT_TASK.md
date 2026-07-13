# Current Task — UX Chunk 5: Trackside Setups

**Status:** COMPLETE — CODE PASS + RUNTIME PASS · feature commit `d5ef1f4`
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Priority:** four-bar/birdcage first. Always prominent. Fast with gloves.

## Routing

- GPT 5.6 SOL High owns plan and QA. GPT 5.6 Terra High owns build.
- QA failures 1–2 return to Terra. Failure 3 transfers build + final QA to SOL.
- Runtime `turn_context.payload.model` is model authority.
- Use `/caveman full`. Cavecrew only for bounded tracing/review.
- Preserve all committed UX-R1 behavior: banner, light contrast, 12px floor,
  Tuning Guide, starter convergence, local icon font/PWA precache, zoom-safe shell/nav.

## Goal

Make Setups thumb-operable at track. Promote existing LR/RR four-bar and
birdcage values to an always-visible quick-adjust surface. Add safe numeric
steppers, same-car copy-last creation, setup-card/session diff entry, pressure
provenance, and useful tire summary/history. Keep local-first/cloud behavior and
active-car isolation exact.

## Settled current-code facts

- `SetupView` already has four controls: Setups, Loads, Tires, Compare. Tires is
  already a rich active-car-filtered inventory/usage view. Do not add a redundant
  `Setup | Tires` toggle or remove Loads/Compare.
- `CornerForm` is four serial full-width cards. Values are strings. Rear
  four-bar data already exists: top/bottom length, frame hole, birdcage hole,
  top angle, bottom angle. RR top angle uses `topBarAngRH`; LR uses
  `topBarAngFD`.
- `NumberStepper` consumes `number | ''`; adapters are required. Stored setup
  strings remain strings. Legacy strings such as `Hole 3`, `12°`, fractions,
  and empty values must not be destroyed by render.
- `SetupView.onSaveSetups` → App is current full-array dual-write/cloud seam.
  Reuse/centralize it. Do not add component-local persistence.
- Current new-setup path can clone a foreign/global setup, can leave a new
  second-car setup inactive, and uses array position instead of a same-car
  recency rule. Fix all three.
- `RaceWeekendView` receives full tires/setups but no setup mutation callback.
  Its Changes section has a disabled Chunk-5 four-bar placeholder.
- App car switching does not select that car's setup. Current session creation
  can therefore use a foreign setup. Fix before quick-adjust wiring.
- `SetupDiffView` has no initial IDs. Setup cards expose Share/Clone/Delete
  icon actions; global Compare already exists. Preserve those actions.
- No provenance fields exist. Session payloads and setup corners already live in
  JSONB, so optional fields can round-trip without schema work.
- No-car Add Tire/New Smasher actions still use disabled prerequisite UI.

## Required build

### 1. Pure setup compatibility and step contracts

In `src/lib/setupCompat.ts`:

- Keep legacy `load` → `loadWeight` normalization unchanged.
- Add pure `pickLatestSetupForCar(setups, carId)` (exact name may vary only if
  exported names stay clear). Filter strictly to `setup.carId === carId`.
  Never fall back to another car or `setups[0]`.
- Recency rule: parse valid `setup.date`; newest wins. When dates are equal or
  unparseable, preserve master-array recency (lower index is newer), then use ID
  as deterministic final tie-break. Do not add `Setup.updatedAt`; current domain
  does not retain it.
- Add pure `cloneSetup(source, overrides)` using a real deep copy. Preserve all
  same-car fields, photos policy, corner fields, and same-car tire inventory IDs.
  Never mutate source. New ID/date/name/carId come from overrides. Cross-car copy
  is not a valid default path; if helper is called cross-car, clear all four
  `tireInventoryId` values.
- Add pure blank-setup factory from `INITIAL_SETUP` semantics if useful. It must
  stamp current car and never reuse another car's values.

In new `src/lib/setupSteps.ts`:

- Centralize step/unit/decimal metadata and numeric string adapters.
- Required numeric contracts:
  - `loadWeight`: 5 lb, 0 decimals
  - `loadCtoC`, `springHeight`, `droop`, `preload`: 0.125 in, 3 decimals
  - `caster`, `camber`, `topBarAngRH`, `topBarAngFD`, `bottomBarAngle`: 0.5°, 1 decimal
  - `tirePress`: 0.5 psi, 1 decimal
  - `backspacing`: 0.25 in, 2 decimals
  - `topBarLength`, `bottomBarLength`: 0.25 in, 2 decimals
  - `topBarHFrame`, `topBarHBird`, `botBarHFrame`, `botBarHBird`: 1 hole, 0 decimals, minimum 0
- Parsing may extract one numeric token from legacy unit text. Rendering alone
  must not rewrite stored bytes. First user edit writes a canonical numeric
  string; empty stays empty. Unparseable non-empty legacy text stays visible in
  a caption/fallback until user deliberately edits it; never coerce silently to 0.
- Keep free-text inputs for spring/shock identifiers, tire compound, fractional
  tire size, toe, chassis, track, notes, and other genuinely nonnumeric values.

### 2. Active-car setup invariant and one save seam

In `src/App.tsx`:

- Extract one canonical full-array setup save handler used by `SetupView` and
  quick-log. Order: React `savedSetups` → `race_notes_saved_setups` → when an
  active ID is supplied, `setup` + `race_notes_setup` → signed-in
  `pushSetups(fullMasterArray, user.id, setSyncStatus)`.
- Never push only the displayed active-car subset.
- On car switch, select/persist that car's latest saved setup when one exists.
  If none exists, no session/four-bar/tire code may read the previous car's
  setup. Do not invent or push a saved setup merely by switching cars.
- New first setup for any car becomes active, even when other cars already have
  setups.
- Quick-log and Setups must resolve the same current-car active setup. A foreign
  weekend-bound setup cannot override active-car isolation.
- Thread only minimal props: current setup, canonical save/update callback,
  info-toast callback, and Garage teaching navigation.
- Current setup edits propagate pressures to the active session only when
  pressure values actually changed or a setup was deliberately activated.
  Metadata/four-bar edits must not rewrite pressure blocks or emit pressure toast.

### 3. Prominent four-bar/birdcage quick-adjust

Create `src/components/FourBarQuickAdjust.tsx`.

- Controlled component only: receives one `Setup`, change callback, optional
  compact/sheet mode, and optional disabled reason. No own setup state,
  localStorage, cloud calls, or cloned setup object.
- Render LR and RR cards. Expose all existing top and bottom bar values:
  length, frame hole, birdcage hole, and angle. Use correct LR Full Droop and RR
  Ride Height labels. Use `NumberStepper` + `setupSteps` adapters.
- Setups entry: mount at top of Setups sub-view, before create form and setup
  accordion. Exact heading `FOUR-BAR / BIRDCAGE`. Keep controls always visible;
  no collapsed default, hidden expander, separate screen, or saved collapsed
  state. RR birdcage stepper must be reachable immediately after opening Setups.
- Remove duplicate rear four-bar fields from ordinary corner forms after this
  component becomes canonical. Other rear fields remain.
- Quick-log entry: replace disabled placeholder in Changes Made with enabled
  `Four-bar quick-adjust` action. One tap opens existing `BottomSheet` containing
  the same component instance contract and same setup object.
- Each quick-log change updates the setup through App's canonical save seam and
  upserts one stable `SetupAdjustment` line keyed by corner+field. Long-press or
  repeated stepper taps update that line; do not flood session changes with one
  row per tick. Example: `RR top birdcage: hole 2 → 3`.
- Quick-log setup update must also flow through `handleUpdateSession`, preserving
  active-session localStorage/cloud plus the matching weekend session record.
- Setups-surface baseline edits do not fabricate a run adjustment when no
  quick-log action occurred.

### 4. Physical corner cards and numeric steppers

In `src/components/SetupView.tsx`:

- Keep existing four corner semantics and tire uniqueness.
- Render LF/RF/LR/RR as a physical 2×2 grid: row 1 LF/RF, row 2 LR/RR; left
  column is car left. DOM order must be LF, RF, LR, RR.
- Cards may use one internal column at narrow width. No fixed content height.
  Labels and values wrap safely at 320×800 XX-Large.
- Replace every truly numeric corner text field listed in `setupSteps.ts` with
  `NumberStepper`. Keep string storage adapters. No raw `type="number"` or plain
  numeric text input remains for those fields.
- Preserve calculated stagger, weight percentages, inventory selection,
  attachments, legacy load compatibility, and autosave behavior.
- Do not turn tire size into a numeric-only control: `86 1/2` must still work.

### 5. Same-car copy-last creation

In `SetupView` using `setupCompat` helpers:

- With a prior active-car setup, primary create path copies latest same-car
  setup. Suggested name identifies source track/date. User name override stays
  supported. Show info toast `Copied from <source>`.
- Add explicit secondary `Start blank` action. With no active-car setup, blank
  baseline is primary; no foreign fallback.
- Always activate and expand new setup. Preserve full master array and other
  cars byte-for-byte.
- Same-car copy preserves current physical tire links by design. No cross-car
  copy occurs. Cross-car helper safety still clears links.
- Stamp copied corner pressure provenance (below); keep source setup unchanged.

### 6. Pressure provenance without migration

In `src/types.ts`, add only these backward-compatible optional fields:

- `CornerSetup.pressureSourceNote?: string`
- `ActiveSession.pressureSourceNote?: string`
- `SessionRecord.pressureSourceNote?: string`

No other domain type addition. No required field. No migration.

Behavior:

- Copy-last stamps each receiving corner: `Copied from <setup label>` and shows
  a small semantic-token caption below its pressure control.
- `suggestNextSession` includes a pressure source only when it actually carries
  pressures from the latest compatible session. App threads it into both active
  and saved session records. Caption: `Pressures carried from <session>`.
- When session pressures come from active setup baseline instead, caption names
  that setup. Do not claim a source when values are defaults/blank.
- Show one info toast when a pressure block is auto-filled, not on every render
  or unrelated setup edit.
- Manual pressure edit may replace source caption with `Adjusted in this run`;
  it must not keep a false carried-from label.
- JSONB persistence paths already carry these fields: corners in setup JSONB,
  sessions in `race_weekends.sessions`, active session in `active_sessions.data`.
  Update App's active→saved session copy so the optional field is not dropped.
  `src/lib/sync.ts` must not change.

### 7. Setup diff entry points

- Extend `SetupDiffView` with optional `initialAId`/`initialBId`; validate IDs
  against supplied setup list, fall back to current standalone defaults, and
  keep both selectors editable.
- Keep global Compare control.
- Add Compare to each setup card's existing action cluster; do not rebuild
  Share/Clone/Delete into a new menu. Open with selected setup versus previous
  same-car setup from the pure recency helper. If no previous setup, disable or
  explain; never compare across cars.
- Add Compare to session card action sheet only when a same-car associated setup
  can be resolved from `setupUsed`/current weekend. Preselect that setup versus
  previous same-car setup. Missing/ambiguous legacy association means no action,
  not a guessed foreign comparison.
- Target: rendered diff in at most two taps from either card.

### 8. Tires sub-view: augment, do not duplicate

Create `src/components/TiresSubView.tsx` by extracting the existing Tires-tab UI
from `SetupView`, then add summary/history. Preserve existing inventory CRUD,
sort/filter, lifecycle, usage expansion, CSV/report, compound quick-picks, and
delete-cloud callback.

- Controlled props receive full master tire array, active car ID, active setup,
  saved setups, weekends, save callback, and delete callback.
- Filter for display only. Add/delete/edit must reconstruct and pass the full
  master array. Never overwrite another car's tires with the displayed subset.
- Current tire-set summary uses active same-car setup: four corner tire number
  when linked, size, compound, pressure; front/rear stagger from current tire
  sizes. Do not add persistence.
- Extend pure `src/lib/tireHistory.ts` with last-five pressure history per corner.
  Car inclusion requires active-car evidence: matching setup association or a
  session tire ID belonging to active-car inventory. Exclude unresolved/foreign
  sessions. Sort newest first deterministically; return maximum five per corner.
- Keep current Setups/Loads/Tires/Compare header. Do not add another segmented
  toggle.
- Replace no-car Add Tire and New Smasher disabled walls with `EmptyState`
  teaching content and working `Go to Garage` action. Modify
  `SmasherLoadsView.tsx` only for this bounded no-car flow.

## Exact file scope

### Existing production files allowed

- `src/App.tsx`
- `src/types.ts` — only three optional provenance fields above
- `src/components/SetupView.tsx`
- `src/components/RaceWeekendView.tsx`
- `src/components/SetupDiffView.tsx`
- `src/components/SmasherLoadsView.tsx` — no-car teaching flow only
- `src/lib/setupCompat.ts`
- `src/lib/sessionSequence.ts`
- `src/lib/tireHistory.ts`

### New production files required

- `src/components/FourBarQuickAdjust.tsx`
- `src/components/TiresSubView.tsx`
- `src/lib/setupSteps.ts`

### New harnesses required

- `scripts/chunk5-setup-harness.ts`
- `scripts/chunk5-tires-harness.ts`

No other product file without planner approval. In particular: no dependency,
`vite.config.ts`, service worker, `src/index.css`, `src/lib/sync.ts`, migration,
Supabase, Tuning Guide, Dashboard, nav, or native Android source edits.

## Pure harness contracts

Run offline; fail nonzero.

`npx tsx scripts/chunk5-setup-harness.ts`

- Legacy `load` normalization retains every field.
- Recent selection: two cars, mixed valid/invalid/equal dates, reordered input,
  deterministic tie-break, no foreign fallback.
- Clone is deep, source unchanged, all nested fields retained, same-car tire IDs
  retained, cross-car tire IDs cleared, new first setup activation contract.
- Blank factory contains no source/foreign values.
- Numeric adapters cover empty, decimals, negatives where valid, `Hole 3`, unit
  suffixes, garbage preservation, step rounding, and no render-time rewrite.
- Four-bar stable adjustment key/label helper coalesces repeated changes.

`npx tsx scripts/chunk5-tires-harness.ts`

- Current-set stagger handles decimal and fractional sizes.
- Last-five pressure history orders correctly, caps five per corner, retains
  labels, and excludes other-car/unresolved sessions.
- Missing pressures/tires/setup associations do not crash.
- Master-array tire update preserves another car's rows byte-for-byte.
- Pressure prefill source: compatible prior session, active setup baseline,
  manual edit clearing stale source, and no-source blank/default path.

## Code gates

1. Both harnesses PASS.
2. `npm run lint` reports exactly three known baseline TypeScript errors; no new
   error. Record exact messages, not stale line numbers.
3. `npm run build` succeeds in v3 with `.env` + `.env.local` present.
4. Static scan proves:
   - only allowed files changed;
   - no new raw hex in touched components;
   - no `src/lib/sync.ts`, migration, dependency, CSS, PWA, or nav change;
   - no duplicate ordinary-corner four-bar controls;
   - `FOUR-BAR / BIRDCAGE` precedes create form/accordion;
   - quick-log placeholder/`coming soon` removed;
   - Setups/Loads/Tires/Compare controls preserved;
   - active-car filtering occurs before quick-log setup/tire use;
   - tire save path receives full master array.

## Runtime acceptance matrix

Seed: car A with 2+ dated setups, linked tires, and 6+ sessions; car B with one
setup and separate tires; car C with none. Test web draft and Android 320×800.

For every critical Setups/quick-log view: dark + light × Standard/Large/X-Large/
XX-Large. No page horizontal overflow, clipped header/nav, clipped labels,
overlap, hidden action, or sub-12px essential text.

Required drills:

1. Open Setups → `FOUR-BAR / BIRDCAGE` already visible → RR top birdcage +1.
   Reload offline: value persists. Long-press repeat works; no adjustment spam.
2. Open quick-log → Changes → Four-bar → LR angle −0.5°. Sheet and Setups show
   identical live value. One coalesced run adjustment persists in session card.
3. Switch A→B→C. Current setup/tire/four-bar never leaks across cars. C shows
   teaching state. Create C baseline: it activates immediately.
4. Copy-last on A chooses actual newest A setup, deep-copies it, shows toast and
   pressure captions. Start blank remains blank. Other cars unchanged.
5. Corner grid orientation LF/RF then LR/RR. Fractional tire size still accepts
   `86 1/2`. Weight/stagger calculations remain correct.
6. Session creation with prior compatible session shows prior-session pressure
   provenance. Without it, same-car setup source appears. Manual pressure edit
   clears false carry label. Unrelated metadata/four-bar edit emits no pressure
   toast and changes no pressure.
7. Setup-card Compare opens selected vs prior same-car setup. Session-card Compare
   does same when association is exact. Both selectors remain editable.
8. Tires keeps inventory CRUD/exports/usage. Current set and stagger match setup;
   last-five history matches hand count. Tireless car gets useful empty state.
9. Offline edits survive hard reload. Sign in/reconnect pushes full arrays; pull
   converges without losing other-car rows or optional provenance.
10. Five bottom tabs, named Tuning Guide, local offline icons, banner, and UX-R1
    starter behavior remain intact.

## Preview + Android bridge

After code gates, deploy Netlify draft only when coordinator authorizes runtime
QA. Hard-refresh/incognito; production untouched.

Android uses v3-dist-to-main bridge only:

1. Build v3 `dist`.
2. Mirror v3 `dist` to `C:\Users\maxx\antigravity\Race-Notes\dist`.
3. In main tree, re-check and bump gitignored
   `android/app/build.gradle` versionCode/versionName for installable QA build.
4. Run raw `npx cap sync android` in main. Never run main
   `npm run android:sync`; it would rebuild master over v3 assets.
5. Set JDK 21; run `android\gradlew.bat -p android assembleDebug`.
6. Clear app data/PWA cache, install, run 320×800 matrix + cold offline icon
   launch. Record APK path/version. Do not copy release artifacts to Drive unless
   owner asks.

## Explicit non-goals

- No four-bar presets/history, tuning recommendations, or chassis advice.
- No new setup/tire/session table or migration.
- No new required type, router, tab, state store, context, dependency, or service.
- No setup delete/Undo redesign, PDF/share work, Help anchor work, Trackers Chunk
  6 work, copy-audit sweep, or broad style refactor.
- No tire lifecycle schema change or guessed cross-car session association.
- No production deploy, branch merge, commit, or push unless coordinator/owner
  explicitly starts that separate action.

## Builder report

Report exact files changed; harness outputs; exact lint baseline; build output;
static-scan results; same-car/offline/cloud evidence; runtime matrix; draft URL
and Android APK/version only if those stages were authorized. Do not edit Ralph
QA verdict/status.

### Final report — 2026-07-13

- Real model handoff ran in one persistent Codex task: GPT 5.6 SOL High plan/QA,
  GPT 5.6 Terra High implementation/fixes, then GPT 5.6 SOL High takeover after
  the third QA failure and final `CODE_PASS` adjudication.
- Added canonical setup save/scoping, same-car latest/copy/blank helpers, numeric
  adapters/steps, pressure provenance, setup/session diff entry, prominent shared
  four-bar quick-adjust, 2×2 physical corner layout, and active-car Tires view.
- Quick-log four-bar changes use the canonical setup writer plus serialized
  session update and one stable corner+field adjustment row.
- `CHUNK5_SETUP_HARNESS PASS`; `CHUNK5_TIRES_HARNESS PASS`.
- `npm run lint`: exact three known baseline errors only (two upload
  `unknown`→`File`; one React `key`/`CornerFormProps`). No new TypeScript error.
- `npm run build`: PASS, 539 modules; Workbox precache 16 entries.
- `git diff --check`: PASS. No migration, dependency, sync, CSS, PWA, nav,
  Tuning Guide, Dashboard, or production change.
- Netlify final draft deploy `6a5509763fc2865568212af7`:
  `https://6a5509763fc2865568212af7--crew-chief-race-notes.netlify.app`.
  Public shell/auth gate loaded; authenticated browser feature QA was unavailable
  on the draft origin without credentials. Production stayed untouched.
- Android debug 4.1 (16) built/installed from v3 in the isolated worktree. Real
  WebView QA at 320 CSS px / XX-Large passed current packaged assets after
  targeted HTTP/service-worker cache removal while preserving localStorage.
  Verified baseline creation, FOUR-BAR/BIRDCAGE visibility, stepper mutation,
  Tires current-set/inventory/form geometry, quick-log sheet, one coalesced
  adjustment line across repeated taps, Save Run, cold relaunch, and zero fatal
  logcat errors.
- Cavecrew investigators traced scope/data hazards; cavecrew reviewer performed
  independent pre-fix and final diff reviews. Final review caught and closed a
  blank setup-pressure import data-loss path; its behavioral harness now proves
  blank/divergent preservation and real-pressure replacement. Android/Web runtime
  caught stale service-worker assets and confirmed the corrected cold-cache path.
