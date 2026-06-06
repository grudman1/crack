import { useEffect } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtime';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import type { ScoreRow } from '@/types/database';

export function useScores(roomId: string | undefined): ScoreRow[] {
  const { rows, error } = useRealtimeTable<ScoreRow>({
    table: 'scores',
    matchColumn: 'room_id',
    matchValue: roomId,
    channelKey: roomId ? `scores:${roomId}` : undefined,
  });
  useEffect(() => {
    if (error) toast.error(`Couldn't load scores: ${sanitizeError(error)}`);
  }, [error]);
  return rows;
}
