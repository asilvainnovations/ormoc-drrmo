import type { ProtocolCategory } from '@/types';
export const CATEGORY: Record<ProtocolCategory, string> = {
  daily_operations: 'Daily operations', warning: 'Warning and public information', eoc: 'EOC activation',
  anticipatory_action: 'Anticipatory action', council: 'CDRRMC secretariat', reporting: 'Reporting', recovery: 'Recovery',
  governance: 'Governance and the CDRRMC', workforce: 'EOC workforce and designations', budget: 'LDRRMF budget cycle',
  response_clusters: 'Contingency plans and response clusters', geospatial: 'Geo-COP and maps',
};

/** Workflows are the office's management cycles (ADR-016); protocols are the operational procedures. */
export const WORKFLOW_CATEGORIES: ProtocolCategory[] = ['governance', 'workforce', 'budget', 'response_clusters', 'geospatial'];
export const isWorkflow = (c: ProtocolCategory) => WORKFLOW_CATEGORIES.includes(c);

export const FORM_STATUS: Record<'draft' | 'approved' | 'retired', string> = { draft: 'Draft', approved: 'Approved', retired: 'Retired' };
