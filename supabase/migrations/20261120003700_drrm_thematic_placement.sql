-- =============================================================================
-- 1.29.0 (ADR-046): DRRM thematic placement of workflows, protocols and forms.
--
-- Adds two management-cycle categories so the Chapter 7 and Chapter 8 workflows stop sharing "governance":
--   learning      Monitoring, Evaluation and Learning (MOO Ch.7: SOPs 7-01, 7-04, 7-05, 7-07, 7-08, 7-09)
--   partnerships  Partnerships and Mutual Aid (MOO Ch.8: SOPs 8-01, 8-02, 8-04, 8-07, 8-08)
-- and fixes the kind of two templates whose code prefix misled the category rule:
--   PR-AAR            SOP 7-04 after-action review: a point-of-action protocol (now in 'learning')
--   WF-REC-FRAMEWORK  SOP 5-01 pre-disaster recovery framework: an annual management cycle (workflow)
--
-- The thematic area of each category is set in the app (src/features/protocols/labels.ts), following NDRRMP
-- 2020-2030 Pillar 3 "Disaster Response and Early Recovery" (Outcomes 13-15) and Table 9 of the Ormoc City DRRM
-- 10-Year Plan 2023-2032. The 19 Manual forms that Chapters 5-8 steps already named arrive with the reference
-- data (supabase/seed/parts/35_seed.sql); run scripts/load_reference_data.sh after this migration.
--
-- Templates already approved keep their category and kind: the guard fixes approved text, and the CDRRMO Head
-- reopens a template to revise it. Seeded templates are drafts, so the update below applies to them.
-- Supports MR-01 (actionable MOO), MR-14 (traceability). Safe to run again.
-- =============================================================================

do $$ declare c text; begin
  for c in select conname from pg_constraint
            where conrelid = 'public.protocol_templates'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%daily_operations%' loop
    execute format('alter table public.protocol_templates drop constraint %I', c);
  end loop;
end $$;
alter table public.protocol_templates add constraint protocol_templates_category_check check (category in (
  'daily_operations','warning','eoc','anticipatory_action','council','reporting','recovery',
  'governance','workforce','budget','response_clusters','geospatial',
  'risk_information','risk_planning','contingency_planning','continuity',
  'learning','partnerships'));

update public.protocol_templates set category = 'learning'
 where code in ('WF-SOP7-01','PR-AAR','WF-SOP7-05','WF-SOP7-07','WF-SOP7-08','WF-SOP7-09')
   and status = 'draft' and category <> 'learning';
update public.protocol_templates set category = 'partnerships'
 where code in ('WF-SOP8-01','WF-SOP8-02','WF-SOP8-04','WF-SOP8-07','WF-SOP8-08')
   and status = 'draft' and category <> 'partnerships';
update public.protocol_templates set kind = 'protocol' where code = 'PR-AAR' and status = 'draft' and kind <> 'protocol';
update public.protocol_templates set kind = 'workflow' where code = 'WF-REC-FRAMEWORK' and status = 'draft' and kind <> 'workflow';

-- BUD-F01 and BUD-F02 carry Chapter 6 FIN-F02 and FIN-F03 (SOPs 6-01, 6-02); their source was still Chapter 2.
update public.form_templates f
   set document_id = d.id
  from public.moo_documents d
 where f.code in ('BUD-F01','BUD-F02') and d.code = 'Chapter 6' and f.document_id is distinct from d.id;

comment on column public.protocol_templates.category is
  'Group within a DRRM thematic area (app labels.ts, ADR-046). learning = MOO Ch.7; partnerships = MOO Ch.8.';
