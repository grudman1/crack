import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { VoteRow } from '@/types/database';

export function useVotes(roomId: string | undefined) {
  const [votes, setVotes] = useState<VoteRow[]>([]);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('votes').select('*').eq('room_id', roomId);
      if (alive) setVotes((data ?? []) as VoteRow[]);
    };
    void load();
    const channel = supabase
      .channel(`votes:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return votes;
}
