// One row in the admin queue. Owns its own resolution UX (one of
// the four action buttons → inline note input → confirm), plus two
// callbacks the parent wires to the workbench:
//
//   onTestThis(name, pair)   — populate the workbench inputs and
//                              scroll to it (admin re-tests + tweaks)
//   onRerunValidation(...)   — re-validate this exact row with the
//                              cache bypassed (parent supplies the
//                              hit so all queue items share a single
//                              validator import). The new result is
//                              stored locally and overrides the
//                              displayed trace until the next mount.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, RotateCw } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import { TraceViewer } from '@/components/TraceViewer';
import { CopyBlock } from '@/components/CopyBlock';
import { pairToDot } from '@/lib/traceFormat';
import { diagnoseTrace } from '@/lib/diagnoseTrace';
import {
  regressionSnippet,
  famousPeopleSnippet,
  removeFromDatasetSnippet,
} from '@/lib/reviewSnippets';
import { resolveReview, type Resolution } from '@/services/reviewService';
import {
  validateName,
  clearValidationCache,
  type TraceRecord,
  type ValidationResult,
} from '@/services/wikiValidationService';
import type { ValidationReviewRow } from '@/types/database';

type ActionKey =
  | 'fix_validator'
  | 'add_to_dataset'
  | 'remove_from_dataset'
  | 'reject'
  | 'duplicate'
  | null;

