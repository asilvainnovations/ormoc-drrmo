-- Integration-test users (local database only).
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000b1', 'assessor@it.local', '{"full_name":"IT Assessor"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'viewer@it.local', '{"full_name":"IT Viewer"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'duty@it.local', '{"full_name":"IT Duty Officer"}'),
 ('00000000-0000-0000-0000-0000000000b4', 'eocmgr@it.local', '{"full_name":"IT EOC Manager"}');
insert into public.user_roles (user_id, role) values
 ('00000000-0000-0000-0000-0000000000b1', 'assessor'), ('00000000-0000-0000-0000-0000000000b2', 'viewer'),
 ('00000000-0000-0000-0000-0000000000b3', 'duty_officer'), ('00000000-0000-0000-0000-0000000000b4', 'eoc_manager');
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator-it';
  end if;
end $$;
alter role authenticator password 'authenticator-it';
grant anon, authenticated to authenticator;
