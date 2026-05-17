import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Phrase } from '@/services/phraseService';
import { cn } from '@/lib/utils';

interface PhraseHeaderProps {
  phrase: Phrase;
  /** When `'auto'`, collapses after 3 s or first keystroke (set parent-side
   *  by bumping `interactionKey` whenever the player types). When
   *  `'static'`, never collapses — used on Solo setup, validating, and
   *  results screens where the phrase IS the headline. */
  mode?: 'auto' | 'static';
  /** Bump this whenever the player types — triggers immediate collapse. */
  interactionKey?: number;
  className?: string;
}

const AUTO_COLLAPSE_MS = 3000;
const RE_COLLAPSE_MS = 5000;

export function PhraseHeader({ phrase, mode = 'static', interactionKey = 0, className }: PhraseHeaderProps) {
  const [collapsed, setCollapsed] = useState(false);
  const reCollapseTimer = useRef<number | null>(null);
  const firstInteractionAt = useRef<number | null>(null);

  // Auto-collapse after 3 s.
  useEffect(() => {
    if (mode !== 'auto') return;
    const t = window.setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_MS);
    return () => window.clearTimeout(t);
  }, [mode]);

  // Collapse on first keystroke (interactionKey bumps from parent).
  useEffect(() => {
    if (mode !== 'auto') return;
    if (interactionKey === 0) return; // initial
    if (firstInteractionAt.current === null) firstInteractionAt.current = Date.now();
    setCollapsed(true);
  }, [interactionKey, mode]);

  const expandTemporarily = () => {
    setCollapsed(false);
    if (reCollapseTimer.current) window.clearTimeout(reCollapseTimer.current);
    reCollapseTimer.current = window.setTimeout(() => {
      setCollapsed(true);
      reCollapseTimer.current = null;
    }, RE_COLLAPSE_MS);
  };

  useEffect(() => {
    return () => {
      if (reCollapseTimer.current) window.clearTimeout(reCollapseTimer.current);
    };
  }, []);

  if (collapsed) {
    return (
      <div className={cn('text-center', className)}>
        <button
          type="button"
          onClick={expandTemporarily}
          className="group inline-flex max-w-full items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap rounded px-1 py-0.5 font-sans text-[14px] italic text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          aria-label="Expand round phrase"
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            “{phrase.text}”
          </span>
          <span className="shrink-0 text-muted/70">— {phrase.source}</span>
          <ExternalLink className="ml-0.5 h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('text-center', className)}>
      <p className="font-serif italic leading-snug text-ink text-[1.0625rem] lg:text-[1.375rem]">
        “{phrase.text}”
      </p>
      <p className="mt-2 font-sans text-xs text-muted lg:mt-3 lg:text-sm">
        <a
          href={phrase.wikipediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-hairline underline-offset-4 hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {phrase.source}
        </a>
      </p>
    </div>
  );
}
