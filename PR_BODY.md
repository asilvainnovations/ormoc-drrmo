## MODE 2.0.0-update — GIS and Flood Intelligence

### Summary
- Preserve the canonical Ormoc barangay GeoJSON and existing eight georeferenced hazard rasters.
- Add 16 high-resolution City cartographic map references under `public/geo/hazard/reference/`.
- Introduce a shared `CITY_REFERENCE_MAPS` catalogue consumed by EOC Geo-COP and Flood Intelligence.
- Remove the parallel `/maps/` asset assumption.
- Add catalogue tests and ADR-042.
- Include the updated barangay flood assessment workbook as a reference artifact.

### GIS integrity
The sixteen printed map sheets are static reference images, not georeferenced raster layers. Existing interactive layers remain sourced from `src/features/eoc/map/hazardMaps.ts`. The 85-feature `public/geo/ormoc-barangays.geojson` remains the barangay boundary source.

### Data provenance
Lao age-sex detail comes from the valid Lao `Table` and `Age Group` workbook. Linao age-sex detail remains pending because the uploaded Linao file is a 348-byte macOS plist alias rather than an XLSX. No Linao age-sex values were imputed.

### Verification required
Run `npm ci` and `npm run check` in CI or a maintainer checkout. This package was not built or tested locally because dependencies were not installed in the packaging environment. Review the GeoJSON diff (it should be empty) before merge.
