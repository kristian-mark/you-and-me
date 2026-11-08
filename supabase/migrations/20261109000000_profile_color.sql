-- Per-person piece color. Null means "not chosen": the first member of the pair
-- is blue and the second is pink. The app still forces the two colors apart
-- when both stored values match.
-- Safe to run once. Adds a column and a check. Does not rewrite or delete rows.

alter table public.app_profiles add column if not exists color text;

alter table public.app_profiles drop constraint if exists app_profiles_color_check;

alter table public.app_profiles
  add constraint app_profiles_color_check
  check (color is null or color in ('blue', 'pink'));

comment on column public.app_profiles.color is
  'blue or pink chosen by this user. Null until they pick. Read and write only with the secret key.';
