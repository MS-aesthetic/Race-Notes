-- Prevent slow Auth-user cascades on tire inventory.
create index if not exists idx_tire_inventory_user_id
  on public.tire_inventory(user_id);

-- A signed access token can remain valid until its short expiry even after
-- account deletion. Storage write/list policies therefore also require the
-- user's profile row, which cascades immediately with auth.users.
create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
  );
$$;

revoke all on function public.is_active_app_user() from public;
revoke all on function public.is_active_app_user() from anon;
grant execute on function public.is_active_app_user() to authenticated;
grant execute on function public.is_active_app_user() to service_role;

drop policy if exists "Users can upload banners" on storage.objects;
create policy "Users can upload banners"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'team_banners'
    and public.is_active_app_user()
  );

drop policy if exists "Users can update own banners" on storage.objects;
create policy "Users can update own banners"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'team_banners'
    and public.is_active_app_user()
    and owner_id = (select auth.uid())::text
  )
  with check (
    bucket_id = 'team_banners'
    and public.is_active_app_user()
    and owner_id = (select auth.uid())::text
  );

drop policy if exists "Authenticated users can read attachments" on storage.objects;
create policy "Authenticated users can read attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'race-attachments'
    and public.is_active_app_user()
  );

drop policy if exists "Authenticated users can upload attachments" on storage.objects;
create policy "Authenticated users can upload attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'race-attachments'
    and public.is_active_app_user()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own attachments" on storage.objects;
create policy "Users can update own attachments"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'race-attachments'
    and public.is_active_app_user()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'race-attachments'
    and public.is_active_app_user()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own attachments" on storage.objects;
create policy "Users can delete own attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'race-attachments'
    and public.is_active_app_user()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
