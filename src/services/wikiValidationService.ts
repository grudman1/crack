// Wikipedia + Wikidata validation pipeline for CRACK.
// Pipeline:
//   1. Wikipedia REST /page/summary/{title} lookup
//   2. If not found → search + best Levenshtein match ≤ 2
//   3. Reject disambiguation pages
//   4. Wikidata P31 claims must include Q5 (human); fictional Q-IDs rejected
//   5. Initials must match (after normalization)

export type ValidationStatus = 'valid' | 'invalid';

export interface ValidationResult {
  status: ValidationStatus;
  reason?: string;
  canonicalName?: string;
  wikipediaUrl?: string;
}

const SUFFIXES = new Set(['JR', 'SR', 'I', 'II', 'III', 'IV', 'V', 'PHD', 'MD', 'ESQ']);

const FICTIONAL_QIDS = new Set([
  'Q15632617', // fictional human
  'Q95074', // fictional character
  'Q3247054', // fictional character (specific)
  'Q15773347', // fictional animal
  'Q21070568', // fictional entity
]);

const DEBUG = false;

export function computeNameInitials(name: string): string {
  const cleaned = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\([^)]*\)/g, '') // strip parens
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const filtered = parts.filter((p) => {
    const tok = p.toUpperCase().replace(/\.$/, '');
    return !SUFFIXES.has(tok);
  });
  if (filtered.length < 2) return '';
  const first = filtered[0]!;
  const last = filtered[filtered.length - 1]!;
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

interface WikiSummary {
  title: string;
  description?: string;
  extract?: string;
  type?: string; // "standard" | "disambiguation" | "no-extract"
  content_urls?: { desktop?: { page?: string } };
  wikibase_item?: string;
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as WikiSummary;
  } catch (e) {
    if (DEBUG) console.error('summary failed', title, e);
    return null;
  }
}

interface WikiSearchHit {
  title: string;
  snippet?: string;
}

async function searchWikipedia(query: string): Promise<WikiSearchHit[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&format=json&origin=*&srlimit=5`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { query?: { search?: WikiSearchHit[] } };
    return data.query?.search ?? [];
  } catch {
    return [];
  }
}

interface WikidataEntity {
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>>;
}

async function fetchWikidata(qid: string): Promise<WikidataEntity | null> {
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { entities?: Record<string, WikidataEntity> };
    return data.entities?.[qid] ?? null;
  } catch {
    return null;
  }
}

function instanceClaims(entity: WikidataEntity | null): string[] {
  if (!entity?.claims?.P31) return [];
  return entity.claims.P31
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter((x): x is string => Boolean(x));
}

const cache = new Map<string, ValidationResult>();

export interface ValidateOptions {
  expectedInitials?: string;
}

export async function validateName(name: string, opts: ValidateOptions = {}): Promise<ValidationResult> {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { status: 'invalid', reason: 'empty answer' };

  const cacheKey = `${trimmed.toLowerCase()}|${opts.expectedInitials ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const result = await _validate(trimmed, opts);
  cache.set(cacheKey, result);
  return result;
}

async function _validate(name: string, opts: ValidateOptions): Promise<ValidationResult> {
  const parts = name.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { status: 'invalid', reason: 'need first and last name' };

  let summary = await fetchSummary(name);
  let canonical = name;

  if (!summary || summary.type === 'no-extract') {
    const hits = await searchWikipedia(name);
    if (hits.length === 0) return { status: 'invalid', reason: 'no Wikipedia page found' };
    const best = hits
      .map((h) => ({ h, d: levenshtein(h.title.toLowerCase(), name.toLowerCase()) }))
      .sort((a, b) => a.d - b.d)[0]!;
    if (best.d > 2) return { status: 'invalid', reason: 'spelling too far from known figure' };
    summary = await fetchSummary(best.h.title);
    canonical = best.h.title;
    if (!summary) return { status: 'invalid', reason: 'no Wikipedia page found' };
  }

  if (summary.type === 'disambiguation') {
    return { status: 'invalid', reason: 'be more specific' };
  }

  const qid = summary.wikibase_item;
  if (!qid) return { status: 'invalid', reason: 'not a real person' };

  const wd = await fetchWikidata(qid);
  const p31 = instanceClaims(wd);
  const isHuman = p31.includes('Q5');
  const isFictional = p31.some((q) => FICTIONAL_QIDS.has(q));

  if (isFictional) return { status: 'invalid', reason: 'fictional characters not allowed' };
  if (!isHuman) return { status: 'invalid', reason: 'not a real person' };

  // Initials check
  if (opts.expectedInitials) {
    const actualInitials = computeNameInitials(canonical) || computeNameInitials(name);
    if (actualInitials !== opts.expectedInitials.toUpperCase()) {
      return {
        status: 'invalid',
        reason: `expected ${opts.expectedInitials.toUpperCase()}, got ${actualInitials}`,
      };
    }
  }

  return {
    status: 'valid',
    canonicalName: canonical,
    wikipediaUrl: summary.content_urls?.desktop?.page,
  };
}

export function clearValidationCache() {
  cache.clear();
}
