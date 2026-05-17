import { useRealtimeTable } from '@/hooks/useRealtime';
import type { VoteRow } from '@/types/database';

export function useVotes(roomId: string | undefined): VoteRow[] {
  const { rows } = useRealtimeTable<VoteRow>({
    table: 'votes',
    matchColumn: 'room_id',
    matchValue: roomId,
    channelKey: roomId ? `votes:${roomId}` : undefined,
  });
  return rows;
}
