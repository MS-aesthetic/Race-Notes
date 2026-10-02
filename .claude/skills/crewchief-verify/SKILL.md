---
name: crewchief-verify
description: Set up and verify a Crew Chief / Race Notes checkout - install deps, create .env.local from Supabase, run the 3-error lint baseline, real build, and the harness matrix with known failures. Use before committing, before a preview deploy, after a container restart, or when asked to "lint and build", "verify", "check baseline", or "get ready".
---

# Crew Chief verify

Definition-of-Done gate from `AGENTS.md`. Facts live in `context/knowledge/CURRENT_STATE.md`.

## 1. Environment (once per container)

```bash
[ -d node_modules ] || npm install
git checkout -- package-lock.json   # npm install re-stamps the version; never commit that drift
```

`npm run build` aborts without real Supabase env (guard: `scripts/viteRequireCloudConfig.ts`).
If `.env.local` is missing, create it from the Supabase connector:

1. `mcp__Supabase__get_publishable_keys` with project `swblfeayxoprodhwxqak`; take the legacy `anon` key.
2. Write:
   ```
   VITE_SUPABASE_URL=https://swblfeayxoprodhwxqak.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
3. Confirm `git check-ignore .env.local` prints the path. Never commit it.

`ALLOW_UNCONFIGURED_BUILD=1 npm run build` is for compile checks only. That bundle cannot sign in. Never deploy it.

## 2. Checks

```bash
npm run lint                       # must be exactly 3 errors
npm run build                      # must pass with real env
node scripts/run-harnesses.mjs     # exit 0 = no unexpected failures
```

Lint baseline, line numbers drift:
- `RaceWeekendView.tsx` TS2345 `unknown` -> `File`
- `SetupView.tsx` TS2322 `key` not in `CornerFormProps`
- `SmasherLoadsView.tsx` TS2345 `unknown` -> `File`

Any fourth error is yours. Fix it.

The harness runner knows which failures are expected per direction (simplified vs full-featured).
"PASS (was known-fail)" means update the lists in `scripts/run-harnesses.mjs` and `CURRENT_STATE.md`.
A harness you broke by removing UI on purpose: update or delete it in the same commit, and say so.

## 3. Report

Report lint count, build pass/fail, harness `x/24` and any unexpected names. Keep `git status` clean of `dist/`, `.env.local`, and lockfile drift.
