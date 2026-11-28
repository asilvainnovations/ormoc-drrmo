import { Route, Routes } from 'react-router-dom';
import { OverviewPage } from "./OverviewPage";
import { ReviewRegisterPage } from './ReviewRegisterPage';
import { DecisionsPage } from './DecisionsPage';
import { WorkshopPage } from './WorkshopPage';
import { StakeholdersPage } from './StakeholdersPage';
import { CoordinationPage } from './CoordinationPage';
import { IntelligencePage } from './IntelligencePage';

/** Manual Governance workspace (ADR-043 Slice 1). Protected under AppShell. */
export default function GovernanceRoutes() {
  // 1.36.1: the workspace pages carry no page container of their own; without it they ran edge to edge on phones and
  // their last rows sat under the tab bar. `.page` gives the standard gutters and tab-bar clearance.
  return (
    <div className="page">
    <Routes>
      <Route index element={<OverviewPage />} />
      <Route path="intelligence" element={<IntelligencePage />} />
      <Route path="follow-through" element={<CoordinationPage />} />
      <Route path="reviews" element={<ReviewRegisterPage />} />
      <Route path="decisions" element={<DecisionsPage />} />
      <Route path="workshop" element={<WorkshopPage />} />
      <Route path="stakeholders" element={<StakeholdersPage />} />
    </Routes>
    </div>
  );
}
