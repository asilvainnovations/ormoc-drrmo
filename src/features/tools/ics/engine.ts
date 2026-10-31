// ICS exercise engine: data types, scoring and doctrine references. No React here, so it is tested
// directly (engine.test.ts). Scenario content comes from ics-data.json, the Ormoc scenario set built
// on Philippine ICS doctrine (NDRRMC MC No. 4, s. 2012), the EOC guidelines (NDRRMC Memo No. 131,
// s. 2018), RA 10121, RA 12287 and its IRR, and RDRRMC 8 harmonized reporting.
import raw from './ics-data.json';

export type Verdict = 'best' | 'good' | 'weak' | 'unsafe';
/** Scores per option: [command, coordination, communication, decision, time], 0 to 100. */
export interface Option { t: string; v: Verdict; s: [number, number, number, number, number]; why: string; fx: Record<string, string> | null }
export interface Phase {
  stage: number; name: string; clock: string; eoc: 'white' | 'blue' | 'red';
  warn: { c: string; t: string }; stats: Record<'a' | 'b' | 'c' | 'd', string> | null; sl: string[] | null;
  situation: string[]; intel: string; hint: string; forms: string[]; discuss: string; opts: Option[];
}
export interface Scenario {
  id: string; name: string; type: string; icon: string; lead: string; blurb: string; context: string;
  res: Record<string, number>; phases: Phase[]; drill?: boolean;
}
export interface Role { id: string; abbr: string; name: string; who: string; desc: string; duties: string[] }
export interface RubricItem { id: Dimension; name: string; w: number; desc: string }
export interface Difficulty { id: 'beginner' | 'intermediate' | 'expert'; name: string; icon: string; limit: number; ttx: number; hint: boolean; desc: string }
export type Dimension = 'command' | 'coordination' | 'communication' | 'decision' | 'time';

interface Drill { name: string; situation: string[]; intel: string; hint: string; opts: Option[] }
interface Data {
  GLOSSARY: Record<string, string>; ROLES: Role[]; ROLE_TASKS: Record<string, string[]>; STAGES: string[];
  FORMS: Record<string, string>; REFERENCES: [string, string][]; RUBRIC: RubricItem[]; DIFFICULTY: Difficulty[];
  RES_LIB: Record<string, { n: string; i: string }>; SCENARIOS: Scenario[]; ALERT_INFO: Record<string, string>;
  HFORMS: Record<string, [string, string]>; STAGE_REPORT: { r: string; f: string[] }[]; DRILLS: Record<string, Drill[]>;
  LEARN: { id: string; t: string; h: string }[]; QUIZ: { q: string; o: string[]; a: number; w: string }[];
}
export const ICS = raw as unknown as Data;

export const VERDICT: Record<Verdict, { label: string; tone: 'ok' | 'info' | 'warn' | 'bad' }> = {
  best: { label: 'Best practice', tone: 'ok' }, good: { label: 'Acceptable', tone: 'info' },
  weak: { label: 'Weak', tone: 'warn' }, unsafe: { label: 'Unsafe or non-compliant', tone: 'bad' },
};

/** Order in which the spotlight moves round the table in a facilitated tabletop (TTX). */
export const TTX_ROTATION = ['ic', 'osc', 'psc', 'lsc', 'pio', 'sofr', 'lofr', 'fsc', 'eoc', 'ro'];

export const roleOf = (id: string) => ICS.ROLES.find((r) => r.id === id)!;
export const difficultyOf = (id: string) => ICS.DIFFICULTY.find((d) => d.id === id) ?? ICS.DIFFICULTY[1]!;

/** A three-decision drill for one position, set in Ormoc. */
export function buildDrill(roleId: string): Scenario {
  const r = roleOf(roleId); const set = ICS.DRILLS[roleId] ?? [];
  return {
    id: `drill-${roleId}`, drill: true, name: `Position drill: ${r.abbr}`, type: 'Position-specific drill', icon: '🎯', lead: r.name,
    blurb: `Three quick decisions that test the ${r.name}'s job under Philippine ICS doctrine, set in Ormoc.`,
    context: 'Short drills adapted from typhoon, flood and landslide operations. They focus on one position\'s decisions, not the whole incident.',
    res: { rescue: 8, ems: 10, pnp: 20, radio: 12 },
    phases: set.map((d, i) => ({
      stage: [0, 2, 3][i] ?? 2, name: d.name, clock: `Drill ${i + 1} of ${set.length}`, eoc: i === 2 ? 'blue' : 'red',
      warn: { c: 'warn-b', t: `Position drill: ${r.abbr}` }, stats: null, sl: null, situation: d.situation, intel: d.intel,
      hint: d.hint, forms: ['213', '214'], discuss: 'What would you do differently in your own office?', opts: d.opts,
    })),
  };
}

export function scenarioOf(id: string): Scenario | undefined {
  return id.startsWith('drill-') ? buildDrill(id.slice(6)) : ICS.SCENARIOS.find((s) => s.id === id);
}

/** Whose turn it is: the participant's own role, or the rotating spotlight in a tabletop. */
export function spotlight(mode: 'single' | 'multi', roleId: string, phase: number): Role {
  if (mode !== 'multi') return roleOf(roleId);
  const i = Math.max(0, TTX_ROTATION.indexOf(roleId));
  return roleOf(TTX_ROTATION[(i + phase) % TTX_ROTATION.length]!);
}

