// Shared trace renderer used by /debug and the admin queue. Pure
// presentation — no fetching, no state.

import type { TraceRecord } from '@/services/wikiValidationService';
import { renderTrace } from '@/lib/traceFormat';

interface TraceViewerProps {
  trace: TraceRecord[];
  className?: string;
}

export function TraceViewer({ trace, className }: TraceViewerProps) {
  return (
    <pre
      className={[
        'overflow-x-auto whitespace-pre-wrap rounded bg-paper-shadow/40 p-3 font-mono text-[12px] leading-relaxed text-ink',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {renderTrace(trace)}
    </pre>
  );
}
