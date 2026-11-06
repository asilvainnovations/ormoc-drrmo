# ADR-015: The EOC's location ships with the app; maps open outside it (v1.9.0)

Status: Accepted, 6 Nov 2026.

## Context
The EOC Board showed the alert level, logbook, barangays, requests and SitReps, but not where the EOC is. Responders arriving from other offices, augmenting teams sent through RDRRMC 8 and OCD VIII all need the site, and the EOC Capability Assessment Checklist asks for the primary and alternate EOC to be identified. On 6 Nov 2026 the consultant supplied a Google Earth placemark for the EOC (point 11.013896° N, 124.604287° E).

Options considered:
1. **An embedded map** (Leaflet or Google Maps). Needs map tiles from another origin, so the CSP's `img-src` and `connect-src` would have to widen, and it shows nothing offline. Rejected: ADR-011 keeps outside services as links and the CSP narrow.
2. **A table in the database** that administrators edit. Useful once the City records several sites (alternate EOC, ICPs, staging areas), but it adds a migration, RLS and a sync table for one fixed fact.
3. **A fixed record in the app**, like the barangay list's reference data. Readable offline, no server change.

## Decision
1. The EOC site is a fixed record, `src/data/eoc-site.ts`, with its placemark as `public/eoc-site/Ormoc_City_EOC.kml`. A unit test checks that the two agree. The KML is the supplied placemark cleaned to standard KML 2.2 (namespaces restored; empty styles and the Google Earth project data removed); the point and camera view are unchanged.
2. The EOC Board shows an **EOC location** card: coordinates in decimal degrees and in degrees–minutes–seconds, elevation (map terrain, not surveyed), the alternate EOC (shown as "Not yet recorded" until there is one), and the source.
3. Maps open **outside** the app: Google Maps, directions and OpenStreetMap in a new tab with `rel="noopener noreferrer"`; a `geo:` link for the phone's own map app (phones only); and the KML download for Google Earth or a GIS. Nothing is framed and the CSP is unchanged. The KML is precached by the service worker, so it downloads offline. "Copy coordinates" puts `name: lat, lng` on the clipboard for a radio log or SMS.
4. The position is marked **"To be confirmed"** until the CDRRMO checks it. Confirming it is a one-line change (`confirmed: true`) in a release.

## Consequences
- Moving the EOC or adding the alternate EOC is a release (edit the record and add a KML), not a screen. That is acceptable for sites that change rarely.
- No database change, no new sync table, no CSP change. New primitive `ButtonAnchor` in `src/components/ui.tsx` for button-styled outside links and downloads.
- Traceability: MR-05 (EOC establishment, Memo 131 s. 2018), MR-07 (situational awareness, GIS/COP), MR-10 (alternate EOC capability). EOC Capability Assessment Checklist: siting and alternate EOC items.

## Later
If the City wants the CDRRMO to keep several sites (alternate EOC, ICPs, staging areas, evacuation centres) without a release, replace the record with an `eoc_sites` table (admin writes, everyone with a role reads, audited) and keep this card reading from Dexie. That decision gets its own ADR.
