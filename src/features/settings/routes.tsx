import { Route, Routes } from 'react-router-dom';
import { AboutPage, BarangaysAdminPage, SettingsPage, SyncPage, UsersPage } from './SettingsPages';
import { ConnectedAppsPage } from './ConnectedAppsPage';

export default function SettingsRoutes() {
  return (
    <Routes>
      <Route index element={<SettingsPage />} />
      <Route path="sync" element={<SyncPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="barangays" element={<BarangaysAdminPage />} />
      <Route path="apps" element={<ConnectedAppsPage />} />
      <Route path="about" element={<AboutPage />} />
    </Routes>
  );
}
