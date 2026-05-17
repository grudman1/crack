import type { Round } from '@/services/phraseService';
import { InitialsGrid, type GridRow } from '@/components/InitialsGrid';
import { PhraseHeader } from '@/components/PhraseHeader';
import { Progress } from '@/components/ui/progress';

interface SoloValidatingProps {
  round: Round | null;
  validationProgress: number;
  rows: GridRow[];
}

export function SoloValidating({ round, validationProgress, rows }: SoloValidatingProps) {
  const checked = Math.min(26, Math.round(validationProgress / (100 / 26)));
  return (
    <div className="frame">
      {round && <PhraseHeader phrase={round.phrase} mode="static" className="mb-6" />}
      <div className="flex items-baseline justify-between font-serif">
        <span className="text-lg font-bold tabular-nums">{checked} / 26</span>
        <span className="font-sans text-xs text-muted">Checking Wikipedia…</span>
      </div>
      <div className="mt-2 h-[3px] w-full bg-hairline">
        <div
          className="h-full bg-accent transition-[width] duration-200 ease-linear"
          style={{ width: `${validationProgress}%` }}
        />
      </div>
      <div className="mt-6">
        <InitialsGrid letters={round?.letters ?? ''} rows={rows} readOnly />
      </div>
      <Progress value={validationProgress} className="hidden" />
    </div>
  );
}
