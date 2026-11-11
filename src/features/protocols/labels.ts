import type { ProtocolCategory } from '@/types';
export const CATEGORY: Record<ProtocolCategory, string> = {
  daily_operations: 'Daily operations', warning: 'Warning and public information', eoc: 'EOC activation',
  anticipatory_action: 'Anticipatory action', council: 'CDRRMC secretariat', reporting: 'Reporting', recovery: 'Recovery',
  governance: 'Governance and the CDRRMC', workforce: 'EOC workforce and designations', budget: 'LDRRMF budget cycle',
  response_clusters: 'Contingency plans and response clusters', geospatial: 'Geo-COP and maps',
  risk_information: 'Risk information and critical facilities (Ch.3)', risk_planning: 'CDRA, DRRM planning and barangay plans (Ch.3)',
  contingency_planning: 'Contingency planning (Ch.3)', continuity: 'Public service continuity (Ch.3)',
};

/** Workflows are the office's management cycles (ADR-016); protocols are the operational procedures. */
export const WORKFLOW_CATEGORIES: ProtocolCategory[] = ['council', 'governance', 'workforce', 'budget', 'response_clusters',
  'geospatial', 'risk_information', 'risk_planning', 'contingency_planning', 'continuity'];
/** Mirrors the kind set by migration 20261108002000: incident protocols vs management workflows. */
export const isWorkflow = (c: ProtocolCategory) => WORKFLOW_CATEGORIES.includes(c);
export const templateIsWorkflow = (t: { kind?: 'protocol' | 'workflow'; category: ProtocolCategory }) =>
  t.kind ? t.kind === 'workflow' : isWorkflow(t.category);
export const KIND_LABEL = { protocol: 'Protocol (point of action)', workflow: 'Workflow (management cycle)' } as const;

export const FORM_STATUS: Record<'draft' | 'approved' | 'retired', string> = { draft: 'Draft', approved: 'Approved', retired: 'Retired' };

/** 1.14: the four DRRM thematic areas (RA 10121; NDRRMP). Each category sits under one area. The placement follows
 *  the NDRRMP outcomes and is a proposal for CDRRMO validation: governance, workforce and the CDRRMC are placed
 *  under Preparedness (LDRRMC/O capacity); the LDRRMF budget cycle and planning under Prevention and Mitigation
 *  (mainstreaming DRRM-CCA in plans and budgets). */
export type ThematicArea = 'prevention' | 'preparedness' | 'response' | 'recovery';
export const THEMATIC: { key: ThematicArea; label: string; about: string; categories: ProtocolCategory[] }[] = [
  { key: 'prevention', label: 'Disaster prevention and mitigation',
    about: 'Actions to avoid hazards or lessen their impacts before disasters occur: hazard mapping, land-use and development planning, mitigation projects, early warning systems and climate adaptation.',
    categories: ['risk_information', 'risk_planning', 'geospatial', 'budget', 'warning'] },
  { key: 'preparedness', label: 'Disaster preparedness',
    about: 'Activities that build the capacity of communities and institutions to respond: contingency planning, drills and exercises, the EOC, anticipatory action, continuity planning and stockpiles.',
    categories: ['governance', 'council', 'workforce', 'contingency_planning', 'response_clusters', 'continuity', 'daily_operations', 'eoc', 'anticipatory_action'] },
  { key: 'response', label: 'Disaster response',
    about: 'Immediate actions during and right after a disaster to save lives and meet basic needs: evacuation, search and rescue, relief, emergency medical services and rapid damage assessment.',
    categories: ['reporting'] },
  { key: 'recovery', label: 'Disaster rehabilitation and recovery',
    about: 'Measures to restore and improve affected communities: rebuilding infrastructure, restoring livelihoods, psychosocial support, housing and building back better.',
    categories: ['recovery'] },
];
export const thematicOf = (c: ProtocolCategory): ThematicArea => THEMATIC.find((t) => t.categories.includes(c))?.key ?? 'preparedness';
