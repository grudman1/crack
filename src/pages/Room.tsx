import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ThumbsDown, ThumbsUp, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
import { useRoomPlayers } from '@/hooks/useRoomPlayers';
import { useSubmissions } from '@/hooks/useSubmissions';
import { useVotes } from '@/hooks/useVotes';
import { useScores } from '@/hooks/useScores';
import {
  computeScores,
  joinRoom,
  leaveRoom,
  resetRoomForNewRound,
  setRoomPhase,
  upsertSubmission,
  castVote,
} from '@/services/roomService';
import { ALPHABET } from '@/services/sentenceService';
import { generateRound, findPhraseByLetters, type Phrase } from '@/services/phraseService';
import { InitialsGrid, type GridRow } from '@/components/InitialsGrid';
import { TimerBar } from '@/components/TimerBar';
import { PhaseBanner } from '@/components/PhaseBanner';
import { PhraseHeader } from '@/components/PhraseHeader';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import { cn } from '@/lib/utils';

export default function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, signInAnonymously } = useAuth();
  const { room, loading } = useRoom(roomCode);
  const players = useRoomPlayers(room?.id);
  const submissions = useSubmissions(room?.id);
  const votes = useVotes(room?.id);
  const scores = useScores(room?.id);

  const [answers, setAnswers] = useState<string[]>(() => Array(26).fill(''));
  const [remaining, setRemaining] = useState(0);
  const playStartRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  // Anonymous join flow (deep link in incognito, etc.)
  const [joinName, setJoinName] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);
  // Guard against the joinRoom useEffect firing twice when both the
  // room and user become available in quick succession (e.g. just
  // after an anonymous sign-in).
  const joinedRef = useRef<string | null>(null);

  const isHost = !!user && !!room && room.host_id === user.id;

  const myGridRows: GridRow[] = useMemo(() => answers.map((name) => ({ name })), [answers]);

  // The room's `sentence` column stores a JSON-serialized Phrase. Old rooms
  // (pre-phrase feature) just have plain text — parse defensively and fall
  // back to looking up the phrase by letters.
  const roomPhrase: Phrase | null = useMemo(() => {
    if (!room) return null;
    const raw = room.sentence;
    if (raw && raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as Partial<Phrase>;
        if (parsed && typeof parsed.text === 'string' && typeof parsed.wikipediaUrl === 'string') {
          return {
            text: parsed.text,
            source: parsed.source ?? '',
            sourceType: (parsed.sourceType ?? 'idiom') as Phrase['sourceType'],
            wikipediaUrl: parsed.wikipediaUrl,
            letters: parsed.letters ?? '',
          };
        }
      } catch {
        /* fall through */
      }
    }
    if (room.letters_26) return findPhraseByLetters(room.letters_26.toLowerCase());
    return null;
  }, [room]);

  useEffect(() => {
    if (!room || !user) return;
    const key = `${room.id}|${user.id}`;
    if (joinedRef.current === key) return;
    joinedRef.current = key;
    void joinRoom(room.id, user.id).catch(() => {});
  }, [room, user]);

  useEffect(() => {
    return () => {
      if (room && user) void leaveRoom(room.id, user.id).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user || !room || !submissions.length) return;
    const mine = submissions.filter((s) => s.player_id === user.id);
    if (!mine.length) return;
    setAnswers((curr) => {
      const next = curr.slice();
      mine.forEach((s) => {
        next[s.row_index] = s.name;
      });
      return next;
    });
  }, [submissions, user, room]);

  useEffect(() => {
    if (!room || room.phase !== 'playing') {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    if (playStartRef.current === null) playStartRef.current = Date.now();
    const update = () => {
      const elapsed = Math.floor((Date.now() - (playStartRef.current ?? Date.now())) / 1000);
      const rem = Math.max(0, room.timer_seconds - elapsed);
      setRemaining(rem);
      if (rem <= 0 && isHost) {
        void setRoomPhase(room.id, 'validating').catch(() => {});
      }
    };
    update();
    tickRef.current = window.setInterval(update, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [room, isHost]);

  useEffect(() => {
    if (room?.phase !== 'playing') playStartRef.current = null;
  }, [room?.phase]);

  if (loading) return <Centered>Loading room…</Centered>;
  if (!room)
    return (
      <Centered>
        Room not found.{' '}
        <Link to="/mp" className="underline">
          back
        </Link>
      </Centered>
    );
  if (!user) {
    const handleAnonymousJoin = async () => {
      const trimmed = joinName.trim();
      if (!trimmed) return;
      setJoiningRoom(true);
      try {
        // signInAnonymously creates the auth user + the profile row
        // (via the handle_new_user trigger). The joinRoom call wired
        // to (room, user) further up fires automatically once
        // onAuthStateChange surfaces the new user.
        await signInAnonymously(trimmed);
        try {
          localStorage.setItem('crack:last_display_name', trimmed);
        } catch {
          /* swallow */
        }
      } catch (e) {
        toast.error(sanitizeError(e));
      } finally {
        setJoiningRoom(false);
      }
    };
    return (
      <Centered>
        <div className="text-center">
          <h2 className="font-serif text-[28px] font-bold text-ink">Join this room</h2>
          <p className="mt-2 font-sans text-sm text-muted">
            Room <span className="font-serif font-bold text-ink">{room.code}</span>
          </p>
          <input
            className="input-line mt-6 mx-auto block w-full max-w-[20rem] text-center"
            placeholder="Your name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value.slice(0, 24))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && joinName.trim() && !joiningRoom) void handleAnonymousJoin();
            }}
            maxLength={24}
            autoFocus
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={!joinName.trim() || joiningRoom}
            onClick={() => void handleAnonymousJoin()}
          >
            {joiningRoom ? 'Joining…' : 'Join room'}
          </button>
        </div>
      </Centered>
    );
  }

  const handleSaveProgress = async () => {
    if (!room || !user) return;
    const letters = room.letters_26 ?? '';
    try {
      const writes = answers.map((name, i) => ({ name: name.trim(), i })).filter((x) => x.name);
      for (const w of writes) {
        const initials = `${ALPHABET[w.i]}${letters[w.i] ?? ''}`;
        await upsertSubmission(room.id, user.id, w.i, initials, w.name);
      }
      toast.success('Saved.');
    } catch (e) {
      toast.error(sanitizeError(e));
    }
  };

  const handleStart = async () => {
    if (!isHost || !room) return;
    try {
      const r = generateRound();
      await setRoomPhase(room.id, 'playing', {
        sentence: JSON.stringify(r.phrase),
        letters_26: r.letters,
      });
    } catch (e) {
      toast.error(sanitizeError(e));
    }
  };

  const handleCompute = async () => {
    if (!isHost || !room) return;
    try {
      await computeScores(room.id);
      await setRoomPhase(room.id, 'results');
    } catch (e) {
      toast.error(sanitizeError(e));
    }
  };

  const handleNewRound = async () => {
    if (!isHost || !room) return;
    try {
      const r = generateRound();
      await resetRoomForNewRound(room.id, JSON.stringify(r.phrase), r.letters, room.timer_seconds);
      setAnswers(Array(26).fill(''));
    } catch (e) {
      toast.error(sanitizeError(e));
    }
  };

  const handleChangeAnswer = (i: number, value: string) => {
    setAnswers((curr) => {
      const next = curr.slice();
      next[i] = value;
      return next;
    });
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      toast.success('Code copied.');
    } catch {
      toast.error('Could not copy.');
    }
  };

  if (room.phase === 'lobby') {
    return (
      <motion.div
        className="frame"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <PhaseBanner phase="Lobby" />
        <section className="panel mt-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-sans text-xs uppercase tracking-wider text-muted">Room code</div>
              <div className="mt-1 font-serif text-3xl font-bold tracking-[0.25em] tabular-nums text-ink">
                {room.code}
              </div>
            </div>
            <button type="button" className="btn-pill-sm" onClick={copyCode}>
              <Copy className="mr-1 h-3 w-3" strokeWidth={2.25} /> Copy
            </button>
          </div>
          <div className="mt-6">
            <div className="font-sans text-xs uppercase tracking-wider text-muted">Players</div>
            <ul className="mt-2 space-y-1 font-sans text-sm text-ink">
              {players.map((p) => (
                <li key={p.id}>
                  {p.profile?.display_name ?? 'Player'}
                  {p.player_id === room.host_id && <span className="text-muted"> · host</span>}
                </li>
              ))}
              {players.length === 0 && <li className="text-muted">Waiting…</li>}
            </ul>
            {players.length === 1 && (
              <p className="mt-3 font-sans text-xs text-muted">
                Share the code with someone to start.
              </p>
            )}
          </div>
          {isHost ? (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <label className="font-sans text-xs uppercase tracking-wider text-muted">Timer</label>
                <select
                  className="input-line w-auto py-1 font-sans text-sm"
                  value={room.timer_seconds}
                  onChange={async (e) => {
                    await setRoomPhase(room.id, 'lobby', { timer_seconds: Number(e.target.value) });
                  }}
                >
                  <option value={120}>2 min</option>
                  <option value={180}>3 min</option>
                  <option value={300}>5 min</option>
                  <option value={420}>7 min</option>
                </select>
                <button type="button" className="btn-primary ml-auto" onClick={handleStart} disabled={players.length < 2}>
                  Start
                </button>
              </div>
              {players.length < 2 && (
                <p className="mt-2 text-right font-sans text-xs text-muted">
                  Need at least one more player.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 font-sans text-sm text-muted">Waiting for host to start…</div>
          )}
        </section>
      </motion.div>
    );
  }

  if (room.phase === 'playing') {
    return (
      <div className="frame">
        {roomPhrase && <PhraseHeader phrase={roomPhrase} className="mb-6" />}
        <div className="flex items-baseline justify-between">
          <PhaseBanner phase="Round" />
          <button type="button" className="btn-pill-sm" onClick={handleSaveProgress}>
            Save progress
          </button>
        </div>
        <div className="mt-2">
          <TimerBar remaining={remaining} total={room.timer_seconds} />
        </div>
        <div className="mt-6">
          <InitialsGrid letters={room.letters_26 ?? ''} rows={myGridRows} onChange={handleChangeAnswer} />
        </div>
      </div>
    );
  }

  if (room.phase === 'validating') {
    return (
      <ValidatingView
        letters={room.letters_26 ?? ''}
        phrase={roomPhrase}
        submissions={submissions}
        votes={votes}
        userId={user.id}
        onVote={(submissionId, isValid) => castVote(room.id, submissionId, user.id, isValid)}
        isHost={isHost}
        onCompute={handleCompute}
      />
    );
  }

  return (
    <ResultsView
      letters={room.letters_26 ?? ''}
      phrase={roomPhrase}
      submissions={submissions}
      players={players}
      scores={scores}
      userId={user.id}
      isHost={isHost}
      onNewRound={handleNewRound}
    />
  );
}

function ValidatingView({
  letters,
  phrase,
  submissions,
  votes,
  userId,
  onVote,
  isHost,
  onCompute,
}: {
  letters: string;
  phrase: Phrase | null;
  submissions: ReturnType<typeof useSubmissions>;
  votes: ReturnType<typeof useVotes>;
  userId: string;
  onVote: (submissionId: string, isValid: boolean) => Promise<void>;
  isHost: boolean;
  onCompute: () => void;
}) {
  const byRow = useMemo(() => {
    const m: Record<number, typeof submissions> = {};
    for (let i = 0; i < 26; i++) m[i] = [];
    for (const s of submissions) {
      if (!m[s.row_index]) m[s.row_index] = [];
      m[s.row_index]!.push(s);
    }
    return m;
  }, [submissions]);

  const myVote = (submissionId: string) =>
    votes.find((v) => v.submission_id === submissionId && v.voter_id === userId);
  const tally = (submissionId: string) => {
    const yes = votes.filter((v) => v.submission_id === submissionId && v.is_valid).length;
    const no = votes.filter((v) => v.submission_id === submissionId && !v.is_valid).length;
    return { yes, no };
  };

  return (
    <div className="frame">
      {phrase && <PhraseHeader phrase={phrase} className="mb-6" />}
      <div className="flex items-baseline justify-between">
        <PhaseBanner phase="Validating" />
        {isHost && (
          <button type="button" className="btn-pill-sm bg-ink !text-paper hover:!bg-[#2a2a2a]" onClick={onCompute}>
            Compute scores
          </button>
        )}
      </div>
      <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
        {Array.from({ length: 26 }, (_, i) => i).map((i) => {
          const subs = byRow[i] ?? [];
          if (subs.length === 0) return null;
          const initials = `${ALPHABET[i]} · ${letters[i] ?? ''}`;
          return (
            <li key={i} className="py-3">
              <div className="letter-pair">{initials}</div>
              <ul className="mt-2 space-y-1.5">
                {subs.map((s) => {
                  const t = tally(s.id);
                  const mine = s.player_id === userId;
                  const v = myVote(s.id);
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="flex-1 font-sans text-sm text-ink">
                        {s.name || <em className="text-muted">(blank)</em>}
                      </span>
                      <span className="font-sans text-xs tabular-nums text-muted">
                        {t.yes} / {t.yes + t.no}
                      </span>
                      {!mine ? (
                        <>
                          <button
                            type="button"
                            className={cn('btn-pill-sm', v?.is_valid && 'btn-ghost--selected')}
                            onClick={() => void onVote(s.id, true)}
                            aria-label="valid"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className={cn('btn-pill-sm', v && !v.is_valid && 'btn-ghost--danger')}
                            onClick={() => void onVote(s.id, false)}
                            aria-label="invalid"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </>
                      ) : (
                        <span className="font-sans text-xs text-muted">yours</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultsView({
  letters,
  phrase,
  submissions,
  players,
  scores,
  userId,
  isHost,
  onNewRound,
}: {
  letters: string;
  phrase: Phrase | null;
  submissions: ReturnType<typeof useSubmissions>;
  players: ReturnType<typeof useRoomPlayers>;
  scores: ReturnType<typeof useScores>;
  userId: string;
  isHost: boolean;
  onNewRound: () => void;
}) {
  const sorted = [...scores].sort((a, b) => b.total - a.total);
  const me = scores.find((s) => s.player_id === userId);
  const myRows = submissions.filter((s) => s.player_id === userId);

  return (
    <motion.div
      className="frame"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {phrase && <PhraseHeader phrase={phrase} className="mb-6" />}
      <div className="flex items-baseline justify-between">
        <PhaseBanner phase="Results" />
        {isHost && (
          <button type="button" className="btn-pill-sm bg-ink !text-paper hover:!bg-[#2a2a2a]" onClick={onNewRound}>
            New round
          </button>
        )}
      </div>
      <section className="panel mt-4 p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Leaderboard</h2>
        <ol className="mt-2 space-y-1">
          {sorted.map((s, idx) => {
            const player = players.find((p) => p.player_id === s.player_id);
            return (
              <li key={s.id} className="flex items-baseline justify-between font-sans text-sm">
                <span>
                  <span className="mr-2 text-muted tabular-nums">{idx + 1}.</span>
                  {player?.profile?.display_name ?? 'Player'}
                </span>
                <span className="font-serif text-base font-bold tabular-nums text-ink">{s.total}</span>
              </li>
            );
          })}
          {sorted.length === 0 && <li className="font-sans text-sm text-muted">No scores yet.</li>}
        </ol>
      </section>

      {me && (
        <details className="panel mt-4 p-5">
          <summary className="cursor-pointer font-sans text-sm font-semibold text-ink">Your breakdown</summary>
          <ul className="mt-3 space-y-1 font-sans text-sm">
            {Object.entries(me.breakdown ?? {})
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([row, pts]) => {
                const rowIdx = Number(row);
                const sub = myRows.find((s) => s.row_index === rowIdx);
                return (
                  <li key={row} className="flex justify-between">
                    <span>
                      <span className="mr-2 font-serif font-bold">
                        {ALPHABET[rowIdx]} · {letters[rowIdx] ?? ''}
                      </span>
                      {sub?.name ?? '—'}
                    </span>
                    <span className="tabular-nums text-muted">{pts}</span>
                  </li>
                );
              })}
          </ul>
        </details>
      )}

    </motion.div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="frame py-16 text-center font-sans text-sm text-muted">{children}</div>;
}
