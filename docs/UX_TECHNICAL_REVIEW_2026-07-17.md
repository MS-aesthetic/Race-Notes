# CREW CHIEF — Mobile Density, Read-Only Authority, and Deletion Integrity Review
**Independent UX/Technical Review — 2026-07-17**
**Scope:** Analysis and specification only. No feature code was edited, no build/deploy/migrate/merge/push was performed.
**Branch under review:** `codex/hide-scrollbars` @ `ab6b98a` (worktree `.worktrees\hide-scrollbars`), 5 commits ahead of `master@47db364`, unmerged.
**Inputs:** AGENTS.md, HANDOFF.md, SPRINT_INDEX.md, ralph/STATE.md, ralph/CURRENT_TASK.md, CODEBASE_KNOWLEDGE.md, docs/HANDOFF_MOBILE_DENSITY_REVIEW_2026-07-17.md, 3 owner-supplied screenshots (2026-07-17), and direct source inspection of the v4 worktree.
**Owner priority governing every trade-off below:** visibility of information first; readable/operable text and deliberate controls; do not let glove-first sizing dominate normal phone layout; Default 1.0 or targeted reductions both acceptable, chosen by viewport evidence, not by preserving 1.15.

---

## Part 1 — Executive Summary

Most of what the owner is experiencing traces back to two mechanisms, not fifteen separate bugs. The first is a **scale/floor mismatch**: the app applies a single ancestor CSS `zoom` whose *minimum* value is 1.15 (the `'standard'`/1.0 tier was removed in UXP-4, and `normalizeTheme` collapses every stored value to `'large'`), while UXP-14 independently hardcoded ≥48px touch-target floors into SetupView inputs, `.tap-target` steppers, and the header/nav. Those two decisions multiply: on a 360 CSS-px phone, 1.15 zoom leaves ~313px of effective layout width, which is below what the two-column grids and the paired 48px stepper buttons were designed for. That one mismatch explains the oversized content, the cut-off information, the tire-pressure "+/psi" collision in screenshot 3, the per-corner scrolling in screenshot 2, and why commit d047791's multi-column work never actually improved density.

The second mechanism is a **single causal chain running from accidental activation through divergent read-only enforcement to dual toast channels** — and this hypothesis holds up against the code. SetupView's UI gate (`SetupView.tsx:517`) locks not just genuinely historical setups but *every other setup whenever any Race Day has an `activeSetupId`* — with the owner's real data, that makes everything read as historical/view-only, which disables setup deletion, which (because Garage requires zero scoped records before car delete) produces the car-delete deadlock. Meanwhile, a touch that lands on a stepper's ± button starts the press-repeat timer on `pointerdown` before the browser knows the gesture is a scroll; the attempted mutation flows into `handleSaveSetups` (`App.tsx:1416-1440`), whose *second, independently coded* edit gate silently reverts the change — but the incomplete UXP-18 work still flashes "Saved" unconditionally, while the block simultaneously fires the "view-only" info message on a *separate* single-slot channel. Two independent one-shot channels co-rendering is the "notification bombardment" in screenshot 2. So one chain explains "everything is historical," "car delete deadlock," "scrolling activates controls," and "bombardment" together.

On top of these, the feedback layer is structurally dishonest: the toast renderer whitelists only `Syncing…`/`Synced` and silently drops every other status, all `sync.ts` push helpers swallow errors to `console.warn`, and `deleteTeamSharedRecordFromCloud` treats a zero-row delete as success and drops the retry intent — a genuine silent-resurrection bug. None of the protected behaviors (dual weekend delete, deferred delete queue, pull throttle, lifecycle immutability semantics) need to change in *meaning* to fix any of this; the plan below reuses them and touches them only where explicitly named.

---

## Part 2 — Numbered Resolution Plan

### 1. Default/Large scale and existing-theme migration

**Current state.** `App.tsx:607-611` maps `theme.fontSize` through `ZOOM = {large: 1.15, xlarge: 1.45}` into `--ui-zoom`, applied as ancestor `zoom` in `index.css:117-131`. `types.ts:484-491` has no 1.0 value; `normalizeTheme` (`App.tsx:70-81`) collapses everything — including the retired `'standard'` — to `'large'`, and the new-install fallback (`App.tsx:582`) is `'large'`. Settings (`SettingsView.tsx:310-313`, `341-347`) offers only Default(1.15)/Large(1.45) and Reset hardcodes 1.15.

**Decision.** Reintroduce `'standard'` = 1.0 and make it the Default. The viewport evidence is decisive: at 1080×2118 (~360-412 CSS px), 1.15 zoom reduces effective layout width to ~313-358px, starving the very grids the density work depends on; 1.0 restores the full width and, because the 48px control floors are hardcoded in CSS rather than zoom-derived, every deliberate control stays at or above the 44px WCAG floor even at 1.0. This is the sprint-2 prior art (`docs/archive/sprint-2-quick-wins.md:149-170`) finished properly. Expose **three tiers** in Settings — Default (1.0), Large (1.15), Extra Large (1.45) — reversing UXP-4's two-button collapse, which is itself part of the rejected package. Do not stack a second reduction pass of typography on top in the same change; measure at 1.0 first (item 2 handles targeted floors).

**Migration.** Because `normalizeTheme` collapsed all values to `'large'`, a stored `'large'` today is indistinguishable from an explicit choice — and the owner's own device stores `'large'` only because of that collapse. Do a **one-time versioned remap**: bump the theme storage schema (new key or version field on `race_notes_theme`), remap `'large'` → `'standard'` exactly once, and preserve `'xlarge'` untouched (it was never a collapse target, so it represents a real accessibility choice). Anyone who genuinely wants 1.15 re-picks Large once; the alternative (leaving `'large'` in place) fails the acceptance target "Default must be materially denser than 1.15x" on the owner's actual device. Theme is localStorage-only and never synced, so there is no cross-device conflict. Reset-to-Defaults changes to `'standard'`.

