// RA 12287 and IRR (signed 14 Sep 2026) rules. Mirrors supabase/migrations/20261015000500_anticipatory_action.sql
// as amended by 20261111002500_ra12287_alignment.sql. Parameters come from the aa_rules table so they follow the
// server when the NDRRMC operational guidelines or the DBM–COA guidelines change them.
import type { AaDisbursement, AaFamily, AaFundYear, Declaration, DeclarationStatus, ImpactClass, PdraDecision } from '@/types';

export interface AaParams {
  aa_share_of_ldrrmf_70: number; tranche_beyond_max: number; tranche_within_max: number;
  /** IRR Rule V Sec. 2: "beyond a lead time of three (3) days". */
  lead_threshold_days: number;
  /** RA 12287 Sec. 6(b); IRR Rule II Sec. 3: a lead time of three (3) days... */
  min_declaration_lead_days: number;
  /** ...which may be extended to five (5) days (RA 12287 Sec. 6(b)). */
  extended_declaration_lead_days: number;
  rdrrmc_reply_hours: number; report_days: number;
}
export const DEFAULT_AA_PARAMS: AaParams = {
  aa_share_of_ldrrmf_70: 0.1, tranche_beyond_max: 0.3, tranche_within_max: 0.7,
  lead_threshold_days: 3, min_declaration_lead_days: 3, extended_declaration_lead_days: 5, rdrrmc_reply_hours: 24, report_days: 45,
};

/** "three (3) days", as the law writes it. Same as public.aa_days_text in SQL. */
export const daysText = (n: number) => (n === 3 ? 'three (3) days' : n === 5 ? 'five (5) days' : `${n} days`);
/** Days shown without rounding up past a threshold (2.96 days shows as 2.9), as the server shows them. */
export const floorDays = (hours: number) => Math.floor((hours / 24) * 10) / 10;
/** Graduated disbursement covers hydromet and geological hazards (IRR Rule V Sec. 2). An unknown family is graduated. */
export const isGraduated = (family: AaFamily | null | undefined) => family == null || family === 'hydromet' || family === 'geological';

const HOUR = 3_600_000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

export const hoursBetween = (fromIso: string | Date, toIso: string | Date) =>
  r1((new Date(toIso).getTime() - new Date(fromIso).getTime()) / HOUR);
/** Unrounded hours: legal thresholds compare this value, exactly as the server does. */
export const rawHoursBetween = (fromIso: string | Date, toIso: string | Date) =>
  (new Date(toIso).getTime() - new Date(fromIso).getTime()) / HOUR;
/** Hours left, shown without ever rounding up past a threshold (71.96 h shows as 71.9). */
export const floorHours = (h: number) => Math.floor(h * 10) / 10;

/** Maximum AA allocation: 10% of the 70% LDRRMF. */
export const aaCap = (ldrrmfTotal: number, p = DEFAULT_AA_PARAMS) => r2(ldrrmfTotal * 0.7 * p.aa_share_of_ldrrmf_70);

export function pdraDecisionProblem(input: { impact_class: ImpactClass; decision: PdraDecision; expected_impact_at: string; conducted_at: string; decision_basis?: string | null }, p = DEFAULT_AA_PARAMS): string | null {
  if (input.decision !== 'request_declaration') return null;
  if (input.impact_class !== 'severe') return 'A State of Imminent Disaster needs impacts classified as severe. Choose city early action instead.';
  const lead = rawHoursBetween(input.conducted_at, input.expected_impact_at);
  if (lead < p.min_declaration_lead_days * 24) {
    return `Only ${floorDays(lead)} days of lead time remain at the PDRA; a declaration needs a lead time of at least ${daysText(p.min_declaration_lead_days)} (RA 12287 Sec. 6(b)). Use city early action under the LGU's own authority.`;
  }
  if (!input.decision_basis?.trim()) return 'Record the basis for requesting a declaration.';
  return null;
}

/** Not a refusal: a lead time beyond the five-day extension is flagged so the PDRA records why the City acts early. */
export function pdraLeadNote(leadHours: number, p = DEFAULT_AA_PARAMS): string | null {
  if (leadHours <= p.extended_declaration_lead_days * 24) return null;
  return `More than ${daysText(p.extended_declaration_lead_days)} before the expected impact. RA 12287 Sec. 6(b) sets a lead time of ${daysText(p.min_declaration_lead_days)}, which may be extended to ${daysText(p.extended_declaration_lead_days)}: record in the basis why the City acts this early, or repeat the PDRA nearer the impact.`;
}

