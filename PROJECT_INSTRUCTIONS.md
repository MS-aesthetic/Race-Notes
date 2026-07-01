# CREW CHIEF — Project Instructions

> **⚠️ This file is a legacy entry point.** For the authoritative, up-to-date agent guide, see:
> - **[`AGENTS.md`](./AGENTS.md)** — architecture, conventions, branch/deploy workflow, definition of done
> - **[`plan.md`](./plan.md)** — active feature roadmap (13 workstreams, execution order)
> - **[`CODEBASE_KNOWLEDGE.md`](./CODEBASE_KNOWLEDGE.md)** — full technical reference (types, tables, localStorage keys, component details, gotchas)

### Quick start (for new agents)

1. Read [`plan.md`](./plan.md) first — understand what workstreams are active
2. Read [`AGENTS.md`](./AGENTS.md) for conventions, branch rules, and architecture
3. Reference [`CODEBASE_KNOWLEDGE.md`](./CODEBASE_KNOWLEDGE.md) for types, sync patterns, and gotchas

**One-line summary:** React 19 + TS + Vite 6 PWA, Capacitor 8 Android wrapper, Supabase backend. Dirt-track racing logbook for crews. Local-first dual-write, tab-based navigation (no router). All feature work on `preview` branch, deploy previews to Netlify.
