-- 1.31.0: protocol categories for Manual Chapters 9 and 10 (Consolidated Draft 1.0, 12 Nov 2026).
--   capacity        Chapter 9: training, exercises, public awareness, BDRRMC support, volunteers, evacuation centres
--   sustainability  Chapter 10: sustainability review, succession, recognition, innovation, stewardship
-- Chapter 10 SOPs 10-03 and 10-04 use the existing 'continuity' category. Both new categories sit under
-- Disaster Preparedness (src/features/protocols/labels.ts). Safe to run again.
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
  'learning','partnerships','capacity','sustainability'));