interface Props {
  review: ValidationReviewRow;
  /** Parent populates workbench inputs + scrolls to the workbench. */
  onTestThis?: (name: string, pair: string) => void;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ReviewQueueItem({ review, onTestThis }: Props) {
  const [action, setAction] = useState<ActionKey>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  // Re-run state — purely in-memory, never written back to the row.
  const [revalidated, setRevalidated] = useState<{
    result: ValidationResult;
    trace: TraceRecord[];
  } | null>(null);
  const [rerunBusy, setRerunBusy] = useState(false);

  // useMemo guards both the trace and the diagnosis so the array
  // identity is stable across renders that don't actually touch either
  // input — without this, displayedTrace was `?? []`, which made a
  // fresh empty array on each render and re-fired the diag memo.
  const displayedTrace = useMemo(
    () => revalidated?.trace ?? review.trace ?? [],
    [revalidated, review.trace],
  );
  const diag = useMemo(
    () => diagnoseTrace(displayedTrace, review.expected_pair),
    [displayedTrace, review.expected_pair],
  );

  const handleRerun = async () => {
    setRerunBusy(true);
    try {
      const trace: TraceRecord[] = [];
      clearValidationCache();
      const result = await validateName(review.name, {
        expectedInitials: review.expected_pair,
        trace: (r) => trace.push(r),
        bypassCache: true,
      });
      setRevalidated({ result, trace });
      setTraceOpen(true);
    } catch (err) {
      toast.error(sanitizeError(err));
    } finally {
      setRerunBusy(false);
    }
  };

  const submitResolution = async (
    kind: 'approved' | 'rejected' | 'duplicate',
    type?: 'fix_validator' | 'add_to_dataset' | 'remove_from_dataset',
  ) => {
    setBusy(true);
    try {
      const resolution: Resolution =
        kind === 'approved'
          ? { kind, resolutionType: type!, note }
          : { kind, note };
      await resolveReview(review.id, resolution);
      toast.success('Resolution saved.');
      setAction(null);
      setNote('');
    } catch (err) {
      toast.error(sanitizeError(err));
    } finally {
      setBusy(false);
    }
  };

  const isPending = review.status === 'pending';
  const isApprovedFix = review.status === 'approved' && review.resolution_type === 'fix_validator';
  const isApprovedData = review.status === 'approved' && review.resolution_type === 'add_to_dataset';
  const isApprovedRemove =
    review.status === 'approved' && review.resolution_type === 'remove_from_dataset';
  const isRejected = review.status === 'rejected';
  const isDuplicate = review.status === 'duplicate';

  const secondaryApproveKey: 'add_to_dataset' | 'remove_from_dataset' =
    review.actual_result === 'valid' ? 'remove_from_dataset' : 'add_to_dataset';
  const secondaryApproveLabel =
    secondaryApproveKey === 'add_to_dataset'
      ? 'Approve — add to dataset'
      : 'Approve — remove from dataset';

  // "Result changed" badge: after re-run, compare the new verdict to
  // what the row was originally recorded as.
  const rerunChangedVerdict =
    revalidated && revalidated.result.status !== review.actual_result;

  const fmtVerdict = (v: 'valid' | 'invalid') => (v === 'valid' ? 'ACCEPT' : 'REJECT');

  return (
    <li className="border border-hairline bg-paper p-4">
      {/* Header row */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-serif text-[18px] font-bold tabular-nums text-ink">
          {pairToDot(review.expected_pair)}
        </span>
        <span className="font-serif text-[18px] font-bold text-ink">{review.name || '(empty)'}</span>
        <StatusTag status={review.status} resolutionType={review.resolution_type} />
        {rerunChangedVerdict && (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-accent">
            result changed: was {fmtVerdict(review.actual_result)}, now{' '}
            {fmtVerdict(revalidated!.result.status)}
          </span>
        )}
      </div>
      <div className="mt-1 font-sans text-xs text-muted">
        Submitted {timeAgo(review.created_at)} · {review.player_id ? 'authed player' : 'anonymous'}
      </div>

      {/* Reason + comment */}
      {review.reason && (
        <p className="mt-3 font-sans text-sm text-ink">
          <span className="text-muted">Rejection reason:</span> {review.reason}
        </p>
      )}
      {review.user_comment && (
        <p className="mt-2 font-sans text-sm text-ink">
          <span className="text-muted">Comment:</span> &ldquo;{review.user_comment}&rdquo;
        </p>
      )}

      {/* Diagnostic — recomputed against the displayed trace, so a re-run updates it. */}
      <div className="mt-3 rounded border border-hairline bg-paper-shadow/30 p-3">
        <div className="font-sans text-[11px] uppercase tracking-wider text-muted">Diagnostic</div>
        <div className="mt-1 font-sans text-sm text-ink">
          <div>
            <span className="text-muted">Likely cause:</span> {diag.likelyCause}
          </div>
          {diag.suspectedStage && (
            <div>
              <span className="text-muted">Suspected stage:</span> {diag.suspectedStage}
            </div>
          )}
          <div className="mt-1">{diag.hint}</div>
          <div className="mt-1">
            <span className="text-muted">Suggested:</span>{' '}
            {diag.suggestedAction === 'fix_validator'
              ? 'Fix validator'
              : diag.suggestedAction === 'add_to_dataset'
                ? 'Add to dataset'
                : 'Remove from dataset'}
          </div>
        </div>
      </div>

      {/* Trace + workbench / re-run controls */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setTraceOpen((v) => !v)}
          className="flex items-center gap-1 font-sans text-xs text-muted hover:text-ink"
        >
          {traceOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          View trace ({displayedTrace.length} records{revalidated ? ', re-run' : ''})
        </button>
        {onTestThis && (
          <button
            type="button"
            onClick={() => onTestThis(review.name, review.expected_pair)}
            className="flex items-center gap-1 font-sans text-xs text-muted hover:text-ink"
            title="Open this row in the workbench above"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={1.75} /> Test this
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleRerun()}
          disabled={rerunBusy}
          className="flex items-center gap-1 font-sans text-xs text-muted hover:text-ink disabled:opacity-50"
          title="Re-validate this row with the cache bypassed (in-memory only)"
        >
          <RotateCw className={`h-3 w-3 ${rerunBusy ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          {rerunBusy ? 'Re-running…' : 'Re-run validation'}
        </button>
      </div>
      {traceOpen && <TraceViewer trace={displayedTrace} className="mt-2" />}

      {/* Actions / post-resolution snippets */}
      {isPending ? (
        <div className="mt-4 border-t border-hairline pt-3">
          {action === null ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn-pill-sm ${diag.suggestedAction === 'fix_validator' ? 'btn-ghost--selected' : ''}`}
                onClick={() => setAction('fix_validator')}
              >
                Approve — fix validator
              </button>
              <button
                type="button"
                className={`btn-pill-sm ${diag.suggestedAction === secondaryApproveKey ? 'btn-ghost--selected' : ''}`}
                onClick={() => setAction(secondaryApproveKey)}
              >
                {secondaryApproveLabel}
              </button>
              <button type="button" className="btn-pill-sm" onClick={() => setAction('reject')}>
                Reject
              </button>
              <button type="button" className="btn-pill-sm" onClick={() => setAction('duplicate')}>
                Duplicate
              </button>
            </div>
          ) : (
            <div>
              <label className="block">
                <span className="font-sans text-[11px] uppercase tracking-wider text-muted">
                  Resolution note (optional)
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="input-line mt-1 w-full resize-none font-sans text-sm"
                  placeholder={
                    action === 'fix_validator'
                      ? 'e.g. title-strip pattern, see exact stage'
                      : action === 'add_to_dataset'
                        ? 'e.g. Wikipedia has no article, curated entry'
                        : action === 'remove_from_dataset'
                          ? 'e.g. wrong entry — wrong person or not famous enough'
                          : 'optional context'
                  }
                />
              </label>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn-pill-sm"
                  onClick={() => {
                    setAction(null);
                    setNote('');
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary !min-h-[2.5rem] !px-5 !text-sm"
                  onClick={() => {
                    if (action === 'fix_validator') void submitResolution('approved', 'fix_validator');
                    else if (action === 'add_to_dataset') void submitResolution('approved', 'add_to_dataset');
                    else if (action === 'remove_from_dataset')
                      void submitResolution('approved', 'remove_from_dataset');
                    else if (action === 'reject') void submitResolution('rejected');
                    else if (action === 'duplicate') void submitResolution('duplicate');
                  }}
                  disabled={busy}
                >
                  {busy ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 border-t border-hairline pt-3">
          {review.resolution_note && (
            <p className="font-sans text-sm text-ink">
              <span className="text-muted">Note:</span> {review.resolution_note}
            </p>
          )}
          {review.reviewed_at && (
            <p className="mt-1 font-sans text-xs text-muted">Resolved {timeAgo(review.reviewed_at)}</p>
          )}
          {isApprovedFix && (
            <>
              <CopyBlock
                label="Regression test entry"
                value={regressionSnippet({
                  name: review.name,
                  pair: review.expected_pair,
                  actualResult: review.actual_result,
                  suspectedStage: diag.suspectedStage,
                })}
              />
              <div className="mt-3 rounded border border-dashed border-hairline bg-paper-shadow/20 p-2">
                <div className="font-sans text-[11px] uppercase tracking-wider text-muted">
                  Diagnostic context
                </div>
                <p className="mt-1 font-sans text-[12px] leading-relaxed text-ink">
                  Likely root cause: {diag.hint}
                </p>
                <p className="mt-1 font-sans text-[12px] text-muted">
                  Suggested next step: edit src/services/wikiValidationService.ts and re-run the
                  regression set.
                </p>
              </div>
            </>
          )}
          {isApprovedData && (
            <CopyBlock
              label="FAMOUS_PEOPLE entry"
              value={famousPeopleSnippet({ name: review.name, pair: review.expected_pair })}
            />
          )}
          {isApprovedRemove && (
            <CopyBlock
              label="FAMOUS_PEOPLE entry to remove"
              value={removeFromDatasetSnippet({
                name: review.name,
                pair: review.expected_pair,
                trace: review.trace ?? [],
              })}
            />
          )}
          {(isRejected || isDuplicate) && !review.resolution_note && (
            <p className="font-sans text-xs text-muted">No note provided.</p>
          )}
        </div>
      )}
    </li>
  );
}

function StatusTag({
  status,
  resolutionType,
}: {
  status: ValidationReviewRow['status'];
  resolutionType: ValidationReviewRow['resolution_type'];
}) {
  const label =
    status === 'approved'
      ? resolutionType === 'fix_validator'
        ? 'approved · fix'
        : resolutionType === 'remove_from_dataset'
          ? 'approved · remove'
          : 'approved · data'
      : status;
  const cls =
    status === 'pending'
      ? 'bg-paper-shadow/60 text-muted'
      : status === 'approved'
        ? 'bg-success/10 text-success'
        : status === 'rejected'
          ? 'bg-error/10 text-error'
          : 'bg-paper-shadow/60 text-muted';
  return (
    <span className={`rounded-full px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
