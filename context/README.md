# Context Hub — start here

Single entry point for any agent or person picking up **Crew Chief** (`nimbus.engineering.crewchief`).
Point a new agent at this folder. It maps every piece of durable context: knowledge, archived
planning, live operational files, and the tool-loaded agent/skill configs.

> **Current baseline:** `master` = release **5.2.1** (versionCode 24), live on Google Play.
> This is the source of truth. All future work branches from `master`.

---

## Read in this order

1. **[`/AGENTS.md`](../AGENTS.md)** (repo root) — architecture, conventions, file map, workflow rules.
2. **[`/HANDOFF.md`](../HANDOFF.md)** (repo root) — consolidated onboarding: current status, session
   history, build/deploy procedures, worktree/branch gotchas.
3. **[`knowledge/CODEBASE_KNOWLEDGE.md`](./knowledge/CODEBASE_KNOWLEDGE.md)** — durable facts about the codebase.
4. **[`/SPRINT_INDEX.md`](../SPRINT_INDEX.md)** (repo root) — active roadmap index + model routing.
5. **[`AGENTS_AND_SKILLS.md`](./AGENTS_AND_SKILLS.md)** — the agent/skill definitions and where they live.

---

## What's in this folder

### `knowledge/` — durable knowledge & handoffs
| File | What it is |
| --- | --- |
| `CODEBASE_KNOWLEDGE.md` | Durable facts about the codebase (architecture, invariants). |
| `PROJECT_INSTRUCTIONS.md` | Standing project instructions for agents. |
| `CODEX_HANDOFF_2026-07-18.md` | Codex session handoff. |
| `OWNER_REPORT_UX_OVERHAUL.md` | Owner-facing report on the UX overhaul. |
| `UX_OVERHAUL_V2_AGENT_KNOWLEDGE.md` | Agent knowledge for the UX overhaul v2 work. |
| `UX_OVERHAUL_V2_FINAL_HANDOFF_2026-07-19.md` | Final handoff for UX overhaul v2. |
| `UX_TECHNICAL_REVIEW_2026-07-17.md` | Technical UX review. |

### `archive/` — superseded planning & history
Completed/superseded plans, sprint files, QA plans, and older handoffs kept for historical
reference (`plan-v2.md`, `plan-v3-ux-corrections.md`, `plan-setup-layout-preload.md`,
`sprint-2/3/4-*.md`, `car-profiles/`, `IMPLEMENTATION_PLAN_2026-07-12.md`,
`UX_ANALYSIS_2026-07-12.md`, and prior release/QA docs).
Not active — do not follow these as current direction.

---

## Lives outside this folder (by necessity) — pointers

Some context stays in fixed locations because tools load it from there. **Do not move these.**

### Live operational files (repo root) — agents read these by path
- **[`/AGENTS.md`](../AGENTS.md)** — architecture & workflow (also a root convention some agent tools auto-read).
- **[`/HANDOFF.md`](../HANDOFF.md)** — onboarding & current status.
- **[`/SPRINT_INDEX.md`](../SPRINT_INDEX.md)** — active roadmap.
- **[`/ralph/STATE.md`](../ralph/STATE.md)** and **[`/ralph/CURRENT_TASK.md`](../ralph/CURRENT_TASK.md)** — live Ralph-loop state.

### Agent & skill definitions (tool-loaded) — see [`AGENTS_AND_SKILLS.md`](./AGENTS_AND_SKILLS.md)
- `.codex/agents/*.toml` + `.codex/config.toml` — Codex agent roles.
- `.github/agents/*.agent.md` — GitHub agent definitions.
- `.agents/skills/*/SKILL.md` — `cavecrew` and `caveman` skills.

### Product & release docs (repo `docs/`)
- `docs/USER_GUIDE.md` — end-user guide.
- `docs/GOOGLE_PLAY_UPLOAD_5.2.1.md` — current release/upload checklist.

---

## Rules of the road
- `master` is the single line. Branch from it: `git switch -c feature/<name>`.
- Never point agents at the archived plans as if they were current — start from `HANDOFF.md` + `SPRINT_INDEX.md`.
- Housekeeping: `repo-tidy.ps1` (repo root) prunes merged branches and stale worktrees safely.
