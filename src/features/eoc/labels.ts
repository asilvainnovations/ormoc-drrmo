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
  { to: '/eoc/liaison', label: 'Liaison desk', tip: 'Barangay Liaison Desk: reporting and silent barangays by cluster in this activation' },
  { to: '/eoc/plans', label: 'Plans and clusters', tip: 'Contingency plans, activating a plan, and which response clusters and modules are on' },
  { to: '/eoc/roster', label: 'Roster', tip: 'EOC positions and designations, primary and two alternates (B4.2)' },
  { to: '/eoc/map', label: 'Map', tip: 'Geo-COP: the City basemap, verified reference points and validated layers' },
  { to: '/eoc/aa', label: 'Anticipatory action', tip: 'PDRA, State of Imminent Disaster declarations, the action checklist and AA funds (RA 12287)' },
];
export const SITREP_STATUS: Record<'draft' | 'submitted' | 'approved', string> = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved' };

// ------------------------------------------------------------------ 1.9 structure, clusters and Geo-COP
export const PLAN_STATUS: Record<import('@/types').PlanStatus, string> = {
  to_prepare: 'To prepare', draft: 'Draft', adopted: 'Adopted', expired: 'Expired', retired: 'Retired',
};
export const PLAN_TONE: Record<import('@/types').PlanStatus, 'neutral' | 'info' | 'ok' | 'warn' | 'bad'> = {
  to_prepare: 'neutral', draft: 'info', adopted: 'ok', expired: 'warn', retired: 'neutral',
};
export const ITEM_STATE: Record<'on' | 'lead' | 'standby' | 'stood_down', string> = {
  lead: 'Lead', on: 'Activated', standby: 'On standby', stood_down: 'Stood down',
};
export const ITEM_TONE: Record<'on' | 'lead' | 'standby' | 'stood_down', 'ok' | 'info' | 'neutral'> = {
  lead: 'ok', on: 'ok', standby: 'info', stood_down: 'neutral',
};
export const MODULE: Record<string, string> = {
  operations: 'Operations Section', planning: 'Planning Section', pdra_aa_desk: 'PDRA and anticipatory action desk', logistics: 'Logistics Section',
  finance_admin: 'Finance and Administration', cluster_desks: 'Cluster desks', barangay_liaison: 'Barangay Liaison Desk',
  building_assessment_mdm: 'Building assessment and MDM',
};
export const SECTION: Record<import('@/types').EocSection, string> = {
  command: 'Command', command_staff: 'Command staff', operations: 'Operations', planning: 'Planning', logistics: 'Logistics',
  finance_admin: 'Finance and Administration', cluster_desk: 'Cluster desks', barangay_desk: 'Barangay liaison desks',
};
export const RANK: Record<1 | 2 | 3, string> = { 1: 'Primary', 2: 'First alternate', 3: 'Second alternate' };
export const DESIGNATION_STATUS: Record<'proposed' | 'approved' | 'withdrawn', string> = { proposed: 'Proposed', approved: 'Approved', withdrawn: 'Withdrawn' };
export const POINT_KIND: Record<import('@/types').GeoPointKind, string> = {
  eoc: 'EOC', alternate_eoc: 'Alternate EOC', opcen: 'Operations centre', icp: 'Incident command post', staging: 'Staging area',
  evacuation_hub: 'Evacuation hub', other: 'Other',
};
export const POINT_STATUS: Record<'pending_field_validation' | 'field_verified' | 'superseded', string> = {
  pending_field_validation: 'Pending field validation', field_verified: 'Field-verified', superseded: 'Superseded',
};
export const LAYER_GROUP: Record<import('@/types').GeoLayerGroup, string> = {
  eoc_facilities: 'EOC facilities', admin_boundaries: 'Administrative boundaries', hazard: 'Hazard', incident: 'Incidents',
  evacuation: 'Evacuation', critical_facilities: 'Critical facilities', population_exposure: 'Population and exposure',
  resources: 'Resources', lifelines: 'Lifelines',
};
export const LAYER_VALIDATION: Record<'reported' | 'preliminary' | 'field_verified' | 'official', string> = {
  reported: 'Reported', preliminary: 'Preliminary', field_verified: 'Field-verified', official: 'Official',
};
export const HAZARD_TAG: Record<string, string> = {
  flood: 'Flood', flash_flood: 'Flash flood', storm_surge: 'Storm surge', landslide: 'Landslide', earthquake: 'Earthquake',
  liquefaction: 'Liquefaction', tsunami: 'Tsunami', drought: 'Drought',
};
