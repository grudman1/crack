import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { SubmissionRow } from '@/types/database';

export function useSubmissions(roomId: string | undefined) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('submissions').select('*').eq('room_id', roomId);
      if (alive) setSubmissions((data ?? []) as SubmissionRow[]);
    };
    void load();
    const channel = supabase
      .channel(`subs:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `room_id=eq.${roomId}` },
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

  return submissions;
}
