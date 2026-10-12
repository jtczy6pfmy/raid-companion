begin;
-- Temporary test accounts and records are removed by ROLLBACK.
insert into auth.users(id) values ('0cbf006e-39d8-4d23-a739-f09174a77d60'),('d98f6aab-2a61-4776-84e4-1b94fe828184');
insert into public.raid_companion_workbench(owner_id,payload) values ('0cbf006e-39d8-4d23-a739-f09174a77d60','{"test":true}'),('d98f6aab-2a61-4776-84e4-1b94fe828184','{"test":true}');
set local role authenticated;
select set_config('request.jwt.claim.sub','0cbf006e-39d8-4d23-a739-f09174a77d60',true);
do $$ declare n integer; begin
 select count(*) into n from public.raid_companion_workbench;
 if n<>1 then raise exception 'Owner isolation failed'; end if;
 update public.raid_companion_workbench set revision=2 where owner_id='d98f6aab-2a61-4776-84e4-1b94fe828184';
 get diagnostics n=row_count; if n<>0 then raise exception 'Other-owner update allowed'; end if;
 update public.raid_companion_workbench set revision=2 where owner_id='0cbf006e-39d8-4d23-a739-f09174a77d60' and revision=1;
 get diagnostics n=row_count; if n<>1 then raise exception 'Own update failed'; end if;
 update public.raid_companion_workbench set revision=3 where owner_id='0cbf006e-39d8-4d23-a739-f09174a77d60' and revision=1;
 get diagnostics n=row_count; if n<>0 then raise exception 'Stale revision accepted'; end if;
 begin
  update public.raid_companion_workbench set owner_id='d98f6aab-2a61-4776-84e4-1b94fe828184' where owner_id='0cbf006e-39d8-4d23-a739-f09174a77d60';
  raise exception 'Owner reassignment allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.raid_companion_workbench;raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Owner isolation, own update, stale-write rejection, reassignment denial and anon denial passed' as verification;
rollback;
