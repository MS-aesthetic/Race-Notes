# CREW CHIEF — Sprint Index (UX tracks)

Release baseline `master`, worktree `C:\Users\maxx\antigravity\Race-Notes`.
Ralph loop consumes one sprint file at a time. Sprints run serial: 1 → 2 → 3 → 4.
(Sprint 4's Maxx design session can be scheduled any time; its build work runs last.)

| Sprint | File | Content | Status |
|---|---|---|---|
| 1 | `plan-v3-ux-corrections.md` | UXF-1…10 — owner-correction batch (2026-07-14 handoff) | COMPLETE — released as 5.0 |
| 2 | `sprint-2-quick-wins.md` | UXP-1,2,3,4,5,6,7,8,9,11,12,13,19,20 + gate — Low-difficulty audit items | pending — next after owner starts it |
| 3 | `sprint-3-second-wave.md` | UXP-10,14,15,16,17,18 + gate — Medium-difficulty audit items | pending — blocked by sprint 2 |
| 4 | `sprint-4-design-needed.md` | UXP-21,22 — High-difficulty IA items with their own Maxx design session | pending — design session gates build |

## ID scheme

`UXP-n` = "UX Polish" item n from the 2026-07-14 full UX/UI audit (22 items,
impact×difficulty ranked). Numbering is 1:1 with the audit list. Collides with
nothing in `ralph/STATE.md` history (WS-A…Z, UX-C1…9, UX-R1, UXF-1…10 all taken).
Per-sprint QA gates: UXP-QA2, UXP-QA3.

## Model routing (authoritative copy — sprint files carry a brief restate)

- `ws-planner` = GPT-5.6 SOL High. All planning + STATE/sprint tracking updates.
- `ws-builder` = GPT-5.6 Terra High. **ONE initial pass per workstream, ever.**
- Any ws-qa FAIL routes straight to `ws-fixer` = GPT-5.6 SOL High, which loops
  with `ws-qa` = GPT-5.6 SOL High (SOL↔SOL) until PASS. Terra never re-invoked
  once attempt 1 fails on a workstream.
- `cavecrew-investigator` = GPT-5.6 Terra Medium — bounded codebase
  research/search for any role mid-workstream (already configured:
  `.codex/agents/cavecrew-investigator.toml`).
- `/caveman full` for all loop artifacts (`.agents/skills/caveman/SKILL.md`).

## Notes for cold-start models

- Sprint 1 detail: read `plan-v3-ux-corrections.md` (architecture invariants,
  UXF specs, decisions log). Each sprint 2-4 file restates the invariants —
  you do not need a second file open to execute one sprint.
- Line refs in sprint 2-4 files verified 2026-07-14 **pre-UXF**. UXF batch
  lands first and touches many of the same files — re-grep any ref before
  editing if content moved.
- ws-planner adds a `UXP` status table to `ralph/STATE.md` when each sprint
  starts (same format as existing tables) and keeps it current.
