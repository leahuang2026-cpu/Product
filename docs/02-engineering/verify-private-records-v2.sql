-- Read-only installation checks. Replace YOUR_LOGIN_EMAIL with the intended owner email.
-- No records, credentials or account identifiers are returned.
with expected(name) as (
 values ('personal_os_owners'), ('personal_os_records'),
        ('personal_os_attachments'), ('personal_os_entries'), ('personal_os_requests')
), inspected as (
 select c.oid, c.relrowsecurity
 from expected e
 join pg_namespace n on n.nspname='public'
 join pg_class c on c.relnamespace=n.oid and c.relname=e.name and c.relkind='r'
)
select
 (select count(*)=5 from inspected) as tables_ok,
 (select count(*)=5 and bool_and(relrowsecurity) from inspected) as rls_ok,
 (select count(*)=1 from public.personal_os_owners) as single_owner_ok,
 (select count(*)=1 from public.personal_os_owners o
  join auth.users u on u.id=o.user_id
  where lower(u.email)=lower('YOUR_LOGIN_EMAIL')
  and u.email_confirmed_at is not null) as owner_matches_login,
 exists(select 1 from storage.buckets
  where id='personal-os-private' and public=false and file_size_limit=10000000) as private_bucket_ok,
 (select count(*)=5 and bool_and(
  not has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  and not has_table_privilege('authenticated',oid,'DELETE,TRUNCATE')
 ) from inspected) as table_grants_ok,
 (select count(*)=2 and bool_and(
  policyname in ('private_original_read','private_original_insert')
  and roles=array['authenticated']::name[] and cmd in ('SELECT','INSERT')
 ) from pg_policies where schemaname='storage' and tablename='objects') as storage_policy_set_ok;
