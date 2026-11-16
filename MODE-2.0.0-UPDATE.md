# MODE 2.0.0-update — Ormoc DRRM Platform GIS and Flood Intelligence Enhancement

This review package extends the uploaded `ormoc-drrmo-main` source tree. It does
not replace the existing GIS architecture or modify the authoritative
barangay GeoJSON.

## Canonical GIS asset layout

```text
public/
└── geo/
    ├── ormoc-barangays.geojson
    └── hazard/
        ├── flood.webp
        ├── rain_landslide.webp
        ├── storm_surge.webp
        ├── liquefaction.webp
        ├── eq_landslide.webp
        ├── ground_rupture.webp
        ├── shaking.webp
        ├── tsunami.webp
        └── reference/
            └── 16 upscaled City cartographic reference maps
```

The eight existing raster files and `ormoc-barangays.geojson` are preserved.
The sixteen new map sheets are stored separately in `public/geo/hazard/reference/`.
They are static cartographic references, not georeferenced overlays. The
existing `src/features/eoc/map/hazardMaps.ts` remains the registry for
georeferenced layers; the new `referenceMaps.ts` registry serves the EOC Geo-COP
gallery and Flood Intelligence page.

## Main enhancements

- Shared map catalogue: `src/features/eoc/map/referenceMaps.ts`.
- EOC Geo-COP gallery now loads maps from `/geo/hazard/reference/`.
- Flood Intelligence uses the same shared catalogue and canonical asset paths.
- `map.test.ts` checks all 16 map files and the registry.
- ADR-042 documents the asset and GIS architecture decision.
- Updated flood assessment workbook included in `reference/flood-assessment/`.

## Flood assessment provenance

- Lao: 17 age bands and four male/female, prone/not-prone fields transcribed
  from the supplied valid `Table` and `Age Group` workbook.
- Linao: flood class totals remain from the supplied DDRiVE assessment.
  The separately uploaded 348-byte file is a macOS plist alias, not an XLSX;
  Linao age-sex data is therefore marked pending and not inferred.
- Flood-prone population is exposure, not flood depth, inundated area, or an
  evacuation/declaration trigger.
- Report denominators remain distinct from the 2024 POPCEN baseline.

## Image processing

All sixteen source map images were upscaled using Lanczos resampling so their
long edge is 3,200 pixels. The source map composition, labels, legends and
printed map information were not edited. Upscaling improves display size but
does not improve source resolution, positional accuracy, scale or geospatial
precision.

## Apply and verify

From a clean clone of `asilvainnovations/ormoc-drrmo`, copy the package's
repository contents over the same relative paths, then run:

```bash
npm ci
npm run check
```

Review the resulting diff before committing. This package does not create a
GitHub branch, commit or pull request. No claim is made that the TypeScript
suite or production build passed in this environment because dependencies
were not installed and the full CI workflow was not executed.

## Versioning

`MODE 2.0.0-update` is the enhancement package label. The repository's
`package.json` application version remains unchanged pending maintainers'
release decision and successful CI validation.
