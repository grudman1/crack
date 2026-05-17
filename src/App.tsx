import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/Layout';
import Index from '@/pages/Index';
import Solo from '@/pages/Solo';
import Multiplayer from '@/pages/Multiplayer';
import Room from '@/pages/Room';
import HowToPlay from '@/pages/HowToPlay';
import NotFound from '@/pages/NotFound';
import Debug from '@/pages/Debug';
import Admin from '@/pages/Admin';

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
          <Route path="/debug" element={<Debug />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export default App;
