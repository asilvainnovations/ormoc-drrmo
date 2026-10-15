import { Route, Routes } from 'react-router-dom';
import { ProtocolsPage } from './ProtocolsPage';
import { RunPage } from './RunPage';

export default function ProtocolRoutes() {
  return (
    <Routes>
      <Route index element={<ProtocolsPage />} />
      <Route path="run/:runId" element={<RunPage />} />
    </Routes>
  );
}
