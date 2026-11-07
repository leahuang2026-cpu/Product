-- Owner approved 2026-11-07. Execution still pending; this file is not proof of installation.
-- New names only; no migration, deletion or overwrite of legacy tables/data.
-- Must be verified in an isolated Supabase project before production use.
begin;
-- Stop instead of overwriting an earlier installation or combining unknown storage policies.
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and left(c.relname,12)='personal_os_')
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,12)='personal_os_')
 or exists(select 1 from storage.buckets where id='personal-os-private') then
  raise exception 'Existing Personal OS objects found. Stop and inspect; do not overwrite.';
 end if;
 if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects') then
  raise exception 'Existing Storage policies require review before installing private originals.';
 end if;
end $$;
create table public.personal_os_owners (user_id uuid primary key references auth.users(id));
alter table public.personal_os_owners enable row level security;
create policy owner_self on public.personal_os_owners for select to authenticated using (user_id = auth.uid());
revoke all on public.personal_os_owners from public,anon,authenticated;
grant select on public.personal_os_owners to authenticated;

create function public.personal_os_valid_domains(value text[]) returns boolean language sql immutable as $$
 select value <@ array['职业','财富','能力','自我','生活']::text[]
 and cardinality(value) = (select count(distinct x) from unnest(value) x)
$$;
create table public.personal_os_records (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 original_text text not null default '' check(length(original_text)<=10000),
 links jsonb not null default '[]' check(jsonb_typeof(links)='array'),
 attachment_ids uuid[] not null default '{}',
 source_id uuid,
 note text not null default '' check(length(note)<=10000),
 domains text[] not null default '{}' check(public.personal_os_valid_domains(domains)),
 is_idea boolean not null default false,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 unique(id,owner_id),
 foreign key(source_id,owner_id) references public.personal_os_records(id,owner_id)
);
create index personal_os_record_time on public.personal_os_records(owner_id,created_at desc,id desc);
create index personal_os_record_domains on public.personal_os_records using gin(domains);
create table public.personal_os_attachments (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 record_id uuid, object_key text not null unique,
 mime text not null check(mime in ('image/jpeg','image/png','audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4')),
 name text not null, bytes integer not null check(bytes>0 and bytes<=10000000), sha256 text not null,
 foreign key(record_id,owner_id) references public.personal_os_records(id,owner_id),
 check(object_key = owner_id::text || '/' || id::text)
);
create table public.personal_os_entries (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 kind text not null check(kind in ('focus','direction','reflection')),
 payload jsonb not null, version integer not null default 1, created_at timestamptz not null default now()
);
create table public.personal_os_requests (
 owner_id uuid not null references auth.users(id), operation text not null,
 request_key uuid not null, payload jsonb not null, result jsonb not null,
 primary key(owner_id,operation,request_key)
);
-- Owner binding is appended transactionally by scripts/prepare-supabase.ts.
-- Use its complete generated installation file; no manual UUID insertion is needed.
do $$ declare t text; begin
 foreach t in array array['personal_os_records','personal_os_attachments','personal_os_entries','personal_os_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy private_owner on public.%I for all to authenticated using (owner_id=auth.uid() and exists(select 1 from public.personal_os_owners where user_id=auth.uid())) with check (owner_id=auth.uid() and exists(select 1 from public.personal_os_owners where user_id=auth.uid()))',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
end $$;
-- Explicit revocation also removes DELETE/TRUNCATE inherited from Supabase default grants.
create function public.personal_os_protect_original() returns trigger language plpgsql as $$ begin
 if new.id<>old.id or new.owner_id<>old.owner_id or new.original_text<>old.original_text or new.links<>old.links or new.attachment_ids<>old.attachment_ids or new.source_id is distinct from old.source_id or new.created_at<>old.created_at then
  raise exception 'original is immutable' using errcode='42501';
 end if; return new;
end $$;
create trigger immutable_original before update on public.personal_os_records for each row execute function public.personal_os_protect_original();
create function public.personal_os_protect_attachment() returns trigger language plpgsql as $$ begin
 if new.id<>old.id or new.owner_id<>old.owner_id or new.object_key<>old.object_key or new.mime<>old.mime or new.name<>old.name or new.bytes<>old.bytes or new.sha256<>old.sha256 or (old.record_id is not null and new.record_id is distinct from old.record_id) then
  raise exception 'attachment is immutable' using errcode='42501';
 end if; return new;
end $$;
create trigger immutable_attachment before update on public.personal_os_attachments for each row execute function public.personal_os_protect_attachment();

create function public.personal_os_get_record(record_id uuid) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('id',r.id,'originalText',r.original_text,'note',r.note,'domains',r.domains,'isIdea',r.is_idea,'createdAt',r.created_at,'version',r.version,'links',r.links,'sourceId',r.source_id,
 'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'bytes',a.bytes) order by array_position(r.attachment_ids,a.id)) from personal_os_attachments a where a.record_id=r.id and a.owner_id=auth.uid()),'[]'::jsonb))
 from personal_os_records r where r.id=record_id and r.owner_id=auth.uid()
$$;
create function public.personal_os_list_records() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(personal_os_get_record(id) order by created_at desc,id desc),'[]'::jsonb) from personal_os_records where owner_id=auth.uid()
$$;
create function public.personal_os_save_record(payload jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare rid uuid := (payload->>'id')::uuid; original text := payload->>'originalText'; ids uuid[]; existing personal_os_records; begin
 ids := array(select jsonb_array_elements_text(payload->'attachmentIds')::uuid);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || rid::text,0));
 select * into existing from personal_os_records where id=rid and owner_id=auth.uid();
 if found then
  if existing.original_text is distinct from original or existing.links is distinct from payload->'links' or existing.attachment_ids<>ids or existing.source_id is distinct from (payload->>'sourceId')::uuid then raise exception 'request mismatch' using errcode='40001'; end if;
  return personal_os_get_record(rid);
 end if;
 if original is null or (btrim(original)='' and cardinality(ids)=0 and jsonb_array_length(payload->'links')=0) then raise exception 'empty content' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements_text(payload->'links') l where l !~ '^https?://') then raise exception 'invalid link' using errcode='23514'; end if;
 perform id from personal_os_attachments where id=any(ids) and owner_id=auth.uid() order by id for update;
 if (select count(*) from personal_os_attachments where id=any(ids) and owner_id=auth.uid() and record_id is null)<>cardinality(ids) then raise exception 'attachment unavailable' using errcode='42501'; end if;
 insert into personal_os_records(id,owner_id,original_text,links,attachment_ids,source_id) values(rid,auth.uid(),original,payload->'links',ids,(payload->>'sourceId')::uuid);
 update personal_os_attachments set record_id=rid where id=any(ids) and owner_id=auth.uid();
 return personal_os_get_record(rid);
