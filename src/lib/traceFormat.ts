// Pure formatters for validator traces. Kept separate from
// TraceViewer.tsx so react-refresh stays happy (component files should
// export components only).

import type { TraceRecord } from '@/services/wikiValidationService';

/** Format a 2-char pair like "PH" as "P · H" for display. */
export function pairToDot(pair: string): string {
  const u = (pair ?? '').toUpperCase();
  if (u.length !== 2) return u;
  return `${u[0]} · ${u[1]}`;
}

/** Build the monospace tree representation of a trace. */
export function renderTrace(trace: TraceRecord[]): string {
  if (trace.length === 0) return '(no trace)';
  const lines: string[] = [];
  for (let i = 0; i < trace.length; i++) {
    const r = trace[i]!;
    const last = i === trace.length - 1;
    const branch = last ? '└─' : '├─';
    const icon =
      r.outcome === 'hit'
        ? '✓'
        : r.outcome === 'miss'
          ? '✗'
          : r.outcome === 'skip'
            ? '·'
            : ' ';
    lines.push(`${branch} ${icon} [${r.stage}] ${r.label} — ${r.note}`);
  }
  return lines.join('\n');
}
