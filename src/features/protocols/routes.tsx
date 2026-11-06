import { Route, Routes } from 'react-router-dom';
import { ProtocolsPage } from './ProtocolsPage';
import { RunPage } from './RunPage';
import { FormsPage } from './FormsPage';

export default function DrrmRoutes() {
  return (
    <Routes>
      <Route index element={<ProtocolsPage kind="workflows" />} />
      <Route path="protocols" element={<ProtocolsPage key="p" kind="protocols" />} />
      <Route path="forms" element={<FormsPage />} />
      <Route path="run/:runId" element={<RunPage />} />
    </Routes>
  );
}
