// One row in the /admin queue. Owns its own resolution UX:
// open one of three confirmation rows inline, capture an optional note,
// call resolveReview() with the right shape. After resolution (or when
// viewing already-resolved rows) it renders copy-pasteable snippets for
// the regression set and FAMOUS_PEOPLE so the admin can paste them
// straight into source.

import { useMemo, useState } from 'react';
import { Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import { TraceViewer } from '@/components/TraceViewer';
import { pairToDot } from '@/lib/traceFormat';
import { diagnoseTrace, type TraceDiagnosis } from '@/lib/diagnoseTrace';
import { resolveReview, type Resolution } from '@/services/reviewService';
import { FAMOUS_PEOPLE } from '@/data/famousPeople';
import type { Suggestion } from '@/services/soloSuggestions';
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

function regressionSnippet(r: ValidationReviewRow, diag: TraceDiagnosis): string {
  // For invalid rows the player thinks the validator wrongly rejected,
  // so the regression assertion is "expect accept." For valid rows
  // (the symmetric false-positive case), the assertion is "expect
  // reject" so the case fails when the validator wrongly accepts again.
  const expect = r.actual_result === 'valid' ? 'reject' : 'accept';
  const noteParts: string[] = [];
  if (diag.suspectedStage) noteParts.push(`stage: ${diag.suspectedStage}`);
  noteParts.push('validator bug surfaced by player feedback');
  const note = noteParts.join(' — ');
  return `  { name: '${r.name.replace(/'/g, "\\'")}', pair: '${r.expected_pair.toUpperCase()}', expect: '${expect}', note: '${note.replace(/'/g, "\\'")}' },`;
}

function famousPeopleSnippet(r: ValidationReviewRow): string {
  const pair = r.expected_pair.toUpperCase();
  const safe = r.name.replace(/'/g, "\\'");
  return `// Add to FAMOUS_PEOPLE['${pair}']:\np('${safe}', 'TODO short description'),`;
}

function formatEntryAsCode(entry: Suggestion): string {
  const esc = (s: string) => s.replace(/'/g, "\\'");
  const slugFromName = entry.name.replace(/ /g, '_');
  const expectedUrl = `https://en.wikipedia.org/wiki/${slugFromName}`;
  const customSlug = entry.wikipediaUrl && entry.wikipediaUrl !== expectedUrl;
  const slug = customSlug
    ? (entry.wikipediaUrl as string).replace('https://en.wikipedia.org/wiki/', '')
    : null;
  if (slug) {
    return `p('${esc(entry.name)}', '${esc(entry.description ?? '')}', '${esc(slug)}'),`;
  }
  return `p('${esc(entry.name)}', '${esc(entry.description ?? '')}'),`;
}

function removeFromDatasetSnippet(r: ValidationReviewRow): string {
  const pair = r.expected_pair.toUpperCase();
  const bucket = FAMOUS_PEOPLE[pair] ?? [];
  // The local-hit trace stamps the exact entry name in detail.canonical,
  // which is the authoritative match. Fall back to the typed name when
  // the trace doesn't have it (e.g. valid row matched via a different
  // stage but reviewer wants the bucket inspected anyway).
  const localHit = r.trace?.find((t) => t.stage === 'local' && t.outcome === 'hit');
  const fromDetail = (localHit?.detail as Record<string, unknown> | undefined)?.['canonical'];
  const targetName =
    typeof fromDetail === 'string' && fromDetail.length > 0 ? fromDetail : r.name;
  const lc = (s: string) => s.toLowerCase();
  const needle = lc(targetName);
  const match =
    bucket.find((e) => lc(e.name) === needle) ??
    bucket.find((e) => lc(e.name).includes(needle)) ??
    bucket.find((e) => needle.includes(lc(e.name)));
  if (!match) {
    return [
      `// No FAMOUS_PEOPLE['${pair}'] entry found matching "${r.name}".`,
      '// The chain may have accepted this via the Wikipedia path instead —',
      '// re-check the trace and consider "Approve — fix validator" instead.',
    ].join('\n');
  }
  return [`// Remove this line from FAMOUS_PEOPLE['${pair}']:`, formatEntryAsCode(match)].join('\n');
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}.`);
    } catch {
      toast.error("Couldn't copy — select the snippet and ⌘C.");
    }
  };
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] uppercase tracking-wider text-muted">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 font-sans text-[11px] text-muted hover:text-ink"
        >
          <Copy className="h-3 w-3" strokeWidth={1.75} /> Copy
        </button>
      </div>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-paper-shadow/40 p-2 font-mono text-[12px] leading-relaxed text-ink">
        {value}
      </pre>
    </div>
  );
}

export function ReviewQueueItem({ review }: Props) {
  const [action, setAction] = useState<ActionKey>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  const diag = useMemo(
    () => diagnoseTrace(review.trace ?? [], review.expected_pair),
    [review.trace, review.expected_pair],
  );

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
  // The second "approve" button swaps based on the direction the player
  // flagged. Invalid → add_to_dataset (false negative, curate it in).
  // Valid → remove_from_dataset (false positive, the dataset is wrong).
  const secondaryApproveKey: 'add_to_dataset' | 'remove_from_dataset' =
    review.actual_result === 'valid' ? 'remove_from_dataset' : 'add_to_dataset';
  const secondaryApproveLabel =
    secondaryApproveKey === 'add_to_dataset'
      ? 'Approve — add to dataset'
      : 'Approve — remove from dataset';

  return (
    <li className="border border-hairline bg-paper p-4">
      {/* Header row */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-serif text-[18px] font-bold tabular-nums text-ink">
          {pairToDot(review.expected_pair)}
        </span>
        <span className="font-serif text-[18px] font-bold text-ink">{review.name || '(empty)'}</span>
        <StatusTag status={review.status} resolutionType={review.resolution_type} />
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

      {/* Diagnostic */}
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
            {diag.suggestedAction === 'fix_validator' ? 'Fix validator' : 'Add to dataset'}
          </div>
        </div>
      </div>

      {/* Trace */}
      <button
        type="button"
        onClick={() => setTraceOpen((v) => !v)}
        className="mt-3 flex items-center gap-1 font-sans text-xs text-muted hover:text-ink"
      >
        {traceOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        View trace ({review.trace?.length ?? 0} records)
      </button>
      {traceOpen && <TraceViewer trace={review.trace ?? []} className="mt-2" />}

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
              <CopyBlock label="Regression test entry" value={regressionSnippet(review, diag)} />
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
          {isApprovedData && <CopyBlock label="FAMOUS_PEOPLE entry" value={famousPeopleSnippet(review)} />}
          {isApprovedRemove && (
            <CopyBlock label="FAMOUS_PEOPLE entry to remove" value={removeFromDatasetSnippet(review)} />
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
