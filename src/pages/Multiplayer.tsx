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
      className="frame"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="text-center font-serif text-[28px] font-bold leading-tight text-ink">Multiplayer</h1>
      <p className="mt-1 text-center font-serif italic text-muted">Play with everyone at the table.</p>

      {!SUPABASE_CONFIGURED && (
        <div className="mt-6 border border-error/40 p-3 font-sans text-xs text-error">
          Supabase isn&apos;t configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, then run the migration in{' '}
          <code>supabase/migrations/0001_initial_schema.sql</code>.
        </div>
      )}

      <section className="panel mt-8 p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Create a room</h2>
        <p className="mt-1 font-sans text-sm text-muted">You&apos;ll get a 6-letter code to share.</p>
        <button type="button" className="btn-primary mt-4 w-full" onClick={handleCreate} disabled={busy || loading}>
          Create room
        </button>
      </section>

      <form className="panel mt-4 p-5" onSubmit={handleJoin}>
        <h2 className="font-serif text-lg font-bold text-ink">Join a room</h2>
        <label className="mt-3 block">
          <span className="font-sans text-xs uppercase tracking-wider text-muted">Code</span>
          <input
            className="input-line mt-1 font-serif text-2xl font-bold tracking-[0.25em]"
            value={joinCode}
            onChange={(e) =>
              setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
            }
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="A1B2C3"
          />
        </label>
        <button type="submit" className="btn-ghost mt-4 w-full" disabled={busy || loading}>
          Join
        </button>
      </form>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </motion.div>
  );
}
