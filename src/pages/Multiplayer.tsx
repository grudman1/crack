import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/AuthModal';
import { createRoom, findRoomByCode, joinRoom } from '@/services/roomService';
import { SUPABASE_CONFIGURED } from '@/services/supabase';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';

export default function Multiplayer() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const requireAuth = () => {
    if (!user) {
      setAuthOpen(true);
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!requireAuth() || !user) return;
    setBusy(true);
    try {
      const room = await createRoom(user.id, 180);
      navigate(`/mp/${room.code}`);
    } catch (e) {
      toast.error(sanitizeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth() || !user) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setBusy(true);
    try {
      const room = await findRoomByCode(code);
      if (!room) {
        toast.error('Room not found.');
        return;
      }
      await joinRoom(room.id, user.id);
      navigate(`/mp/${room.code}`);
    } catch (e) {
      toast.error(sanitizeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="mx-auto max-w-3xl px-6 py-10"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <h1 className="font-display text-3xl uppercase text-center">Multiplayer</h1>
      <p className="font-hand text-xl text-ink-soft text-center mt-1">play with everyone at the table</p>

      {!SUPABASE_CONFIGURED && (
        <div className="paper-card p-4 mt-6 text-sm text-accent-red">
          Supabase isn&apos;t configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code> and run the migration in{' '}
          <code>supabase/migrations/0001_initial_schema.sql</code>.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6 mt-8">
        <div className="paper-card p-6">
          <h2 className="font-display text-xl uppercase">Create a room</h2>
          <p className="font-body text-sm text-ink-soft mt-1">You&apos;ll get a 6-letter code to share.</p>
          <button
            className="btn-paper btn-paper--primary mt-4 w-full"
            onClick={handleCreate}
            disabled={busy || loading}
          >
            Create room
          </button>
        </div>
        <form className="paper-card p-6" onSubmit={handleJoin}>
          <h2 className="font-display text-xl uppercase">Join a room</h2>
          <label className="block mt-3">
            <span className="font-hand text-lg text-ink-soft">code</span>
            <input
              className="ink-input border-b border-ink/40 mt-0.5 py-1 font-display text-xl tracking-widest"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect="off"
              placeholder="A1B2C3"
            />
          </label>
          <button className="btn-paper mt-4 w-full" disabled={busy || loading}>
            Join
          </button>
        </form>
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </motion.div>
  );
}
