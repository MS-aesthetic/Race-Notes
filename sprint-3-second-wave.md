# CREW CHIEF — Sprint 3: Second Wave (UXP, Medium difficulty)

> Source: 2026-07-14 UX/UI audit. 6 workstreams + gate. Runs AFTER sprint 2
> (`sprint-2-quick-wins.md`). Master index: `SPRINT_INDEX.md`. Self-contained.
>
> **Branch/worktree:** `preview-v3` in
> `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`. No merge, no
> production deploy, no schema change, no APK without Maxx.
>
> **Architecture invariants (non-negotiable):** local-first dual-write; no
> router; car scoping via `byActiveCar()`; types only `src/types.ts`; sync only
> `src/lib/sync.ts`; every delete path calls its `delete*FromCloud()`; theme
> tokens, no hardcoded hex in components (`SmasherLoadsView` inline SVG
> grandfathered); tsc/lint baseline = exactly 3 known errors; builds/git via
> Windows PowerShell. Harnesses: `npx tsx scripts/<name>.ts`.
>
> **Routing (brief — authoritative in SPRINT_INDEX.md):** ws-planner = SOL High
> (plans + STATE updates). ws-builder = Terra High, ONE initial pass per WS.
> QA FAIL routes to ws-fixer = SOL High, loops with ws-qa = SOL High until
> PASS — Terra never re-invoked after attempt 1. cavecrew-investigator = Terra
> Medium for bounded research. `/caveman full` all loop artifacts.
>
> **Line refs verified 2026-07-14 pre-UXF/pre-sprint-2.** Two sprints of edits
> land first — re-grep every ref. Refs below are anchors, not gospel.

## Execution order

```
UXP-10  offline chip           (High impact — do first)
UXP-14  setup input sizes      (Med-High)
UXP-16  confirm-sheet          (Medium; structural — before UXP-17 sweep)
UXP-15  status color tokens    (Medium)
UXP-17  opacity dimming        (Medium; after 15+16 — shares files, adds token)
UXP-18  false Saved flash      (Medium)
UXP-QA3 gate                   (LAST)
```

## File ownership

| WS | Primary | Shared |
|---|---|---|
| UXP-10 | `src/components/ContextStrip.tsx` (or header chrome in `src/App.tsx`) | `src/lib/saveStatus.ts` read-only |
| UXP-14 | `src/components/SetupView.tsx` (INP class + CornerForm) | — |
| UXP-15 | `src/index.css` (@theme + light block), `src/components/TrackersView.tsx`, `src/components/DashboardView.tsx` | — |
| UXP-16 | `src/components/ui/ConfirmSheet.tsx` (NEW) + 9 caller components + `src/App.tsx` | `src/lib/tireHistory.ts` (return-failure refactor), `src/components/ui/BottomSheet.tsx` read-only |
| UXP-17 | `src/index.css` (muted token, hack removal) + listed components | — |
| UXP-18 | `src/App.tsx` (:456-477 flash machinery) | — |

Hot files: TrackersView (UXP-15→16 order), SetupView (14→16→17),
RaceWeekendView (16→17), App.tsx (16→18). Serial loop; keep order.

---

## UXP-10 — Persistent offline indicator

**Goal:** offline state = transient toast only (`App.tsx:1698-1726` shows
Saved/Syncing/Synced; "Offline — saved on device" only flashes on save). Pit
crews offline whole weekends — need sustained signal.

**Scope:**
1. Chip in fixed chrome visible on EVERY tab — ContextStrip
   (`src/components/ContextStrip.tsx`) preferred; App header fallback.
   Driven by `useOnlineStatus()` (`src/lib/saveStatus.ts:29-41`).
2. Style: existing `.status-chip` utility (`src/index.css` ~:263) or match;
   `cloud_off` icon + short text ("OFFLINE" or "OFFLINE · SAVED ON DEVICE" if
   space). Theme tokens only. Must fit 320px beside existing
   car/weekend chips — icon-only at narrow widths OK.
3. Reconnect: chip disappears. Brief "SYNCING → SYNCED" chip transition
   optional — builder judgment; minimum = offline chip.
4. Keep existing toast (:1698-1726) untouched.
5. `role="status"` on chip container.

**Out of scope:** wiring `reportSave('synced')` into sync.ts (known backlog,
saveStatus.ts header note); sync-conflict UI.

**Acceptance:** airplane mode → chip on every tab, persists across
navigation; reconnect → gone; 320px no overflow, light + dark, both font
sizes; lint; build.

---

## UXP-14 — Setup-form inputs to touch-target size

**Goal:** shared `INP` class (`src/components/SetupView.tsx:58`) =
`text-xs px-3 py-1.5` mono ≈30px — below 48px target on the highest-frequency
data-entry screen, gloved hands.

