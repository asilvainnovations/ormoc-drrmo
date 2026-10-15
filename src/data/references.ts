// Plain-language notes on the laws, issuances and frameworks the IAT and the manuals cite.
//
// Sources and limits (keep these when editing):
// - Titles are the official short titles. Summaries say what an instrument governs, at the
//   level of the whole instrument or of a section whose subject is well established.
// - Sub-items such as "Sec. 12(c)(8)" are NOT paraphrased: the note explains the section and
//   leaves the item to the official text. A wrong summary of a legal provision is worse
//   than none.
// - RA 12287 IRR rule topics and UNDRR Scorecard item subjects come from the verified IAT
//   v1.1 crosswalk (framework_crosswalk), not from this file.
// Every note ends with "The official text governs." in the UI.

export type RefKind = 'law' | 'irr' | 'issuance' | 'framework' | 'agency' | 'practice';
export interface Instrument {
  key: string; title: string; kind: RefKind; summary: string;
  /** Known section subjects, keyed by section number as written ("12", "21"). */
  sections?: Record<string, string>;
  /** Section items that should send the reader to the official text, e.g. RA 10121 Sec. 12(c). */
  itemNote?: Record<string, string>;
}

const I = (x: Instrument) => x;
export const INSTRUMENTS: Instrument[] = [
  // ---------------------------------------------------------------- core DRRM law
  I({ key: 'RA 10121', kind: 'law', title: 'Republic Act No. 10121, the Philippine Disaster Risk Reduction and Management Act of 2010',
    summary: 'The national law on disaster risk reduction and management. It creates the NDRRMC and the local DRRM councils and offices, sets their functions, and establishes the DRRM funds.',
    sections: {
      '2': 'Declaration of policy: the State’s policy to uphold the right to life and property and to adopt a holistic, proactive approach to disaster risk reduction, including mainstreaming DRR and climate change adaptation in development plans.',
      '11': 'Organization at the local level: creates the provincial, city and municipal DRRM councils (LDRRMCs) and sets their membership and functions.',
      '12': 'Local DRRM Office (LDRRMO): requires every province, city and municipality to establish a DRRM office, sets its head and staffing, and lists its functions.',
      '13': 'Accreditation, mobilization and protection of disaster volunteers, national service reserve corps, civil society organizations and the private sector.',
      '14': 'Integration of DRR education in school curricula and youth programs, and mandatory DRR training for public sector employees.',
      '16': 'Declaration of a state of calamity: who may declare it (the President, or the local sanggunian upon recommendation of the LDRRMC) and when it is lifted.',
      '21': 'Local DRRM Fund (LDRRMF): not less than 5% of the estimated revenue from regular sources, with 30% as a Quick Response Fund; unexpended balances go to a special trust fund for use within five years.',
    },
    itemNote: { '12(c)': 'Sec. 12(c) lists the functions of the local DRRM office. The item number points to the specific function this indicator relies on; read it in the official text.' } }),
  I({ key: 'RA 10121 IRR', kind: 'irr', title: 'Implementing Rules and Regulations of RA 10121',
    summary: 'The rules issued by the NDRRMC to carry out RA 10121, including the organization, functions and staffing of local DRRM offices.' }),
  I({ key: 'RA 12287', kind: 'law', title: 'Republic Act No. 12287, the law on the declaration of a State of Imminent Disaster and anticipatory action',
    summary: 'Allows a State of Imminent Disaster to be declared before a forecast hazard strikes, so that anticipatory actions (prepositioning, pre-emptive evacuation, early support) can be taken and funded within the lead time.' }),
  I({ key: 'RA 12287 IRR', kind: 'irr', title: 'Implementing Rules and Regulations of RA 12287 (signed 14 September 2026)',
    summary: 'Sets how a State of Imminent Disaster is requested, declared, implemented, funded, lifted and reported, and lists the anticipatory actions by sector. Rules I to VII.' }),
  // ---------------------------------------------------------------- other laws
  I({ key: 'RA 7160', kind: 'law', title: 'Republic Act No. 7160, the Local Government Code of 1991',
    summary: 'The charter of local government powers, including planning, budgeting and the councils of cities and municipalities.',
    sections: { '33': 'Cooperative undertakings among local government units: LGUs may group together and pool resources, for example through mutual aid agreements.' } }),
  I({ key: 'RA 9729', kind: 'law', title: 'Republic Act No. 9729, the Climate Change Act of 2009',
    summary: 'Mainstreams climate change in policy and creates the Climate Change Commission; LGUs prepare Local Climate Change Action Plans (LCCAP).' }),
  I({ key: 'RA 10174', kind: 'law', title: 'Republic Act No. 10174, amending the Climate Change Act and creating the People’s Survival Fund',
    summary: 'Creates the People’s Survival Fund, which finances local climate change adaptation projects that LGUs can apply for.' }),
  I({ key: 'RA 10173', kind: 'law', title: 'Republic Act No. 10173, the Data Privacy Act of 2012',
    summary: 'Protects personal information. The City, as controller, must have a Data Protection Officer, a lawful basis for processing, data-sharing agreements and security measures. Enforced by the National Privacy Commission.' }),
  I({ key: 'RA 10639', kind: 'law', title: 'Republic Act No. 10639, the Free Mobile Disaster Alerts Act',
    summary: 'Requires mobile service providers to send free alerts to subscribers in areas likely to be affected by an impending disaster.' }),
  I({ key: 'RA 10821', kind: 'law', title: 'Republic Act No. 10821, the Children’s Emergency Relief and Protection Act',
    summary: 'Requires protection of children during and after disasters, including child-friendly spaces and limits on using schools as evacuation centers.' }),
  I({ key: 'RA 12076', kind: 'law', title: 'Republic Act No. 12076, the Ligtas Pinoy Centers Act',
    summary: 'Requires permanent, safe and inclusive evacuation centers in every city and municipality, with minimum standards.' }),
  I({ key: 'RA 12009', kind: 'law', title: 'Republic Act No. 12009, the New Government Procurement Act',
    summary: 'The procurement law for government. It includes emergency procurement modes and framework agreements that allow quick purchases in disasters.' }),
  I({ key: 'RA 11036', kind: 'law', title: 'Republic Act No. 11036, the Mental Health Act',
    summary: 'Establishes mental health services, including psychosocial support, which DRRM plans use for affected people and responders (MHPSS).' }),
  I({ key: 'RA 11106', kind: 'law', title: 'Republic Act No. 11106, the Filipino Sign Language Act',
    summary: 'Declares Filipino Sign Language the national sign language and requires its use in public information, including emergency broadcasts.' }),
  I({ key: 'RA 7277', kind: 'law', title: 'Republic Act No. 7277, the Magna Carta for Disabled Persons (as amended)',
    summary: 'Rights and accessibility for persons with disabilities, applied in DRRM to accessible warnings, evacuation and services.' }),
  I({ key: 'RA 9710', kind: 'law', title: 'Republic Act No. 9710, the Magna Carta of Women',
    summary: 'Women’s rights, including protection and gender-responsive services in disasters, and gender and development (GAD) planning and budgeting.' }),
  I({ key: 'RA 9994', kind: 'law', title: 'Republic Act No. 9994, the Expanded Senior Citizens Act of 2010',
    summary: 'Rights and benefits of senior citizens, applied in DRRM to priority assistance and accessible services.' }),
  I({ key: 'RA 8371', kind: 'law', title: 'Republic Act No. 8371, the Indigenous Peoples’ Rights Act of 1997',
    summary: 'Recognizes the rights of indigenous peoples, including participation in decisions that affect them.' }),
  I({ key: 'RA 11315', kind: 'law', title: 'Republic Act No. 11315, the Community-Based Monitoring System (CBMS) Act',
    summary: 'Requires LGUs to run the CBMS household survey, used to identify and prioritize families for assistance.' }),
  I({ key: 'RA 7581', kind: 'law', title: 'Republic Act No. 7581, the Price Act',
    summary: 'Price stabilization of basic necessities, including automatic price freezes in areas under a state of calamity, and penalties for profiteering.' }),
  I({ key: 'RA 11589', kind: 'law', title: 'Republic Act No. 11589, the Bureau of Fire Protection Modernization Act',
    summary: 'Modernizes the BFP, the lead agency for fire suppression and an emergency response partner of the City.' }),
  I({ key: 'RA 11292', kind: 'law', title: 'Republic Act No. 11292, the Seal of Good Local Governance Act of 2019',
    summary: 'The SGLG award system for LGUs. Disaster preparedness is one of its assessment areas.' }),
  I({ key: 'PD 1096', kind: 'law', title: 'Presidential Decree No. 1096, the National Building Code of the Philippines',
    summary: 'Building safety rules, enforced locally by the Building Official through permits and inspections.' }),
  I({ key: 'NSCP', kind: 'issuance', title: 'National Structural Code of the Philippines',
    summary: 'Structural design standards, including earthquake and wind loads, referenced by the Building Code.' }),
  I({ key: 'EO 56 s. 2018', kind: 'issuance', title: 'Executive Order No. 56, s. 2018 (E911)',
    summary: 'As cited by the IAT: the national 911 emergency hotline that local hotlines and dispatch connect to.' }),
  // ---------------------------------------------------------------- issuances
  I({ key: 'JMC 2014-1', kind: 'issuance', title: 'NDRRMC-DILG-DBM-CSC Joint Memorandum Circular No. 2014-1',
    summary: 'Guidelines on establishing local DRRM offices: their structure (administration and training, research and planning, operations and warning) and plantilla positions.' }),
  I({ key: 'JMC 2013-1', kind: 'issuance', title: 'NDRRMC-DBM-DILG Joint Memorandum Circular No. 2013-1',
    summary: 'Allocation and use of the Local DRRM Fund: what the 70% (mitigation and preparedness) and the 30% Quick Response Fund may pay for, and the annual LDRRMF Investment Plan.' }),
  I({ key: 'COA Circular 2012-002', kind: 'issuance', title: 'Commission on Audit Circular No. 2012-002',
    summary: 'Accounting and reporting rules for the DRRM funds, including the LDRRMF and its special trust fund.' }),
  I({ key: 'NDRRMC MC No. 4 s. 2012', kind: 'issuance', title: 'NDRRMC Memorandum Circular No. 4, s. 2012',
    summary: 'Implementing guidelines on the Incident Command System (ICS) as the on-scene response management system.' }),
  I({ key: 'NDCC MC No. 12 s. 2008', kind: 'issuance', title: 'NDCC Memorandum Circular No. 12, s. 2008',
    summary: 'Institutionalizes the cluster approach in disaster management, with lead agencies per cluster (food and NFI, health, WASH, logistics and others).' }),
  I({ key: 'NDRRMC EOC Guidelines', kind: 'issuance', title: 'NDRRMC guidelines on Emergency Operations Centers',
    summary: 'National guidance on setting up and running EOCs: activation levels, organization, facilities and reporting. Confirm the current memorandum circular number with OCD VIII.' }),
  I({ key: 'NDRRMP', kind: 'framework', title: 'National Disaster Risk Reduction and Management Plan 2020-2030',
    summary: 'The national plan under RA 10121, organized in four pillars: prevention and mitigation, preparedness, response, and rehabilitation and recovery.' }),
  I({ key: 'PSCP Guidebook', kind: 'issuance', title: 'NDRRMC/OCD Public Service Continuity Plan Guidebook',
    summary: 'How government offices plan to keep essential services running during and after a disruption: essential functions, alternate sites, succession and recovery.' }),
  I({ key: 'Operation L!sto', kind: 'issuance', title: 'DILG Operation L!sto',
    summary: 'DILG’s disaster preparedness protocols and checklists for local chief executives and LGUs, by alert level.' }),
  I({ key: 'GKS', kind: 'issuance', title: 'Gawad KALASAG Seal',
    summary: 'The NDRRMC’s recognition program for excellence in DRRM, which assesses LDRRMO and council functionality.' }),
  I({ key: 'CDRA', kind: 'issuance', title: 'Climate and Disaster Risk Assessment (DHSUD and Climate Change Commission guidelines)',
    summary: 'The method LGUs use to assess hazard, exposure and vulnerability for land use and development planning (CLUP and CDP).' }),
  I({ key: 'CLUP', kind: 'issuance', title: 'Comprehensive Land Use Plan and Zoning Ordinance',
    summary: 'The City’s land use plan and its zoning ordinance, where hazard-based zoning and no-build zones are set.' }),
  // ---------------------------------------------------------------- frameworks
  I({ key: 'Sendai Framework', kind: 'framework', title: 'Sendai Framework for Disaster Risk Reduction 2015-2030',
    summary: 'The UN global framework with seven targets (A to G) on reducing disaster deaths, affected people, losses and damage, and on strategies, cooperation and early warning.' }),
  I({ key: 'UNDRR DRSC', kind: 'framework', title: 'UNDRR Disaster Resilience Scorecard for Cities (Detailed Level, 2017)',
    summary: 'A self-assessment of city resilience organized around the Ten Essentials for Making Cities Resilient. The IAT adopts selected criteria and keeps each traceable to its Scorecard number.' }),
  I({ key: 'ICS', kind: 'practice', title: 'Incident Command System',
    summary: 'A standard on-scene management system with a single incident commander and defined functions (operations, planning, logistics, finance). Adopted nationally through NDRRMC MC No. 4, s. 2012.' }),
  // ---------------------------------------------------------------- agencies
  I({ key: 'NDRRMC', kind: 'agency', title: 'National Disaster Risk Reduction and Management Council', summary: 'The national policy-making and coordinating body for DRRM under RA 10121. The Office of Civil Defense is its secretariat.' }),
  I({ key: 'OCD', kind: 'agency', title: 'Office of Civil Defense', summary: 'Secretariat and executive arm of the NDRRMC. OCD Region VIII covers Eastern Visayas, including Ormoc.' }),
  I({ key: 'DILG', kind: 'agency', title: 'Department of the Interior and Local Government', summary: 'Oversees local governments and issues memorandum circulars on local DRRM, such as Operation L!sto.' }),
  I({ key: 'DSWD', kind: 'agency', title: 'Department of Social Welfare and Development', summary: 'Lead for food and non-food items and camp coordination; sets standards for relief and evacuation center management, including the DAFAC family card.' }),
  I({ key: 'DICT', kind: 'agency', title: 'Department of Information and Communications Technology', summary: 'National ICT and cybersecurity policy, including the National Cybersecurity Plan.' }),
  I({ key: 'NTC', kind: 'agency', title: 'National Telecommunications Commission', summary: 'Licenses radio stations and assigns frequencies, including those used by the City’s radio network.' }),
  I({ key: 'PAGASA', kind: 'agency', title: 'PAGASA and PHIVOLCS', summary: 'PAGASA issues weather, flood and tropical cyclone bulletins; PHIVOLCS issues earthquake, tsunami and volcano advisories.' }),
  I({ key: 'CSC', kind: 'agency', title: 'Civil Service Commission', summary: 'Sets qualification standards (QS) and rules for government positions, including DRRM plantilla posts.' }),
  I({ key: 'NPC', kind: 'agency', title: 'National Privacy Commission', summary: 'Enforces the Data Privacy Act and issues circulars on registration, breach reporting and security.' }),
  I({ key: 'COA', kind: 'agency', title: 'Commission on Audit', summary: 'Audits government funds, including the LDRRMF, and issues annual audit reports (AAR) with findings the City must act on.' }),
  I({ key: 'DPWH', kind: 'agency', title: 'Department of Public Works and Highways', summary: 'National roads and bridges, and structural assessment support. Its district office covers Ormoc.' }),
  I({ key: 'DepEd', kind: 'agency', title: 'Department of Education (and DOH for health facilities)', summary: 'DepEd sets DRRM policy for schools; DOH sets it for health facilities, including the Safe Schools and Safe Hospitals programs.' }),
  I({ key: 'Good practice', kind: 'practice', title: 'Good practice', summary: 'No law requires this; it is recognized good practice in DRRM and emergency management. The IAT scores it as a Good Practice indicator.' }),
];

