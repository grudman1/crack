import { useRef, useState } from 'react';
import { Check, HelpCircle, X } from 'lucide-react';
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
  /** When showing results, an invalid row may offer the player a "?"
   *  link that opens a review-submission flow. Caller maps the index
   *  back to its own row data. Omitting this prop hides the icon. */
  onSubmitForReview?: (index: number) => void;
  /** Indexes whose review has already been submitted. The "?" is
   *  replaced with a muted "Submitted ✓" badge so the player doesn't
   *  re-submit. */
  submittedReviewIndexes?: Set<number>;
}

export function InitialsGrid({
  letters,
  rows,
  onChange,
  readOnly = false,
  showResults = false,
  className,
  onSubmitForReview,
  submittedReviewIndexes,
}: InitialsGridProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState<number | null>(null);

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
    <div className={cn('w-full', className)}>
      <ul className="border-t border-hairline">
        {ALPHABET.map((alpha, i) => {
          const round = (letters[i] ?? ' ').toUpperCase();
          const row = rows[i] ?? { name: '' };
          const status = row.status;
          const valid = status === 'valid';
          const invalid = status === 'invalid';
          const unanswered = status === 'unanswered';
          const isFocused = focused === i;

          return (
            <li
              key={alpha}
              className="grid grid-cols-[3.75rem_minmax(0,1fr)_auto_1.75rem] items-center gap-3 border-b border-hairline px-1 py-[14px] lg:grid-cols-[4.75rem_minmax(0,1fr)_auto_1.75rem] lg:gap-4"
            >
              <span className="letter-pair">
                {alpha} <span aria-hidden>·</span> {round}
              </span>
              <div className="flex min-w-0 items-baseline gap-3 overflow-hidden">
                {showResults ? (
                  <span
                    className={cn(
                      'min-w-0 shrink-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-sans text-base text-ink lg:text-[17px]',
                      invalid && 'text-muted line-through decoration-muted',
                      unanswered && 'text-empty',
                    )}
                  >
                    {row.name || ' '}
                  </span>
                ) : (
                  <input
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    className={cn(
                      'input-line min-w-0 flex-1 text-base lg:text-[17px]',
                      isFocused && 'input-line--active',
                    )}
                    value={row.name}
                    onChange={(e) => onChange?.(i, e.target.value)}
                    onKeyDown={(e) => handleKey(i, e)}
                    onFocus={() => setFocused(i)}
                    onBlur={() => setFocused((f) => (f === i ? null : f))}
                    disabled={readOnly}
                    aria-label={`Answer for ${alpha}${round}`}
                    spellCheck={false}
                    autoComplete="off"
                  />
                )}
                {showResults && invalid && row.reason && (
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-sans text-xs text-error lg:text-[13px]">
                    {row.reason}
                  </span>
                )}
                {/* Review flag: appears on both rejected rows ("I think
                    this should count") and accepted rows ("I think this
                    shouldn't count"). Hidden once the player submits — a
                    muted badge takes its place to prevent re-submits. */}
                {showResults && row.name && onSubmitForReview && (valid || (invalid && row.reason)) && (
                  submittedReviewIndexes?.has(i) ? (
                    <span
                      className="ml-auto shrink-0 font-sans text-[10px] uppercase tracking-wider text-muted"
                      aria-label="Submitted for review"
                    >
                      Submitted ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSubmitForReview(i)}
                      className="ml-auto shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-hairline/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                      aria-label={`Submit "${row.name}" for review`}
                      title={
                        invalid
                          ? 'This should count — submit for review'
                          : "This shouldn't count — submit for review"
                      }
                    >
                      <HelpCircle className="h-[14px] w-[14px]" strokeWidth={1.75} />
                    </button>
                  )
                )}
              </div>
              <span className="font-serif text-sm tabular-nums text-muted lg:text-base">
                {showResults && valid && (row.points ?? 0) > 0 ? row.points ?? 0 : ''}
              </span>
              <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
                {showResults && valid && (
                  <Check className="h-4 w-4 text-success lg:h-[18px] lg:w-[18px]" strokeWidth={2.25} />
                )}
                {showResults && invalid && (
                  <X className="h-4 w-4 text-error lg:h-[18px] lg:w-[18px]" strokeWidth={2.25} />
                )}
                {showResults && unanswered && <span className="text-empty">—</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
