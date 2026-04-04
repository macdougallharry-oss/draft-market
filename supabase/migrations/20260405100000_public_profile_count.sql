-- Public player count for marketing (landing page). RLS blocks anon SELECT on profiles.

create or replace function public.public_profile_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.profiles;
$$;

revoke all on function public.public_profile_count() from public;
grant execute on function public.public_profile_count() to anon, authenticated;
