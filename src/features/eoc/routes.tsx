import { Navigate, Route, Routes } from 'react-router-dom';
import { BoardPage } from './BoardPage';
import { LogbookPage } from './LogbookPage';
import { SitrepEditor, SitrepsPage } from './SitrepsPage';
import { RequestsPage } from './RequestsPage';
import { BarangaysPage } from './BarangaysPage';
import { AaHomePage } from './aa/AaHomePage';
import { PdraNewPage, PdraViewPage } from './aa/PdraPage';
import { DeclarationPage } from './aa/DeclarationPage';
import { FundsPage } from './aa/FundsPage';
import { PlansPage } from './PlansPage';
import { RosterPage } from './RosterPage';
import { LiaisonPage } from './LiaisonPage';
import { RiskPage } from './RiskPage';
import { lazy, Suspense } from 'react';
import { Loading } from '@/components/ui';

// The map library is large; it loads only when the Map tab opens.
const MapPage = lazy(() => import('./MapPage'));

export default function EocRoutes() {
  return (
    <Routes>
      <Route index element={<BoardPage />} />
      <Route path="log" element={<LogbookPage />} />
      <Route path="sitreps" element={<SitrepsPage />} />
      <Route path="sitreps/:id" element={<SitrepEditor />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="barangays" element={<BarangaysPage />} />
      <Route path="liaison" element={<LiaisonPage />} />
      <Route path="risk" element={<RiskPage />} />
      <Route path="plans" element={<PlansPage />} />
      <Route path="roster" element={<RosterPage />} />
      <Route path="map" element={<Suspense fallback={<Loading />}><MapPage /></Suspense>} />
      {/* 1.16.0: Hazard maps moved to Assess; old links still work. */}
      <Route path="hazard-maps" element={<Navigate to="/assess/hazard-maps" replace />} />
      <Route path="aa" element={<AaHomePage />} />
      <Route path="aa/pdra/new" element={<PdraNewPage />} />
      <Route path="aa/pdra/:id" element={<PdraViewPage />} />
      <Route path="aa/d/:id" element={<DeclarationPage />} />
      <Route path="aa/funds" element={<FundsPage />} />
    </Routes>
  );
}
