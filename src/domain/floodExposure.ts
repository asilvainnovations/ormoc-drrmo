/**
 * Source-aligned flood exposure data transcribed from the supplied Ormoc City
 * Population_Prone_Flood reports and the updated barangay hazard assessment.
 *
 * Population denominators intentionally remain the denominators of the source
 * GeoAnalyticsPH reports (2020 CPH reference). They are not interchanged with
 * 2024 POPCEN population baselines. These are population exposure estimates,
 * not flood depth, area or live warning data.
 */
export interface FloodAgeSexRow {
  ageGroup: string;
  maleNotProne: number | null;
  maleProne: number | null;
  femaleNotProne: number | null;
  femaleProne: number | null;
}

export interface BarangayFloodExposure {
  psgc: string;
  name: string;
  reportedAt: string;
  source: string;
  denominator: number;
  pronePopulation: number;
  exposurePercent: number;
  classes: ReadonlyArray<{ name: 'Not prone' | 'Low' | 'Moderate' | 'High' | 'Very High'; population: number }>;
  ageSex: ReadonlyArray<FloodAgeSexRow>;
  ageSexStatus: 'available' | 'source-record-pending';
  notes?: string;
}

const LAO_AGE: FloodAgeSexRow[] = [
  ['Under 5',6,159,8,231],['5-9',8,221,8,222],['10-14',8,223,8,218],['15-19',7,208,7,210],
  ['20-24',6,179,7,194],['25-29',6,171,6,175],['30-34',5,148,5,136],['35-39',5,130,5,131],
  ['40-44',5,131,4,123],['45-49',4,107,4,125],['50-54',4,101,4,108],['55-59',2,69,3,91],
  ['60-64',3,84,2,69],['65-69',2,60,1,40],['70-74',1,38,1,37],['75-79',1,27,null,14],['80+',1,27,1,19],
].map(([ageGroup,maleNotProne,maleProne,femaleNotProne,femaleProne]) => ({
  ageGroup: String(ageGroup), maleNotProne: maleNotProne as number | null,
  maleProne: maleProne as number | null, femaleNotProne: femaleNotProne as number | null,
  femaleProne: femaleProne as number | null,
}));

const records: BarangayFloodExposure[] = [
  { psgc:'0803738092', name:'Airport', reportedAt:'November 05, 2026 9:05:02 pm', source:'Population_Prone_Flood_Air[port_Ormoc_City.xlsx', denominator:879, pronePopulation:853, exposurePercent:97.042, classes:[{name:'Not prone',population:26},{name:'Moderate',population:853}], ageSex:[], ageSexStatus:'available' },
  { psgc:'0803738059', name:'Liloan', reportedAt:'November 06, 2026 9:20:00 pm', source:'Population-Prone_Flood_Liloan_Ormoc_City.xlsx', denominator:10434, pronePopulation:10434, exposurePercent:100, classes:[{name:'Moderate',population:10434}], ageSex:[], ageSexStatus:'available' },
  { psgc:'0803738001', name:'Alegria', reportedAt:'November 06, 2026 9:35:00 pm', source:'Population_Prone_Flood_Alegria_Ormoc_City.xlsx', denominator:977, pronePopulation:842, exposurePercent:86.182, classes:[{name:'Not prone',population:135},{name:'Moderate',population:842}], ageSex:[], ageSexStatus:'available' },
  { psgc:'0803738018', name:'Curva', reportedAt:'November 06, 2026 9:45:00 pm', source:'Population_Prone_Flood_Curva_Ormoc_City.xlsx', denominator:3309, pronePopulation:2354, exposurePercent:71.139, classes:[{name:'Not prone',population:955},{name:'High',population:2354}], ageSex:[], ageSexStatus:'available' },
  { psgc:'0803738057', name:'Lao', reportedAt:'November 17, 2026 2:40:52 am', source:'Population_Prone_Flood-Lao-Ormoc_City.xlsx', denominator:4374, pronePopulation:4226, exposurePercent:96.616, classes:[{name:'Not prone',population:148},{name:'High',population:1050},{name:'Very High',population:3176}], ageSex:LAO_AGE, ageSexStatus:'available' },
  { psgc:'0803738099', name:'Leondoni', reportedAt:'November 06, 2026 10:00:00 pm', source:'Population_Prone_Flood_Leodoni_Ormoc_City.xlsx', denominator:934, pronePopulation:259, exposurePercent:27.730, classes:[{name:'Not prone',population:675},{name:'High',population:259}], ageSex:[], ageSexStatus:'available' },
  { psgc:'0803738060', name:'Linao', reportedAt:'November 17, 2026 — DDRiVE source record', source:'Ormoc-City-Barangays_Hazard-Assessment_DDRiVE_2026-11-09.xlsx (individual uploaded alias was invalid)', denominator:8210, pronePopulation:8210, exposurePercent:100, classes:[{name:'High',population:6399},{name:'Very High',population:1811}], ageSex:[], ageSexStatus:'source-record-pending', notes:'The supplied Linao upload was a 348-byte macOS plist alias, not a readable XLSX workbook. Flood class and exposed population are from the supplied DDRiVE assessment; age-sex detail is deliberately not imputed.' },
  { psgc:'0803738003', name:'Labrador (Balion)', reportedAt:'November 07, 2026 10:00:00 pm', source:'Population_Prone_Flood_ Labrador(Balion)_Ormoc_City.xlsx', denominator:2273, pronePopulation:2273, exposurePercent:100, classes:[{name:'High',population:2273}], ageSex:[], ageSexStatus:'available' },
];

export const ORMOC_FLOOD_EXPOSURE: ReadonlyArray<BarangayFloodExposure> = records;
export const getBarangayFloodExposure = (psgc: string) => records.find((row) => row.psgc === psgc);
export const FLOOD_EXPOSURE_AS_OF = '17 November 2026';
