-- Canonical team-owner writes for the exact shared client-sync tables.
-- This source migration is intentionally unapplied until the UXN-1 rollout.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.can_write_canonical_team_owner(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and case
      -- An account with no team owns only its own rows.
      when not exists (
        select 1
        from public.team_members as caller
        where caller.user_id = (select auth.uid())::uuid
      ) then target_user = (select auth.uid())::uuid
      -- A team account may target only its one unambiguous current owner.
      else (
        select count(distinct caller.team_id) = 1
          and count(distinct owner.user_id) = 1
          and min(owner.user_id::text)::uuid = target_user
        from public.team_members as caller
        join public.team_members as owner
          on owner.team_id = caller.team_id
         and owner.role = 'owner'
        where caller.user_id = (select auth.uid())::uuid
      )
    end;
$$;

revoke all on function private.can_write_canonical_team_owner(uuid) from public, anon;
grant execute on function private.can_write_canonical_team_owner(uuid) to authenticated;

do $$
declare
  target_table text;
  old_policy record;
begin
  foreach target_table in array array[
    'setups',
    'race_weekends',
    'todos',
    'cars',
    'shock_sessions',
    'maintenance_components',
    'maintenance_logs',
    'checklist_templates',
    'weekend_checklists'
  ] loop
    -- Canonicalize legacy member-owned rows only when succession is unique.
    execute format($normalize$
      with owner_targets as (
        select member.user_id as source_user,
               min(owner.user_id::text)::uuid as target_user
        from public.team_members as member
        join public.team_members as owner
          on owner.team_id = member.team_id
         and owner.role = 'owner'
        group by member.user_id
        having count(distinct member.team_id) = 1
           and count(distinct owner.user_id) = 1
      )
      update public.%I as shared_row
         set user_id = owner_targets.target_user
        from owner_targets
       where shared_row.user_id = owner_targets.source_user
         and shared_row.user_id <> owner_targets.target_user
    $normalize$, target_table);

    execute format('alter table public.%I enable row level security', target_table);

    -- FOR ALL also grants writes, so remove every non-SELECT policy. Explicit
    -- SELECT policies (including external-share reads) remain untouched.
    for old_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and cmd <> 'SELECT'
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        old_policy.policyname,
        target_table
      );
    end loop;

    execute format(
      'drop policy if exists "Canonical team rows are readable" on public.%I',
      target_table
    );
    execute format(
      'create policy "Canonical team rows are readable" on public.%I for select to authenticated using (public.in_same_team((select auth.uid())::uuid, user_id))',
      target_table
    );
    execute format(
      'create policy "Canonical team-owner insert" on public.%I for insert to authenticated with check (private.can_write_canonical_team_owner(user_id))',
      target_table
    );
    execute format(
      'create policy "Canonical team-owner update" on public.%I for update to authenticated using (private.can_write_canonical_team_owner(user_id)) with check (private.can_write_canonical_team_owner(user_id))',
      target_table
    );
    execute format(
      'create policy "Canonical team-owner delete" on public.%I for delete to authenticated using (private.can_write_canonical_team_owner(user_id))',
      target_table
    );
  end loop;
end;
$$;

-- The superseded public helper can be removed after dependent write policies.
drop function if exists public.can_manage_team_owned_data(uuid);
