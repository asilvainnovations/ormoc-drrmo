import { Route, Routes } from 'react-router-dom';
import { ToolsHome } from './ToolsHome';
import { IcsPage } from './ics/IcsPage';
import { GkPage } from './gk/GkPage';
import { PscpPage } from './pscp/PscpPage';

export default function ToolsRoutes() {
  return (
    <Routes>
      <Route index element={<ToolsHome />} />
      <Route path="ics" element={<IcsPage />} />
      <Route path="gk" element={<GkPage />} />
      <Route path="pscp" element={<PscpPage />} />
    </Routes>
  );
}
