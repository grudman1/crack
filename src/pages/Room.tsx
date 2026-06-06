import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  finalizeRound,
  joinRoom,
  leaveRoom,
  resetRoomForNewRound,
  setRoomPhase,
  startRound,
  advancePhaseIfExpired,
  upsertSubmission,
  castVote,
} from '@/services/roomService';
import { ALPHABET } from '@/services/sentenceService';
import { generateRound, findPhraseByLetters, type Phrase } from '@/services/phraseService';
import { InitialsGrid, type GridRow } from '@/components/InitialsGrid';
import { TimerBar } from '@/components/TimerBar';
import { PhraseHeader } from '@/components/PhraseHeader';
import { ShareButton } from '@/components/ShareButton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from '@/components/ui/toast';
import { sanitizeError } from '@/lib/sanitizeError';
import { buildMultiplayerShareText, type RowOutcome } from '@/lib/share';
import { cn } from '@/lib/utils';
import { formatToday, getRoundNumber } from '@/services/roundCounter';

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

  // Count non-empty submissions per player. Drives the progress
  // strip shown during the playing phase so each player sees others
  // filling in their grid in real time. Empty rows (autosaved-then-
  // cleared) don't count.
  const submissionsByPlayer = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of submissions) {
      if (!s.name?.trim()) continue;
      m[s.player_id] = (m[s.player_id] ?? 0) + 1;
    }
    return m;
  }, [submissions]);

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

  const leaveRef = useRef<{ roomId: string; userId: string } | null>(null);
  useEffect(() => {
    leaveRef.current = room && user ? { roomId: room.id, userId: user.id } : null;
  }, [room, user]);

  useEffect(() => {
    return () => {
      const ru = leaveRef.current;
      if (ru) void leaveRoom(ru.roomId, ru.userId).catch(() => {});
    };
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

  // -------------------------------------------------------------------
  // Autosave per row. Debounced so a keystrokes-per-second player
  // doesn't generate one Supabase write per character, but tight
  // enough that focus-out / phase-change / tab-close don't lose
  // recent edits. No "Saving…" UI — players just trust the field.
  // -------------------------------------------------------------------
  const pendingWritesRef = useRef<Map<number, number>>(new Map());
  // Mirror current answers in a ref so the flush handler can read the
  // latest values without depending on stale closures.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const writeRow = useCallback(
    async (i: number, value: string) => {
      if (!room || !user) return;
      const letters = room.letters_26 ?? '';
      const initials = `${ALPHABET[i]}${letters[i] ?? ''}`;
      try {
        await upsertSubmission(room.id, user.id, i, initials, value.trim());
      } catch (e) {
        toast.error(sanitizeError(e));
      }
    },
    [room, user],
  );

  const flushPendingWrites = useCallback(async () => {
    const pending = Array.from(pendingWritesRef.current.entries());
    pendingWritesRef.current.clear();
    pending.forEach(([, timer]) => window.clearTimeout(timer));
    await Promise.all(
      pending.map(([i]) => writeRow(i, answersRef.current[i] ?? '')),
    );
  }, [writeRow]);

  // Flush when leaving the playing phase (validating / results /
  // back-to-lobby) so no edits get lost on the natural buzzer.
  useEffect(() => {
    if (room && room.phase !== 'playing') {
      void flushPendingWrites();
    }
  }, [room?.phase, room, flushPendingWrites]);

  // Flush on unmount.
  useEffect(() => {
    return () => {
      void flushPendingWrites();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defensive: flush on tab/window close. Best-effort; modern browsers
  // ignore async work scheduled in beforeunload, but kicking off the
  // promises buys us a chance.
  useEffect(() => {
    const handler = () => {
      void flushPendingWrites();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [flushPendingWrites]);

  useEffect(() => {
    if (!room || room.phase !== 'playing') {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    // Single source of truth is rooms.play_started_at, set server-side
    // by the start_round RPC. Every client computes remaining from the
    // same stamp, so timers don't drift between host and joiners. Fall
    // back to "now" if the column hasn't propagated yet (one tick of
    // jitter before the realtime update lands).
    const start = room.play_started_at ? Date.parse(room.play_started_at) : Date.now();
    const update = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const rem = Math.max(0, room.timer_seconds - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        // Any room member can advance — the RPC is idempotent and only
        // acts once the timer has actually expired server-side. Previously
        // only the host could advance, so a host disconnect mid-round
        // stranded the game in 'playing' forever.
        void advancePhaseIfExpired(room.id).catch(() => {});
      }
    };
    update();
    tickRef.current = window.setInterval(update, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [room]);

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
      <motion.div
        className="frame"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <h1 className="text-center font-serif text-[28px] font-bold leading-tight text-ink lg:text-[48px]">
          Join this room
        </h1>
        <p className="mt-1 text-center font-serif italic text-muted lg:mt-3 lg:text-[20px]">
          Room <span className="not-italic font-bold text-ink">{room.code}</span>
        </p>
        <div className="mt-8">
          <label className="block">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">Your name</span>
            <input
              className="input-line mt-1 font-sans text-base"
              placeholder="Your name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value.slice(0, 24))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinName.trim() && !joiningRoom) {
                  void handleAnonymousJoin();
                }
              }}
              maxLength={24}
              autoFocus
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className="btn-primary w-full max-w-[20rem]"
            disabled={!joinName.trim() || joiningRoom}
            onClick={() => void handleAnonymousJoin()}
          >
            {joiningRoom ? 'Joining…' : 'Join room'}
          </button>
        </div>
      </motion.div>
    );
  }

  const handleStart = async () => {
    if (!isHost || !room) return;
    try {
      const r = generateRound();
      // start_round atomically sets phase='playing' and stamps
      // play_started_at — the timer effect reads that stamp.
      await startRound(room.id, JSON.stringify(r.phrase), r.letters);
    } catch (e) {
      toast.error(sanitizeError(e));
    }
  };

  const handleCompute = async () => {
    if (!isHost || !room) return;
    // L-E: don't silently zero everyone when no votes have landed yet.
    if (
      votes.length === 0 &&
      !window.confirm('No votes cast yet — everyone will score 0. Compute anyway?')
    ) {
      return;
    }
    try {
      // finalize_round is host-guarded + atomic: it does the compute
      // and the phase flip in one transaction, so a vote can't slip
      // in between them (H-A / M-A / L-C).
      await finalizeRound(room.id);
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
    // Cancel any in-flight debounce for this row and queue a fresh
    // one. The flushPendingWrites handlers (phase change / unmount /
    // beforeunload) drain anything still pending.
    const existing = pendingWritesRef.current.get(i);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      void writeRow(i, value);
      pendingWritesRef.current.delete(i);
    }, 600);
    pendingWritesRef.current.set(i, timer);
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
    const lobbySubtitle =
      players.length <= 1 ? 'Share the code to start.' : 'Waiting for the host to start…';
    return (
      <motion.div
        className="frame"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <h1 className="text-center font-serif text-[28px] font-bold leading-tight text-ink lg:text-[48px]">
          Lobby
        </h1>
        <p className="mt-1 text-center font-serif italic text-muted lg:mt-3 lg:text-[20px]">
          {lobbySubtitle}
        </p>

        {/* Room code is the most important thing on this screen — treat
            it like Solo Results treats X / 26: centered, giant serif,
            tracked, with Copy as a pill below. */}
        <div className="mt-8 flex flex-col items-center text-center">
          <div className="font-sans text-xs uppercase tracking-wider text-muted">Room code</div>
          <div className="mt-2 font-serif text-[48px] font-bold leading-none tracking-[0.25em] tabular-nums text-ink lg:text-[56px]">
            {room.code}
          </div>
          <button type="button" className="btn-pill-sm mt-4" onClick={copyCode}>
            <Copy className="mr-1 h-3 w-3" strokeWidth={2.25} /> Copy
          </button>
        </div>

        <section className="panel mt-8 p-5">
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
      <motion.div
        className="frame"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {roomPhrase && <PhraseHeader phrase={roomPhrase} className="mb-6" />}
        <div className="mt-2">
          <TimerBar remaining={remaining} total={room.timer_seconds} />
        </div>
        {/* Single-line progress strip with " · " separators between
            players. Your row keeps the ink-bold treatment; others
            stay muted. Compact so it doesn't fight the grid for
            attention. */}
        {players.length > 1 && (
          <div className="mt-3 font-sans text-xs text-muted">
            {players.map((p, idx) => {
              const count = submissionsByPlayer[p.player_id] ?? 0;
              const isMe = p.player_id === user.id;
              const name = isMe ? 'You' : p.profile?.display_name ?? 'Player';
              return (
                <span key={p.player_id}>
                  {idx > 0 && <span className="mx-2 text-muted/60">·</span>}
                  <span className={isMe ? 'font-semibold text-ink' : ''}>
                    {name} <span className="tabular-nums">{count}/26</span>
                  </span>
                </span>
              );
            })}
          </div>
        )}
        <div className="mt-6">
          <InitialsGrid letters={room.letters_26 ?? ''} rows={myGridRows} onChange={handleChangeAnswer} />
        </div>
      </motion.div>
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
      // Skip empty submissions — autosave can record empty rows
      // when a player types-then-deletes. Voting on blanks is
      // useless noise.
      if (!s.name?.trim()) continue;
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
    <motion.div
      className="frame"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {phrase && <PhraseHeader phrase={phrase} className="mb-6" />}
      <h1 className="text-center font-serif text-[28px] font-bold leading-tight text-ink lg:text-[48px]">
        Validating
      </h1>
      <p className="mt-1 text-center font-serif italic text-muted lg:mt-3 lg:text-[20px]">
        Vote on each other&apos;s answers.
      </p>
      {isHost && (
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn-pill-sm btn-pill-sm--dark" onClick={onCompute}>
            Compute scores
          </button>
        </div>
      )}
      <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
        {Array.from({ length: 26 }, (_, i) => i).map((i) => {
          const subs = byRow[i] ?? [];
          if (subs.length === 0) return null;
          const initials = `${ALPHABET[i]} · ${letters[i] ?? ''}`;
          return (
            <li key={i} className="py-4">
              <div className="letter-pair">{initials}</div>
              <ul className="mt-2 space-y-1.5">
                {subs.map((s) => {
                  const t = tally(s.id);
                  const mine = s.player_id === userId;
                  const v = myVote(s.id);
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="flex-1 font-sans text-sm text-ink">
                        {s.name}
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
    </motion.div>
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
  // M-B: build the leaderboard from current room members merged with
  // scores. compute_room_scores only writes rows for players who
  // submitted at least one answer, so a silent joiner would otherwise
  // vanish from the leaderboard. Fall back to 0 for missing scores.
  const sorted = useMemo(() => {
    const scoreByPlayer = new Map(scores.map((s) => [s.player_id, s] as const));
    const entries = players.map((p) => {
      const s = scoreByPlayer.get(p.player_id);
      return {
        id: s?.id ?? `placeholder:${p.player_id}`,
        player_id: p.player_id,
        total: s?.total ?? 0,
        displayName: p.profile?.display_name ?? 'Player',
      };
    });
    return entries.sort((a, b) => b.total - a.total);
  }, [players, scores]);
  const me = scores.find((s) => s.player_id === userId);
  const myRows = submissions.filter((s) => s.player_id === userId);

  // Derive per-row outcomes for the share grid:
  //   valid   — my score breakdown gave points for that row
  //   blank   — I didn't submit a name for that row
  //   invalid — I submitted but it didn't score
  const rowOutcomes: RowOutcome[] = useMemo(() => {
    const breakdown = (me?.breakdown ?? {}) as Record<string, number>;
    const submittedRows = new Set(
      myRows.filter((s) => s.name?.trim()).map((s) => s.row_index),
    );
    return Array.from({ length: 26 }, (_, i) => {
      const pts = Number(breakdown[String(i)] ?? 0);
      if (pts > 0) return 'valid';
      if (!submittedRows.has(i)) return 'blank';
      return 'invalid';
    });
  }, [me, myRows]);
  const myPlacement = me ? sorted.findIndex((s) => s.player_id === userId) + 1 : 0;

  const placementLabel =
    me && myPlacement > 0 ? `${ordinalize(myPlacement)} of ${sorted.length}` : null;
  const localRoundNumber = getRoundNumber();

  return (
    <motion.div
      className="frame"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {phrase && <PhraseHeader phrase={phrase} className="mb-6" />}

      {/* Centered score block — your total points as the giant
          serif numeral, placement (Xth of N) as the muted line below.
          Same visual rhythm as Solo's "X / 26" + "pts · timer" pair. */}
      <div className="flex flex-col items-center text-center">
        <div className="font-serif text-[48px] font-bold leading-none tabular-nums text-ink lg:text-[56px]">
          {me?.total ?? 0}
        </div>
        <div className="mt-2 font-sans text-[13px] text-muted">
          {placementLabel ? `${placementLabel} · ${me?.total ?? 0} pts` : `${me?.total ?? 0} pts`}
        </div>
      </div>

      {/* Primary action slot — host gets the New round button,
          non-hosts see a quiet "waiting" line in the same vertical
          position so the layout doesn't shift between roles. */}
      <div className="mt-6 flex justify-center">
        {isHost ? (
          <button
            type="button"
            className="btn-primary w-full max-w-[20rem]"
            onClick={onNewRound}
          >
            New round
          </button>
        ) : (
          <p className="font-sans text-sm text-muted">
            Waiting for the host to start a new round…
          </p>
        )}
      </div>

      {me && myPlacement > 0 && (
        <div className="mt-3 flex justify-center">
          <ShareButton
            title={`Crack · MP · Round #${localRoundNumber}`}
            label="Share"
            text={buildMultiplayerShareText({
              roundNumber: localRoundNumber,
              placement: myPlacement,
              totalPlayers: sorted.length,
              points: me.total,
              rowOutcomes,
            })}
          />
        </div>
      )}

      <div className="mt-6 font-sans text-[13px] leading-relaxed text-center">
        <div className="text-ink">{formatToday()}</div>
        <div className="text-muted">Round No. {localRoundNumber}</div>
      </div>

      <section className="panel mt-8 p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Leaderboard</h2>
        <ol className="mt-2 space-y-1">
          {sorted.map((s, idx) => (
            <li key={s.id} className="flex items-baseline justify-between font-sans text-sm">
              <span>
                <span className="mr-2 text-muted tabular-nums">{idx + 1}.</span>
                {s.displayName}
              </span>
              <span className="font-serif text-base font-bold tabular-nums text-ink">{s.total}</span>
            </li>
          ))}
          {sorted.length === 0 && <li className="font-sans text-sm text-muted">No scores yet.</li>}
        </ol>
      </section>

      {me && (
        <Accordion type="single" collapsible className="mt-4">
          <AccordionItem value="breakdown" className="panel border-hairline">
            <AccordionTrigger className="px-5 font-sans text-sm font-semibold text-ink hover:no-underline">
              Your breakdown
            </AccordionTrigger>
            <AccordionContent className="px-5">
              <ul className="space-y-1 font-sans text-sm">
                {Object.entries(me.breakdown ?? {})
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .flatMap(([row, pts]) => {
                    const rowIdx = Number(row);
                    const sub = myRows.find((s) => s.row_index === rowIdx);
                    // M-C: skip blank-name rows so intentionally-empty
                    // attempts don't clutter the breakdown as `— 0`.
                    if (!sub?.name?.trim()) return [];
                    return [
                      <li key={row} className="flex justify-between">
                        <span>
                          <span className="mr-2 font-serif font-bold">
                            {ALPHABET[rowIdx]} · {letters[rowIdx] ?? ''}
                          </span>
                          {sub.name}
                        </span>
                        <span className="tabular-nums text-muted">{pts}</span>
                      </li>,
                    ];
                  })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

    </motion.div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="frame py-16 text-center font-sans text-sm text-muted">{children}</div>;
}

function ordinalize(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
