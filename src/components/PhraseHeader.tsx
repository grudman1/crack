import type { Phrase } from '@/services/phraseService';
import { cn } from '@/lib/utils';

interface PhraseHeaderProps {
  phrase: Phrase;
  className?: string;
}

export function PhraseHeader({ phrase, className }: PhraseHeaderProps) {
  return (
    <div className={cn('text-center', className)}>
      <p className="font-serif italic leading-snug text-ink" style={{ fontSize: '1.0625rem' }}>
        “{phrase.text}”
      </p>
      <p className="mt-2 font-sans text-xs text-muted">
        <a
          href={phrase.wikipediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-hairline underline-offset-4 hover:text-ink hover:decoration-ink"
        >
          {phrase.source}
        </a>
      </p>
    </div>
  );
}
