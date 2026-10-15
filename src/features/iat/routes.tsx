import { Route, Routes } from 'react-router-dom';
import { CyclesPage } from './CyclesPage';
import { CycleOverview } from './CycleOverview';
import { DomainPage } from './DomainPage';
import { IndicatorPage } from './IndicatorPage';
import { ActionPlanPage } from './ActionPlanPage';

export default function AssessRoutes() {
  return (
    <Routes>
      <Route index element={<CyclesPage />} />
      <Route path=":cycleId" element={<CycleOverview />} />
      <Route path=":cycleId/d/:domain" element={<DomainPage />} />
      <Route path=":cycleId/i/:indicatorId" element={<IndicatorPage />} />
      <Route path=":cycleId/actions" element={<ActionPlanPage />} />
    </Routes>
  );
}
