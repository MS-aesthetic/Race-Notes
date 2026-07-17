# CREW CHIEF — Sprint 2: Quick Wins (UXP, Low difficulty)

> Source: 2026-07-14 UX/UI audit. 14 workstreams + gate, all confirmed-cheap.
> Runs AFTER sprint 1 (UXF-1…9, `plan-v3-ux-corrections.md`). Master index:
> `SPRINT_INDEX.md`. This file self-contained — no other file needed to build.
>
> **Branch/worktree:** `preview-v3` in
> `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`. No merge to
> preview/master, no production deploy, no schema change, no APK without Maxx.
>
> **Architecture invariants (non-negotiable):** local-first dual-write; no
> router; car scoping via `byActiveCar()`; types only `src/types.ts`; sync only
> `src/lib/sync.ts`; every delete path calls its `delete*FromCloud()`; theme
> tokens, no hardcoded hex in components (`SmasherLoadsView` inline SVG colors
> grandfathered); tsc/lint baseline = exactly 3 known errors; builds/git via
> Windows PowerShell. Harnesses: `npx tsx scripts/<name>.ts`.
>
> **Routing (brief — authoritative in SPRINT_INDEX.md):** ws-planner = SOL High
> (plans + STATE updates). ws-builder = Terra High, ONE initial pass per WS.
> Any QA FAIL routes to ws-fixer = SOL High, loops with ws-qa = SOL High until
> PASS — Terra never re-invoked after attempt 1. cavecrew-investigator = Terra
> Medium for bounded research. `/caveman full` all loop artifacts.
>
> **Line refs verified 2026-07-14 pre-UXF.** UXF touched RaceWeekendView,
> SetupView, TrackersView, ToDoView, DashboardView, App.tsx — re-grep before
> edit if ref drifted.

## Execution order (serial loop; eligibility, impact-first)

```
UXP-4-PING  ws-planner asks Maxx font-scale question at sprint start (see UXP-4)
UXP-1   light-mode hardcoded hex        (High impact)
UXP-2   Garage tap targets              (High)
UXP-3   car delete undo                 (High; after UXP-2 — same lines)
UXP-5   pinch zoom                      (High)
UXP-6   modal back-handling             (Med-High)
UXP-7   brand name                      (Medium)
UXP-8   Run vs Session copy             (Medium)
UXP-9   accounting draft persist        (Medium)
UXP-11  settingsSubTab wiring           (Low-Med; prereq for sprint 4 UXP-22)
UXP-12  EmptyState adoption             (Low-Med)
UXP-13  clear-all auto-revert           (Low-Med)
UXP-19  dead clock state                (Low)
UXP-20  aria-hidden / aria-current      (Low)
UXP-4   font scale cleanup              (High impact but Maxx-gated part; slot
                                         wherever answer arrives; part (a) never gated)
UXP-QA2 sprint gate                     (LAST)
```

## File ownership

| WS | Primary | Shared |
|---|---|---|
| UXP-1 | `src/components/RaceWeekendView.tsx`, `src/components/TeamView.tsx` | `src/components/ToDoView.tsx` (:418 only) |
| UXP-2 | `src/components/GarageView.tsx` (:173-193) | — |
| UXP-3 | `src/components/GarageView.tsx`, `src/App.tsx` (car-delete handler) | `src/lib/undo.ts` read-only |
| UXP-4 | `src/App.tsx` (:49-59, :405), `src/components/SettingsView.tsx` (:248-252) | `src/types.ts` (AppTheme union, verify location) |
| UXP-5 | `index.html` (viewport meta) | — |
| UXP-6 | `src/components/SetupDiffView.tsx`, `src/components/ToDoView.tsx` (CompletionModal) | `src/lib/backStack.ts` read-only |
| UXP-7 | `index.html`, `vite.config.ts` (manifest block), `manifest.json` (delete) | — |
| UXP-8 | `src/components/DashboardView.tsx`, `src/components/RaceWeekendView.tsx` (copy only) | `src/App.tsx` (nav/toast strings only) |
| UXP-9 | `src/components/TrackersView.tsx` (accounting form) | — |
| UXP-11 | `src/App.tsx` (:363-365), `src/components/SettingsView.tsx` (:47) | — |
| UXP-12 | `src/components/GarageView.tsx`, `src/components/ToDoView.tsx` | `src/components/ui/EmptyState.tsx` read-only |
| UXP-13 | `src/components/SettingsView.tsx` (:115-156) | — |
| UXP-19 | `src/App.tsx` (:572, :604-615) | — |
| UXP-20 | `src/components/DashboardView.tsx`, `src/App.tsx` (bottom nav) | — |

