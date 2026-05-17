import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { listReviews } from '@/services/reviewService';
import type { ReviewStatus, ValidationReviewRow } from '@/types/database';

interface UseReviewsResult {
  reviews: ValidationReviewRow[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/** Subscribes to validation_reviews and re-loads the (optionally
 *  status-filtered) list whenever the table changes. Mirrors
 *  useSubmissions — fetch on mount + realtime channel that re-runs the
 *  query on any event. */
export function useReviews(status?: ReviewStatus): UseReviewsResult {
  const [reviews, setReviews] = useState<ValidationReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await listReviews(status);
      setReviews(rows);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    void load();
    const channel = supabase
      .channel(`reviews:${status ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'validation_reviews' },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [status, load]);

  return { reviews, loading, refresh: load };
}
