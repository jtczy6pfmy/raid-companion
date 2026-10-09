-- Additive import support; applied to the existing hosted Supabase project.
-- Existing rows, notes, and owner-scoped RLS policies are retained.
alter table public.raid_champions add column if not exists import_key text;
alter table public.raid_champions add column if not exists import_data jsonb not null default '{}'::jsonb;
create unique index if not exists raid_champions_owner_import_key
 on public.raid_champions(owner_id,import_key) where import_key is not null;
