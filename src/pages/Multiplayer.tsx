// Multiplayer landing: pick a name, create or join a room. No
// sign-in required — Supabase anonymous auth gives the player a real
// auth.uid() so all the existing RLS policies and room_players /
// submissions / votes / scores wiring just works.
//
// Email/password is still available via the hamburger menu as an
// upgrade path for players who want cross-device persistence; signing
// up over an anonymous session auto-promotes the account, carrying
// the profile + room history forward.

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { createRoom, findRoomByCode, joinRoom } from '@/services/roomService';
import { getDisplayName, updateDisplayName } from '@/services/profileService';
import { SUPABASE_CONFIGURED } from '@/services/supabase';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';

const LS_NAME_KEY = 'crack:last_display_name';

function loadCachedName(): string {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(LS_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveCachedName(name: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LS_NAME_KEY, name);
  } catch {
    /* swallow */
  }
}

export default function Multiplayer() {
  const { user, loading, signInAnonymously } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>(() => loadCachedName());
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const profileFetchedFor = useRef<string | null>(null);

  // Pre-fill the name input from the existing profile if a session
  // exists. We only fetch once per user.id to avoid clobbering the
  // input while the player is typing.
  useEffect(() => {
    if (!user || profileFetchedFor.current === user.id) return;
    profileFetchedFor.current = user.id;
    void (async () => {
      const dn = await getDisplayName(user.id);
      if (dn && !name) setName(dn);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** Ensure we have a session with the right display_name, then return
   *  the user id we should use for the room call. */
  const ensureUserWithName = async (typedName: string): Promise<string> => {
    if (!user) {
      const u = await signInAnonymously(typedName);
      return u.id;
    }
    // Already signed in. If the typed name differs from what's stored,
    // update the profile so other players see the new label.
    const stored = await getDisplayName(user.id);
    if (stored !== typedName) {
      await updateDisplayName(user.id, typedName);
    }
    return user.id;
  };

  const validateName = (): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a name to play.');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleCreate = async () => {
    if (!validateName()) return;
    const typedName = name.trim().slice(0, 24);
    saveCachedName(typedName);
    setBusy(true);
    try {
      const uid = await ensureUserWithName(typedName);
      const room = await createRoom(uid, 180);
      navigate(`/mp/${room.code}`);
    } catch (e) {
      toast.error(sanitizeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateName()) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    const typedName = name.trim().slice(0, 24);
    saveCachedName(typedName);
    setBusy(true);
    try {
      const room = await findRoomByCode(code);
      if (!room) {
        toast.error('Room not found.');
        return;
      }
      const uid = await ensureUserWithName(typedName);
      await joinRoom(room.id, uid);
      navigate(`/mp/${room.code}`);
    } catch (e) {
      toast.error(sanitizeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleNameChange = (v: string) => {
    setName(v.slice(0, 24));
    if (nameError && v.trim()) setNameError(null);
  };

  return (
    <motion.div
      className="frame"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="text-center font-serif text-[28px] font-bold leading-tight text-ink lg:text-[48px]">
        Multiplayer
      </h1>
      <p className="mt-1 text-center font-serif italic text-muted lg:mt-3 lg:text-[20px]">
        Play with everyone at the table.
      </p>

      {!SUPABASE_CONFIGURED && (
        <div className="mt-6 border border-error/40 p-3 font-sans text-xs text-error">
          Supabase isn&apos;t configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, then run the migrations in{' '}
          <code>supabase/migrations/</code>.
        </div>
      )}

      <section className="panel mt-8 p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Your name</h2>
        <label className="mt-3 block">
          <input
            className="input-line mt-1 font-sans text-base"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Your name"
            maxLength={24}
            autoComplete="nickname"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {nameError && (
          <p className="mt-2 font-sans text-xs text-error">{nameError}</p>
        )}
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Create a room</h2>
        <p className="mt-1 font-sans text-sm text-muted">You&apos;ll get a 6-letter code to share.</p>
        <button
          type="button"
          className="btn-primary mt-4 w-full"
          onClick={() => void handleCreate()}
          disabled={busy || loading}
        >
          {busy ? 'Creating…' : 'Create room'}
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
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
    </motion.div>
  );
}
