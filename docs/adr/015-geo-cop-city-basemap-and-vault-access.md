# ADR-015: Geo-COP on a City-hosted basemap; Vault access by role (v1.9.0)

Status: Accepted, 6 Nov 2026. Narrows the CSP in ADR-011; extends ADR-004.

## Context
The EOC Module recommendations (Chapter 6, SOP 6-GIS-01, forms EOC-GIS-01 to -06) call for a geospatial common operating picture: the EOC and other reference points, hazard, evacuation and boundary layers, and incident locations, each showing how far it has been checked. On 6 Nov 2026 the City asked to "plan a City-hosted basemap now" and supplied the EOC placemark as KML (11.013896 N, 124.604287 E, altitude 7.5 m).

Third-party tile servers would widen the CSP (`connect-src`, `img-src`) to hosts the City does not control, send every viewed area to them, and stop working if their terms change. Embedding hazard services is already refused (ADR-011).

The City also asked that the organisational chart and the staff papers sit in the Vault "with RBAC access".

## Decision
1. **Basemap.** An OpenStreetMap-derived PMTiles extract of Ormoc (`ormoc.pmtiles`), with the Protomaps fonts and sprites, sits in the City's own Supabase project in a public `basemap` bucket (administrator upload only). The app reads it with MapLibre GL and the `pmtiles` protocol. `VITE_BASEMAP_URL` may point to a City web server instead. `scripts/build_basemap.sh` makes and uploads the extract. When the file is missing the map shows a plain background and still shows points and layers.
2. **CSP.** `connect-src` names the City project (`jmctsspadywjcbbqwweh.supabase.co`) instead of `*.supabase.co`; `worker-src 'self' blob:` allows the map worker, which is served from the app's own origin. No new outside host.
3. **Reference points** (`geo_reference_points`) start as *pending field validation*. Only the CDRRMO Head or EOC Manager records a field verification (online). A verified point is fixed; a corrected point supersedes it.
4. **Layers** (`geo_layers`) carry the safeguard metadata: source, custodian office, issue date, CRS (EPSG:4326), scale, validation status (reported, preliminary, field-verified, official), update frequency and access (internal or EOC roles only). KML, KMZ and GeoJSON are parsed on the device into GeoJSON (`src/domain/kml.ts`; markup in descriptions is dropped, never rendered); the GeoJSON and the original file go to the private `geo` bucket. Files are never replaced; a new layer supersedes the old. Only the Head marks a layer *official*.
5. **No household points.** Barangay status shows on the map at the barangay's point, as aggregate counts (RA 10173).
6. **Vault access.** `vault_documents.access_class` is *standard* (every Vault role) or *restricted* (the CDRRMO Head and the roles listed in `allowed_roles`). RLS on the rows and on the storage objects uses `app.can_read_vault_doc`. Only the Head changes a document's access (online). The organisational chart and the two staff papers are loaded as restricted to the Head, assessors and validators.

## Consequences
- The basemap needs a connection when first viewed; tiles are not cached for offline use yet (open item: a runtime cache for the PMTiles range requests, or a smaller offline extract).
- MapPage is a separate 1.1 MB chunk loaded only when the Map tab opens; the worker (0.5 MB) is precached.
- A document made restricted after it reached a phone stays in that phone's local copy until sign-out (rows that RLS hides are not deleted on devices; see the tombstone item in the backlog). Restrict personnel documents when they are added.
- A staging or second Supabase project needs its host added to the CSP in `netlify.toml` / `vercel.json`.
