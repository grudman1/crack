import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ALPHABET } from '@/services/sentenceService';
import { generateRound, type Round } from '@/services/phraseService';
import { validateName, computeNameInitials } from '@/services/wikiValidationService';
import { playBeep, playChime, resumeAudio } from '@/services/audioService';
import { InitialsGrid, type GridRow, type RowStatus } from '@/components/InitialsGrid';
import { TimerBar } from '@/components/TimerBar';
import { PhaseBanner } from '@/components/PhaseBanner';
import { PhraseHeader } from '@/components/PhraseHeader';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { ExportButtons } from '@/components/ExportButtons';
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
  const [rows, setRows] = useState<AnswerRow[]>(emptyRows);
  const [validationProgress, setValidationProgress] = useState(0);
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
    setPhase('playing');
  };

  const handleChange = (i: number, value: string) => {
    const prev = rows[i]?.name ?? '';
    if (value.length > prev.length) playBeep(800 - i * 6);
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
        <p className="mt-1 text-center font-serif italic text-muted lg:mt-3 lg:text-[20px]">Choose a round length.</p>

        <div className="mt-8 flex justify-center gap-2 lg:mt-10 lg:gap-3">
          {TIMER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`btn-ghost w-20 lg:!w-24 lg:!py-2.5 lg:!text-base ${totalSeconds === opt.value ? 'btn-ghost--selected' : ''}`}
              onClick={() => setTotalSeconds(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-baseline justify-center gap-2 font-sans text-sm text-muted">
          <span>or custom</span>
          <input
            type="number"
            min={30}
            max={1800}
            value={totalSeconds}
            onChange={(e) => setTotalSeconds(Math.max(30, Math.min(1800, Number(e.target.value) || 30)))}
            className="input-line w-16 text-center text-ink"
          />
          <span>sec</span>
        </div>

        <div className="mt-10 flex justify-center lg:mt-14">
          <button
            type="button"
            className="btn-primary lg:!w-[20rem] lg:!justify-center lg:!px-8 lg:!py-4 lg:!text-[17px]"
            onClick={start}
          >
            Start round <ArrowRight className="ml-2 h-4 w-4 lg:h-5 lg:w-5" strokeWidth={2.25} />
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
        {round && <PhraseHeader phrase={round.phrase} className="mb-6" />}
        <PhaseBanner phase="Validating" />
        <div className="mt-2 flex items-baseline justify-between font-serif">
          <span className="text-lg font-bold tabular-nums">{checked} / 26</span>
          <span className="font-sans text-xs text-muted">Checking Wikipedia…</span>
        </div>
        <div className="mt-2 h-[3px] w-full bg-hairline">
          <div className="h-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${validationProgress}%` }} />
        </div>
        <div className="mt-6">
          <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} readOnly />
        </div>
      </div>
    );
  }

  // ---- Results ----
  if (phase === 'results') {
    return (
      <motion.div
        className="frame"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {round && <PhraseHeader phrase={round.phrase} className="mb-6" />}
        <div className="flex items-baseline justify-between">
          <div>
            <PhaseBanner phase="Results" />
            <div className="mt-1 flex items-baseline gap-3 font-serif">
              <span className="text-lg font-bold tabular-nums">{correctCount} / 26</span>
            </div>
          </div>
          <div className="font-serif text-lg font-bold text-ink tabular-nums">{totalScore} pts</div>
        </div>
        <div className="mt-2 h-[3px] w-full bg-hairline">
          <div className="h-full bg-accent" style={{ width: `${(correctCount / 26) * 100}%` }} />
        </div>

        <div className="mt-6">
          <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} readOnly showResults />
        </div>

        <SuggestionsPanel letters={round?.letters ?? ''} missedIndexes={missedIndexes} />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <ExportButtons
            payload={{
              title: `Crack Solo · ${new Date().toLocaleDateString()}`,
              sentence: round?.phrase.text ?? '',
              letters: round?.letters ?? '',
              totalScore,
              rows: rows.map((r, i) => ({
                rowIndex: i,
                initials: `${ALPHABET[i]}${round?.letters[i] ?? ''}`,
                name: r.name,
                status: r.status === 'pending' ? undefined : r.status,
                canonicalName: r.canonicalName,
                reason: r.reason,
                points: r.points,
              })),
            }}
          />
          <button type="button" className="btn-primary" onClick={() => setPhase('setup')}>
            New round
          </button>
        </div>
      </motion.div>
    );
  }

  // ---- Playing ----
  return (
    <div className="frame">
      {round && <PhraseHeader phrase={round.phrase} className="mb-6" />}
      <div className="flex items-baseline justify-between">
        <PhaseBanner phase="Round" />
        <button
          type="button"
          className="btn-ghost btn-ghost--danger text-xs"
          onClick={() => setRemaining(0)}
        >
          End now
        </button>
      </div>
      <div className="mt-2">
        <TimerBar remaining={remaining} total={totalSeconds} />
      </div>
      <div className="mt-6">
        <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} onChange={handleChange} />
      </div>
    </div>
  );
}