Hot files: ToDoView (UXP-1→6→12 order), GarageView (UXP-2→3→12), App.tsx
(UXP-3,4,8,11,19,20 — all small, disjoint regions). Loop is serial; keep order.

---

## UXP-1 — Light-mode hardcoded `#0e0e0e` fields

**Goal:** hardcoded dark hex ignores `[data-theme="light"]` — fields invisible
light mode.

**Scope:**
1. `src/components/RaceWeekendView.tsx` :1008,1053,1110,1138,1157,1172,1252,
   1317,1455 — `bg-[#0e0e0e]` on inputs/textareas/panels. Swap to `bg-surface`
   (form fields) or `bg-surface-container-lowest` (nested panels) — builder
   pick per context, must be theme token.
2. `src/components/TeamView.tsx` :193,228,240,272,319 — same swap.
3. `src/components/TeamView.tsx` :200,277 + `src/components/ToDoView.tsx:418`
   — these are `text-[#0e0e0e]` on `bg-primary` buttons. Correct token =
   `text-on-primary`, NOT a surface token.
4. Grep `0e0e0e` across `src/` — zero component hits remain.

**Leave alone:** `AuthView.tsx` Google-logo SVG, `SettingsView` accent
swatches — intentional brand colors. `index.css` `--color-surface-container-
lowest: #0e0e0e` definition stays (it IS the token).

**Out of scope:** any layout/copy change; UXP-17's opacity sweep.

**Acceptance:** all touched forms legible light + dark (weekend form, session
notes, corner grid, TeamView create/invite/member rows, ToDo add button);
grep `bg-\[#0e0e0e\]|text-\[#0e0e0e\]` in src = 0; lint 3-baseline; build.

---

## UXP-2 — Garage edit/delete tap targets

**Goal:** `GarageView.tsx:174-192` edit + delete buttons `p-1.5`, `gap-1`
apart, ~28px; one destructive. App has own `.tap-target` (48px,
`src/index.css:236-250`).

**Scope:** both buttons get `.tap-target`; gap-1 → gap-2 minimum; icons may
bump `text-base` → `text-xl`. Buttons sit in `onClick stopPropagation` div
(:173) inside row-select `<button>` (:150) — keep structure, verify larger
targets don't eat row-select taps at 320px.

**Out of scope:** delete behavior (UXP-3); empty state (UXP-12).

**Acceptance:** both ≥48px computed each dimension; ≥8px separation; row
select still works; 320px no overflow; lint; build.

---

## UXP-3 — Car delete: undo toast, no silent destroy

**Goal:** car delete immediate, no confirm/undo (only disabled-guard for cars
with data, `GarageView.tsx:181-190`, guard alert `App.tsx:299`). Adopt weekend-
delete undo pattern.

**Scope:**
1. Pattern reference: `useUndoableDelete` (`src/lib/undo.ts`) + `UndoToast`
   (`src/components/ui/UndoToast.tsx`); live example
   `RaceWeekendView.tsx:171,537-560,873-875`.
2. Wire car delete through `useUndoableDelete` — pending car hidden from list
   during undo window; commit fires the real delete (incl. `delete*FromCloud`
   — invariant). Undo = no write ever happened. Do NOT push cloud delete
   before commit.
3. If pending car is active: builder picks defer-switch-until-commit or
   switch-now-restore-on-undo; document choice in commit message.
4. Data-guard stays: car with setups/tires/shocks still blocked
   (`totalData > 0` disabled + App.tsx:299 alert — alert text stays until
   UXP-16 sprint 3 migrates it).

**Out of scope:** confirm-sheet (UXP-16 covers alert copy); weekend/session
undo paths (already done).

**Acceptance:** delete empty car → UndoToast with UNDO; undo restores, zero
cloud writes; commit deletes local + cloud; guard behavior unchanged; lint;
build.

