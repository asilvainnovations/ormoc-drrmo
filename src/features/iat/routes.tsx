import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loading } from '@/components/ui';
import { CyclesPage } from './CyclesPage';
import { CycleOverview } from './CycleOverview';
import { DomainPage } from './DomainPage';
import { IndicatorPage } from './IndicatorPage';
import { ActionPlanPage } from './ActionPlanPage';
import { ValidationPage } from './ValidationPage';
import { ValidationSheets } from './ValidationSheets';
import { ResultsBoard } from './ResultsBoard';
import { EocCapabilityPage } from './EocCapabilityPage';

// The map library is large; it loads only when Hazard maps opens.
const HazardMapPage = lazy(() => import('@/features/eoc/map/HazardMapPage'));

export default function AssessRoutes() {
  return (
    <Routes>
      <Route index element={<CyclesPage />} />
      <Route path="hazard-maps" element={<Suspense fallback={<Loading />}><HazardMapPage /></Suspense>} />
      <Route path=":cycleId" element={<CycleOverview />} />
      <Route path=":cycleId/d/:domain" element={<DomainPage />} />
      <Route path=":cycleId/i/:indicatorId" element={<IndicatorPage />} />
      <Route path=":cycleId/actions" element={<ActionPlanPage />} />
      <Route path=":cycleId/validate" element={<ValidationPage />} />
      <Route path=":cycleId/validate/sheets" element={<ValidationSheets />} />
      <Route path=":cycleId/validate/board" element={<ResultsBoard />} />
      <Route path=":cycleId/eoc-capability" element={<EocCapabilityPage />} />
    </Routes>
  );
}
