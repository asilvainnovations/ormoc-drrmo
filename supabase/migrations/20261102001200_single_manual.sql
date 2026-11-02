-- =============================================================================
-- 0012 ONE MANUAL: five Parts, ten functional areas (v1.6)
--
-- The Inception Report (Oct 2026, sec. 3.3-3.4 and Annex A) binds the CDRRMO Manual of
-- Operations and the EOC Manual into ONE Manual of Operations: ten functional areas
-- grouped in five Parts, from mandate to recovery. This migration:
--   1. adds manual_parts and manual_areas (reference data, read by active users, admin-maintained);
--   2. gives each Library document an area, a chapter number, aliases and secondary areas;
--   3. allows kind 'area' (the outline section of a functional area);
--   4. records each indicator's primary functional area (Traceability Dictionary v1.1);
--   5. fixes the Chapter 2 figure links (/library/ch2/ -> /library/chp2/) in unapproved versions;
--   6. rebuilds v_traceability so merged (superseded) sections no longer appear as homes for gaps;
--   7. lets every active user read drafts under review (they already ship in the app bundle, and offices
--      must read them before the validation workshop). Returned drafts stay with authors and the Head.
-- The old 'manual' column (MOO/EOC) stays for compatibility and is no longer shown.
-- Re-running this file is safe. See docs/adr/012-single-manual.md.
-- =============================================================================

-- ------------------------------------------------------------ reference ------
create table if not exists public.manual_parts (
  no       smallint primary key check (no between 1 and 9),
  title    text not null,
  summary  text,
  sort     smallint not null
);

create table if not exists public.manual_areas (
  no              smallint primary key check (no between 1 and 20),
  part_no         smallint not null references public.manual_parts(no),
  title           text not null,
  scope           text,
  mcr_primary     text,
  mcr_supporting  text,
  sort            smallint not null
);

alter table public.manual_parts enable row level security;
alter table public.manual_areas enable row level security;
do $$ declare t text; begin
  foreach t in array array['manual_parts','manual_areas'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.is_active_user())', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (app.has_role(''admin'')) with check (app.has_role(''admin''))', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
  end loop;
end $$;

