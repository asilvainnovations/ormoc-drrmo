-- 1.13.0: band the maturity index before rounding it (IAT Scoring_Lookups; audit 11 Nov 2026).
--
-- The workbook bands the unrounded index: <0.5 Absent, 0.5-1.49 Initial, 1.5-2.49 Developing,
-- 2.5-3.49 Compliant, >=3.5 Advanced. v_domain_results and v_cycle_results banded the index
-- after rounding it to 2 dp, so an index of 2.495 showed "Compliant" where the workbook says
-- "Developing". The displayed index stays rounded to 2 dp; only the band changes.
-- No 2026 baseline domain sits on a boundary, so no current figure changes.
-- TypeScript mirror: summarise() in src/domain/scoring.ts (scoring.parity.test.ts).
-- Same columns, same order: safe to run again.

create or replace view public.v_domain_results with (security_invoker = true) as
select
  c.id as cycle_id, d.code as domain, d.part, d.name,
  count(i.id) as indicators,
  count(rr.response_id) filter (where rr.is_scored = 1) as scored,
  round(sum(rr.score * rr.weight) filter (where rr.is_scored = 1)::numeric
        / nullif(sum(rr.weight) filter (where rr.is_scored = 1), 0), 2) as maturity_index,
  public.maturity_band(sum(rr.score * rr.weight) filter (where rr.is_scored = 1)::numeric
        / nullif(sum(rr.weight) filter (where rr.is_scored = 1), 0)) as maturity_band,
  round(count(*) filter (where rr.is_scored = 1 and rr.type = 'M' and d.part <> 'C' and rr.score >= 3)::numeric
        / nullif(count(*) filter (where rr.is_scored = 1 and rr.type = 'M' and d.part <> 'C'), 0), 4) as mandatory_compliance,
  count(*) filter (where rr.priority = 'High') as high_gaps
from public.assessment_cycles c
cross join public.iat_domains d
join public.iat_indicators i on i.domain = d.code and i.is_active
left join public.v_response_results rr on rr.cycle_id = c.id and rr.indicator_id = i.id
group by c.id, d.code, d.part, d.name, d.sort
order by d.sort;

create or replace view public.v_cycle_results with (security_invoker = true) as
with rr as (select * from public.v_response_results where is_scored = 1),
groups(cycle_id, grp, label, sort) as (
  select c.id, g.grp, g.label, g.sort from public.assessment_cycles c
  cross join (values ('A','Part A – CDRRMO',1), ('B','Part B – EOC',2),
                     ('IMI','Institutional Maturity Index (A+B)',3),
                     ('C','Part C – Interface Index (separate)',4)) g(grp,label,sort)
)
select g.cycle_id, g.grp, g.label,
  count(rr.*) as scored,
  round(sum(rr.score * rr.weight)::numeric / nullif(sum(rr.weight), 0), 2) as maturity_index,
  public.maturity_band(sum(rr.score * rr.weight)::numeric / nullif(sum(rr.weight), 0)) as maturity_band,
  round(count(*) filter (where rr.type = 'M' and rr.part <> 'C' and rr.score >= 3)::numeric
        / nullif(count(*) filter (where rr.type = 'M' and rr.part <> 'C'), 0), 4) as mandatory_compliance,
  count(*) filter (where rr.priority = 'High') as high_gaps
from groups g
left join rr on rr.cycle_id = g.cycle_id and (
  (g.grp in ('A','B','C') and rr.part = g.grp) or (g.grp = 'IMI' and rr.part in ('A','B')))
group by g.cycle_id, g.grp, g.label, g.sort
order by g.sort;
