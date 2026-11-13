-- Shared couple album. Photos live in the private Storage bucket "album".
-- The app reads and writes only through server functions with the secret key.
-- anon and authenticated get no table privileges and no storage policies.
-- Safe to run more than once. Does not drop tables or delete rows.
--
-- PGLite (no Supabase storage schema) still creates the tables. The bucket
-- insert runs only when storage.buckets exists.

create table if not exists public.app_album_photos (
  id text primary key,
  pair_id text not null,
  author_user_id text not null,
  taken_at timestamptz not null,
  created_at timestamptz not null default now(),
  byte_size integer not null,
  width integer not null default 0,
  height integer not null default 0,
  mime text not null,
  object_path text not null,
  thumb_path text not null,
  deleted_at timestamptz,
  purge_at timestamptz,
  constraint app_album_photos_size_check check (byte_size >= 0 and byte_size <= 8000000),
  constraint app_album_photos_mime_check check (mime in ('image/webp', 'image/jpeg')),
  constraint app_album_photos_path_check check (
    object_path !~ '\.\.'
    and thumb_path !~ '\.\.'
    and left(object_path, 1) <> '/'
    and left(thumb_path, 1) <> '/'
    and object_path <> thumb_path
  )
);

create index if not exists app_album_photos_pair_live_idx
  on public.app_album_photos (pair_id, taken_at desc);

create index if not exists app_album_photos_purge_idx
  on public.app_album_photos (purge_at)
  where deleted_at is not null;

create table if not exists public.app_albums (
  id text primary key,
  pair_id text not null,
  title text not null,
  cover_photo_id text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_albums_title_check check (char_length(title) between 1 and 80)
);

create index if not exists app_albums_pair_idx
  on public.app_albums (pair_id, updated_at desc);

create table if not exists public.app_album_items (
  album_id text not null references public.app_albums (id) on delete cascade,
  photo_id text not null references public.app_album_photos (id) on delete cascade,
  pair_id text not null,
  added_at timestamptz not null default now(),
  primary key (album_id, photo_id)
);

create index if not exists app_album_items_pair_idx
  on public.app_album_items (pair_id, photo_id);

create table if not exists public.app_album_likes (
  photo_id text not null references public.app_album_photos (id) on delete cascade,
  user_id text not null,
  pair_id text not null,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

create index if not exists app_album_likes_pair_idx
  on public.app_album_likes (pair_id, photo_id);

do $$
declare t text;
begin
  foreach t in array array[
    'app_album_photos',
    'app_albums',
    'app_album_items',
    'app_album_likes'
  ]
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
  values ('album', 'album', false, 5242880, array['image/webp', 'image/jpeg']::text[])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end $$;

notify pgrst, 'reload schema';
