// /admin — unified validator workspace.
//
// Three vertically stacked sections:
//   1. Test a name (workbench)         — ad-hoc validator + resolve-as-queue-entry
//   2. Queue (inbox)                   — player + workbench-submitted reviews
//   3. Regression set (gate)           — collapsed by default; on-demand
//
// /debug used to be a separate page; it now redirects here (see
// DebugRedirect in App.tsx) so old bookmarks and any ?name=…&pair=…
// query strings still work — Section 1 auto-fires on those.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { useReviews } from '@/hooks/useReviews';
import { ReviewQueueItem } from '@/components/ReviewQueueItem';
import { CopyBlock } from '@/components/CopyBlock';
import { TraceViewer } from '@/components/TraceViewer';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import { pairToDot } from '@/lib/traceFormat';
import { diagnoseTrace } from '@/lib/diagnoseTrace';
import {
  regressionSnippet,
  famousPeopleSnippet,
  removeFromDatasetSnippet,
} from '@/lib/reviewSnippets';
import { submitAndResolveReview } from '@/services/reviewService';
import {
  validateName,
  clearValidationCache,
  type TraceRecord,
  type ValidationResult,
} from '@/services/wikiValidationService';
import { ACCEPT_CASES, REJECT_CASES, type RegressionCase } from '@/data/regressionSet';
import type { ReviewStatus } from '@/types/database';

// ============================================================================
// types
// ============================================================================

interface AdhocRun {
  name: string;
  pair: string;
  trace: TraceRecord[];
  result: ValidationResult;
}

type AdhocResolved =
  | { kind: 'fix_validator' }
  | { kind: 'add_to_dataset' }
  | { kind: 'remove_from_dataset' }
  | { kind: 'rejected' }
  | { kind: 'duplicate' };

interface RegressionRow extends RegressionCase {
  status: 'idle' | 'running' | 'pass' | 'fail';
  result?: ValidationResult;
  trace?: TraceRecord[];
  expanded?: boolean;
}

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'duplicate', label: 'Duplicate' },
];

