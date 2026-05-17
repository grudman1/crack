// Pure function: build the Wordle-style share string for a finished
// round. Kept out of the React component so it's tree-shakeable and
// testable without rendering.

export interface ShareResult {
  roundNumber: number;
  correctCount: number;
  totalCount?: number;
  rowResults: boolean[]; // length 26; true = correct, false/undefined = miss
  shareUrl?: string;
}

const CORRECT_SQUARE = '🟧';
const MISS_SQUARE = '⬜';

export function buildShareString(r: ShareResult): string {
  const total = r.totalCount ?? r.rowResults.length;
  const squares = r.rowResults.map((ok) => (ok ? CORRECT_SQUARE : MISS_SQUARE));
  const rowA = squares.slice(0, 13).join('');
  const rowB = squares.slice(13, 26).join('');
  const url = r.shareUrl ?? 'crack-black.vercel.app';
  return `Crack #${r.roundNumber} — ${r.correctCount}/${total}\n\n${rowA}\n${rowB}\n\n${url}`;
}
