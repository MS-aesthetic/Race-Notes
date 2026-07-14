# Current Task — UX Chunk 6A: Setup / Measurement Refinement

**Status:** COMPLETE — SOL QA PASS
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Model route:** GPT 5.6 SOL High plan/QA; GPT 5.6 Terra High build.

## Owner decisions

- Finish Weekend never locks. Test days count. Button lives at page bottom.
- Setup history uses immutable Baseline, editable Weekend Setup, immutable Final,
  then editable Current Setup copied from Final.
- Four-bar includes Top and Bottom bars for LR and RR. Every bar shows:
  Frame Hole → Bar Length → Birdcage Hole; Angle at Ride Height → Angle at Full Droop.
- Tuning priority explanations use plain race-shop English:
  - High: try this first. Biggest likely help.
  - Medium: try this next if first change did not fix problem.
  - Low: fine-tuning. Check bigger items first.
- Style has two choices only: Default = existing 1.15; Large = existing 1.45.
  Scale numbers never appear in UI.
- Test coherent chunks. Do not run full Android/deploy sweep after each tiny edit.

## Chunk 6A build scope

1. Blank setup factory defaults only; copied/existing setups remain byte-safe:
   all weights `500`; all Ride Height C-to-C `17`; all pressure `10`; LF/RF
   caster `3`; LF camber `4`; RF camber `-4`; rear caster/camber unchanged/blank.
2. Label every setup height field `Ride Height C-to-C`.
3. Four-bar block moves below normal setup fields. Add optional bottom-bar
   ride-height/full-droop angle fields. Legacy `bottomBarAngle` remains readable
   fallback; never destructively remap it.
4. Tires cards show latest pressure, linked tire cycles, estimated total laps.
   Same-date/session ordering must pick actual latest logged run.
5. User-facing Smasher/Shock-session copy becomes `Load Session`. Add optional
   session `rideHeightCtoC`; localStorage, cloud mapper, additive DB migration,
   legacy hydration. Existing chart currently maps lower height lower on screen;
   preserve unless runtime fixture disproves it.
6. Theme UI exposes internal `large` as Default (1.15) and `xlarge` as Large
   (1.45). Hydration normalizes legacy `standard`→`large`, `xxlarge`→`xlarge`.
   Hide scale captions. Do not rename storage key.
7. Tuning Guide removes AFCO and chassis-specific user-facing claims. Add visible
   plain-English priority help using exact owner-approved meanings above.

## Chunk 6B design contract

- Add optional setup version metadata and persisted change log. A dedicated
  display label is required; never overwrite chassis to name a version.
- Add optional weekend source/baseline/active/final setup IDs, status, finishedAt.
- Starting weekend clones selected active-car setup into immutable Baseline and
  editable Weekend Setup. All event changes target active setup ID.
- Finish always works, even zero sessions. It snapshots Final, marks weekend
  finished, clears active weekend, then clones Final as editable Current Setup.
- Finished weekends excluded from auto-activation. Legacy missing status = active.
- Migration additive. Sync mapping explicit. Offline dual-write remains first.

## Acceptance — Chunk 6A

- Clean blank setup shows exact defaults; copy-last unchanged.
- LR/RR top and bottom bar values persist independently through reload/cloud pull.
- Latest pressure, cycles, laps match seeded hand count.
- Optional Load Session C-to-C survives offline reload and signed-in pull.
- Fixture height 12 at 100 lb and height 10 at 200 lb renders second point lower,
  single and compare charts.
- Style shows only Default/Large; old Standard opens Default, old XX-Large opens
  Large; both themes remain readable.
- Priority help understandable without setup vocabulary knowledge. Source/UI grep
  finds no user-facing AFCO or chassis-specific wording.
- `npm run lint`: exact three known baseline errors only. `npm run build`: PASS.
- Cavecrew diff review before SOL QA. Runtime QA once after full 6A slice.

## Build result — 2026-07-13

- Blank-only defaults, exact LR/RR top+bottom four-bar layout, linked-tire
  pressure/cycles/laps summary, Load Session naming and Ride Height C-to-C,
  two-size Style UI, and plain tuning-priority help implemented.
- Pressure ordering uses weekend date/time first and session timestamp only as a
  same-date fallback. Linked tire cards never borrow another tire's pressure.
- Additive migration `20260714010630_add_load_session_ride_height.sql` applied
  and verified on project `swblfeayxoprodhwxqak`; explicit push/pull mapper added.
- Cavecrew review found four issues; all fixed. Second review: zero blockers.
- Harnesses PASS: chunk5 setup, chunk5 tires, chunk6a refinement.
- `npm run lint`: exact three known baseline errors only. `npm run build`: PASS.
- Runtime QA at 390×844: light/dark Style, blank defaults, complete four-bar
  order, Load Session create/edit/reload field, and graph fixture passed. For
  12 in/100 lb vs 10 in/200 lb, the 10 in point rendered lower (`cy 176 > 18`).
- Netlify draft: `https://6a558ea45dc5716d3bed026a--crew-chief-race-notes.netlify.app`.
  Production unchanged. C6B remains unimplemented by design.

## SOL QA adjudication — 2026-07-13

- Feature commit: `ae9395b`.
- Runtime metadata: `gpt-5.6-sol`, reasoning effort `high`, same persistent task.
- Independent cavecrew commit review: zero code findings; stale status text only.
- Three focused harnesses PASS. Type-check remains exactly three documented
  pre-existing errors. Vite/Workbox build PASS; clean working tree before docs.
- Netlify draft auth gate PASS with zero console errors. Prior authenticated local
  mobile fixture evidence accepted for full C6A screens.
- Supabase migration history contains `20260714010630`; live
  `public.shock_sessions.ride_height_ctoc` is nullable `text` with empty default.
- Verdict: PASS. C6A closed. C6B is next and remains untouched.

## Out of scope until later chunks

- Weekend version implementation (6B), expanded Quick Adjust (7), tracker reset/
  maintenance automation/assignment (8), export/final sweep (9).
