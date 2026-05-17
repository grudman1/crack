// Solo mode orchestrator. Owns all state + side effects: the round
// timer, the validation pipeline, the review-modal lifecycle. The four
// phase views (setup / playing / validating / results) are extracted
// into src/pages/Solo/ as pure(ish) view components — they receive
// props and emit callbacks but hold no state of their own.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALPHABET } from '@/services/sentenceService';
import { generateRound, type Round } from '@/services/phraseService';
import {
  validateName,
  computeNameInitials,
  type TraceRecord,
} from '@/services/wikiValidationService';
import { playKeystroke, playChime, resumeAudio } from '@/services/audioService';
import { getRoundNumber, incrementRoundNumber } from '@/services/roundCounter';
import type { GridRow, RowStatus } from '@/components/InitialsGrid';
import { ReviewSubmitModal } from '@/components/ReviewSubmitModal';
import { sanitizeError } from '@/lib/sanitizeError';
import { toast } from '@/components/ui/toast';
import { SoloSetup } from '@/pages/Solo/SoloSetup';
import { SoloPlaying } from '@/pages/Solo/SoloPlaying';
import { SoloValidating } from '@/pages/Solo/SoloValidating';
import { SoloResults } from '@/pages/Solo/SoloResults';

type SoloPhase = 'setup' | 'playing' | 'validating' | 'results';

interface AnswerRow {
  name: string;
  status?: RowStatus;
  reason?: string;
  canonicalName?: string;
  points?: number;
  /** Captured during runValidation so the review modal can include it
   *  without re-running the validator. */
  trace?: TraceRecord[];
}

function emptyRows(): AnswerRow[] {
  return Array.from({ length: 26 }, () => ({ name: '' }));
}

const SUBMITTED_KEY = 'crack:submitted_reviews';
const submittedKey = (name: string, pair: string) =>
  `${name.trim().toLowerCase()}|${pair.toUpperCase()}`;

function loadSubmittedKeys(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(SUBMITTED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function saveSubmittedKeys(keys: Set<string>) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify([...keys]));
  } catch {
    /* swallow — feedback is best-effort */
  }
}

