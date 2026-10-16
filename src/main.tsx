import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { env } from '@/lib/env';
import { ConfigErrorPage } from '@/features/auth/ConfigErrorPage';

const root = createRoot(document.getElementById('root')!);
if (env.configError) {
  root.render(<StrictMode><ConfigErrorPage message={env.configError} /></StrictMode>);
} else {
  void import('./App').then(({ App }) => root.render(<StrictMode><App /></StrictMode>));
}
