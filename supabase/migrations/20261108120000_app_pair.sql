-- Pair data for the couples app. Apply in the Supabase SQL editor.
-- Do not run this against Neon: storage and the anon role live in Supabase.
--
-- The app server currently calls PostgREST with the anon key, so anon must
-- keep table and storage API access or the app stops saving. RLS is on so the
-- tables are not left unprotected by default, and the policies below are the
-- widest grant that still lets this server work.
--
-- What this migration does restrict without a service_role key:
--   * wish photos are not world-readable (bucket wishes is private);
--   * a task or wish cannot be moved to another pair_id after insert;
--   * a person cannot be inserted into two pairs at once.
--
-- To actually stop the anon key from reading every row, put a service_role
-- key on the server (it bypasses RLS) and replace the anon_server policies
-- with policies that use auth.uid(). That key is not in this repo.

create table if not exists app_profiles (
  user_id text primary key,
  email text,
  display_name text,
  invite_code text not null unique,
  birthday text,
  pair_id text,
  created_at timestamptz not null default now()
);

create table if not exists app_pairs (
  id text primary key,
  a_user_id text not null,
  b_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists app_tasks (
  id text primary key,
  pair_id text not null,
  owner_user_id text,
  title text not null,
  done boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists app_wishes (
  id text primary key,
  pair_id text not null,
  owner_user_id text,
  title text not null,
  fulfilled boolean not null default false,
  photo_path text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_wishes add column if not exists photo_path text;
alter table app_tasks add column if not exists payload jsonb not null default '{}'::jsonb;
alter table app_wishes add column if not exists payload jsonb not null default '{}'::jsonb;

create index if not exists app_pairs_a_user_id_idx on app_pairs (a_user_id);
create index if not exists app_pairs_b_user_id_idx on app_pairs (b_user_id);
create index if not exists app_tasks_pair_id_idx on app_tasks (pair_id);
create index if not exists app_wishes_pair_id_idx on app_wishes (pair_id);

create or replace function app_lock_pair_id()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.pair_id is distinct from old.pair_id then
    raise exception 'pair_id cannot change';
  end if;
  return new;
end;
$$;

drop trigger if exists app_tasks_lock_pair on app_tasks;
create trigger app_tasks_lock_pair
  before update on app_tasks
  for each row execute function app_lock_pair_id();

drop trigger if exists app_wishes_lock_pair on app_wishes;
create trigger app_wishes_lock_pair
  before update on app_wishes
  for each row execute function app_lock_pair_id();

create or replace function app_one_pair_membership()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from app_pairs
    where id <> new.id
      and (
        a_user_id in (new.a_user_id, new.b_user_id)
        or b_user_id in (new.a_user_id, new.b_user_id)
      )
  ) then
    raise exception 'user already in a pair';
  end if;
  return new;
end;
$$;

drop trigger if exists app_pairs_one_membership on app_pairs;
create trigger app_pairs_one_membership
  before insert or update on app_pairs
  for each row execute function app_one_pair_membership();

alter table app_profiles enable row level security;
alter table app_pairs enable row level security;
alter table app_tasks enable row level security;
alter table app_wishes enable row level security;

grant select, insert, update, delete on app_profiles, app_pairs, app_tasks, app_wishes to anon, authenticated;

drop policy if exists app_profiles_anon_server on app_profiles;
create policy app_profiles_anon_server on app_profiles
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists app_pairs_anon_server on app_pairs;
create policy app_pairs_anon_server on app_pairs
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists app_tasks_anon_server on app_tasks;
create policy app_tasks_anon_server on app_tasks
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists app_wishes_anon_server on app_wishes;
create policy app_wishes_anon_server on app_wishes
  for all to anon, authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('wishes', 'wishes', false)
on conflict (id) do update set public = false;

drop policy if exists wishes_anon_api on storage.objects;
create policy wishes_anon_api on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'wishes')
  with check (bucket_id = 'wishes');
