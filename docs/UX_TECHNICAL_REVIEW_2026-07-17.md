# CREW CHIEF — Mobile Density, Persistence Semantics, and Deletion Integrity Review — **v2**
**Independent UX/Technical Review — 2026-07-17 (v2, incorporating round-2 owner feedback of the same date)**
**Scope:** Analysis and specification only. No feature code was edited, no build/deploy/migrate/merge/push was performed.
**Branch under review:** `codex/hide-scrollbars` @ `ab6b98a`, plus two documentation commits, unmerged from `master@47db364`.
**Working branch for implementation:** `codex/ux-overhaul` (worktree `.worktrees\ux-overhaul`), branched from the reviewed state at `3331f89` — identical code, new name. All file:line citations in this document remain valid.
**Inputs:** everything from v1 (AGENTS.md, HANDOFF.md, SPRINT_INDEX.md, ralph/STATE.md, ralph/CURRENT_TASK.md, CODEBASE_KNOWLEDGE.md, docs/HANDOFF_MOBILE_DENSITY_REVIEW_2026-07-17.md, 3 owner screenshots, direct source inspection) **plus the owner's round-2 feedback of 2026-07-17** and a second source-inspection pass covering the change-log pipeline (`setupLifecycle.ts`, `quickAdjust.ts`), the clear-data flow (`App.tsx:484-547`), help routing (`helpRouting.ts`), and the four "Add X" form surfaces.
**Owner priority governing every trade-off below:** visibility of information first; readable/operable text and deliberate controls; the app's save/change/delete behavior must match what the user believes happened.

---

## What changed from v1 → v2 (plain-language changelog for the owner)

1. **Padding:** v1 stopped at "shrink the zoom, trim control floors to 44px." Your feedback says that's not enough — v2 adds a real whitespace reduction pass across nearly every component: paddings, gaps, and label text sizes, not just buttons.
2. **Saving:** the app will still write to your phone instantly (nothing is ever lost), but the "Saved" message now only appears when you leave a page/tab or on a quiet ~30-second timer — no more flashing on every keystroke.
3. **The Saved message itself** becomes a small pill at the top of the screen instead of the big one at the bottom.
4. **Setup change log — the big one:** changes are no longer logged per button press. Instead, when you start a new session (hotlaps → qualifying → heat → feature), the app snapshots the setup at that moment and records the *difference* from the previous session. That snapshot is permanently attached to that session. Quick Adjust keeps working exactly as it does; it feeds the same record instead of a second one.
5. **Sessions page** gets one button that takes you to the Setups page to log changes, keeping the sessions page clean. The notes box stays for handling notes.
6. **The "?" help button** on the setup sheet moves to the top of the screen next to the Tuning Guide button, and it stays smart — it still opens the right guide section for what you're looking at.
7. **"Add Car"/"Add Tire" double buttons** get distinct labels: the opener says "Add X," the form's confirm button says "Create X" — everywhere, one convention.
8. **New setups now require a name** (copies still auto-name themselves), and **renaming a setup** becomes possible again plus gets an obvious edit affordance — the rename box already existed; it was locked by the same bug that made everything read-only.
9. **Clear All Data is fixed for real:** we found exactly why your old car and setups came back — on a team account the app wipes the phone but never deletes anything from the cloud, so the next sync re-downloads it all. v2 gives you an honest choice: "clear this device only" or "delete my records everywhere."
10. **The work is now organized into 5 chunks** instead of 10 flat tasks, with light QA inside each chunk and a bigger QA gate at the end of each chunk, plus a new section mapping which fixes must land before which.

---

## Part 1 — Executive Summary

Most of what the owner is experiencing traces back to **three mechanisms**, not twenty-odd separate bugs.

The first (carried from v1, now **validated and extended** by round-2 feedback) is a **scale/floor mismatch**: the app applies a single ancestor CSS `zoom` whose *minimum* value is 1.15 (the `'standard'`/1.0 tier was removed in UXP-4, and `normalizeTheme` collapses every stored value to `'large'` via the ZOOM map at `App.tsx:607-611`), while UXP-14 independently hardcoded ≥48px touch-target floors into SetupView inputs, `.tap-target` steppers, and the header/nav. Those two decisions multiply: on a 360 CSS-px phone, 1.15 zoom leaves ~313px of effective layout width, below what the two-column grids and paired 48px stepper buttons were designed for. The owner's round-2 feedback — "padding is still too much everywhere, including label text" — **confirms v1's diagnosis was right but its remedy was too conservative**. It is not only the zoom and the control floors; the spacing scale itself (`p-4` paddings, `gap-4` gutters, generous label typography) was authored *for* the 1.15 world and must be re-tiered now that 1.0 becomes the default. v2 therefore extends the floor-equalization pass into a full density pass (Part 2, item 2).

The second (carried from v1, unchanged) is the **causal chain from accidental activation through divergent read-only enforcement to dual toast channels**. SetupView's UI gate (`SetupView.tsx:517`) locks not just genuinely historical setups but *every* setup whenever any Race Day has an `activeSetupId` — which makes everything read as historical, disables setup deletion, and (because Garage requires zero scoped records before car delete) produces the car-delete deadlock. Meanwhile a touch landing on a stepper's ± button mutates on `pointerdown` before the browser knows the gesture is a scroll; the blocked mutation still flashes "Saved" unconditionally while the block simultaneously fires a "view-only" info message on a *separate* single-slot channel — the notification bombardment. Round-2 feedback adds a corollary: the locked rename field (`SetupView.tsx:591`, disabled by the same `:517` fieldset) is why the owner believes rename doesn't exist. One chain, one fix (Part 2, item 6).

The third mechanism is new in v2: a **persistence/logging granularity mismatch, and its trust consequences**. The app records and announces at *keystroke/button-press* granularity — `withSetupDiffLog` (`setupLifecycle.ts:73-114`) appends one `SetupChange` per field per call with no coalescing, so live-trackside tuning logs every single button press; `flashSaved` fires on every write; the Saved pill is a large bottom-anchored interruption. The owner thinks — correctly, for racing — at *session* granularity: "this is the setup we started qualifying with, and here's what we changed since hotlaps." The fix is structural, not cosmetic: bind a frozen setup snapshot to each session at creation, derive the change record as a session-over-session diff, kill per-press logging, and move the user-facing "Saved" moment to page-leave plus a periodic timer while keeping the local-first immediate write untouched (Part 2, items 7–8). The same trust story has a deletion-side twin, now root-caused: **Clear All Data on a team-resolved account queues zero cloud deletes** (`App.tsx:484-547` — the `:489` gate deliberately skips team users) **while wiping local state unconditionally** (`:516-547`), so the next resume pull (`App.tsx:1113` → `requestResumePull` `:1306-1324`, 30s cooldown in `resumePull.ts`) re-downloads everything. That is the owner's exact "cleared, created a car, old data came back" symptom — not sync flakiness, a designed-in gap presented dishonestly. It joins v1's zero-row silent-resurrection bug (`sync.ts:23-37`) as one deletion-integrity item (Part 2, item 11).

**What round-2 feedback validates from v1:** the padding complaint validates going further than v1's 44px floors (item 2 is now a full pass); the "old data came back" report validates v1's resurrection-class hunt — the zero-row delete bug was real, and the clear-data flow is a second, larger instance of the same class; the rename complaint validates item 6's diagnosis that the `:517` OR-clause is the single point poisoning the whole setup surface. Nothing in round-2 contradicts a v1 finding; every v1 decision below either stands as written or is explicitly extended.

None of the protected behaviors (dual weekend delete, deferred delete queue, pull throttle, lifecycle immutability semantics, UXN-1 pull-filtering) need to change in *meaning* to fix any of this; the plan reuses them and touches them only where explicitly named — now with **two** bounded exceptions instead of one (Part 5.2).

---

## Part 2 — Numbered Resolution Plan

Sixteen items. Items 1, 3, 4, 5, 10, 12 carry forward from v1 essentially unchanged; items 2, 6, 11, 16 are v1 items extended by round-2 feedback; items 7, 8, 9 (partially), 13, 14, 15 are new. Each item states its lineage.

### 1. Default/Large scale and existing-theme migration *(v1 item 1, unchanged)*

**Current state.** `App.tsx:607-611` maps `theme.fontSize` through `ZOOM = {large: 1.15, xlarge: 1.45}` into `--ui-zoom`, applied as ancestor `zoom` in `index.css:117-131`. `types.ts:484-491` has no 1.0 value; `normalizeTheme` (`App.tsx:70-81`) collapses everything to `'large'`; new-install fallback (`App.tsx:582`) is `'large'`. Settings (`SettingsView.tsx:310-313`, `341-347`) offers only Default(1.15)/Large(1.45) and Reset hardcodes 1.15.

**Decision.** Reintroduce `'standard'` = 1.0 and make it the Default, with **three tiers** in Settings — Default (1.0), Large (1.15), Extra Large (1.45). One-time versioned remap of stored `'large'` → `'standard'` (a stored `'large'` today is indistinguishable from the forced collapse, so it does not represent a choice), preserving `'xlarge'` untouched as a genuine accessibility choice. Theme is localStorage-only, never synced — no cross-device conflict. Reset-to-Defaults targets `'standard'`. Do not stack typography reductions into this change; item 2 measures at 1.0 first.

**Files.** `types.ts:484-491`, `App.tsx:70-81`, `:582`, `:607-611`, `SettingsView.tsx:310-313`, `:341-347`.
**Harness.** `scripts/chunk6a-refinement-harness.ts` byte-locks the two-tier map — rewritten in the same commit (item 16). **LOE: M (4-6h).**

### 2. App-wide density and whitespace reduction pass *(v1 item 2, EXTENDED by owner feedback N1)*

**Current state.** Everything v1 documented still holds: header `py-3` + `min-h-12` + `text-[20px]` icons (`App.tsx:2145-2192`); ContextStrip chips `min-h-12` (`ContextStrip.tsx:39-94`); bottom nav `h-16` with `!important` override (`index.css:143-146`) plus `scale-105` on the active tab; SetupView `INP` `min-h-12` (`SetupView.tsx:59-60`, byte-locked); desktop-oriented `lg:grid-cols-2` corner form; `.tap-target` hard 3rem (`index.css:249-255`); FourBarQuickAdjust's fake `compact` prop; RaceWeekendView freeform inputs with no floor at all (`RaceWeekendView.tsx:~1150-1212`). Round-2 feedback: padding is still excessive on "nearly every element within the app including label text" — the spacing scale, not just the control floors.

**Decision.** v1's floor-equalization survives intact as the *control* half of this item: (a) shared interactive floor 48→44px (`min-h-12`→`min-h-11` on `INP`, header buttons, ContextStrip chips; `.tap-target` 3rem→2.75rem); (b) raise RaceWeekendView freeform inputs *up* to 44px; (c) remove the nav `scale-105`; (d) phone-first `min-[360px]:grid-cols-2` corner form; (e) real `compact` FourBar steppers (single label-inline row per stepper, ± buttons at the 44px floor). Round-2 adds the *container and typography* half — a systematic tier-down pass across every view:

