# CLAUDE.md

Project rules live in [AGENTS.md](./AGENTS.md). Read it first; it is the workflow authority.

@AGENTS.md

## Claude Code quick map
- Verified current facts (branches, baseline, env, Supabase gaps): `context/knowledge/CURRENT_STATE.md`.
- Project skills in `.claude/skills/`: `crewchief-verify`, `crewchief-preview-deploy`,
  `crewchief-data-change`, `crewchief-supabase`, `crewchief-directions`.
- Two product directions: `master` (release 5.2.1) and `feature/ui-simplification`. Never merge across them unasked.
- Cloud sessions: Linux, no Android/Gradle, no Windows paths. `.env.local` comes from the Supabase connector (see `crewchief-verify`).
