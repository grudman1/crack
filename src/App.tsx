import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from '@/components/Layout';
import Index from '@/pages/Index';
import Solo from '@/pages/Solo';
import Multiplayer from '@/pages/Multiplayer';
import Room from '@/pages/Room';
import HowToPlay from '@/pages/HowToPlay';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <>
      <AnimatePresence mode="wait">
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/solo" element={<Solo />} />
            <Route path="/mp" element={<Multiplayer />} />
            <Route path="/mp/:roomCode" element={<Room />} />
            <Route path="/how" element={<HowToPlay />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AnimatePresence>
      <Analytics />
    </>
  );
}

export default App;