- **Padding tier-down:** container/card `p-4` → `p-3`; inner grouping `p-3` → `p-2`; list rows and chips lose one tier of vertical padding. The rule is mechanical so it is auditable: every padding utility steps down one Tailwind tier unless the element is a ≥44px interactive control at its floor (those are already minimal) or a safe-area/system-inset padding (untouchable).
- **Gap tier-down:** `gap-4`/`space-y-4` between sibling cards → `gap-3`; intra-card `gap-3` → `gap-2`. Grid gutters in the setup corner form and pressure grid go to `gap-2` (item 4's minmax math already assumes this).
- **Label typography:** section labels and field labels drop one step where currently `text-sm`+wide tracking → `text-xs` with tracking kept, and any `text-base` labels → `text-sm`. **Floor: no text below Tailwind `text-xs` (0.75rem), and body/value text never drops below `text-sm`** — the owner's constraint is "still readable," and values (the actual racing data) are information, not chrome; they keep their current size. Line-height tightens (`leading-tight`) on multi-line labels.
- Header/nav heights follow the control-floor rule (44px), not a separate reduction — at 1.0 zoom with `py-2` instead of `py-3` the header already reads dense.

Sequencing is load-bearing: this pass is executed and visually judged **only after item 1 lands**, at zoom 1.0, on the 360×800 viewport first. Judging density at 1.15 caused v1's under-correction; do not repeat it.

**Files.** `App.tsx:2145-2192` + nav markup, `ContextStrip.tsx:39-94`, `SetupView.tsx:59-60` + corner grid + card markup, `index.css:143-146`, `:249-255`, `FourBarQuickAdjust.tsx`, `RaceWeekendView.tsx` (freeform inputs + card paddings), `GarageView.tsx`, `TiresSubView.tsx`, `TrackersView.tsx`, `SettingsView.tsx`, `DashboardView` (padding/gap/label tiers only in the last five).
**Harness.** `scripts/setup-touch-target-harness.ts` converted byte-diff→behavioral (≥44px computed min-height at zoom 1.0; 2 corner-form columns at ≥360px effective width); `chunk5-setup-harness.ts` updated. **LOE: L (10-16h)** — widest blast radius in the plan.

### 3. Non-obscuring Save Run placement *(v1 item 3, unchanged)*

**Current state.** `.sticky-action-bar` (`index.css:266-275`) is correctly `position: sticky; bottom: 0` with safe-area padding, but no space is reserved beneath the scrollable content, so the pressure grid and attachments scroll flush underneath it, and the last content row is additionally sliced by the bottom nav.

**Decision.** Keep it sticky (in-flow placement fails "reachable without unreasonable scroll" on a page this long). Reserve bottom padding on the RaceWeekendView scroll container equal to bar height + safe-area; opaque background + top border; render only while dirty. Separately, global bottom padding `calc(4rem + env(safe-area-inset-bottom))` on the main scroll container fixes content-behind-nav app-wide.

**Files.** `index.css:266-275`, `RaceWeekendView.tsx` (container + conditional render), `App.tsx` main scroll container.
**Harness.** Reservation assertion added to `chunk5-setup-harness.ts`. **LOE: S (2-3h).**

### 4. Collision-free tire-pressure controls *(v1 item 4, unchanged)*

**Current state.** `RaceWeekendView.tsx:1279` hardcodes `grid grid-cols-2 gap-2` with no responsive fallback; NumberStepper's ± buttons are hard 48px `tap-target shrink-0` (`NumberStepper.tsx:130-131`) and the center value/unit is `min-w-0 flex-1` with no overflow handling (`:153`) — the center absorbs all the squeeze, producing the "+/psi" glyph collision.

**Decision.** Replace `grid-cols-2` with `repeat(auto-fit, minmax(10.5rem, 1fr))` — chosen over a media-query breakpoint because media queries evaluate against the viewport, not the zoom-reduced effective width; auto-fit measures actual available space inside the zoomed subtree and degrades to one column automatically at Large/Extra Large. In NumberStepper: value `whitespace-nowrap tabular-nums`, unit as its own `shrink-0` small-text element, buttons adopt the 44px floor from item 2.

**Files.** `RaceWeekendView.tsx:1279`, `NumberStepper.tsx:130-131`, `:153`.
**Harness.** Verify/update any byte-lock covering NumberStepper/`.tap-target`. **LOE: S-M (3-4h).**

### 5. Scroll-safe NumberStepper behavior *(v1 item 5, unchanged)*

**Current state.** No scroll-jacking exists; the real defect is mutation-on-`pointerdown` — a scroll gesture beginning on a ± button starts the 350ms press-repeat timer before gesture disambiguation, with no movement-threshold cancel.

**Decision.** Commit on `pointerup` within an ~8px slop; the repeat timer still arms at 350ms but any pointermove beyond slop or any `pointercancel` cancels with zero writes. Relax buttons from `touch-action: none` to `touch-action: pan-y` so a vertical scroll starting on a button is handed to the browser. Hold-to-repeat cadence (350ms/100ms) unchanged. This satisfies "scroll → zero writes" at the source and, with items 9–10, kills the accidental Saved/view-only toast pair.

**Files.** `NumberStepper.tsx` only (shared by SetupView, FourBarQuickAdjust, RaceWeekendView).
**Harness.** `saved-flash-harness.ts` gains zero-writes-on-scroll assertion. **LOE: M (4-6h).**

### 6. Canonical Setup editability — one rule, not two; rename unblocked *(v1 item 6, EXTENDED by owner feedback N8)*

**Current state.** `isSetupLocked()` (`setupLifecycle.ts:35-42`) is the real predicate, but `SetupView.tsx:517` ORs in an over-broad clause — every setup is read-only while *any* Race Day has an `activeSetupId` — and `App.tsx:1416-1440`'s `handleSaveSetups` recomputes its own divergent `canEdit`. Round-2 addition: **setup rename already exists** — the chassis-name field at `SetupView.tsx:591` — but is disabled by the same over-broad fieldset (`:587`/`:517`). The owner reported "no way to rename" because the input is always frozen on his data.

**Decision.** As v1: one exported `getSetupEditability(setup, weekends, activeEventSetupId)` in `setupLifecycle.ts` returning `{ editable, deletable, reason }` with a typed reason enum (`historical-role`, `locked`, `finished-weekend`, `in-play-elsewhere`); both call sites use it and only it. The `activeEventSetupId` clause is demoted to `in-play-elsewhere` — non-historical, non-delete-blocking, edit-frozen only within the same active weekend. Lifecycle immutability semantics (baseline/final roles, `lockedAt`, finished-weekend snapshots) are byte-for-byte unchanged in meaning — protected.

Round-2 extension, two parts: (a) **explicit acceptance criterion** — after this item lands, the chassis-name field on a non-historical setup is editable on the owner's exact data pattern (live Race Day present); rename requires no new code path, only the unblocking. (b) **A dedicated rename affordance** so the capability is findable: a pencil icon beside the setup name on the card header that focuses the existing chassis field (or opens a one-field inline editor on narrow screens). Discoverability was the real gap — the field existing didn't help.

**Files.** `setupLifecycle.ts:35-42` (extend), `SetupView.tsx:517`, `:587-591` (affordance), `App.tsx:1416-1440`.
**Harness.** `chunk5-setup-harness.ts` asserts both call sites agree on every fixture; add a rename-on-live-race-day fixture. **LOE: M (6-9h).**

### 7. Session-bound setup change log *(NEW — owner feedback N5; restructures v1's change-log-adjacent scope in items 5–8)*

**Current state — two disjoint logging paths, both wrong-grained.** Path 1 (live trackside): every NumberStepper press → SetupView `handleCornerChange` → `updateAndSaveSetups` → App `handleSaveSetups` → `withSetupDiffLog` (`setupLifecycle.ts:73-114`), which appends **one `SetupChange` per field per call with no coalescing** — the "Live-Trackside Changes" list (`SetupView.tsx:756-762`) records every button press as a separate entry. Path 2 (Quick Adjust on the Runs tab): `applyQuickAdjust` (`quickAdjust.ts:239-321`) **does** coalesce per-run — it mutates the existing entry matching `runId+corner+field`, preserving the original `before` — and commits via `handleCommitQuickAdjust` (`App.tsx:1528-1577`), which never calls `withSetupDiffLog`. Two fully disjoint pipelines producing two different change vocabularies. Meanwhile `SessionRecord` (`types.ts:198-227`) has **no setup reference at all** — only the free-text `setupUsed` chassis-name string (`App.tsx:1749`). There is no way to answer "what setup did we qualify on?" from data.

**Decision — session snapshots become the canonical change record.**

*Data model.* Add an **embedded frozen `setupSnapshot`** field to `SessionRecord`: a deep-copied, plain-data image of the active setup's tunable fields (corners, four-bar, pressures, gearing — the numeric/enum payload, not UI state), captured **at session creation**, plus a `setupId` string kept alongside for provenance. Embedded copy is deliberately chosen over a `setupSnapshotId` reference, for three reasons that outweigh the duplication cost: (1) **setups are mutable** — an id reference resolves to the setup's *current* state, which is precisely the wrong answer for "state at qualifying start"; making referenced snapshots immutable would require a new lifecycle role and new lock semantics in exactly the protected code this plan promises not to re-mean. (2) **Survivability** — an embedded snapshot survives setup deletion, car cascade delete (item 12), and clear-data, keeping historical sessions self-describing. (3) **Cost is trivial** — a setup's tunable payload is a few hundred bytes of numbers; even a 50-session season is kilobytes, negligible against localStorage and the existing sync payloads. The snapshot is written once at creation and never updated — immutable by construction, no lock code needed.

*Diff semantics.* The change record for session N is **computed, not stored**: `diff(snapshot(N), snapshot(N-1))` within the same Race Day, or against the weekend's starting setup state for the first session. This matches the owner's stated model exactly: arrive with starting setup → hotlaps → make changes → start qualifying → the state at qualifying start binds to qualifying, and qualifying's change list is "what changed since hotlaps." Live pending changes (edits made since the last session) render as a computed "pending — will bind to next session" diff of current-setup-vs-last-snapshot, replacing the per-press "Live-Trackside Changes" list at `SetupView.tsx:756-762`.

*Kill per-press logging.* `handleSaveSetups` stops calling `withSetupDiffLog` for live-trackside edits — the pending diff is derivable, so storing a press-by-press journal adds noise and bytes for nothing. `withSetupDiffLog` itself remains for any path that legitimately needs a stored audit entry, but the SetupView hot path no longer feeds it. **Existing stored `SetupChange` history is preserved read-only** — rendered under a "legacy log" disclosure on old data, never migrated or deleted.

*Quick Adjust coexistence — the design tension, resolved.* Quick Adjust's run-scoped net rows (UXF-2, shipped behavior) are **kept as the in-run convenience view** — they answer "what did I tweak between run 3 and run 4," which is finer-grained than sessions and genuinely useful trackside. They feed the same underlying setup state, so when the next session is created, the snapshot automatically captures their net effect. The session-over-session diff is the **canonical record**; Quick Adjust rows are a working view. Nothing is double-logged because Quick Adjust already doesn't call `withSetupDiffLog` and the session diff is computed, not appended. `handleCommitQuickAdjust` (`App.tsx:1528-1577`) needs no logging changes — only the shared snapshot-at-session-creation hook.

*Sessions page.* Add one button — "Log setup changes" — on the sessions page that navigates to the Setups tab (existing tab navigation, optionally with the active setup expanded). The sessions page itself stays uncluttered: it shows the bound snapshot diff summary (read-only, compact) and keeps the free-text notes section for handling notes. `setupUsed` (the chassis-name string) remains for display continuity but is now derived from the snapshot at creation rather than hand-entered.

*Sync.* `SessionRecord` already syncs; the new field rides the existing record sync — no schema/RLS change (Supabase columns are JSON payload-carried per the existing pattern; if any table has a strict column shape for sessions, the snapshot goes in the existing payload/notes-adjacent JSON field — builder verifies at implementation, and if a true schema change were required, that is out of bounds and the item stops for owner review).

**Files.** `types.ts:198-227` (SessionRecord + snapshot type), `App.tsx:1749` (session creation — snapshot capture), `App.tsx` `handleSaveSetups` (remove hot-path `withSetupDiffLog`), `setupLifecycle.ts:73-114` (retain, de-wire from hot path; add `diffSetupSnapshots` helper), `SetupView.tsx:756-762` (computed pending-diff view), sessions page component (diff summary + "Log setup changes" button), `quickAdjust.ts` (no logic change; verify net rows feed state only).
**Harness.** New assertions in `chunk5-setup-harness.ts`: creating a session captures a snapshot equal to current setup state; a stepper press after session creation does not mutate any existing snapshot; session N diff equals the known fixture delta; zero `SetupChange` entries appended by a live-trackside edit burst. **LOE: L (12-18h)** — the largest single item; split into two tasks in Part 5.

### 8. Autosave semantics — save moment on leave + periodic *(NEW — owner feedback N2)*

**Current state.** Every keystroke/press persists immediately to localStorage (correct — local-first is non-negotiable) **and** triggers the user-facing save feedback path, which is why the Saved pill flashes constantly and why the owner experiences the app as nagging.

**Decision.** **Decouple the write from the announcement.** The local write stays exactly as-is: immediate, synchronous, on every change — no data-loss window is introduced, period. What changes is the *user-facing save moment*: dirty-state feedback is flushed and announced only at **commit boundaries**, which are (a) leaving the current page/tab (tab switch, view unmount), (b) `visibilitychange` → hidden and `pagehide` (app backgrounded, phone locked — critical on Android/Capacitor), (c) a periodic timer while dirty. **Interval recommendation: 30 seconds** — the owner deferred this to engineering judgment, and 30s is chosen because it is long enough not to interrupt an active tuning burst (a corner adjustment sequence takes 10–20s), short enough that the confirmation still feels connected to the work, and it deliberately matches the existing resume-pull cooldown constant so the app has one "background cadence" number, not two. Session creation (item 7) is also a commit boundary — starting qualifying flushes and announces once.

At a commit boundary with accumulated changes, exactly one small Saved confirmation fires (through item 9's arbiter, in item 9's new top position). No changes since the last boundary → no toast. Cloud push cadence is untouched — this item governs *feedback*, not sync timing; sync.ts is not in this item's file list, by design.

**Files.** `App.tsx` (dirty-tracking + boundary wiring: tab-switch handler, visibility/pagehide listeners, 30s interval; `flashSaved` call sites), view unmount hooks in `SetupView.tsx`/`RaceWeekendView.tsx`.
**Harness.** `saved-flash-harness.ts`: an edit burst of N presses produces zero Saved toasts until a boundary, then exactly one; background event flushes; no-dirty boundary produces nothing. **LOE: M (4-6h).**

### 9. Notification arbiter, unified copy, and the small top Saved toast *(v1 item 7 + owner feedback N3)*

**Current state.** Three literal strings for one read-only concept (`SetupView.tsx:336`, `:351`, `App.tsx:1443`) plus a persisted banner (`SetupView.tsx:584-586`); the bombardment is two independent single-slot channels (green Saved + info) co-rendering. The Saved toast is a **large pill at `fixed bottom-24`** (`App.tsx:2221-2233`) — bottom-anchored, colliding visually with the sticky Save Run bar and bottom nav region, and oversized for routine feedback.

**Decision.** As v1: a single notification arbiter with priority ordering — an info/blocked message *replaces* a pending Saved; a blocked mutation can never enqueue Saved; identical info messages deduplicate within ~5s; one copy source keyed by item 6's reason enum; the persisted inline banner on an expanded historical card is the only passive communication. Round-2 addition folded in here (not a separate task, so the old toast is never repositioned only to be rebuilt): the Saved/status toast becomes a **small top-center pill** — `fixed top-[calc(env(safe-area-inset-top)+0.5rem)] left-1/2 -translate-x-1/2`, compact `text-xs`/`text-sm` single line, subtle enter/exit, ~1.5s auto-dismiss for success states. Top placement clears the sticky action bar, the bottom nav, and the thumb zone entirely; error states (item 10) use the same slot but persist until acknowledged.

**Files.** `SetupView.tsx:336`, `:351`, `:584-586`, `App.tsx:1443`, toast slot `App.tsx:2213-2244` (including the `:2221-2233` pill).
**Harness.** `saved-flash-harness.ts`. **LOE: S-M (4-6h).**

### 10. Honest save/sync/delete feedback *(v1 item 8, unchanged)*

**Current state.** UXP-18 incomplete — `handleSaveSetups` always flashes Saved, including on blocked/reverted mutations. The toast renderer (`App.tsx:2213-2244`) whitelists two statuses and silently drops the rest, including `'Cloud delete deferred'` (`App.tsx:736`) and `'Offline — local data ready'` (`:1295`). All `sync.ts` push helpers swallow errors to `console.warn`. `saveStatus.ts` is dead code.

**Decision.** As v1, four moves: (a) finish UXP-18 — `flashSaved` fires only when a user-initiated mutation actually persisted, early-return with no flash on the blocked branch via item 6's predicate; (b) delete `saveStatus.ts`; (c) typed 4-state status renderer — synced, offline-saved, deferred-delete-retrying, sync-error — compact, success states auto-dismiss, error states persist until acknowledged (rendered in item 9's top slot); (d) `sync.ts` push/delete helpers get an error-branch status callback so a failed cloud write surfaces as "Sync failed — will retry," never green Saved. The governing rule — blocked or failed operations never present as Saved/Synced — is enforced at the arbiter, not per call site. Reporting only: dual-delete, deferred queue, 30s pull throttle, and UXN-3 (pulls never enqueue success statuses) all untouched.

