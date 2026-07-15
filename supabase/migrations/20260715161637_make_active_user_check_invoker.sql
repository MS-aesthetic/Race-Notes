-- Profiles are publicly readable under existing RLS, so the Storage policy
-- helper needs no elevated privileges. Invoker mode keeps the helper out of
-- the exposed SECURITY DEFINER advisor class.
create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security invoker
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
