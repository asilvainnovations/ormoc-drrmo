-- Replace everything in Assess with the IAT v1.6 baseline (1.14.0, 11 Nov 2026).
--
-- Run in the Supabase SQL editor as the project owner, in this order:
--   1. this file, step A only (read-only): check what will be removed;
--   2. this file, step B: removes EVERY assessment cycle with its responses, evidence notes and actions;
--   3. supabase/seed/operational/01, 02, 02b and 03 (regenerated from workbook file v1-6, 11 Nov 2026).
-- Afterwards Assess shows one cycle, "2026 Baseline (IAT v1.6)": IMI 1.98, mandatory compliance 32.9%,
-- 30 high-priority gaps (Parts A and B), the same as the workbook Dashboard.
--
-- Safety: a cycle that is final or archived, or that has a validated score, cannot be deleted
-- (app.guard_cycle); the whole of step B then stops and nothing is removed. Evidence FILES attached in the
-- app stay in the "evidence" storage bucket; step A lists them so they can be re-attached.
-- Do not run supabase/seed/operational/05_*: it was an update for v1-3 databases and is removed.

-- Step A (read-only) ------------------------------------------------------------------------------------
select c.name, c.status, c.iat_version,
       (select count(*) from public.responses r where r.cycle_id = c.id)                          as responses,
       (select count(*) from public.responses r where r.cycle_id = c.id and r.status = 'validated') as validated,
       (select count(*) from public.evidence e join public.responses r on r.id = e.response_id
         where r.cycle_id = c.id and e.storage_path is not null)                                   as evidence_files
from public.assessment_cycles c order by c.created_at;

-- Step B (removes all cycles). Select from "begin" to "commit" and run. ---------------------------------
begin;
delete from public.assessment_cycles;
select count(*) as cycles_left from public.assessment_cycles;   -- must be 0
commit;
