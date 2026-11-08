-- Additive migration. Safe to run once on the live project, which already has
-- 20261108064233_app_pair_store and 20261108064235_wish_storage_policies.
--
-- It does not drop tables, rewrite columns, or delete rows. CREATE/ALTER use
-- IF NOT EXISTS, policies are created only when that name is absent, and the
-- wishes bucket is set private without removing objects (the bucket was empty
-- at inspection). Running this file again is a no-op.
-- No explicit transaction here: the Supabase migration runner already wraps
-- each file in one, and a COMMIT inside the file would close that wrapper.

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

grant select, insert, update, delete on app_profiles, app_pairs, app_tasks, app_wishes to anon, authenticated;

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
    select 1 from app_pairs p
    where p.id <> new.id
      and (
        p.a_user_id = new.a_user_id
        or p.b_user_id = new.a_user_id
        or (
          new.b_user_id is not null
          and (p.a_user_id = new.b_user_id or p.b_user_id = new.b_user_id)
        )
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

-- The server still uses the anon key, so these policies stay permissive.
-- They are added only when missing and are OR-ed with any policy already
-- installed by the earlier migrations, which keeps current reads and writes
-- working. Replacing them with auth.uid() checks needs a service_role key.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['app_profiles', 'app_pairs', 'app_tasks', 'app_wishes']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = tbl || '_anon_server'
    ) then
      execute format(
        'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
        tbl || '_anon_server',
        tbl
      );
    end if;
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('wishes', 'wishes', false)
on conflict (id) do update set public = false;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'wishes_anon_api'
  ) then
    create policy wishes_anon_api on storage.objects
      for all to anon, authenticated
      using (bucket_id = 'wishes')
      with check (bucket_id = 'wishes');
  end if;
end $$;
