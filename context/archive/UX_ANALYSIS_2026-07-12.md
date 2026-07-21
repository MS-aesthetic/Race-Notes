# CREW CHIEF — UX/UI Expert Analysis

_Analyst: Fable 5 (high) as senior front-end UI/UX designer · 2026-07-12_
_User lens: dirt-track racing crew (deep racing expertise, little app experience; gloved, glare, hurried, phone-portrait, team-shared)._

---

## WS-Z QA context (separate track — for reference)
WS-Z ("July 11 product simplification") = **Fable QA CONDITIONAL PASS 86/100**. All code-verifiable criteria pass (Trackers tabs = Checklist/Service/Templates/Accounting w/ no Shopping; Main Checklist migration harness ALL PASS; migration 014 DELETE policies live; `delete*FromCloud` helpers present; lint 3-baseline; build pass). Remaining before full PASS: runtime visual + two-user authenticated team-delete QA. See `ralph/STATE.md` grade log.

---

# OUTPUT 1 — Full Recommendations

## A. Onboarding / First-run

**1. Guided first-run "Get race-ready" card instead of an empty Dashboard** — Critical path (make a car → create weekend → set active → session) is invisible; novices see a dead Dashboard + disabled button and quit. Dashboard top card becomes a 3-step progress card with jump buttons; disappears when all three exist. **Difficulty: Low** (no router → setActiveTab + a pendingAction flag).

**2. Never show a disabled primary button without a reason — make it a teaching button** — Disabled "+ Session Entry" with no explanation is the worst novice trap. Keep it visually enabled (outline); tapping with no active weekend opens a sheet: "Need an active weekend first" + one-tap create/activate. App-wide pattern. **Difficulty: Trivial.**

**3. Every empty state is a call to action, in racing language** — Empty lists read as dead ends. Standardize `<EmptyState>`: icon + one plain sentence + big primary button ("No setups for LETHAL yet — Start a baseline setup"). **Difficulty: Low.**

**4. Auto-create the first car at sign-up** — A car scopes half the app but is created 3 levels deep. If team has zero cars, show a one-field modal before Dashboard; that car becomes active. **Difficulty: Low.**

## B. Dashboard

**5. Auto-activate a weekend on creation (and most-recent by default)** — "Set Active" is app ceremony, not a racing concept. New weekend = active automatically; on load, auto-activate a weekend dated ±2 days with a dismissible toast. **Difficulty: Low.**

**6. One persistent context header: car + weekend together** — Two "active" concepts in two places confuses novices. Replace the car chip with a context strip: `🏁 LETHAL · Eldora — Jul 12` on Dashboard/Setups/Sessions; tap halves to change; missing half shows amber prompt. **Difficulty: Medium.**

**7. A single giant "+ LOG RUN" Dashboard hero during a weekend** — Between-heats job = log a run in 90s with gloves. When a weekend is active, top element = full-width thumb-height "+ LOG RUN" (next session type pre-selected) + a "Last run …→" one-tap row. **Difficulty: Medium.**

**8. Separate destructive actions from primary ones; use Undo toasts** — "Set Active" next to delete + gloves/glare = lost data. Move delete behind ⋯; replace confirm dialogs with 5s Undo toasts (trivial in local-first). **Difficulty: Low.**

**9. Trim Dashboard panel load — collapse all but what needs attention** — Setups/Tires/Service/Checklist panels + weekend list = a wall. Default-collapse; show urgent summary on collapsed header ("2 OVERDUE"); consider dropping the Setups/Tires panels (duplicate the Setups tab). **Difficulty: Trivial–Low.**

**10. Track filter remembers itself; default to "this weekend first"** — Novices won't use a filter but get buried by other-track history. Partition: this weekend first, "Past weekends (n)" collapsed. **Difficulty: Trivial.**

## C. Sessions / Race Weekend

**11. Smart session sequencing: auto-name + pre-select next type** — A night has a known shape (Hot Laps→Qual→Heat→Feature). Pre-select next logical type, auto-name ("Heat 1"), pre-fill condition/weather from prior session. **Difficulty: Low.**

