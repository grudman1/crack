import type { Phrase } from '@/services/phraseService';
import { cn } from '@/lib/utils';

interface PhraseHeaderProps {
  phrase: Phrase;
  className?: string;
}

export function PhraseHeader({ phrase, className }: PhraseHeaderProps) {
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
          className="underline decoration-hairline underline-offset-4 hover:text-ink hover:decoration-ink"
        >
          {phrase.source}
        </a>
      </p>
    </div>
  );
}
