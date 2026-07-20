# CREW CHIEF — Sprint Index (UX tracks)

Release baseline `master` remains at `C:\Users\maxx\antigravity\Race-Notes`.
UX Overhaul v2 is **complete** on `codex/ux-overhaul` at
`C:\Users\maxx\.codex\worktrees\203f\Race-Notes`. Its authority is
`docs/UX_TECHNICAL_REVIEW_2026-07-17.md` plus the v2.1 addenda,
`ralph/CURRENT_TASK.md`, and `ralph/STATE.md`. Detailed cold-start procedure is
`docs/UX_OVERHAUL_V2_AGENT_KNOWLEDGE.md`.

The older numbered sprint files below describe Release 5.0 planning lineage and
future deferred work. Do not start Sprint 2, 3, or 4 until the owner separately opens that work.

| Sprint | File | Content | Status |
|---|---|---|---|
| UX Overhaul v2 | `docs/UX_TECHNICAL_REVIEW_2026-07-17.md` | Mobile density, persistence semantics, deletion integrity, navigation polish, final QA | **COMPLETE — product `ab2d031`; reviewed Part 6.4 handoff `22dc112`; final saving-point branch pushed** |
| 1 | `docs/archive/plan-v3-ux-corrections.md` | UXF-1…10 — owner-correction batch (2026-07-14 handoff) | COMPLETE — released as 5.0 |
| 2 | `sprint-2-quick-wins.md` | UXP-1,2,3,4,5,6,7,8,9,11,12,13,19,20 + gate — Low-difficulty audit items | deferred — requires separate owner opening/approval |
| 3 | `sprint-3-second-wave.md` | UXP-10,14,15,16,17,18 + gate — Medium-difficulty audit items | pending — blocked by sprint 2 |
| 4 | `sprint-4-design-needed.md` | UXP-21,22 — High-difficulty IA items with their own Maxx design session | pending — design session gates build |

## ID scheme

`UXP-n` = "UX Polish" item n from the 2026-07-14 full UX/UI audit (22 items,
impact×difficulty ranked). Numbering is 1:1 with the audit list. Collides with
nothing in `ralph/STATE.md` history (WS-A…Z, UX-C1…9, UX-R1, UXF-1…10 all taken).
Per-sprint QA gates: UXP-QA2, UXP-QA3.

## Model routing (authoritative copy — sprint files carry a brief restate)

- **Current v2 routing:** implementation tasks use `gpt-5.6-sol` High workers;
  primary QA/plan authority uses `gpt-5.6-sol` Extra High. Terra at every tier
  and `cavecrew-builder` are forbidden by the v2.1 owner addendum.
- After three consecutive failures of the same task, primary Extra High owns
  direct implementation under the identical file and QA restrictions.
- Cavecrew investigator/reviewer contracts remain available for bounded tracing
  and findings-first review. They do not replace runtime model verification.
- Older sprint role files preserve historical routing only; they do not override
  the active v2.1 addendum.
- `/caveman full` for all loop artifacts (`.agents/skills/caveman/SKILL.md`).

## Notes for cold-start models

- Start active work with `ralph/CURRENT_TASK.md`, not Sprint 2.
- Exact active checkout is the 203f worktree above; do not edit the release tree
  or the independent 3d72 QA checkout.
- Sprint 1 historical detail: read `docs/archive/plan-v3-ux-corrections.md` (architecture invariants,
  UXF specs, decisions log). Each sprint 2-4 file restates the invariants —
  you do not need a second file open to execute one sprint.
- Line refs in sprint 2-4 files verified 2026-07-14 **pre-UXF**. UXF batch
  lands first and touches many of the same files — re-grep any ref before
  editing if content moved.
- ws-planner adds a `UXP` status table to `ralph/STATE.md` when each sprint
  starts (same format as existing tables) and keeps it current.
