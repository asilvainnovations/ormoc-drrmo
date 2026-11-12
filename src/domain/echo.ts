// ECHO — Evacuation and Camp Handling Operations (1.16.0, ADR-030).
//
// Pure planning arithmetic for the ECHO simulator, the Camp Management Information System and the EOC
// coordination dashboard. Each benchmark keeps its own source: Sphere, the DSWD-DILG-DOH-DepEd JMC No. 02 s. 2021
// and RA 12076 are different instruments and are never merged or averaged. A figure here is a planning check,
// not a certification: nothing in ECHO certifies a site as safe, orders an evacuation or opens or closes a centre.
// Counts are aggregates. A blank count is "not reported" (null), never zero.

export type SourceKey = 'sphere' | 'jmc' | 'ra12076' | 'dpms';
export const SOURCES: Record<SourceKey, { short: string; long: string }> = {
  sphere: { short: 'Sphere 2018', long: 'Sphere Handbook (2018): Humanitarian Charter and Minimum Standards in Humanitarian Response' },
  jmc: { short: 'JMC 02 s. 2021', long: 'DSWD-DILG-DOH-DepEd Joint Memorandum Circular No. 02, s. 2021 (Camp Coordination and Camp Management)' },
  ra12076: { short: 'RA 12076', long: 'Republic Act No. 12076, Ligtas Pinoy Centers Act (6 December 2024)' },
  dpms: { short: 'NDRRMC DPMS Vol. 2', long: 'NDRRMC Disaster Preparedness Minimum Standards, Volume 2' },
};

export interface Benchmark { key: string; label: string; value: string; source: SourceKey; where: string; note?: string }

/** The numeric indicators ECHO uses, each with its own source and place in it. Shown on Standards & References. */
export const BENCHMARKS: Benchmark[] = [
  { key: 'water_sphere', label: 'Safe water, initial planning', value: '15 L per person per day', source: 'sphere', where: 'WASH, water supply standard 2.1',
    note: 'Average for drinking and domestic hygiene; adapt to context and phase.' },
  { key: 'water_jmc_basic', label: 'Basic survival water needs', value: '7.5–15 L per person per day', source: 'jmc', where: 'VII, WASH (d), p. 13',
    note: 'Drinking 2.5–3 L, basic hygiene 2–6 L, basic cooking 3–6 L.' },
  { key: 'water_jmc_prolonged', label: 'Minimum water demand, prolonged period', value: '52 L per person per day', source: 'jmc', where: 'VII, WASH (e), p. 13',
    note: 'Drinking 2, food preparation and cooking 10, bathing 15, laundry 15, sanitation and hygiene 10. Not the same as the Sphere 15 L.' },
  { key: 'water_point', label: 'Distance to the nearest water point', value: 'At most 500 m', source: 'jmc', where: 'VII, WASH (e)(i), p. 13' },
  { key: 'tap', label: 'People per tap', value: '250 (at 7.5 L per minute)', source: 'jmc', where: 'VII, WASH (c), p. 13', note: 'The JMC cites Sphere for these.' },
  { key: 'bathing_jmc', label: 'People per bathing facility', value: '50', source: 'jmc', where: 'VII, WASH (c)(v), p. 13' },
  { key: 'laundry_jmc', label: 'People per laundry facility', value: '100', source: 'jmc', where: 'VII, WASH (c)(iv), p. 13' },
  { key: 'toilet_jmc_short', label: 'Toilets, short-term displacement', value: '1 per 50 persons', source: 'jmc', where: 'VII, WASH (a)(i), p. 12',
    note: 'Applies when displacement exceeds 3 days.' },
  { key: 'toilet_jmc_long', label: 'Toilets, long-term displacement', value: '1 per 20 persons', source: 'jmc', where: 'VII, WASH (a)(ii), p. 12' },
  { key: 'toilet_jmc_gender', label: 'Female to male toilets', value: 'About 4 to 3', source: 'jmc', where: 'VII, WASH (a)(ix), p. 12' },
  { key: 'toilet_jmc_access', label: 'Toilets for persons with disability and older persons', value: '4 in 10 (p. 12); 1 in 10 (p. 14); at least 1 per site',
    source: 'jmc', where: 'VII, WASH (a)(x), p. 12 and superstructure (h), p. 14',
    note: 'The JMC gives two ratios. ECHO shows both and uses neither as a pass mark; ask the CHO which applies.' },
  { key: 'toilet_ra', label: 'Toilets and showers (permanent evacuation centres)', value: '1 per 20 males, 1 per 20 females; 1 per 8 persons with disability or older persons',
    source: 'ra12076', where: 'Sec. 4(c)(2)', note: 'Separate male and female facilities. A facility design standard, not the JMC camp ratio.' },
  { key: 'structure_ra', label: 'Structural design', value: 'Winds of at least 300 kph; earthquakes of at least magnitude 8.0', source: 'ra12076', where: 'Sec. 4(b)',
    note: 'Confirmed only by a structural assessment from the City Engineer or DPWH. ECHO records the reference; it does not certify.' },
  { key: 'space_sphere', label: 'Covered living space', value: '3.5 m² per person', source: 'sphere', where: 'Shelter and settlement standard 3; cited in the JMC, VII.1(c), p. 11' },
  { key: 'settlement_sphere', label: 'Camp-type settlement area', value: '45 m² per person; 30 m² where communal services are outside', source: 'sphere',
    where: 'Shelter and settlement standard 2', note: 'Total site area, not building floor area.' },
  { key: 'toilet_dpms', label: 'Toilets for men and women', value: '1 to 50', source: 'dpms', where: 'Evacuation centre minimum standards, p. 14' },
  { key: 'room_dpms', label: 'Families per evacuation room', value: '6 families per 40 m² room', source: 'dpms', where: 'Evacuation centre minimum standards, p. 15' },
];

