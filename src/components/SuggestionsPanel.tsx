import { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestForInitials, type Suggestion } from '@/services/soloSuggestions';
import { ALPHABET } from '@/services/sentenceService';

interface SuggestionsPanelProps {
  letters: string;
  missedIndexes: number[];
  /** When true, the panel renders expanded on first paint. */
  defaultOpen?: boolean;
}

export function SuggestionsPanel({ letters, missedIndexes, defaultOpen = false }: SuggestionsPanelProps) {
  if (missedIndexes.length === 0) return null;
  return (
    <div className="mt-8">
      <Accordion type="single" collapsible defaultValue={defaultOpen ? 'suggestions' : undefined}>
        <AccordionItem value="suggestions">
          <AccordionTrigger className="font-serif text-base font-bold text-ink">
            Famous folks you missed
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2">
              {missedIndexes.map((i) => (
                <SuggestionRow key={i} alpha={ALPHABET[i]!} round={letters[i] ?? ''} />
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function SuggestionRow({ alpha, round }: { alpha: string; round: string }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Suggestion[]>([]);
  const initials = `${alpha}${round}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    suggestForInitials(initials, 3)
      .then((r) => {
        if (alive) setItems(r);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initials]);

  return (
    <li className="grid items-baseline gap-3" style={{ gridTemplateColumns: '3.5rem 1fr' }}>
      <span className="letter-pair">
        {alpha} <span aria-hidden>·</span> {round}
      </span>
      <span className="font-sans text-sm text-ink">
        {loading ? (
          <span className="text-muted">looking…</span>
        ) : items.length === 0 ? (
          <span className="text-muted">no obvious suggestions</span>
        ) : (
          items.map((s, idx) => (
            <span key={s.name}>
              {idx > 0 && <span className="text-muted"> · </span>}
              {s.wikipediaUrl ? (
                <a
                  href={s.wikipediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-hairline underline-offset-4 hover:decoration-ink"
                >
                  {s.name}
                </a>
              ) : (
                <span>{s.name}</span>
              )}
              {s.description && <span className="text-muted"> ({s.description})</span>}
            </span>
          ))
        )}
      </span>
    </li>
  );
}