end $$;
create function public.personal_os_update_metadata(record_id uuid,payload jsonb,request_key uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved personal_os_requests; r personal_os_records; result jsonb; op text:='metadata:'||record_id::text; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || op,0));
 select * into saved from personal_os_requests q where q.owner_id=auth.uid() and q.operation=op and q.request_key=personal_os_update_metadata.request_key;
 if found then if saved.payload<>payload then raise exception 'request mismatch' using errcode='40001'; end if; return saved.result; end if;
 select * into r from personal_os_records where id=record_id and owner_id=auth.uid() for update;
 if not found then raise exception 'not accessible' using errcode='42501'; end if;
 if r.version<>(payload->>'version')::integer then raise exception 'version conflict' using errcode='40001'; end if;
 update personal_os_records set domains=case when payload?'domains' then array(select jsonb_array_elements_text(payload->'domains')) else domains end,
 note=case when payload?'note' then payload->>'note' else note end,
 is_idea=case when payload?'isIdea' then (payload->>'isIdea')::boolean else is_idea end,version=version+1
 where id=record_id and owner_id=auth.uid();
 result:=personal_os_get_record(record_id);
 insert into personal_os_requests values(auth.uid(),op,request_key,payload,result);
 return result;
end $$;
create function public.personal_os_list_entries() returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(payload || jsonb_build_object('version',version) order by created_at,id),'[]'::jsonb) from personal_os_entries where owner_id=auth.uid()
$$;
create function public.personal_os_save_entry(payload jsonb,request_key uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p jsonb:=payload; prior_kind text; saved personal_os_requests; rid uuid:=(p->>'id')::uuid; v integer; result jsonb; op text:='entry:'||rid::text; sid uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || op,0));
 select * into saved from personal_os_requests q where q.owner_id=auth.uid() and q.operation=op and q.request_key=personal_os_save_entry.request_key;
 if found then if saved.payload<>p then raise exception 'request mismatch' using errcode='40001'; end if; return saved.result; end if;
 for sid in select jsonb_array_elements_text(p->'sourceIds')::uuid loop
  if not exists(select 1 from personal_os_records where id=sid and owner_id=auth.uid()) then raise exception 'source denied' using errcode='42501'; end if;
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
-- Private originals: authenticated owner folder only; no UPDATE or DELETE storage policy.
insert into storage.buckets(id,name,public,file_size_limit) values('personal-os-private','personal-os-private',false,10000000);
create policy private_original_read on storage.objects for select to authenticated using(bucket_id='personal-os-private' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.personal_os_owners where user_id=auth.uid()));
create policy private_original_insert on storage.objects for insert to authenticated with check(bucket_id='personal-os-private' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.personal_os_owners where user_id=auth.uid()));
-- Remove PostgreSQL default PUBLIC function execution. Only approved authenticated calls.
revoke all on function public.personal_os_valid_domains(text[]), public.personal_os_protect_original(), public.personal_os_protect_attachment() from public,anon,authenticated;
grant execute on function public.personal_os_valid_domains(text[]) to authenticated;
revoke all on function public.personal_os_get_record(uuid), public.personal_os_list_records(), public.personal_os_save_record(jsonb), public.personal_os_update_metadata(uuid,jsonb,uuid), public.personal_os_list_entries(), public.personal_os_save_entry(jsonb,uuid) from public,anon;
grant execute on function public.personal_os_get_record(uuid), public.personal_os_list_records(), public.personal_os_save_record(jsonb), public.personal_os_update_metadata(uuid,jsonb,uuid), public.personal_os_list_entries(), public.personal_os_save_entry(jsonb,uuid) to authenticated;
commit;
