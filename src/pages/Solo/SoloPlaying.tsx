import type { Round } from '@/services/phraseService';
import { InitialsGrid, type GridRow } from '@/components/InitialsGrid';
import { TimerBar } from '@/components/TimerBar';
import { PhraseHeader } from '@/components/PhraseHeader';
import { EndRoundButton } from '@/components/EndRoundButton';

interface SoloPlayingProps {
  round: Round;
  remaining: number;
  totalSeconds: number;
  rows: GridRow[];
  onChange: (i: number, value: string) => void;
  onEnd: () => void;
}

export function SoloPlaying({
  round,
  remaining,
  totalSeconds,
  rows,
  onChange,
  onEnd,
}: SoloPlayingProps) {
  return (
    <div className="frame">
      {/* PhraseHeader stays fully visible for the whole round. The
          auto-collapse mode used to hide it after 3 s or on the first
          keystroke — players preferred it always visible. */}
      <PhraseHeader phrase={round.phrase} mode="static" className="mb-4" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <TimerBar remaining={remaining} total={totalSeconds} />
        </div>
        <EndRoundButton onConfirm={onEnd} />
      </div>
      <div className="mt-6">
        <InitialsGrid letters={round.letters} rows={rows} onChange={onChange} />
      </div>
    </div>
  );
}
