import { useRealtimeRow } from '@/hooks/useRealtime';
import type { RoomRow } from '@/types/database';

// Caller expects { room, loading, error } — preserve that shape by
// remapping `row` from the generic hook.
export function useRoom(roomCode: string | undefined) {
  const { row, loading, error } = useRealtimeRow<RoomRow>({
    table: 'rooms',
    matchColumn: 'code',
    matchValue: roomCode?.toUpperCase(),
    channelKey: roomCode ? `room:${roomCode.toUpperCase()}` : undefined,
  });
  return { room: row, loading, error };
}
