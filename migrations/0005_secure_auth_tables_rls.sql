-- Lock Better Auth and app tables against the anon and authenticated API roles.
--
-- Already applied on production as Supabase migration
-- 20261110210813_secure_auth_tables_rls. This copy is for the app runner
-- (scripts/migrate.mjs on deploy, PGLite on preview), which records the
-- filename in public._migrations and does not run a file twice.
--
-- Idempotent. Missing tables, roles, policies, and functions are skipped, so
-- a preview database that has only the auth tables still applies cleanly, and
-- running the statements again on production does not error. Does not drop
-- tables or delete rows.

do $$
declare
  t text;
  has_api_roles boolean;
begin
  has_api_roles :=
    exists (select 1 from pg_roles where rolname = 'anon')
    and exists (select 1 from pg_roles where rolname = 'authenticated');
  foreach t in array array['user','session','account','verification','ttt_games','_migrations',
                           'app_profiles','app_pairs','app_tasks','app_wishes','app_games','app_quiz',
                           'couples','couple_members','items']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      if has_api_roles then
        execute format('revoke all privileges on table public.%I from anon, authenticated, public', t);
      else
        execute format('revoke all privileges on table public.%I from public', t);
      end if;
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.app_profiles') is not null then
    execute 'drop policy if exists app_profiles_anon_server on public.app_profiles';
    execute 'drop policy if exists app_profiles_all on public.app_profiles';
  end if;
  if to_regclass('public.app_pairs') is not null then
    execute 'drop policy if exists app_pairs_anon_server on public.app_pairs';
    execute 'drop policy if exists app_pairs_all on public.app_pairs';
  end if;
  if to_regclass('public.app_tasks') is not null then
    execute 'drop policy if exists app_tasks_anon_server on public.app_tasks';
    execute 'drop policy if exists app_tasks_all on public.app_tasks';
  end if;
  if to_regclass('public.app_wishes') is not null then
    execute 'drop policy if exists app_wishes_anon_server on public.app_wishes';
    execute 'drop policy if exists app_wishes_all on public.app_wishes';
  end if;
  if to_regclass('public.couple_members') is not null then
    execute 'drop policy if exists "Allow all" on public.couple_members';
  end if;
  if to_regclass('public.couples') is not null then
    execute 'drop policy if exists "Allow all for now" on public.couples';
  end if;
  if to_regclass('public.items') is not null then
    execute 'drop policy if exists "Allow all for now" on public.items';
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists wishes_anon_api on storage.objects';
    execute 'drop policy if exists wishes_select on storage.objects';
    execute 'drop policy if exists wishes_insert on storage.objects';
    execute 'drop policy if exists wishes_update on storage.objects';
    execute 'drop policy if exists wishes_delete on storage.objects';
  end if;

  if to_regprocedure('public.app_lock_pair_id()') is not null then
    execute 'alter function public.app_lock_pair_id() set search_path = public, pg_temp';
  end if;
  if to_regprocedure('public.app_one_pair_membership()') is not null then
    execute 'alter function public.app_one_pair_membership() set search_path = public, pg_temp';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all privileges on all sequences in schema public from anon, authenticated';
    if current_user = 'postgres' or pg_has_role(current_user, 'postgres', 'member') then
      execute 'alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated';
      execute 'alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated';
    end if;
  end if;
end $$;
