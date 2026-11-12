import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loading } from '@/components/ui';
import { ToolsHome } from './ToolsHome';
import { IcsPage } from './ics/IcsPage';
import { GkPage } from './gk/GkPage';
import { PscpPage } from './pscp/PscpPage';
import { EchoSimulator } from './echo/EchoSimulator';
import { EchoCamps, EchoCentre } from './echo/EchoCamps';
import { EchoDashboard } from './echo/EchoDashboard';
import { EchoReport } from './echo/EchoReport';

// The map library is large; it loads only when the ECHO map opens.
const EchoIntel = lazy(() => import('./echo/EchoIntel'));

export default function ToolsRoutes() {
  return (
    <Routes>
      <Route index element={<ToolsHome />} />
      <Route path="ics" element={<IcsPage />} />
      <Route path="gk" element={<GkPage />} />
      <Route path="pscp" element={<PscpPage />} />
      {/* 1.16.0 (ADR-030): ECHO, Evacuation and Camp Handling Operations. */}
      <Route path="echo" element={<EchoSimulator />} />
      <Route path="echo/report" element={<EchoReport />} />
      <Route path="echo/intel" element={<Suspense fallback={<Loading />}><EchoIntel /></Suspense>} />
      <Route path="echo/camps" element={<EchoCamps />} />
      <Route path="echo/camps/:id" element={<EchoCentre />} />
      <Route path="echo/dashboard" element={<EchoDashboard />} />
    </Routes>
  );
}
