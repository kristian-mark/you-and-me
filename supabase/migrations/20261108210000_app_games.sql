-- Turn-based games for a couple. One current match per pair and game type.
-- Tic-tac-toe is game_type = 'ttt'. Rules live in the server, not in this table:
-- state is JSON, and turn / status / winner / version are enforced on write.
--
-- Access is server-only. SUPABASE_SECRET_KEY bypasses RLS. anon and authenticated
-- get no privileges, matching 20261108180000_lock_anon.sql (that file does not
-- see tables created after it, so this migration locks itself).
-- Safe to run once. CREATE is IF NOT EXISTS; privilege and RLS statements are
-- idempotent. Does not delete rows.

create table if not exists public.app_games (
  pair_id text not null,
  game_type text not null,
  state jsonb not null default '{}'::jsonb,
  turn_user_id text,
  status text not null default 'idle',
  winner text,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pair_id, game_type),
  constraint app_games_type_check check (game_type ~ '^[a-z][a-z0-9_-]{0,31}$'),
  constraint app_games_status_check check (status in ('idle', 'active', 'finished')),
  constraint app_games_version_check check (version >= 0),
  constraint app_games_state_object check (jsonb_typeof(state) = 'object'),
  constraint app_games_phase_check check (
    (status = 'idle' and turn_user_id is null and winner is null)
    or (status = 'active' and turn_user_id is not null and winner is null)
    or (status = 'finished' and turn_user_id is null and winner is not null)
  )
);

alter table public.app_games enable row level security;
alter table public.app_games force row level security;

revoke all privileges on table public.app_games from anon, authenticated, public;
grant select, insert, update, delete on table public.app_games to service_role;

comment on table public.app_games is
  'Current turn-based match for a couple. Read and write only through server functions with the secret key.';
