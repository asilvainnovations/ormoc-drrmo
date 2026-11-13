import { Route, Routes } from 'react-router-dom';
import { RaciboardPage } from './RaciboardPage';

export default function RaciRoutes() {
  return (
    <Routes>
      <Route index element={<RaciboardPage />} />
    </Routes>
  );
}
