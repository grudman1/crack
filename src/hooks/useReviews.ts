import { useCallback } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtime';
import { listReviews } from '@/services/reviewService';
import type { ReviewStatus, ValidationReviewRow } from '@/types/database';

interface UseReviewsResult {
  reviews: ValidationReviewRow[];
  loading: boolean;
  refresh: () => void;
}

/** Subscribes to validation_reviews and re-loads the (optionally
 *  status-filtered) list whenever the table changes. Wraps
 *  useRealtimeTable with a custom loadFn so RLS-aware filtering stays
 *  in reviewService. Subscribes to ALL changes on the table — admins
 *  want to see new submissions land regardless of which tab is open. */
export function useReviews(status?: ReviewStatus): UseReviewsResult {
  const loadFn = useCallback(() => listReviews(status), [status]);
  const { rows, loading, refresh } = useRealtimeTable<ValidationReviewRow>({
    table: 'validation_reviews',
    channelKey: `reviews:${status ?? 'all'}`,
    loadFn,
  });
  return { reviews: rows, loading, refresh };
}