// ============================================================================
// page
// ============================================================================

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // The merged page replaces /debug, so block search-engine indexing
  // for it (the queue + workbench are internal).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Crack — admin';
    return () => {
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate('/', { replace: true });
  }, [adminLoading, isAdmin, navigate]);

  // ---- Section 1: workbench state ----
  const [name, setName] = useState(params.get('name') ?? '');
  const [pair, setPair] = useState((params.get('pair') ?? '').toUpperCase());
  const [adhocBusy, setAdhocBusy] = useState(false);
  const [adhoc, setAdhoc] = useState<AdhocRun | null>(null);
  const [adhocResolved, setAdhocResolved] = useState<AdhocResolved | null>(null);
  const [adhocActionBusy, setAdhocActionBusy] = useState(false);
  const autoFiredRef = useRef(false);
  const workbenchRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // ---- Section 2: queue state ----
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const { reviews: allReviews, loading: reviewsLoading } = useReviews();

  // ---- Section 3: regression state ----
  const [rows, setRows] = useState<RegressionRow[]>(() =>
    [...ACCEPT_CASES, ...REJECT_CASES].map((c) => ({ ...c, status: 'idle' })),
  );
  const [batchBusy, setBatchBusy] = useState(false);
  const [regressionOpen, setRegressionOpen] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  // --------------------------------------------------------------------------
  // Section 1: workbench
  // --------------------------------------------------------------------------

  const runAdhoc = useCallback(async () => {
    if (!name || pair.length !== 2) {
      toast.error('Enter a name and a 2-character pair.');
      return;
    }
    setAdhocBusy(true);
    setAdhocResolved(null);
    const trace: TraceRecord[] = [];
    try {
      clearValidationCache();
      const result = await validateName(name, {
        expectedInitials: pair.toUpperCase(),
        trace: (r) => trace.push(r),
        bypassCache: true,
      });
      setAdhoc({ name, pair: pair.toUpperCase(), trace, result });
    } catch (err) {
      setAdhoc({
        name,
        pair: pair.toUpperCase(),
        trace,
        result: { status: 'invalid', reason: sanitizeError(err) },
      });
    } finally {
      setAdhocBusy(false);
    }
  }, [name, pair]);

  // Auto-fire on URL params (also covers the /debug?name=…&pair=… redirect).
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (params.get('name') && params.get('pair')) {
      autoFiredRef.current = true;
      void runAdhoc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adhocDiag = useMemo(() => {
    if (!adhoc) return null;
    return diagnoseTrace(adhoc.trace, adhoc.pair);
  }, [adhoc]);

  const resolveAdhoc = async (
    kind: 'fix_validator' | 'add_to_dataset' | 'remove_from_dataset' | 'rejected' | 'duplicate',
  ) => {
    if (!adhoc) return;
    setAdhocActionBusy(true);
    try {
      const resolution =
        kind === 'rejected' || kind === 'duplicate'
          ? { status: kind }
          : { status: 'approved' as const, resolutionType: kind };
      await submitAndResolveReview({
        name: adhoc.name,
        expectedPair: adhoc.pair,
        actualResult: adhoc.result.status,
        reason: adhoc.result.reason ?? null,
        trace: adhoc.trace,
        resolution,
      });
      setAdhocResolved({ kind });
      toast.success(`Saved to queue as ${kind === 'rejected' ? 'rejected' : kind === 'duplicate' ? 'duplicate' : 'approved'}.`);
    } catch (err) {
      toast.error(sanitizeError(err));
    } finally {
      setAdhocActionBusy(false);
    }
  };

  // Triggered by ReviewQueueItem's "Test this" callback. Populates
  // the workbench inputs, scrolls to the section, and focuses the
  // name field. Does NOT auto-run — admin may want to edit first.
  const handleTestThis = useCallback((testName: string, testPair: string) => {
    setName(testName);
    setPair(testPair.toUpperCase());
    setAdhoc(null);
    setAdhocResolved(null);
    // Defer the scroll until React has committed the state change so
    // the input value is in the DOM by the time we focus it.
    requestAnimationFrame(() => {
      workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nameInputRef.current?.focus();
    });
  }, []);

  // --------------------------------------------------------------------------
  // Section 2: queue
  // --------------------------------------------------------------------------

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

  const visibleReviews = useMemo(
    () => allReviews.filter((r) => r.status === tab),
    [allReviews, tab],
  );

  // --------------------------------------------------------------------------
  // Section 3: regression set
  // --------------------------------------------------------------------------

  const runRegression = async () => {
    setBatchBusy(true);
    setRows((rs) => rs.map((r) => ({ ...r, status: 'idle', result: undefined, trace: undefined, expanded: false })));
    for (let i = 0; i < rows.length; i++) {
      setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, status: 'running' } : r)));
      const row = rows[i]!;
      const trace: TraceRecord[] = [];
      let result: ValidationResult;
      try {
        clearValidationCache();
        result = await validateName(row.name, {
          expectedInitials: row.pair.toUpperCase(),
          trace: (r) => trace.push(r),
          bypassCache: true,
        });
      } catch (err) {
        result = { status: 'invalid', reason: `error: ${(err as Error).message}` };
      }
      const want = row.expect === 'accept' ? 'valid' : 'invalid';
      const pass = result.status === want;
      setRows((rs) =>
        rs.map((r, idx) => (idx === i ? { ...r, status: pass ? 'pass' : 'fail', result, trace } : r)),
      );
    }
    setLastRunAt(Date.now());
    setBatchBusy(false);
  };

  const passCount = rows.filter((r) => r.status === 'pass').length;
  const failCount = rows.filter((r) => r.status === 'fail').length;
  const totalRun = passCount + failCount;

  const copyReport = async () => {
    const text = buildFullReport(rows);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Report copied to clipboard.');
    } catch {
      toast.error("Couldn't copy. Try selecting + copying the textarea below.");
    }
  };

  const toggleExpand = (i: number) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, expanded: !r.expanded } : r)));

  // --------------------------------------------------------------------------
  // render
  // --------------------------------------------------------------------------

  if (adminLoading) {
    return (
      <div className="mx-auto w-full max-w-[56rem] px-4 py-10">
        <p className="font-sans text-sm text-muted">Loading…</p>
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="mx-auto w-full max-w-[56rem] px-4 py-8">
      <h1 className="font-serif text-[28px] font-bold text-ink lg:text-[36px]">/admin</h1>
      <p className="mt-1 font-serif italic text-muted">
        Validator workspace — test, triage, and regress.
      </p>

      {/* ====== Section 1: Test a name ====== */}
      <section ref={workbenchRef} className="mt-10">
        <h2 className="font-serif text-[22px] font-bold text-ink">1. Test a name</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-muted">Name</span>
            <input
              ref={nameInputRef}
              className="input-box mt-1 w-64"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prince Harry"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-muted">Pair</span>
            <input
              className="input-box mt-1 w-20 text-center font-serif text-lg font-bold tracking-widest"
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
              maxLength={2}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="btn-primary !min-h-[3rem] !px-6 !text-base"
            onClick={() => void runAdhoc()}
            disabled={adhocBusy}
          >
            {adhocBusy ? 'Running…' : 'Run'}
          </button>
        </div>

        {adhoc && (
          <div className="mt-4 border border-hairline rounded p-4">
            <div className="flex items-center gap-3 flex-wrap">
              {adhoc.result.status === 'valid' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 font-sans text-xs font-semibold text-success">
                  <Check className="h-3 w-3" strokeWidth={2.5} /> ACCEPT
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-3 py-1 font-sans text-xs font-semibold text-error">
                  <X className="h-3 w-3" strokeWidth={2.5} /> REJECT
                </span>
              )}
              <span className="font-sans text-sm text-muted">
                {adhoc.result.canonicalName ? (
                  <>
                    canonical: <span className="text-ink">{adhoc.result.canonicalName}</span>
                  </>
                ) : (
                  <>reason: {adhoc.result.reason ?? '—'}</>
                )}
              </span>
            </div>
            <TraceViewer trace={adhoc.trace} className="mt-4" />

            {/* Resolution buttons + post-resolve snippets */}
            {adhocResolved === null ? (
              <AdhocActions
                actualResult={adhoc.result.status}
                busy={adhocActionBusy}
                onResolve={(kind) => void resolveAdhoc(kind)}
              />
            ) : (
              <AdhocResolvedSnippet adhoc={adhoc} resolved={adhocResolved} diag={adhocDiag} />
            )}
          </div>
        )}
      </section>

      {/* ====== Section 2: Queue ====== */}
      <section className="mt-12">
        <h2 className="font-serif text-[22px] font-bold text-ink">2. Queue</h2>
        <div className="mt-3 flex flex-wrap gap-2 border-b border-hairline pb-3">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`btn-pill-sm ${tab === key ? 'btn-ghost--selected' : ''}`}
            >
              {label} <span className="ml-1 font-mono text-[11px] text-muted">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="mt-6">
          {reviewsLoading && visibleReviews.length === 0 ? (
            <p className="font-sans text-sm text-muted">Loading reviews…</p>
          ) : visibleReviews.length === 0 ? (
            <p className="font-sans text-sm text-muted">Nothing here yet.</p>
          ) : (
            <ul className="space-y-4">
              {visibleReviews.map((r) => (
                <ReviewQueueItem key={r.id} review={r} onTestThis={handleTestThis} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ====== Section 3: Regression set ====== */}
      <section className="mt-12">
        <h2 className="font-serif text-[22px] font-bold text-ink">3. Regression set</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="font-sans text-sm text-muted">
            {totalRun === 0 ? (
              <>Not run yet.</>
            ) : (
              <>
                <span className={failCount === 0 ? 'text-success' : 'text-error'}>
                  {passCount}/{rows.length} passed
                </span>
                {lastRunAt && <> · {relativeTime(lastRunAt)}</>}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-pill-sm" onClick={() => void runRegression()} disabled={batchBusy}>
              {batchBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {batchBusy ? 'Running…' : 'Run regression set'}
            </button>
            <button type="button" className="btn-pill-sm" onClick={() => void copyReport()} disabled={totalRun === 0}>
              Copy report as Markdown
            </button>
            <button
              type="button"
              className="btn-pill-sm"
              onClick={() => setRegressionOpen((v) => !v)}
            >
              {regressionOpen ? 'Hide details' : 'Show details'}
            </button>
          </div>
        </div>

        {regressionOpen && (
          <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
            {rows.map((r, i) => (
              <li key={`${r.name}|${r.pair}`} className="py-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(i)}
                  className="grid w-full grid-cols-[1.25rem_1.25rem_minmax(0,1fr)_3rem_minmax(0,1fr)_1rem] items-center gap-2 text-left hover:bg-hairline/30 px-1"
                  aria-label="Toggle trace"
                >
                  <StatusGlyph status={r.status} />
                  <span className="text-[10px] uppercase tracking-wider text-muted">{r.expect[0]}</span>
                  <span className="font-sans text-sm text-ink truncate">
                    {r.name || <em className="text-muted">(empty)</em>}
                  </span>
                  <span className="font-serif text-sm font-bold tabular-nums text-muted">
                    {pairToDot(r.pair)}
                  </span>
                  <span className="font-sans text-xs text-muted truncate">
                    {r.result?.status === 'valid'
                      ? `→ ${r.result.canonicalName ?? ''}`
                      : r.result?.reason ?? r.note ?? ''}
                  </span>
                  <span className="text-muted">
                    {r.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </span>
                </button>
                {r.expanded && r.trace && <TraceViewer trace={r.trace} className="ml-6 mt-2" />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// helpers / sub-components
// ============================================================================

function relativeTime(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function StatusGlyph({ status }: { status: RegressionRow['status'] }) {
  if (status === 'pass') return <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />;
  if (status === 'fail') return <X className="h-3.5 w-3.5 text-error" strokeWidth={2.5} />;
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />;
  return <span className="font-mono text-xs text-muted">—</span>;
}

interface AdhocActionsProps {
  actualResult: 'valid' | 'invalid';
  busy: boolean;
  onResolve: (kind: 'fix_validator' | 'add_to_dataset' | 'remove_from_dataset' | 'rejected' | 'duplicate') => void;
}

function AdhocActions({ actualResult, busy, onResolve }: AdhocActionsProps) {
  // Contextual second-approve slot: invalid → add_to_dataset (false
  // negative), valid → remove_from_dataset (false positive). Mirrors
  // ReviewQueueItem.
  const secondaryKey: 'add_to_dataset' | 'remove_from_dataset' =
    actualResult === 'valid' ? 'remove_from_dataset' : 'add_to_dataset';
  const secondaryLabel =
    secondaryKey === 'add_to_dataset' ? 'Approve — add to dataset' : 'Approve — remove from dataset';
  return (
    <div className="mt-4 border-t border-hairline pt-3 flex flex-wrap gap-2">
      <button type="button" className="btn-pill-sm" onClick={() => onResolve('fix_validator')} disabled={busy}>
        Approve — fix validator
      </button>
      <button type="button" className="btn-pill-sm" onClick={() => onResolve(secondaryKey)} disabled={busy}>
        {secondaryLabel}
      </button>
      <button type="button" className="btn-pill-sm" onClick={() => onResolve('rejected')} disabled={busy}>
        Reject
      </button>
      <button type="button" className="btn-pill-sm" onClick={() => onResolve('duplicate')} disabled={busy}>
        Save as duplicate
      </button>
    </div>
  );
}

interface AdhocResolvedSnippetProps {
  adhoc: AdhocRun;
  resolved: AdhocResolved;
  diag: ReturnType<typeof diagnoseTrace> | null;
}

function AdhocResolvedSnippet({ adhoc, resolved, diag }: AdhocResolvedSnippetProps) {
  const kind = resolved.kind;
  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <p className="font-sans text-sm text-ink">
        <span className="text-muted">Saved as:</span>{' '}
        <span className="font-semibold">
          {kind === 'fix_validator'
            ? 'approved · fix validator'
            : kind === 'add_to_dataset'
              ? 'approved · add to dataset'
              : kind === 'remove_from_dataset'
                ? 'approved · remove from dataset'
                : kind}
        </span>
      </p>
      {kind === 'fix_validator' && (
        <CopyBlock
          label="Regression test entry"
          value={regressionSnippet({
            name: adhoc.name,
            pair: adhoc.pair,
            actualResult: adhoc.result.status,
            suspectedStage: diag?.suspectedStage,
          })}
        />
      )}
      {kind === 'add_to_dataset' && (
        <CopyBlock
          label="FAMOUS_PEOPLE entry"
          value={famousPeopleSnippet({ name: adhoc.name, pair: adhoc.pair })}
        />
      )}
      {kind === 'remove_from_dataset' && (
        <CopyBlock
          label="FAMOUS_PEOPLE entry to remove"
          value={removeFromDatasetSnippet({
            name: adhoc.name,
            pair: adhoc.pair,
            trace: adhoc.trace,
          })}
        />
      )}
    </div>
  );
}

// ----- Markdown report builder (used by Copy report as Markdown) ------------

function buildFullReport(rows: RegressionRow[]): string {
  const passCount = rows.filter((r) => r.status === 'pass').length;
  const lines: string[] = [];
  lines.push('# Validation regression report', '');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Result: ${passCount}/${rows.length} passed`, '');
  const failures = rows.filter((r) => r.status === 'fail');
  if (failures.length) {
    lines.push('## Failures', '');
    for (const r of failures) {
      const wantLabel = r.expect.toUpperCase();
      const gotLabel = r.result?.status === 'valid' ? 'ACCEPT' : 'REJECT';
      lines.push(`### ${r.name || '(empty)'} → ${pairToDot(r.pair)} (expected ${wantLabel}, got ${gotLabel})`);
      if (r.result?.reason) lines.push(`Final reason: ${r.result.reason}`);
      if (r.result?.canonicalName) lines.push(`Canonical: ${r.result.canonicalName}`);
      if (r.note) lines.push(`Note: ${r.note}`);
      lines.push('', 'Trace:');
      for (const t of r.trace ?? []) {
        lines.push(`- [${t.stage}/${t.outcome}] ${t.label}: ${t.note}`);
      }
      lines.push('');
    }
  }
  const passes = rows.filter((r) => r.status === 'pass');
  lines.push('## Passes', '');
  for (const r of passes) {
    const winningHit = (r.trace ?? []).find((t) => t.outcome === 'hit');
    const summary = r.result?.canonicalName
      ? `${winningHit?.label ?? 'unknown stage'} → "${r.result.canonicalName}"`
      : winningHit?.label ?? r.result?.reason ?? '—';
    lines.push(`- ${r.name || '(empty)'} → ${pairToDot(r.pair)} (${summary})`);
  }
  lines.push('');
  return lines.join('\n');
}
