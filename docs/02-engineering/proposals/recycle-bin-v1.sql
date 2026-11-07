-- Approved recycle bin extension, 2026-11-08. Run ONCE after reviewed-v2.
-- Atomic additive migration: no DELETE, no original/attachment rewrite.
begin;
do $$ begin
 if to_regclass('public.personal_os_records') is null
 or to_regclass('public.personal_os_entries') is null
 or not exists(select 1 from pg_trigger where tgrelid='public.personal_os_records'::regclass and tgname='immutable_original' and not tgisinternal) then
  raise exception 'Expected reviewed-v2 foundation. Stop and inspect.';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('personal_os_records','personal_os_entries') and column_name='deleted_at') then
  raise exception 'Recycle bin already present or partial installation. Stop and inspect; do not rerun.';
 end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.personal_os_get_record(uuid)') and md5(regexp_replace(prosrc,'\s','','g'))='850a0b89efb48534dd36ca1493ffdc1c') then raise exception 'Unexpected personal_os_get_record definition. Stop and inspect.'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.personal_os_list_records()') and md5(regexp_replace(prosrc,'\s','','g'))='4c364cf6d5cdfbd4587c502964aeb66f') then raise exception 'Unexpected personal_os_list_records definition. Stop and inspect.'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.personal_os_list_entries()') and md5(regexp_replace(prosrc,'\s','','g'))='57d122dbd0d92cdf16bc2c46d254e7a9') then raise exception 'Unexpected personal_os_list_entries definition. Stop and inspect.'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.personal_os_save_entry(jsonb,uuid)') and md5(regexp_replace(prosrc,'\s','','g'))='b3e990e2bc8816f91b8097a154c097d5') then raise exception 'Unexpected personal_os_save_entry definition. Stop and inspect.'; end if;
 if exists(select 1 from pg_class where oid in ('public.personal_os_records'::regclass,'public.personal_os_entries'::regclass) and not relrowsecurity) then raise exception 'RLS must be enabled. Stop and inspect.'; end if;
end $$;
alter table public.personal_os_records add column deleted_at timestamptz;
alter table public.personal_os_entries add column deleted_at timestamptz;
-- Null defaults preserve all existing rows as live; no data is moved.
create function public.personal_os_trash_guard() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_table_name='personal_os_entries' then
  -- Serialize direction references and bin operations for this owner.
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text || ':trash-entries',0));
  if tg_op='UPDATE' then
   if new.id<>old.id or new.owner_id<>old.owner_id or new.kind<>old.kind or new.created_at<>old.created_at then
    raise exception 'entry identity immutable' using errcode='42501';
   end if;
   if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'restore before editing' using errcode='PT410';
   end if;
  end if;
  if new.deleted_at is not null then
   if new.kind='focus' then raise exception 'focus bin unsupported' using errcode='42501'; end if;
   if new.kind='direction' and exists(select 1 from personal_os_entries e where e.owner_id=new.owner_id and e.kind='focus' and e.payload->>'relationId'=new.id::text) then
    raise exception 'direction still referenced' using errcode='PT409';
   end if;
  end if;
  if new.payload->>'relationId' is not null and not exists(select 1 from personal_os_entries e where e.id=(new.payload->>'relationId')::uuid and e.owner_id=new.owner_id and e.kind='direction' and e.deleted_at is null) then
   raise exception 'direction unavailable' using errcode='PT410';
  end if;
 else
  if tg_op='UPDATE' and old.deleted_at is not null and new.deleted_at is not null then
   raise exception 'restore before editing' using errcode='PT410';
  end if;
  if tg_op='INSERT' and new.source_id is not null and exists(select 1 from personal_os_records r where r.id=new.source_id and r.owner_id=new.owner_id and r.deleted_at is not null) then
   raise exception 'source unavailable' using errcode='PT410';
  end if;
 end if;
 return new;
end $$;
create trigger recycle_record_guard before insert or update on public.personal_os_records for each row execute function public.personal_os_trash_guard();
create trigger recycle_entry_guard before insert or update on public.personal_os_entries for each row execute function public.personal_os_trash_guard();

