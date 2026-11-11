# ADR-028: Hazard map layers and QGIS-style tools in the EOC map

**Status:** Proposed (needs CPDO-GIS and CDRRMO sign-off on the layer list and the accuracy notes)
**Date:** 11 November 2026
**Deciders:** Alvin M. Silva (lead assessor); CDRRMO Head; CPDO-GIS (custodian of the City hazard sheets)
**Extends:** ADR-015 (City basemap), ADR-024 (DDRiVE base layer). Supports MR-03 (risk intelligence), MR-07 (situational awareness); Area 3 and Area 6.

## Context

The EOC needs the City's hazard maps on screen during PDRA, warning and response: flood, rain-induced landslide, storm surge (CPDO-GIS sheets from MGB VIII and DOST Project NOAH data, 2023); liquefaction, earthquake-induced landslide and ground rupture (READY Project, PHIVOLCS 2007, revised 2010); ground shaking (PHIVOLCS 2026) and tsunami (PHIVOLCS 2024). The City holds them only as printed sheets (images). QGIS is the City's desktop GIS, but EOC staff use MODE on phones and laptops, often offline, and the engagement runs on free tiers (ADR-026). The OCHA COD-AB barangay boundaries (85 polygons, PSGC-keyed) and the DDRiVE tables give a vector base.

Constraints: free tier only; works offline after first load; City-owned and maintainable by a local IT contractor; the official map meaning must not change; nothing here creates a hazard threshold.

## Decision

Add an **EOC → Hazard maps** page that brings the parts of QGIS the EOC uses into MODE:

1. **Georeferenced hazard sheets as image overlays.** Each sheet was fitted once (11 Nov 2026) from its own grid: UTM 51N ticks on the CPDO sheets (fit error about 5–6 m), Luzon 1911 graticule ticks on the READY sheets (about 7 m), and the printed city boundary on the PHIVOLCS 2024/2026 sheets (about 80 m). Classified sheets keep only their legend colours (everything else transparent); the PHIVOLCS sheets are shown as published. Corners, source, custodian, issue date, scale and fit error are in `src/features/eoc/map/hazardMaps.ts`; the fit record is `docs/adr/028-georef-fits.json`. Files are static (`public/geo/`), so the service worker caches them.
2. **Barangay boundaries** from OCHA COD-AB (PSGC-keyed, simplified, `public/geo/ormoc-barangays.geojson`) with **categorised and graduated symbology** from the DDRiVE tables (flood, hazards, proposed priority, 2024 population). A blank is "Not assessed", never zero.
3. **QGIS-style tools:** layer list with visibility, opacity and draw order; legends; identify (barangay attributes plus the hazard class read from each visible sheet at the clicked point); measure distance and area (geodesic); coordinates in WGS 84 and UTM 51N (EPSG:32651); zoom to barangay; exposure summary (barangays and population per class); export the view as PNG with title, sources and date.

## Options considered

### Option A: Image overlays plus vector boundaries in MapLibre (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Low: MapLibre is already in the app (Geo-COP) |
| Cost | None: static files on the existing host |
| Scalability | Fine for 8–15 sheets (about 3 MB total); more need tiling |
| Team familiarity | High: same stack as the Geo-COP map |

**Pros:** offline; no server; shows exactly what the official sheet shows; quick to replace a sheet.
**Cons:** a sheet is a picture, not polygons; identify reads a colour, so it reports the class, not an attribute table; accuracy is limited by the print.

### Option B: Vectorise the sheets into polygons (QGIS, then GeoJSON)
| Dimension | Assessment |
|---|---|
| Complexity | High: manual digitising and QA per sheet |
| Cost | Staff time (weeks) |
| Scalability | Good |
| Team familiarity | Needs a GIS analyst |

**Pros:** real attributes, overlay analysis, smaller files. **Cons:** traced polygons look official but are a derived product with their own errors; needs CPDO-GIS validation before EOC use. Better: ask MGB VIII, PHIVOLCS and CPDO for the original shapefiles.

### Option C: Embed a hosted GIS (QGIS Server, GeoServer, ArcGIS Online)
**Pros:** full GIS. **Cons:** a server to run and pay for; not offline; outside the free-tier rule (ADR-026).

### Option D: Link out only (HazardHunterPH, GeoRiskPH, Project NOAH)
Kept as outside links (ADR-011), but staff lose the barangay overlay and offline use.

## Trade-off analysis

A gives the EOC the official pictures in place, offline, at no cost, and keeps their meaning. Its limit is precision: a print fitted to its grid is good to a few metres for the CPDO and READY sheets and to about 80 m for the PHIVOLCS city sheets. That is enough for barangay-level situational awareness and not enough for a site decision. The page says so on every sheet and in every export, and the identify tool reports "about" the class. B and C stay open for when the City obtains the source vector data.

## Consequences

- Easier: PDRA and briefings can show any hazard over the barangays with the exposure summary; exports carry source and accuracy.
- Harder: each replaced sheet needs a new fit (re-run the georeferencing and update `hazardMaps.ts`).
- Revisit: when CPDO-GIS or the agencies release shapefiles, load them as `geo_layers` (Geo-COP) and retire the image overlay for that hazard.
- The CPDO sheets draw the city boundary from Cadastre 256, which in the east is smaller than the PSA / OCHA COD-AB outline the page uses. Hazard classes sit in the right place; only the outer boundary lines differ. CPDO and PSA should reconcile the boundary.
- The two QGIS elevation maps supplied (MapsByOBSN, 2023) are a private author's work and are not loaded. If the EOC needs elevation, build it from the open Copernicus GLO-30 DEM that those maps cite, with CPDO-GIS.
- The MGB VIII sheets are marked "unpublished/unofficial" on the print; the page repeats that label. The 2009–2010 READY sheets predate the 2022 barangay merger and use the old Poblacion numbering.

## Action items

1. [x] Fit the eight sheets and record the fits (11 Nov 2026).
2. [x] Build the page, tools and tests.
3. [ ] CPDO-GIS checks two control points per sheet against QGIS and confirms the layer list.
4. [ ] Request the source shapefiles from MGB VIII (flood, landslide), PHIVOLCS (READY layers, GSH-2025, TSU-2023) and DOST (storm surge).
5. [ ] Add the page to the Chapter 6 GIS SOP (6-GIS-01) once validated.
