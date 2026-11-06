// Where the Ormoc City EOC is (ADR-015).
//
// Source: Google Earth placemark "EOC" supplied by the consultant on 6 Nov 2026, kept as
// public/eoc-site/Ormoc_City_EOC.kml. src/lib/geo.test.ts checks that this file and the KML
// agree, so change both together.
//
// This is a fixed fact of the City, like the barangay list, so it ships with the app and is
// readable offline. Moving the EOC, or recording the alternate EOC, is a release: edit this
// file and the KML. If the City wants the CDRRMO to edit sites itself, move this to a table
// (see ADR-015, "Later").
//
// The position is a placemark, not a survey. The elevation is Google Earth's terrain value.

export type EocSiteRole = 'primary' | 'alternate';

export interface EocSite {
  role: EocSiteRole;
  name: string;
  /** WGS 84 decimal degrees. */
  lat: number;
  lng: number;
  /** Metres above mean sea level, from Google Earth terrain. Not surveyed. */
  elevationM: number | null;
  /** Placemark file served by the app (precached, so it downloads offline). */
  kml: string;
  /** Where the position came from, and when. */
  source: string;
  /** False until the CDRRMO confirms the position for the manual. */
  confirmed: boolean;
}

export const EOC_SITES: EocSite[] = [
  {
    role: 'primary',
    name: 'Ormoc City EOC',
    lat: 11.01389600057808,
    lng: 124.6042871572453,
    elevationM: 7.471268260529933,
    kml: '/eoc-site/Ormoc_City_EOC.kml',
    source: 'Google Earth placemark, 6 Nov 2026',
    confirmed: false,
  },
  // Alternate EOC: not yet recorded. The EOC Capability Assessment Checklist and MR-10 expect
  // one. Add it here (role 'alternate') with its own KML when the CDRRMO names the site.
];

export const primaryEoc = () => EOC_SITES.find((s) => s.role === 'primary') ?? null;
export const alternateEoc = () => EOC_SITES.find((s) => s.role === 'alternate') ?? null;
