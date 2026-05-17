// Copy-pasteable snippet builders for review resolutions. Pure
// functions — no React, no DOM, no async. Imported by both the
// ReviewQueueItem (resolving a player-submitted row) and the
// admin workbench (resolving an ad-hoc test).

import { FAMOUS_PEOPLE } from '@/data/famousPeople';
import type { Suggestion } from '@/services/soloSuggestions';
import type { TraceRecord } from '@/services/wikiValidationService';

const esc = (s: string) => s.replace(/'/g, "\\'");

/** Build a regressionSet.ts entry. For invalid rows expect=accept
 *  (false negative — we should accept), for valid rows expect=reject
 *  (false positive — we should reject). suspectedStage is woven into
 *  the note so future readers can jump straight to the chain stage
 *  the diagnoseTrace heuristic blamed. */
export function regressionSnippet(opts: {
  name: string;
  pair: string;
  actualResult: 'valid' | 'invalid';
  suspectedStage?: string;
}): string {
  const expect = opts.actualResult === 'valid' ? 'reject' : 'accept';
  const parts: string[] = [];
  if (opts.suspectedStage) parts.push(`stage: ${opts.suspectedStage}`);
  parts.push('validator bug surfaced by player feedback');
  const note = parts.join(' — ');
  return `  { name: '${esc(opts.name)}', pair: '${opts.pair.toUpperCase()}', expect: '${expect}', note: '${esc(note)}' },`;
}

/** Build a FAMOUS_PEOPLE entry to add. Description left as TODO so
 *  the admin can fill it in when pasting. */
export function famousPeopleSnippet(opts: { name: string; pair: string }): string {
  return `// Add to FAMOUS_PEOPLE['${opts.pair.toUpperCase()}']:\np('${esc(opts.name)}', 'TODO short description'),`;
}

function formatEntryAsCode(entry: Suggestion): string {
  const slugFromName = entry.name.replace(/ /g, '_');
  const expectedUrl = `https://en.wikipedia.org/wiki/${slugFromName}`;
  const customSlug = entry.wikipediaUrl && entry.wikipediaUrl !== expectedUrl;
  const slug = customSlug
    ? (entry.wikipediaUrl as string).replace('https://en.wikipedia.org/wiki/', '')
    : null;
  if (slug) {
    return `p('${esc(entry.name)}', '${esc(entry.description ?? '')}', '${esc(slug)}'),`;
  }
  return `p('${esc(entry.name)}', '${esc(entry.description ?? '')}'),`;
}

/** Build a FAMOUS_PEOPLE removal snippet. Looks up the matching
 *  entry — prefers the canonical name from the local-hit trace
 *  (authoritative), falls back to substring on the typed name. Emits
 *  a helpful comment if nothing matches in that bucket. */
export function removeFromDatasetSnippet(opts: {
  name: string;
  pair: string;
  trace: TraceRecord[];
}): string {
  const pair = opts.pair.toUpperCase();
  const bucket = FAMOUS_PEOPLE[pair] ?? [];
  const localHit = opts.trace.find((t) => t.stage === 'local' && t.outcome === 'hit');
  const fromDetail = (localHit?.detail as Record<string, unknown> | undefined)?.['canonical'];
  const targetName =
    typeof fromDetail === 'string' && fromDetail.length > 0 ? fromDetail : opts.name;
  const lc = (s: string) => s.toLowerCase();
  const needle = lc(targetName);
  const match =
    bucket.find((e) => lc(e.name) === needle) ??
    bucket.find((e) => lc(e.name).includes(needle)) ??
    bucket.find((e) => needle.includes(lc(e.name)));
  if (!match) {
    return [
      `// No FAMOUS_PEOPLE['${pair}'] entry found matching "${opts.name}".`,
      '// The chain may have accepted this via the Wikipedia path instead —',
      '// re-check the trace and consider "Approve — fix validator" instead.',
    ].join('\n');
  }
  return [`// Remove this line from FAMOUS_PEOPLE['${pair}']:`, formatEntryAsCode(match)].join('\n');
}
