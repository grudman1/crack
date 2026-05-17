import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { submitReview } from '@/services/reviewService';
import { sanitizeError } from '@/lib/sanitizeError';
import type { TraceRecord } from '@/services/wikiValidationService';

interface ReviewContext {
  name: string;
  expectedPair: string;
  actualResult: 'valid' | 'invalid';
  /** For 'invalid' rows: the rejection reason. For 'valid' rows: the
   *  canonical name Wikipedia matched to (so the player can see what
   *  the validator thinks they typed). */
  reason?: string | null;
  trace: TraceRecord[];
}

interface ReviewSubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ReviewContext;
  onSubmitted?: () => void;
}

const MAX_COMMENT = 280;

function pairToDot(pair: string): string {
  const u = (pair ?? '').toUpperCase();
  if (u.length < 2) return u;
  return `${u[0]} · ${u[1]}`;
}

export function ReviewSubmitModal({
  open,
  onOpenChange,
  context,
  onSubmitted,
}: ReviewSubmitModalProps) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset the comment whenever the modal closes so re-opening on a new
  // row starts clean.
  useEffect(() => {
    if (!open) setComment('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submitReview({
        name: context.name,
        expectedPair: context.expectedPair,
        actualResult: context.actualResult,
        reason: context.reason ?? null,
        trace: context.trace,
        userComment: comment,
      });
      toast.success("Thanks, we'll review.");
      onOpenChange(false);
      onSubmitted?.();
    } catch (err) {
      toast.error(sanitizeError(err));
    } finally {
      setBusy(false);
    }
  };

  const isAccepted = context.actualResult === 'valid';
  const resultLabel = isAccepted ? 'Accepted as:' : 'Result:';
  const promptLabel = isAccepted
    ? "Why do you think this shouldn't count?"
    : 'Why do you think this should count?';
  const resultValueClass = isAccepted ? 'text-success' : 'text-error';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[420px] !p-5 lg:!p-6">
        <DialogTitle className="!text-[22px] pr-8">Submit for review</DialogTitle>

        <div className="mt-5 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">You typed:</span>
            <span className="font-serif text-[18px] font-bold text-ink">{context.name || '—'}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">For the pair:</span>
            <span className="font-serif text-[18px] font-bold tabular-nums text-ink">
              {pairToDot(context.expectedPair)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">{resultLabel}</span>
            <span className={`font-sans text-sm ${resultValueClass}`}>{context.reason || '—'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">{promptLabel}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
              placeholder="optional — adds context for review"
              rows={3}
              // text-base (16px) on mobile prevents iOS Safari's
              // auto-zoom-on-focus; lg can drop back to 14 px.
              className="input-line mt-1 w-full resize-none font-sans text-base lg:text-sm"
              maxLength={MAX_COMMENT}
            />
            <div className="mt-1 flex justify-end">
              <span className="font-sans text-[11px] tabular-nums text-muted">
                {comment.length}/{MAX_COMMENT}
              </span>
            </div>
          </label>

          <p className="mt-3 font-sans text-[12px] leading-relaxed text-muted">
            We review submissions and add verified names to the dataset, or fix the validator.
          </p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn-pill-sm !min-h-[2.75rem] !px-4 lg:!min-h-[2rem] lg:!px-3.5"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary !min-h-[2.75rem] !px-5 !text-sm lg:!min-h-[2.5rem]"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