**Files.** `types.ts:484-491`, `App.tsx:70-81`, `:582`, `:607-611`, `SettingsView.tsx:310-313`, `:341-347`.
**Harness.** `scripts/chunk6a-refinement-harness.ts` byte-locks the `{1.15, 1.45}` map and two-button Settings — must be updated in the same commit to assert the three-tier map with `standard: 1.0` as default and Reset→standard.

### 2. Header, context strip, navigation, Setup, four-bar, and Run density

**Current state.** Header `py-3` + `min-h-12` + `text-[20px]` icons (`App.tsx:2145-2192`); ContextStrip chips `min-h-12` (`ContextStrip.tsx:39-94`); bottom nav `h-16` with an `!important` height override (`index.css:143-146`) *plus* an extra `scale-105` on the active tab — a second multiplier stacked on the global zoom. SetupView's `INP` class is `min-h-12` (`SetupView.tsx:59-60`, byte-locked), the corner form uses a desktop-oriented `lg:grid-cols-2`, `.tap-target` is a hard 3rem (`index.css:249-255`), FourBarQuickAdjust's `compact` prop doesn't actually compact its 20 always-48px stepper rows, and RaceWeekendView's Active Session freeform inputs (`RaceWeekendView.tsx:~1150-1212`) have *no* floor at all (~36-40px effective).

**Decision.** With Default at 1.0, the density problem becomes targeted, not global. Do a floor-*equalization* pass rather than a shrink-everything pass, per the owner's "readable/operable but info-first" rule: (a) reduce the shared interactive floor from 48px to the 44px WCAG minimum — `min-h-12`→`min-h-11` on `INP`, header buttons, and ContextStrip chips; `.tap-target` 3rem→2.75rem; (b) raise RaceWeekendView's freeform inputs *up* to the same 44px floor so dropping zoom doesn't make them the new outlier; (c) remove the bottom-nav `scale-105` active-tab multiplier outright; (d) change the setup corner form from `lg:grid-cols-2` to a phone-first `min-[360px]:grid-cols-2` so the acceptance target "2 setup columns at normal portrait widths" is actually reachable on phones; (e) make FourBarQuickAdjust's `compact` prop real — collapse the 3-row label/value/control stack into a single label-inline row per stepper, keeping the ± buttons at the 44px floor, which is where the "per-field consumes most of the screen" complaint actually lives. Header/nav heights otherwise stay: at 1.0 they meet the acceptance target "consume only space needed for safe-area + readable controls" without further surgery.

**Files.** `App.tsx:2145-2192` and nav button markup, `ContextStrip.tsx:39-94`, `SetupView.tsx:59-60` and corner-form grid, `index.css:143-146`, `:249-255`, `FourBarQuickAdjust` component, `RaceWeekendView.tsx:~1150-1212`.
**Harness.** `scripts/setup-touch-target-harness.ts` (byte-diff lock on the exact `INP`/select strings — fails on any change), `scripts/chunk5-setup-harness.ts`, and `chunk6a-refinement-harness.ts` if it locks nav classes. All in the same PR; see item 10 for converting these from byte-locks to behavioral assertions.

### 3. Non-obscuring Save Run placement

**Current state.** `.sticky-action-bar` (`index.css:266-275`) is `position: sticky; bottom: 0; z-index: 20` with safe-area padding — correctly sticky, not fixed — but no space is reserved beneath the scrollable content, so the pressure grid, QuickAdjustPanel, and attachments scroll flush underneath it, and screenshot 3 shows the last content row additionally sliced by the bottom nav.

**Decision.** Keep it sticky. Moving Save Run purely in-flow fails the acceptance target "still reachable without unreasonable scroll" on a page this long; the actual defect is the missing reservation. Add bottom padding to the RaceWeekendView scroll container equal to the bar's height plus safe-area inset, so the last content item always clears the bar; give the bar an opaque background and top border so nothing reads as "floating over" content; and render it only while the "CHANGES MADE" dirty state is true so it consumes zero space otherwise. Separately, audit the main scroll container for global bottom padding of `calc(4rem + env(safe-area-inset-bottom))` to fix the content-sliced-by-nav defect app-wide (this also covers Setups and Dashboard).

**Files.** `index.css:266-275`, `RaceWeekendView.tsx` (container + conditional render), `App.tsx` main scroll container.
**Harness.** None currently locks this; add an assertion to `chunk5-setup-harness.ts` or a small new check that the sticky bar's height is reserved (see item 10).

### 4. Collision-free tire-pressure controls

**Current state.** The Run pressure grid at `RaceWeekendView.tsx:1279` is a hardcoded `grid grid-cols-2 gap-2` with no responsive fallback — the only grid in the app without one. Inside each ~120-140px column, NumberStepper's two ± buttons are `tap-target shrink-0` (hard 48px each, `NumberStepper.tsx:130-131`) and the center value/unit is `min-w-0 flex-1` with no overflow handling (`:153`), so the center absorbs all the squeeze — producing the literal "+ overlapping psi" glyph collision in screenshot 3.

**Decision.** Fix the grid, and harden the stepper as a backstop. Replace `grid-cols-2` with `grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr))` (or the Tailwind arbitrary equivalent). This is deliberately chosen over a `min-[360px]:` media-query breakpoint because media queries evaluate against the *viewport*, not the zoom-reduced effective width — auto-fit minmax measures actual available space inside the zoomed subtree, so it degrades to one column automatically at Large/Extra Large, satisfying "all 4 controls fit with distinct minus/value/unit/plus regions at Default AND Large" with a single rule. In NumberStepper: value gets `whitespace-nowrap tabular-nums`, unit becomes its own `shrink-0` small-text element, and buttons adopt the 44px floor from item 2, guaranteeing ~80px of center width even in a worst-case 168px column.