**Scope:**
1. INP → add `min-h-12` (3rem, scales under --ui-zoom) + `text-sm`.
2. Audit every INP usage + `CornerForm` grid at 320px with Large font (zoom
   1.45): 2×2 corner grids may overflow with taller inputs — adjust gaps/
   stacking only where broken.
3. Selects/steppers sharing rows with INP inputs: match height so rows align.

**Out of scope:** input semantics (type/inputmode); labels/copy (UXF-3/5
landed those); other views' inputs.

**Acceptance:** every setup-sheet field ≥48px computed; 320px + Large font no
horizontal overflow, all corner cards; chunk6a/6b/7 harnesses PASS untouched;
lint; build.

---

## UXP-15 — Semantic status color tokens

**Verified:** `@theme` (`src/index.css:5-58`) already defines
`--color-error*` (dark) and green `--color-tertiary*`; light block (:61-79)
overrides ONLY surfaces/outlines — error/tertiary render dark-theme values in
light mode. Components use raw `text-red-400`/`text-amber-400`/`bg-green-500`
for status (TrackersView + DashboardView chips; amber-400 ≈2:1 on light).

**Scope:**
1. `@theme`: add `--color-warning` + `--color-on-warning` (+container pair if
   chips need bg). Success: alias tertiary or add `--color-success` — builder
   pick, document in css comment.
2. Light block: add overrides for error, warning, success families. Every
   status-text-on-surface pairing ≥4.5:1 both themes (chips are small text).
3. Migrate status chips/text in `TrackersView.tsx` + `DashboardView.tsx`:
   grep `red-400|red-500|amber-400|amber-500|green-400|green-500` there; swap
   to tokens (`text-error`, `text-warning`, `bg-success` etc. — Tailwind
   utilities pick up @theme vars).
4. Stretch ONLY if trivial: SettingsView danger zone, App.tsx saved-toast
   green (:1714) — else leave, log to backlog.

**Out of scope:** UndoToast/InfoToast internals; SmasherLoadsView SVG
(grandfathered); non-status decorative colors.

**Acceptance:** hex spot-check light-mode warning/error/success text ≥4.5:1
on their actual surfaces; dark visually ~unchanged; grep step-3 files for raw
status colors = 0; lint; build.

---

## UXP-16 — Shared confirm sheet; kill `alert()`/`window.confirm()`

**Goal:** 19 native-dialog call sites = de-facto dialog system; breaks
BottomSheet/UndoToast design language, inconsistent copy.

**Verified sites (re-grep — sprints 1-2 moved lines):**
`window.confirm` (12): RaceWeekendView.tsx:1509 (Finish Weekend — UXF-3
rewrote this string, PRESERVE its vocabulary), SmasherLoadsView.tsx:493,
SetupView.tsx:336, ToDoView.tsx:138,238, TeamView.tsx:114,129,144,
TiresSubView.tsx:86, TrackersView.tsx:177,432,745.
`alert` (7): App.tsx:299 (car-data guard), ExportView.tsx:81,89,
SetupView.tsx:335,370,376, lib/tireHistory.ts:278.
(Audit listed 8 files; SmasherLoadsView.tsx + lib/tireHistory.ts also hit.)

**Scope:**
1. NEW `src/components/ui/ConfirmSheet.tsx` on `BottomSheet`
   (`src/components/ui/BottomSheet.tsx` — Android back already handled via
   useBackClosable). Props: title, body, confirmLabel, cancelLabel,
   destructive flag (error-token styling), onConfirm/onCancel. Simple
   render-when-open component — no context/portal framework.
2. Migrate 12 confirm sites. Copy voice: terse shop language, verb-first
   buttons ("Delete", "Keep", "Finish").
3. Per-site judgment: where delete is cheap-reversible, `useUndoableDelete` +
   UndoToast BEATS confirm (candidates: TiresSubView:86, TrackersView:177) —
   allowed swap, document per site. Destructive-irreversible (TeamView team
   delete :129) stays ConfirmSheet.
4. Alerts → InfoToast (`src/components/ui/UndoToast.tsx` InfoToast export) or
   inline error text: App.tsx:299 guard → toast; SetupView:335 locked/min-
   setup → toast; upload fail :376 → toast.
5. `lib/tireHistory.ts:278` + `ExportView.tsx:81` popup-blocked alerts: lib
   must NOT import components — refactor tireHistory fn to return
   success/failure, caller shows toast.
6. Grep `window.confirm(|alert(` in src = 0 after.

**Out of scope:** UndoToast/BottomSheet internals; new confirm flows nobody
asked for; SettingsView clear-all (custom 2-step, done UXP-13).

