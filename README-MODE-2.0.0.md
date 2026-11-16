# Ormoc DRRM platform update — review package

Repository target: `asilvainnovations/ormoc-drrmo` (default branch `main`).

## Package contents

This ZIP contains complete replacement files under `bundle/src/`, sixteen high-resolution static map assets under `bundle/public/maps/`, and the latest source workbook under `bundle/data/`.

### Updated application files

- `src/domain/barangays.ts`
- `src/domain/barangays.test.ts`
- `src/domain/ddrive.parity.test.ts`
- `src/domain/floodExposure.ts` (new)
- `src/domain/floodExposure.test.ts` (new)
- `src/features/eoc/BarangaysPage.tsx`
- `src/features/eoc/RiskPage.test.tsx`
- `src/features/eoc/RiskPage.tsx`
- `src/features/eoc/LiaisonPage.tsx`
- `src/features/tools/FloodIntelligencePage.tsx`
- `src/features/eoc/MapPage.tsx`

### Maps

All sixteen supplied Ormoc City maps are copied to `public/maps/` and upscaled to a minimum width of 2,560 pixels (2x or greater) using Lanczos resampling. Their original map content, cartographic markings and legends are not edited. The UI provides responsive thumbnails and full-size image links. Static images are reference maps; they are not georeferenced interactive hazard layers.

### Flood data provenance

- Lao: the newly uploaded `Population_Prone_Flood-Lao-Ormoc_City.xlsx` is a valid workbook with `Table` and `Age Group` sheets. The exact 17 source age bands and the four sex/prone columns are retained in `floodExposure.ts`.
- Linao: `Population_Prone_Flood_Linao_Ormoc_City(1).xlsx` is 348 bytes and has a `bplist00` header. It is a macOS plist/alias, not an XLSX archive. The flood class counts and exposed population come from the supplied DDRiVE assessment; the application deliberately marks age-sex detail as pending and does not copy Leondoni data.
- The 8 reference barangay flood denominators are the corresponding report denominators and remain separate from 2024 POPCEN baseline population fields.
- Flood-prone population is exposure population, not flood depth or inundated land area. It is never used as a warning or evacuation trigger.

### Important deployment limitation

The connected GitHub integration returned repository permissions `pull: true`, `push: false`. Therefore no implementation branch, commit or PR was created, and `main` was not modified. This is a complete review ZIP for a maintainer with write access to apply and test.

The repository was inspected through GitHub's read API, but a local `git clone` was unavailable in this execution environment. Consequently `npm run check` (typecheck, Vitest and Vite build) has not been run. Apply these files to a clean clone, run `npm ci` and `npm run check`, then review and merge through the repository's normal process.
