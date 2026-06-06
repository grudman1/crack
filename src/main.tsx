import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import { Toaster } from '@/components/ui/toast';

// Sentry — error monitoring only (no replay/tracing/logging). DSN
// comes from Vercel env; local dev + CI run without it and Sentry
// stays a no-op. Sentry.init auto-installs window.onerror and
// unhandledrejection handlers, so we don't add any listeners here.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
  });
}

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
