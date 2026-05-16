// Static lookup against the curated dataset in src/data/famousPeople.ts.
// No runtime network calls. Suggestion shape stays stable for SuggestionsPanel.
//
// To refresh the dataset, run `npm run gen-people` from the repo root.

import { FAMOUS_PEOPLE } from '@/data/famousPeople';

export interface Suggestion {
  name: string;
  description?: string;
  wikipediaUrl?: string;
}

export async function suggestForInitials(initials: string, limit = 3): Promise<Suggestion[]> {
  const key = (initials ?? '').slice(0, 2).toUpperCase();
  const entries = FAMOUS_PEOPLE[key] ?? [];
  return entries.slice(0, Math.max(0, limit));
}
