# CREW CHIEF — Project Instructions

> Entry point. Authoritative current guides:
> - **[`AGENTS.md`](./AGENTS.md)** — architecture, conventions, branch/deploy workflow, definition of done
> - **[`HANDOFF.md`](./HANDOFF.md)** — branch/worktree status and operating context
> - **[`plan-v2.md`](./plan-v2.md)** — active roadmap and agent loop
> - **[`ralph/STATE.md`](./ralph/STATE.md)** — current workstream state
> - **[`CODEBASE_KNOWLEDGE.md`](./CODEBASE_KNOWLEDGE.md)** — full technical reference (types, tables, localStorage keys, component details, gotchas)

### Quick start (for new agents)

1. Open `C:\Users\maxx\antigravity\Race-Notes\.worktrees\v2` on `preview-v2`.
2. Read [`HANDOFF.md`](./HANDOFF.md), [`plan-v2.md`](./plan-v2.md), and [`ralph/STATE.md`](./ralph/STATE.md).
3. Read [`AGENTS.md`](./AGENTS.md), including mandatory cavecrew/caveman and SOL/Terra routing.
4. Reference [`CODEBASE_KNOWLEDGE.md`](./CODEBASE_KNOWLEDGE.md) for older technical detail; newer v2 sources win conflicts.

**One-line summary:** React 19 + TS + Vite 6 PWA, Capacitor 8 Android wrapper, Supabase backend. Local-first dual-write, no router. All feature work on `preview-v2`; preview deploys only unless Maxx explicitly authorizes production.
