-- Legacy local/Neon table from an earlier preview. The couple match now lives in
-- Supabase public.app_games. This file stays so databases that already applied it
-- keep a stable migration history.
create table if not exists ttt_games (
  code text primary key,
  board text not null default '---------',
  turn text not null,
  starter text not null,
  phase text not null default 'play',
  winner text,
  games integer not null default 0,
  wins_a integer not null default 0,
  wins_b integer not null default 0,
  points_a integer not null default 0,
  points_b integer not null default 0,
  last_cell integer,
  seen_a bigint not null default 0,
  seen_b bigint not null default 0,
  revision integer not null default 1
);
