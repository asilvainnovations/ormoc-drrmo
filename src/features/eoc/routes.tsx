import { Route, Routes } from 'react-router-dom';
import { BoardPage } from './BoardPage';
import { LogbookPage } from './LogbookPage';
import { SitrepEditor, SitrepsPage } from './SitrepsPage';
import { RequestsPage } from './RequestsPage';
import { BarangaysPage } from './BarangaysPage';
import { AaHomePage } from './aa/AaHomePage';
import { PdraNewPage, PdraViewPage } from './aa/PdraPage';
import { DeclarationPage } from './aa/DeclarationPage';
import { FundsPage } from './aa/FundsPage';

export default function EocRoutes() {
  return (
    <Routes>
      <Route index element={<BoardPage />} />
      <Route path="log" element={<LogbookPage />} />
      <Route path="sitreps" element={<SitrepsPage />} />
      <Route path="sitreps/:id" element={<SitrepEditor />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="barangays" element={<BarangaysPage />} />
      <Route path="aa" element={<AaHomePage />} />
      <Route path="aa/pdra/new" element={<PdraNewPage />} />
      <Route path="aa/pdra/:id" element={<PdraViewPage />} />
      <Route path="aa/d/:id" element={<DeclarationPage />} />
      <Route path="aa/funds" element={<FundsPage />} />
    </Routes>
  );
}
