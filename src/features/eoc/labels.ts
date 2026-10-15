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
  { to: '/eoc', label: 'Board', end: true, tip: 'The EOC at a glance: alert level, latest log, barangays, requests and SitRep' },
  { to: '/eoc/log', label: 'Logbook', tip: 'Time-stamped record of everything that happens. Entries cannot be edited, only corrected' },
  { to: '/eoc/sitreps', label: 'SitReps', tip: 'Draft, submit and approve situation reports for OCD VIII and the Province' },
  { to: '/eoc/requests', label: 'Requests', tip: 'Track resource requests from request to demobilization' },
  { to: '/eoc/barangays', label: 'Barangays', tip: 'Latest status reported by each barangay (counts only, no names)' },
  { to: '/eoc/aa', label: 'Anticipatory action', tip: 'PDRA, State of Imminent Disaster declarations, the action checklist and AA funds (RA 12287)' },
];
export const SITREP_STATUS: Record<'draft' | 'submitted' | 'approved', string> = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved' };
