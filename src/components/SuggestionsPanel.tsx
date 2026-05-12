import { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestForInitials, type Suggestion } from '@/services/soloSuggestions';
import { ALPHABET } from '@/services/sentenceService';

interface SuggestionsPanelProps {
  letters: string;
  missedIndexes: number[];
}

export function SuggestionsPanel({ letters, missedIndexes }: SuggestionsPanelProps) {
  if (missedIndexes.length === 0) return null;
  return (
    <div
      className="my-6 p-4"
      style={{
        background: '#FFF8E1',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        transform: 'rotate(-0.5deg)',
        border: '1px solid hsl(var(--ink) / 0.1)',
      }}
    >
      <Accordion type="single" collapsible>
        <AccordionItem value="suggestions">
          <AccordionTrigger className="font-hand text-2xl">Need help? Famous folks you missed →</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-3 mt-2">
              {missedIndexes.map((i) => (
                <SuggestionRow key={i} initials={`${ALPHABET[i]}${letters[i] ?? ''}`} />
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function SuggestionRow({ initials }: { initials: string }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Suggestion[]>([]);

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
    <li className="font-body text-sm text-ink">
      <span className="font-display mr-2">{initials}</span>
      {loading ? (
        <span className="text-ink-soft">looking…</span>
      ) : items.length === 0 ? (
        <span className="text-ink-soft">no obvious suggestions</span>
      ) : (
        items.map((s, idx) => (
          <span key={s.name}>
            {idx > 0 && <span className="text-ink-soft"> · </span>}
            {s.wikipediaUrl ? (
              <a href={s.wikipediaUrl} target="_blank" rel="noreferrer" className="underline">
                {s.name}
              </a>
            ) : (
              <span>{s.name}</span>
            )}
            {s.description && <span className="text-ink-soft"> ({s.description})</span>}
          </span>
        ))
      )}
    </li>
  );
}
