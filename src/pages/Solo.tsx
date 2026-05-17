import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ALPHABET } from '@/services/sentenceService';
import { generateRound, type Round } from '@/services/phraseService';
import { validateName, computeNameInitials } from '@/services/wikiValidationService';
import { playBeep, playChime, resumeAudio } from '@/services/audioService';
import { formatToday, getRoundNumber, incrementRoundNumber } from '@/services/roundCounter';
import { InitialsGrid, type GridRow, type RowStatus } from '@/components/InitialsGrid';
import { TimerBar } from '@/components/TimerBar';
import { PhraseHeader } from '@/components/PhraseHeader';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { ShareButton } from '@/components/ShareButton';
import { EndRoundButton } from '@/components/EndRoundButton';
import { Progress } from '@/components/ui/progress';
import { sanitizeError } from '@/lib/sanitizeError';
import { toast } from '@/components/ui/toast';

type SoloPhase = 'setup' | 'playing' | 'validating' | 'results';

const TIMER_OPTIONS = [
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '7 min', value: 420 },
];

interface AnswerRow {
  name: string;
  status?: RowStatus;
  reason?: string;
  canonicalName?: string;
  points?: number;
}

function emptyRows(): AnswerRow[] {
  return Array.from({ length: 26 }, () => ({ name: '' }));
}

export default function Solo() {
  const [phase, setPhase] = useState<SoloPhase>('setup');
  const [totalSeconds, setTotalSeconds] = useState(180);
  const [remaining, setRemaining] = useState(180);
  const [round, setRound] = useState<Round | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(() => getRoundNumber());
  const [rows, setRows] = useState<AnswerRow[]>(emptyRows);
  const [validationProgress, setValidationProgress] = useState(0);
  const [interactionKey, setInteractionKey] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'playing') return;
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          tickRef.current = null;
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase]);

  const runValidation = useCallback(async () => {
    if (!round) return;
    setPhase('validating');
    setValidationProgress(0);
    const next = rows.slice();
    for (let i = 0; i < 26; i++) {
      const name = next[i]?.name.trim() ?? '';
      const expected = `${ALPHABET[i]}${round.letters[i] ?? ''}`;
      if (!name) {
        next[i] = { ...next[i]!, status: 'unanswered', points: 0 };
      } else {
        const localInitials = computeNameInitials(name);
        if (localInitials && localInitials !== expected) {
          next[i] = {
            ...next[i]!,
            status: 'invalid',
            reason: `expected ${expected}, got ${localInitials}`,
            points: 0,
          };
        } else {
          try {
            const result = await validateName(name, { expectedInitials: expected });
            if (result.status === 'valid') {
              next[i] = {
                ...next[i]!,
                status: 'valid',
                canonicalName: result.canonicalName,
                points: 10,
              };
            } else {
              next[i] = { ...next[i]!, status: 'invalid', reason: result.reason, points: 0 };
            }
          } catch (err) {
            next[i] = { ...next[i]!, status: 'invalid', reason: sanitizeError(err), points: 0 };
            toast.error(sanitizeError(err));
          }
        }
      }
      setRows([...next]);
      setValidationProgress(((i + 1) / 26) * 100);
    }
    setPhase('results');
  }, [round, rows]);

  useEffect(() => {
    if (phase === 'playing' && remaining === 0) {
      playChime();
      void runValidation();
    }
  }, [phase, remaining, runValidation]);

  const start = () => {
    resumeAudio();
    const r = generateRound();
    setRound(r);
    setRows(emptyRows());
    setRemaining(totalSeconds);
    setInteractionKey(0);
    setRoundNumber(incrementRoundNumber());
    setPhase('playing');
  };

  const handleChange = (i: number, value: string) => {
    const prev = rows[i]?.name ?? '';
    if (value.length > prev.length) {
      playBeep(800 - i * 6);
      setInteractionKey((k) => k + 1);
    }
    setRows((curr) => {
      const next = curr.slice();
      next[i] = { ...next[i], name: value };
      return next;
    });
  };

  const gridRows: GridRow[] = useMemo(
    () => rows.map((r) => ({ name: r.name, status: r.status, reason: r.reason, canonicalName: r.canonicalName, points: r.points })),
    [rows],
  );

  const totalScore = useMemo(() => rows.reduce((acc, r) => acc + (r.points ?? 0), 0), [rows]);
  const correctCount = useMemo(() => rows.filter((r) => r.status === 'valid').length, [rows]);
  const missedIndexes = useMemo(
    () => rows.map((r, i) => (r.status === 'invalid' || r.status === 'unanswered' ? i : -1)).filter((i) => i >= 0),
    [rows],
  );

  // ---- Setup ----
  if (phase === 'setup') {
    return (
      <motion.div
        className="frame"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <h1 className="text-center font-serif text-[28px] font-bold leading-tight text-ink lg:text-[48px]">Solo</h1>
        <p className="mt-1 text-center font-serif italic text-muted lg:mt-3 lg:text-[20px]">Choose a round length</p>

        <div className="mt-8 flex justify-center gap-2 lg:mt-10 lg:gap-3">
          {TIMER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`btn-pill-sm !min-h-[2.5rem] !px-4 !text-[14px] ${
                totalSeconds === opt.value ? 'btn-ghost--selected' : ''
              }`}
              onClick={() => setTotalSeconds(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 font-sans text-sm text-muted">
          <label htmlFor="custom-seconds" className="text-ink">
            Custom
          </label>
          <input
            id="custom-seconds"
            type="number"
            min={30}
            max={1800}
            value={totalSeconds}
            onChange={(e) =>
              setTotalSeconds(Math.max(30, Math.min(1800, Number(e.target.value) || 30)))
            }
            className="input-box w-20 text-center text-ink"
          />
          <span>sec</span>
        </div>

        <div className="mt-10 flex justify-center lg:mt-14">
          <button type="button" className="btn-primary w-full max-w-[20rem]" onClick={start}>
            Start round <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </motion.div>
    );
  }

  // ---- Validating ----
  if (phase === 'validating') {
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
          <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} readOnly />
        </div>
        <Progress value={validationProgress} className="hidden" />
      </div>
    );
  }

  // ---- Results ----
  if (phase === 'results') {
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
            {totalScore} pts · {Math.floor(totalSeconds / 60)}:{(totalSeconds % 60).toString().padStart(2, '0')} round
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button type="button" className="btn-primary w-full max-w-[20rem]" onClick={() => setPhase('setup')}>
            Play again
          </button>
        </div>

        <div className="mt-3 flex justify-center">
          <ShareButton
            result={{
              roundNumber,
              correctCount,
              totalCount: 26,
              rowResults: rows.map((r) => r.status === 'valid'),
              shareUrl: 'crack-black.vercel.app',
            }}
          />
        </div>

        <div className="mt-6 font-sans text-[13px] leading-relaxed text-center">
          <div className="text-ink">{formatToday()}</div>
          <div className="text-muted">Round No. {roundNumber}</div>
        </div>

        <div className="mt-8">
          <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} readOnly showResults />
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

  // ---- Playing ----
  return (
    <div className="frame">
      {round && <PhraseHeader phrase={round.phrase} mode="auto" interactionKey={interactionKey} className="mb-4" />}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <TimerBar remaining={remaining} total={totalSeconds} />
        </div>
        <EndRoundButton onConfirm={() => setRemaining(0)} />
      </div>
      <div className="mt-6">
        <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} onChange={handleChange} />
      </div>
    </div>
  );
}
