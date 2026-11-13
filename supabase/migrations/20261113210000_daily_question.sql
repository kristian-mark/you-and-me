-- Mirror of migrations/0009_daily_question.sql for a later Supabase push.
-- The deploy migrator applies migrations/0009_daily_question.sql. This file
-- does not update or delete existing user rows.

create table if not exists public.app_daily_open (
  pair_id text primary key,
  day_key text not null,
  question_id text not null,
  skipped_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_daily_open_day check (day_key ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint app_daily_open_question check (char_length(question_id) between 1 and 16),
  constraint app_daily_open_skipped check (jsonb_typeof(skipped_ids) = 'array')
);

create table if not exists public.app_daily_answers (
  pair_id text not null,
  day_key text not null,
  user_id text not null,
  question_id text not null,
  body text not null,
  answered_at timestamptz not null,
  primary key (pair_id, day_key, user_id),
  constraint app_daily_answers_day check (day_key ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint app_daily_answers_question check (char_length(question_id) between 1 and 16),
  constraint app_daily_answers_body check (char_length(body) between 1 and 4000)
);

create index if not exists app_daily_answers_pair_idx
  on public.app_daily_answers (pair_id, day_key);

alter table public.app_daily_open enable row level security;
alter table public.app_daily_open force row level security;
alter table public.app_daily_answers enable row level security;
alter table public.app_daily_answers force row level security;

revoke all privileges on table public.app_daily_open from anon, authenticated, public;
revoke all privileges on table public.app_daily_answers from anon, authenticated, public;
grant select, insert, update, delete on table public.app_daily_open to service_role;
grant select, insert, update, delete on table public.app_daily_answers to service_role;

comment on table public.app_daily_open is
  'The couple''s current daily question. Read and write only through server functions.';
comment on table public.app_daily_answers is
  'One daily answer per person. Partner text is returned only after both have answered.';