**Files.** `RaceWeekendView.tsx:1279`, `NumberStepper.tsx:130-131`, `:153`.
**Harness.** Verify whether `setup-touch-target-harness.ts` or `chunk6a` byte-locks NumberStepper/`.tap-target`; update in the same commit if so.

### 5. Scroll-safe NumberStepper behavior

**Current state.** The investigation confirmed there is no scroll-jacking: no wheel/touchmove handlers, `touch-action: none` scoped only to the ± buttons, and the only `preventDefault` is on contextmenu. The real risk is that a scroll gesture *beginning* on a ± button fires `onPointerDown` before the gesture is disambiguated, starting the 350ms press-repeat timer — mutation-on-pointerdown with no movement-threshold cancel.

**Decision.** Two changes. First, **commit on pointerup, not pointerdown**: the single-step increment fires only on pointerup with no significant movement; the repeat timer still arms at 350ms but any pointermove beyond an ~8px slop, or any `pointercancel`, cancels the timer with zero writes committed. Second, relax the buttons from `touch-action: none` to `touch-action: pan-y` so a vertical scroll that happens to start on a button is handed to the browser (which then fires `pointercancel`, which the cancel path handles) instead of dead-zoning the scroll — important now that item 2 leaves 20+ steppers on screen. A stationary press-and-hold still never pans, so hold-to-repeat keeps working; contextmenu suppression already exists. This directly satisfies the acceptance target "scroll beginning over a setup field → zero writes unless the gesture becomes deliberate activation," and — combined with items 7/8 — eliminates the accidental Saved/view-only toast pair at its source.

**Files.** `NumberStepper.tsx` (pointer handlers and the `touch-none` class), shared by SetupView, FourBarQuickAdjust, and RaceWeekendView.
**Harness.** `scripts/saved-flash-harness.ts` gains the "scroll gesture produces zero writes and zero toasts" assertion (see item 10).

### 6. Canonical Setup read-only authority — one rule, not two

**Current state.** `isSetupLocked()` (`setupLifecycle.ts:35-42`) is the real predicate (baseline/final role, `lockedAt`, or weekend-role with finished parent). But `SetupView.tsx:517` ORs in a second condition — *any* other setup is read-only while *any* Race Day has an `activeSetupId` — and `App.tsx:1416-1440`'s `handleSaveSetups` recomputes its own similar-but-different `canEdit`. The OR clause is the most probable cause of "every setup shows as historical" on the owner's real data.

**Decision.** Create one exported function — `getSetupEditability(setup, weekends, activeEventSetupId)` in `setupLifecycle.ts`, returning `{ editable, deletable, reason }` with a typed reason enum (`historical-role`, `locked`, `finished-weekend`, `in-play-elsewhere`) — and make it the *only* gate both `SetupView.tsx:517` and `handleSaveSetups` call. The lifecycle semantics of `isSetupLocked` (baseline/final/finished-weekend immutability) do not change in meaning — that is protected behavior. What changes is the demotion of the `activeEventSetupId` clause: a setup that is merely "not the one in play" is no longer presented as historical, is not edit-frozen unless it belongs to the same active weekend, and is **never** rendered undeletable by that clause alone. Deletability is computed separately from editability so the deadlock in item 9 can't recur through this path. Every UI string and disabled state derives from the returned reason, killing the three-divergent-copies problem (item 7) and the false-Saved-on-block problem (item 8) at the same root.

**Files.** `setupLifecycle.ts:35-42` (extend), `SetupView.tsx:517`, `App.tsx:1416-1440`.
**Harness.** `scripts/chunk5-setup-harness.ts` and `saved-flash-harness.ts` updated in the same commit.

### 7. Historical-mode communication without warning spam

**Current state.** Three different literal strings exist for one concept (`SetupView.tsx:336`, `:351`, `App.tsx:1443`), plus a persisted per-card banner (`SetupView.tsx:584-586`). No single channel stacks with itself — the screenshot 2 "bombardment" is two *independent* single-slot channels (the green Saved toast and the info banner/toast) co-rendering because they are separate state variables, both positioned over the content.

**Decision.** Scrolling produces zero messages — this falls out of item 5 (no writes → nothing to block → nothing to announce). The persisted inline banner on an expanded historical card becomes the *only* passive communication, reworded from the reason enum in item 6 and visually compact. Deliberate interaction with a blocked action (tapping a disabled-looking Delete, attempting an edit path) produces at most one calm info message, deduplicated: identical info messages are suppressed within a short window (~5s). Structurally, merge the two channels into a single notification arbiter with priority ordering — an info/blocked message *replaces* a pending Saved, and a blocked mutation can never enqueue Saved at all (item 8). Consolidate the three literals into one copy source keyed by reason. Toasts already render at `fixed bottom-24`; keep them clear of the sticky bar and shrink them per the owner's "routine feedback too obtrusive" note.

**Files.** `SetupView.tsx:336`, `:351`, `:584-586`, `App.tsx:1443`, toast slot `App.tsx:2213-2244`.
**Harness.** `saved-flash-harness.ts`.

### 8. Subtle, honest save/sync/delete feedback

**Current state.** UXP-18 is incomplete — `handleSaveSetups` always flashes Saved, including on blocked/reverted mutations. The toast renderer (`App.tsx:2213-2244`) hardcodes a two-value whitelist and silently drops every other status, including `'Cloud delete deferred — retrying online'` (`App.tsx:736`) and `'Offline — local data ready'` (`App.tsx:1295`). All `sync.ts` push helpers swallow errors to `console.warn` with no UI signal. `saveStatus.ts` is dead code, never wired. `flashSaved()` itself is honest about offline.

