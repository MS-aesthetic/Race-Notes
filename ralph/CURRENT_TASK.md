# Current Task — UXF-8 Docs and Loop-State Hygiene

**Status:** COMPLETE — SOL QA attempt 3 PASS
**Branch/worktree:** `preview-v3` · `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v3`
**Sprint authority:** `SPRINT_INDEX.md` → Sprint 1 `plan-v3-ux-corrections.md`
**Next workstream after independent PASS:** UXF-1

## Goal

Remove stale v2 onboarding and loop-state directions before application work starts. Preserve the newly added sprint plans, archive moves, and agent-routing edits already present in the dirty worktree.

## Scope

1. Update `PROJECT_INSTRUCTIONS.md` to open `.worktrees\v3` on `preview-v3` and use `SPRINT_INDEX.md` as roadmap entry point.
2. Repair current-authority references in `AGENTS.md` and `HANDOFF.md` so missing root plans/docs resolve through `SPRINT_INDEX.md` or `docs/archive/*`. Preserve historical v2 references when they describe historical work.
3. Update `CODEBASE_KNOWLEDGE.md` header to 2026-07-14 / Chunk 9 closure. Do not regenerate its body.
4. Update `ralph/STATE.md`:
   - point loop authority at `SPRINT_INDEX.md`;
   - reflect one Terra build pass, then SOL fixer/QA routing already applied to agent files;
   - record migration 014 and lifecycle/load migrations as applied;
   - remove stale migration-014 gate;
   - add UXF-1…9 table with UXF-8 in progress and other rows pending.
5. Keep archived plans and car-profile documents under `docs/archive/`. Do not restore them to live-doc locations.

## Out of scope

- No application source, harness, schema, package, native, deployment, branch push, or release work.
- No rewrite of historical session details.
- No UXF-1 bug fix until UXF-8 receives independent PASS.

## Acceptance

1. Cold-start instructions land on `preview-v3` and `SPRINT_INDEX.md`.
2. Current Markdown links to moved documents resolve.
3. `ralph/STATE.md` contains no active migration-014 instruction and contains UXF status table.
4. Agent routing documents agree: Terra gets one initial build pass; any QA failure moves to SOL fixer.
5. `git diff --check` passes. Documentation-only slice requires no lint/build.

## Implementation evidence

- `PROJECT_INSTRUCTIONS.md`, `AGENTS.md`, and `HANDOFF.md` route current work to `preview-v3` and `SPRINT_INDEX.md`.
- Current Markdown-link scan across authority/sprint files reports `ALL_CURRENT_LINKS_RESOLVE`.
- `ralph/STATE.md` records applied migration 014, current routing, and UXF-1…9 status.
- Archive moves and newly supplied sprint/agent files were preserved without application-source changes.
- `git diff --check` passes. No lint/build run because this slice changes documentation and agent configuration only.

## QA attempt 1 findings

1. **GitHub agent roles still route cold agents to retired v2 authority.**
   - `.github/agents/ws-planner.agent.md:3,18,23,28,40` still names `plan-v2.md` and its old WS execution order.
   - `.github/agents/ws-builder.agent.md:25,34,49` still reads/guards `plan-v2.md` and commits to `preview-v2`.
   - `.github/agents/ws-qa.agent.md:24,48` still uses and permits edits to `plan-v2.md`.
   - `.github/agents/ws-fixer.agent.md:3,23` still says “after third failed QA review” and reads `plan-v2.md`, despite its body using first-failure takeover.
   Replace active-roadmap references with `SPRINT_INDEX.md` plus its selected sprint plan, use `preview-v3`, and make first-failure SOL takeover consistent. Preserve historical archived-plan text outside active role definitions.
   **FIXED attempt 2:** all four active `.github/agents` roles now use `SPRINT_INDEX.md`, selected active sprint plan, `preview-v3`, and first-failure SOL takeover. Active-role grep for `plan-v2`, `preview-v2`, and third-failure language returns zero.
2. **Active plan has stale owner-handoff path.** `plan-v3-ux-corrections.md:4` points to removed `docs/CLAUDE_UX_REWORK_HANDOFF_2026-07-14.md`; update it to `docs/archive/CLAUDE_UX_REWORK_HANDOFF_2026-07-14.md`.
   **FIXED attempt 2:** source path now names `docs/archive/CLAUDE_UX_REWORK_HANDOFF_2026-07-14.md`.
3. **Cold-start conflict rule still favors v2.** `PROJECT_INSTRUCTIONS.md:15` says “newer v2 sources win conflicts.” Replace with active sprint plan and `ralph/CURRENT_TASK.md` authority.
   **FIXED attempt 2:** conflict rule now names active sprint plan and `ralph/CURRENT_TASK.md`.
4. **Live worktree status is stale.** `HANDOFF.md:176` says Chunks 1–6B complete and C7 unlocked. Update current row to Chunks 1–9 technically complete, UXF-8 in QA/repair, then UXF-1.
   **FIXED attempt 2:** live row now reports Chunks 1–9 technically complete, UXF-8 repair/QA active, UXF-1 next.

Passing evidence: commit contains no `src/`, `scripts/`, schema, package, or Android change; `git diff --check` passes; current Markdown links resolve; archive moves preserve historical files; migration 014 is recorded complete; UXF table exists; worktree was clean before QA notes. Cavecrew review totals: 4 critical, 3 major, 0 minor, 0 questions.

Attempt 2 evidence: repair diff touches only four `.github/agents` roles, `plan-v3-ux-corrections.md`, `PROJECT_INSTRUCTIONS.md`, `HANDOFF.md`, and durable task/state notes. Current-link scan passes; active-role stale-routing grep is zero; no application-source delta; `git diff --check` passes. Cavecrew final re-review: `No issues.` Documentation-only repair requires no lint/build.

## QA attempt 2 finding

1. **Native Codex fixer metadata still contradicts first-failure routing.** `.codex/agents/ws-fixer.toml:2` says SOL takes over “after three failed QA reviews,” while its body and every active GitHub role correctly use first-failure takeover. Change the description to first-failure takeover. Re-grep all active `.codex/agents/*.toml` and `.github/agents/*.agent.md` routing text, then return to independent SOL QA. No other finding remains.
   **FIXED attempt 3:** description now says SOL takes over after first failed QA review. Full active native/GitHub agent grep finds no `plan-v2`, `preview-v2`, third/three-failure routing, or delayed SOL takeover.

Passing evidence retained: the four `.github` roles, archived handoff path, PROJECT conflict authority, HANDOFF live row, archive preservation, current links, applied migration state, UXF table, no-source-change scope, diff check, and clean worktree all pass. Cavecrew QA attempt 2 review found only the native fixer metadata mismatch above.

Attempt 3 evidence: repair changes one metadata description plus durable task/state notes. Current Markdown links resolve; archive moves remain preserved; no application, harness, schema, package, or native delta exists; `git diff --check` passes. Cavecrew reviewer: `No issues. Routing consistent; scope clean.` Documentation-only repair requires no lint/build.

## QA attempt 3 verdict

**PASS — 96.** Native and GitHub agent roles now agree on one Terra build pass followed by first-failure SOL takeover. Cold-start authority, archived paths/content, current links, PROJECT conflict rule, HANDOFF status, migration state, UXF table, scope, diff check, and clean worktree all pass. Cavecrew independent verdict: `PASS. No issues.` UXF-8 closed; UXF-1 is next.