**Files.** `App.tsx:1416-1440`, `:2213-2244`, `:736`, `:1295`; `sync.ts` push helpers (error callback only); `saveStatus.ts` (remove).
**Harness.** `saved-flash-harness.ts` inverted per item 16. **LOE: M (5-8h).**

### 11. Deletion integrity: zero-row detection + Clear-All-Data trust *(v1 Part-3 HIGH extended by owner feedback N9)*

**Current state — two instances of one bug class: local success theater over cloud no-ops.**
*(a) Zero-row delete (v1 finding, carried).* `deleteTeamSharedRecordFromCloud` (`sync.ts:23-37`) returns `true` whenever `error === null`, but a Supabase delete matching zero rows (RLS filtering a non-owner) also returns `error: null` — the intent is dropped (`App.tsx:729-730`), local UI shows the item gone, and the cloud row resurrects on next pull.
*(b) Clear All Data (round-2 root cause, confirmed).* `handleClearAllData` (`App.tsx:484-547`) queues cloud deletes **only** when the user is solo or team-unresolved (`:489` — a deliberate "must not erase team data" guard); for team-resolved users **zero cloud deletes are queued** while the local wipe runs unconditionally (`:516-547`). The next resume/visibility pull (`App.tsx:1113` effect → `requestResumePull` `:1306-1324`, 30s cooldown in `resumePull.ts`) re-downloads everything. This is the owner's exact reported symptom.

**Decision.**
*(a)* As v1: append `.select('id')` to the delete, treat zero affected rows as failure, keep the intent queued, surface "delete pending" via item 10's renderer. Nothing else in `sync.ts` changes.
*(b)* The dishonesty, not the guard, is the bug — the "must not erase team data" instinct is correct for records the user doesn't own, and UXN-1 protections stand. The fix is **both honest UX and real deletion, layered by ownership** (choosing between the prompt's (a) and (b) options: both, split along the `teamDataOwnership` line). For team-resolved users the clear-data dialog becomes a two-option choice: **"Clear this device only"** — labeled exactly as such, with the explicit warning "shared team data will re-download on next sync"; and **"Delete my records everywhere"** — which queues cloud deletes *only for records the user owns per `teamDataOwnership` rules*, through the existing `queueSharedCloudDelete` + push pairing (no new delete primitives), then wipes locally. Non-owned team records are never cloud-deleted, and the dialog says so in one plain sentence. Solo/team-unresolved behavior is already correct and unchanged. With (a) landed first, any RLS-blocked delete in the "everywhere" path stays queued and reports honestly instead of silently resurrecting — the two halves of this item are mutually reinforcing and land in that order.

**Files.** *(a)* `sync.ts:23-37`, `App.tsx:729-730` — exact footprint, nothing else. *(b)* `App.tsx:484-547` (flow + ownership enumeration), the clear-data dialog component, reusing existing queue helpers; `teamDataOwnership.ts` read-only.
**Harness.** `saved-flash-harness.ts`: zero-row delete never renders success; clear-data "device only" queues zero cloud deletes; "everywhere" queues exactly the owned set; post-clear resume pull does not resurrect owned-and-deleted records in the fixture. **Both halves ISOLATED — protected delete path; each is a named boundary exception (Part 5.2).** **LOE: M (6-9h total: a: 2-4h, b: 4-6h).**

### 12. Reachable car deletion — cascade without deadlocks or orphans *(v1 item 9, unchanged; dependencies updated)*

**Current state.** Weekend and setup deletes are correctly paired (queue + push — `App.tsx:1847-1871`, `:1445-1448`, `1571/1664/2020`). Car delete is double-guarded on zero scoped records (`App.tsx:443-481`, `GarageView.tsx:185-195`). The deadlock is derivative of item 6's over-broad lock.

