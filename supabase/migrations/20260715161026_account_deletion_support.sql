-- Account-deletion support for CREW CHIEF.
-- Keeps deletion server-only while ensuring Auth cascades and cached teammate
-- references do not retain a deleted user's identity.

alter table public.tire_inventory
  drop constraint if exists tire_inventory_user_id_fkey;

alter table public.tire_inventory
  add constraint tire_inventory_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create or replace function public.account_deletion_owned_storage_objects(target_user uuid)
returns table(bucket_id text, name text)
language sql
security definer
set search_path = ''
as $$
  select objects.bucket_id, objects.name
  from storage.objects as objects
  where objects.owner_id = target_user::text
     or objects.owner = target_user;
$$;

revoke all on function public.account_deletion_owned_storage_objects(uuid) from public;
revoke all on function public.account_deletion_owned_storage_objects(uuid) from anon;
revoke all on function public.account_deletion_owned_storage_objects(uuid) from authenticated;
grant execute on function public.account_deletion_owned_storage_objects(uuid) to service_role;

create or replace function public.cleanup_account_references_for_deletion(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sent notifications can contain the sender's name and free-text message.
  delete from public.notifications
  where from_user = target_user;

  -- Keep shared service history without retaining the deleted user's identity.
  update public.maintenance_logs
  set done_by = null,
      done_by_name = 'Deleted user',
      updated_at = now()
  where user_id <> target_user
    and done_by = target_user;

  -- Remove offline-cached assignee identity from teammates' checklist rows.
  update public.todos as todo
  set items = (
        select coalesce(
          jsonb_agg(
            case
              when item.value ->> 'assignedTo' = target_user::text
                then item.value - 'assignedTo' - 'assignedToName'
              else item.value
            end
            order by item.ordinality
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(coalesce(todo.items, '[]'::jsonb))
          with ordinality as item(value, ordinality)
      ),
      updated_at = now()
  where todo.user_id <> target_user
    and exists (
      select 1
      from jsonb_array_elements(coalesce(todo.items, '[]'::jsonb)) as item(value)
      where item.value ->> 'assignedTo' = target_user::text
    );

  -- Preserve completed checklist evidence, but anonymize who checked it off.
  update public.weekend_checklists as checklist
  set items = (
        select coalesce(
          jsonb_agg(
            case
              when item.value ->> 'doneBy' = target_user::text
                then (item.value - 'doneBy' - 'doneByName')
                  || jsonb_build_object('doneByName', 'Deleted user')
              else item.value
            end
            order by item.ordinality
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(coalesce(checklist.items, '[]'::jsonb))
          with ordinality as item(value, ordinality)
      ),
      updated_at = now()
  where checklist.user_id <> target_user
    and exists (
      select 1
      from jsonb_array_elements(coalesce(checklist.items, '[]'::jsonb)) as item(value)
      where item.value ->> 'doneBy' = target_user::text
    );
end;
$$;

revoke all on function public.cleanup_account_references_for_deletion(uuid) from public;
revoke all on function public.cleanup_account_references_for_deletion(uuid) from anon;
revoke all on function public.cleanup_account_references_for_deletion(uuid) from authenticated;
grant execute on function public.cleanup_account_references_for_deletion(uuid) to service_role;
