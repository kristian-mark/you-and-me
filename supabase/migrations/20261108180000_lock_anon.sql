-- Superseded by 20261110210813_secure_auth_tables_rls.sql.
--
-- This file was never applied (it is not in supabase_migrations.schema_migrations).
-- The original statements closed anon access on four app tables and removed
-- wish storage policies. Those changes, plus the Better Auth tables, are in
-- the later migration, which is already on production.
--
-- Left as a no-op so a later `supabase db push` can record the version without
-- touching privileges, policies, or rows, and without failing if a table the
-- old script named is absent.

select 1;
