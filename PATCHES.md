# MODE 1.22.0 Slice 2 — merge patches (ADR-041)

## A. Routes — `src/features/tools/routes.tsx`

Add lazy route:

```tsx
const FloodIntelligencePage = lazy(() => import('./FloodIntelligencePage').then((m) => ({ default: m.FloodIntelligencePage })));
// inside <Routes>:
<Route path="flood-intelligence" element={<FloodIntelligencePage />} />
```

Copy `src/features/tools/FloodIntelligencePage.tsx` from this zip.

## B. Tools home — `src/features/tools/ToolsHome.tsx`

1. Add internal tool card:

```ts
{ to: '/tools/flood-intelligence', name: 'Flood intelligence', icon: Waves,
  text: 'Ormoc DDRiVE flood picture, Copernicus on-demand mapping links, PAGASA and supporting sources. Decision support only.',
  iat: 'A5, A6, B2, B5' },
```

2. Ensure external tools include (add if missing):

```ts
{ id: 'copernicus-odm', name: 'Copernicus EMS On-Demand Mapping', by: 'EU Copernicus',
  url: 'https://mapping.emergency.copernicus.eu/', icon: Earth, category: 'international', priority: 'supporting',
  use: 'On-demand satellite mapping for emergencies (institutional activation process).',
  when: 'Major events when the City or higher authorities request EMS mapping products.',
  limitations: 'Not a continuous City feed. Activation follows Copernicus procedures.' },
{ id: 'pagasa-visayas', name: 'PAGASA Visayas regional forecast', by: 'DOST-PAGASA',
  url: 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd', icon: CloudRain, category: 'official', priority: 'official',
  use: 'Official regional forecast for Visayas.',
  when: 'Daily monitoring and before PDRA / activation decisions.',
  limitations: 'Official product — MODE does not mirror or alter it.' },
```

(PHIVOLCS and base Copernicus entries already exist on main.)

## C. Today — `src/features/home/TodayPage.tsx`

```tsx
import { HazardWatch } from './HazardWatch';
// After greeting / declaration block, before or after quick actions:
<HazardWatch />
```

Copy `src/features/home/HazardWatch.tsx` from this zip.

## D. City Risk Picture analytics — `src/features/eoc/RiskPage.tsx`

After the city scores section, add a summary strip computed from the same `profiles` live query:

- Count barangays by flood susceptibility class (from `ddrive_flood`).
- Count by priority_rank buckets (1–5, 6–10, rest).
- List top 5 priority names with link affordance already on rows.

Keep the existing filter/search behaviour. No new dependencies.

## E. EOC Roster scenarios — `src/features/eoc/RosterPage.tsx`

Add a scenario control:

```ts
type Scenario = 'all' | 'white' | 'blue' | 'red' | 'hydromet' | 'geological';
```

Filter `positionDepth` rows by `position.min_level` (and optional section) so that:

- White → positions with min_level white (or all command/staff always shown).
- Blue / Red → include positions required at that level or lower.
- Hydromet / geological → same as Blue/Red plus a notice that cluster desks follow the activated contingency plan (link to Plans).

Show filled vs gap using existing `required_depth` vs designated ranks. Do not invent person names; show office and designee_position from designations.

## F. EOC Capability data

No new migration if seeds `38_eoc_capability.sql` / `38a–c_eoc_assessment.sql` already applied. Verify in app: `/eoc-assessment` shows items and statuses derived from IAT B_EOC. To refresh from the November 2026 accomplished workbook, re-run the operational seed generator and parts — do not hand-edit production scores.

## G. Optional static prototype

If the City wants the engagement Bayesian HTML available:

```bash
cp MODE_Flood_Intelligence.html public/tools/flood-intelligence-prototype.html
```

Linked from Flood intelligence page only; never iframe; never cited as official.

## H. ADR index

Add row for ADR-041 in `docs/adr/README.md` (file included in this zip).

## I. Version / DEPLOY

If shipping with Slice 1: version **1.22.0**.  
If Slice 1 already tagged alone: bump to **1.23.0** and add DEPLOY “To 1.23.0” noting ADR-041, no new migration.
