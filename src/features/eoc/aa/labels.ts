import type { AaTiming, DeclarationStatus, FundSource, ImpactClass, PdraDecision } from '@/types';
export const IMPACT: Record<ImpactClass, string> = { severe: 'Severe', moderate: 'Moderate', minor: 'Minor', uncertain: 'Uncertain' };
export const DECISION: Record<PdraDecision, { label: string; detail: string }> = {
  monitor: { label: 'Monitor', detail: 'Keep watching the forecast. No anticipatory action yet.' },
  local_early_action: { label: 'City early action', detail: 'Act now under the City\'s own authority, without a declaration.' },
  request_declaration: { label: 'Request a State of Imminent Disaster', detail: 'Severe impact with at least 3 days of lead time (RA 12287 Sec. 6).' },
};
export const DECL_STATUS: Record<DeclarationStatus, string> = {
  draft: 'Draft', requested: 'Requested from RDRRMC', recommended: 'Recommended by RDRRMC', not_recommended: 'Not recommended',
  declared: 'Declared', lifted: 'Lifted', withdrawn: 'Withdrawn',
};
export const TIMING: Record<AaTiming, string> = {
  on_declaration: 'On declaration', before_impact_beyond_3d: 'More than 3 days before impact', within_3d: 'Within 3 days of impact', after_lifting: 'After lifting',
};
export const TIMING_ORDER: AaTiming[] = ['on_declaration', 'before_impact_beyond_3d', 'within_3d', 'after_lifting'];
export const SOURCE: Record<FundSource, string> = {
  ldrrmf_aa: 'LDRRMF anticipatory action allocation', special_trust_fund: 'Special Trust Fund (unexpended LDRRMF)', donation: 'Donation or partner fund',
  oda: 'Official development assistance', other_lgu: 'Funds from other LGUs', other: 'Other lawful source',
};
export const SECTORS = ['Agriculture and fisheries', 'Business and industry', 'Critical infrastructure', 'Health', 'Education', 'Environment', 'Transport'];