const leadRefusal = (hoursLeft: number, p: AaParams, atDeclaration: boolean) => atDeclaration
  ? `Only ${floorDays(hoursLeft)} days remain before the expected impact; the declaration shall not go below a lead time of ${daysText(p.min_declaration_lead_days)} (RA 12287 Sec. 6(b); IRR Rule II Sec. 3). Use city early action under the LGU's own authority.`
  : `Only ${floorDays(hoursLeft)} days of lead time remain; a declaration needs a lead time of at least ${daysText(p.min_declaration_lead_days)} (RA 12287 Sec. 6(b)). Use city early action under the LGU's own authority.`;

export const DECLARATION_NEXT: Record<DeclarationStatus, DeclarationStatus[]> = {
  draft: ['requested', 'declared', 'withdrawn'],
  requested: ['recommended', 'not_recommended', 'withdrawn'],
  recommended: ['declared', 'withdrawn'],
  not_recommended: ['withdrawn'],
  declared: ['lifted'],
  lifted: [],
  withdrawn: [],
};

/** Validate and stamp a declaration status change. Returns the patch, or throws with a reason. */
export function advanceDeclaration(d: Declaration, to: DeclarationStatus, input: Partial<Declaration>, now = new Date(), p = DEFAULT_AA_PARAMS): Partial<Declaration> {
  if (!DECLARATION_NEXT[d.status].includes(to)) throw new Error(`A ${d.status} declaration cannot move to ${to}.`);
  const patch: Partial<Declaration> = { ...input, status: to };
  const iso = now.toISOString();
  switch (to) {
    case 'requested':
      if (d.origin !== 'city_request') throw new Error('Adopted declarations are not requested from the RDRRMC.');
      if (!d.pdra_id) throw new Error('A City request needs a PDRA that found severe impacts and decided to request a declaration.');
      {
        const left = rawHoursBetween(now, d.expected_impact_at);
        if (left < p.min_declaration_lead_days * 24) throw new Error(leadRefusal(left, p, false));
      }
      patch.requested_at = iso;
      patch.rdrrmc_due_at = new Date(now.getTime() + p.rdrrmc_reply_hours * HOUR).toISOString();
      break;
    case 'recommended':
    case 'not_recommended':
      if (!input.rdrrmc_reference?.trim()) throw new Error('Record the RDRRMC recommendation reference.');
      patch.rdrrmc_responded_at = iso;
      break;
    case 'declared':
      if (d.origin === 'city_request' && d.status !== 'recommended') throw new Error('The Mayor declares upon the RDRRMC recommendation (RA 12287 Sec. 5).');
      if (d.origin === 'city_request' && !input.eo_number?.trim()) throw new Error('Record the Executive Order number.');
      if (d.origin === 'city_request') {
        // The RDRRMC may take up to 24 hours: the minimum is checked again when the Mayor declares (IRR Rule II Sec. 3).
        const left = rawHoursBetween(now, d.expected_impact_at);
        if (left < p.min_declaration_lead_days * 24) throw new Error(leadRefusal(left, p, true));
      }
      patch.declared_at = iso;
      break;
    case 'lifted': {
      if (!input.lifting_ground) throw new Error('Record the ground for lifting.');
      let lifted: Date;
      if (input.lifting_ground === 'hazard_occurred') {
        // RA 12287 Sec. 7: lifted automatically upon the occurrence of the hazard.
        if (!input.hazard_occurred_at) throw new Error('Record when the hazard occurred: the declaration is lifted automatically at that time (RA 12287 Sec. 7).');
        lifted = new Date(input.hazard_occurred_at);
        const from = d.declared_at ? new Date(d.declared_at) : null;
        if ((from && lifted < from) || lifted.getTime() > now.getTime() + 5 * 60_000) throw new Error('The hazard occurrence time must fall between the declaration and now.');
        if (!input.lifting_basis?.trim()) throw new Error('Record the evidence of occurrence: advisory, incident report, situational report or damage assessment (IRR Rule II Sec. 6(a)).');
        patch.hazard_occurred_at = lifted.toISOString();
      } else {
        if (!input.lifting_reference?.trim()) throw new Error('Record the RDRRMC recommendation and the lifting issuance (RA 12287 Sec. 7; IRR Rule III Sec. 4).');
        lifted = now;
        patch.hazard_occurred_at = null;
      }
      patch.lifted_at = lifted.toISOString();
      patch.report_due_at = new Date(lifted.getTime() + p.report_days * 24 * HOUR).toISOString();
      break;
    }
    default:
      break;
  }
  return patch;
}