**12. Three-point driver diagnostics as one glanceable 3×3 tap grid** — Entry/Apex/Exit × Tight/Neutral/Loose IS how these users think. Fixed grid, fat segmented buttons ≥48px, high-contrast fill; read-only colored dots in session lists. 3 taps total. **Difficulty: Low.**

**13. Purpose-built lap-time entry** — Typing "15.42" gloved in glare = errors on the most-entered number. Big custom numeric keypad (digits + "."), large mono display, auto-compute best/avg, fast repeated entry. **Difficulty: Medium.**

**14. "After the run" quick-log flow: one top-to-bottom screen** — Five subsections = navigation under time pressure. Order session detail as a ritual: Laps → Diagnostics grid → "What did you change?" (recent-adjustment chips) → Notes → sticky "Done ✓". No required fields. **Difficulty: Medium.**

**15. One owner for weekends: Sessions tab owns them; Dashboard = launchpad** — Weekends live on Dashboard but the tab is "Sessions"; novices can't map it. Make the Sessions tab (rename "Race Day") the single home of weekends (create/activate/list/detail). Dashboard keeps only the Log Run hero, context strip, attention panels. **Difficulty: Medium** (biggest IA edit; moving components between tab renders).

## D. Setups

**16. "Copy last setup" as the default way to start** — Nobody builds from blank; they tweak baseline. New setup = chooser: Copy [last at this track] / [active] / Blank; pre-filled values muted until touched. **Difficulty: Low.**

**17. Corner-card layout with steppers, not bare inputs** — Gloves + tiny inputs = mis-entry on pressures/springs. 2×2 physical corner cards; big −/+ steppers with per-field increments; inputmode decimal; mono ≥18px. **Difficulty: Medium.**

**18. Fold four-bar geometry behind an "Advanced / Rear geometry" expander** — 8 inputs × 2 corners is expert-only and buries pressures (edited every night). LR/RR show spring/shock/pressure first; "Four-bar & birdcage ▸" expands; persist expanded state. Keep Ride Height / Full Droop labels. **Difficulty: Trivial–Low.** _(Validate with real users — some live in these fields.)_

**19. Make pressure auto-propagation visible/trusted** — Silent push of pressures into the session = novices distrust or re-enter. Toast on save ("Pressures copied to Heat 2 ✓"); "from setup" tag until edited. **Difficulty: Low.**

**20. Surface the setup diff where the question is asked** — "What changed since Qualifying?" is the #1 question but compare is hidden. One-tap "Compare to previous" chip on setup cards + session setup section → existing diff modal, changed fields only. **Difficulty: Low.**

**21. Relocate/dual-home tire inventory** — Tire inventory is asset mgmt, not setup entry; clutters the form. Setups tab two-pill header "Setups | Tires"; form only references tires via picker. **Difficulty: Medium.**

## E. Trackers

**22. Merge Templates into the Checklist sub-tab** — A whole tab for a twice-a-year task is IA weight. "Add from template ▸" sheet + "Edit templates" link. Trackers → 3 sub-tabs. **Difficulty: Low.**

**23. Checklist "new weekend reset" ritual** — One global Main Checklist keeps last weekend's checks; a stale list defeats the safety purpose. On new/active weekend, prompt once: "Reset Main Checklist? [Reset all][Keep]"; show "last reset" date. **Difficulty: Low.**

**24. "Mine first" checklist ordering + big toggle rows** — Shared list, multiple crew, time pressure. Sort assigned-to-me to top under "YOURS (n)"; whole row toggles (≥56px); checked sink w/ strikethrough. **Difficulty: Trivial–Low.**

**25. Service: log from the Dashboard chip; default the cost link** — Due chips are good triage but require tab-hopping; optional cost→Accounting gets skipped. Tapping a Due item opens the Log-service modal directly; filled cost auto-creates the Accounting entry w/ active weekend pre-linked. **Difficulty: Low.**

**26. Accounting: default the weekend link; payer/payee memory** — Optional fields never filled → useless reports. Pre-fill weekend = active; payer/payee recent-chips. 3 taps + amount. **Difficulty: Trivial.**

## F. Navigation / IA

**27. 6 bottom tabs → 5 by demoting QuickRef** — Six tabs at portrait = cramped targets. Move QuickRef behind the top-bar "?" (help sheet w/ ref tables + guide). Five bigger tabs. **Difficulty: Low.**

