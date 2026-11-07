-- Read-only verification after the one-time recycle-bin migration.
select
 (select count(*)=2 from information_schema.columns where table_schema='public' and table_name in ('personal_os_records','personal_os_entries') and column_name='deleted_at') as columns_ok,
 (select count(*)=2 and bool_and(relrowsecurity) from pg_class where oid in ('public.personal_os_records'::regclass,'public.personal_os_entries'::regclass)) as rls_ok,
 (select count(*)=2 from pg_trigger where not tgisinternal and tgname in ('recycle_record_guard','recycle_entry_guard') and tgenabled='O') as guards_ok,
 (not has_function_privilege('anon','public.personal_os_list_trash()','EXECUTE') and not has_function_privilege('anon','public.personal_os_set_trash(jsonb,uuid)','EXECUTE') and has_function_privilege('authenticated','public.personal_os_list_trash()','EXECUTE') and has_function_privilege('authenticated','public.personal_os_set_trash(jsonb,uuid)','EXECUTE')) as rpc_private_ok,
 (not has_table_privilege('authenticated','public.personal_os_records','DELETE,TRUNCATE') and not has_table_privilege('authenticated','public.personal_os_entries','DELETE,TRUNCATE') and not has_table_privilege('authenticated','public.personal_os_attachments','DELETE,TRUNCATE')) as no_hard_delete_ok,
 (select not public from storage.buckets where id='personal-os-private') as private_bucket_ok;
