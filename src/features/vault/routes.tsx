import { Route, Routes } from 'react-router-dom';
import { VaultDocumentPage, VaultGate, VaultPage, VaultReferencesPage, VaultReviewPage } from './VaultPages';

export default function VaultRoutes() {
  return (
    <VaultGate>
      <Routes>
        <Route index element={<VaultPage />} />
        <Route path="d/:id" element={<VaultDocumentPage />} />
        <Route path="review" element={<VaultReviewPage />} />
        <Route path="references" element={<VaultReferencesPage />} />
      </Routes>
    </VaultGate>
  );
}
