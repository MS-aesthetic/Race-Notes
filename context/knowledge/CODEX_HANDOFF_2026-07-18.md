# CODEX HANDOFF — UX Overhaul v2 — 2026-07-18

Paste-ready kickoff instructions are at the bottom. Read order for a cold-start agent:

1. `ralph/CURRENT_TASK.md` — current task (C2 repair, owner-approved, unblocked)
2. `context/knowledge/UX_TECHNICAL_REVIEW_2026-07-17.md` — plan authority, **including the v2.1 Owner Addendum**
3. `ralph/STATE.md` — full history A1→C2

## Where things stand

- Branch `codex/ux-overhaul`, worktree `C:\Users\maxx\.codex\worktrees\203f\Race-Notes`, clean tree at `a11e8f4`.
- Complete and QA-passed: Chunk A (A1–A4 + chunk QA), Chunk B (B1–B3 + chunk QA), C1.
- C2 built at `253897a`; QA attempt 1 FAIL 92/100 — harness CRLF portability only, no product defect. Repair scope now owner-approved (v2.1-B). Execute the SOL repair work order in `ralph/CURRENT_TASK.md`.
- New owner-priority Task **C2.5** (setups corner-card alignment + stacked stepper) runs after C2 passes, before C3. Full spec: v2.1-C.
- Then: C3, C4, C5, Chunk C QA, Chunk D, Chunk E, final QA, Part 6.4 handoff doc.

## Paste-ready kickoff instructions (owner → new Codex chat session)

---

ROLE AND MODEL ROUTING

You are the PRIMARY agent for this session: QA and plan authority, running as GPT-5.6 SOL **Extra High**. You do not implement build tasks yourself. For every build/implementation task you spawn a subagent running GPT-5.6 SOL **High** and hand it the current task instruction. You QA the subagent's output, maintain `ralph/STATE.md` / `ralph/CURRENT_TASK.md`, and keep the plan document current. Exception: the escalation rule in plan §5.0 — after a task fails 3 consecutive attempts, you implement the fix directly, held to the identical bar. Terra (any tier) and `cavecrew-builder` are forbidden.

COMMUNICATION DISCIPLINE

- Use the **caveman** skill for all working notes, status updates, QA verdicts, and completion reports.
- Use the **cavecrew** pattern for all subagent delegation: compressed investigator/builder/reviewer contracts. No vanilla open-ended subagents.
- Exception: rework instructions and owner-facing reports use full prose.

WHERE TO WORK

Continue in the existing UX-Overhaul worktree, branch `codex/ux-overhaul`. Do not create a new worktree or branch. Read, in order: `ralph/CURRENT_TASK.md`, then `context/knowledge/UX_TECHNICAL_REVIEW_2026-07-17.md` including the v2.1 Owner Addendum, then `ralph/STATE.md`.

IMMEDIATE WORK QUEUE

1. C2 harness repair — owner approval is recorded; execute the SOL repair work order in `ralph/CURRENT_TASK.md`, then run C2 QA per its exact post-repair gates.
2. Task C2.5 (v2.1-C) — setups corner-card alignment + stacked stepper redesign (value on top, − / + side-by-side below). Owner priority.
3. Resume plan order: C3 → C4 → C5 → Chunk C QA → Chunk D → Chunk E → final QA.

TESTING WORKFLOW

- Quick inspection: `npm run build`, deploy a Netlify **draft preview** (`netlify deploy --dir=dist`), inspect with your built-in browser at 360×800 / 390×844 / 412×915.
- Device verification: build a **debug** APK (`npx cap sync android; cd android; .\gradlew.bat assembleDebug` with Java 21 at `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`) and install to the already-running Android emulator. Debug builds only — no release builds, no signing, no `release/` changes, no production Netlify publish, no push, no merge to master.
- `npm run lint` (tsc) before every commit; the known 3-error baseline binds per the plan.

OWNER REPORTING

After every task QA and every chunk QA, write/update `context/knowledge/OWNER_REPORT_UX_OVERHAUL.md` in plain English: what was built, what was checked, pass/fail, what's next. This document is for the owner and is never caveman-compressed.

---
