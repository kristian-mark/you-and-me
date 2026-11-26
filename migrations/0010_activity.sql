-- Read cursors for partner activity outside of chat.
-- Chat keeps app_chat_reads. target_id '_' is the whole section;
-- any other id is one item seen through read_at.
-- Album edits record who touched the album last.
-- Safe to run more than once. Does not drop tables or delete rows.

alter table public.app_albums add column if not exists updated_by text;

create table if not exists public.app_activity_reads (
  pair_id text not null,
  user_id text not null,
  section text not null,
  target_id text not null,
  read_at timestamptz not null,
  primary key (pair_id, user_id, section, target_id),
  constraint app_activity_reads_section_check check (
    section in ('tasks', 'calendar', 'wishes', 'album', 'question', 'test')
  ),
  constraint app_activity_reads_target_check check (char_length(target_id) between 1 and 80)
);

create index if not exists app_activity_reads_pair_idx
  on public.app_activity_reads (pair_id, user_id);

do $$
begin
  execute 'alter table public.app_activity_reads enable row level security';
  execute 'alter table public.app_activity_reads force row level security';
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all privileges on table public.app_activity_reads from anon, authenticated, public';
  else
    execute 'revoke all privileges on table public.app_activity_reads from public';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on table public.app_activity_reads to service_role';
  end if;
end $$;

comment on table public.app_activity_reads is
  'Per-person cursors for partner activity. Read and write only through server functions.';

notify pgrst, 'reload schema';
