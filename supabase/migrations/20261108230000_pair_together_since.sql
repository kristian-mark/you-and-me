-- Couple-chosen "together since" date. Null means the app counts from app_pairs.created_at.
-- The table already has RLS and no anon privileges (see lock_anon). This only adds a column.
-- Safe to run once. Does not rewrite or delete rows.

alter table public.app_pairs add column if not exists together_since date;

comment on column public.app_pairs.together_since is
  'Optional YYYY-MM-DD the couple picked. Read and write only with the secret key.';