const BY_KEY = new Map(INSTRUMENTS.map((x) => [x.key, x]));
export const instrument = (key: string) => BY_KEY.get(key);

/** Patterns that recognize an instrument inside a citation, most specific first. */
const MATCHERS: [RegExp, string][] = [
  [/\bRA\s*12287\s+IRR\b/i, 'RA 12287 IRR'],
  [/\bRA\s*12287\b/i, 'RA 12287'],
  [/\bRA\s*10121\b/i, 'RA 10121'],
  [/\bRA\s*(10174)\b|People.s Survival Fund/i, 'RA 10174'],
  [/\bRA\s*(\d{4,5})\b/i, 'RA $1'],
  [/\bPD\s*1096\b|\bNBC\b/i, 'PD 1096'],
  [/\bNSCP\b/i, 'NSCP'],
  [/\bEO\s*56\b/i, 'EO 56 s. 2018'],
  [/\bJMC\s*2014-1\b/i, 'JMC 2014-1'],
  [/\bJMC\s*2013-1\b/i, 'JMC 2013-1'],
  [/COA Circular 2012-002/i, 'COA Circular 2012-002'],
  [/NDRRMC MC No\.?\s*4,?\s*s\.?\s*2012/i, 'NDRRMC MC No. 4 s. 2012'],
  [/NDCC MC (No\.?\s*)?12/i, 'NDCC MC No. 12 s. 2008'],
  [/EOC Guidelines|NDRRMC MC No\.?\s*131/i, 'NDRRMC EOC Guidelines'],
  [/\bNDRRMP\b|NDRRM Plan/i, 'NDRRMP'],
  [/PSCP/i, 'PSCP Guidebook'],
  [/L!sto|Listo/i, 'Operation L!sto'],
  [/\bGKS\b|KALASAG/i, 'GKS'],
  [/\bCDRA\b/i, 'CDRA'],
  [/\bCLUP\b/i, 'CLUP'],
  [/Sendai/i, 'Sendai Framework'],
  [/UNDRR|DRSC/i, 'UNDRR DRSC'],
  [/^ICS\b|\bICS resource/i, 'ICS'],
  [/\bSGLG\b/i, 'RA 11292'],
  [/\bNPC\b/i, 'NPC'],
  [/\bCSC\b/i, 'CSC'],
  [/\bNTC\b/i, 'NTC'],
  [/\bDICT\b/i, 'DICT'],
  [/\bDSWD\b/i, 'DSWD'],
  [/\bDILG\b/i, 'DILG'],
  [/PAGASA|PHIVOLCS/i, 'PAGASA'],
  [/^OCD\b|\bOCD\//i, 'OCD'],
  [/\bNDRRMC\b/i, 'NDRRMC'],
  [/^COA\b/i, 'COA'],
  [/\bDPWH\b/i, 'DPWH'],
  [/DepEd|DOH|Safe Schools/i, 'DepEd'],
  [/good practice/i, 'Good practice'],
];

export interface Citation {
  text: string;            // as written in the source
  key?: string;            // instrument key, when recognized
  section?: string;        // "21", "12(c)(8)", "Rule IV Sec. 2(a)"
  drsc?: string[];         // UNDRR Scorecard item numbers
}

/** Split a reference field ("RA 10121 Sec. 12; IRR Rule 6; JMC 2014-1") into citations.
 *  Parts that name no instrument inherit the previous one ("Rule III Secs. 2-4" after an IRR). */
export function parseCitations(text: string | null | undefined, context: 'indicator' | 'aa' = 'indicator'): Citation[] {
  if (!text) return [];
  const out: Citation[] = [];
  let last: string | undefined;
  for (const raw of text.split(';')) {
    const part = raw.trim();
    if (!part) continue;
    let key: string | undefined;
    for (const [re, k] of MATCHERS) {
      const m = part.match(re);
      if (m) { key = k.includes('$1') ? k.replace('$1', m[1]!) : k; break; }
    }
    const bareIrr = /^IRR\b/i.test(part);
    const bareSection = /^(Rule|Secs?\.)/i.test(part);
    if (!key && (bareIrr || bareSection)) {
      if (bareIrr) key = last === 'RA 10121' || last === 'RA 10121 IRR' ? 'RA 10121 IRR' : (context === 'aa' || last?.startsWith('RA 12287') ? 'RA 12287 IRR' : last ? `${last} IRR` : undefined);
      else key = last;
    }
    if (key && !BY_KEY.has(key)) key = undefined;
    const c: Citation = { text: part, key };
    const rule = part.match(/Rule\s+([IVX]+|\d+)(?:\s+Secs?\.\s*([\d(),\-–a-z\s]+))?/i);
    const sec = part.match(/Secs?\.\s*([\d]+(?:\([a-z0-9]+\))*)/i);
    if (rule) c.section = `Rule ${rule[1]}${rule[2] ? ` Sec. ${rule[2].trim()}` : ''}`;
    else if (sec) c.section = sec[1];
    const drsc = part.match(/DRSC\s+((?:\d+\.\d+(?:\.\d+)?(?:,\s*)?)+|Essential\s+\d+)/i);
    if (drsc) c.drsc = drsc[1]!.split(/,\s*/).map((x) => x.replace(/^Essential\s+/i, 'Ess. '));
    if (key) last = key;
    out.push(c);
  }
  return out;
}

/** "Rule II Sec. 6; Rule III Secs. 2-4" -> [{II,6},{III,2},{III,3},{III,4}]; "Rule VII" -> [{VII,null}]. */
export function irrSections(ref: string): { rule: string; sec: number | null }[] {
  const out: { rule: string; sec: number | null }[] = [];
  for (const m of ref.matchAll(/Rule\s+([IVX]+)(?:\s+Secs?\.\s*([\d,\s\-–]+))?/gi)) {
    const rule = m[1]!.toUpperCase();
    if (!m[2]) { out.push({ rule, sec: null }); continue; }
    for (const piece of m[2].split(',')) {
      const [a, b] = piece.split(/[-–]/).map((x) => parseInt(x, 10));
      if (Number.isNaN(a)) continue;
      for (let n = a!; n <= (b && !Number.isNaN(b) ? b : a!); n++) out.push({ rule, sec: n });
    }
  }
  return out;
}

/** What to say about one citation, given the crosswalk rows (framework, ref, subject). */
export function explain(c: Citation, crosswalk: { framework: string; ref: string; subject: string }[]) {
  const ins = c.key ? instrument(c.key) : undefined;
  const lines: string[] = [];
  if (ins && c.section) {
    const base = c.section.replace(/\(.*/, '');
    const item = c.section.match(/^(\d+\([a-z]\))/i)?.[1];
    if (ins.sections?.[c.section]) lines.push(`Sec. ${c.section}: ${ins.sections[c.section]}`);
    else if (item && ins.itemNote?.[item]) {
      if (ins.sections?.[base]) lines.push(`Sec. ${base}: ${ins.sections[base]}`);
      lines.push(ins.itemNote[item]!);
    } else if (ins.sections?.[base]) lines.push(`Sec. ${base}: ${ins.sections[base]}`);
    if (c.key === 'RA 12287 IRR') {
      const want = irrSections(c.section);
      const hits = crosswalk.filter((r) => r.framework.includes('12287') && irrSections(r.ref).some((x) => want.some((w) => w.rule === x.rule && (w.sec === null || x.sec === null || w.sec === x.sec))));
      // Prefer rows that name the exact section over rule-level rows.
      hits.sort((p, q) => Number(irrSections(q.ref).some((x) => x.sec !== null)) - Number(irrSections(p.ref).some((x) => x.sec !== null)));
      for (const h of hits.slice(0, 2)) lines.push(`IAT crosswalk, ${h.ref}: ${h.subject}.`);
    }
  }
  if (c.drsc) {
    for (const n of c.drsc) {
      const row = crosswalk.find((r) => r.framework === 'UNDRR DRSC' && (r.ref === n || r.ref.split(/[,\-–]/)[0] === n || r.ref.startsWith(`${n}-`)));
      lines.push(row ? `Scorecard ${n}: ${row.subject}.` : `Scorecard ${n}.`);
    }
  }
  return { title: ins?.title ?? c.text, summary: ins?.summary, details: lines };
}
