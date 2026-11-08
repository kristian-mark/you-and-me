-- Compatibility quiz for a couple. One row per person in the pair.
-- Answers stay on the row, but the server returns the partner's answers only
-- after both done_at values are set. Access is server-only: the secret key
-- bypasses RLS, and anon/authenticated get nothing.
-- Safe to run once. Does not delete rows.

create table if not exists public.app_quiz (
  pair_id text not null,
  user_id text not null,
  answers jsonb not null default '[]'::jsonb,
  done_at timestamptz,
  reminded_at timestamptz,
  primary key (pair_id, user_id),
  constraint app_quiz_answers_array check (jsonb_typeof(answers) = 'array')
);

alter table public.app_quiz enable row level security;
alter table public.app_quiz force row level security;

revoke all privileges on table public.app_quiz from anon, authenticated, public;
grant select, insert, update, delete on table public.app_quiz to service_role;

comment on table public.app_quiz is
  'Couple compatibility answers. Read and write only through server functions with the secret key.';
