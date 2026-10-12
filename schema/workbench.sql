-- Private optimiser/session state; does not change champions, runs or existing plans.
create table public.raid_companion_workbench (
 owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=2000000),
 revision bigint not null default 1 check (revision>0),
 updated_at timestamptz not null default now()
);
alter table public.raid_companion_workbench enable row level security;
revoke all on public.raid_companion_workbench from public,anon,authenticated;
grant select,insert,update on public.raid_companion_workbench to authenticated;
create policy workbench_select_own on public.raid_companion_workbench for select to authenticated using ((select auth.uid())=owner_id);
create policy workbench_insert_own on public.raid_companion_workbench for insert to authenticated with check ((select auth.uid())=owner_id);
create policy workbench_update_own on public.raid_companion_workbench for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
