import { Route, Routes } from 'react-router-dom';
import { CyclesPage } from './CyclesPage';
import { CycleOverview } from './CycleOverview';
import { DomainPage } from './DomainPage';
import { IndicatorPage } from './IndicatorPage';
import { ActionPlanPage } from './ActionPlanPage';
import { ValidationPage } from './ValidationPage';
import { ValidationSheets } from './ValidationSheets';
import { ResultsBoard } from './ResultsBoard';

export default function AssessRoutes() {
  return (
    <Routes>
      <Route index element={<CyclesPage />} />
      <Route path=":cycleId" element={<CycleOverview />} />
      <Route path=":cycleId/d/:domain" element={<DomainPage />} />
      <Route path=":cycleId/i/:indicatorId" element={<IndicatorPage />} />
      <Route path=":cycleId/actions" element={<ActionPlanPage />} />
      <Route path=":cycleId/validate" element={<ValidationPage />} />
      <Route path=":cycleId/validate/sheets" element={<ValidationSheets />} />
      <Route path=":cycleId/validate/board" element={<ResultsBoard />} />
    </Routes>
  );
}
