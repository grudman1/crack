import { useEffect } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtime';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import type { SubmissionRow } from '@/types/database';

export function useSubmissions(roomId: string | undefined): SubmissionRow[] {
  const { rows, error } = useRealtimeTable<SubmissionRow>({
    table: 'submissions',
    matchColumn: 'room_id',
    matchValue: roomId,
    channelKey: roomId ? `subs:${roomId}` : undefined,
  });
  useEffect(() => {
    if (error) toast.error(`Couldn't load submissions: ${sanitizeError(error)}`);
  }, [error]);
  return rows;
}
