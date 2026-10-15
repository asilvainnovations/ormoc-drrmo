-- Platform developer access (time-boxed).
--
-- Run in the Supabase SQL editor by the City's administrator, AFTER inviting the
-- developer's email in Authentication -> Users -> Invite user.
-- This file is not a migration: never put it in supabase/migrations/.
--
-- Change the address in all three blocks if a different developer is given access.
-- Run ONE of block 1 or block 2, and block 3 at turnover.
--
-- Note: the admin role passes every role check (app.has_any_role), including
-- approving SOP versions and recording declaration steps. Those acts belong to City
-- officials, so the developer holds admin only while setting up the platform.

-- ---------------------------------------------------------------------------
-- 1. Setup period: administrator access
-- ---------------------------------------------------------------------------
do $$
declare
  v_email constant text := 'alvin.silva@cognitioplus.com';
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'No account for %. Invite it first (Authentication -> Users -> Invite user).', v_email;
  end if;
  update public.profiles
     set full_name = 'Alvin M. Silva', position = 'Platform developer (consultant)', is_active = true
   where id = v_id;
  insert into public.user_roles (user_id, role) values (v_id, 'admin')
  on conflict do nothing;
  raise notice 'Admin access granted to %.', v_email;
end $$;

-- ---------------------------------------------------------------------------
-- 2. After setup: support access without admin (testing, drafting, reading)
--    Removes admin and keeps roles that carry no approval authority.
-- ---------------------------------------------------------------------------
-- do $$
-- declare
--   v_email constant text := 'alvin.silva@cognitioplus.com';
--   v_id uuid;
-- begin
--   select id into v_id from auth.users where lower(email) = lower(v_email);
--   if v_id is null then raise exception 'No account for %.', v_email; end if;
--   delete from public.user_roles where user_id = v_id and role = 'admin';
--   insert into public.user_roles (user_id, role)
--   select v_id, r::public.app_role from unnest(array['author', 'assessor', 'viewer']) r
--   on conflict do nothing;
--   raise notice 'Support access set for %.', v_email;
-- end $$;

-- ---------------------------------------------------------------------------
-- 3. Turnover: remove all access (records and the audit trail stay)
-- ---------------------------------------------------------------------------
-- do $$
-- declare
--   v_email constant text := 'alvin.silva@cognitioplus.com';
--   v_id uuid;
-- begin
--   select id into v_id from auth.users where lower(email) = lower(v_email);
--   if v_id is null then raise exception 'No account for %.', v_email; end if;
--   delete from public.user_roles where user_id = v_id;
--   update public.profiles set is_active = false where id = v_id;
--   raise notice 'Access removed for %.', v_email;
-- end $$;

-- Check: who holds which role
-- select u.email, p.is_active, array_agg(r.role order by r.role) as roles
--   from auth.users u join public.profiles p on p.id = u.id
--   left join public.user_roles r on r.user_id = u.id
--  group by u.email, p.is_active order by u.email;
