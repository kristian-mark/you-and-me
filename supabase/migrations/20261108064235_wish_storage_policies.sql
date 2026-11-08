-- Already applied on the live project at 2026-11-08 06:42 UTC
-- (name: wish_storage_policies).
--
-- Read-only checks after that version (anon key, no writes):
--   * POST /storage/v1/object/list/wishes returns 200, so bucket "wishes" exists
--     and anon may list it. The list was empty.
--   * GET /storage/v1/object/public/wishes/<missing> returns NoSuchKey, so the
--     public object route resolves this bucket (it was public at inspection).
--   * GET /storage/v1/bucket/wishes returns NoSuchBucket for anon. That is the
--     metadata endpoint, not proof the bucket is gone.
-- Policy names from the dashboard are not visible through the exposed API.
--
-- Re-running this file does not flip an existing bucket back to public and
-- does not delete objects.

insert into storage.buckets (id, name, public)
values ('wishes', 'wishes', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'wishes_public_read'
  ) then
    create policy wishes_public_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'wishes');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'wishes_anon_write'
  ) then
    create policy wishes_anon_write on storage.objects
      for insert to anon, authenticated
      with check (bucket_id = 'wishes');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'wishes_anon_update'
  ) then
    create policy wishes_anon_update on storage.objects
      for update to anon, authenticated
      using (bucket_id = 'wishes')
      with check (bucket_id = 'wishes');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'wishes_anon_delete'
  ) then
    create policy wishes_anon_delete on storage.objects
      for delete to anon, authenticated
      using (bucket_id = 'wishes');
  end if;
end $$;
