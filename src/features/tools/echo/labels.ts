// ECHO labels (1.16.0, ADR-030).
import type { CampPhase, CentreKind, CentreVerification, FeedbackCategory } from '@/types';
import type { EchoModule } from '@/domain/echo';

export const ECHO_TABS = [
  { to: '/tools/echo', label: 'Simulator', end: true, tip: 'Training simulator: scenario, evacuation, centres, camp operations, protection and closure (kept on this device)' },
  { to: '/tools/echo/intel', label: 'Evacuation intelligence', tip: 'Map: hazard sheets, barangay exposure, centre suitability screening and route screening' },
  { to: '/tools/echo/camps', label: 'Camp management', tip: 'Evacuation-centre inventory and aggregate camp reports for the current activation (synced)' },
  { to: '/tools/echo/dashboard', label: 'EOC dashboard', tip: 'Consolidated evacuation status, capacity, unmet needs, requests and SitRep figures' },
];

export const MODULES: { key: EchoModule; label: string; short: string; tip: string }[] = [
  { key: 'overview', label: 'Operations overview', short: 'Overview', tip: 'Occupancy, capacity, alerts and the operational sequence' },
  { key: 'scenario', label: 'Scenario setup', short: 'Scenario', tip: 'Hazard, barangays, lead time and projected population' },
  { key: 'evacuation', label: 'Evacuation plan', short: 'Movement', tip: 'Movement capacity, route validation and reception' },
  { key: 'centres', label: 'Evacuation centres', short: 'Centres', tip: 'Site selection, capacity and RA 12076 readiness' },
  { key: 'camp', label: 'Camp operations', short: 'Camp', tip: 'Occupancy, water, sanitation and service monitoring' },
  { key: 'protection', label: 'Protection & inclusion', short: 'Protection', tip: 'Child protection, GBV safeguards, accessibility and feedback' },
  { key: 'closure', label: 'Monitoring & closure', short: 'Closure', tip: 'Service monitoring, transition and the closure checklist' },
  { key: 'standards', label: 'Standards & references', short: 'Standards', tip: 'Philippine law, the JMC, Sphere and IOM CCCM, each kept distinct' },
];

export const PHASE: Record<CampPhase, string> = { opening: 'Opening', open: 'Open', consolidating: 'Consolidating', closing: 'Closing', closed: 'Closed' };
export const PHASE_TONE: Record<CampPhase, 'info' | 'ok' | 'warn' | 'neutral'> = { opening: 'info', open: 'ok', consolidating: 'warn', closing: 'warn', closed: 'neutral' };
export const KIND: Record<CentreKind, string> = {
  ligtas_pinoy_center: 'Ligtas Pinoy Center (RA 12076)', multipurpose: 'Multipurpose hall', covered_court: 'Covered court', barangay_hall: 'Barangay hall',
  school_last_resort: 'School (last resort, RA 10821)', other: 'Other',
};
export const VERIFICATION: Record<CentreVerification, string> = {
  training: 'Training site', pending_field_validation: 'Pending field validation', field_verified: 'Data field-verified', superseded: 'Superseded',
};
export const VERIFICATION_TONE: Record<CentreVerification, 'neutral' | 'warn' | 'ok' | 'info'> = {
  training: 'info', pending_field_validation: 'warn', field_verified: 'ok', superseded: 'neutral',
};
export const FEEDBACK: Record<FeedbackCategory, string> = {
  access_inclusion: 'Access or inclusion barrier', wash: 'WASH or facility concern', safety_privacy: 'Safety, lighting or privacy',
  child_protection_referral: 'Child protection referral needed', gbv_referral: 'GBV referral needed', health_mhpss: 'Health or psychosocial support needed',
  food_nfi: 'Food or non-food items', information: 'Information request', other: 'Other service gap',
};
export const FEEDBACK_STATUS = { open: 'Open', referred: 'Referred confidentially', action_assigned: 'Action assigned', closed: 'Closed' } as const;

/** Services checked in each camp report (JMC No. 02 s. 2021 camp monitoring; RA 12076 Sec. 4(c)). */
export const SERVICES = [
  { key: 'water', label: 'Safe drinking water' }, { key: 'toilets', label: 'Toilets, bathing, handwashing' }, { key: 'food', label: 'Food or community kitchen' },
  { key: 'health', label: 'Health station and referral' }, { key: 'isolation', label: 'Isolation area' }, { key: 'breastfeeding', label: 'Breastfeeding room' },
  { key: 'cfs', label: 'Child-friendly space' }, { key: 'wfs', label: 'Women-friendly space' }, { key: 'mhpss', label: 'Mental wellness or counselling space' },
  { key: 'lighting', label: 'Lighting at night' }, { key: 'security', label: 'Security' }, { key: 'feedback', label: 'Feedback desk or channel' },
  { key: 'info_board', label: 'Information board' }, { key: 'power', label: 'Standby power' }, { key: 'waste', label: 'Waste segregation and collection' },
] as const;