// ---------------------------------------------------------------------------------------------- numbers
export const SPHERE_WATER_L = 15;
export const JMC_PROLONGED_WATER_L = 52;
export const SPHERE_SPACE_M2 = 3.5;
export const JMC_TOILET_SHORT = 50;
export const JMC_TOILET_LONG = 20;
export const JMC_BATHING = 50;
export const RA_TOILET_PER_SEX = 20;
export const RA_TOILET_ACCESSIBLE = 8;

/** Aggregate population of a scenario or a centre. Null means not reported. */
export interface Population {
  families: number | null; persons: number | null; female: number | null; male?: number | null;
  children: number | null; older: number | null; pwd: number | null; pregnant_lactating?: number | null; ip?: number | null;
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ceilDiv = (a: number, b: number) => (b > 0 ? Math.ceil(a / b) : 0);

/** A number from a form field: '' is not reported (null); anything else must be a whole number, 0 or more. */
export function parseWhole(s: string): number | null | 'invalid' {
  const v = s.trim();
  if (v === '') return null;
  if (!/^\d+$/.test(v)) return 'invalid';
  return Number(v);
}

/** Males, when the form gave persons and females but not males. */
export function malesOf(p: Population): number | null {
  if (n(p.male) !== null) return p.male!;
  if (n(p.persons) === null || n(p.female) === null) return null;
  return Math.max(0, p.persons! - p.female!);
}

/** Problems with an aggregate population: each group fits inside the total, persons at least families. */
export function populationProblems(p: Population): string[] {
  const out: string[] = [];
  const persons = n(p.persons);
  if (persons !== null && n(p.families) !== null && persons < p.families!) out.push('Persons cannot be fewer than families.');
  if (persons !== null) {
    for (const [k, label] of [['female', 'Women and girls'], ['male', 'Men and boys'], ['children', 'Children'], ['older', 'Older persons'],
      ['pwd', 'Persons with disability'], ['pregnant_lactating', 'Pregnant and lactating women'], ['ip', 'Indigenous Peoples']] as const) {
      const v = n(p[k]);
      if (v !== null && v > persons) out.push(`${label} cannot exceed persons.`);
    }
    if (n(p.female) !== null && n(p.male) !== null && p.female! + p.male! > persons) out.push('Women and men together cannot exceed persons.');
  }
  return out;
}

export interface WaterCheck { needSphere: number; needJmc: number; available: number | null; meetsSphere: boolean | null; meetsJmc: boolean | null; perPerson: number | null }
/** Water against both benchmarks, kept separate (Sphere 15 L initial; JMC 52 L prolonged). */
export function waterCheck(persons: number | null, availableLitresPerDay: number | null): WaterCheck {
  const p = n(persons) ?? 0;
  const a = n(availableLitresPerDay);
  return {
    needSphere: p * SPHERE_WATER_L, needJmc: p * JMC_PROLONGED_WATER_L, available: a,
    meetsSphere: a === null || p === 0 ? null : a >= p * SPHERE_WATER_L,
    meetsJmc: a === null || p === 0 ? null : a >= p * JMC_PROLONGED_WATER_L,
    perPerson: a === null || p === 0 ? null : a / p,
  };
}

export interface SpaceCheck { need: number; available: number | null; meets: boolean | null; capacityAtStandard: number | null }
export function spaceCheck(persons: number | null, coveredAreaM2: number | null): SpaceCheck {
  const p = n(persons) ?? 0;
  const a = n(coveredAreaM2);
  return { need: p * SPHERE_SPACE_M2, available: a, meets: a === null || p === 0 ? null : a >= p * SPHERE_SPACE_M2,
    capacityAtStandard: a === null ? null : Math.floor(a / SPHERE_SPACE_M2) };
}

export type DisplacementPhase = 'short' | 'long';
export interface ToiletCheck {
  /** RA 12076 Sec. 4(c)(2): per sex and for persons with disability or older persons. Null when the split is not reported. */
  ra: { male: number | null; female: number | null; accessible: number | null };
  /** JMC VII (a): one ratio for all users by phase. */
  jmc: number;
  jmcRatio: number;
  available: { male: number | null; female: number | null; accessible: number | null; total: number | null };
  gaps: string[];
}
export function toiletCheck(p: Population, available: { male: number | null; female: number | null; accessible: number | null; total?: number | null },
  phase: DisplacementPhase): ToiletCheck {
  const persons = n(p.persons) ?? 0;
  const male = malesOf(p);
  const female = n(p.female);
  const access = n(p.pwd) === null && n(p.older) === null ? null : (n(p.pwd) ?? 0) + (n(p.older) ?? 0);
  const ratio = phase === 'long' ? JMC_TOILET_LONG : JMC_TOILET_SHORT;
  const total = n(available.total) ?? (n(available.male) === null && n(available.female) === null && n(available.accessible) === null
    ? null : (n(available.male) ?? 0) + (n(available.female) ?? 0) + (n(available.accessible) ?? 0));
  const ra = { male: male === null ? null : ceilDiv(male, RA_TOILET_PER_SEX), female: female === null ? null : ceilDiv(female, RA_TOILET_PER_SEX),
    accessible: access === null ? null : ceilDiv(access, RA_TOILET_ACCESSIBLE) };
  const jmc = ceilDiv(persons, ratio);
  const gaps: string[] = [];
  if (total !== null && persons > 0 && total < jmc) gaps.push(`JMC ${phase === 'long' ? 'long-term 1:20' : 'short-term 1:50'}: ${jmc} toilets needed, ${total} working.`);
  if (ra.male !== null && n(available.male) !== null && available.male! < ra.male) gaps.push(`RA 12076: ${ra.male} for males, ${available.male} available.`);
  if (ra.female !== null && n(available.female) !== null && available.female! < ra.female) gaps.push(`RA 12076: ${ra.female} for females, ${available.female} available.`);
  if (ra.accessible !== null && n(available.accessible) !== null && available.accessible! < ra.accessible)
    gaps.push(`RA 12076: ${ra.accessible} for persons with disability and older persons, ${available.accessible} available.`);
  if (persons > 0 && n(available.accessible) === 0) gaps.push('No accessible toilet. The JMC asks for at least one per site.');
  return { ra, jmc, jmcRatio: ratio, available: { male: n(available.male), female: n(available.female), accessible: n(available.accessible), total }, gaps };
}

export function bathingNeedJmc(persons: number | null): number { return ceilDiv(n(persons) ?? 0, JMC_BATHING); }

/** Vehicle loads and cycles for assisted movement; travel and turnaround time come from the field, not from ECHO. */
export function movement(persons: number | null, vehicles: number | null, perTrip: number | null, roundTripMinutes: number | null) {
  const p = n(persons) ?? 0;
  const v = Math.max(0, n(vehicles) ?? 0);
  const per = Math.max(1, n(perTrip) ?? 1);
  const loads = ceilDiv(p, per);
  const cycles = v > 0 ? ceilDiv(loads, v) : null;
  const minutes = cycles !== null && n(roundTripMinutes) !== null ? cycles * roundTripMinutes! : null;
  return { loads, cycles, minutes };
}

export function utilisation(persons: number | null, capacity: number | null): number | null {
  if (n(persons) === null || !n(capacity)) return null;
  return persons! / capacity!;
}

export type Tone = 'ok' | 'info' | 'warn' | 'bad' | 'neutral';
export interface Alert { tone: Tone; title: string; body: string; module: EchoModule }
export type EchoModule = 'overview' | 'scenario' | 'evacuation' | 'centres' | 'camp' | 'protection' | 'closure' | 'standards';

/** Lead-time choices. "Under 72 hours" is RA 12287's declaration floor; short-lead hazards go to city early action (Ch.4). */
export const LEAD_TIMES = ['0–6 hours', '6–24 hours', '24–72 hours', 'More than 72 hours'] as const;
export const HAZARDS = ['Typhoon / flood', 'Flash flood (Anilao–Malbasag)', 'Storm surge / coastal flooding', 'Rain-induced landslide', 'Earthquake',
  'Earthquake-induced landslide', 'Tsunami', 'Compound / cascading event'] as const;

// ---------------------------------------------------------------------------------------------- the exercise
export interface TrainingSite {
  id: string; name: string; capacity: number | null; area_m2: number | null; water_l_day: number | null;
  toilets_male: number | null; toilets_female: number | null; toilets_accessible: number | null; bathing: number | null;
  accessible: boolean; clinic: boolean; cfs: boolean; wfs: boolean;
  /** 'training' for invented sites; 'inventory' when copied from the City inventory (its verification status is kept). */
  origin: 'training' | 'inventory'; verification?: string; centre_id?: string;
}
export interface Exercise {
  schema: 'mode-echo-exercise/2';
  id: string; title: string; started_at: string; updated_at: string;
  scenario: { hazard: string; barangays: string[]; lead: string; families: number | null; persons: number | null; female: number | null;
    children: number | null; older: number | null; pwd: number | null; pregnant_lactating: number | null; ip: number | null; outside_centres: number | null; notes: string };
  movement: { mode: string; route: 'unverified' | 'validated' | 'blocked'; vehicles: number | null; per_trip: number | null; round_trip_min: number | null;
    assembly: string; received: number | null; en_route: number | null; unaccounted: number | null };
  sites: TrainingSite[]; selected: string | null;
  camp: { water_l_day: number | null; toilets_male: number | null; toilets_female: number | null; toilets_accessible: number | null; bathing: number | null;
    phase: DisplacementPhase; days: number | null };
  checks: Record<string, boolean>;
  feedback: { id: string; at: string; category: string; status: string; summary: string; office: string }[];
  decisions: { id: string; at: string; action: string; reason: string }[];
}

export const TRAINING_SITES: TrainingSite[] = [
  { id: 'site-a', name: 'Training Site A — Coastal Cluster', capacity: 800, area_m2: 2800, water_l_day: 9000, toilets_male: 10, toilets_female: 12, toilets_accessible: 2,
    bathing: 12, accessible: true, clinic: true, cfs: true, wfs: true, origin: 'training' },
  { id: 'site-b', name: 'Training Site B — Upland Cluster', capacity: 700, area_m2: 2450, water_l_day: 7000, toilets_male: 8, toilets_female: 9, toilets_accessible: 1,
    bathing: 10, accessible: false, clinic: false, cfs: true, wfs: false, origin: 'training' },
];

export function newExercise(now = new Date(), id = 'ex-' + now.getTime().toString(36)): Exercise {
  const iso = now.toISOString();
  return {
    schema: 'mode-echo-exercise/2', id, title: 'ECHO exercise', started_at: iso, updated_at: iso,
    scenario: { hazard: HAZARDS[0], barangays: [], lead: LEAD_TIMES[1], families: 300, persons: 1200, female: 620, children: 360, older: 72, pwd: 48,
      pregnant_lactating: null, ip: null, outside_centres: null, notes: '' },
    movement: { mode: 'Mixed: walking and vehicles', route: 'unverified', vehicles: 12, per_trip: 20, round_trip_min: null,
      assembly: 'To be confirmed by the EOC and the barangay', received: 0, en_route: 1200, unaccounted: 0 },
    sites: TRAINING_SITES.map((s) => ({ ...s })), selected: 'site-a',
    camp: { water_l_day: 15000, toilets_male: 13, toilets_female: 15, toilets_accessible: 2, bathing: 20, phase: 'short', days: 1 },
    checks: {}, feedback: [], decisions: [],
  };
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? Math.round(x) : null;
};

/** Read an exported exercise: this format, or the first standalone prototype ("MODE ECHO Simulator" JSON). */
export function importExercise(raw: unknown, now = new Date()): Exercise {
  if (!raw || typeof raw !== 'object') throw new Error('This file is not an ECHO exercise.');
  const o = raw as Record<string, unknown>;
  if (o.schema === 'mode-echo-exercise/2') {
    const base = newExercise(now);
    const e = o as unknown as Exercise;
    return { ...base, ...e, scenario: { ...base.scenario, ...e.scenario }, movement: { ...base.movement, ...e.movement }, camp: { ...base.camp, ...e.camp },
      sites: Array.isArray(e.sites) ? e.sites : base.sites, checks: e.checks ?? {}, feedback: e.feedback ?? [], decisions: e.decisions ?? [] };
  }
  if (o.product === 'MODE ECHO Simulator' && o.inputs && typeof o.inputs === 'object') {
    const i = o.inputs as Record<string, string>;
    const d = (o.data ?? {}) as { checks?: Record<string, boolean>; feedback?: { type: string; status: string; note: string; time: string }[];
      decisions?: { action: string; reason: string; time: string }[]; selected?: number };
    const e = newExercise(now);
    const proto = Array.isArray(o.trainingSites) ? (o.trainingSites as Record<string, unknown>[]) : [];
    e.title = 'ECHO exercise (imported from the prototype)';
    e.scenario = { ...e.scenario, hazard: i.hazard || e.scenario.hazard, lead: i.lead || e.scenario.lead, families: num(i.families), persons: num(i.people),
      female: num(i.women), children: num(i.children), older: num(i.older), pwd: num(i.pwd), notes: (i.notes ?? '').slice(0, 1000) };
    e.movement = { ...e.movement, mode: i.mode || e.movement.mode, route: (['unverified', 'validated', 'blocked'].includes(i.route ?? '') ? i.route : 'unverified') as Exercise['movement']['route'],
      vehicles: num(i.vehicles), per_trip: num(i.perTrip), assembly: i.assembly || e.movement.assembly, received: num(i.arrived), en_route: num(i.pending), unaccounted: num(i.unaccounted) };
    if (proto.length) {
      e.sites = proto.map((s, k) => ({ id: `site-${k + 1}`, name: String(s.name ?? `Training site ${k + 1}`), capacity: num(s.capacity), area_m2: num(s.area),
        water_l_day: num(s.water), toilets_male: null, toilets_female: null, toilets_accessible: null, bathing: num(s.bathing),
        accessible: !!s.accessible, clinic: !!s.clinic, cfs: !!s.child, wfs: !!s.women, origin: 'training' as const }));
      e.selected = e.sites[Math.min(Math.max(0, d.selected ?? 0), e.sites.length - 1)]!.id;
    }
    const total = num(i.toilets);
    e.camp = { ...e.camp, water_l_day: num(i.water), bathing: num(i.bathing), toilets_male: null, toilets_female: null, toilets_accessible: null };
    if (total !== null) { e.camp.toilets_female = Math.ceil(total * 4 / 7); e.camp.toilets_male = total - e.camp.toilets_female; e.camp.toilets_accessible = 0; }
    e.checks = { ...(d.checks ?? {}) };
    e.feedback = (d.feedback ?? []).map((f, k) => ({ id: `fb-${k}`, at: f.time, category: f.type, status: f.status, summary: String(f.note ?? '').slice(0, 500), office: '' }));
    e.decisions = (d.decisions ?? []).map((x, k) => ({ id: `dc-${k}`, at: x.time, action: x.action, reason: String(x.reason ?? '').slice(0, 1000) }));
    return e;
  }
  throw new Error('This file is not an ECHO exercise.');
}

export function selectedSite(e: Exercise): TrainingSite | null {
  return e.sites.find((s) => s.id === e.selected) ?? e.sites[0] ?? null;
}

export function scenarioPopulation(e: Exercise): Population {
  const s = e.scenario;
  return { families: s.families, persons: s.persons, female: s.female, children: s.children, older: s.older, pwd: s.pwd,
    pregnant_lactating: s.pregnant_lactating, ip: s.ip };
}

/** Priority alerts from the exercise inputs. A quiet list never certifies readiness. */
export function exerciseAlerts(e: Exercise): Alert[] {
  const a: Alert[] = [];
  const site = selectedSite(e);
  const p = scenarioPopulation(e);
  const persons = p.persons;
  for (const x of populationProblems(p)) a.push({ tone: 'bad', title: 'Population figures do not add up', body: x, module: 'scenario' });
  if (persons === null) a.push({ tone: 'warn', title: 'Projected persons not set', body: 'Set the projected number of persons; ECHO computes nothing from a blank.', module: 'scenario' });
  if (e.movement.route === 'blocked') a.push({ tone: 'bad', title: 'Route blocked or unsafe', body: 'Choose another route with the EOC and field teams before any movement.', module: 'evacuation' });
  else if (e.movement.route !== 'validated') a.push({ tone: 'warn', title: 'Route not validated', body: 'Do not start movement until the route and access are checked by authorised teams.', module: 'evacuation' });
  if (n(e.movement.unaccounted) && e.movement.unaccounted! > 0)
    a.push({ tone: 'bad', title: `${e.movement.unaccounted} not accounted for`, body: 'Report through the authorised tracing and reunification process. No names in ECHO.', module: 'evacuation' });
  if (!site) { a.push({ tone: 'warn', title: 'No centre selected', body: 'Select a training site or a centre from the City inventory.', module: 'centres' }); return a; }
  const u = utilisation(persons, site.capacity);
  if (u !== null && u > 1) a.push({ tone: 'bad', title: 'Centre capacity exceeded', body: `Projected ${fmt(persons)} against a capacity of ${fmt(site.capacity)}. Open another centre or split the movement.`, module: 'centres' });
  const sp = spaceCheck(persons, site.area_m2);
  if (sp.meets === false) a.push({ tone: 'warn', title: 'Covered space below 3.5 m² per person (Sphere)', body: `Needs ${fmt(sp.need)} m²; the site has ${fmt(site.area_m2)} m² (about ${fmt(sp.capacityAtStandard)} persons at the standard).`, module: 'camp' });
  const w = waterCheck(persons, e.camp.water_l_day);
  if (w.meetsSphere === false) a.push({ tone: 'warn', title: 'Water below 15 L per person per day (Sphere, initial)', body: `${fmt(w.available)} L available; ${fmt(w.needSphere)} L needed.`, module: 'camp' });
  else if (w.meetsJmc === false && e.camp.phase === 'long') a.push({ tone: 'info', title: 'Water below the JMC prolonged-period demand (52 L)', body: `${fmt(w.available)} L available; ${fmt(w.needJmc)} L for a prolonged stay.`, module: 'camp' });
  const t = toiletCheck(p, { male: e.camp.toilets_male, female: e.camp.toilets_female, accessible: e.camp.toilets_accessible }, e.camp.phase);
  for (const g of t.gaps) a.push({ tone: 'warn', title: 'Toilet gap', body: g, module: 'camp' });
  if (!site.accessible) a.push({ tone: 'warn', title: 'Accessibility not confirmed', body: 'Check accessible routes, toilets, bathing and assistance for persons with disability and older persons.', module: 'protection' });
  if (!site.clinic) a.push({ tone: 'warn', title: 'Health station not confirmed', body: 'Confirm the clinic, isolation area and referral arrangements with the CHO.', module: 'camp' });
  if (!site.cfs || !site.wfs) a.push({ tone: 'warn', title: 'Child- or women-friendly space missing', body: 'RA 12076 Sec. 4(c)(7) and the JMC call for both. Set them up with the CSWDO.', module: 'protection' });
  const open = e.feedback.filter((f) => f.status !== 'Closed');
  if (open.length) a.push({ tone: 'info', title: `${open.length} feedback item${open.length > 1 ? 's' : ''} open`, body: 'Review on Protection & Inclusion.', module: 'protection' });
  return a;
}

export function fmt(v: number | null | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString('en-PH') : 'Not reported';
}

/** Where the exercise stands, from what has been done: state before content. */
export function exercisePhase(e: Exercise): { step: 1 | 2 | 3 | 4; label: string } {
  const done = (prefix: string) => Object.entries(e.checks).some(([k, v]) => v && k.startsWith(prefix));
  if (done('closure-') || e.decisions.some((d) => /closure|close/i.test(d.action))) return { step: 4, label: 'Monitor and transition' };
  if (done('service-') || done('protect-') || (n(e.movement.received) ?? 0) > 0) return { step: 3, label: 'Manage and protect' };
  if (done('evac-') || e.movement.route === 'validated') return { step: 2, label: 'Evacuate and receive' };
  return { step: 1, label: 'Prepare and validate' };
}

// ---------------------------------------------------------------------------------------------- operational (synced) records
export type CampPhase = 'opening' | 'open' | 'consolidating' | 'closing' | 'closed';
/** Phases that record an authorised decision: an authority reference is required and only the EOC Manager or the Head files them. */
export const AUTHORITY_PHASES: CampPhase[] = ['opening', 'closing', 'closed'];

export interface CampReportLike extends Population {
  centre_id: string; activation_id: string | null; reported_at: string; phase: CampPhase;
  water_l_day: number | null; toilets_functional: number | null; bathing_functional: number | null; unmet_needs: string | null;
}

/** The latest report for each centre in a time window (the current activation). */
export function latestPerCentre<R extends CampReportLike>(reports: R[], from: string, to: string | null = null): R[] {
  const f = Date.parse(from); const t = to === null ? Infinity : Date.parse(to);
  const m = new Map<string, R>();
  for (const r of reports) {
    const at = Date.parse(r.reported_at);
    if (at < f || at > t) continue;
    const cur = m.get(r.centre_id);
    if (!cur || at > Date.parse(cur.reported_at)) m.set(r.centre_id, r);
  }
  return [...m.values()];
}

export interface CampTotals {
  centresOpen: number; families: number; persons: number; familiesNotReported: number; personsNotReported: number;
  children: number; older: number; pwd: number; female: number; pregnant: number; overCapacity: number; waterBelowSphere: number;
}
/** Totals inside evacuation centres. Closed centres do not count; a blank count is listed, not added as zero. */
export function campTotals(latest: CampReportLike[], capacity: Map<string, number | null>): CampTotals {
  const t: CampTotals = { centresOpen: 0, families: 0, persons: 0, familiesNotReported: 0, personsNotReported: 0, children: 0, older: 0, pwd: 0, female: 0,
    pregnant: 0, overCapacity: 0, waterBelowSphere: 0 };
  for (const r of latest) {
    if (r.phase === 'closed') continue;
    t.centresOpen++;
    if (n(r.families) === null) t.familiesNotReported++; else t.families += r.families!;
    if (n(r.persons) === null) t.personsNotReported++; else t.persons += r.persons!;
    t.children += n(r.children) ?? 0; t.older += n(r.older) ?? 0; t.pwd += n(r.pwd) ?? 0; t.female += n(r.female) ?? 0; t.pregnant += n(r.pregnant_lactating) ?? 0;
    const u = utilisation(r.persons, capacity.get(r.centre_id) ?? null);
    if (u !== null && u > 1) t.overCapacity++;
    if (waterCheck(r.persons, r.water_l_day).meetsSphere === false) t.waterBelowSphere++;
  }
  return t;
}

/** A plain-language summary for the SitRep "Situation" and "Needs" fields. */
export function sitrepCampText(t: CampTotals, gaps: string[]): { situation: string; needs: string } {
  const nr = t.personsNotReported ? ` ${t.personsNotReported} centre${t.personsNotReported > 1 ? 's have' : ' has'} not reported persons.` : '';
  const situation = `Inside evacuation centres (ECHO camp reports): ${t.families.toLocaleString('en-PH')} families, ${t.persons.toLocaleString('en-PH')} persons in ${t.centresOpen} open centre${t.centresOpen === 1 ? '' : 's'}.${nr} Of these: ${t.children.toLocaleString('en-PH')} children, ${t.older.toLocaleString('en-PH')} older persons, ${t.pwd.toLocaleString('en-PH')} persons with disability, ${t.pregnant.toLocaleString('en-PH')} pregnant or lactating women (aggregates as reported).`;
  const needs = gaps.length ? `Camp gaps (ECHO): ${gaps.join(' ')}` : '';
  return { situation, needs };
}

/** Problems with a camp report before it is saved. */
export function campReportProblems(r: CampReportLike & { authority_ref?: string | null; remarks?: string | null }): string[] {
  const out = populationProblems(r);
  if (AUTHORITY_PHASES.includes(r.phase) && !(r.authority_ref ?? '').trim())
    out.push('Opening, closing and closure record an authorised decision: give the authority reference (order, memo or logbook entry).');
  if (r.phase === 'open' && n(r.persons) === null) out.push('An open centre needs a persons count. Enter 0 if no one has arrived yet.');
  if ((r.unmet_needs ?? '').length > 1000) out.push('Keep unmet needs under 1,000 characters.');
  if ((r.remarks ?? '').length > 500) out.push('Keep remarks under 500 characters.');
  return out;
}

/** A centre's suitability from what is recorded about it. Screening only; never "safe". */
export function centreScreening(c: { verification_status: string; hazard_screening: string | null; structural_ref: string | null; is_school: boolean;
  ra12076: Record<string, string> }): { tone: Tone; label: string; notes: string[] } {
  const notes: string[] = [];
  if (c.verification_status === 'training') notes.push('Training site: not a real centre.');
  if (c.verification_status === 'pending_field_validation') notes.push('Inventory data not yet field-verified.');
  if (!c.hazard_screening) notes.push('No hazard screening recorded.');
  if (!c.structural_ref) notes.push('No structural assessment reference (RA 12076 Sec. 4(b)).');
  if (c.is_school) notes.push('School: last resort only (RA 10821).');
  const missing = RA12076_CHECKS.filter((k) => c.ra12076[k.key] === 'no').length;
  if (missing) notes.push(`${missing} RA 12076 facility item${missing > 1 ? 's' : ''} missing.`);
  const tone: Tone = c.verification_status === 'superseded' ? 'neutral' : notes.length === 0 ? 'ok' : missing || c.is_school || !c.structural_ref ? 'warn' : 'info';
  const label = c.verification_status === 'superseded' ? 'Superseded' : notes.length === 0 ? 'Screening complete' : 'Needs validation';
  return { tone, label, notes };
}

/** RA 12076 Sec. 4 minimum-standard items, as a readiness checklist. Recording "yes" does not certify compliance. */
export const RA12076_CHECKS = [
  { key: 'location', text: 'Central to the community, not likely to be isolated, away from danger zones (geohazard maps of MGB, PHIVOLCS, PAGASA)', ref: 'Sec. 4(a)' },
  { key: 'structure', text: 'Structural assessment confirms the design benchmark: winds of at least 300 kph, earthquakes of at least magnitude 8.0', ref: 'Sec. 4(b)' },
  { key: 'ventilation', text: 'Well ventilated; sized for the expected number of evacuees', ref: 'Sec. 4(c)' },
  { key: 'sleeping', text: 'Sleeping quarters', ref: 'Sec. 4(c)(1)' },
  { key: 'toilets', text: 'Separate male and female toilets and showers: 1 per 20 males, 1 per 20 females, 1 per 8 persons with disability or older persons', ref: 'Sec. 4(c)(2)' },
  { key: 'kitchen', text: 'Kitchen, food preparation and dining areas meeting DOH sanitation standards', ref: 'Sec. 4(c)(3), 4(d)' },
  { key: 'waste', text: 'Waste segregation and collection areas', ref: 'Sec. 4(c)(4)' },
  { key: 'health', text: 'Health care areas: isolation area, clinic, breastfeeding room, mental wellness space, counselling room', ref: 'Sec. 4(c)(5)' },
  { key: 'recreation', text: 'Recreation area', ref: 'Sec. 4(c)(6)' },
  { key: 'cfs_wfs', text: 'Women- and child-friendly spaces', ref: 'Sec. 4(c)(7)' },
  { key: 'rainwater', text: 'Rainwater harvesting and collection facilities', ref: 'Sec. 4(c)(8)' },
  { key: 'power', text: 'Standby power for lighting, medical and communication equipment', ref: 'Sec. 4(c)(9)' },
  { key: 'pumping', text: 'Powerhouse and standalone water pumping facilities', ref: 'Sec. 4(c)(10)' },
  { key: 'storage', text: 'Storage for food and non-food items', ref: 'Sec. 4(c)(11)' },
] as const;