**28. Tab order follows the race-day ritual** — Order should teach the workflow: Dashboard · Race Day · Setups · Trackers · Settings. **Difficulty: Trivial.**

**29. Preserve scroll/expansion per tab; honor Android back** — No router → tab switches lose state; hardware back exits the app ("app ate my work"). Keep tabs mounted (CSS hide) or persist state; intercept back to close modals → Dashboard → exit. **Difficulty: Medium** (~40-line back shim).

**30. Name things in the user's language** — "Session Entry/Set Active/Trackers/Templates" are app words. Use run/heat/Race Day/maintenance/checklist/"This weekend". Keep real jargon (durometer, birdcage, cross weight). **Difficulty: Trivial.**

## G. Global / Visual

**31. Glove-and-glare hardening pass** — Stated user is gloved/glare/one-handed/hurried. Audit: all tappables ≥48px; primaries full-width bottom-anchored/sticky; status chips = icon+text not color alone; amber/red contrast ≥4.5:1 on dark. **Difficulty: Medium** (broad but mechanical; tokens centralize).

**32. One-tap "Sunlight" mode** — Dark default is right at night but hot laps are 4pm July. Sun/moon toggle in the top bar → instant dark↔light; light theme tuned for max contrast; optional auto-by-time. **Difficulty: Low.**

**33. Trust indicators: saved-state + sync-state feedback** — Local-first is invisible; novices distrust w/ spotty track Wi-Fi. Autosave + "Saved ✓ 4:12" mono stamp; top-bar cloud icon (synced/pending n/offline) w/ plain-language explainer. **Difficulty: Medium** (depends on sync-layer status API).

**34. Font-zoom QA on dense screens** — Older users + xxlarge + mono tables (scale %, four-bar grid, diff) is where layouts break = "buggy". Fix wrap to single-column, never truncate numbers. **Difficulty: Low–Medium.**

## H. Settings / Export

**35. Move "share the weekend PDF" to where the weekend lives** — The payoff (text the driver the sheet) is buried in Settings→Export. Share icon on weekend/setup cards → Web Share API (straight to SMS/WhatsApp). Export stays the bulk/CSV home. **Difficulty: Low.**

**36. Merge Guide into contextual help; retire the sub-tab** — An accordion manual in Settings won't be read. Top-bar "?" becomes context-aware (setup help on Setups, session help on Race Day + QuickRef tables). **Difficulty: Low.**

**37. Garage: make multi-car switching honest; hide chip if one car** — Switching active car silently changes Setups/Tires/Service but not weekends/checklist → "my data vanished". One-time toast on switch explaining scope; hide the car chip entirely until a 2nd car exists. **Difficulty: Trivial–Low.**

---

# OUTPUT 2 — Cost/Benefit Priority

