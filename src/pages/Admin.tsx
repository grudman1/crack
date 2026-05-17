// /admin — moderation queue for player review submissions.
//
// Gated by useAdmin(): non-admins (including signed-out users) get
// redirected to /. Lists rows by status, subscribes to realtime so new
// submissions appear without a refresh. Each row owns its own
// resolution UI (see ReviewQueueItem).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { useReviews } from '@/hooks/useReviews';
import { ReviewQueueItem } from '@/components/ReviewQueueItem';
import type { ReviewStatus } from '@/types/database';

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'duplicate', label: 'Duplicate' },
];

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ReviewStatus>('pending');

  // We need all four counts so the tab labels can show row counts. The
  // simplest option: subscribe to the un-filtered list and bucket
  // client-side. Keeps the realtime channels to one.
  const { reviews: allReviews, loading: reviewsLoading } = useReviews();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [adminLoading, isAdmin, navigate]);

  const counts = useMemo(() => {
    const out: Record<ReviewStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      duplicate: 0,
    };
    for (const r of allReviews) out[r.status] += 1;
    return out;
  }, [allReviews]);

  const visible = useMemo(() => allReviews.filter((r) => r.status === tab), [allReviews, tab]);

  if (adminLoading) {
    return (
      <div className="mx-auto w-full max-w-[56rem] px-4 py-10">
        <p className="font-sans text-sm text-muted">Loading…</p>
      </div>
    );
  }
  if (!isAdmin) return null; // redirect is in-flight

  return (
    <div className="mx-auto w-full max-w-[56rem] px-4 py-8">
      <h1 className="font-serif text-[28px] font-bold text-ink lg:text-[36px]">/admin</h1>
      <p className="mt-1 font-serif italic text-muted">
        Review queue for player-submitted validator feedback.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-hairline pb-3">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`btn-pill-sm ${tab === key ? 'btn-ghost--selected' : ''}`}
          >
            {label}{' '}
            <span className="ml-1 font-mono text-[11px] text-muted">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {reviewsLoading && visible.length === 0 ? (
          <p className="font-sans text-sm text-muted">Loading reviews…</p>
        ) : visible.length === 0 ? (
          <p className="font-sans text-sm text-muted">Nothing here yet.</p>
        ) : (
          <ul className="space-y-4">
            {visible.map((r) => (
              <ReviewQueueItem key={r.id} review={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
