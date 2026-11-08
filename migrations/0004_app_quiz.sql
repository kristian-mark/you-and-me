-- Compatibility quiz. Skip when this database is auth-only and has no couple tables.
-- Safe to run more than once.

do $$
begin
  if to_regclass('public.app_profiles') is null then
    return;
  end if;
  execute $sql$
    create table if not exists public.app_quiz (
      pair_id text not null,
      user_id text not null,
      answers jsonb not null default '[]'::jsonb,
      done_at timestamptz,
      reminded_at timestamptz,
      primary key (pair_id, user_id),
      constraint app_quiz_answers_array check (jsonb_typeof(answers) = 'array')
    )
  $sql$;
  execute 'alter table public.app_quiz enable row level security';
  execute 'alter table public.app_quiz force row level security';
  execute 'revoke all privileges on table public.app_quiz from anon, authenticated, public';
  execute 'grant select, insert, update, delete on table public.app_quiz to service_role';
end $$;
