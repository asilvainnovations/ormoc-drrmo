-- =============================================================================
-- 0001 CORE: offices, people, roles, audit trail, row versioning
-- Ormoc City CDRRMO & EOC Operations Platform
-- =============================================================================
create extension if not exists pgcrypto;

create schema if not exists app;          -- internal helpers, not exposed by the API
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Roles. A person can hold several. Authority actions (EOC level, declarations,
-- validation) are checked against these in RPCs and RLS policies.
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'admin',              -- system administrator (City IT / CDRRMO)
  'cdrrmo_head',        -- CDRRMO Head; approves, declares on behalf of the CDRRMC chair
  'assessor',           -- IAT assessment team
  'validator',          -- CDRRMO management validating IAT scores
  'eoc_manager',        -- EOC Manager; changes activation level
  'eoc_staff',          -- EOC section staff
  'duty_officer',       -- 24/7 operations centre duty officer
  'lead_office_focal',  -- Part C interface office focal person
  'author',             -- MOO/SOP author (consultant, technical writer, CDRRMO divisions)
  'viewer'              -- read-only (CDRRMC members, oversight)
);

create table public.offices (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  kind        text not null default 'city_office'
              check (kind in ('cdrrmo','city_office','national_agency','utility','private','cso','barangay','other')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1
);
comment on table public.offices is 'City offices, agencies and partners. Part C lead offices are rows here.';

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  position    text,
  office_id   uuid references public.offices(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1
);
comment on table public.profiles is 'Staff profile. Holds no personal data beyond name, position and office (RA 10173 data minimisation).';

create table public.user_roles (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.app_role not null,
  granted_by  uuid references public.profiles(id),
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);

-- -----------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can call them without recursion.
-- -----------------------------------------------------------------------------
create or replace function app.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.is_active
    where ur.user_id = auth.uid() and (ur.role = r or ur.role = 'admin')
  )
$$;

create or replace function app.has_any_role(rs public.app_role[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.is_active
    where ur.user_id = auth.uid() and (ur.role = any(rs) or ur.role = 'admin')
  )
$$;

create or replace function app.is_active_user() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active)
$$;

create or replace function app.my_office() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select office_id from public.profiles where id = auth.uid()
$$;

grant execute on function app.has_role(public.app_role), app.has_any_role(public.app_role[]),
  app.is_active_user(), app.my_office() to authenticated;

-- Roles of the signed-in user, for the client to shape its UI (the server still enforces).
create or replace function public.my_roles() returns setof public.app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.user_roles where user_id = auth.uid()
$$;
grant execute on function public.my_roles() to authenticated;

-- -----------------------------------------------------------------------------
-- Row versioning: updated_at + optimistic concurrency for offline sync.
-- A client update must carry the version it last saw; a stale version is a
-- conflict (SQLSTATE PT409: PostgREST answers HTTP 409. Not 40001, which PostgREST retries as a serialization failure, so the request would never return) and the client keeps the server copy.
-- -----------------------------------------------------------------------------
create or replace function app.touch_row() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.updated_at := now();
  else
    if new.version is distinct from old.version then
      raise exception 'Version conflict on %.%: you edited version %, the server has version %',
        tg_table_schema, tg_table_name, new.version, old.version
        using errcode = 'PT409', hint = 'Reload the record and apply your change again.';
    end if;
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Audit trail (MR-15). Append-only; readable by admin and CDRRMO Head.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid default auth.uid(),
  table_name  text not null,
  row_id      text,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_row     jsonb,
  new_row     jsonb
);
create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index audit_log_at_idx on public.audit_log (at desc);

create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  insert into public.audit_log (table_name, row_id, action, old_row, new_row)
  values (tg_table_name, coalesce(v_new->>'id', v_old->>'id'), tg_op, v_old, v_new);
  return coalesce(new, old);
end $$;

-- Helper to attach both triggers to a table in later migrations.
create or replace function app.track(tbl regclass, audited boolean default true) returns void
language plpgsql as $$
begin
  execute format('create trigger touch_row before insert or update on %s for each row execute function app.touch_row()', tbl);
  if audited then
    execute format('create trigger audit_row after insert or update or delete on %s for each row execute function app.audit()', tbl);
  end if;
end $$;

select app.track('public.offices');
select app.track('public.profiles');

create trigger audit_row after insert or update or delete on public.user_roles
  for each row execute function app.audit();

-- New auth users get an empty, inactive-by-role profile; an admin grants roles.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.offices    enable row level security;
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log  enable row level security;

create policy offices_read  on public.offices for select to authenticated using (app.is_active_user());
create policy offices_write on public.offices for all to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));

create policy profiles_read on public.profiles for select to authenticated using (app.is_active_user() or id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for all to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));

create policy roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]));
create policy roles_admin on public.user_roles for all to authenticated
  using (app.has_role('admin')) with check (app.has_role('admin'));

create policy audit_read on public.audit_log for select to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]));
-- no insert/update/delete policies: only the SECURITY DEFINER trigger writes.

-- A profile cannot promote itself: block self-edits of office/active flag.
create or replace function app.guard_profile_self_edit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() = new.id and not app.has_role('admin') then
    if new.is_active is distinct from old.is_active or new.office_id is distinct from old.office_id then
      raise exception 'Only an administrator can change office or active status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_profile_self_edit before update on public.profiles
  for each row execute function app.guard_profile_self_edit();

grant select, insert, update, delete on public.offices, public.profiles, public.user_roles to authenticated;
grant select on public.audit_log to authenticated;
