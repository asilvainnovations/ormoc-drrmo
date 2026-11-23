/**
 * Official CSWD district assignments for Ormoc City.
 *
 * Source: City DRRMO / CSWD, "DISTRICT Clusters.pdf", pp. 1–2.
 * This is a separate administrative grouping from barangay_clusters,
 * which represents the CDRRMO operational/hazard-response clusters.
 *
 * Do not write these assignments into Barangay.cluster_id.
 */

export interface CSWDDistrict {
  code: `District ${1 | 2 | 3 | 4 | 5 | 6}`;
  name: string;
  coordinator: string;
  coordinatorTitle: string;
  assistant: string;
  barangays: readonly string[];
}

export const CSWD_DISTRICTS: readonly CSWDDistrict[] = [
  {
    code: 'District 1',
    name: 'District 1',
    coordinator: 'Lourdes Devila',
    coordinatorTitle: 'Social Welfare Officer III / District Camp Coordinator',
    assistant: 'Iszegie Laurente',
    barangays: [
      'Bagong', 'Biliboy', 'Cabaon-an', 'Cabintan', 'Danao', 'Dayhagan',
      'Dolores', 'Gaas', 'Liberty', 'Luna', 'Magaswe', 'Milagro',
      'Nueva Vista', 'Salvacion', 'San Pablo', 'Sto. Niño', 'Tongonan',
    ],
  },
  {
    code: 'District 2',
    name: 'District 2',
    coordinator: 'Melina Demeterio',
    coordinatorTitle: 'Social Welfare Officer III / District Camp Coordinator',
    assistant: 'Regina Mahusay',
    barangays: [
      'Airport', 'Curva', 'Domonar', 'Esperanza', 'Green Valley', 'Lao',
      'Leondoni', 'Libertad', 'Licuma', 'Lilo-an', 'Mabato', 'Manlilinao',
      'Margen', 'Mas-in', 'Nueva Sociedad', 'R.M. Tan', 'San Juan',
      'San Vicente',
    ],
  },
  {
    code: 'District 3',
    name: 'District 3',
    coordinator: 'Lorenzo Gil Baleros',
    coordinatorTitle: 'Social Welfare Officer III / District Camp Coordinator',
    assistant: 'Jojiemae Sainz',
    barangays: [
      'Alegria', 'Batuan', 'Linao', 'Naungan', 'Punta', 'Tambulilid',
    ],
  },
  {
    code: 'District 4',
    name: 'District 4',
    coordinator: 'Alexandra Kris Valenciano',
    coordinatorTitle: 'Social Welfare Officer III / District Camp Coordinator',
    assistant: 'Rudilina Yap',
    barangays: [
      'Bantigue', 'Don Carlos Rivilla (Boroc)', 'Camp Downes',
      'Can-adieng', 'Can-untog', 'Danhug', 'Hugpa', 'Ipil', 'Mabini',
      'Macabug', 'Mahayahay', 'Quezon, Jr.', 'San Antonio', 'Sumangga',
    ],
  },
  {
    code: 'District 5',
    name: 'District 5',
    coordinator: 'Angelica Laurente',
    coordinatorTitle: 'Social Welfare Officer III / District Camp Coordinator',
    assistant: 'Ailyn Salvacion',
    barangays: [
      'Dr. Hermenigildo Serafica (Bayog)', 'Cabulihan', 'Cagbuhangin',
      'Catmon', 'Concepcion', 'Don Potenciano Larrazabal', 'Guintigui-an',
      'Hibunaon', 'Juaton', 'Kadaohan', 'Labrador', 'Matica-a',
      'Monterico', 'Nasunogan', 'Sabang Bao', 'San Jose', 'Valencia',
      'Alta Vista',
    ],
  },
  {
    code: 'District 6',
    name: 'District 6',
    coordinator: 'Thelma Maceda',
    coordinatorTitle: 'Social Welfare Officer III / District Camp Coordinator',
    assistant: 'Rosanna Casar',
    barangays: [
      'Bagong Buhay', 'Cogon', 'Don Felipe Larrazabal',
      'Doña Feliza Z. Mejia', 'Donghol', 'East', 'Mahayag', 'North',
      'Patag', 'San Isidro', 'South', 'West',
    ],
  },
] as const;

/** Match imported barangay names despite case, accents, punctuation or spacing. */
export function normalizeBarangayName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]/g, '');
}

const districtByBarangay = new Map<string, CSWDDistrict>();

for (const district of CSWD_DISTRICTS) {
  for (const barangay of district.barangays) {
    const key = normalizeBarangayName(barangay);
    if (districtByBarangay.has(key)) {
      throw new Error(`[CSWD] Duplicate district assignment: ${barangay}`);
    }
    districtByBarangay.set(key, district);
  }
}

// Known legacy/import variants found in the MODE seed/migration history.
// These aliases only resolve names; they do not alter the official PDF labels.
const DISTRICT_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['Magaswi', 'Magaswe'],
  ['Santo Niño', 'Sto. Niño'],
  ['Liloan', 'Lilo-an'],
  ['Rufina M. Tan', 'R.M. Tan'],
  ['Borok', 'Don Carlos Rivilla (Boroc)'],
  ['Hibunawon', 'Hibunaon'],
  ['Bayog', 'Dr. Hermenigildo Serafica (Bayog)'],
  ['Cogon Combado', 'Cogon'],
  ['Barangay East', 'East'],
  ['Barangay North', 'North'],
  ['Barangay South', 'South'],
  ['Barangay West', 'West'],
  ['Quezon Jr.', 'Quezon, Jr.'],
];

for (const [alias, officialName] of DISTRICT_ALIASES) {
  const district = districtByBarangay.get(normalizeBarangayName(officialName));
  if (district) districtByBarangay.set(normalizeBarangayName(alias), district);
}

export const CSWD_OFFICIAL_BARANGAY_COUNT = 85;

export function getCSWDDistrict(barangayName: string): CSWDDistrict | null {
  return districtByBarangay.get(normalizeBarangayName(barangayName)) ?? null;
}

export function getCSWDDistrictAssignmentCount(): number {
  return CSWD_DISTRICTS.reduce((total, district) => total + district.barangays.length, 0);
}
