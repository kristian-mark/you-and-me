-- Run this ONLY after the Vercel deployment can log in with SUPABASE_SECRET_KEY set.
-- The secret key bypasses RLS. Applying this first makes the anon key fail closed
-- and the current server, which still needs that access, will break.
--
-- Idempotent. Does not delete rows or objects.

revoke all privileges on table public.app_profiles from anon, authenticated, public;
revoke all privileges on table public.app_pairs from anon, authenticated, public;
revoke all privileges on table public.app_tasks from anon, authenticated, public;
revoke all privileges on table public.app_wishes from anon, authenticated, public;

drop policy if exists app_profiles_anon_server on public.app_profiles;
drop policy if exists app_pairs_anon_server on public.app_pairs;
drop policy if exists app_tasks_anon_server on public.app_tasks;
drop policy if exists app_wishes_anon_server on public.app_wishes;

alter table public.app_profiles enable row level security;
alter table public.app_pairs enable row level security;
alter table public.app_tasks enable row level security;
alter table public.app_wishes enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname in (
          'wishes_anon_api',
          'wishes_public_read',
          'wishes_anon_write',
          'wishes_anon_update',
          'wishes_anon_delete'
        )
        or policyname ilike '%wish%'
        or coalesce(qual, '') ilike '%wishes%'
        or coalesce(with_check, '') ilike '%wishes%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;