-- OAuth apps stay read-only on the new tables too (ADR-010).
do $$ declare t text; begin
  foreach t in array array['manual_parts','manual_areas'] loop
    execute format('drop trigger if exists aa0_block_oauth_client_writes on public.%I', t);
    execute format('create trigger aa0_block_oauth_client_writes before insert or update or delete on public.%I
                    for each row execute function app.block_oauth_client_writes()', t);
  end loop;
end $$;

-- Source: Inception Report sec. 3.4 (figure "Five parts organize the ten functional areas") and Annex A.
insert into public.manual_parts (no, title, summary, sort) values
 (1, 'Legal mandate and governance', 'Mandate, structure, authorities and accountability of the CDRRMO, the CDRRMC and the EOC.', 1),
 (2, 'SOPs by alert level', 'Preparedness, EOC activation, logistics and responder safety. The core of EOC operations and the largest Part.', 2),
 (3, 'Information management and public communication', 'Risk intelligence, early warning and public information, situational awareness and GIS.', 3),
 (4, 'Continuity and infrastructure safeguards', 'Digital continuity, cybersecurity and systems resilience.', 4),
 (5, 'Recovery and continuous improvement', 'Recovery, learning, performance and manual revision.', 5)
on conflict (no) do update set title = excluded.title, summary = excluded.summary, sort = excluded.sort;

insert into public.manual_areas (no, part_no, title, scope, mcr_primary, mcr_supporting, sort) values
 (1, 1, 'Governance, Organization & Institutional Arrangements',
  'CDRRMO/EOC mandate; organizational structure; LDRRMC relationships; authorities; delegation; duty officers; ICS roles; inter-agency coordination; public-private partnerships; accountability',
  'Essential 1 – Organize for Disaster Resilience', 'Essentials 6, 7, 9', 1),
 (2, 3, 'Risk Intelligence, Prevention & Mitigation',
  'Multi-hazard risk assessment; hazard/exposure/vulnerability analysis; climate risk; risk scenarios; GIS-based risk information; prevention and mitigation measures; risk-informed development planning',
  'Essential 2 – Identify, Understand and Use Current and Future Risk Scenarios', 'Essentials 4, 5, 8', 6),
 (3, 2, 'Preparedness, Planning & Capacity Development',
  'Emergency plans; contingency plans; SOPs; preparedness standards; training; drills; simulations; competency requirements; EOC readiness; BDRRMC capacity; mutual-aid arrangements',
  'Essential 6 – Strengthen Institutional Capacity for Resilience', 'Essentials 1, 7, 9', 2),
 (4, 2, 'EOC Activation, Incident Management & Coordination',
  'Alert levels; activation/deactivation; ICS integration; incident objectives; command and coordination; operational periods; EOC staffing; escalation; transition from response to recovery',
  'Essential 9 – Ensure Effective Disaster Response', 'Essentials 1, 6, 10', 3),
 (5, 3, 'Early Warning, Emergency Communications & Public Information',
  'Monitoring; detection; warning thresholds; multi-channel dissemination; public information; risk communication; accessible alerts; community feedback; rumor management; warning verification',
  'Essential 9 – Ensure Effective Disaster Response', 'Essentials 2, 7, 6', 7),
 (6, 3, 'Situational Awareness, Information Management & GIS',
  'Data collection; validation; common operating picture; GIS; dashboards; incident reports; SITREPs; data standards; information-sharing; decision support; risk intelligence',
  'Essential 2 – Identify, Understand and Use Current and Future Risk Scenarios', 'Essentials 6, 9, 8', 8),
 (7, 2, 'Resource, Logistics & Emergency Support Management',
  'Resource inventory; resource requests; procurement; stockpiling; staging; transport; warehousing; fuel; relief supplies; mutual aid; supplier networks; emergency support services',
  'Essential 9 – Ensure Effective Disaster Response', 'Essentials 3, 8, 6', 4),
 (8, 2, 'Responder Safety, Welfare & Inclusive Emergency Operations',
  'Duty of care; PPE; responder health and safety; psychosocial support; fatigue management; workforce rotation; gender/inclusion considerations; protection of vulnerable groups; safe operating procedures',
  'Essential 9 – Ensure Effective Disaster Response', 'Essentials 6, 7, 8', 5),
 (9, 4, 'Digital Continuity, Cybersecurity & Systems Resilience',
  'Critical information systems; cybersecurity; data protection; backups; cloud redundancy; alternate communications; power continuity; disaster recovery; system interoperability; continuity of operations',
  'Essential 8 – Increase Infrastructure Resilience', 'Essentials 6, 9, 4', 9),
 (10, 5, 'Recovery, Learning, Performance & Continuous Improvement',
  'Recovery transition; damage/loss assessment; debris management; rehabilitation/reconstruction; Build Back Better; economic recovery; AARs; M&E; audits; exercises; lessons learned; manual revision',
  'Essential 10 – Expedite Recovery and Build Back Better', 'Essentials 3, 6, 7, 8, 9', 10)
on conflict (no) do update set part_no = excluded.part_no, title = excluded.title, scope = excluded.scope,
  mcr_primary = excluded.mcr_primary, mcr_supporting = excluded.mcr_supporting, sort = excluded.sort;

-- ------------------------------------------------------- library documents ---
alter table public.moo_documents add column if not exists area_no smallint references public.manual_areas(no);
alter table public.moo_documents add column if not exists chapter_no smallint;
alter table public.moo_documents add column if not exists aliases text[] not null default '{}';
alter table public.moo_documents add column if not exists also_areas smallint[] not null default '{}';
create index if not exists moo_documents_aliases_idx on public.moo_documents using gin (aliases);
create index if not exists moo_documents_area_idx on public.moo_documents (area_no);

alter table public.moo_documents drop constraint if exists moo_documents_kind_check;
alter table public.moo_documents add constraint moo_documents_kind_check
  check (kind in ('chapter','sop','form','annex','area'));

comment on column public.moo_documents.manual is
  'Legacy (v1.0-1.5): MOO or EOC. Since v1.6 there is one manual; use area_no and the Part of that area.';
comment on column public.moo_documents.aliases is
  'Earlier codes of this document or of sections merged into it (e.g. ''EOC Ch.2''), so old links and IAT routing still resolve.';
comment on column public.moo_documents.also_areas is 'Other functional areas this document also serves.';

-- ------------------------------------------------------------ indicators -----
alter table public.iat_indicators add column if not exists functional_area smallint references public.manual_areas(no);
comment on column public.iat_indicators.functional_area is
  'Primary functional area (Traceability Dictionary v1.1, column "Primary Functional Area"). Gaps route to this area of the manual.';

-- --------------------------------------------- Chapter 2 figure links -------
-- The figures live in public/library/chp2/. Approved versions are never edited (guard_moo_version).
update public.moo_versions
   set body_md = replace(body_md, '/library/ch2/', '/library/chp2/')
 where body_md like '%/library/ch2/%' and status <> 'approved';

-- ------------------------------------------------------- draft reading -----
drop policy if exists moo_versions_read on public.moo_versions;
create policy moo_versions_read on public.moo_versions for select to authenticated
  using (app.is_active_user() and (status in ('approved','draft','in_review')
         or app.has_any_role(array['author','cdrrmo_head','validator']::public.app_role[])));

-- -------------------------------------------------------- traceability -------
-- Same columns as before plus functional_area at the end; merged sections are left out.
create or replace view public.v_traceability with (security_invoker = true) as
select
  i.id as indicator_id, i.domain, d.part, i.statement, i.type, i.weight, i.moo_chapter, i.tags,
  coalesce((select array_agg(ir.mr_id order by ir.mr_id) from public.indicator_requirements ir where ir.indicator_id = i.id), '{}') as requirements,
  coalesce((select jsonb_agg(jsonb_build_object('id', md.id, 'code', md.code, 'title', md.title, 'status', md.status) order by md.sort)
            from public.moo_document_indicators mdi join public.moo_documents md on md.id = mdi.document_id
            where mdi.indicator_id = i.id and md.status <> 'superseded'), '[]'::jsonb) as documents,
  i.functional_area
from public.iat_indicators i join public.iat_domains d on d.code = i.domain
where i.is_active;
grant select on public.v_traceability to authenticated;
