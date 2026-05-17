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
  interactionKey: number;
  onChange: (i: number, value: string) => void;
  onEnd: () => void;
}

export function SoloPlaying({
  round,
  remaining,
  totalSeconds,
  rows,
  interactionKey,
  onChange,
  onEnd,
}: SoloPlayingProps) {
  return (
    <div className="frame">
      <PhraseHeader
        phrase={round.phrase}
        mode="auto"
        interactionKey={interactionKey}
        className="mb-4"
      />
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
