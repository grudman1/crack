/**
 * /debug — internal tool for inspecting the validation chain.
 *
 * Three sections:
 *   1) Ad-hoc validator (single name + pair → full trace).
 *   2) Regression set runner.
 *   3) Copy report as Markdown.
 *
 * Hidden — not linked from anywhere. <meta name="robots" content="noindex">
 * is set in a useEffect so the page isn't indexed even if someone discovers
 * the URL.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import {
  validateName,
  clearValidationCache,
  type TraceRecord,
  type ValidationResult,
} from '@/services/wikiValidationService';
import { ACCEPT_CASES, REJECT_CASES, type RegressionCase } from '@/data/regressionSet';
import { toast } from '@/components/ui/toast';
import { pairToDot, renderTrace } from '@/lib/traceFormat';

interface AdhocRun {
  name: string;
  pair: string;
  trace: TraceRecord[];
  result: ValidationResult | null;
}

interface RegressionRow extends RegressionCase {
  status: 'idle' | 'running' | 'pass' | 'fail';
  result?: ValidationResult;
  trace?: TraceRecord[];
  expanded?: boolean;
}

export default function Debug() {
  // Block search-engine indexing — debug surface, never meant to be public.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Crack — debug';
    return () => {
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);

  const [params] = useSearchParams();
  const [name, setName] = useState(params.get('name') ?? '');
  const [pair, setPair] = useState((params.get('pair') ?? '').toUpperCase());
  const [adhoc, setAdhoc] = useState<AdhocRun | null>(null);
  const [adhocBusy, setAdhocBusy] = useState(false);
  const [rows, setRows] = useState<RegressionRow[]>(() =>
    [...ACCEPT_CASES, ...REJECT_CASES].map((c) => ({ ...c, status: 'idle' })),
  );
  const [batchBusy, setBatchBusy] = useState(false);
  const autoFiredRef = useRef(false);

  const runAdhoc = async () => {
    if (!name || pair.length !== 2) {
      toast.error('Enter a name and a 2-character pair.');
      return;
    }
    setAdhocBusy(true);
    const trace: TraceRecord[] = [];
    try {
      clearValidationCache(); // ensure fresh API calls
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
        result: { status: 'invalid', reason: `error: ${(err as Error).message}` },
      });
    } finally {
      setAdhocBusy(false);
    }
  };

  // Auto-fire when URL params arrive (used by the "?" link from results).
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (params.get('name') && params.get('pair')) {
      autoFiredRef.current = true;
      void runAdhoc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setBatchBusy(false);
  };

  const passCount = rows.filter((r) => r.status === 'pass').length;
  const failCount = rows.filter((r) => r.status === 'fail').length;
  const totalRun = passCount + failCount;

  const copyReport = async () => {
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
    } else {
      lines.push('## Failures', '', '_None._', '');
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

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Report copied to clipboard.');
    } catch {
      toast.error("Couldn't copy. Try selecting + copying the textarea below.");
    }
  };

  const toggleExpand = (i: number) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, expanded: !r.expanded } : r)));

  const markdown = useMemo(() => {
    if (!totalRun) return '';
    const lines: string[] = [];
    lines.push('# Validation regression report', '');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Result: ${passCount}/${rows.length} passed`, '');
    return lines.join('\n');
  }, [totalRun, passCount, rows.length]);

  return (
    <div className="mx-auto w-full max-w-[56rem] px-4 py-8">
      <h1 className="font-serif text-[28px] font-bold text-ink lg:text-[36px]">/debug</h1>
      <p className="mt-1 font-serif italic text-muted">
        Validation chain inspector. Internal tooling — not linked from the app.
      </p>

      {/* SECTION 1 — Ad-hoc validator */}
      <section className="mt-10">
        <h2 className="font-serif text-lg font-bold text-ink">1. Ad-hoc validator</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-muted">Name</span>
            <input
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
          <button type="button" className="btn-primary !min-h-[3rem] !px-6 !text-base" onClick={runAdhoc} disabled={adhocBusy}>
            {adhocBusy ? 'Running…' : 'Run'}
          </button>
        </div>

        {adhoc && (
          <div className="mt-4 border border-hairline rounded p-4">
            <div className="flex items-center gap-3">
              {adhoc.result?.status === 'valid' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 font-sans text-xs font-semibold text-success">
                  <Check className="h-3 w-3" strokeWidth={2.5} /> ACCEPT
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-3 py-1 font-sans text-xs font-semibold text-error">
                  <X className="h-3 w-3" strokeWidth={2.5} /> REJECT
                </span>
              )}
              <span className="font-sans text-sm text-muted">
                {adhoc.result?.canonicalName ? (
                  <>
                    canonical: <span className="text-ink">{adhoc.result.canonicalName}</span>
                  </>
                ) : (
                  <>reason: {adhoc.result?.reason ?? '—'}</>
                )}
              </span>
            </div>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded bg-paper-shadow/40 p-3 font-mono text-[12px] leading-relaxed text-ink">
              {renderTrace(adhoc.trace)}
            </pre>
          </div>
        )}
      </section>

      {/* SECTION 2 — Regression set */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-ink">2. Regression set</h2>
          <div className="flex items-center gap-3">
            {totalRun > 0 && (
              <span
                className={`rounded-full px-3 py-1 font-sans text-xs font-semibold ${
                  failCount === 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                }`}
              >
                {passCount}/{rows.length} passed
              </span>
            )}
            <button
              type="button"
              className="btn-pill-sm"
              onClick={runRegression}
              disabled={batchBusy}
            >
              {batchBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {batchBusy ? 'Running…' : 'Run regression set'}
            </button>
            <button
              type="button"
              className="btn-pill-sm"
              onClick={copyReport}
              disabled={totalRun === 0}
            >
              Copy report as Markdown
            </button>
          </div>
        </div>

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
                <span className="font-sans text-sm text-ink truncate">{r.name || <em className="text-muted">(empty)</em>}</span>
                <span className="font-serif text-sm font-bold tabular-nums text-muted">{pairToDot(r.pair)}</span>
                <span className="font-sans text-xs text-muted truncate">
                  {r.result?.status === 'valid'
                    ? `→ ${r.result.canonicalName ?? ''}`
                    : r.result?.reason ?? r.note ?? ''}
                </span>
                <span className="text-muted">
                  {r.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>
              </button>
              {r.expanded && r.trace && (
                <pre className="ml-6 mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-paper-shadow/40 p-3 font-mono text-[12px] leading-relaxed text-ink">
                  {renderTrace(r.trace)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* SECTION 3 — Hidden markdown source so user can manually grab it if clipboard fails */}
      {markdown && (
        <details className="mt-12">
          <summary className="cursor-pointer font-sans text-sm text-muted">Show raw markdown report</summary>
          <textarea
            readOnly
            className="mt-2 h-48 w-full rounded border border-hairline p-2 font-mono text-xs"
            value={buildFullReport(rows)}
          />
        </details>
      )}
    </div>
  );
}

function StatusGlyph({ status }: { status: RegressionRow['status'] }) {
  if (status === 'pass') return <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />;
  if (status === 'fail') return <X className="h-3.5 w-3.5 text-error" strokeWidth={2.5} />;
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />;
  return <span className="font-mono text-xs text-muted">—</span>;
}

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
