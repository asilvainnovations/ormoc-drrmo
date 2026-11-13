-- =============================================================================
-- 1.19.0 (13 Nov 2026) - Interactive RACI board (ADR-033).
--
-- MOO Annex 1-F (Integrated RACI Accountability Framework) assigns Responsible / Accountable /
-- Consulted / Informed for every governance and operational activity, and every workflow, process
-- flow and SOP in Chapters 1-10 carries the same mapping. This migration stores those matrices so
-- the platform can show, search and maintain them:
--   raci_matrices     the five Annex 1-F matrices (6.1-6.5) plus the document-governance matrix
--   raci_activities   one row per activity, optionally linked to the protocol/workflow that carries it out
--   raci_assignments  one row per (activity, actor, duty); actors are positions or bodies, never
--                     personal names (RA 10173), consistent with the Manual
--
-- Rules: Annex 1-F says there should NORMALLY be one Accountable per activity, and its own cells
-- carry shared "A/R within mandate" entries, so one-A is a board warning, not a hard constraint.
-- The RACI matrix does not create legal authority (Annex 1-F); the board carries that caveat.
-- Reads are reference data and stay offline; changing an assignment is an authority action
-- (ADR-006): only the CDRRMO Head or admin writes, and the client sends those edits online only.
--
-- Supports MR-01 (actionable MOO), MR-14 (traceability). Indicators A1.4, B7.1.
-- Safe to run again.
-- =============================================================================

create table if not exists public.raci_matrices (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(code) <= 20),
  title       text not null check (length(title) <= 200),
  source_ref  text not null default 'MOO Annex 1-F' check (length(source_ref) <= 200),
  sort        integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1
);
comment on table public.raci_matrices is 'RACI matrices from MOO Annex 1-F (6.1-6.5) plus the manual document-governance matrix (ADR-033).';
select app.track('public.raci_matrices');

create table if not exists public.raci_activities (
  id           uuid primary key default gen_random_uuid(),
  matrix_id    uuid not null references public.raci_matrices(id),
  activity     text not null check (length(trim(activity)) between 3 and 300),
  note         text check (note is null or length(note) <= 500),
  template_id  uuid references public.protocol_templates(id),
  sop_ref      text check (sop_ref is null or length(sop_ref) <= 120),
  sort         integer not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1
);
create index if not exists raci_activities_matrix_idx on public.raci_activities (matrix_id, sort);
create index if not exists raci_activities_template_idx on public.raci_activities (template_id) where template_id is not null;
comment on column public.raci_activities.template_id is 'The protocol or workflow that carries out this activity, when one exists in the DRRM module.';
comment on column public.raci_activities.note is 'Legal caveat carried from the Manual, e.g. "authority as prescribed by law". Shown verbatim.';
select app.track('public.raci_activities');

create table if not exists public.raci_assignments (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.raci_activities(id) on delete cascade,
  actor        text not null check (length(trim(actor)) between 2 and 120),
  duty         text not null check (duty in ('R','A','C','I')),
  qualifier    text check (qualifier is null or length(qualifier) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  unique (activity_id, actor, duty)
);
create index if not exists raci_assignments_activity_idx on public.raci_assignments (activity_id);
comment on column public.raci_assignments.actor is 'Position, office or body (e.g. "EOC Manager / team", "SP"). Never a personal name (RA 10173).';
comment on column public.raci_assignments.qualifier is 'Scope note from the Manual cell, e.g. "documentation", "within mandate", "executive coordination".';
select app.track('public.raci_assignments');

-- Reads: any active user. Writes: the CDRRMO Head (or admin) only, online (ADR-006).
alter table public.raci_matrices enable row level security;
drop policy if exists raci_matrices_read on public.raci_matrices;
drop policy if exists raci_matrices_insert on public.raci_matrices;
drop policy if exists raci_matrices_update on public.raci_matrices;
drop policy if exists raci_matrices_delete on public.raci_matrices;
create policy raci_matrices_read on public.raci_matrices for select to authenticated using (app.is_active_user());
create policy raci_matrices_insert on public.raci_matrices for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy raci_matrices_update on public.raci_matrices for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy raci_matrices_delete on public.raci_matrices for delete to authenticated
  using (app.has_role('admin'));
grant select on public.raci_matrices to authenticated;
grant insert, update, delete on public.raci_matrices to authenticated;

alter table public.raci_activities enable row level security;
drop policy if exists raci_activities_read on public.raci_activities;
drop policy if exists raci_activities_insert on public.raci_activities;
drop policy if exists raci_activities_update on public.raci_activities;
drop policy if exists raci_activities_delete on public.raci_activities;
create policy raci_activities_read on public.raci_activities for select to authenticated using (app.is_active_user());
create policy raci_activities_insert on public.raci_activities for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy raci_activities_update on public.raci_activities for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy raci_activities_delete on public.raci_activities for delete to authenticated
  using (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
grant select on public.raci_activities to authenticated;
grant insert, update, delete on public.raci_activities to authenticated;

alter table public.raci_assignments enable row level security;
drop policy if exists raci_assignments_read on public.raci_assignments;
drop policy if exists raci_assignments_insert on public.raci_assignments;
drop policy if exists raci_assignments_update on public.raci_assignments;
drop policy if exists raci_assignments_delete on public.raci_assignments;
create policy raci_assignments_read on public.raci_assignments for select to authenticated using (app.is_active_user());
create policy raci_assignments_insert on public.raci_assignments for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy raci_assignments_update on public.raci_assignments for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
create policy raci_assignments_delete on public.raci_assignments for delete to authenticated
  using (app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]));
grant select on public.raci_assignments to authenticated;
grant insert, update, delete on public.raci_assignments to authenticated;

-- Board view: one denormalized row set for the RACI screen and the protocol/library links.
drop view if exists public.v_raci_board;
create view public.v_raci_board with (security_invoker = true) as
select a.id as activity_id, a.activity, a.note, a.sort as activity_sort,
       m.id as matrix_id, m.code as matrix_code, m.title as matrix_title, m.sort as matrix_sort,
       t.id as template_id, t.code as template_code, t.title as template_title, t.kind as template_kind, t.status as template_status,
       s.id as assignment_id, s.actor, s.duty, s.qualifier
  from public.raci_activities a
  join public.raci_matrices m on m.id = a.matrix_id
  left join public.protocol_templates t on t.id = a.template_id
  left join public.raci_assignments s on s.activity_id = a.id
 order by m.sort, a.sort;
grant select on public.v_raci_board to authenticated;