| Rank | Recommendation | Impact | Effort | Verdict |
|---|---|---|---|---|
| **QUICK WINS — do first** | | | | |
| 1 | #2 Disabled button → teaching button | H | L | The #1 novice wall, fixed in an afternoon |
| 2 | #5 Auto-activate weekend | H | L | Deletes a whole failure mode |
| 3 | #4 First-car creation at sign-up | H | L | Removes the deepest-buried prerequisite |
| 4 | #16 Copy-last-setup default | H | L | Turns the scariest form into a 3-field edit |
| 5 | #11 Smart session sequencing & prefill | H | L | Biggest tap-count reduction per weekend |
| 6 | #12 Diagnostics 3×3 tap grid | H | L | Perfect fit to user mental model, small build |
| 7 | #8 Deletes behind ⋯ + undo toasts | H | L | Data-loss insurance, trivially local-first |
| 8 | #1 First-run "Get race-ready" card | H | L | Ties wins 1–3 into one guided path |
| 9 | #23 Checklist reset per weekend | H | L | Restores the checklist's actual purpose |
| 10 | #35 Share PDF from weekend card | H | L | Moves the payoff moment to where users are |
| 11 | #19 Propagation toast/provenance | M | L | Cheap trust-builder |
| 12 | #30 Racing-language copy audit | M | L | Strings only; compounds every fix |
| 13 | #25 Service log from Dashboard + auto-accounting | M | L | Two records, one form |
| 14 | #3 Empty-state CTAs | M | L | One component, app-wide payoff |
| 15 | #26 Accounting defaults/recents | M | L | Makes reports usable |
| 16 | #22 Merge Templates into Checklist | M | L | IA weight loss for free |
| 17 | #24 Mine-first checklist, row-tap | M | L | Daily-use ergonomics |
| 18 | #37 Car-switch clarity / hide chip if one car | M | L | Prevents "my data vanished" |
| 19 | #10 This-weekend-first sorting | L | L | Minutes of work |
| 20 | #28 Tab reorder | L | L | Do alongside #27 |
| **BIG BETS — high impact, real work** | | | | |
| 21 | #6 Unified context strip (car + weekend) | H | M | Solves two-actives confusion at the root |
| 22 | #7 "Log Run" Dashboard hero | H | M | The between-heats speed win |
| 23 | #15 Sessions tab owns weekends; Dashboard = launchpad | H | M | The IA fix everything leans on |
| 24 | #31 Glove/glare hardening pass | H | M | Broad but mechanical sweep |
| 25 | #17 Corner cards + steppers | H | M | Data-quality on highest-stakes numbers |
| 26 | #29 Back-button + state preservation | H | M | Invisible until it saves someone's night |
| 27 | #14 Top-to-bottom quick-log session layout | M | M | Pairs with #12/#13 |
| 28 | #13 Lap-time keypad | M | M | Worth it after #14 |
| 29 | #27 Five tabs (QuickRef → help sheet) | M | M | Do with #36 |
| 30 | #33 Saved/sync trust indicators | M | M | Depends on sync-status API |
| **NICE-TO-HAVE** | | | | |
| 31 | #18 Fold four-bar behind expander | M | L | Validate with real users first |
| 32 | #20 Diff entry points | M | L | Once diff data quality is there |
| 33 | #32 Sunlight toggle | M | L | Confirm daytime usage first |
| 34 | #36 Contextual help + QuickRef merge | M | L | With #27 |
| 35 | #9 Dashboard panel diet | M | L | Falls out of #15 |
| 36 | #21 Tires sub-view in Setups | M | M | Right long-term home; not urgent |
| 37 | #34 Font-zoom QA | M | M | Schedule as a QA sprint |
| **SKIP / REVISIT** | | | | |
| — | Voice capture, per-weekend checklists, template marketplace, nav-router rework | — | — | Feature additions/infra churn, not UX debt. WS-Z's one-checklist simplification was correct — don't reverse without evidence. |

**If you only do five things:**
1. **#2 + #5** — kill the disabled-Session-Entry wall (teaching button + auto-active weekend). Stops day-one abandonment.
2. **#1 + #4** — guided first run with car creation at sign-up.
3. **#15 + #7** — Sessions tab owns weekends; Dashboard becomes a big "Log Run" launchpad.
4. **#16 + #11** — copy-last-setup + smart session prefill: a full race night's taps drop ~half.
5. **#12** — the Tight/Neutral/Loose 3×3 grid: cheap, delightful, native to the user's language.

---

# OPEN QUESTIONS (answers would refine the recommendations)

1. **When is the app touched — live between heats (gloves, 90s windows) or mostly after the night at the trailer/home?** Decides how far to push quick-log (#7/#13/#14) vs richer forms.
2. **Who enters data — one designated person (crew chief's phone) or multiple members concurrently?** Changes prominence of assignment, sync state (#33), "who changed this".
3. **How many cars does a typical team run?** If ~80% single-car, hide all car-switch UI (#37); if two-car common, context strip's car half (#6) must be front-and-center.
4. **How often is four-bar/birdcage geometry changed at the track vs in the shop?** Determines whether folding it behind an expander (#18) helps or hides the fields your best users came for.
5. **Is daytime use significant, or overwhelmingly night racing?** Gates the Sunlight toggle (#32) + light-theme contrast effort.
6. **Is "Main Checklist" a per-event pre-race ritual or a running to-do list?** Reset-per-weekend (#23) is right for the former, wrong for the latter — answer before building.