export default function Solo() {
  const [phase, setPhase] = useState<SoloPhase>('setup');
  const [totalSeconds, setTotalSeconds] = useState(180);
  const [remaining, setRemaining] = useState(180);
  const [round, setRound] = useState<Round | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(() => getRoundNumber());
  const [rows, setRows] = useState<AnswerRow[]>(emptyRows);
  const [validationProgress, setValidationProgress] = useState(0);
  const [reviewModalRow, setReviewModalRow] = useState<number | null>(null);
  const [submittedKeys, setSubmittedKeys] = useState<Set<string>>(() => loadSubmittedKeys());
  const tickRef = useRef<number | null>(null);

  // ---- Timer ----
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

  // ---- Validation pipeline ----
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
          // Synthesize a minimal trace for the modal so admins see what
          // happened even on a local-only rejection.
          next[i] = {
            ...next[i]!,
            status: 'invalid',
            reason: `expected ${expected}, got ${localInitials}`,
            points: 0,
            trace: [
              { stage: 'gate', label: 'Initials', outcome: 'miss', note: `expected ${expected}, got ${localInitials}` },
              { stage: 'final', label: 'Reject', outcome: 'info', note: `expected ${expected}, got ${localInitials}` },
            ],
          };
        } else {
          // Capture the trace for every API-backed validation, accept
          // or reject — symmetric "?" flag needs it on valid rows too.
          const trace: TraceRecord[] = [];
          try {
            const result = await validateName(name, {
              expectedInitials: expected,
              trace: (r) => trace.push(r),
            });
            if (result.status === 'valid') {
              next[i] = {
                ...next[i]!,
                status: 'valid',
                canonicalName: result.canonicalName,
                points: 10,
                trace,
              };
            } else {
              next[i] = { ...next[i]!, status: 'invalid', reason: result.reason, points: 0, trace };
            }
          } catch (err) {
            next[i] = { ...next[i]!, status: 'invalid', reason: sanitizeError(err), points: 0, trace };
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

  // ---- Phase transitions ----
  const start = () => {
    resumeAudio();
    const r = generateRound();
    setRound(r);
    setRows(emptyRows());
    setRemaining(totalSeconds);
    setRoundNumber(incrementRoundNumber());
    setPhase('playing');
  };

  const handleChange = (i: number, value: string) => {
    const prev = rows[i]?.name ?? '';
    if (value.length > prev.length) {
      playKeystroke();
    }
    setRows((curr) => {
      const next = curr.slice();
      next[i] = { ...next[i], name: value };
      return next;
    });
  };

  // ---- Derived: row projections + counters ----
  const gridRows: GridRow[] = useMemo(
    () =>
      rows.map((r) => ({
        name: r.name,
        status: r.status,
        reason: r.reason,
        canonicalName: r.canonicalName,
        points: r.points,
      })),
    [rows],
  );

  const totalScore = useMemo(() => rows.reduce((acc, r) => acc + (r.points ?? 0), 0), [rows]);
  const correctCount = useMemo(() => rows.filter((r) => r.status === 'valid').length, [rows]);
  const missedIndexes = useMemo(
    () =>
      rows
        .map((r, i) => (r.status === 'invalid' || r.status === 'unanswered' ? i : -1))
        .filter((i) => i >= 0),
    [rows],
  );

  // ---- Review modal: indexes + context + onSubmitted ----
  // Both accepted and rejected rows can be flagged.
  const submittedRowIndexes = useMemo(() => {
    const out = new Set<number>();
    rows.forEach((r, i) => {
      if (!round || !r.name) return;
      if (r.status !== 'invalid' && r.status !== 'valid') return;
      const expected = `${ALPHABET[i]}${round.letters[i] ?? ''}`;
      if (submittedKeys.has(submittedKey(r.name, expected))) out.add(i);
    });
    return out;
  }, [rows, round, submittedKeys]);

  const modalContext = useMemo(() => {
    if (reviewModalRow === null || !round) return null;
    const r = rows[reviewModalRow];
    if (!r) return null;
    const pair = `${ALPHABET[reviewModalRow]}${round.letters[reviewModalRow] ?? ''}`;
    const isAccepted = r.status === 'valid';
    return {
      name: r.name,
      expectedPair: pair,
      actualResult: (isAccepted ? 'valid' : 'invalid') as 'valid' | 'invalid',
      // Accepted rows show the canonical Wikipedia name (so the
      // reviewer can spot a wrong-but-confident match). Rejected rows
      // show the rejection reason.
      reason: isAccepted ? r.canonicalName ?? r.name : r.reason ?? null,
      trace: r.trace ?? [],
    };
  }, [reviewModalRow, round, rows]);

  const handleSubmitted = useCallback(() => {
    if (reviewModalRow === null || !round) return;
    const r = rows[reviewModalRow];
    if (!r?.name) return;
    const pair = `${ALPHABET[reviewModalRow]}${round.letters[reviewModalRow] ?? ''}`;
    setSubmittedKeys((curr) => {
      const next = new Set(curr);
      next.add(submittedKey(r.name, pair));
      saveSubmittedKeys(next);
      return next;
    });
  }, [reviewModalRow, round, rows]);

  // ---- Phase render ----
  return (
    <>
      {phase === 'setup' && (
        <SoloSetup
          totalSeconds={totalSeconds}
          onSetTotalSeconds={setTotalSeconds}
          onStart={start}
        />
      )}
      {phase === 'playing' && round && (
        <SoloPlaying
          round={round}
          remaining={remaining}
          totalSeconds={totalSeconds}
          rows={gridRows}
          onChange={handleChange}
          onEnd={() => setRemaining(0)}
        />
      )}
      {phase === 'validating' && (
        <SoloValidating round={round} validationProgress={validationProgress} rows={gridRows} />
      )}
      {phase === 'results' && (
        <SoloResults
          round={round}
          rows={gridRows}
          roundNumber={roundNumber}
          totalSeconds={totalSeconds}
          correctCount={correctCount}
          totalScore={totalScore}
          missedIndexes={missedIndexes}
          onPlayAgain={() => setPhase('setup')}
          onSubmitForReview={(i) => setReviewModalRow(i)}
          submittedReviewKeys={submittedRowIndexes}
        />
      )}
      {modalContext && (
        <ReviewSubmitModal
          open={reviewModalRow !== null}
          onOpenChange={(o) => {
            if (!o) setReviewModalRow(null);
          }}
          context={modalContext}
          onSubmitted={handleSubmitted}
        />
      )}
    </>
  );
}