---

## UXP-4 — Font-scale map cleanup (+ Maxx-gated expansion)

**Verified state:** `App.tsx:405` ZOOM map
`{standard:1.15, large:1.15, xlarge:1.45, xxlarge:1.45}` — 2 real values.
`normalizeTheme` (`App.tsx:49-59`) collapses stored fontSize to
`'large'|'xlarge'`. `SettingsView.tsx:248-252` offers only Default/Large.

**CONFLICT — read before building:** `ralph/STATE.md` owner revision
2026-07-13: "Font choices collapse to Default (existing 1.15) and Large
(existing 1.45)". Two choices was a DELIBERATE Maxx call. Audit wants 3-4 real
steps. ws-planner pings Maxx at sprint start: "audit flags no 1.0 option and
no bigger step — add Small (1.0) and/or true XL, or keep two?"

**Scope (a) — mechanical, never gated:** delete dead `'standard'`/`'xxlarge'`
from ZOOM map, from `AppTheme['fontSize']` union (find AppTheme def — likely
`src/types.ts`, verify), and from `normalizeTheme`'s collapse logic. Two clean
values. Legacy stored `'standard'`→`'large'`, `'xxlarge'`→`'xlarge'` mapping
preserved in normalizeTheme (stored themes must not break).

**Scope (b) — only on Maxx yes:** expand map (e.g. small:1.0, default:1.15,
large:1.3, xlarge:1.45), expose all in SettingsView grid, normalizeTheme
accepts all. No answer by WS dispatch = ship (a) only, log (b) to backlog.

**Acceptance:** (a) grep `standard|xxlarge` in fontSize context = 0 outside
normalizeTheme legacy mapping; saved legacy theme loads clean. (b, if built)
every option visibly distinct on 320px draft, both themes. Lint; build.

---

## UXP-5 — Re-enable pinch zoom (WCAG 1.4.4)

**Scope:** `index.html:5` viewport meta — remove `maximum-scale=1.0` and
`user-scalable=no`. Keep `width=device-width, initial-scale=1.0,
viewport-fit=cover`.

**Check:** app scales via `zoom: var(--ui-zoom)` on `#applet-main-body` /
`#applet-auth-gate` (`src/index.css:106-113`) inside fixed 100dvh shell —
verify pinch doesn't wedge the fixed shell on Android draft. If double-tap
zoom hurts rapid tapping (steppers), `touch-action: manipulation` on body is
allowed — does not violate 1.4.4.

**Acceptance:** pinch zoom works mobile draft + APK WebView; 320px layout
intact; ui-zoom setting still works; build.

---

## UXP-6 — Register two bespoke modals with Android back

**Goal:** `SetupDiffView` + ToDoView `CompletionModal` use bespoke
`fixed inset-0` overlays (SetupDiffView.tsx:33; CompletionModal fn
ToDoView.tsx:~19), not registered with `useBackClosable`
(`src/lib/backStack.ts:31`) — Android back navigates instead of closing.

**Scope:**
1. `SetupDiffView.tsx` — `useBackClosable(true, onClose)` if conditionally
   mounted (verify mount pattern at parent; if always-rendered, pass open
   flag). Pattern: `RaceWeekendView.tsx:182-184`.
2. ToDoView CompletionModal — same. Hook may live in parent where open state
   is (`completingItem != null` or equivalent — grep).

**Out of scope:** visual changes; migrating these to BottomSheet.

**Acceptance:** Android back closes each modal, second back behaves normally;
BottomSheet stack unaffected (`hasOpenSheets` check near `App.tsx:515`);
lint; build.

---

## UXP-7 — Brand name: CREW CHIEF everywhere

**Verified:** `index.html` has TWO `<title>` — :6 "Race Notes", :19 "Crew
Chief". :7 description says "Race Notes - Professional logbook and telemetry
application…" (app has no telemetry). :17 apple title already "Crew Chief".
Manifest is GENERATED — `vite.config.ts:22-28` (`name: 'Race Notes'`,
`short_name: 'RaceNotes'`, description "…telemetry application"). Root
`manifest.json` is an EMPTY stray file; `index.html:11` links the generated
`/manifest.webmanifest`.

