import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { ScoreRow } from '@/types/database';

export function useScores(roomId: string | undefined) {
  const [scores, setScores] = useState<ScoreRow[]>([]);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('scores').select('*').eq('room_id', roomId);
      if (alive) setScores((data ?? []) as ScoreRow[]);
    };
    void load();
    const channel = supabase
      .channel(`scores:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `room_id=eq.${roomId}` },
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

  return scores;
}
