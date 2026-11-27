import type { BarangayCondition, LogCategory, RequestStatus, ResourceCategory, SitrepReportType } from '@/types';
/** DILG VIII harmonized report types (1.21.0, ADR-038). */
export const SITREP_REPORT_TYPE: Record<SitrepReportType, string> = {
  pre_disaster: 'Pre-disaster', during_disaster: 'During disaster', post_disaster: 'Post-disaster', terminal: 'Terminal',
};
export const LOG_CATEGORY: Record<LogCategory, string> = {
  general: 'General', decision: 'Decision', warning: 'Warning', request: 'Request', resource: 'Resource', report: 'Report',
  level_change: 'Level change', correction: 'Correction',
};
/** Resource inventory kinds (1.21.0, ADR-039). */
export const RESOURCE_CATEGORY: Record<ResourceCategory, string> = {
  vehicle: 'Vehicle', heavy_equipment: 'Heavy equipment', rescue: 'Rescue', medical: 'Medical',
  relief: 'Relief goods', communications: 'Communications', power: 'Power', other: 'Other',
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
  { to: '/eoc', label: 'Board', end: true, tip: 'The EOC at a glance: alert level, the barangay picture, key numbers, decision-support tools and what needs attention' },
  { to: '/eoc/coordination', label: 'Coordination', tip: 'Team messages, check-ins and the check-in call for the current activation, and all conversations' },
  { to: '/eoc/map', label: 'Map', tip: 'Geo-COP: live operational layers, barangay status, reference maps, EOC points and uploaded GIS layers' },
  { to: '/eoc/hazard-maps', label: 'Hazard Maps', tip: 'City hazard-map sheets and map interpretation tools for barangay-level reference' },
  { to: '/eoc/risk', label: 'Risk', tip: 'City Risk Picture: the QRE risk matrix with the reason for each rank, the integrated risk register and the Ten-Year Plan risk profile' },
  { to: '/eoc/barangays', label: 'Barangays', tip: 'All 85 barangays by cluster, coloured by their latest report. Tap one to record a status' },
  { to: '/eoc/plans', label: 'Scenarios', tip: 'EOC modules each contingency plan switches on (Manual Figure 1.7), and each plan’s contingency plan template' },
  { to: '/eoc/log', label: 'Logbook', tip: 'Time-stamped record of everything that happens. Entries cannot be edited, only corrected' },
  { to: '/eoc/requests', label: 'Requests', tip: 'Resource requests from request to delivery' },
  { to: '/eoc/resources', label: 'Resources', tip: 'What the City has: equipment, vehicles and stocks, checked against the national minimum list' },
  { to: '/eoc/sitreps', label: 'SitReps', tip: 'Situation reports, pre-filled from the EOC records, for OCD VIII and the Province' },
  { to: '/eoc/roster', label: 'Roster', tip: 'Who staffs each EOC position: primary and two alternates, with contacts' },
  { to: '/eoc/aa', label: 'Anticipatory action', tip: 'PDRA, State of Imminent Disaster, the action checklist and AA funds (RA 12287)' },
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

// ------------------------------------------------------------------ 1.12.1 DDRiVE (ADR-024)
/** Band label -> badge tone for the city risk picture. */
export const BAND_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'bad'> = {
  'Very Low': 'neutral', Low: 'info', Moderate: 'warn', High: 'bad', 'Very High': 'bad',
};
/** The barangay filter options on the Risk page. */
export const HAZARD_FILTER: Record<string, string> = {
  all: 'All barangays', flood: 'Flood-classified', rain_landslide: 'Rain-induced landslide',
  eq_landslide: 'Earthquake-induced landslide', liquefaction: 'Liquefaction', tsunami: 'Tsunami',
  storm_surge: 'Storm surge', priority: 'Priority-ranked', cluster: 'In a proposed cluster',
};
