// Pure functions: build the Wordle-style share strings for a finished
// round. Kept out of the React components so they're tree-shakeable
// and testable without rendering.

export interface ShareResult {
  roundNumber: number;
  correctCount: number;
  totalCount?: number;
  rowResults: boolean[]; // length 26; true = correct, false/undefined = miss
  shareUrl?: string;
}

const CORRECT_SQUARE = '🟧';
const MISS_SQUARE = '⬜';
// Multiplayer adds a third state — a row the player never submitted.
// Unicode middle-dot reads as "skipped" rather than "wrong".
const BLANK_SQUARE = '·';

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

// ---- Solo -----------------------------------------------------------------

export function buildShareString(r: ShareResult): string {
  const total = r.totalCount ?? r.rowResults.length;
  const squares = r.rowResults.map((ok) => (ok ? CORRECT_SQUARE : MISS_SQUARE));
  const rowA = squares.slice(0, 13).join('');
  const rowB = squares.slice(13, 26).join('');
  const url = r.shareUrl ?? 'crack-black.vercel.app';
  return `Crack #${r.roundNumber} — ${r.correctCount}/${total}\n\n${rowA}\n${rowB}\n\n${url}`;
}

// ---- Multiplayer ----------------------------------------------------------

export type RowOutcome = 'valid' | 'invalid' | 'blank';

export interface MultiplayerShareInput {
  roundNumber: number;
  placement: number; // 1-based
  totalPlayers: number;
  points: number;
  rowOutcomes: RowOutcome[]; // length 26
  shareUrl?: string;
}

function mpOutcomeToEmoji(o: RowOutcome): string {
  if (o === 'valid') return CORRECT_SQUARE;
  if (o === 'invalid') return MISS_SQUARE;
  return BLANK_SQUARE;
}

export function buildMultiplayerShareText(input: MultiplayerShareInput): string {
  const squares = input.rowOutcomes.map(mpOutcomeToEmoji);
  const rowA = squares.slice(0, 13).join('');
  const rowB = squares.slice(13, 26).join('');
  const placement = ordinalize(input.placement);
  const url = input.shareUrl ?? 'crack-black.vercel.app';
  return [
    `Crack · MP · Round #${input.roundNumber} · ${placement} of ${input.totalPlayers}`,
    '',
    rowA,
    rowB,
    '',
    `${input.points} pts`,
    url,
  ].join('\n');
}
