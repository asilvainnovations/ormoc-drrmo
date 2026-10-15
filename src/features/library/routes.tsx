import { Route, Routes } from 'react-router-dom';
import { LibraryPage } from './LibraryPage';
import { DocumentPage } from './DocumentPage';
import { TracePage } from './TracePage';
import { RequirementsPage } from './RequirementsPage';
import { CrosswalkPage } from './CrosswalkPage';

export default function LibraryRoutes() {
  return (
    <Routes>
      <Route index element={<LibraryPage />} />
      <Route path="doc/:id" element={<DocumentPage />} />
      <Route path="trace" element={<TracePage />} />
      <Route path="requirements" element={<RequirementsPage />} />
      <Route path="crosswalk" element={<CrosswalkPage />} />
    </Routes>
  );
}