create or replace function public.personal_os_get_record(record_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select case when r.deleted_at is not null then jsonb_build_object('id',r.id,'deletedAt',r.deleted_at) else jsonb_build_object('id',r.id,'originalText',r.original_text,'note',r.note,'domains',r.domains,'isIdea',r.is_idea,'createdAt',r.created_at,'version',r.version,'links',r.links,'sourceId',r.source_id,
 'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'bytes',a.bytes) order by array_position(r.attachment_ids,a.id)) from personal_os_attachments a where a.record_id=r.id and a.owner_id=auth.uid()),'[]'::jsonb)) end
 from personal_os_records r where r.id=record_id and r.owner_id=auth.uid()
$$;
create or replace function public.personal_os_list_records() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(personal_os_get_record(id) order by created_at desc,id desc),'[]'::jsonb) from personal_os_records where owner_id=auth.uid() and deleted_at is null
$$;
create or replace function public.personal_os_list_entries() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(payload || jsonb_build_object('version',version) order by created_at,id),'[]'::jsonb) from personal_os_entries where owner_id=auth.uid() and deleted_at is null
$$;
create or replace function public.personal_os_save_entry(payload jsonb,request_key uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p jsonb:=payload; prior_kind text; saved personal_os_requests; rid uuid:=(p->>'id')::uuid; v integer; result jsonb; op text:='entry:'||rid::text; sid uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':trash-entries',0));
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || op,0));
 if exists(select 1 from personal_os_entries where id=rid and owner_id=auth.uid() and deleted_at is not null) then raise exception 'restore before editing' using errcode='PT410'; end if;
 select * into saved from personal_os_requests q where q.owner_id=auth.uid() and q.operation=op and q.request_key=personal_os_save_entry.request_key;
 if found then if saved.payload<>p then raise exception 'request mismatch' using errcode='40001'; end if; return saved.result; end if;
 for sid in select jsonb_array_elements_text(p->'sourceIds')::uuid loop
  if not exists(select 1 from personal_os_records r where r.id=sid and r.owner_id=auth.uid() and (r.deleted_at is null or exists(select 1 from personal_os_entries e where e.id=rid and e.owner_id=auth.uid() and e.payload->'sourceIds' ? sid::text))) then raise exception 'source denied' using errcode='42501'; end if;
 end loop;
 if p->>'relationId' is not null and not exists(select 1 from personal_os_entries where id=(p->>'relationId')::uuid and owner_id=auth.uid() and kind='direction') then raise exception 'relation denied' using errcode='42501'; end if;
 select version,kind into v,prior_kind from personal_os_entries where id=rid and owner_id=auth.uid() for update;
 if prior_kind is not null and prior_kind<>p->>'kind' then raise exception 'kind immutable' using errcode='40001'; end if;
 if coalesce(v,0)<>(p->>'version')::integer then raise exception 'version conflict' using errcode='40001'; end if;
 result:=p||jsonb_build_object('version',coalesce(v,0)+1);
 if v is null then insert into personal_os_entries(id,owner_id,kind,payload) values(rid,auth.uid(),p->>'kind',result);
 else update personal_os_entries set payload=result,version=v+1 where id=rid and owner_id=auth.uid() and kind=p->>'kind'; end if;
 insert into personal_os_requests values(auth.uid(),op,request_key,p,result);return result;
end $$;

create function public.personal_os_list_trash() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(item order by removed desc,id),'[]'::jsonb) from (
  select r.id,r.deleted_at as removed,jsonb_build_object('id',r.id,'kind','record','title',coalesce(nullif(left(btrim(r.original_text),60),''),(select a.name from personal_os_attachments a where a.record_id=r.id and a.owner_id=auth.uid() limit 1),'一条记录'),'deletedAt',r.deleted_at,'version',r.version) as item
  from personal_os_records r where r.owner_id=auth.uid() and r.deleted_at is not null
  union all
  select e.id,e.deleted_at,jsonb_build_object('id',e.id,'kind',e.kind,'title',coalesce(nullif(e.payload->>'title',''),nullif(left(e.payload->>'body',60),''),'未命名内容'),'deletedAt',e.deleted_at,'version',e.version)
  from personal_os_entries e where e.owner_id=auth.uid() and e.deleted_at is not null and e.kind in ('direction','reflection')
 ) items
$$;
create function public.personal_os_set_trash(payload jsonb,request_key uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare rid uuid:=(payload->>'id')::uuid; k text:=payload->>'kind'; target boolean:=(payload->>'deleted')::boolean; v integer; removed timestamptz; result jsonb; saved personal_os_requests; op text:='trash:'||k||':'||rid::text;
begin
 if k not in ('record','direction','reflection') or target is null or request_key is null or coalesce((payload->>'version')::integer,0)<1 then raise exception 'invalid trash request' using errcode='22023'; end if;
 if k<>'record' then perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':trash-entries',0)); end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || op,0));
 select * into saved from personal_os_requests q where q.owner_id=auth.uid() and q.operation=op and q.request_key=personal_os_set_trash.request_key;
 if found then if saved.payload<>payload then raise exception 'request mismatch' using errcode='40001'; end if; return saved.result; end if;
 if k='record' then select r.version,r.deleted_at into v,removed from personal_os_records r where r.id=rid and r.owner_id=auth.uid() for update;
 else select e.version,e.deleted_at into v,removed from personal_os_entries e where e.id=rid and e.owner_id=auth.uid() and e.kind=k for update; end if;
 if v is null then raise exception 'not accessible' using errcode='42501'; end if;
 if v<>(payload->>'version')::integer then raise exception 'version conflict' using errcode='40001'; end if;
 if (removed is not null)=target then raise exception 'state changed' using errcode='40001'; end if;
 removed:=case when target then now() else null end;
 if k='record' then update personal_os_records set deleted_at=removed,version=version+1 where id=rid and owner_id=auth.uid();
 else update personal_os_entries set deleted_at=removed,version=version+1 where id=rid and owner_id=auth.uid() and kind=k; end if;
 result:=jsonb_build_object('id',rid,'kind',k,'deleted',target,'version',v+1);
 insert into personal_os_requests values(auth.uid(),op,request_key,payload,result);
 return result;
end $$;
revoke all on function public.personal_os_trash_guard(), public.personal_os_list_trash(), public.personal_os_set_trash(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.personal_os_list_trash(), public.personal_os_set_trash(jsonb,uuid) to authenticated;
-- Existing RLS/grants/immutable original and attachment triggers remain intact.
-- No DELETE/TRUNCATE or Storage policies are added.
notify pgrst, 'reload schema';
commit;
select 'personal_os_recycle_bin_v1_installed' as status;
