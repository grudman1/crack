import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './index.css';
import App from './App';
import { Toaster } from '@/components/ui/toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster />
      {/* Both are zero-config: auto-detect Vercel production deploys
          and start collecting; local dev calls are filtered out. */}
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  </StrictMode>,
);
