// Ormoc City's barangays, per the PSA Philippine Standard Geographic Code (PSGC).
//
// Since the PSA 4th quarter 2022 PSGC update, Ormoc has 85 barangays. Under City Ordinance
// No. 052, s. 2021, ratified by plebiscite on 8 October 2022, 28 numbered Poblacion barangays
// were merged into three, and Barangay 29 was renamed:
//   Barangay South  <- Barangays 1-8, 12, 13, 15, 17, 23 and 27
//   Barangay East   <- Barangays 9, 10, 11, 16, 18, 25 and 28
//   Barangay West   <- Barangays 14, 19, 20, 21, 22, 24 and 26
//   Barangay North  <- Barangay 29 (renamed)
// 110 - 28 + 3 = 85. Older lists online (110 barangays, "Barangay 1 (Pob.)" and so on) are out of date.
// Source: PSA, "Fourth Quarter 2022 PSGC Updates" press release.
export const ORMOC_BARANGAY_COUNT = 85;
export const POBLACION_2022 = ['South', 'East', 'West', 'North'] as const;

/** Warnings for a barangay list that does not look like the current PSA masterlist. */
export function checkBarangayList(rows: { psgc: string; name: string }[]): string[] {
  const warn: string[] = [];
  if (rows.length !== ORMOC_BARANGAY_COUNT) {
    warn.push(`Ormoc has ${ORMOC_BARANGAY_COUNT} barangays in the current PSA PSGC. This list has ${rows.length}.`);
  }
  const numbered = rows.filter((r) => /^(barangay|brgy\.?)\s*\d+\b/i.test(r.name.trim()));
  if (numbered.length) {
    warn.push(`This list still has ${numbered.length} numbered Poblacion barangay${numbered.length > 1 ? 's' : ''} (for example "${numbered[0]!.name}"). Since October 2022 they are Barangays South, East, West and North. Use the current PSA masterlist.`);
  }
  const missing = POBLACION_2022.filter((n) => !rows.some((r) => new RegExp(`^(barangay\\s+)?${n}\\b`, 'i').test(r.name.trim())));
  if (missing.length && !numbered.length) warn.push(`Not found: Barangay ${missing.join(', ')}.`);
  const seen = new Set<string>(); const dup = new Set<string>();
  for (const r of rows) { if (seen.has(r.psgc)) dup.add(r.psgc); seen.add(r.psgc); }
  if (dup.size) warn.push(`Repeated PSGC code: ${[...dup].slice(0, 5).join(', ')}.`);
  return warn;
}
