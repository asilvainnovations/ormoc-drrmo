import { Route, Routes } from 'react-router-dom';
import { OverviewPage } from "./OverviewPage";
import { ReviewRegisterPage } from './ReviewRegisterPage';
import { DecisionsPage } from './DecisionsPage';
import { WorkshopPage } from './WorkshopPage';
import { StakeholdersPage } from './StakeholdersPage';

/** Manual Governance workspace (ADR-043 Slice 1). Protected under AppShell. */
export default function GovernanceRoutes() {
  return (
    <Routes>
      <Route index element={<OverviewPage />} />
      <Route path="reviews" element={<ReviewRegisterPage />} />
      <Route path="decisions" element={<DecisionsPage />} />
      <Route path="workshop" element={<WorkshopPage />} />
      <Route path="stakeholders" element={<StakeholdersPage />} />
    </Routes>
  );
}
