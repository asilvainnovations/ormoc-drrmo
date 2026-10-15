import type { VaultCategory } from '@/types';
import type { RefKind } from '@/data/references';

export const CATEGORY: Record<VaultCategory, string> = {
  law: 'Law', irr: 'Implementing rules', issuance: 'Circular or guideline', framework: 'Plan or framework (national, global)',
  city_issuance: 'City ordinance, EO or resolution', plan: 'City plan', report: 'Report', record: 'Record or form', other: 'Other',
};
export const CATEGORY_TIP: Record<VaultCategory, string> = {
  law: 'Republic Acts and Presidential Decrees',
  irr: 'Implementing Rules and Regulations of a law',
  issuance: 'NDRRMC, DILG, DBM, COA or other agency circulars and guidelines',
  framework: 'NDRRMP, Sendai Framework, UNDRR Scorecard and similar',
  city_issuance: 'Ordinances, Executive Orders and resolutions of the City and the CDRRMC',
  plan: 'LDRRMP, contingency plans, PSCP, LDRRMFIP, evacuation plans',
  report: 'SitReps, AARs, PDNA, COA audit reports, accomplishment reports',
  record: 'Minutes, attendance, rosters, logbooks, inventories, test logs',
  other: 'Anything else that supports the assessment or the manuals',
};
export const STATUS: Record<'current' | 'superseded' | 'draft', string> = { current: 'Current', superseded: 'Superseded', draft: 'Draft' };
export const KIND_LABEL: Record<RefKind, string> = {
  law: 'Laws', irr: 'Implementing rules', issuance: 'Circulars, guidelines and standards', framework: 'Plans and frameworks', agency: 'Agencies', practice: 'Practice',
};
export const VAULT_TABS = [
  { to: '/vault', label: 'Documents', end: true, tip: 'Every document in the vault. Search, filter and add' },
  { to: '/vault/review', label: 'Document Review', tip: 'The indicators assessed by Document Review (DR) and which have documents in the vault' },
  { to: '/vault/references', label: 'References', tip: 'The laws, rules and guidelines the assessment and the manuals cite, explained briefly' },
];