**Acceptance:** grep = 0; every migrated flow exercised (delete tire/entry/
template/setup/team, leave team, remove member, reset checklist, apply
template, finish weekend, delete load session, popup-blocked export); Android
back dismisses sheet as cancel; destructive styling on deletes; UXF-3
vocabulary intact in Finish Weekend copy; full harness suite PASS; lint;
build.

---

## UXP-17 — Full-opacity muted text token (kill alpha dimming)

**Verified:** `index.css:82-88` band-aid already forces
`text-on-surface-variant/*` + `text-primary/*` to full opacity in LIGHT mode
via `!important`. Dark mode still opacity-dimmed (~5:1 or worse on small mono
labels, sun-hostile). Known sites: FourBarQuickAdjust.tsx:112,
ExportView.tsx:129,295,319, SetupView.tsx:566, SmasherLoadsView.tsx:1064,
QuickReferenceView.tsx:744,845,897, RaceWeekendView.tsx:671,857,1556,
ToDoView.tsx:67,262, ui/SegmentedGrid.tsx:52 — MINIMUM list; sweep = grep
`text-on-surface-variant/` whole src (other views + EmptyState internals hit
too).

**Scope:**
1. `@theme`: `--color-on-surface-muted` — full-opacity hex ≈ current 60%
   blend but ≥4.5:1 on `--color-surface-container` (dark). Light block:
   darker counterpart, same contrast floor.
2. Sweep: `/40 /50 /60` suffixed on-surface-variant text classes →
   `text-on-surface-muted`. Truly-decorative giant icons (`/20 /30` empty-
   state glyphs) may keep dimming — judgment, document.
3. When grep `text-on-surface-variant/` = 0: delete `index.css:82-84` hack.
   Keep :86-88 (`text-primary/`) unless those also fully migrated.
4. Disabled-state opacity (`disabled:opacity-50` etc.) NOT in scope —
   disabled is semantic.

**Out of scope:** UXP-15's status colors (done prior); font sizes; copy.

**Acceptance:** dark-mode muted-on-container ≥4.5:1 (hex math); draft visual
pass — metadata readable, hierarchy preserved (muted still reads secondary);
grep documented-zero; lint; build.

---

## UXP-18 — "Saved" flash only for user-initiated saves

**Verified:** `App.tsx:456-477` — `savedFlash` effect fires on ANY change to
14 datasets (:473-477 deps). Guards exist: `flashReadyRef` (hydration, :467-
470), `suppressPullRef` (cloud pulls, :459). NOT guarded: background
reconciliation — `reconcileMaintenanceChecklist` → `handleSaveTodos
(reconciled)` (:450 area) mutates todos → flash with zero user action. Erodes
signal trust.

**Scope:**
1. Option (a), try first — minimal: suppress flag around background write
   paths. Enumerate: maintenance reconcile (:450), auto-create one-shots
   (auto-car, auto-weekend — grep), `applyActiveSessionToWeekends` if any
   non-user caller. Inspect how `suppressPullRef` is set/cleared and mirror
   exactly (flag timing vs async setState matters).
2. Option (b) if suppress points exceed ~6 or feel leaky: delete dataset-
   watch effect; call `flashSaved()` explicitly from user save handlers.
   Bigger diff, honest semantics. ws-fixer may land (b) if (a) FAILs QA.
3. Offline flash ("Offline — saved on device", :1704) keeps working — it
   rides savedFlash.

**Out of scope:** toast visuals; sync status text machinery (:479 auto-
dismiss); reconcile logic itself.

**Acceptance:** idle app with reconcile firing → zero flashes (verify: seed
due maintenance, watch 5 min); every real user save flashes (run log, setup
edit, todo toggle, accounting add, offline variant); cloud pull still silent;
lint; build.

---

## UXP-QA3 — Sprint 3 gate *(last)*

**Scope:**
1. Full harness suite PASS (chunk6a/6b/7/8/9, ux-r1-*).
2. Lint exact 3-error baseline; Windows build; `git diff --check`; clean tree.
3. Grep gates: `window.confirm(|alert(` = 0; `text-on-surface-variant/` =
   documented-zero; raw status Tailwind colors in TrackersView/DashboardView
   = 0.
4. Netlify draft: 320/390, light + dark, both fonts; offline chip end-to-end
   (airplane → navigate all tabs → reconnect); setup-sheet entry gloved-size
   check; confirm-sheet flows incl. Android back; no false Saved flash idle;
   offline reload from localStorage; authenticated cloud round trip of one
   delete-via-ConfirmSheet path (delete calls `delete*FromCloud` — invariant).
5. ws-planner updates `ralph/STATE.md` UXP table.

**Acceptance:** all green + STATE.md current. No production deploy/merge/APK.
