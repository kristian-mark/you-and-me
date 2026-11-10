-- Applied on production on 2026-11-10 (Supabase history version 20261110210813).
-- The version matches that history row so a later `supabase db push` does not
-- record a second copy. The statements are idempotent. Does not drop tables.
--
-- The app deploy runner does not read this directory. It applies
-- migrations/0005_secure_auth_tables_rls.sql and records that filename in
-- public._migrations.

do $$
declare t text;
begin
  foreach t in array array['user','session','account','verification','ttt_games','_migrations',
                           'app_profiles','app_pairs','app_tasks','app_wishes','app_games','app_quiz',
                           'couples','couple_members','items']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all privileges on table public.%I from anon, authenticated, public', t);
    end if;
  end loop;
end $$;
drop policy if exists app_profiles_anon_server on public.app_profiles;
drop policy if exists app_pairs_anon_server on public.app_pairs;
drop policy if exists app_tasks_anon_server on public.app_tasks;
drop policy if exists app_wishes_anon_server on public.app_wishes;
drop policy if exists app_profiles_all on public.app_profiles;
drop policy if exists app_pairs_all on public.app_pairs;
drop policy if exists app_tasks_all on public.app_tasks;
drop policy if exists app_wishes_all on public.app_wishes;
drop policy if exists "Allow all" on public.couple_members;
drop policy if exists "Allow all for now" on public.couples;
drop policy if exists "Allow all for now" on public.items;
drop policy if exists wishes_anon_api on storage.objects;
drop policy if exists wishes_select on storage.objects;
drop policy if exists wishes_insert on storage.objects;
drop policy if exists wishes_update on storage.objects;
drop policy if exists wishes_delete on storage.objects;
revoke all privileges on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter function public.app_lock_pair_id() set search_path = public, pg_temp;
alter function public.app_one_pair_membership() set search_path = public, pg_temp;
