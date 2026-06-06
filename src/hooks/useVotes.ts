import { useEffect } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtime';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import type { VoteRow } from '@/types/database';

export function useVotes(roomId: string | undefined): VoteRow[] {
  const { rows, error } = useRealtimeTable<VoteRow>({
    table: 'votes',
    matchColumn: 'room_id',
    matchValue: roomId,
    channelKey: roomId ? `votes:${roomId}` : undefined,
  });
  // Surface realtime/load failures rather than silently rendering
  // empty state. The hook keeps returning rows so call sites stay
  // unchanged; the toast is the only side effect.
  useEffect(() => {
    if (error) toast.error(`Couldn't load votes: ${sanitizeError(error)}`);
  }, [error]);
  return rows;
}
