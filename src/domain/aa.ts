// RA 12287 and IRR rules. Mirrors supabase/migrations/20261015000500_anticipatory_action.sql.
// Parameters come from the aa_rules table so they follow the server when DBM–COA or
// NDRRMC operational guidelines change them.
import type { AaDisbursement, AaFundYear, Declaration, DeclarationStatus, ImpactClass, PdraDecision } from '@/types';

export interface AaParams {
  aa_share_of_ldrrmf_70: number; tranche_beyond_max: number; tranche_within_max: number;
  lead_threshold_hours: number; min_declaration_lead_hours: number; rdrrmc_reply_hours: number; report_days: number;
}
export const DEFAULT_AA_PARAMS: AaParams = {
  aa_share_of_ldrrmf_70: 0.1, tranche_beyond_max: 0.3, tranche_within_max: 0.7,
  lead_threshold_hours: 72, min_declaration_lead_hours: 72, rdrrmc_reply_hours: 24, report_days: 45,
};

const HOUR = 3_600_000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

export const hoursBetween = (fromIso: string | Date, toIso: string | Date) =>
  r1((new Date(toIso).getTime() - new Date(fromIso).getTime()) / HOUR);

/** Maximum AA allocation: 10% of the 70% LDRRMF. */
export const aaCap = (ldrrmfTotal: number, p = DEFAULT_AA_PARAMS) => r2(ldrrmfTotal * 0.7 * p.aa_share_of_ldrrmf_70);

export function pdraDecisionProblem(input: { impact_class: ImpactClass; decision: PdraDecision; expected_impact_at: string; conducted_at: string; decision_basis?: string | null }, p = DEFAULT_AA_PARAMS): string | null {
  if (input.decision !== 'request_declaration') return null;
  if (input.impact_class !== 'severe') return 'A State of Imminent Disaster needs impacts classified as severe. Choose city early action instead.';
  const lead = hoursBetween(input.conducted_at, input.expected_impact_at);
  if (lead < p.min_declaration_lead_hours) {
    return `Only ${lead} hours of lead time remain; a declaration needs at least ${p.min_declaration_lead_hours}. Use city early action under the City's own authority.`;
  }
  if (!input.decision_basis?.trim()) return 'Record the basis for requesting a declaration.';
  return null;
}

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
      patch.declared_at = iso;
      break;
    case 'lifted':
      if (!input.lifting_ground) throw new Error('Record the ground for lifting.');
      patch.lifted_at = iso;
      patch.report_due_at = new Date(now.getTime() + p.report_days * 24 * HOUR).toISOString();
      break;
    default:
      break;
  }
  return patch;
}

export type Tranche = 'beyond_threshold' | 'within_threshold';
export function trancheOf(expectedImpactAt: string, interventionAt: string, p = DEFAULT_AA_PARAMS): { lead: number; tranche: Tranche } {
  const lead = hoursBetween(interventionAt, expectedImpactAt);
  return { lead, tranche: lead > p.lead_threshold_hours ? 'beyond_threshold' : 'within_threshold' };
}

export interface FundStatus { cap: number; allocation: number; beyondLimit: number; withinLimit: number; beyondUsed: number; withinUsed: number; otherUsed: number }
export function fundStatus(year: AaFundYear, disbursements: AaDisbursement[], p = DEFAULT_AA_PARAMS): FundStatus {
  const mine = disbursements.filter((d) => d.fiscal_year === year.fiscal_year);
  const sum = (f: (d: AaDisbursement) => boolean) => r2(mine.filter(f).reduce((s, d) => s + Number(d.amount), 0));
  return {
    cap: aaCap(year.ldrrmf_total, p), allocation: year.aa_allocation,
    beyondLimit: r2(year.aa_allocation * p.tranche_beyond_max), withinLimit: r2(year.aa_allocation * p.tranche_within_max),
    beyondUsed: sum((d) => d.source === 'ldrrmf_aa' && d.tranche === 'beyond_threshold'),
    withinUsed: sum((d) => d.source === 'ldrrmf_aa' && d.tranche === 'within_threshold'),
    otherUsed: sum((d) => d.source !== 'ldrrmf_aa'),
  };
}

/** Why a disbursement is refused, or null. Graduation applies to the LDRRMF AA allocation only. */
export function disbursementProblem(
  d: Pick<AaDisbursement, 'source' | 'amount' | 'intervention_at' | 'fiscal_year'>, decl: Declaration,
  year: AaFundYear | undefined, existing: AaDisbursement[], p = DEFAULT_AA_PARAMS,
): string | null {
  if (decl.status !== 'declared') return `Funds are released only while a State of Imminent Disaster is in force (status is ${decl.status}).`;
  if (!(d.amount > 0)) return 'Enter an amount above zero.';
  const { lead, tranche } = trancheOf(decl.expected_impact_at, d.intervention_at, p);
  if (lead < 0) return 'The intervention date is after the expected impact; record it as response, not anticipatory action.';
  if (d.source !== 'ldrrmf_aa') return null;
  if (!year) return `Set the AA allocation for ${d.fiscal_year} before recording LDRRMF disbursements.`;
  const st = fundStatus(year, existing, p);
  const used = tranche === 'beyond_threshold' ? st.beyondUsed : st.withinUsed;
  const limit = tranche === 'beyond_threshold' ? st.beyondLimit : st.withinLimit;
  if (used + d.amount > limit + 1e-9) {
    return `This would bring ${tranche === 'beyond_threshold' ? 'beyond-3-day' : 'within-3-day'} disbursements to ₱${fmtPeso(used + d.amount)}, above the ₱${fmtPeso(limit)} limit for that tranche.`;
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
