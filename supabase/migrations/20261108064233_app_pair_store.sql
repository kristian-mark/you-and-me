-- Already applied on the live project at 2026-11-08 06:42 UTC (name: app_pair_store).
--
-- The original statement text is not exposed to the anon key (the
-- supabase_migrations schema is not in the API). This file is the idempotent
-- baseline that matches the tables and columns observed read-only on that
-- database. It does not update or delete existing rows. Supabase will skip it
-- on the project where this version is already recorded.

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

create index if not exists app_pairs_a_user_id_idx on app_pairs (a_user_id);
create index if not exists app_pairs_b_user_id_idx on app_pairs (b_user_id);
create index if not exists app_tasks_pair_id_idx on app_tasks (pair_id);
create index if not exists app_wishes_pair_id_idx on app_wishes (pair_id);

grant select, insert, update, delete on app_profiles, app_pairs, app_tasks, app_wishes to anon, authenticated;
