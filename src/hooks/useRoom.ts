import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { RoomRow } from '@/types/database';

export function useRoom(roomCode: string | undefined) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: e } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode.toUpperCase())
          .maybeSingle();
        if (e) throw e;
        if (alive) setRoom((data as RoomRow | null) ?? null);
      } catch (e) {
        if (alive) setError(e as Error);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode.toUpperCase()}` },
        (payload) => {
          if (!alive) return;
          if (payload.eventType === 'DELETE') setRoom(null);
          else setRoom(payload.new as RoomRow);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [roomCode]);

  return { room, loading, error };
}
