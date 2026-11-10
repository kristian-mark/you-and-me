-- One row per new session. The app reads and writes it only through the
-- postgres role. anon and authenticated get nothing. Safe to run more than
-- once. Does not drop tables or delete rows.

create table if not exists public.login_events (
  id text primary key,
  user_id text not null,
  session_id text not null,
  created_at timestamptz not null default now(),
  ip text,
  user_agent text,
  device_label text not null,
  city text,
  country text,
  seen_by text[] not null default '{}'
);

create index if not exists login_events_user_created_idx
  on public.login_events (user_id, created_at desc);

do $$
begin
  if to_regclass('public.login_events') is null then
    return;
  end if;
  execute 'alter table public.login_events enable row level security';
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all privileges on table public.login_events from anon, authenticated, public';
  else
    execute 'revoke all privileges on table public.login_events from public';
  end if;
end $$;
