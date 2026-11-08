-- BKP-02: additive read-only snapshot. No data changes or RLS/Storage policy changes.
-- Requires reviewed-v2 + recycle-bin-v1. Run ONCE; never overwrite an existing function.
begin;
do $$ begin
 if to_regprocedure('public.personal_os_backup_snapshot_v1()') is not null then
  raise exception 'Backup snapshot already installed. Stop; do not overwrite.';
 end if;
 if to_regprocedure('public.personal_os_list_trash()') is null
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='personal_os_records' and column_name='deleted_at') then
  raise exception 'Expected reviewed-v2 and recycle-bin-v1. Stop and inspect.';
 end if;
 if exists(select 1 from pg_class where oid in ('public.personal_os_records'::regclass,'public.personal_os_entries'::regclass,'public.personal_os_attachments'::regclass,'public.personal_os_owners'::regclass) and not relrowsecurity) then
  raise exception 'RLS must be enabled. Stop and inspect.';
 end if;
end $$;
create function public.personal_os_backup_snapshot_v1() returns jsonb
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb; row_count bigint; attachment_count bigint; original_bytes bigint; estimated_json bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.personal_os_owners where user_id=auth.uid()) then
  raise exception 'Owner only' using errcode='42501';
 end if;
 -- STABLE uses the invoking statement's MVCC snapshot for every read, including counts.
 select (select count(*) from personal_os_records where owner_id=auth.uid()) +
        (select count(*) from personal_os_entries where owner_id=auth.uid()) into row_count;
 select count(*),coalesce(sum(bytes),0) into attachment_count,original_bytes
 from personal_os_attachments where owner_id=auth.uid() and record_id is not null;
 if row_count>5000 or attachment_count>1000 or original_bytes>50000000 then
  raise exception 'Backup validation capacity exceeded; no truncation' using errcode='54000';
 end if;
 -- Bound aggregation before building JSON; final byte check also includes JSON escaping/keys.
 select coalesce((select sum(octet_length(to_jsonb(r)::text)) from personal_os_records r where owner_id=auth.uid()),0)
 + coalesce((select sum(octet_length(to_jsonb(e)::text)) from personal_os_entries e where owner_id=auth.uid()),0)
 + coalesce((select sum(octet_length(to_jsonb(a)::text)) from personal_os_attachments a where owner_id=auth.uid() and record_id is not null),0) into estimated_json;
 if estimated_json>8388608 then raise exception 'Metadata capacity exceeded' using errcode='54000'; end if;
 -- Future columns must be reviewed, never silently dropped from a complete backup.
 if exists(select 1 from information_schema.columns where table_schema='public' and
 ((table_name='personal_os_records' and column_name not in ('id','owner_id','original_text','links','attachment_ids','source_id','note','domains','is_idea','version','created_at','deleted_at')) or
  (table_name='personal_os_entries' and column_name not in ('id','owner_id','kind','payload','version','created_at','deleted_at')) or
  (table_name='personal_os_attachments' and column_name not in ('id','owner_id','record_id','object_key','mime','name','bytes','sha256')))) then
  raise exception 'Unknown archive columns; update backup format first' using errcode='22023';
 end if;
 -- Unknown payload keys survive into result so the strict application validator fails closed.
 if exists(select 1 from personal_os_entries where owner_id=auth.uid() and
 (payload->>'id' is distinct from id::text or payload->>'kind' is distinct from kind or
  payload ?| array['createdAt','deletedAt','sourceVersion'])) then
  raise exception 'Unexpected entry identity or fields' using errcode='22023';
 end if;
 select jsonb_build_object(
 'snapshotAt',statement_timestamp(),
 'records',coalesce((select jsonb_agg(jsonb_build_object(
  'id',r.id,'originalText',r.original_text,'note',r.note,'domains',r.domains,'isIdea',r.is_idea,
  'links',r.links,'attachmentIds',r.attachment_ids,'sourceId',r.source_id,'createdAt',r.created_at,
  'deletedAt',r.deleted_at,'sourceVersion',r.version) order by r.created_at,r.id)
  from personal_os_records r where r.owner_id=auth.uid()),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg((e.payload-'version') || jsonb_build_object(
  'createdAt',e.created_at,'deletedAt',e.deleted_at,'sourceVersion',e.version) order by e.created_at,e.id)
  from personal_os_entries e where e.owner_id=auth.uid()),'[]'::jsonb),
 'attachments',coalesce((select jsonb_agg(jsonb_build_object(
  'id',a.id,'recordId',a.record_id,'name',a.name,'mime',a.mime,'bytes',a.bytes,'sha256',a.sha256) order by a.id)
  from personal_os_attachments a where a.owner_id=auth.uid() and a.record_id is not null),'[]'::jsonb)
 ) into result;
 if octet_length(result::text)>8388608 then raise exception 'Metadata capacity exceeded' using errcode='54000'; end if;
 return result;
end $$;
revoke all on function public.personal_os_backup_snapshot_v1() from public,anon,authenticated;
grant execute on function public.personal_os_backup_snapshot_v1() to authenticated;
notify pgrst,'reload schema';
commit;
