import { Route, Routes } from 'react-router-dom';
import { EocAssessmentBoardPage } from './BoardPage';

export default function EocAssessmentRoutes() {
  return (
    <Routes>
      <Route index element={<EocAssessmentBoardPage />} />
    </Routes>
  );
}
