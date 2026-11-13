-- Shared daily question for a couple.
-- One open question per pair, keyed by a UTC day, plus one answer row per
-- person per day. The server returns the partner's text only after both
-- rows exist. This file does not update or delete existing user rows.
-- Safe to run more than once.
--
-- Access is server-only: the secret key bypasses RLS, and anon /
-- authenticated get nothing when those roles exist.

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

do $$
declare t text;
begin
  foreach t in array array['app_daily_open', 'app_daily_answers']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon')
       and exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all privileges on table public.%I from anon, authenticated, public', t);
    else
      execute format('revoke all privileges on table public.%I from public', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format(
        'grant select, insert, update, delete on table public.%I to service_role',
        t
      );
    end if;
  end loop;
end $$;

comment on table public.app_daily_open is
  'The couple''s current daily question. Read and write only through server functions.';
comment on table public.app_daily_answers is
  'One daily answer per person. Partner text is returned only after both have answered.';

notify pgrst, 'reload schema';
