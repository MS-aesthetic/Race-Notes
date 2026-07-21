# Agents & Skills — index

Inventory of the agent and skill definitions in this repo. **These files stay in their current
locations** — each is auto-loaded by its tool from a fixed path. This page is a map, not a copy;
edit the originals in place.

---

## Skills — `.agents/skills/`
| Skill | File | Purpose |
| --- | --- | --- |
| `caveman` | `.agents/skills/caveman/SKILL.md` | Ultra-compressed communication mode (`/caveman full`). |
| `cavecrew` | `.agents/skills/cavecrew/SKILL.md` | Delegation to compressed-output subagents (investigator/builder/reviewer). |

## Codex agents — `.codex/agents/*.toml` (+ `.codex/config.toml`)
The **ws-*** roles run the release/build workflow (the "Ralph loop"); the **cavecrew-*** roles are
read/compressed helpers.

| Role | File |
| --- | --- |
| ws-planner | `.codex/agents/ws-planner.toml` |
| ws-builder | `.codex/agents/ws-builder.toml` |
| ws-fixer | `.codex/agents/ws-fixer.toml` |
| ws-qa | `.codex/agents/ws-qa.toml` |
| ws-runtime-qa | `.codex/agents/ws-runtime-qa.toml` |
| ws-fallback | `.codex/agents/ws-fallback.toml` |
| cavecrew-investigator | `.codex/agents/cavecrew-investigator.toml` |
| cavecrew-builder | `.codex/agents/cavecrew-builder.toml` |
| cavecrew-reviewer | `.codex/agents/cavecrew-reviewer.toml` |
| cavecrew-read-fallback | `.codex/agents/cavecrew-read-fallback.toml` |
| (config) | `.codex/config.toml` |

## GitHub agents — `.github/agents/*.agent.md`
| Role | File |
| --- | --- |
| ws-planner | `.github/agents/ws-planner.agent.md` |
| ws-builder | `.github/agents/ws-builder.agent.md` |
| ws-fixer | `.github/agents/ws-fixer.agent.md` |
| ws-qa | `.github/agents/ws-qa.agent.md` |

---

## What these agents read for context
Per the ws-* role definitions, a cold agent reads, before working:
`AGENTS.md`, `HANDOFF.md`, the active roadmap/plan, `ralph/STATE.md`, `ralph/CURRENT_TASK.md`,
and both skills (`.agents/skills/caveman/SKILL.md`, `.agents/skills/cavecrew/SKILL.md`).

Durable knowledge and archived plans they may also need live in
[`knowledge/`](./knowledge/) and [`archive/`](./archive/) here.
