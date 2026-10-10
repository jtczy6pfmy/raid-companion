-- Additive private storage for saved builds, teams and manually logged battles.
create table if not exists public.raid_companion_plans (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check (kind in ('build','team','run')),
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=100000),
 deleted boolean not null default false,
 updated_at timestamptz not null default now()
);
create index if not exists raid_companion_plans_owner_idx on public.raid_companion_plans(owner_id);
alter table public.raid_companion_plans enable row level security;
revoke all on public.raid_companion_plans from anon;
grant select,insert,update on public.raid_companion_plans to authenticated;
create policy plans_select_own on public.raid_companion_plans for select to authenticated using ((select auth.uid())=owner_id);
create policy plans_insert_own on public.raid_companion_plans for insert to authenticated with check ((select auth.uid())=owner_id);
create policy plans_update_own on public.raid_companion_plans for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