**Decision.** Four moves. (a) Finish UXP-18: `flashSaved` fires only when a user-initiated mutation actually persisted — `handleSaveSetups` returns early with no flash on the blocked branch (using item 6's predicate). (b) Delete `saveStatus.ts` rather than wire it; the App-level status state is the real channel and two channels is how we got here. (c) Replace the whitelist with a typed status renderer covering four states — synced, offline-saved, deferred-delete-retrying, sync-error — each rendered compactly (one line, small type, short auto-dismiss for success states, persistent-until-acknowledged for error states). (d) Give the `sync.ts` push/delete helpers an error-branch status callback so a failed cloud write surfaces as "Sync failed — will retry," never a green Saved. The governing rule — a blocked or failed delete must never present as Saved/Synced — is enforced at the arbiter level, not per-call-site, so no future call site can regress it. Protected note: this only *reports* outcomes; it does not alter the dual-delete pattern, the deferred queue, or the 30s pull throttle, and the UXN-3 rule (pull-on-resume must not trigger Saved/deletion UI) is preserved because pulls never enqueue the success statuses.

**Files.** `App.tsx:1416-1440`, `:2213-2244`, `:736`, `:1295`; `sync.ts` push helpers; `saveStatus.ts` (remove).
**Harness.** `scripts/saved-flash-harness.ts` currently byte-locks the always-flash behavior — it must be rewritten, not merely updated (see item 10).

### 9. Reachable Setup/Race Day/car deletion without deadlocks or orphan data

**Current state.** Weekend and setup deletes are correctly paired (queue + push, single implementation, no orphan path found — `App.tsx:1847-1871`, `:1445-1448`, `1571/1664/2020`). Car delete is double-guarded on zero scoped records (`App.tsx:443-481`, `GarageView.tsx:185-195`) with safe active-car reassignment. The deadlock is real but derivative: item 6's over-broad lock makes setups undeletable, so cars can never be emptied, and the only feedback is a disabled button plus a generic toast.

**Decision.** Item 6 dissolves most of the deadlock — non-historical setups become deletable again. Two residuals remain. First, genuinely locked setups (baseline/final snapshots) stay individually undeletable — that immutability is protected and correct — but the disabled Delete button must state *why* (from the reason enum) and link to the cleanup path. Second, the cleanup path itself: replace the "reach zero records manually" requirement with a **confirmed cascade delete on the car** — the Garage delete surface enumerates exactly what blocks it ("3 setups, 1 tire set, 2 shock records"), requires an explicit strong confirmation, and then deletes each scoped record through the *existing* protected pairing (`queueSharedCloudDelete` + the matching push, per table) before deleting the car — no new delete primitives, no bypass of the deferred queue, so no orphans and no cloud resurrection by construction. This satisfies "delete a car after confirmation without manually reaching an impossible zero-setup state." Any failure mid-cascade surfaces as an explicit error per item 8 — never Saved — and already-queued intents simply retry under existing rules. This task touches protected delete paths and is isolated in the work order with its own guardrails.

**Files.** `App.tsx:443-481` (cascade orchestration), `GarageView.tsx:185-195` (blocking-records enumeration + confirm UI), reusing helpers at `App.tsx:1445-1448`/`1847-1871`.
**Harness.** `saved-flash-harness.ts` (no Saved on failed delete); add a cascade-pairing assertion (item 10).

### 10. Exact harness changes and regression gates

Four named harnesses currently **byte-lock the rejected UX** (per `ralph/STATE.md`) and will fail CI on any fix unless changed in the same commit as the code they lock:

- **`scripts/chunk6a-refinement-harness.ts`** — locks the `{large: 1.15, xlarge: 1.45}` zoom map and two-button Settings. Rewrite to assert: `ZOOM` contains `standard: 1.0`; new-install fallback and Reset-to-Defaults both resolve to `standard`; `normalizeTheme` maps unknown/legacy values to `standard`; the one-time `large→standard` migration runs exactly once; three Settings options render. Update with item 1.
- **`scripts/setup-touch-target-harness.ts`** — byte-diff lock on SetupView `INP`/select class strings against an approved commit. Convert from byte-diff to behavioral assertions: every interactive control in SetupView renders with computed min-height ≥44px at zoom 1.0, and the corner form yields 2 columns at ≥360px effective width. Update with item 2 (and verify NumberStepper/`.tap-target` coverage for item 4).
- **`scripts/chunk5-setup-harness.ts`** — locks setup-view structure/behavior. Update for the phone-first grid breakpoints (item 2), the single `getSetupEditability` gate (item 6: assert SetupView and `handleSaveSetups` both call it and agree on every fixture), and add the sticky-bar space-reservation check (item 3).
- **`scripts/saved-flash-harness.ts`** — currently asserts the always-flash behavior; **invert it**: assert `flashSaved` fires exactly once for a real persisted user save; fires zero times for a blocked/reverted mutation; a simulated scroll-start-on-stepper commits zero writes and zero toasts (items 5/7); a failed or zero-row delete never produces Saved/Synced (items 8/9 and Part 3's sync bug).

Standing recommendation: retire the byte-diff-against-approved-commit pattern entirely in favor of behavioral assertions. Byte-locks are how a rejected UX became CI-enforced; this review should be the last time a harness has to be rewritten to *permit* a fix. Gate rule for the builder: every task below lands code + its harness changes in one commit, and the full harness suite runs green before the next task starts.

---

## Part 3 — Additional Bugs Found Beyond the Ten Items

**Team-delete silent resurrection — HIGH.** `deleteTeamSharedRecordFromCloud` (`sync.ts:23-37`) returns `true` whenever `error === null`, but a Supabase delete matching zero rows (e.g., RLS silently filtering a non-owner) also returns `error: null` — the intent is then dropped (`App.tsx:729-730`), local UI shows the item gone, and the cloud row resurrects on next pull with no retry path. Resolution: append `.select('id')` (or count) to the delete and treat zero affected rows as failure — keep the intent queued and surface "delete pending" per item 8. Touches a protected path; isolated task. **LOE: S-M (2-4h including harness assertion).**

**Native-auth state update after unmount — LOW.** `App.tsx:1092`: the async `.then`/`.catch` around the native-auth URL don't re-check the `active` guard before `setNativeAuthError`. Resolution: re-check the flag in both branches. **LOE: S (<1h, pairs with next item).**

**Listener cleanup unhandled rejection — LOW.** `App.tsx:1108`: `void listenerPromise.then(l => l.remove())` has no `.catch`; if `addListener` rejects, cleanup throws unhandled. Resolution: add a swallow-with-log `.catch`. **LOE: S (<1h).**

**Universal scrollbar hiding — LOW (discoverability nit).** `index.css:174` hides scrollbars via the universal selector, removing the scroll affordance from desktop-web horizontal-overflow regions (scrolling itself still works). Resolution: scope the rule to touch contexts (coarse-pointer media query) or to the specific mobile containers it was written for. **LOE: S (<1h).**

**Location-sharing scaffold — LOW (informational, pre-existing).** `location.ts:21`: `startSharing` returns false and `subscribeTeamLocations` is a no-op, both warning silently. Resolution: confirm no UI surfaces a "Share location" entry point (none found in this pass); if one exists, hide it behind a feature flag; otherwise annotate the file as an intentional stub and leave it. **LOE: S (<1h).**

---

## Part 4 — LOE Table

| # | Item | LOE | Risk / protected behavior touched |
|---|------|-----|-----------------------------------|
| 1 | Scale default 1.0 + one-time migration | M (4-6h) | Local-only theme storage; no sync surface. Risk: silently shrinking a genuine 1.15-chooser (mitigated: Large still selectable). Harness rewrite required (chunk6a). |
| 2 | Density/floor equalization pass | M-L (6-10h) | Accessibility floors — must not drop below 44px anywhere (protected: a11y no-regress). Two harness rewrites. |
| 3 | Save Run reservation + bottom-nav padding | S (2-3h) | None protected; pure layout. Verify safe-area math on device. |
| 4 | Tire-pressure auto-fit grid + stepper hardening | S-M (3-4h) | None protected; verify at all 4 test viewports × both scales. |
| 5 | Commit-on-pointerup stepper | M (4-6h) | Touch semantics of a widely shared component; hold-to-repeat must keep working (owner-valued). |
| 6 | Single editability predicate | M (5-8h) | **Setup lifecycle immutability semantics — must not change meaning.** Highest-care UI-logic task. |
| 7 | Notification arbiter + unified copy | S-M (3-5h) | UXN-3: pulls must never trigger Saved/deletion UI — preserve. |
| 8 | Honest feedback (UXP-18 completion + status renderer + push error reporting) | M (5-8h) | Reports on, but must not alter, dual-delete/deferred-queue/pull-throttle. saved-flash harness inversion. |
| 9 | Car cascade delete + blocking-record explanation | M-L (8-12h) | **Dual-delete pattern + deferred queue + pull-filtering (UXN-1) — reuse only, no new primitives.** Isolated task. |
| 10 | Harness rewrites (rolled into 1,2,5,6,8,9) | Included above; +S (2h) for byte-lock→behavioral conversion policy | CI gate integrity — the whole point. |
| A | sync.ts zero-row delete fix | S-M (2-4h) | **Protected delete path — single named exception.** Isolated task. |
| B | Native-auth unmount guard + catch | S (<1h) | Native auth flow — additive guards only. |
| C | Scrollbar rule scoping | S (<1h) | None. |
| D | Location scaffold audit | S (<1h) | None. |

Total: roughly 45-65 focused hours.

---

## Part 5 — Bounded Builder Work Order

Work exclusively on branch `codex/hide-scrollbars`. Execute tasks in order; do not begin a task until the previous task's full harness suite passes **and Sol High has signed off its light QA (Part 6)**. Land each task as one commit containing both the code change and its harness changes.

### 5.0 Execution model — roles, loop discipline, and communication

This work order is executed by two named agents with fixed, non-interchangeable roles. Any agent picking up this document cold must adopt the role assigned below; do not improvise a different division of labor.

**Builder — 5.6 Terra Extra High.** Owns investigation and implementation of every task: reads the target files, writes the code and harness changes, runs the harness suite, produces the commit. Terra does not self-certify — every task Terra finishes goes to Sol for light QA before the next task may begin.

**QA and plan authority — 5.6 Sol High.** Owns quality assurance and plan maintenance. Sol is not a pass/fail stamp: when a task fails QA, Sol writes the rework — a revised, clarified task instruction telling Terra exactly what was wrong and what the next attempt must do differently — and hands that back to Terra. The plan text Terra executes on a retry is always Sol's latest revision, not the original wording plus verbal notes.

**Escalation rule (applies to every task below).** Failures are counted per task, consecutively. Attempt 1 fails → Sol writes revised instructions, Terra makes attempt 2. Attempt 2 fails → Sol writes revised instructions again, Terra makes attempt 3. If attempt 3 fails — i.e., Terra has failed the same task more than 2 times — Sol stops handing instructions back and **implements the fix directly**. Sol's direct fix is held to the identical bar: same acceptance criteria, same full-harness gate, same one-commit rule, and it is recorded as an escalation in the Ralph state and in the end-of-sprint handoff document (Part 6).

**Communication discipline — caveman and cavecrew (do not skip this; it is a requirement, not a suggestion).** Both agents use the **`caveman` skill** (ultra-compressed communication, full technical accuracy preserved) for all working notes, status updates, and inter-agent handoff notes during the sprint — this includes Sol's QA verdicts and Terra's completion reports. Exception: rework instructions Sol writes for Terra may use full prose where precision demands it, and the Part 6 handoff document is always full prose (its reader has zero context). Whenever either agent delegates to its own subagents, it must use the **`cavecrew` pattern**: compressed investigator/builder/reviewer subagent contracts with model-tier routing — **Sonnet** for searching and evidence-gathering, **Fable** for synthesis and implementation, **Opus** for genuinely hard judgment calls. Do not spawn vanilla open-ended subagents for work cavecrew covers.

**Ralph-loop discipline.** This sprint continues the repo's spec-driven design approach using Ralph loops (`ralph/STATE.md` / `ralph/CURRENT_TASK.md`). It is not a one-shot free-for-all. The loop per task:

1. Before starting Task N, `ralph/CURRENT_TASK.md` is set to Task N's current instruction text (the original below, or Sol's latest revision after a kickback).
2. Terra works only the task named in `CURRENT_TASK.md`.
3. On harness-green completion, Terra reports (caveman), Sol runs light QA (Part 6).
4. Only after Sol's pass does the state advance: `ralph/STATE.md` records Task N complete (with attempt count and any escalation), and `CURRENT_TASK.md` moves to Task N+1. On a kickback, `STATE.md` records the failure and `CURRENT_TASK.md` receives Sol's revised instructions instead.

State files must reflect reality at all times — an agent resuming mid-sprint should be able to read `STATE.md` and `CURRENT_TASK.md` and know exactly where the sprint stands without any other context.

### 5.1 Tasks

Every task below follows the standard loop: **Terra implements → full harness suite green → Sol light QA → advance or kickback → escalate to Sol after >2 Terra failures.** The "QA focus" line tells Sol where to look first; it narrows, never replaces, the task's acceptance criteria.

**Task 1 — Tire-pressure grid and NumberStepper hardening (item 4).** Files: `RaceWeekendView.tsx:1279`, `NumberStepper.tsx:130-131, 153`. Change: replace hardcoded `grid-cols-2` with auto-fit minmax (~10.5rem); value `whitespace-nowrap tabular-nums`, unit as separate `shrink-0` element. Do not change stepper timing/hold logic in this task. Harness: verify and update any byte-lock covering NumberStepper/`.tap-target`. Acceptance: all 4 Run pressure controls show distinct minus/value/unit/plus regions with no clip/overlap at 360×800, 390×844, 412×915 and the 1080×2118 capture, at both Default and Large.
*QA focus (Sol):* all four viewports at both scales, and confirm the diff touched zero stepper timing logic.

**Task 2 — Save Run reservation and bottom-nav clearance (item 3).** Files: `index.css:266-275`, `RaceWeekendView.tsx` container, `App.tsx` main scroll container. Change: reserve sticky-bar height + safe-area below content; opaque bar with top border; render only when dirty; global bottom padding `calc(4rem + safe-area)` on the main scroll region. Harness: add reservation assertion to `chunk5-setup-harness.ts`. Acceptance: Save Run never covers or disconnects from content; no content behind bottom nav/system bars at any test viewport.
*QA focus (Sol):* scroll-to-bottom check on every view, dirty and non-dirty states, and that the new harness assertion actually fails when reservation is removed (mutation-check it once).

**Task 3 — Scale default and migration (item 1).** Files: `types.ts:484-491`, `App.tsx:70-81, 582, 607-611`, `SettingsView.tsx:310-313, 341-347`. Change: add `'standard'`/1.0; fallback, normalize, and Reset target `standard`; three Settings options; one-time versioned `large→standard` remap preserving `xlarge`. Harness: rewrite `chunk6a-refinement-harness.ts` per Part 2 item 10. Acceptance: Default is materially denser than 1.15x; pinch-zoom remains enabled; theme remains localStorage-only.
*QA focus (Sol):* migration idempotence (run twice, xlarge survives), Reset target, pinch-zoom still enabled.

**Task 4 — Density/floor equalization (item 2).** Files: `App.tsx:2145-2192` + nav, `ContextStrip.tsx:39-94`, `SetupView.tsx:59-60` + corner grid, `index.css:143-146, 249-255`, `FourBarQuickAdjust`, `RaceWeekendView.tsx:~1150-1212`. Change: 48→44px floors, raise Run freeform inputs to 44px, remove nav `scale-105`, phone-first `min-[360px]:grid-cols-2` corner form, real `compact` single-row steppers. Harness: rewrite `setup-touch-target-harness.ts` as behavioral (≥44px), update `chunk5-setup-harness.ts`. Acceptance: 2 setup columns / 3 four-bar columns usable at normal portrait widths, no clip/overlap; no text/control unreadable in pursuit of density; focus/keyboard/safe-area unchanged.
*QA focus (Sol):* widest-blast-radius task of the sprint — visual pass over every affected surface at 360px, plus explicit focus/keyboard/safe-area regression check. Expect this task to be the most likely kickback; write rework instructions surface-by-surface, not wholesale.

**Task 5 — Commit-on-pointerup stepper (item 5).** Files: `NumberStepper.tsx` only. Change: single step commits on pointerup within slop; repeat timer cancels on >8px movement or pointercancel; buttons `touch-action: pan-y`. Do not alter the 350ms/100ms hold-repeat cadence. Harness: add zero-writes-on-scroll assertion to `saved-flash-harness.ts`. Acceptance: scroll beginning over a setup field produces zero writes; hold-to-repeat still functions.
*QA focus (Sol):* hold-repeat cadence byte-identical in behavior (350ms/100ms), zero-writes assertion present and meaningful.

**Task 6 — Single editability predicate (item 6). ISOLATED.** Files: `setupLifecycle.ts:35-42`, `SetupView.tsx:517`, `App.tsx:1416-1440`. Change: `getSetupEditability` with typed reasons; both call sites use it; `activeEventSetupId` clause demoted to `in-play-elsewhere` (non-historical, non-delete-blocking, edit-frozen only within the same active weekend). **Do not change** what makes a setup historical (baseline/final roles, `lockedAt`, finished-weekend snapshots) — meaning must be byte-for-byte equivalent for those cases. Harness: `chunk5-setup-harness.ts` asserts both call sites agree on every fixture. Acceptance: deliberate edit attempt on a historical setup changes zero bytes; non-historical setups on the owner's data pattern (live Race Day present) are editable and deletable.
*QA focus (Sol):* zero-byte assertion on historical edit is the hard gate; verify the historical-definition inputs (roles, lockedAt, snapshots) are untouched in the diff. Because this task is ISOLATED, a kickback here must not bundle unrelated fixes.

**Task 7 — Notification arbiter and honest feedback (items 7+8).** Files: `App.tsx:1416-1440, 2213-2244, 736, 1295, 1443`, `SetupView.tsx:336, 351, 584-586`, `sync.ts` push helpers (error-callback only), delete `saveStatus.ts`. Change: single arbiter (info replaces Saved, never co-render); one copy source keyed by reason; identical-info dedupe; typed compact status renderer for synced/offline-saved/deferred-retry/error; push helpers report failures. **Do not modify** the dual-delete pattern, deferred queue mechanics, or the 30s pull throttle — reporting only; pulls must never enqueue success statuses (UXN-3). Harness: invert `saved-flash-harness.ts` per Part 2 item 10. Acceptance: real editable change → immediate local persist, ≤1 compact confirmation; historical scroll → no warning, no Saved; failed/blocked delete never shows Saved/Synced.
*QA focus (Sol):* audit the sync.ts diff line-by-line — error-callback reporting only, no behavioral change to delete/queue/throttle paths. Any behavioral drift there is an automatic kickback regardless of harness state.

**Task 8 — Zero-row delete detection (Part 3, HIGH). ISOLATED — named exception to the protected-path freeze.** Files: `sync.ts:23-37`, `App.tsx:729-730`. Change: delete with `.select('id')`, zero rows = failure, intent stays queued, status surfaces via Task 7's renderer. Nothing else in `sync.ts` changes. Harness: `saved-flash-harness.ts` zero-row-delete assertion. Acceptance: a cloud-blocked delete keeps retrying and never renders success; no resurrection on next pull.
*QA focus (Sol):* the exception is scoped to the named lines only — confirm the diff footprint matches `sync.ts:23-37` and `App.tsx:729-730` and nothing else in protected paths. On escalation, the same footprint restriction binds Sol.

**Task 9 — Car cascade delete (item 9). ISOLATED.** Files: `App.tsx:443-481` orchestration, `GarageView.tsx:185-195` enumeration/confirm, reusing `App.tsx:1445-1448`/`1847-1871` helpers. Change: enumerate blocking records with reasons; explicit strong confirmation; cascade via existing queue+push pairing per table; active-car reassignment preserved; disabled setup-Delete buttons state their reason and link here. **Do not create new delete primitives; do not bypass the deferred queue; do not touch pull-filtering.** Harness: cascade-pairing assertion (every cascaded record hits both queue and push). Acceptance: car deletable after confirmation without manually reaching zero setups; no orphans, no cloud resurrection; mid-cascade failure shows an explicit error, never Saved.
*QA focus (Sol):* every cascaded table goes through the existing queue+push pairing — no new primitives in the diff. Mid-cascade failure path exercised, not just asserted.

**Task 10 — Small fixes (Part 3 B/C/D).** Files: `App.tsx:1092, 1108`, `index.css:174`, `location.ts` (annotation only). Additive guards, `.catch`, coarse-pointer scoping of the scrollbar rule, stub annotation. No harness changes expected.
*QA focus (Sol):* strictly additive; if the diff shows anything beyond guards/`.catch`/scoping/annotation, kick back. This task closes the sprint — its light QA rolls directly into the final full-sprint QA pass (Part 6).

### 5.2 Boundary statement

Not authorized to: merge to `master` or push `codex/hide-scrollbars` (or any branch) to a remote; build, sign, or distribute APKs or modify anything under `release/` (5.1.4 remains the latest installable; 5.1.3 remains do-not-distribute); publish or promote any Netlify deploy beyond draft previews; modify Supabase schema, RLS, migrations, or edge functions; alter the dual weekend-delete pattern, the team-owner canonical-write rules, the account-scoped deferred delete queue, or UXN-1 pull-filtering *except* the single named change in Task 8; alter the UXN-3 pull-on-resume throttle or generation isolation; change setup lifecycle role/history/immutability semantics beyond the explicitly bounded demotion in Task 6; sync `activeCarId`/`activeWeekendId` (they stay localStorage-only); disable pinch-zoom; regress focus, keyboard, or safe-area behavior; or begin any Sprint 4 IA work, which remains blocked until this plan ships and the owner re-reviews on device. These boundaries bind **both** agents identically — Sol operating under the escalation rule inherits every restriction Terra had, including Task 8's line-level exception scope. The role assignments, escalation rule, caveman/cavecrew usage, and Ralph-loop discipline in 5.0 are part of this work order's contract, not optional process advice.

---

## Part 6 — Sprint QA Cadence and Third-Party Review Handoff

### 6.1 Light QA after every task

Sol High runs a light QA pass immediately after Terra completes each task, before `ralph/STATE.md` advances. Light QA is bounded and fast — it verifies the task, not the sprint. Sol checks, in order:

1. **Acceptance criteria** — every acceptance clause of the task, verified directly (viewport checks at the task's named sizes/scales where applicable, not sampled).
2. **Harness suite** — the full suite green, and the task's new/changed harness assertion demonstrably meaningful (it fails if the change is reverted; spot-check once per new assertion).
3. **Boundary compliance** — the diff footprint stays inside the task's named files and honors the task's "do not" clauses and the 5.2 boundary statement. For ISOLATED tasks (6, 8, 9), any unrelated change in the diff is an automatic fail even if functionally correct.
4. **Commit hygiene** — one commit, code plus harness together, message identifying the task.
5. **Ralph state** — `CURRENT_TASK.md` matched what was built; `STATE.md` update staged correctly.

**Pass:** Sol records the pass (caveman note), `STATE.md` advances, `CURRENT_TASK.md` moves to the next task. **Fail (kickback):** Sol does not merely reject — Sol rewrites the task instruction in `ralph/CURRENT_TASK.md`: what failed, the evidence, and precisely what the next attempt must do differently. Terra's retry executes Sol's revision, not the original text. **Escalation:** failures are counted per task; after Terra has failed the same task more than 2 times (a 3rd consecutive failure), Sol implements the fix directly under the identical acceptance criteria, harness gate, and boundary restrictions, and records the escalation in `STATE.md`. Sol's escalated fix still receives a light QA record (Sol documents the same five checks against their own work; there is no exemption from the checklist, only from the handback cycle).

### 6.2 Final full-sprint QA pass

After Task 10's light QA passes, Sol runs one comprehensive pass over the finished sprint as a whole. Task-by-task light QA does not substitute for this — interaction effects between tasks (density changes × sticky-bar reservation × scale migration, editability predicate × notification arbiter × delete detection) are exactly what per-task QA cannot see. Scope:

- **Every Part 2 acceptance target**, re-verified together on the final branch state — all viewports, both scales, the owner's original complaint scenarios reproduced end-to-end.
- **Every Part 4 risk note**, re-checked against the finished code: confirm each identified risk was either mitigated as planned or is explicitly carried into the handoff document as residual risk.
- **The full harness suite in a single run**, all assertions, with the output captured verbatim for the handoff document.
- **A whole-branch boundary audit**: the cumulative diff `master...codex/hide-scrollbars` reviewed once against the 5.2 boundary statement, confirming nothing outside authorized scope was touched across the entire sprint.

Failures found here are handled with the same kickback mechanics as 6.1, scoped to the offending task, with its existing failure count carried forward. The sprint is complete only when this pass is green and `STATE.md` records it.

### 6.3 End-of-sprint handoff document — specification

Once implementation and final QA are complete, Sol High produces the handoff document. Its sole purpose is to brief a **future, different model/agent** — a fresh, independent third-party reviewer in the same spirit as the review that produced this plan — so that agent can independently review the finished work **with no other context**. It is written in full prose (never caveman; the reader is cold) and must contain:

1. **Branch and commit state** — branch name, base commit, final HEAD SHA, and a task→commit map for all ten tasks.
2. **Per-task diff summary** — for each task: files touched, exact nature of the change, and the harness changes that lock it.
3. **Before/after evidence for the original owner complaints** — screenshots or exact repro steps at the test viewports/scales, tied back to each Part 2 complaint item.
4. **Full harness suite results** — the verbatim final-run output from 6.2, pass/fail per harness.
5. **Deviations from this plan and why** — every point where the landed implementation differs from Part 5's task text, including all kickbacks and any escalations (which tasks, attempt counts, who ultimately implemented).
6. **Known residual risk and deferred items** — anything from Part 4 carried forward, plus anything discovered during the sprint and deliberately not fixed.
7. **Explicit non-goals and boundary reminders** — the 5.2 boundary statement restated for the reviewer, so settled decisions (dual weekend-delete, deferred queue, pull throttle, Sprint 4 IA deferral, Task 8's bounded exception) are not re-litigated.
8. **Traceability pointers** — references to this plan document and to the original review (`docs/HANDOFF_MOBILE_DENSITY_REVIEW_2026-07-17.md`) that preceded it, so the reviewer can reconstruct the full chain from complaint → review → plan → implementation.

Two constraints on this document are absolute. First, **it is a briefing packet, not a verdict**: it must not claim, state, or imply that the third-party review has passed — the review has not happened yet. It may report that the sprint's own QA (6.1/6.2) passed, with evidence, but final judgment belongs to the future reviewer. Second, **producing this document is the deliverable that unblocks the third-party review**: the review is a separate future step, performed by a separate agent, and does not begin until this document exists and is complete per the list above.

---

## Sources

- `AGENTS.md`, `HANDOFF.md`, `SPRINT_INDEX.md`, `ralph/STATE.md`, `ralph/CURRENT_TASK.md`, `CODEBASE_KNOWLEDGE.md`, `docs/HANDOFF_MOBILE_DENSITY_REVIEW_2026-07-17.md` (repo root)
- Screenshots: `Screenshot_20260717_074317_Crew Chief.jpg` (Dashboard), `Screenshot_20260717_074518_Crew Chief.jpg` (Setups/Tires), `Screenshot_20260717_081519_Crew Chief.jpg` (Runs/QuickAdjust) — `G:\My Drive\Google AI Studio\`
- Direct source inspection: `src/App.tsx`, `src/index.css`, `src/types.ts`, `src/components/{SettingsView,ContextStrip,SetupView,FourBarQuickAdjust,RaceWeekendView,TiresSubView,GarageView,ui/NumberStepper}.tsx`, `src/lib/{setupLifecycle,raceDayGate,saveStatus,sync,undo,accountDeletion,teamDataOwnership}.ts`, `scripts/*-harness.ts` — all in `.worktrees\hide-scrollbars` @ `ab6b98a`
- Also appended as a scoped addendum to root `CODEBASE_KNOWLEDGE.md`
