-- MODE 1.18.0 renumber cleanup (ADR-032). Run BEFORE the 1.18 seed parts.
-- The seed upserts by deterministic id (uuid5) and never deletes. Three pre-1.18 rows would linger
-- without this: (1) the legacy 'MOO Ch.9' partnerships outline doc with its skeleton version and indicator
-- links (Chapter 8 now carries the drafted stakeholder chapter under code 'Chapter 8'); (2) the five
-- renamed financing templates WF-SOP5-03/06/08/09/10 (now WF-SOP6-*) with their steps. Everything else
-- renumbers in place by deterministic id: doc rows keep their ids with new codes, and the old Chapter 5
-- financing v1.0 version id is reused for the Recovery v1.0 text (financing is re-seeded as Chapter 6
-- v1.1; its v1.0 is superseded per the chapter's revision record).
-- Safe to run again. Ids are uuid5-derived, so they match every environment seeded from this repo.

begin;

-- 1. Steps of the renamed templates (children first).
delete from public.protocol_steps where template_id in (
  '07f102ff-c1d0-5203-924f-6bdcca90726d'::uuid,
  '233233d0-5320-5050-bbae-e7069048869e'::uuid,
  '67421122-54ae-5d9f-97f3-6eaa6c1652d7'::uuid,
  '8779a83c-c39d-5829-8f4f-77ee65426a1f'::uuid,
  'a6f9ffbc-06b0-50f5-9b7c-e7d54d8e2986'::uuid
);

-- 2. The renamed templates themselves.
delete from public.protocol_templates where id in (
  '07f102ff-c1d0-5203-924f-6bdcca90726d'::uuid,
  '233233d0-5320-5050-bbae-e7069048869e'::uuid,
  '67421122-54ae-5d9f-97f3-6eaa6c1652d7'::uuid,
  '8779a83c-c39d-5829-8f4f-77ee65426a1f'::uuid,
  'a6f9ffbc-06b0-50f5-9b7c-e7d54d8e2986'::uuid
);

-- 3. Indicator links of removed documents.
delete from public.moo_document_indicators where document_id in (
  '57e7eec1-e655-50fd-8bc4-e7b956b654fc'::uuid
);

-- 4. Version rows that 1.18 no longer generates.
delete from public.moo_versions where id in (
  'dfa35a60-bd59-5835-9d07-862e7c5b28ef'::uuid,
  -- the interim hand-authored Introduction v1.1 (superseded by the official drafting-team v1.1, new id)
  '9f632a20-6b37-5af0-92ab-aeb231bc640c'::uuid
);

-- 5. Removed documents: the four legacy shells and any doc 1.18 no longer seeds.
delete from public.moo_documents where id in (
  '57e7eec1-e655-50fd-8bc4-e7b956b654fc'::uuid
);

commit;
-- 5b. The Introduction doc row itself renumbers in place by deterministic id: code 'Chapter 0' becomes
-- 'Introduction' and chapter_no becomes NULL through the seed upsert (same doc id 91559d3e-...). The
-- v1.0 version row is regenerated with its unchanged id; only the interim v1.1 row above is deleted.
-- Expected: 29 steps, 5 templates, 41 links,
-- 2 versions, 1 documents.
