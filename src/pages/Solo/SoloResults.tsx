import { motion } from 'framer-motion';
import type { Round } from '@/services/phraseService';
import { formatToday } from '@/services/roundCounter';
import { InitialsGrid, type GridRow } from '@/components/InitialsGrid';
import { PhraseHeader } from '@/components/PhraseHeader';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { ShareButton } from '@/components/ShareButton';
import { buildShareString } from '@/lib/share';

interface SoloResultsProps {
  round: Round | null;
  rows: GridRow[];
  roundNumber: number;
  totalSeconds: number;
  correctCount: number;
  totalScore: number;
  missedIndexes: number[];
  onPlayAgain: () => void;
  onSubmitForReview: (i: number) => void;
  submittedReviewKeys: Set<number>;
}

export function SoloResults({
  round,
  rows,
  roundNumber,
  totalSeconds,
  correctCount,
  totalScore,
  missedIndexes,
  onPlayAgain,
  onSubmitForReview,
  submittedReviewKeys,
}: SoloResultsProps) {
  const lowScore = correctCount <= 3;
  return (
    <motion.div
      className="frame"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {round && <PhraseHeader phrase={round.phrase} mode="static" className="mb-8" />}

      {/* Score block */}
      <div className="flex flex-col items-center text-center">
        <div className="font-serif text-[48px] font-bold leading-none tabular-nums text-ink lg:text-[56px]">
          {correctCount} / 26
        </div>
        <div className="mt-2 font-sans text-[13px] text-muted">
          {totalScore} pts ·{' '}
          {Math.floor(totalSeconds / 60)}:{(totalSeconds % 60).toString().padStart(2, '0')} round
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button type="button" className="btn-primary w-full max-w-[20rem]" onClick={onPlayAgain}>
          Play again
        </button>
      </div>

      <div className="mt-3 flex justify-center">
        <ShareButton
          title={`Crack #${roundNumber}`}
          text={buildShareString({
            roundNumber,
            correctCount,
            totalCount: 26,
            rowResults: rows.map((r) => r.status === 'valid'),
            shareUrl: 'crack-black.vercel.app',
          })}
        />
      </div>

      <div className="mt-6 font-sans text-[13px] leading-relaxed text-center">
        <div className="text-ink">{formatToday()}</div>
        <div className="text-muted">Round No. {roundNumber}</div>
      </div>

      <div className="mt-8">
        <InitialsGrid
          letters={round?.letters ?? ''}
          rows={rows}
          readOnly
          showResults
          onSubmitForReview={onSubmitForReview}
          submittedReviewIndexes={submittedReviewKeys}
        />
      </div>

      {lowScore && missedIndexes.length > 0 && (
        <p className="mt-6 text-center font-serif text-base italic text-muted lg:text-[17px]">
          Here&apos;s who you could&apos;ve named.
        </p>
      )}

      <SuggestionsPanel letters={round?.letters ?? ''} missedIndexes={missedIndexes} defaultOpen />
    </motion.div>
  );
}
