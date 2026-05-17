import { useRealtimeTable } from '@/hooks/useRealtime';
import type { ScoreRow } from '@/types/database';

export function useScores(roomId: string | undefined): ScoreRow[] {
  const { rows } = useRealtimeTable<ScoreRow>({
    table: 'scores',
    matchColumn: 'room_id',
    matchValue: roomId,
    channelKey: roomId ? `scores:${roomId}` : undefined,
  });
  return rows;
}