**Scope:**
1. `index.html`: single `<title>CREW CHIEF</title>`, delete duplicate.
2. `index.html:7` description → accurate, e.g. "CREW CHIEF — dirt track setup
   notes, run logging, and pit checklists for race weekends." Drop
   "telemetry".
3. `vite.config.ts` manifest: `name: 'CREW CHIEF'`, `short_name: 'Crew
   Chief'`, description matching #2.
4. Delete empty root `manifest.json` (verify nothing imports/links it first).
5. Grep `Race Notes|RaceNotes` — fix remaining USER-VISIBLE spots. **NEVER
   rename `race_notes_*` localStorage keys or `race_notes` DB/sync
   identifiers — data loss.** Comments fine to leave.

**Acceptance:** one title tag; fresh PWA install shows CREW CHIEF; grep shows
no user-visible "Race Notes" outside storage keys/comments/archived docs;
build (webmanifest regenerates).

---

## UXP-8 — "Run" as the one user-facing word for SessionRecord

**Goal:** Dashboard says "+ Log Run" (`DashboardView.tsx:224`) / "runs"; nav +
creation flows say "Session". Same object. Standardize user copy on **Run**.

**Scope:**
1. Grep user-visible `Session|session` strings in `DashboardView.tsx`,
   `RaceWeekendView.tsx`, `App.tsx` (nav labels, toasts). Rewrite record-noun
   uses to Run ("Sessions" list heading → "Runs", "Session type" → "Run
   type", counts, empty states).
2. Keep verbatim: internal names (`SessionRecord`, `ActiveSession`, props,
   ids, sync fields); session-type VALUES `'Practice'|'Qualifying'|'Heat'|
   'Feature'`; **"Load Session"** (SmasherLoads shock feature — different
   domain object, not a run).
3. UXF-3 landed new lifecycle vocabulary in RaceWeekendView/App.tsx —
   preserve its strings; this WS renames the record noun only.

**Out of scope:** Trackers/Service naming (UXP-21, sprint 4); type renames.

**Acceptance:** Dashboard/Sessions-tab/weekend flows use Run consistently;
grep finds no user-visible "Session" meaning run record; chunk6b + chunk7
harnesses PASS untouched (they test behavior/values, not headings — update
label assertions only if any exist); lint; build.

---

## UXP-9 — Accounting form: draft survives tab switch

**Goal:** accounting add-form state is 11 local `useState` hooks
(`TrackersView.tsx:112-124`: name, desc, amount, type, payer, payee,
weekendId, weekendName, receiptPhoto, category, entryDate). Whole tab
unmounts on main-tab switch — typed input lost.

**Scope:** persist draft to localStorage key `race_notes_accounting_draft`:
write on change (debounce OK), hydrate on mount, clear on successful submit
AND explicit cancel/clear. `receiptPhoto` is base64 — include inside
try/catch (quota), or exclude photo from draft and document; builder pick.
Draft is device-local scratch — NO cloud sync, not part of dual-write.

**Out of scope:** lifting state to App; other Trackers forms (maintenance add
form loss is rarer — backlog if seen).

**Acceptance:** type entry → switch tab → return: fields intact incl.
category/date; submit clears draft (fresh form next open); reload mid-draft:
intact; lint; build.

---

## UXP-11 — Revive `settingsSubTab` deep-link wiring

**Verified:** `App.tsx:363-365` — `const [settingsSubTab] = useState('garage')`,
no setter, comment admits nothing sets it. Passed as `initialSubTab`
(App.tsx:1849); `SettingsView.tsx:47` copies to own state once. Compare
working pattern: `setupSubTab` App.tsx:367.

**Scope:** restore setter; expose a navigation helper (e.g.
`openSettingsTab(tab)` = `setSettingsSubTab(tab); setActiveTab('settings')`);
SettingsView syncs when prop changes (useEffect on `initialSubTab` or make
controlled). Purpose: unblocks UXP-22 (sprint 4) Garage deep-link. No caller
required yet — wiring is the deliverable; leave a one-line comment pointing
at UXP-22.

**Acceptance:** invoking helper lands on requested sub-tab; default 'garage'
unchanged; manual sub-tab taps still work; lint (no unused-var regressions vs
3-baseline); build.

---

## UXP-12 — Adopt shared `EmptyState` in Garage + ToDo

**Goal:** ad-hoc empty-state markup where shared component
(`src/components/ui/EmptyState.tsx` — icon/title/body/cta/secondaryCta)
already used by 7 other views.

**Scope:**
1. `GarageView.tsx:84-88` ("No cars yet — add one below.") → EmptyState; cta
   focuses/scrolls to add-car form.
2. `ToDoView.tsx:615-620` ("List is empty. Add your first task above.") →
   EmptyState; cta focuses add-task input.
3. `ToDoView.tsx:521-527` (my-tasks empty, task_alt icon) → EmptyState, no
   cta needed (or "Show all" secondary).
Copy stays terse shop voice.

**Note:** UXF-7's Main Checklist redesign (sprint 4 design session) may later
rework ToDoView — this stays cheap, redesign supersedes.

**Acceptance:** three ad-hoc blocks gone; visual parity light/dark; ctas
work; lint; build.

---

## UXP-13 — Clear-all-data: kill silent 5s auto-revert

**Verified:** `SettingsView.tsx:115-156` — confirm step (clearStep 1)
auto-resets to idle after silent 5s timer (:119-121, `clearTimerRef` :49). No
countdown shown; state flips under user mid-read.

**Scope:** drop the auto-revert (recommended): confirm step persists until
explicit Cancel (:133-138) or confirm (:139-150). Delete timer refs. Alt
(builder may pick): visible countdown "Cancel (5)" — only if trivial;
recommendation stands: drop it, explicit Cancel already exists.

**Acceptance:** confirm step never flips without user action; 2-step danger
flow + Clearing state (:154-156) unchanged; no dangling timer; lint; build.

---

## UXP-19 — Delete dead clock state (10s whole-app re-render)

**Verified:** `App.tsx:572` `timeStr` state (init '11:20 AM'); only writer
`setTimeStr` App.tsx:611 inside `updateTime` + `setInterval(updateTime,
10000)` (:604-615, tail of hydration useEffect). Grep confirms NO render use
— pure re-render tax on root component every 10s.

**Scope:** delete state (:572), the clock block (:604-615 `updateTime`,
`updateTime()`, interval, `clearInterval` cleanup return). Keep rest of that
useEffect (localStorage hydration :574-602) intact. Re-verify grep `timeStr`
= 0 before commit.

**Acceptance:** grep 0 hits; hydration effect intact (app boots from
localStorage — smoke test); lint; build.

---

## UXP-20 — `aria-hidden` chevrons + `aria-current` nav

**Scope:**
1. `DashboardView.tsx` :235,269,381,424,458,470 — decorative `arrow_forward`
   /chevron icon spans get `aria-hidden="true"`.
2. `App.tsx` bottom-nav buttons (:1893 onward, ids `tab-btn-*`) — add
   `aria-current={activeTab === '<tab>' ? 'page' : undefined}` to each.
3. Same nav: icon spans inside already-labeled buttons get `aria-hidden`.

**Out of scope:** focus-trap (existing C1 backlog item); other views' icons.

**Acceptance:** DOM inspect on draft confirms attrs; zero visual change;
lint; build.

---

## UXP-QA2 — Sprint 2 gate *(last)*

**Scope:**
1. Full harness suite PASS: chunk6a, chunk6b, chunk7, chunk8, chunk9,
   ux-r1-starters, ux-r1-color (none should have needed edits this sprint —
   any edit was flagged per-WS).
2. Lint exact 3-error baseline; Windows build; `git diff --check`; clean tree.
3. Grep gates: `0e0e0e` in components = 0; `timeStr` = 0; one `<title>`;
   user-visible "Race Notes" = 0; `standard|xxlarge` fontSize = 0.
4. Netlify draft: 320px + 390px, light + dark, both font sizes; pinch-zoom on
   device; Android back closes SetupDiffView + CompletionModal; car
   delete/undo round trip; accounting draft survives tab switch; offline
   reload.
5. ws-planner updates `ralph/STATE.md` UXP table rows to complete; records
   Maxx's UXP-4(b) answer.

**Acceptance:** all green + STATE.md current. No production deploy/merge/APK.
