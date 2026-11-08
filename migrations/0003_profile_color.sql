-- Piece color for the couple profile. This database is sometimes only the
-- Better Auth database and has no app_profiles table; skip in that case.
-- When app_profiles is here, add the column. Safe to run more than once.

do $$
begin
  if to_regclass('public.app_profiles') is null then
    return;
  end if;
  execute 'alter table public.app_profiles add column if not exists color text';
  execute 'alter table public.app_profiles drop constraint if exists app_profiles_color_check';
  execute 'alter table public.app_profiles add constraint app_profiles_color_check check (color is null or color in (''blue'', ''pink''))';
end $$;
