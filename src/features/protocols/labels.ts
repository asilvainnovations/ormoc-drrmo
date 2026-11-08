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
