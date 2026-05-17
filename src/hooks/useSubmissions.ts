import { useRealtimeTable } from '@/hooks/useRealtime';
import type { SubmissionRow } from '@/types/database';

export function useSubmissions(roomId: string | undefined): SubmissionRow[] {
  const { rows } = useRealtimeTable<SubmissionRow>({
    table: 'submissions',
    matchColumn: 'room_id',
    matchValue: roomId,
    channelKey: roomId ? `subs:${roomId}` : undefined,
  });
  return rows;
}
