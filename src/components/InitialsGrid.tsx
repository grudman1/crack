import { useRef } from 'react';
import { ScrabbleTile } from './ScrabbleTile';
import { ALPHABET } from '@/services/sentenceService';
import { cn } from '@/lib/utils';

export type RowStatus = 'pending' | 'valid' | 'invalid' | 'unanswered';

export interface GridRow {
  status?: RowStatus;
  name: string;
  reason?: string;
  canonicalName?: string;
  points?: number;
}

interface InitialsGridProps {
  letters: string; // 26-char string for column B
  rows: GridRow[]; // length 26
  onChange?: (index: number, value: string) => void;
  readOnly?: boolean;
  showResults?: boolean;
  className?: string;
}

export function InitialsGrid({
  letters,
  rows,
  onChange,
  readOnly = false,
  showResults = false,
  className,
}: InitialsGridProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      refs.current[idx + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      refs.current[idx - 1]?.focus();
    }
  };

  return (
    <div className={cn('paper-card overflow-hidden bg-paper', className)}>
      <div className="sticky top-0 z-10 grid grid-cols-[44px_44px_1fr_auto] items-center gap-2 border-b border-ink/30 bg-paper-shadow px-4 py-2 font-hand text-base text-ink-soft">
        <span>A–Z</span>
        <span>round</span>
        <span>person</span>
        <span className="pr-2 text-right">{showResults ? 'pts' : ''}</span>
      </div>
      <div className="notebook-lines margin-line px-4">
        {ALPHABET.map((alpha, i) => {
          const round = (letters[i] ?? ' ').toUpperCase();
          const row = rows[i] ?? { name: '' };
          const status = row.status;
          const stateColor =
            status === 'valid'
              ? 'text-accent-green'
              : status === 'invalid'
                ? 'text-accent-red'
                : 'text-ink';
          return (
            <div
              key={alpha}
              className="grid grid-cols-[44px_44px_1fr_auto] items-center gap-2"
              style={{ height: 32, paddingLeft: 56 - 16 - 4 /* shift past margin */ }}
            >
              <ScrabbleTile letter={alpha} size="sm" />
              <ScrabbleTile letter={round} size="sm" />
              <input
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={cn('ink-input font-hand text-xl py-0', stateColor)}
                value={row.name}
                onChange={(e) => onChange?.(i, e.target.value)}
                onKeyDown={(e) => handleKey(i, e)}
                disabled={readOnly}
                aria-label={`Answer for ${alpha}${round}`}
                spellCheck={false}
                autoComplete="off"
              />
              <div className="pr-2 text-right font-hand text-xl">
                {showResults && status === 'valid' && (
                  <span className="text-accent-green">✓ {row.points ?? 0}</span>
                )}
                {showResults && status === 'invalid' && <span className="text-accent-red">✗</span>}
                {showResults && status === 'unanswered' && <span className="text-ink-soft">—</span>}
              </div>
              {showResults && row.reason && status === 'invalid' && (
                <div className="col-span-4 -mt-1 pl-[88px] text-xs font-body text-accent-red/80">
                  {row.reason}
                </div>
              )}
              {showResults && row.canonicalName && row.canonicalName !== row.name && status === 'valid' && (
                <div className="col-span-4 -mt-1 pl-[88px] text-xs font-body text-ink-soft">
                  Accepted as {row.canonicalName}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
