import type { BarangayCondition, LogCategory, RequestStatus } from '@/types';
export const LOG_CATEGORY: Record<LogCategory, string> = {
  general: 'General', decision: 'Decision', warning: 'Warning', request: 'Request', resource: 'Resource', report: 'Report',
  level_change: 'Level change', correction: 'Correction',
};
export const CONDITION: Record<BarangayCondition, string> = {
  normal: 'Normal', monitoring: 'Monitoring', affected: 'Affected', isolated: 'Isolated', evacuating: 'Evacuating',
};
export const CONDITION_TONE: Record<BarangayCondition, 'neutral' | 'info' | 'warn' | 'bad'> = {
  normal: 'neutral', monitoring: 'info', affected: 'warn', isolated: 'bad', evacuating: 'warn',
};
export const REQUEST_STATUS: Record<RequestStatus, string> = {
  requested: 'Requested', approved: 'Approved', mobilized: 'Mobilized', delivered: 'Delivered', demobilized: 'Demobilized', rejected: 'Rejected',
};
export const PRIORITY: Record<string, string> = { life_safety: 'Life safety', urgent: 'Urgent', routine: 'Routine' };
export const EOC_TABS = [
  { to: '/eoc', label: 'Board', end: true }, { to: '/eoc/log', label: 'Logbook' }, { to: '/eoc/sitreps', label: 'SitReps' },
  { to: '/eoc/requests', label: 'Requests' }, { to: '/eoc/barangays', label: 'Barangays' }, { to: '/eoc/aa', label: 'Anticipatory action' },
];
export const SITREP_STATUS: Record<'draft' | 'submitted' | 'approved', string> = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved' };