export type Tranche = 'beyond_threshold' | 'within_threshold';
/** Lead in hours (1 dp, as the server stores lead_hours) and the tranche; null tranche for ungraduated hazards. */
export function trancheOf(expectedImpactAt: string, interventionAt: string, p = DEFAULT_AA_PARAMS, family?: AaFamily | null): { lead: number; tranche: Tranche | null } {
  const lead = hoursBetween(interventionAt, expectedImpactAt);
  if (!isGraduated(family)) return { lead, tranche: null };
  return { lead, tranche: lead > p.lead_threshold_days * 24 ? 'beyond_threshold' : 'within_threshold' };
}

export interface FundStatus { cap: number; allocation: number; beyondLimit: number; withinLimit: number; beyondUsed: number; withinUsed: number; ungraduatedUsed: number; otherUsed: number }
export function fundStatus(year: AaFundYear, disbursements: AaDisbursement[], p = DEFAULT_AA_PARAMS): FundStatus {
  const mine = disbursements.filter((d) => d.fiscal_year === year.fiscal_year);
  const sum = (f: (d: AaDisbursement) => boolean) => r2(mine.filter(f).reduce((s, d) => s + Number(d.amount), 0));
  return {
    cap: aaCap(year.ldrrmf_total, p), allocation: year.aa_allocation,
    beyondLimit: r2(year.aa_allocation * p.tranche_beyond_max), withinLimit: r2(year.aa_allocation * p.tranche_within_max),
    beyondUsed: sum((d) => d.source === 'ldrrmf_aa' && d.tranche === 'beyond_threshold'),
    withinUsed: sum((d) => d.source === 'ldrrmf_aa' && d.tranche === 'within_threshold'),
    ungraduatedUsed: sum((d) => d.source === 'ldrrmf_aa' && d.tranche == null),
    otherUsed: sum((d) => d.source !== 'ldrrmf_aa'),
  };
}

/** Why a disbursement is refused, or null. Graduation applies to the LDRRMF AA allocation only, and only for
 *  hydromet and geological hazards (IRR Rule V Sec. 2); LDRRMF disbursements never exceed the year's allocation. */
export function disbursementProblem(
  d: Pick<AaDisbursement, 'source' | 'amount' | 'intervention_at' | 'fiscal_year'>, decl: Declaration,
  year: AaFundYear | undefined, existing: AaDisbursement[], p = DEFAULT_AA_PARAMS, family?: AaFamily | null,
): string | null {
  if (decl.status !== 'declared') return `Funds are released only while a State of Imminent Disaster is in force (status is ${decl.status}).`;
  if (!(d.amount > 0)) return 'Enter an amount above zero.';
  const { lead, tranche } = trancheOf(decl.expected_impact_at, d.intervention_at, p, family);
  if (lead < 0) return 'The intervention date is after the expected impact; record it as response, not anticipatory action.';
  if (d.source !== 'ldrrmf_aa') return null;
  if (!year) return `Set the AA allocation for ${d.fiscal_year} before recording LDRRMF disbursements.`;
  const st = fundStatus(year, existing, p);
  if (tranche) {
    const used = tranche === 'beyond_threshold' ? st.beyondUsed : st.withinUsed;
    const limit = tranche === 'beyond_threshold' ? st.beyondLimit : st.withinLimit;
    if (used + d.amount > limit + 1e-9) {
      return `This would bring disbursements ${tranche === 'beyond_threshold' ? 'beyond' : 'within'} a lead time of three (3) days to ₱${fmtPeso(used + d.amount)}, above the ₱${fmtPeso(limit)} limit (IRR Rule V Sec. 2).`;
    }
  }
  const total = st.beyondUsed + st.withinUsed + st.ungraduatedUsed;
  if (total + d.amount > year.aa_allocation + 1e-9) {
    return `This would bring LDRRMF anticipatory action disbursements to ₱${fmtPeso(total + d.amount)}, above the year's allocation of ₱${fmtPeso(year.aa_allocation)} (IRR Rule V Sec. 1(b)).`;
  }
  return null;
}

export const fmtPeso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface Deadline { label: string; due: string; overdue: boolean; hoursLeft: number }
/** The clock that matters for this declaration right now. */
export function nextDeadline(d: Declaration, now = new Date()): Deadline | null {
  const mk = (label: string, due: string | null): Deadline | null =>
    due ? { label, due, hoursLeft: hoursBetween(now, due), overdue: new Date(due) < now } : null;
  if (d.status === 'requested') return mk('RDRRMC recommendation due', d.rdrrmc_due_at);
  if (d.status === 'recommended' || d.status === 'declared') return mk('Expected impact', d.expected_impact_at);
  if (d.status === 'lifted' && !d.report_submitted_at) return mk('Report to OCD due', d.report_due_at);
  return null;
}
