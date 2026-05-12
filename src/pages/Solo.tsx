import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ALPHABET, generateRoundLetters } from '@/services/sentenceService';
import { validateName, computeNameInitials } from '@/services/wikiValidationService';
import { playBeep, playChime, resumeAudio } from '@/services/audioService';
import { InitialsGrid, type GridRow, type RowStatus } from '@/components/InitialsGrid';
import { TimerBar } from '@/components/TimerBar';
import { PhaseBanner } from '@/components/PhaseBanner';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { ExportButtons } from '@/components/ExportButtons';
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
  const [round, setRound] = useState<{ sentence: string; letters: string } | null>(null);
  const [rows, setRows] = useState<AnswerRow[]>(emptyRows);
  const [validationProgress, setValidationProgress] = useState(0);
  const tickRef = useRef<number | null>(null);

  // Timer
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
            reason: `Initials do not match. Expected ${expected}, got ${localInitials}.`,
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

  // Round-over transition
  useEffect(() => {
    if (phase === 'playing' && remaining === 0) {
      playChime();
      void runValidation();
    }
  }, [phase, remaining, runValidation]);

  const start = () => {
    resumeAudio();
    const r = generateRoundLetters();
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
  const missedIndexes = useMemo(
    () => rows.map((r, i) => (r.status === 'invalid' || r.status === 'unanswered' ? i : -1)).filter((i) => i >= 0),
    [rows],
  );

  if (phase === 'setup') {
    return (
      <motion.div
        className="mx-auto max-w-md px-6 py-12"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="paper-card p-6 text-center">
          <h1 className="font-display text-3xl uppercase">Solo</h1>
          <p className="font-hand text-xl text-ink-soft mt-1">choose a round length</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {TIMER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`btn-paper ${totalSeconds === opt.value ? 'btn-paper--primary' : ''}`}
                onClick={() => setTotalSeconds(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="block mt-4 font-hand text-lg text-ink-soft">
            or custom (seconds)
            <input
              type="number"
              min={30}
              max={1800}
              value={totalSeconds}
              onChange={(e) => setTotalSeconds(Math.max(30, Math.min(1800, Number(e.target.value) || 30)))}
              className="ink-input border-b border-ink/40 ml-2 w-20 text-center"
            />
          </label>
          <button className="btn-paper btn-paper--primary mt-6 text-lg" onClick={start}>
            Start round
          </button>
        </div>
      </motion.div>
    );
  }

  if (phase === 'validating') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PhaseBanner phase="Validating" className="mb-4" />
        <p className="font-hand text-xl text-ink-soft">
          Checking {Math.min(26, Math.round(validationProgress / (100 / 26)))} of 26…
        </p>
        <Progress value={validationProgress} className="mt-2" />
        <div className="mt-6">
          <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} readOnly />
        </div>
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <motion.div
        className="mx-auto max-w-2xl px-6 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center justify-between mb-4">
          <PhaseBanner phase="Results" />
          <div className="stamp" style={{ color: 'hsl(var(--accent-green))', borderColor: 'hsl(var(--accent-green))' }}>
            {totalScore} pts
          </div>
        </div>
        <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} readOnly showResults />
        <SuggestionsPanel letters={round?.letters ?? ''} missedIndexes={missedIndexes} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <ExportButtons
            payload={{
              title: `CRACK Solo · ${new Date().toLocaleDateString()}`,
              sentence: round?.sentence ?? '',
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
          <button className="btn-paper btn-paper--primary" onClick={() => setPhase('setup')}>
            New round
          </button>
        </div>
      </motion.div>
    );
  }

  // Playing
  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="flex items-center justify-between mb-3">
        <PhaseBanner phase="Round in play" />
        <button
          className="btn-paper btn-paper--danger text-sm"
          onClick={() => {
            setRemaining(0);
          }}
        >
          End now
        </button>
      </div>
      <TimerBar remaining={remaining} total={totalSeconds} />
      <div className="mt-4">
        <InitialsGrid letters={round?.letters ?? ''} rows={gridRows} onChange={handleChange} />
      </div>
    </div>
  );
}
