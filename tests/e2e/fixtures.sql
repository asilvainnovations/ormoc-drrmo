-- End-to-end test accounts (local database only; scripts/e2e_test.sh). Password for all: integration-only
-- (checked by tests/integration/proxy.mjs, which stands in for Supabase Auth).
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000e1', 'lead@e2e.local',   '{"full_name":"E2E CDRRMO Head"}'),
 ('00000000-0000-0000-0000-0000000000e2', 'admin@e2e.local',  '{"full_name":"E2E Administrator"}'),
 ('00000000-0000-0000-0000-0000000000e3', 'viewer@e2e.local', '{"full_name":"E2E Viewer"}'),
 ('00000000-0000-0000-0000-0000000000e4', 'duty@e2e.local',   '{"full_name":"E2E Duty Officer"}')
on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values
 ('00000000-0000-0000-0000-0000000000e1', 'cdrrmo_head'), ('00000000-0000-0000-0000-0000000000e1', 'eoc_manager'),
 ('00000000-0000-0000-0000-0000000000e1', 'assessor'), ('00000000-0000-0000-0000-0000000000e1', 'validator'),
 ('00000000-0000-0000-0000-0000000000e1', 'author'),
 ('00000000-0000-0000-0000-0000000000e2', 'admin'),
 ('00000000-0000-0000-0000-0000000000e3', 'viewer'),
 ('00000000-0000-0000-0000-0000000000e4', 'duty_officer')
on conflict do nothing;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator-it';
  end if;
end $$;
alter role authenticator password 'authenticator-it';
grant anon, authenticated to authenticator;
