---
name: crewchief-supabase
description: Inspect or change the Crew Chief Supabase backend (project swblfeayxoprodhwxqak) - migrations, RLS policies, tables, advisors, edge functions. Use before writing a migration, when sync or team sharing misbehaves, or when asked about the database.
---

# Crew Chief Supabase

Live project `swblfeayxoprodhwxqak` (us-west-2, Postgres 17). Tools: `mcp__Supabase__*` via ToolSearch.

## Read first (safe)
- `list_migrations` vs `ls supabase/migrations`. Files `001`–`008` predate tracked history.
- **Known gap:** `20260715180000_team_data_owner_write_policies.sql` is in the repo but not applied live (verified 2026-10-02). Do not assume its `Canonical team-owner *` policies exist.
- `get_advisors` security + performance. Known WARNs as of 2026-10-02: six SECURITY DEFINER helpers callable by anon/authenticated with mutable search_path, `pg_trgm` in public, leaked-password protection off.
- `list_tables` before any schema change. RLS drives team sharing through `in_same_team(user_a, user_b)`.

## Changing the schema
1. Write the migration in the repo first: `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_name>.sql`. Idempotent (`if not exists`, `drop policy if exists`).
2. Every new table gets RLS enabled plus select/insert/update/delete policies matching neighbours.
3. **Applying to live (`apply_migration`) changes production data for every user.** Do it only when the owner explicitly asks in the current request. Otherwise commit the file and say it is unapplied.
4. After applying: re-run `list_migrations` and `get_advisors security`; verify with a read-only `execute_sql` that the policies/functions exist.
5. Update the client mapper and types (`crewchief-data-change`).
6. Record the change in `context/knowledge/CURRENT_STATE.md` §5.

## Never
- Destructive SQL (`drop table`, `delete`, `truncate`) without explicit owner instruction naming it.
- Reading server files or running OS commands via SQL.
- Committing service-role keys. Only the anon/publishable key belongs in `.env.local`.
