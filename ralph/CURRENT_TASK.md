# Current Task — UXF-8 Docs and Loop-State Hygiene

**Status:** CODE_PASS — implementation attempt 1; awaiting independent SOL QA
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