**Decision.** As v1. Item 6 dissolves most of the deadlock. Residuals: genuinely locked setups stay individually undeletable (protected, correct) but the disabled Delete states *why* from the reason enum; and the cleanup path becomes a **confirmed cascade delete on the car** — Garage enumerates exactly what blocks (setups, personal tires, shock records, car-scoped maintenance components, and dependent maintenance logs), strong confirmation, then deletes each scoped record through the existing protected pairing per table before the car. Affected Race Day top-level setup pointers are cleared only when they target removed setups; Race Days and their embedded session snapshots remain byte-stable. Rig/global maintenance and unrelated-car data remain untouched. No new delete primitives, no queue bypass, no orphans, no resurrection by construction. Mid-cascade failure surfaces as an explicit error (item 10), never Saved; queued intents retry under existing rules. Note for item 7: embedded session snapshots survive the cascade untouched — historical sessions remain self-describing after their setup is gone, which is a new argument *for* the embedded-copy decision. **Depends on items 6, 10, and 11a landing first.**

**Files.** `App.tsx` (orchestration), `GarageView.tsx` (enumeration + confirm), `SettingsView.tsx` (Garage prop transport only), and `SetupView.tsx` (disabled reason + existing Garage link only), reusing existing queue/push paths. This exact four-product-file correction supersedes the stale two-file line map above.
**Harness.** Production-bound cascade proof in `car-delete-undo-harness.ts`, with bounded confirmation/status/setup-link assertions in `confirm-sheet-harness.ts`, `saved-flash-harness.ts`, and `chunk5-setup-harness.ts`. Every removed record hits the existing queue plus matching push; the actual Nth-delete failure remains queued and terminally suppresses Saved/Synced. **ISOLATED.** **LOE: M-L (8-12h).**

### 13. Context-aware help relocation *(NEW — owner feedback N4)*

**Current state.** The header's Tuning Guide button opens `QuickReferenceView` (no section argument). SetupView renders its own "?" that opens `GuideView` deep-linked to `'setup'` (`SetupView.tsx:455` → `openHelp('setup')`); FourBarQuickAdjust's "?" deep-links `'four-bar'` (`FourBarQuickAdjust.tsx:118`). Section routing lives in `helpRouting.ts` (`APP_GUIDE_SECTIONS`).

**Decision.** Tuning Guide stays in the header, untouched. The setup-sheet "?" **moves to the top of the page, beside the Tuning Guide button**, and — the caveat that makes a naive move wrong — it must stay **context-aware**, because a bare header "?" would lose the deep link. Implementation: the header "?" resolves its target section at tap time from app state via `APP_GUIDE_SECTIONS` — `'four-bar'` when the FourBar panel is visible, `'setup'` when the Setups tab is active, the mapped section for other tabs where `APP_GUIDE_SECTIONS` defines one, guide root otherwise. SetupView's inline "?" (`:455`) is removed. FourBarQuickAdjust's inline "?" (`:118`) is retained — it lives inside a deep panel where the user's eye already is, costs nothing, and its removal is not what the owner asked for; the header resolves identically when that panel is open, so both paths land on `'four-bar'`.

**Files.** `App.tsx` header (new "?" + section resolution), `helpRouting.ts` (resolution helper), `SetupView.tsx:455` (remove), `FourBarQuickAdjust.tsx:118` (unchanged, verify).
**Harness.** Assertion that header "?" resolves `'setup'` on Setups tab and `'four-bar'` with the panel open. **LOE: S-M (2-4h).**

### 14. "Add X" opener/submit labeling convention *(NEW — owner feedback N6)*

**Current state.** Four surfaces use the same label for the form opener and the form's submit, so users can't tell which button commits: GarageView "Add Car" opener (`GarageView.tsx:264-271`) vs "Add Car" submit (`:250-253`); TiresSubView "Add Tire" opener (`TiresSubView.tsx:129`) vs "Add Tire" submit (`:141`); RaceWeekendView "+ New Race Day" (`:939`) vs "CREATE RACE DAY" (`:700-703`) — differently inconsistent; TrackersView "Add Maintenance Job" twice (`TrackersView.tsx:619-621`, `:681`).

