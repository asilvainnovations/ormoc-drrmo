-- IAT B2.7 (alternate EOC): scored N/A, not 0. 18 Nov 2026.
-- NDRRMC Memorandum No. 131, s. 2018, Sec. 9.1.6: back-up or alternate EOCs "may be established, as needed", based on
-- contingency plans or the PSCP. The text is permissive, so a missing alternate EOC is the City's choice, not a gap.
-- The City has decided not to designate one for now. Run in the Supabase SQL editor as the project owner. Safe to run again.
-- It changes nothing that is validated, and nothing an assessor already changed (it only acts while B2.7 is still not N/A).
begin;

update public.responses r set
  score = null,
  is_na = true,
  na_justification = 'NDRRMC Memo 131, s. 2018, Sec. 9.1.6 says back-up or alternate EOCs "may be established, as needed", based on contingency plans or the PSCP; it is not required. The City has chosen not to force an alternate EOC for now; no designation record was obtained. Review this when the PSCP (A3.4) is completed or after a drill or activation shows the need.',
  gap_remarks = '[18 Nov 2026: score 0 -> N/A. Memo 131 s.2018 Sec. 9.1.6 is permissive ("may be established, as needed"); the City has decided not to designate an alternate EOC for now. Not a gap.] No alternate EOC designation record was obtained; this does not mean non-compliance. Revisit when the PSCP is completed.',
  recommended_action = 'Optional. If the PSCP shows the need: designate an alternate EOC outside the primary site''s hazard zones, equip it with a go-kit (radios, laptops, forms, power), and write relocation triggers and steps.'
where r.indicator_id = 'B2.7'
  and r.cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3'::uuid
  and r.status <> 'validated'
  and not r.is_na;

update public.actions a set
  action = 'Optional, not scheduled: designate an alternate EOC only if the PSCP or a drill shows the need (NDRRMC Memo 131, s. 2018, Sec. 9.1.6: "may be established, as needed"). Decided by the City on 18 Nov 2026.',
  status = 'dropped'
where a.indicator_id = 'B2.7'
  and a.cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3'::uuid
  and a.status = 'not_started';

commit;

-- Check: expect is_na true, score null, one action 'dropped'.
select r.is_na, r.score, (select a.status from public.actions a where a.indicator_id = 'B2.7' and a.cycle_id = r.cycle_id limit 1) as action_status
from public.responses r where r.indicator_id = 'B2.7' and r.cycle_id = '8911a053-1b14-587f-b906-c0fb2adaf7f3'::uuid;
