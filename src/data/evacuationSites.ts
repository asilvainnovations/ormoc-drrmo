// Evacuation sites for ECHO's Evacuation intelligence map (1.26.0).
//
// 1. CITY_LIST: the evacuation centres on the CDRRMO list "Ormoc City Evacuation Center" (received 19 Nov 2026). The
//    operational seed supabase/seed/operational/10_city_evacuation_centers.sql adds them to the synced inventory as
//    pending field validation; until it runs, the map shows them from here. Once a centre with the same code is in the
//    inventory, the inventory record is shown instead.
// 2. OPEN_AREAS: POSSIBLE open areas, overflow venues, assembly areas and logistics hubs, proposed by the lead assessor
//    from public records and the City's disaster history. Each is a candidate for survey, NOT a designation: it becomes an
//    evacuation site only when the CDRRMO, CPDO, City Engineer and CSWDO have assessed it against SITE_CRITERIA and the
//    CDRRMC has endorsed it. Locations are approximate (the barangay's centre) unless a point is given.
// The official list, the barangay names and the PSGC codes govern; the field survey corrects anything here.

export interface CityListCentre { code: string; name: string; psgc: string; lat: number; lng: number; flags: string[] }

export const CITY_LIST_SOURCE = 'CDRRMO list "Ormoc City Evacuation Center" (2 pages, received 19 Nov 2026)';
export const CITY_LIST: CityListCentre[] = [
  { code: 'EC-DANHUG-01', name: 'Danhug Evacuation Center', psgc: '0803738107', lat: 10.962224, lng: 124.649089,
    flags: ['The point falls about 90 m inside Macabug on the PSGC boundary file; the list\'s map card reads "Macabug". Confirm the barangay and point.'] },
  { code: 'EC-MARGEN-01', name: 'Margen Evacuation Center', psgc: '0803738067', lat: 11.016927, lng: 124.530208,
    flags: ['Pinned building sits beside the health centre, the elementary school and the covered court. Confirm which building is the centre.'] },
  { code: 'EC-CURVA-01', name: 'Curva Evacuation Center', psgc: '0803738018', lat: 11.038759, lng: 124.533791,
    flags: ['The list gives latitude 10.038759, a point in the sea about 100 km south. 11.038759 falls in Curva by the Ormoc–Palompon road and is used. Confirm on site.'] },
  { code: 'EC-DOLORES-01', name: 'Dolores Evacuation Center (Station 1)', psgc: '0803738049', lat: 11.093532, lng: 124.634764,
    flags: ['Point from the list\'s map card, near the NHA site. Ormoc City Evacuation Center Station 1 was turned over there on 10 Mar 2023. Confirm the building.'] },
];

export type OpenAreaRole = 'camp_site' | 'covered_overflow' | 'assembly' | 'logistics';
export const OPEN_AREA_ROLE: Record<OpenAreaRole, { label: string; tip: string }> = {
  camp_site: { label: 'Possible camp site', tip: 'Open ground that might hold tents or modular shelters after survey (Sphere: 45 m² of site per person)' },
  covered_overflow: { label: 'Possible overflow venue', tip: 'A covered venue that might take people when centres fill, after a structural check' },
  assembly: { label: 'Assembly area only', tip: 'Short-stay open space, mainly for earthquakes; not a place to stay overnight in a typhoon' },
  logistics: { label: 'Logistics hub', tip: 'Pre-positioning or staging for camp supplies; not a place for evacuees' },
};

export interface OpenArea {
  id: string; name: string; role: OpenAreaRole;
  /** PSGC of the barangay; null when the barangay is not confirmed (listed, not mapped). */
  psgc: string | null;
  basis: string; source?: { title: string; url: string };
  cautions: string[];
  /** Hazards this site is a candidate for. 'all' means not hazard-specific. */
  hazards: ('typhoon' | 'flood' | 'earthquake' | 'fire' | 'all')[];
}

