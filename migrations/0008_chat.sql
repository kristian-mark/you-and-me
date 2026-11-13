-- Private 1:1 chat for a pair. Messages, photos, and voice live here.
-- The app reads and writes only through server functions with the secret key.
-- anon and authenticated get no table privileges and no storage policies.
-- Safe to run more than once. Does not drop tables or delete rows.
--
-- PGLite (no Supabase storage schema) still creates the tables. The bucket
-- insert runs only when storage.buckets exists.

create table if not exists public.app_chat_messages (
  id text primary key,
  pair_id text not null,
  author_user_id text not null,
  kind text not null,
  body text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  card_kind text,
  card_id text,
  card_title text,
  card_subtitle text,
  object_path text,
  thumb_path text,
  mime text,
  byte_size integer,
  width integer,
  height integer,
  duration_ms integer,
  constraint app_chat_messages_kind_check check (kind in ('text', 'image', 'voice', 'card')),
  constraint app_chat_messages_card_kind_check check (
    card_kind is null
    or card_kind in ('wish', 'task', 'event', 'list', 'album', 'photo', 'note', 'loyalty')
  ),
  constraint app_chat_messages_body_check check (body is null or char_length(body) <= 4000),
  constraint app_chat_messages_title_check check (
    card_title is null or char_length(card_title) <= 160
  ),
  constraint app_chat_messages_subtitle_check check (
    card_subtitle is null or char_length(card_subtitle) <= 200
  ),
  constraint app_chat_messages_size_check check (
    byte_size is null or (byte_size >= 0 and byte_size <= 4000000)
  ),
  constraint app_chat_messages_mime_check check (
    mime is null
    or mime in ('image/webp', 'image/jpeg', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm')
  ),
  constraint app_chat_messages_text_check check (
    kind <> 'text'
    or deleted_at is not null
    or (body is not null and char_length(body) > 0)
  ),
  constraint app_chat_messages_card_check check (
    kind <> 'card'
    or (card_kind is not null and card_id is not null and card_title is not null)
  ),
  constraint app_chat_messages_image_check check (
    kind <> 'image'
    or deleted_at is not null
    or (object_path is not null and thumb_path is not null)
  ),
  constraint app_chat_messages_voice_check check (
    kind <> 'voice' or deleted_at is not null or object_path is not null
  ),
  constraint app_chat_messages_path_check check (
    (object_path is null or (object_path !~ '\.\.' and left(object_path, 1) <> '/'))
    and (thumb_path is null or (thumb_path !~ '\.\.' and left(thumb_path, 1) <> '/'))
    and (object_path is null or thumb_path is null or object_path <> thumb_path)
  )
);

create index if not exists app_chat_messages_pair_created_idx
  on public.app_chat_messages (pair_id, created_at);

create index if not exists app_chat_messages_pair_deleted_idx
  on public.app_chat_messages (pair_id, deleted_at)
  where deleted_at is not null;

create table if not exists public.app_chat_reads (
  pair_id text not null,
  user_id text not null,
  read_at timestamptz not null,
  primary key (pair_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['app_chat_messages', 'app_chat_reads']
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

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'chat',
    'chat',
    false,
    5242880,
    array['image/webp', 'image/jpeg', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm']::text[]
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end $$;

notify pgrst, 'reload schema';
