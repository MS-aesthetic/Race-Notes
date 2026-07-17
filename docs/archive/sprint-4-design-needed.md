# CREW CHIEF — Sprint 4: Design-Session Items (UXP, High difficulty)

> Source: 2026-07-14 UX/UI audit, items 21+22 — the two items needing real
> IA/product judgment, NOT buildable from spec alone. Master index:
> `SPRINT_INDEX.md`. Self-contained.
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
> Windows PowerShell.
>
> **Routing (brief — authoritative in SPRINT_INDEX.md):** ws-planner = SOL High
> (plans + STATE updates). ws-builder = Terra High, ONE initial pass per WS.
> QA FAIL routes to ws-fixer = SOL High, loops with ws-qa = SOL High until
> PASS — Terra never re-invoked after attempt 1. cavecrew-investigator = Terra
> Medium for bounded research. `/caveman full` all loop artifacts.

## Shape of this sprint — Maxx session gates the build

Both items here are options-doc → Maxx decision → build WS. Same working mode
as **UXF-7** (Main Checklist redesign, spec-only — already fully specced in
`plan-v3-ux-corrections.md` §UXF-7; produces
`docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md`; do NOT redefine it here).

UXF-7 is thematically the same kind of work — checklist/IA judgment needing
Maxx. **Recommended: one combined design sitting covers all three** (UXF-7
proposal + UXP-21 options + UXP-22 options). ws-planner prepares one agenda;
Maxx redlines in one pass; ws-planner then writes the resulting build
workstreams (UXF follow-on per plan-v3 §UXF-7; UXP-21B/UXP-22B appended to
this file) with normal scope/acceptance rigor.

Options docs can be written ANY time (analysis unblocked now); build WSs run
after sprints 2-3 land (UXP-22 hard-depends on UXP-11, sprint 2).

```
UXP-21a  options doc: Trackers/Service naming     (no prereq)
UXP-22a  options doc: Garage discoverability      (no prereq)
[ Maxx design session — UXF-7 + UXP-21 + UXP-22 together ]
UXP-21B  build (ws-planner specs post-session)
UXP-22B  build (needs UXP-11 from sprint 2)
```

---

## UXP-21 — "Trackers" label + Service/Maintenance naming unification

**Problem (Medium impact / High difficulty):** bottom-nav "Trackers" says
nothing about Accounting + Service living there — zero information scent.
Vocabulary split: Dashboard says "Maintenance Due" / "Log maintenance"
(`DashboardView.tsx`); Trackers tab says Service / "Maintenance Logs"
(`TrackersView.tsx`, naming landed UX-C8). One domain, two nouns, hidden
location. High difficulty because rename ripples: nav label width at 320px,
sub-tab names, Dashboard chips, App Guide (`GuideView.tsx`), `docs/
USER_GUIDE.md`, chunk8 harness copy assertions, help anchors (chunk9).

**UXP-21a — options doc (buildable now):** short doc (NOT UXF-7 scale —
≤2 pages) for Maxx: (1) inventory every user-visible label in the
Trackers/Dashboard maintenance+accounting surface with file refs; (2) pick-one
noun proposal: **Service** vs **Maintenance** everywhere (recommend one,
justify in racer language); (3) 3-4 tab-label candidates ("Trackers" keep /
"Shop" / "Service & Money" / split-into-Dashboard) with 320px nav-width check
per candidate (5 tabs, `App.tsx` bottom nav, labels break-words); (4) sub-tab
naming per candidate; (5) cheapest-ripple recommendation.

**UXP-21B — build (post-session):** ws-planner writes scope from Maxx's picks.
Expected files: `TrackersView.tsx`, `DashboardView.tsx`, `App.tsx` (nav
label), `GuideView.tsx`, `docs/USER_GUIDE.md`, `scripts/chunk8-trackers-
harness.ts` + `scripts/chunk9-export-help-harness.ts` (copy assertions).
Copy-only expected — any structural move (e.g. Accounting relocation) gets
its own spec, not smuggled in.

**Out of scope:** interval mechanics (UXF-6 done); checklist redesign
(UXF-7); "Run" noun (UXP-8 done).

**Acceptance (21a):** doc answers all five bullets, every label claim carries
file ref, Maxx can decide in one sitting. **(21B):** grep shows single chosen
noun across user-visible surface; nav fits 320px both fonts; harnesses PASS
with updated copy assertions; lint; build.

---

## UXP-22 — Garage discoverability + first-run deep-link

**Problem (Medium impact / High difficulty):** Garage (car management — the
thing everything else scopes to via `byActiveCar()`) is buried as a Settings
sub-tab (`SettingsView.tsx`, sub-tab 'garage'). First-run
GetRaceReadyCard "Add your car" (`DashboardView.tsx`) has weak scent —
doesn't say WHERE cars live, and pre-UXP-11 couldn't deep-link at all.

**Hard dependency:** UXP-11 (sprint 2) — revived `settingsSubTab` wiring +
`openSettingsTab()` helper. Verify landed before UXP-22B.

**Pre-decided minimum (no Maxx needed — include in 22B regardless):**
GetRaceReadyCard "Add your car" action deep-links `setActiveTab('settings')` +
sub-tab 'garage' via UXP-11 helper. Any other "car" call-to-action found in
Dashboard/empty states gets the same link (TiresSubView `onGoToGarage` prop
already models this — check its wiring for the pattern).

**UXP-22a — options doc (buildable now):** for Maxx: (1) map every entry path
to Garage today + every surface that DEPENDS on active car (Setups, Tires,
SmasherLoads, weekends, maintenance car-scope) with file refs; (2) options
ladder: A = deep-links only (minimum above); B = ContextStrip car chip opens
car-switcher sheet with "Manage garage" link (ContextStrip already shows
active car — `src/components/ContextStrip.tsx`); C = Garage promoted out of
Settings (Dashboard card / own sub-tab elsewhere) — note 5-tab nav is full,
promotion means displacement; (3) cost/benefit per rung, single-car-user
consideration (ContextStrip hides car chip when ≤1 car — preserve that
quietness); (4) recommendation.

**UXP-22B — build (post-session):** ws-planner specs from picked rung.
Rung A files: `DashboardView.tsx`, `App.tsx` (pass helper). Rung B adds
`ContextStrip.tsx` + a BottomSheet. Rung C = real IA change — gets full
spec + its own QA.

**Out of scope:** car CRUD behavior (UXP-2/3 done); `byActiveCar` semantics
(invariant); nav restructure beyond what Maxx explicitly picks.

**Acceptance (22a):** doc covers all four bullets with file refs; one-sitting
decidable. **(22B):** first-run card lands user IN Garage one tap; chosen
rung works 320px both themes; single-car quietness preserved; lint; build;
STATE.md updated by ws-planner.

---

## Cross-reference — UXF-7 (do not redefine)

UXF-7 = Main Checklist UX redesign, spec-only workstream, fully defined in
`plan-v3-ux-corrections.md` §UXF-7 (deliverable
`docs/MAIN_CHECKLIST_REDESIGN_PROPOSAL.md`; its follow-on build WS gets added
there by ws-planner as UXF-10 after Maxx approves). Listed here ONLY because
it needs the same Maxx design sitting — bundle its proposal review into this
sprint's session agenda. Its spec, ownership, and acceptance live in plan-v3;
nothing about it changes in this file.
