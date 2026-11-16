-- ADR-040 / 1.22.0 conversation rules. Append to supabase/tests/10_rules_and_security.sql
-- or run after logging in as each role. Expected: allowed / refused with SQLSTATE 42501.

-- Guards exist
select 'guard_conversation_thread' as check_name,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'guard_conversation_thread') as ok;
select 'guard_conversation_message' as check_name,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'guard_conversation_message') as ok;

-- Tables tracked and RLS on
select 'threads rls' as check_name, c.relrowsecurity as ok
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'conversation_threads';
select 'messages rls' as check_name, c.relrowsecurity as ok
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'conversation_messages';

-- No DELETE for authenticated
select 'threads no delete' as check_name,
       case when has_table_privilege('authenticated', 'public.conversation_threads', 'DELETE')
            then 'DELETE STILL GRANTED' else 'ok' end as result;
select 'messages no delete' as check_name,
       case when has_table_privilege('authenticated', 'public.conversation_messages', 'DELETE')
            then 'DELETE STILL GRANTED' else 'ok' end as result;

-- Unique open/resolved thread index present
select 'one open per parent index' as check_name,
       exists (select 1 from pg_indexes
               where schemaname = 'public' and indexname = 'conversation_threads_one_open_per_parent') as ok;