**Decision.** One convention, app-wide, stated once so future surfaces inherit it: **openers say "Add X" (or "+ New X" where that pattern already exists); submit buttons say "Create X"; edit-form submits say "Save Changes"; cancel says "Cancel."** Applied: Garage submit → "Create Car"; Tires submit → "Create Tire"; RaceWeekendView submit → "Create Race Day" (normal casing — the all-caps "CREATE RACE DAY" is retired as part of item 2's typography discipline); Trackers submit → "Create Job". "Create X" is chosen over bare "Save" because these forms create records — "Save" is reserved for edits, keeping the two verbs meaningful everywhere.

**Files.** `GarageView.tsx:250-253`, `TiresSubView.tsx:141`, `RaceWeekendView.tsx:700-703`, `TrackersView.tsx:681`; convention noted in `CODEBASE_KNOWLEDGE.md`.
**Harness.** None required (copy-only); grep-check in chunk QA. **LOE: S (2-3h).**

### 15. Required name for new-from-blank setups *(NEW — owner feedback N7)*

**Current state.** `SetupView.tsx:300` falls back to `Setup #N` when `newSetupName` is blank; the input (`:487`) is not `required`. Result: accidental anonymous setups that the owner then can't distinguish (compounded, until item 6, by rename being locked).

**Decision.** On the blank-start creation path, name becomes required: input marked `required`, create button disabled until non-empty (trimmed), inline hint "Name this setup" on attempted empty submit. The copy path keeps autogenerating ("Copy of X") — it has a meaningful derived name and requiring input there adds friction for nothing. The `Setup #N` fallback at `:300` is removed for the blank path.

**Files.** `SetupView.tsx:300`, `:487`.
**Harness.** `chunk5-setup-harness.ts`: blank-name create is rejected; copy path still autonames. **LOE: S (1h).**

### 16. Exact harness changes and regression gates *(v1 item 10, extended)*

Four named harnesses byte-lock the rejected UX (per `ralph/STATE.md`) and will fail CI on any fix unless changed **in the same commit** as the code they lock:

- **`scripts/chunk6a-refinement-harness.ts`** — rewrite to assert: `ZOOM` contains `standard: 1.0`; new-install fallback and Reset resolve to `standard`; `normalizeTheme` maps legacy values to `standard`; one-time `large→standard` migration runs exactly once, `xlarge` survives; three Settings options render. Lands with item 1.
- **`scripts/setup-touch-target-harness.ts`** — convert byte-diff → behavioral: every interactive control in SetupView ≥44px computed min-height at zoom 1.0; corner form yields 2 columns at ≥360px effective width. Lands with item 2; verify NumberStepper/`.tap-target` coverage for item 4.
- **`scripts/chunk5-setup-harness.ts`** — update for phone-first grids (item 2), sticky-bar reservation (item 3), single editability gate + rename fixture (item 6), **new: session-snapshot assertions** (item 7 — snapshot captured at creation, immutable under later edits, diff matches fixture, zero per-press `SetupChange` appends), required-name rule (item 15).
- **`scripts/saved-flash-harness.ts`** — **invert**: `flashSaved` fires exactly once per commit boundary with dirty changes and zero times otherwise (item 8 semantics replace v1's "once per real save"); zero times on blocked/reverted mutation; simulated scroll-start-on-stepper commits zero writes and zero toasts; failed or zero-row delete never renders Saved/Synced; clear-data assertions per item 11.

Standing rules carried from v1: retire the byte-diff-against-approved-commit pattern in favor of behavioral assertions — this review should be the last time a harness is rewritten to *permit* a fix. Every task lands code + harness in one commit; the full suite runs green before the next task starts. **LOE: policy overhead +S (2h); per-harness work rolled into the items above.**

### LOE summary and revised total

| # | Item | LOE | Lineage |
|---|------|-----|---------|
| 1 | Scale default 1.0 + migration | M (4-6h) | v1-1 |
| 2 | App-wide density/whitespace pass | L (10-16h) | v1-2 + N1 |
| 3 | Save Run reservation + nav clearance | S (2-3h) | v1-3 |
| 4 | Tire-pressure grid + stepper layout | S-M (3-4h) | v1-4 |
| 5 | Commit-on-pointerup stepper | M (4-6h) | v1-5 |
| 6 | Editability predicate + rename | M (6-9h) | v1-6 + N8 |
| 7 | Session-bound change log | L (12-18h) | N5 |
| 8 | Autosave semantics | M (4-6h) | N2 |
| 9 | Arbiter + top toast | S-M (4-6h) | v1-7 + N3 |
| 10 | Honest sync feedback | M (5-8h) | v1-8 |
| 11 | Zero-row + clear-data integrity | M (6-9h) | v1-3.A + N9 |
| 12 | Car cascade delete | M-L (8-12h) | v1-9 |
| 13 | Context-aware help relocation | S-M (2-4h) | N4 |
| 14 | Add-X labeling convention | S (2-3h) | N6 |
| 15 | Required setup name | S (1h) | N7 |
| 16 | Harness policy | +S (2h) | v1-10 |
| — | Part 3 small fixes | S (2-3h) | v1 Part 3 |

**Revised total: roughly 75–110 focused hours** (v1 was 45–65; the growth is items 7 and 8 — the persistence-model restructure — plus the extended density pass and clear-data work).

---

## Part 3 — Additional Bugs Beyond the Numbered Items

The v1 HIGH finding (team-delete zero-row silent resurrection, `sync.ts:23-37` / `App.tsx:729-730`) is **no longer listed here — it folded into item 11** as half (a) of the deletion-integrity item, where it belongs next to its larger sibling.

**Native-auth state update after unmount — LOW.** `App.tsx:1092`: the async `.then`/`.catch` around the native-auth URL don't re-check the `active` guard before `setNativeAuthError`. Fix: re-check the flag in both branches. **LOE: S (<1h, pairs with next).**

**Listener cleanup unhandled rejection — LOW.** `App.tsx:1108`: `void listenerPromise.then(l => l.remove())` has no `.catch`; if `addListener` rejects, cleanup throws unhandled. Fix: swallow-with-log `.catch`. **LOE: S (<1h).**

**Universal scrollbar hiding — LOW.** `index.css:174` hides scrollbars via the universal selector, removing the scroll affordance from desktop-web overflow regions. Fix: scope to coarse-pointer media query or the specific mobile containers. **LOE: S (<1h).**

**Location-sharing scaffold — LOW, informational.** `location.ts:21`: `startSharing` returns false, `subscribeTeamLocations` is a no-op, both silent. No UI entry point found; annotate as intentional stub. **LOE: S (<1h).**

---

## Part 4 — Build Strategy and Interdependencies

This section exists because the owner asked how the pieces stack. The governing rule: **every chunk ships an increment that no later chunk reverts.** The orderings below are not preferences; each has a stated reason, and violating one either wastes work or ships a regression window.

### The dependency graph

```
item 1 (scale 1.0) ──────────► item 2 (density pass)          [measure at 1.0, not 1.15]
item 2 (density) ────────────► item 13 (help relocation)      [both edit header markup; serialize]
item 5 (pointerup stepper) ──► items 7,8 (persistence model)  [make the change stream deliberate first]
item 6 (editability) ────┬───► rename criterion (in 6)
                         ├───► item 12 (cascade delete)       [deletable setups are the deadlock key]
                         └───► items 9,10 copy (reason enum)
item 9 (arbiter) ─── includes N3 reposition [same task, never separate]
item 9 (arbiter) ────────────► item 8 (autosave feedback)     [Saved fires through the arbiter]
item 10 (status renderer) ───► items 11,12                    [failure surfacing must exist before delete work]
item 7 (session snapshots) ──► item 8 (autosave)              [see decision below]
item 11a (zero-row) ─────────► item 11b (clear-data) ────────► item 12 (cascade)
```

### The decided orderings, with reasons

**Scale before density (1 → 2).** v1's under-correction happened because density was judged at 1.15. The tier-down pass is calibrated visually at 1.0 on 360×800; landing it first and re-judging after the zoom change would mean doing the pass twice. Item 1 is also the smallest possible first commit with user-visible payoff.

**Session snapshots before autosave semantics (7 → 8) — the closest call in this plan, decided as follows.** Both items touch the same write pipeline (`handleSaveSetups` and its callers). Item 7 *removes* the per-press `withSetupDiffLog` call and introduces the commit-boundary concept (session creation is a natural flush point). Item 8 *builds on* commit boundaries — page-leave, visibility, periodic — as the feedback moments. If 8 landed first, its dirty-tracking would be wired against a pipeline that still per-press-logs, and item 7 would then rip that pipeline apart and force a rework of 8's instrumentation. Landing 7 first means 8 instruments a settled, simplified pipeline, and "session created" is already one of its boundaries for free. The counterargument — that 8 is smaller and delivers owner-visible relief sooner — loses because 8's relief (fewer Saved flashes) is partially delivered even earlier by item 9's arbiter and item 5's scroll-safety.

**Arbiter before autosave, reposition inside arbiter (9 → 8, N3 ⊂ 9).** The Saved toast's new top position is a property of the arbiter's renderer. Repositioning the *old* dual-channel toasts first would ship UI that item 9 immediately rebuilds — a textbook later-chunk-reverts-earlier-chunk violation. So N3 is folded into the arbiter task, and autosave (whose confirmations fire through the arbiter) comes after.

**Editability before cascade (6 → 12), honest reporting before all delete work (10 → 11 → 12).** The deadlock dissolves at item 6; cascade delete is the residual cleanup path and enumerates blockers using item 6's reason enum. Every delete item's failure mode surfaces through item 10's renderer — building delete flows whose errors vanish into the old whitelist would ship silent-failure windows. Within deletion: zero-row detection (11a) first, because both clear-data-everywhere (11b) and cascade (12) push deletes that can zero-row-match under RLS; landing 11a first means their failure paths are honest from birth.

**Density before help relocation (2 → 13).** Both edit the header markup. Trivial serialization to avoid merge churn, nothing deeper.

### What can parallelize, what must serialize

Under the two-agent execution model (Part 5), work is effectively serial; but for schedule honesty: items 3, 4, 14, 15 and Part 3's small fixes have no incoming edges and could land anywhere; the hard serial spine is **1 → 2** and **5 → 6 → (9 → 10) → 7 → 8 → 11a → 11b → 12**. Chunks in Part 5 are built directly on this spine so that chunk order = dependency order, and any chunk boundary is a valid stopping point for an on-device owner review.

---

## Part 5 — Chunked Work Order

Work exclusively on branch `codex/ux-overhaul` (worktree `.worktrees\ux-overhaul`). Execute chunks in order, tasks within a chunk in order. Do not begin a task until the previous task's full harness suite passes **and Sol High has signed off its light QA (6.1)**; do not begin a chunk until the previous chunk's **chunk QA (6.2)** is green. Land each task as one commit containing both the code change and its harness changes.

### 5.0 Execution model — roles, loop discipline, and communication

This work order is executed by two named agents with fixed, non-interchangeable roles. Any agent picking up this document cold must adopt the role assigned below; do not improvise a different division of labor.

**Builder — 5.6 Terra Extra High.** Owns investigation and implementation of every task: reads the target files, writes the code and harness changes, runs the harness suite, produces the commit. Terra does not self-certify — every task Terra finishes goes to Sol for light QA before the next task may begin.

**QA and plan authority — 5.6 Sol High.** Owns quality assurance and plan maintenance. Sol is not a pass/fail stamp: when a task fails QA, Sol writes the rework — a revised, clarified task instruction telling Terra exactly what was wrong and what the next attempt must do differently — and hands that back to Terra. The plan text Terra executes on a retry is always Sol's latest revision, not the original wording plus verbal notes. Sol additionally owns the new **chunk QA** tier (6.2).

**Escalation rule (applies to every task).** Failures are counted per task, consecutively. Attempt 1 fails → Sol writes revised instructions, Terra makes attempt 2. Attempt 2 fails → Sol revises again, Terra makes attempt 3. If attempt 3 fails — Terra has failed the same task more than 2 times — Sol stops handing instructions back and **implements the fix directly**, held to the identical bar: same acceptance criteria, same full-harness gate, same one-commit rule, recorded as an escalation in the Ralph state and the end-of-sprint handoff document.

**Communication discipline — caveman and cavecrew (a requirement, not a suggestion).** Both agents use the **`caveman` skill** for all working notes, status updates, QA verdicts, and completion reports. Exceptions: Sol's rework instructions may use full prose where precision demands it; the Part 6 handoff document is always full prose. Whenever either agent delegates to subagents, it must use the **`cavecrew` pattern**: compressed investigator/builder/reviewer contracts with model-tier routing — **Sonnet** for searching and evidence-gathering, **Fable** for synthesis and implementation, **Opus** for genuinely hard judgment calls. No vanilla open-ended subagents for work cavecrew covers.

**Ralph-loop discipline.** The sprint continues the repo's spec-driven approach via `ralph/STATE.md` / `ralph/CURRENT_TASK.md`. Per task: (1) `CURRENT_TASK.md` is set to the task's current instruction text (original below, or Sol's latest revision); (2) Terra works only that task; (3) on harness-green completion Terra reports (caveman), Sol runs light QA; (4) only after Sol's pass does `STATE.md` advance (attempt count and escalations recorded) and `CURRENT_TASK.md` move on. On kickback, `STATE.md` records the failure and `CURRENT_TASK.md` receives Sol's revision. **New in v2:** chunk completion is its own `STATE.md` entry, written only after chunk QA passes; a resuming agent must be able to tell from `STATE.md` alone which chunk is open and which task within it is current.

**ISOLATED flag.** Tasks marked ISOLATED touch protected paths (editability predicate, clear-data/cloud-delete work, cascade delete, zero-row fix). For these: the diff may contain nothing beyond the task's named files and purpose; any unrelated change is an automatic QA fail even if functionally correct; kickbacks must not bundle unrelated fixes; and on escalation the same footprint restriction binds Sol.

---

### Chunk A — Scale & density foundation *(items 1, 3, 4, 2 — the "make it fit" chunk)*

**Task A1 — Scale default and migration (item 1).** Files: `types.ts:484-491`, `App.tsx:70-81, 582, 607-611`, `SettingsView.tsx:310-313, 341-347`. Change: add `'standard'`/1.0; fallback, normalize, Reset target `standard`; three Settings options; one-time versioned `large→standard` remap preserving `xlarge`. Harness: rewrite `chunk6a-refinement-harness.ts`. Acceptance: Default materially denser than 1.15; pinch-zoom remains enabled; theme stays localStorage-only; migration idempotent.
*QA focus (Sol):* run migration twice — `xlarge` survives; Reset target; pinch-zoom.

**Task A2 — Save Run reservation and bottom-nav clearance (item 3).** Files: `index.css:266-275`, `RaceWeekendView.tsx` container, `App.tsx` main scroll container. Change: reserve sticky-bar height + safe-area below content; opaque bar, top border, render only when dirty; global bottom padding `calc(4rem + safe-area)`. Harness: reservation assertion in `chunk5-setup-harness.ts`. Acceptance: Save Run never covers content; nothing behind bottom nav at any test viewport.
*QA focus (Sol):* scroll-to-bottom on every view, dirty and clean states; mutation-check the new assertion once.

**Task A3 — Tire-pressure grid and stepper layout (item 4).** Files: `RaceWeekendView.tsx:1279`, `NumberStepper.tsx:130-131, 153`. Change: auto-fit minmax(10.5rem) grid; value `whitespace-nowrap tabular-nums`; unit as separate `shrink-0` element. No stepper timing changes in this task. Harness: update any byte-lock covering NumberStepper/`.tap-target`. Acceptance: 4 pressure controls with distinct minus/value/unit/plus regions, no clip/overlap, at 360×800/390×844/412×915/1080×2118, both Default and Large.
*QA focus (Sol):* all four viewports at both scales; diff touches zero timing logic.

**Task A4 — App-wide density/whitespace pass (item 2).** Files: per item 2's list (header/nav, ContextStrip, SetupView, index.css floors, FourBarQuickAdjust, RaceWeekendView, plus padding/gap/label tiers in Garage/Tires/Trackers/Settings/Dashboard). Change: 48→44px floors; raise Run freeform inputs to 44px; remove nav `scale-105`; phone-first corner grid; real compact FourBar steppers; the mechanical padding/gap/label tier-down with the `text-xs` floor. Harness: rewrite `setup-touch-target-harness.ts` behavioral; update `chunk5-setup-harness.ts`. Acceptance: 2 setup columns / 3 four-bar columns usable at normal portrait widths; no text below `text-xs`, values ≥ `text-sm`; no clip/overlap; focus/keyboard/safe-area unchanged.
*QA focus (Sol):* widest blast radius of the sprint — visual pass over every affected surface at 360px, explicit focus/keyboard/safe-area regression. Expect kickbacks; write rework surface-by-surface, not wholesale.

**Chunk A QA (larger QA, 6.2):** all density/layout acceptance targets together — the four viewports × both remaining scales, owner screenshots 1–3 scenarios reproduced; regression surface: every view's scroll extremes, Settings tier switching live, pinch-zoom; full harness suite; boundary audit scoped to A's files. **Closes acceptance targets:** Default materially denser than 1.15; no unreadable text; 2 setup cols / 3 four-bar cols; Save Run never obscures; 4 pressure controls distinct at both scales; nothing behind nav; pinch-zoom intact. *This chunk boundary is the natural point for an owner on-device look at density before the behavioral chunks proceed.*

---

### Chunk B — Input & feedback semantics *(items 5, 9, 10 — the "stop lying, stop shouting" chunk)*

**Task B1 — Commit-on-pointerup stepper (item 5).** Files: `NumberStepper.tsx` only. Change: single step commits on pointerup within ~8px slop; repeat timer cancels on movement/pointercancel; `touch-action: pan-y`. Hold-repeat cadence (350ms/100ms) unchanged. Harness: zero-writes-on-scroll assertion in `saved-flash-harness.ts`. Acceptance: scroll beginning over a stepper produces zero writes; hold-to-repeat works.
*QA focus (Sol):* cadence behaviorally identical; the zero-writes assertion is meaningful (mutation-check).

**Task B2 — Notification arbiter, unified copy, top toast (item 9, includes N3).** Files: `SetupView.tsx:336, 351, 584-586`, `App.tsx:1443, 2213-2244` (incl. `:2221-2233`). Change: single arbiter (info replaces Saved, never co-render); one copy source keyed by reason; ~5s identical-info dedupe; Saved/status toast becomes small top-center pill below safe-area, ~1.5s auto-dismiss for success. Harness: `saved-flash-harness.ts`. Acceptance: no two toasts co-render; toast at top, compact; historical-card banner is the only passive communication.
*QA focus (Sol):* force both channels simultaneously in a fixture — exactly one renders; top placement clears sticky bar and nav at all viewports.

**Task B3 — Honest status feedback (item 10).** Files: `App.tsx:1416-1440, 2213-2244, 736, 1295`, `sync.ts` push helpers (error callback only), delete `saveStatus.ts`. Change: UXP-18 finished — no flash on blocked branch; typed 4-state renderer (synced/offline-saved/deferred-retry/sync-error), error states persist; push helpers report failures. **No behavioral change to dual-delete/queue/throttle; pulls never enqueue success statuses (UXN-3).** Harness: invert `saved-flash-harness.ts` per item 16. Acceptance: blocked mutation → zero Saved; failed delete → "Sync failed — will retry," never Saved/Synced.
*QA focus (Sol):* audit the `sync.ts` diff line-by-line — error-callback only; any behavioral drift in delete/queue/throttle is an automatic kickback regardless of harness state.

**Chunk B QA:** scroll-over-controls across all stepper surfaces → zero writes, zero toasts; blocked/failed/offline scenario matrix rendered honestly through the new arbiter; regression surface: hold-to-repeat, offline flashSaved honesty, UXN-3 (resume pull triggers no success UI); full harness suite; boundary audit (special attention: `sync.ts` behavioral neutrality). **Closes acceptance targets:** scroll→zero writes; ≤1 compact confirmation; historical scroll→no warnings (jointly with C1).

---

### Chunk C — Setup lifecycle & session binding *(items 6, 7, 8, 15 + rename affordance — the structural chunk)*

**Task C1 — Single editability predicate (item 6). ISOLATED.** Files: `setupLifecycle.ts:35-42`, `SetupView.tsx:517`, `App.tsx:1416-1440`. Change: `getSetupEditability` with typed reasons; both call sites use it; `activeEventSetupId` demoted to `in-play-elsewhere` (non-historical, non-delete-blocking, edit-frozen only within the same active weekend). **Do not change** what makes a setup historical — byte-for-byte meaning-equivalent for baseline/final/`lockedAt`/finished-weekend. Harness: `chunk5-setup-harness.ts` both-call-sites-agree fixtures. Acceptance: deliberate edit on historical setup changes zero bytes; non-historical setups editable and deletable on the owner's data pattern; **the chassis-name field is editable on a non-historical setup while a live Race Day exists (N8 criterion).**
*QA focus (Sol):* zero-byte historical assertion is the hard gate; verify historical-definition inputs untouched in the diff; no bundled fixes.

**Task C2 — Session snapshot model and diff engine (item 7, part 1).** Files: `types.ts:198-227`, `App.tsx:1749` (creation hook), `setupLifecycle.ts` (add `diffSetupSnapshots`; de-wire `withSetupDiffLog` from the hot path in `handleSaveSetups`). Change: embedded frozen `setupSnapshot` + `setupId` provenance on SessionRecord, captured at session creation; diff helper; per-press logging removed from live-trackside path; legacy `SetupChange` data preserved read-only; `setupUsed` derived from snapshot at creation. No UI in this task beyond keeping existing views compiling. Harness: snapshot-capture, snapshot-immutability, diff-fixture, zero-append assertions in `chunk5-setup-harness.ts`. Acceptance: creating a session freezes current setup state; later edits never mutate an existing snapshot; an edit burst appends zero `SetupChange` entries.
*QA focus (Sol):* snapshot field is plain frozen data (no live references); sync payload carries it without schema change — if a true Supabase schema change appears required, STOP and flag (out of bounds).

**Task C3 — Session diff UI and Quick Adjust coexistence (item 7, part 2).** Files: `SetupView.tsx:756-762` (computed pending-diff view replaces per-press list), sessions page component (bound diff summary + "Log setup changes" button → Setups tab; notes section untouched), `quickAdjust.ts` (verify-only), `App.tsx:1528-1577` (verify no logging added). Change: pending changes render as computed current-vs-last-snapshot diff labeled "will bind to next session"; each session shows its bound diff compactly; Quick Adjust net rows unchanged as the in-run view; nothing double-logs. Acceptance: the owner's scenario end-to-end — starting setup → hotlaps → changes → create qualifying → qualifying shows the setup state at its start and the diff since hotlaps; sessions page stays uncluttered.
*QA focus (Sol):* walk the exact owner scenario on fixture data; confirm Quick Adjust rows and session diffs agree on net effect with zero duplicated entries.

**Task C4 — Autosave semantics (item 8).** Files: `App.tsx` (dirty tracking; tab-switch, `visibilitychange`/`pagehide`, 30s interval; `flashSaved` call sites), unmount hooks in `SetupView.tsx`/`RaceWeekendView.tsx`. Change: local writes stay immediate; Saved fires only at commit boundaries (leave/background/30s/session-create), exactly once per dirty boundary, through B2's arbiter. Harness: boundary assertions in `saved-flash-harness.ts`. Acceptance: N-press edit burst → zero toasts until boundary, then one; backgrounding flushes; clean boundary → nothing; kill-app-mid-edit loses zero data.
*QA focus (Sol):* the data-loss check is non-negotiable — simulate process death mid-burst, relaunch, all edits present.

**Completion (2026-07-18): PASS 100/100.** SOL High implementation `83230c9` uses exactly `App.tsx` plus `saved-flash-harness.ts`. Independent Extra High QA verified immediate local persistence, one memory-only dirty controller, every named boundary, arbiter priority/no resurrection, exact 23/24 matrix, 132 assertions with 29 unique mutations killed, exact lint/build baselines, correct-site draft, and authenticated debug-emulator process-death/tab/timer/session scenarios. No C4 repair remains; C5 is active.

**Task C5 — Setup naming and rename affordance (item 15 + item 6b).** Files: `SetupView.tsx:300, 487` (required name, no `Setup #N` fallback on blank path, copy path autonames), `:587-591` (pencil affordance focusing the chassis field). Harness: blank-create rejected, copy autonames. Acceptance: cannot create an unnamed blank setup; rename is visibly discoverable and works on non-historical setups.
*QA focus (Sol):* copy path friction unchanged; affordance visible at 360px.

**Completion (2026-07-18): PASS 100/100.** SOL High implementation `1a3d492` uses exactly `SetupView.tsx` plus `chunk5-setup-harness.ts`. Independent Extra High QA verified guarded zero-write blank rejection, source-derived copy naming, exact named blank creation, a 44px editable-card pencil, exact Chassis-input focus, historical/event-owned view-only state, immediate rename persistence with one later C4 boundary confirmation, and relaunch persistence while a live Race Day remained unchanged. The production-bound harness runs 84 C5 assertions and kills 20 independent mutations; all focused regressions, exact 23/24 raw matrix, exact lint/build baselines, correct-site draft, authenticated three-width/theme/scale Android owner scenario, debug APK, scope/clean, and cavecrew review pass. No C5 repair remains; the mandatory Chunk C integrated QA gate is active.

**Chunk C QA:** full setup-lifecycle regression (baseline/final/locked/finished-weekend fixtures unchanged in behavior); the owner scenario end-to-end including Quick Adjust interleaved; autosave boundary matrix (tab switch, background, timer, session create); no per-press log entries anywhere; legacy change-log data still renders; full harness suite; boundary audit with special attention to C1's ISOLATED footprint and lifecycle meaning-equivalence. **Closes acceptance targets:** historical scroll→no warnings (fully); deletion-unblocking precondition for Chunk D; the new N5/N2/N7/N8 targets — session-bound diffs correct, save moments at boundaries only, named setups, working rename.

---

### Chunk D — Deletion integrity & data trust *(items 11a, 11b, 12 — every task ISOLATED)*

**Task D1 — Zero-row delete detection (item 11a). ISOLATED — first named exception to the protected-path freeze.** Files: `sync.ts:23-37`, `App.tsx:729-730` — exact footprint, nothing else. Change: delete with `.select('id')`; zero rows = failure; intent stays queued; status via B3's renderer. Harness: zero-row assertion in `saved-flash-harness.ts`. Acceptance: cloud-blocked delete keeps retrying, never renders success, no resurrection on next pull.
*QA focus (Sol):* diff footprint matches the named lines exactly; on escalation the same restriction binds Sol.

**Task D2 — Clear-All-Data trust fix (item 11b). ISOLATED — second named exception to the protected-path freeze.** Files: `App.tsx:484-547` + the clear-data dialog component; reuse existing `queueSharedCloudDelete` + push pairing; `teamDataOwnership.ts` read-only. Change: team-resolved users get the two-option dialog — "Clear this device only" (honest re-sync warning, zero cloud deletes) vs "Delete my records everywhere" (cloud deletes for owned records only, per teamDataOwnership, through existing pairing); non-owned records never cloud-deleted and the dialog says so; solo/unresolved flow unchanged. **No new delete primitives; UXN-1 pull-filtering untouched.** Harness: device-only queues zero deletes; everywhere queues exactly the owned set; post-clear resume pull does not resurrect owned-deleted fixtures. Acceptance: the owner's repro (clear → create car → resume) no longer resurrects owned data on the "everywhere" path, and the "device only" path says exactly what will happen.
*QA focus (Sol):* ownership enumeration against `teamDataOwnership` fixtures — no over-deletion (a non-owned record queued for cloud delete is an automatic fail), no under-deletion of owned records; dialog copy states both behaviors plainly.

**Task D3 — Car cascade delete (item 12). ISOLATED.** Product files are exactly `App.tsx` orchestration, `GarageView.tsx` enumeration/strong confirmation, `SettingsView.tsx` Garage prop transport only, and `SetupView.tsx` disabled-delete reason plus existing Garage-link use only. The latter two bounded files are an explicit scope correction: the required prop route and setup-card link cannot be implemented inside App/Garage alone. Change: enumerate the selected car's setups, personal tires, shock sessions, car-scoped maintenance components, and their maintenance logs; strong confirmation; remove each through the existing queue+push pairing before the car; preserve active-car/setup reassignment. Affected Race Day top-level setup pointers may be cleared and pushed only when they reference a removed setup, but every Race Day and every `sessions[]` byte—including `setupId` and embedded `setupSnapshot`—must survive unchanged. Rig/global maintenance and other cars' records remain untouched. Disabled setup-Delete buttons state the canonical reason and link to Garage. **No new delete primitives; no queue bypass; no pull-filtering changes.** Assertion files are bounded to `car-delete-undo-harness.ts`, `confirm-sheet-harness.ts`, `saved-flash-harness.ts`, and `chunk5-setup-harness.ts`; retain all prior proof. Acceptance: car deletable after confirmation without manually reaching zero setups; no dangling active selection, dependent record, or top-level setup pointer; no resurrection; session snapshots survive byte-for-byte; an actual Nth queued-delete failure remains queued, shows an explicit terminal error, and never renders Saved/Synced.
*QA focus (Sol):* every cascaded table hits both queue and push; mid-cascade failure path exercised, not just asserted; embedded snapshots verified intact post-cascade.

**Chunk D QA:** the full deletion honesty matrix end-to-end on fixtures — solo clear, team device-only clear, team everywhere clear, RLS-blocked delete, mid-cascade failure, then a resume pull after each; regression surface: dual weekend-delete unchanged, deferred queue mechanics unchanged, 30s pull throttle unchanged, UXN-1 filtering unchanged; full harness suite; **whole-chunk boundary audit is mandatory here** — cumulative D diff reviewed line-by-line against the protected-path list, confirming the only protected-path changes are D1's and D2's named footprints. **Closes acceptance targets:** deletion honest, no orphan/resurrection; car delete reachable; clear-data trustworthy.

---

### Chunk E — Navigation clarity & polish *(items 13, 14, Part 3 — the closeout chunk)*

**Task E1 — Context-aware help relocation (item 13).** Files: `App.tsx` header, `helpRouting.ts`, `SetupView.tsx:455` (remove), callback-only `RaceWeekendView.tsx`, and `FourBarQuickAdjust.tsx:118` (verify unchanged). The RaceWeekend callback is an explicit scope correction: its FourBar sheet visibility is child-local, so App cannot truthfully resolve a visible panel without a boolean open/close/unmount signal. Change: header "?" beside Tuning Guide, resolving section at tap time via `APP_GUIDE_SECTIONS` — `'four-bar'` when the panel is visible, `'setup'` on the Setups tab, mapped section elsewhere, guide root otherwise; Tuning Guide button untouched. Harness: section-resolution assertions. Acceptance: deep links preserved from the header in both contexts; no inline "?" remains on the setup sheet; closing/back/tab departure cannot leave stale FourBar context.
*QA focus (Sol):* tap the header "?" in every tab context; `'setup'` and `'four-bar'` resolutions verified.

**Task E2 — Add-X labeling convention (item 14).** Files: `GarageView.tsx:250-253`, `TiresSubView.tsx:141`, `RaceWeekendView.tsx:700-703`, `TrackersView.tsx:681`; convention noted in `CODEBASE_KNOWLEDGE.md`. Change: submits become "Create Car"/"Create Tire"/"Create Race Day"/"Create Job"; openers unchanged. Acceptance: no surface has identical opener/submit labels; grep for the old strings returns only openers.
*QA focus (Sol):* copy-only diff; all four surfaces; casing consistent with A4's typography.

**Task E3 — Small fixes (Part 3).** Files: `App.tsx:1092, 1108`, `index.css:174`, `location.ts` (annotation only). Change: additive unmount guards + `.catch`; coarse-pointer scoping of the scrollbar rule; stub annotation. No harness changes expected. Acceptance: strictly additive.
*QA focus (Sol):* anything beyond guards/`.catch`/scoping/annotation → kickback. This task closes the sprint; its light QA rolls into the final full-sprint QA.

**Chunk E QA:** rolls directly into the final full-sprint QA pass (6.3) — no separate chunk gate; regression surface is the whole branch. **Closes acceptance targets:** all remaining (help deep links, labeling clarity).

---

### 5.2 Boundary statement

Not authorized to: merge to `master` or push `codex/ux-overhaul` (or any branch) to a remote; build, sign, or distribute APKs or modify anything under `release/` (5.1.4 remains the latest installable; 5.1.3 remains do-not-distribute); publish or promote any Netlify deploy beyond draft previews; modify Supabase schema, RLS, migrations, or edge functions; alter the dual weekend-delete pattern, the team-owner canonical-write rules, the account-scoped deferred delete queue, or UXN-1 pull-filtering *except* the **two named exceptions**: (1) Task D1's zero-row detection change, bounded to `sync.ts:23-37` and `App.tsx:729-730`, and (2) Task D2's clear-data cloud-delete change, bounded to `App.tsx:484-547` plus its dialog component, queuing deletes only for records owned per `teamDataOwnership` through the existing `queueSharedCloudDelete`+push pairing; alter the UXN-3 pull-on-resume throttle or generation isolation; change setup lifecycle role/history/immutability semantics beyond the explicitly bounded demotion in Task C1; sync `activeCarId`/`activeWeekendId` (they stay localStorage-only); disable pinch-zoom; regress focus, keyboard, or safe-area behavior; or begin any Sprint 4 IA work, which remains blocked until this plan ships and the owner re-reviews on device. These boundaries bind **both** agents identically — Sol operating under the escalation rule inherits every restriction Terra had, including both exceptions' line-level scope. The role assignments, escalation rule, caveman/cavecrew usage, ISOLATED flags, and Ralph-loop discipline in 5.0 are part of this work order's contract, not optional process advice.

---

## Part 6 — QA Cadence and Third-Party Review Handoff

Three QA tiers now exist: **light QA** after every task (6.1, unchanged from v1), **chunk QA** after every chunk (6.2, new), and the **final full-sprint QA** (6.3, v1's 6.2 carried forward). The handoff document spec (6.4) is v1's 6.3, unchanged in substance.

### 6.1 Light QA after every task

Sol High runs a light QA pass immediately after Terra completes each task, before `ralph/STATE.md` advances. Light QA is bounded and fast — it verifies the task, not the sprint. Sol checks, in order:

1. **Acceptance criteria** — every acceptance clause of the task, verified directly (viewport checks at the task's named sizes/scales where applicable, not sampled).
2. **Harness suite** — the full suite green, and the task's new/changed assertion demonstrably meaningful (fails if the change is reverted; spot-check once per new assertion).
3. **Boundary compliance** — diff footprint inside the task's named files, honoring "do not" clauses and 5.2. For ISOLATED tasks (C1, D1, D2, D3), any unrelated change is an automatic fail even if functionally correct.
4. **Commit hygiene** — one commit, code plus harness together, message identifying the task.
5. **Ralph state** — `CURRENT_TASK.md` matched what was built; `STATE.md` update staged correctly.

**Pass:** Sol records it (caveman note), state advances. **Fail (kickback):** Sol rewrites the task instruction in `ralph/CURRENT_TASK.md` — what failed, the evidence, what the next attempt must do differently; Terra's retry executes Sol's revision. **Escalation:** after more than 2 consecutive failures on one task, Sol implements directly under identical criteria and records the escalation; Sol's own fix still receives the five-check record.

### 6.2 Chunk QA — the middle tier (new in v2)

After the last task of a chunk passes light QA, Sol runs the chunk gate before the next chunk opens. Task-level QA verifies tasks; chunk QA verifies the *increment*. Checklist:

1. **Chunk acceptance targets together** — every acceptance target the chunk claims to close (listed per chunk in 5.1), re-verified on the chunk's final state as a set, at the standard viewports/scales where applicable, including the owner-scenario reproductions named in the chunk QA scope.
2. **Cross-task interactions within the chunk** — the pairings task QA cannot see (e.g., A4's tier-down × A2's reservation math; B2's arbiter × B3's error persistence; C2's snapshots × C4's boundaries; D1's detection × D2's everywhere-path). Sol enumerates the pairs before testing, in the chunk QA note.
3. **Full harness suite** in a single run, output captured.
4. **Chunk-scoped boundary audit** — the cumulative chunk diff reviewed once against 5.2; for Chunk D this is line-by-line on protected paths.
5. **State record** — chunk completion entered in `STATE.md` with the QA evidence reference; the chunk boundary is a valid owner-review stopping point and the note says whether owner review is recommended (mandatory suggestion after Chunk A).

Failures are kicked back to the offending task with its existing failure count carried forward.

### 6.3 Final full-sprint QA pass

After Chunk E's last task, Sol runs one comprehensive pass over the finished sprint as a whole — chunk QAs do not substitute, because cross-chunk interactions (density × sticky reservation × scale migration; editability × arbiter × session snapshots × delete detection; autosave boundaries × clear-data) are exactly what chunk-scoped QA cannot see. Scope: **every Part 2 acceptance target** re-verified together on final branch state — all viewports, both scales, all owner complaint scenarios from both feedback rounds reproduced end-to-end; **every risk note** in Part 2/Part 4 re-checked (mitigated or explicitly carried as residual); **the full harness suite in a single run**, output captured verbatim for the handoff; **a whole-branch boundary audit** of `master...codex/ux-overhaul` against 5.2, confirming the only protected-path changes are the two named exceptions and C1's bounded demotion. Failures use 6.1 kickback mechanics scoped to the offending task, counts carried forward. The sprint is complete only when this pass is green and `STATE.md` records it.

### 6.4 End-of-sprint handoff document — specification

Once implementation and final QA are complete, Sol High produces the handoff document. Its sole purpose is to brief a **future, different model/agent** — a fresh, independent third-party reviewer — so that agent can review the finished work **with no other context**. Full prose (never caveman; the reader is cold). It must contain:

1. **Branch and commit state** — branch name, base commit, final HEAD SHA, and a chunk/task→commit map for all tasks.
2. **Per-task diff summary** — files touched, exact nature of the change, and the harness changes that lock it.
3. **Before/after evidence for the original owner complaints** — both feedback rounds — screenshots or exact repro steps at the test viewports/scales, tied to each Part 2 item.
4. **Full harness suite results** — verbatim final-run output from 6.3, pass/fail per harness.
5. **Deviations from this plan and why** — every divergence from Part 5's task text, all kickbacks, all escalations (which tasks, attempt counts, who implemented).
6. **Known residual risk and deferred items** — anything carried forward, plus anything discovered and deliberately not fixed.
7. **Explicit non-goals and boundary reminders** — the 5.2 statement restated, so settled decisions (dual weekend-delete, deferred queue, pull throttle, Sprint 4 IA deferral, the two bounded exceptions) are not re-litigated.
8. **Traceability pointers** — this document (v2), its v1 predecessor, and `docs/HANDOFF_MOBILE_DENSITY_REVIEW_2026-07-17.md`, so the reviewer can reconstruct complaint → review → plan → implementation.

Two absolute constraints: **it is a briefing packet, not a verdict** — it must not claim or imply the third-party review has passed (it may report the sprint's own QA passed, with evidence; judgment belongs to the future reviewer); and **producing it is the deliverable that unblocks the third-party review**, which is a separate future step by a separate agent and does not begin until this document exists complete.

---

## Acceptance targets (unchanged from v1, plus v2 additions — all bind)

Carried: test at 360×800, 390×844, 412×915, and the 1080×2118 capture; Default materially denser than 1.15; no unreadable text; 2 setup columns / 3 four-bar columns; Save Run never obscures; 4 pressure controls distinct at both scales; scroll → zero writes; historical scroll → no warnings; deletion honest, no orphan/resurrection; ≤1 compact confirmation; nothing behind nav; pinch-zoom stays. Added in v2: session-bound diffs match the owner's hotlaps→qualifying scenario; Saved appears only at commit boundaries, small, at top; clear-data does exactly what its dialog says on both paths; rename works and is findable; no unnamed blank setups; no identical opener/submit labels; help deep links survive the header move.

---

## Sources

- `AGENTS.md`, `HANDOFF.md`, `SPRINT_INDEX.md`, `ralph/STATE.md`, `ralph/CURRENT_TASK.md`, `CODEBASE_KNOWLEDGE.md`, `docs/HANDOFF_MOBILE_DENSITY_REVIEW_2026-07-17.md` (repo root)
- Owner feedback round 2, 2026-07-17 (items N1–N9 as addressed in Part 2)
- Screenshots: `Screenshot_20260717_074317_Crew Chief.jpg` (Dashboard), `Screenshot_20260717_074518_Crew Chief.jpg` (Setups/Tires), `Screenshot_20260717_081519_Crew Chief.jpg` (Runs/QuickAdjust) — `G:\My Drive\Google AI Studio\`
- Direct source inspection: `src/App.tsx`, `src/index.css`, `src/types.ts`, `src/components/{SettingsView,ContextStrip,SetupView,FourBarQuickAdjust,RaceWeekendView,TiresSubView,GarageView,TrackersView,ui/NumberStepper}.tsx`, `src/lib/{setupLifecycle,quickAdjust,raceDayGate,saveStatus,sync,resumePull,undo,accountDeletion,teamDataOwnership,helpRouting,location}.ts`, `scripts/*-harness.ts` — all in `.worktrees\hide-scrollbars` @ `ab6b98a` (+2 doc commits)
- Predecessor: v1 of this document (superseded by this v2; v1's findings are carried, extended, or explicitly folded as noted per item)

---

## v2.1 Owner Addendum — 2026-07-18 (binds like the rest of this document)

Recorded from the owner (Maxx) via Claude review session, 2026-07-18. Three changes: a runtime/model-routing update, an owner-approval record, and one new task inserted into Chunk C.

### v2.1-A — Runtime and role routing (supersedes 5.0's model assignments only; roles/discipline unchanged)

- **Builder** (implementation subagents): `gpt-5.6-sol` **High**.
- **QA + plan authority** (primary chat agent): `gpt-5.6-sol` **Extra High**. The primary agent does NOT build; it spawns builder subagents for all implementation work, then QAs their output and maintains Ralph state and this plan.
- Terra (any tier) and `cavecrew-builder` remain permanently forbidden.
- Everything else in 5.0 stands: escalation rule, caveman for all working notes/QA verdicts, cavecrew pattern for subagent delegation, Ralph-loop discipline, ISOLATED flags.

### v2.1-B — Owner approvals recorded

1. **C2 repair scope extension APPROVED:** `scripts/offline-indicator-harness.ts` may be modified, solely to normalize read `src/App.tsx` source CRLF→LF before existing mutation checks. (Mirrored in `ralph/CURRENT_TASK.md`.)
2. **Standing approval — harness portability fixes:** assertion-only EOL/portability fixes to harness files outside a task's exact file list are pre-approved when (a) zero product code changes, (b) no assertion weakened or removed, (c) commit message names every out-of-list harness file touched. Anything beyond EOL/portability normalization needs fresh owner approval.

### v2.1-C — New Task C2.5 — Setups corner-card alignment + stacked stepper redesign (owner priority)

Runs immediately after C2's repair passes QA, before C3. Not ISOLATED, but keep the diff to the named files.

**Owner problem statement.** On the Setups page corner cards (LF/RF/LR/RR), fields are visibly staggered/misaligned: short text inputs (Spring, Shock, Shock Note, Tire Compound, Tire Size) sit beside tall stacked steppers (Scale Weight, Ride Height C-to-C, Caster, Camber, Pressure, Backspacing), so the two grid columns drift out of row alignment and leave ragged empty gaps. Additionally the stacked stepper's current vertical order (− / value / +) is wrong. Owner wants every stacked stepper laid out as:

```
-----VALUE-----
(  -  )  (  +  )
```

Value (with unit) full-width on top, tap-to-edit; below it one row with − and + side by side, each half-width and ≥44px tall.

**Root cause (verified 2026-07-18).** `NumberStepper` renders inline `[−][value][+]`. `SetupView.tsx` (`NumericCornerFieldInput`, ~line 94) and `TiresSubView.tsx` (~line 138) force a vertical stack via arbitrary-variant CSS on the wrapper (`[&_[role=group]]:flex-wrap ... [&_[role=group]>button]:basis-full`), which stacks children in DOM order: −, value, +. The corner grid (`grid-cols-1 min-[360px]:grid-cols-2 gap-2`) then sizes each row to its tallest cell; mixed short-input/tall-stepper pairings plus conditional notes (`pressureSourceNote`, legacy notes) and label wrap differences produce the staggering.

**Files:** `src/components/ui/NumberStepper.tsx`, `src/components/SetupView.tsx`, `src/components/TiresSubView.tsx`.

**Change:**
1. Add a first-class `layout?: 'inline' | 'stacked'` prop to `NumberStepper` (default `'inline'`, zero visual change for existing inline call sites). `stacked` renders: row 1 = full-width value region (tap-to-edit, `tabular-nums`, unit inline, ≥44px); row 2 = grid of two buttons `[−][+]`, each 50% width, ≥44px tall, with the same pointer/repeat semantics. B1's commit-on-pointerup, slop-cancel, and hold-repeat cadence (350ms/100ms) are untouched — this is layout-only.
2. Remove the arbitrary-variant stacking hacks from `SetupView.tsx` and `TiresSubView.tsx`; pass `layout="stacked"` instead.
3. Align the corner-card grid: cells align to row start; labels get a consistent single-line treatment (truncate or reserve equal height) so adjacent cells' controls sit on the same line; conditional notes render below the control without shifting the neighbor cell's control position.

**Harness:** extend `setup-touch-target-harness.ts` (or `chunk5-setup-harness.ts` where the corner-grid assertions live): stacked variant renders value above the button row; both buttons ≥44px and half-width; inline call sites byte-identical rendering; no arbitrary-variant `basis-full` selectors remain in `SetupView.tsx`/`TiresSubView.tsx`.

**Acceptance:** at 360×800, 390×844, 412×915, both Default and Large scales — every stacked stepper shows value on top with −/+ side-by-side below; corner-card columns row-align with no ragged gaps; no clipping/overlap; hold-repeat and scroll-over-stepper (zero writes) behavior unchanged; Tires sub-view stepper matches.

*QA focus (Sol XH):* screenshot the LF/RF corner cards at 360px before/after — the staggering in the owner's 2026-07-18 screenshot must be gone; mutation-check the new layout assertions once; confirm zero timing-logic diff in NumberStepper.

### v2.1-D — Current progress snapshot

A1–A4 + Chunk A QA: PASS. B1–B3 + Chunk B QA: PASS. C1: PASS. C2: PASS 98/100 on QA attempt 2 (`253897a` product + `13b556f` EOL-portability repair). C2.5: PASS 100/100 on QA attempt 2 (`8ab870a` feature + `2235c7d` bounded geometry repair). C3: PASS 100/100 on QA attempt 1 (`e8d7016`). C4: PASS 100/100 on QA attempt 1 (`83230c9`). C5: PASS 100/100 on QA attempt 1 (`1a3d492`). Chunk C integrated QA: PASS 100/100 on attempt 1. D1: PASS 100/100 on attempt 1 (`1ca3576`). The owner-requested pre-D2 setup-label microfix passed 100/100 at `dc5c63d`. D2: PASS 100/100 on QA attempt 2 (`803d5d0` feature + `e29c0f0` structured-notice repair). D3: PASS 100/100 on QA attempt 2 (`120fa72` feature + `a5e72d0` null-identity repair). Chunk D integrated QA: PASS 100/100 on attempt 1. The cumulative gate verifies exact D1/D2/D3 scope and ancestry, selected-row proof, ownership-safe clear modes, dependency-ordered car cascade, five-second retry and pull filtering, preserved Race Day/session history, signed-out zero-cloud local deletion, honest status priority, exact focused/raw/lint/build baselines, unchanged accepted draft/debug APK, no resurrection, clean tree, and independent reviewer pass. E1 is active. Remaining: Chunk E (E1–E3), final full-sprint QA, Part 6.4 handoff document.

The owner supplied a dedicated Crew Chief account for D2 destructive QA and authorized clearing only that account's owned racing data. Credentials remained outside repository files and worker contracts. The SOL High builder used mocks only. Primary QA ran device-only first, then everywhere last, and left owned racing data cleared. Account deletion, authentication deletion, team or membership changes, and deletion of another user's data remained forbidden.

### v2.1-E — Boundary amendment (5.2): emulator testing authorized

Owner authorizes **debug** APK builds (`gradlew assembleDebug`) installed to a locally running Android emulator for QA verification. Netlify remains draft-preview-only for quick inspection (Codex built-in browser). Everything else in 5.2 stands: no release/signed builds, no distribution, no `release/` changes, no production Netlify publish, no master merge/push, no Supabase schema/RLS/migration changes.

### v2.1-F — QA reporting requirement

At the end of every task QA and every chunk QA, the QA agent writes/updates a **plain-English owner report** at `docs/OWNER_REPORT_UX_OVERHAUL.md`: what was built, what was checked, what passed/failed, what's next — no caveman, no jargon walls. This is in addition to (not instead of) Ralph state updates.
