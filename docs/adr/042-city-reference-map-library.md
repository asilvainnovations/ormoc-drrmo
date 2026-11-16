# ADR-042 — City reference map library under the canonical Geo directory

**Status:** Proposed  
**Date:** 17 November 2026

## Context

The repository already contains the canonical barangay boundary dataset at
`public/geo/ormoc-barangays.geojson`, eight georeferenced raster hazard sheets
under `public/geo/hazard/`, and the interactive GIS implementation under
`src/features/eoc/map/`. The City also supplied sixteen cartographic map
sheets for use as high-resolution reference material.

Storing the additional sheets under a parallel `public/maps/` directory would
split GIS assets across unrelated roots and make the distinction between
georeferenced overlays and printed map references less clear.

## Decision

1. Preserve `public/geo/ormoc-barangays.geojson` and the existing eight raster
   layers under `public/geo/hazard/`.
2. Store the sixteen supplied static cartographic references under
   `public/geo/hazard/reference/`.
3. Register them in `src/features/eoc/map/referenceMaps.ts`.
4. Reuse that registry in the EOC Geo-COP map gallery and Flood Intelligence.
5. Keep `src/features/eoc/map/hazardMaps.ts` as the registry for the existing
   georeferenced overlays. Do not treat the static reference images as
   georeferenced or use them for pixel-based spatial identification.
6. Preserve source legends, dates, scales and caveats. The upscaled images are
   display copies; interpolation does not increase the source data's spatial
   accuracy.
7. Continue to use the 85-feature GeoJSON for barangay geometry and PSGC
   identity. The political boundary image is a visual reference only.

## Consequences

- GIS assets have one canonical public root.
- The two galleries share one static reference-map catalogue.
- The existing interactive overlay implementation is unchanged.
- The map test suite checks that all sixteen reference-map assets exist.
- Static reference maps remain decision-support context, not live warning
  feeds, georeferenced layers, or site-specific hazard determinations.
