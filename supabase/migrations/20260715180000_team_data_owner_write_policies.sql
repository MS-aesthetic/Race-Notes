-- Canonical team-owner writes: teammates may create, update, or delete
-- shared persistent rows while user_id remains the active team owner's id.
-- Apply only with the UXN-1 Edge Function/client rollout; not live from code.

create or replace function public.can_manage_team_owned_data(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.in_same_team((auth.uid())::uuid, target_user);
$$;

revoke all on function public.can_manage_team_owned_data(uuid) from public;
grant execute on function public.can_manage_team_owned_data(uuid) to authenticated;

do $$
declare
  target_table text;
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
    execute format('drop policy if exists "Team can insert canonical owner rows" on public.%I', target_table);
    execute format(
      'create policy "Team can insert canonical owner rows" on public.%I for insert with check (public.can_manage_team_owned_data(user_id))',
      target_table
    );
    execute format('drop policy if exists "Team can delete canonical owner rows" on public.%I', target_table);
    execute format(
      'create policy "Team can delete canonical owner rows" on public.%I for delete using (public.can_manage_team_owned_data(user_id))',
      target_table
    );
  end loop;
end;
$$;