export type Scores = Record<Dimension, number>;
export interface Pick {
  phase: number; name: string; clock: string; choice: string; verdict: Verdict; why: string; best: string; bestWhy: string;
  scores: Scores; secs: number; intel: boolean; hint: boolean; timeout: boolean; role: string; refs: string[]; fx: string[];
}

export const TIMEOUT_OPTION: Option = {
  t: 'No decision within the time available.', v: 'unsafe', s: [25, 20, 20, 15, 5],
  why: 'Inaction is a decision. While the EOC deliberated, the warning lead time was used up.', fx: null,
};

/**
 * Score one decision. Timeliness keeps full marks for the first half of the time allowed, then
 * falls to 60% at the limit; asking for intel or a hint costs timeliness points.
 */
export function scoreDecision(opt: Option, secsUsed: number, secsAllowed: number, used: { intel: boolean; hint: boolean; expert: boolean }): Scores {
  const frac = secsAllowed > 0 ? Math.min(1, Math.max(0, secsUsed / secsAllowed)) : 0;
  const tmult = frac <= 0.5 ? 1 : Math.max(0.6, 1 - (0.4 * (frac - 0.5)) / 0.5);
  let time = Math.round(opt.s[4] * tmult);
  if (used.intel) time -= used.expert ? 4 : 2;
  if (used.hint) time -= 3;
  return { command: opt.s[0], coordination: opt.s[1], communication: opt.s[2], decision: opt.s[3], time: Math.max(0, time) };
}

/** Average per dimension, and the weighted total (rubric weights add up to 1). */
export function metrics(picks: Pick[]): Scores & { total: number } {
  const m = {} as Scores & { total: number };
  for (const c of ICS.RUBRIC) m[c.id] = picks.length ? Math.round(picks.reduce((a, p) => a + p.scores[c.id], 0) / picks.length) : 0;
  m.total = Math.round(ICS.RUBRIC.reduce((a, c) => a + m[c.id] * c.w, 0));
  return m;
}

export const band = (v: number) => (v >= 85 ? 'Exemplary' : v >= 70 ? 'Proficient' : v >= 55 ? 'Developing' : 'Needs further training');

const DOCTRINE_PATTERNS: [RegExp, string][] = [
  [/RA 12287/, 'RA 12287 and IRR (State of Imminent Disaster, anticipatory action)'], [/RA 10121|state of calamity|Sec\. 16/i, 'RA 10121 (DRRM Act)'],
  [/MC No\. 19|MDM|dead and missing/i, 'NDRRMC MC No. 19, s. 2016 (MDM)'], [/AO No\. 155|\bMCI\b|\bSTART\b|[Tt]riage/, 'DOH AO No. 155, s. 2004 (MCI)'],
  [/RDANA/, 'NDRRMC RDANA guidelines (2014)'], [/PDRA/, 'NDRRMC Memo No. 17, s. 2014 (PDRA)'], [/check-in|ICS 211|offers|augmentation/i, 'NDRRMC Memo Nos. 43 and 44, s. 2016 (IMT)'],
  [/PAGASA|Signal|rainfall/i, 'PAGASA warning system'], [/PHIVOLCS|PEIS|tsunami/i, 'PHIVOLCS bulletins and PEIS'], [/RA 12076|evacuation center|ECs/i, 'RA 12076 (Ligtas Pinoy Centers)'],
  [/MARINA|PCG/, 'PCG maritime SAR mandate'], [/EMB/, 'DENR-EMB (air and water quality)'], [/leptospirosis/i, 'DOH leptospirosis protocol'],
  [/Memo No\. 131|co-located|resource request|through the EOC|clusters? (?:and|to)|terminat/i, 'NDRRMC Memo No. 131, s. 2018 (EOC)'],
  [/2 hours|09:00|harmonized|Forms? [A-L]\b|SitRep|Dead \(confirmed|verification/i, 'RDRRMC 8 Res. No. 12-006 (harmonized reporting)'],
  [/RA 12009|procurement/i, 'RA 12009 (New Government Procurement Act)'], [/geohazard|MGB|runout|scarp/i, 'MGB geohazard assessment'],
  [/CLUP|zoning/i, 'Ormoc CLUP and Zoning Ordinance'], [/Unified Command/, 'NDRRMC MC No. 4, s. 2012 (Unified Command)'],
];

/** The instruments a decision and its explanation rest on (ICS doctrine always applies). */
export function doctrineFor(...texts: string[]): string[] {
  const t = texts.join(' ');
  const out = new Set(['NDRRMC MC No. 4, s. 2012 (ICS)']);
  for (const [re, label] of DOCTRINE_PATTERNS) if (re.test(t)) out.add(label);
  return [...out];
}

/** Fisher–Yates shuffle (options appear in a new order every run). */
export function shuffled<T>(xs: T[], rnd: () => number = Math.random): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

export interface RunRecord {
  id: string; at: string; participant: string; office: string; facilitator?: string; mode: 'single' | 'multi';
  role: string; scenario: string; scenarioName: string; difficulty: string; seconds: number;
  scores: Scores & { total: number }; picks: Pick[];
}