export const OPEN_AREAS: OpenArea[] = [
  { id: 'OA-JUATON-SPORTS', name: 'Ormoc City Sports Complex grounds', role: 'camp_site', psgc: '0803738112', hazards: ['typhoon', 'flood', 'earthquake'],
    basis: 'City sports hub in Juaton: DPWH multi-purpose building (2025), pump track and skate park, a track-and-field facility due in late 2027 and a convention centre under construction. Large public open ground plus covered halls.',
    source: { title: 'SunStar: PSC chief hails Ormoc\'s sports push (Aug 2026)', url: 'https://www.sunstar.com.ph/cebu/psc-chief-hails-ormocs-sports-push' },
    cautions: ['Construction continues to 2027: keep camps off work areas and new sports surfaces.', 'Measure the usable open area; capacity = area ÷ 45 m².', 'Confirm title and custodian office with the CPDO and the City Assessor.'] },
  { id: 'OA-COGON-DTAN', name: 'Dominador Tan Ruins sports facilities', role: 'covered_overflow', psgc: '0803738016', hazards: ['earthquake', 'fire'],
    basis: 'New City sports facilities (wall climbing, karate, modern pentathlon) opened 20 Oct 2026; the report says Barangay Cogon (PSGC: Cogon Combado).',
    source: { title: 'Daily Tribune: new Ormoc sports facilities (21 Oct 2026)', url: 'https://tribune.net.ph/2026/10/21/richard-gomez-lucy-torres-gomez-inaugurate-new-ormoc-sports-facilities' },
    cautions: ['Near the city centre and the rivers: read the flood and storm-surge sheets before any typhoon use.', 'Confirm the barangay.'] },
  { id: 'OA-DOLORES-NHA', name: 'Open ground around the NHA site, Dolores', role: 'camp_site', psgc: '0803738049', hazards: ['typhoon', 'flood', 'earthquake'],
    basis: 'Expansion space next to Evacuation Center Station 1. In July 2017 the City moved the Lake Danao tent site to the Dolores centre as the safer location.',
    source: { title: 'EV Mail: turnover of Ormoc City Evacuation Center Station 1 (Mar 2023)', url: 'https://evmailnews.net/?p=2007' },
    cautions: ['Residential resettlement area: agree any use of open lots with the NHA and the homeowners.', 'The NGCP Milagro substation is nearby: keep tents clear of lines and the yard.'] },
  { id: 'OA-CITYHALL-GROUNDS', name: 'City Hall grounds and tennis court', role: 'assembly', psgc: null, hazards: ['earthquake'],
    basis: 'Used in July 2017 as the evacuation area for New Ormoc City National High School students during aftershocks, and as the relief and command hub with generator-powered tents.',
    source: { title: 'Inquirer: quake-hit Ormoc (Jul 2017)', url: 'https://newsinfo.inquirer.net/912357/duterte-cancels-trip-to-quake-hit-ormoc-cabinet-men-to-discuss-rehab' },
    cautions: ['Low-lying city centre near Ormoc Bay: earthquake assembly only, not for typhoons or floods.', 'Keep clear of the City Hall building and the EOC\'s vehicle access.'] },
  { id: 'OA-SUPERDOME', name: 'Ormoc City Superdome', role: 'covered_overflow', psgc: null, hazards: ['typhoon', 'flood'],
    basis: 'The City\'s large covered venue for events; could take overflow from the centres if a structural assessment supports it.',
    cautions: ['No structural assessment record obtained: RA 12076 Sec. 4(b) asks for 300 kph winds and magnitude 8.0.', 'Confirm the barangay and read the flood sheet before use.'] },
  { id: 'OA-ROBINSONS', name: 'Robinsons Place Ormoc (under MOA)', role: 'assembly', psgc: null, hazards: ['earthquake', 'all'],
    basis: 'The City and Robinsons Land Corporation signed an agreement (7 Dec 2023) designating the site as a temporary evacuation site, triage centre and command centre for calamities with mass casualties.',
    source: { title: 'PNA: Ormoc mall designated as command center (Dec 2023)', url: 'https://www.pna.gov.ph/articles/1215057' },
    cautions: ['Use follows the MOA terms: confirm activation steps and the owner\'s contact with the CDRRMO.', 'Private site: not a long-stay camp.'] },
  { id: 'OA-CENTRAL-SCHOOL-OVAL', name: 'Ormoc City Central School oval', role: 'assembly', psgc: null, hazards: ['earthquake'],
    basis: 'Large rubberised oval (2014) in the city centre; open ground for short earthquake assembly.',
    source: { title: 'Philstar: rubberised oval at Ormoc City Central School (2014)', url: 'https://philstar.com/nation/2014/09/17/1369792/lawmaker-inaugurates-sports-project-leyte-school' },
    cautions: ['School: only when no other place is available (RA 10821 Sec. 5); open spaces before classrooms; as brief as possible.', 'In 2017 quake-damaged schools could not be used and families moved to tents.'] },
  { id: 'OA-TAMBULILID-COURT', name: 'Tambulilid covered court', role: 'covered_overflow', psgc: '0803738101', hazards: ['fire', 'all'],
    basis: 'Used as an evacuation centre after the April 2025 fire (DSWD DROMIC).',
    source: { title: 'DSWD DROMIC: Tambulilid fire, terminal report (Jun 2025)', url: 'https://dromic.dswd.gov.ph/wp-content/uploads/2025/04/DSWD-DROMIC-Terminal-Report-on-the-Fire-Incident-in-Brgy.-Tambulilid-Ormoc-City-Leyte-22-June-2025-6PM.pdf' },
    cautions: ['Already used: add it to the inventory once surveyed.'] },
  { id: 'OA-CANADIENG-COURT', name: 'Can-adieng covered court', role: 'covered_overflow', psgc: '0803738012', hazards: ['fire', 'all'],
    basis: 'Used as an evacuation centre after the November 2024 fire (DSWD DROMIC).',
    source: { title: 'DSWD DROMIC: Can-adieng fire, terminal report (Jan 2025)', url: 'https://dromic.dswd.gov.ph/wp-content/uploads/2024/11/DSWD-DROMIC-Terminal-Report-on-the-Fire-Incident-in-Brgy.-Can-adieng-Ormoc-City-Leyte-22-January-2025-6AM.pdf' },
    cautions: ['Coastal barangay: read the storm-surge sheet before any typhoon use.', 'Already used: add it to the inventory once surveyed.'] },
  { id: 'OA-DANAO-COURT', name: 'Lake Danao covered court', role: 'covered_overflow', psgc: '0803738019', hazards: ['fire'],
    basis: 'Sheltered 65 families (347 persons) after the June 2023 fire (DSWD DROMIC).',
    source: { title: 'DSWD DROMIC: Lake Danao fire, report 2 (Jun 2023)', url: 'https://dromic.dswd.gov.ph/wp-content/uploads/2023/06/DSWD-DROMIC-Report-2-on-the-Fire-Incident-in-Brgy.-Lake-Danao-Ormoc-City-Leyte-as-of-18-June-2023-6PM.pdf' },
    cautions: ['Upland area near the 2017 rupture: a geologist\'s check before earthquake or landslide use.', 'DROMIC says Barangay Lake Danao; the PSGC boundary file names it Danao.'] },
  ...(['0803738060:Linao', '0803738056:Ipil', '0803738111:Doña Feliza Z. Mejia', '0803738018:Curva', '0803738090:Valencia', '0803738095:Gaas', '0803738088:San Pablo'] as const)
    .map((s): OpenArea => {
      const [psgc, name] = s.split(':') as [string, string];
      return { id: `HUB-${name.toUpperCase().replace(/[^A-Z]+/g, '-').replace(/-+$/, '')}`, name: `Storage facility, ${name}`, role: 'logistics', psgc, hazards: ['all'],
        basis: 'One of the seven City storage facilities for pre-positioning (Ormoc City DRRM 10-Year Plan 2023–2032, LDRRMFIP). Supplies for nearby centres and camps.',
        cautions: ['Not a place for evacuees.', 'Record the stock in Resources; plan which centres each hub supplies.'] };
    }),
];

/** Candidates that can be placed on the map (barangay known). */
export const MAPPED_OPEN_AREAS = OPEN_AREAS.filter((a) => a.psgc !== null);
