-- Read-only, no personal rows or credentials returned. Expect six true values.
select
 exists(select 1 from pg_proc where oid=to_regprocedure('public.personal_os_backup_snapshot_v1()') and not prosecdef and provolatile='s') as snapshot_invoker_stable,
 coalesce(has_function_privilege('authenticated',to_regprocedure('public.personal_os_backup_snapshot_v1()'),'EXECUTE'),false) as authenticated_execute,
 coalesce(not has_function_privilege('anon',to_regprocedure('public.personal_os_backup_snapshot_v1()'),'EXECUTE'),false) as anon_denied,
 exists(select 1 from pg_proc p where oid=to_regprocedure('public.personal_os_backup_snapshot_v1()') and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')) as public_denied,
 (select count(*)=4 and bool_and(relrowsecurity) from pg_class where oid in ('public.personal_os_records'::regclass,'public.personal_os_entries'::regclass,'public.personal_os_attachments'::regclass,'public.personal_os_owners'::regclass)) as rls_enabled,
 (select bool_and(not has_table_privilege('authenticated',t,'DELETE,TRUNCATE')) from unnest(array['public.personal_os_records','public.personal_os_entries','public.personal_os_attachments']) t) as no_destructive_grants;
