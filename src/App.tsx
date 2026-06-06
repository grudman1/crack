import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/Layout';
import Index from '@/pages/Index';
import Solo from '@/pages/Solo';
import Multiplayer from '@/pages/Multiplayer';
import Room from '@/pages/Room';
import HowToPlay from '@/pages/HowToPlay';
import NotFound from '@/pages/NotFound';
import Admin from '@/pages/Admin';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';

// /debug used to be a separate page. It now lives as Section 1+3 of
// /admin (the workbench + regression set). Preserve query params on
// the redirect so /debug?name=…&pair=… → /admin?name=…&pair=… and the
// merged page auto-fires Section 1.
function DebugRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/admin${search}`} replace />;
}

function App() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/solo" element={<Solo />} />
          <Route path="/mp" element={<Multiplayer />} />
          <Route path="/mp/:roomCode" element={<Room />} />
          <Route path="/how" element={<HowToPlay />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/debug" element={<DebugRedirect />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export default App;
